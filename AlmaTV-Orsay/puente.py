#!/usr/bin/env python3
"""Optional LAN bridge. Standard library only, Python 3.8+, verified HTTPS."""
import argparse
import hashlib
import mimetypes
import re
from pathlib import Path
import json
import secrets
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit, urlencode
from urllib.request import urlopen, Request, build_opener, ProxyHandler, HTTPRedirectHandler
from urllib.error import HTTPError
from preparar import private_ipv4
from youtube_library import Library, Realtime
from hub import Hub
from hub_http import HubHTTP

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

MEDIA_TYPES={'.mp3':('audio','audio/mpeg'),'.m4a':('audio','audio/mp4'),'.wav':('audio','audio/wav'),'.mp4':('video','video/mp4'),'.m4v':('video','video/mp4'),'.webm':('video','video/webm')}

def media_files(directory):
    if directory is None:return {}
    root=Path(directory).resolve()
    found={}
    for item in sorted(root.iterdir()):
        if len(found)>=100:break
        if item.is_symlink() or not item.is_file() or item.suffix.lower() not in MEDIA_TYPES:continue
        resolved=item.resolve()
        if resolved.parent!=root:continue
        ident=hashlib.sha256(item.name.encode('utf-8')).hexdigest()[:16]
        found[ident]=resolved
    return found

def stream_media(self,path):
    size=path.stat().st_size
    start,end,status=0,size-1,200
    value=self.headers.get('Range')
    if value:
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',value)
        if not match or not any(match.groups()):
            self.reply(416,{'error':'Intervalo no válido'})
            return
        first,last=match.groups()
        if first:
            start=int(first);end=min(size-1,int(last)) if last else size-1
        else:
            start=max(0,size-int(last));end=size-1
        if start<0 or start>=size or end<start:
            self.reply(416,{'error':'Intervalo fuera del archivo'})
            return
        status=206
    self.send_response(status)
    origin=self.headers.get('Origin')
    if origin in self.server.origins:self.send_header('Access-Control-Allow-Origin',origin)
    self.send_header('Content-Type',MEDIA_TYPES.get(path.suffix.lower(),('photo',mimetypes.guess_type(path.name)[0] or 'application/octet-stream'))[1])
    self.send_header('Accept-Ranges','bytes')
    self.send_header('Content-Length',str(max(0,end-start+1)))
    if status==206:self.send_header('Content-Range','bytes %s-%s/%s'%(start,end,size))
    self.end_headers()
    with path.open('rb') as stream:
        stream.seek(start)
        remaining=end-start+1
        while remaining>0:
            chunk=stream.read(min(65536,remaining))
            if not chunk:break
            self.wfile.write(chunk)
            remaining-=len(chunk)


class Handler(HubHTTP,BaseHTTPRequestHandler):
    def panel_origin(self):
        return 'http://%s:%s' % self.server.server_address[:2]
    def panel_host_allowed(self):
        return self.headers.get('Host') == self.panel_origin().split('//',1)[1]
    def origin_allowed(self):
        origin=self.headers.get('Origin')
        return origin is None or origin in self.server.origins or origin == self.panel_origin()
    def reply(self,status,body,content_type='application/json; charset=utf-8',extra_headers=None):
        if not isinstance(body,bytes):
            body=json.dumps(body,ensure_ascii=True).encode('utf-8')
        self.send_response(status)
        origin=self.headers.get('Origin')
        if origin in self.server.origins or origin == self.panel_origin():
            self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Vary','Origin')
        self.send_header('Access-Control-Max-Age','600')
        self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type, X-Alma-Token, X-Alma-Filename')
        self.send_header('Content-Type',content_type)
        self.send_header('Cache-Control','no-store')
        self.send_header('Referrer-Policy','origin')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Length',str(len(body)))
        for name,value in (extra_headers or {}).items(): self.send_header(name,value)
        self.end_headers()
        self.wfile.write(body)
    def do_OPTIONS(self):
        self.reply(204 if self.origin_allowed() else 403,b'')
    def do_GET(self):
        self.dispatch('GET')
    def do_POST(self):
        self.dispatch('POST')
    def panel(self,method,live=False):
        if not self.panel_host_allowed():
            self.reply(403,{'error':'Dirección del puente no autorizada'})
            return
        library=getattr(self.server,'youtube_library',None)
        if library is None:
            self.reply(503,{'error':'La lista de enlaces no está configurada. Actualiza el puente.'})
            return
        try:
            if method=='GET':
                if live and hasattr(self.server,'hub') and self.client_address[0] in self.server.hub.data['channels'] and self.client_address[0]!=self.server.tv:
                    self.reply(200,{'command':None,'status':'idle'});return
                self.reply(200,self.server.realtime.snapshot() if live else {'items':library.read()})
                return
            origin=self.headers.get('Origin')
            token=self.headers.get('X-Alma-Token','')
            if not (self.hub_authorized() if hasattr(self.server,'hub') else (origin==self.panel_origin() and token and secrets.compare_digest(token,getattr(self.server,'admin_token','')))):
                self.reply(403,{'error':'Actualiza la página de enlaces y vuelve a intentarlo.'})
                return
            if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':
                self.reply(415,{'error':'Formato de solicitud no válido.'})
                return
            try: size=int(self.headers.get('Content-Length','0'))
            except ValueError: size=0
            if not 0<size<=32768:
                self.reply(413,{'error':'La solicitud es demasiado grande o está vacía.'})
                return
            self.connection.settimeout(5)
            data=json.loads(self.rfile.read(size).decode('utf-8'))
            self.reply(200,self.server.realtime.publish(data) if live else {'items':library.change(data)})
        except (ValueError,UnicodeError) as error:
            self.reply(400,{'error':str(error) if not isinstance(error,json.JSONDecodeError) else 'Solicitud JSON no válida.'})
    def live_ack(self):
        if self.client_address[0] != self.server.tv:
            self.reply(403,{'error':'Solo la TV configurada puede confirmar la orden'})
            return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=2048 or self.headers.get('Content-Type','').split(';')[0]!='application/json':
                raise ValueError('Solicitud no válida.')
            self.connection.settimeout(5)
            data=json.loads(self.rfile.read(size).decode('utf-8'))
            self.reply(200,self.server.realtime.acknowledge(data))
        except (ValueError,UnicodeError):
            self.reply(400,{'error':'Confirmación no válida o vencida'})

    def serve_panel(self):
        if not self.panel_host_allowed():
            self.reply(403,{'error':'Dirección del puente no autorizada'})
            return
        if hasattr(self.server,'hub') and not self.hub_session():self.serve_hub_panel();return
        token=json.dumps(self.hub_session()['csrf'] if hasattr(self.server,'hub') else self.server.admin_token)
        page=(Path(__file__).resolve().parent/'link_panel.html').read_text(encoding='utf-8').replace('__ALMA_PANEL_TOKEN__',token)
        self.reply(200,page.encode('utf-8'),'text/html; charset=utf-8',{'X-Frame-Options':'DENY','Content-Security-Policy':"frame-ancestors 'none'"})
    def youtube_diagnostic(self,method):
        if not self.panel_host_allowed():
            self.reply(403,{'error':'Dirección del puente no autorizada'})
            return
        if method=='GET':
            self.reply(200,{'revision':'inicio-2','report':getattr(self.server,'youtube_diagnostic',None),'reports':getattr(self.server,'youtube_diagnostics',{})})
            return
        if self.headers.get('Origin')!=self.panel_origin() or self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':
            self.reply(403,{'error':'Origen de diagnóstico no autorizado'})
            return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=4096: raise ValueError()
            self.connection.settimeout(5)
            data=json.loads(self.rfile.read(size).decode('utf-8'))
            if not isinstance(data,dict) or not re.fullmatch(r'[a-f0-9]{32}',str(data.get('token',''))): raise ValueError()
            report={'status':str(data.get('status',''))[:300],'phase':str(data.get('phase',''))[:24],'received_at':int(time.time())}
            for key in ('state','seconds','width','height'):
                value=data.get(key)
                if value is None or isinstance(value,(int,float)) and -1<=value<=1000000000: report[key]=value
            report['h264']=str(data.get('h264',''))[:16]
            report['mse']=data.get('mse') is True
            report['muted']=data.get('muted') if isinstance(data.get('muted'),bool) else None
            report['source']='directo' if data.get('source')=='directo' else 'alma-tv'
            reports=getattr(self.server,'youtube_diagnostics',{})
            reports[report['source']]=report
            self.server.youtube_diagnostics=reports
            self.server.youtube_diagnostic=report
            self.reply(200,{'ok':True})
        except (ValueError,UnicodeError):
            self.reply(400,{'error':'Diagnóstico no válido'})
    def serve_youtube(self,query,standalone=False):
        video=query.get('video',['M7lc1UVf-VE' if standalone else ''])[0]
        provider=query.get('provider',['youtube'])[0]
        token=secrets.token_hex(16) if standalone else query.get('token',[''])[0]
        parent=self.panel_origin() if standalone else query.get('parent',['null'])[0]
        if provider not in ('youtube','dailymotion') or not (re.fullmatch(r'[A-Za-z0-9]{5,12}',video) if provider=='dailymotion' else re.fullmatch(r'[A-Za-z0-9_-]{11}',video)) or not re.fullmatch(r'[a-f0-9]{32}',token) or (not standalone and parent not in self.server.origins):
            self.reply(400,{'error':'Vídeo, sesión u origen del reproductor no válido'})
            return
        config=json.dumps({'video':video,'provider':provider,'token':token,'parent':parent,'standalone':standalone,'autoplay':not standalone and query.get('autoplay',['0'])[0]=='1'},ensure_ascii=True).replace('<','\\u003c')
        template=(Path(__file__).resolve().parent/'youtube_player.html').read_text(encoding='utf-8')
        body=template.replace('__ALMA_YT_CONFIG__',config).encode('utf-8')
        self.reply(200,body,'text/html; charset=utf-8')
    def serve_media(self,ident):
        directory=getattr(self.server,'media_dir',None)
        files=media_files(directory)
        if ident not in files:
            self.reply(404,{'error':'Archivo no disponible'})
            return
        path=files[ident]
        stream_media(self,path)
    def dispatch(self,method):
        if not self.origin_allowed():
            self.reply(403,{'error':'Origen no autorizado'})
            return
        parsed=urlsplit(self.path)
        query=parse_qs(parsed.query)
        try:
            if hasattr(self.server,'hub') and parsed.path.startswith('/hub/'):
                self.hub_dispatch(method,parsed)
            elif hasattr(self.server,'hub') and method=='GET' and parsed.path=='/control':
                self.serve_hub_panel()
            elif method=='GET' and parsed.path=='/health':
                self.reply(200,{'service':'alma-lan-bridge','dial_launch_enabled':self.server.allow_launch})
            elif method=='GET' and parsed.path in ('/','/enlaces'):
                self.serve_panel()
            elif parsed.path=='/youtube/live' and method in ('GET','POST'):
                self.panel(method,live=True)
            elif parsed.path=='/youtube/live/ack' and method=='POST':
                self.live_ack()
            elif parsed.path=='/youtube/library' and method in ('GET','POST'):
                self.panel(method)
            elif parsed.path=='/youtube/diagnostic' and method in ('GET','POST'):
                self.youtube_diagnostic(method)
            elif method=='GET' and parsed.path=='/youtube/prueba':
                self.serve_youtube(query,standalone=True)
            elif method=='GET' and parsed.path=='/youtube/player':
                self.serve_youtube(query)
            elif method=='GET' and parsed.path=='/media/library':
                directory=getattr(self.server,'media_dir',None)
                files=media_files(directory)
                self.reply(200,{'enabled':directory is not None,'items':[{'id':ident,'name':path.stem,'kind':MEDIA_TYPES[path.suffix.lower()][0]} for ident,path in files.items()]})
            elif method=='GET' and re.fullmatch(r'/media/file/[a-f0-9]{16}',parsed.path):
                self.serve_media(parsed.path.rsplit('/',1)[1])
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
        except (BrokenPipeError, ConnectionResetError):
            return
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
    p.add_argument('--media-dir',help='Carpeta dedicada con música y videos propios, sin subcarpetas ni enlaces simbólicos')
    p.add_argument('--links-file',default=str(Path.home()/'Library/Application Support/AlmaTV/youtube-links.json'),help='Archivo local persistente de la lista de enlaces')
    p.add_argument('--allow-launch',action='store_true',help='Autoriza POST DIAL a Netflix/YouTube cuando el usuario los pulse')
    a=p.parse_args()
    server=ThreadingHTTPServer((private_ipv4(a.bind),a.port),Handler)
    server.media_dir=Path(a.media_dir).expanduser().resolve() if a.media_dir else None
    if server.media_dir is not None and not server.media_dir.is_dir():p.error('La carpeta de archivos multimedia no existe')
    server.hub=Hub(Path(a.links_file).expanduser().parent/'hub',private_ipv4(a.tv))
    server.realtime=Realtime()
    server.youtube_library=Library(Path(a.links_file).expanduser())
    server.admin_token=secrets.token_urlsafe(32)
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
