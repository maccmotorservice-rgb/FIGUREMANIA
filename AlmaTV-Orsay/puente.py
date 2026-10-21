#!/usr/bin/env python3
"""Optional LAN bridge. Standard library only, Python 3.8+, verified HTTPS."""
import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit, urlencode
from urllib.request import urlopen, Request, build_opener, ProxyHandler, HTTPRedirectHandler
from urllib.error import HTTPError
from preparar import private_ipv4

CACHE={}
WEATHER_CODES={0:'Despejado',1:'Mayormente despejado',2:'Parcialmente nublado',3:'Nublado',45:'Niebla',48:'Niebla con escarcha',51:'Llovizna ligera',53:'Llovizna',55:'Llovizna intensa',61:'Lluvia ligera',63:'Lluvia',65:'Lluvia intensa',71:'Nieve ligera',73:'Nieve',75:'Nieve intensa',80:'Chubascos ligeros',81:'Chubascos',82:'Chubascos intensos',95:'Tormenta',96:'Tormenta con granizo',99:'Tormenta intensa con granizo'}
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirecciones DIAL no permitidas')

LOCAL_OPENER=build_opener(ProxyHandler({}), NoRedirect())

def read_json(url):
    # Uses Python's default certificate verification; never install an unverified context.
    with urlopen(url,timeout=5) as response:
        return json.loads(response.read(262144).decode('utf-8'))

def weather(city):
    cached=CACHE.get(city)
    if cached and time.time()-cached[0]<600:
        return cached[1]
    name=city.split(',')[0].strip()
    data=read_json('https://geocoding-api.open-meteo.com/v1/search?'+urlencode({'name':name,'count':1,'language':'es','format':'json'}))
    if not data.get('results'):
        raise ValueError('Ciudad no encontrada')
    place=data['results'][0]
    forecast=read_json('https://api.open-meteo.com/v1/forecast?'+urlencode({'latitude':place['latitude'],'longitude':place['longitude'],'current':'temperature_2m,weather_code,is_day','timezone':'auto'}))
    current=forecast['current']
    value={'city':', '.join(filter(None,[place.get('name'),place.get('admin1'),place.get('country')])),'temperature':current['temperature_2m'],'observed_at':current['time']+' '+forecast.get('timezone',''),'code':current['weather_code'],'is_day':current.get('is_day'),'description':WEATHER_CODES.get(current['weather_code'],'Código meteorológico '+str(current['weather_code'])),'provider':'Open-Meteo','license':'CC BY 4.0'}
    CACHE[city]=(time.time(),value)
    return value

class Handler(BaseHTTPRequestHandler):
    def origin_allowed(self):
        origin=self.headers.get('Origin')
        return origin is None or origin in self.server.origins
    def reply(self,status,body,content_type='application/json; charset=utf-8'):
        if not isinstance(body,bytes):
            body=json.dumps(body,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        origin=self.headers.get('Origin')
        if origin in self.server.origins:
            self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Vary','Origin')
        self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type')
        self.send_header('Content-Type',content_type)
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_OPTIONS(self):
        self.reply(204 if self.origin_allowed() else 403,b'')
    def do_GET(self):
        self.dispatch('GET')
    def do_POST(self):
        self.dispatch('POST')
    def dispatch(self,method):
        if not self.origin_allowed():
            self.reply(403,{'error':'Origen no autorizado'})
            return
        parsed=urlsplit(self.path)
        query=parse_qs(parsed.query)
        try:
            if method=='GET' and parsed.path=='/health':
                self.reply(200,{'service':'alma-lan-bridge','dial_launch_enabled':self.server.allow_launch})
            elif method=='GET' and parsed.path=='/weather':
                city=query.get('city',[''])[0].strip()
                if not city or len(city)>80:
                    self.reply(400,{'error':'Ciudad requerida, máximo 80 caracteres'})
                else:
                    self.reply(200,weather(city))
            elif parsed.path in ('/dial/YouTube','/dial/Netflix'):
                tv=query.get('tv',[self.server.tv])[0]
                if tv!=self.server.tv:
                    self.reply(403,{'error':'Solo la TV configurada está permitida'})
                    return
                if method=='POST' and not self.server.allow_launch:
                    self.reply(403,{'error':'Lanzamientos desactivados. Requieren --allow-launch explícito en la Mac.'})
                    return
                name=parsed.path.rsplit('/',1)[1]
                request=Request('http://%s:8080/ws/app/%s'%(tv,name),data=b'' if method=='POST' else None,method=method)
                # No redirects to arbitrary destinations or inherited Internet proxies.
                with LOCAL_OPENER.open(request,timeout=4) as response:
                    if urlsplit(response.geturl()).hostname!=tv:
                        raise ValueError('Redirección DIAL inesperada')
                    self.reply(response.status,response.read(65536),'application/xml; charset=utf-8')
            else:
                self.reply(404,{'error':'Ruta no disponible'})
        except HTTPError as error:
            self.reply(error.code,{'error':'HTTP del servicio remoto','status':error.code})
        except Exception:
            self.reply(502,{'error':'Servicio no disponible; no hay datos actuales'})
    def log_message(self,fmt,*args):
        # No URLs, city strings or response bodies in persistent logs.
        print('Solicitud local procesada',flush=True)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bind',required=True)
    p.add_argument('--tv',default='192.168.1.249')
    p.add_argument('--port',type=int,default=8088)
    p.add_argument('--origin',action='append',default=[],help='Origen exacto adicional de tu widget, si es necesario')
    p.add_argument('--allow-launch',action='store_true',help='Autoriza POST DIAL a Netflix/YouTube cuando el usuario los pulse')
    a=p.parse_args()
    server=ThreadingHTTPServer((private_ipv4(a.bind),a.port),Handler)
    server.tv=private_ipv4(a.tv)
    server.allow_launch=a.allow_launch
    server.origins=['null','http://127.0.0.1:8765','http://localhost:8765']+a.origin
    print('Puente LAN en %s:%s. DIAL POST: %s. Solo red Wi-Fi de confianza; no abrir puertos del router.'%(a.bind,a.port,a.allow_launch),flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
if __name__=='__main__':
    main()
