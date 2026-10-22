"""HTTP endpoints for the local paired hub; mixed into the bridge handler."""
from http.cookies import SimpleCookie
import json
import mimetypes
from pathlib import Path
import re
import secrets
from urllib.parse import parse_qs, unquote, urlsplit
from hub import public_open

class HubHTTP:
    def hub_session(self):
        try:
            cookie=SimpleCookie(self.headers.get('Cookie',''));token=cookie['alma_session'].value if 'alma_session' in cookie else ''
            session=self.server.hub.session(token)
            if session:return session
        except Exception:pass
        return {'role':'owner','csrf':self.server.admin_token} if self.client_address[0]==self.server.server_address[0] else None
    def hub_authorized(self,owner=True):
        session=self.hub_session()
        token=self.headers.get('X-Alma-Token','')
        return session if session and (not owner or session['role']=='owner') and self.headers.get('Origin')==self.panel_origin() and token and secrets.compare_digest(token,session['csrf']) else None
    def hub_json(self):
        size=int(self.headers.get('Content-Length','0'))
        if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json' or not 0<size<=32768:raise ValueError('Solicitud no válida.')
        self.connection.settimeout(10)
        data=json.loads(self.rfile.read(size).decode('utf-8'))
        if not isinstance(data,dict):raise ValueError('Solicitud no válida.')
        return data
    def serve_hub_panel(self):
        if not self.panel_host_allowed():self.reply(403,{'error':'Dirección no autorizada'});return
        session=self.hub_session()
        config={'token':session['csrf'] if session else '', 'role':session['role'] if session else '', 'target':self.server.tv}
        page=(Path(__file__).resolve().parent/'hub_panel.html').read_text().replace('__ALMA_HUB_CONFIG__',json.dumps(config).replace('<','\\u003c'))
        self.reply(200,page.encode(),'text/html; charset=utf-8',{'X-Frame-Options':'DENY','Content-Security-Policy':"frame-ancestors 'none'"})
    def hub_dispatch(self,method,parsed):
        hub=self.server.hub;session=self.hub_session();query=parse_qs(parsed.query);path=parsed.path
        if not self.panel_host_allowed():self.reply(403,{'error':'Dirección no autorizada'});return
        try:
            if path=='/hub/pair' and method=='POST':
                if self.headers.get('Origin')!=self.panel_origin():raise PermissionError('Origen no autorizado.')
                data=self.hub_json();token,session=hub.pair(data.get('pin',''),self.client_address[0])
                self.reply(200,{'role':session['role']},extra_headers={'Set-Cookie':'alma_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800'});return
            if path=='/hub/tv':
                target=self.client_address[0]
                if target not in hub.data['channels']:raise PermissionError('TV no registrada.')
                event=self.hub_json() if method=='POST' else None
                if method not in ('GET','POST'):raise ValueError('Método no disponible.')
                self.reply(200,hub.tv(target,event));return
            if path=='/hub/background' and method=='GET':
                self.reply(200,(Path(__file__).resolve().parent/'app/assets/salvapantallas.png').read_bytes(),'image/png');return
            if path.startswith('/hub/icon/') and method=='GET':
                name=path.rsplit('/',1)[1]
                if name not in {key+'.png' for key in ('home','search','apps','media','hub','clock','weather','calendar','timer','settings','saver')}:raise ValueError('Icono no disponible.')
                self.reply(200,(Path(__file__).resolve().parent/'app/assets/icons'/name).read_bytes(),'image/png');return
            if path=='/hub/qr.js' and method=='GET':
                self.reply(200,(Path(__file__).resolve().parent/'app/assets/qrcode.js').read_bytes(),'application/javascript');return
            if self.client_address[0] in hub.data['channels'] and path.startswith(('/hub/file/','/hub/stream/')):
                session={'role':'tv'}
            if not session:raise PermissionError('Vincula este dispositivo con el código de la TV.')
            target=query.get('target',[self.server.tv])[0]
            if path=='/hub/state' and method=='GET':
                from puente import media_files, MEDIA_TYPES
                hub.mac_files={ 'mac:'+ident:(file,MEDIA_TYPES[file.suffix.lower()][0]) for ident,file in media_files(getattr(self.server,'media_dir',None)).items() }
                self.reply(200,hub.snapshot(target,session['role']));return
            if path in ('/hub/action','/hub/podcast','/hub/convert','/hub/iptv') and method=='POST':
                auth=self.hub_authorized(owner=path!='/hub/action')
                if not auth:raise PermissionError('Acción no autorizada. Recarga el panel.')
                data=self.hub_json()
                if path=='/hub/iptv':
                    result=hub.iptv.mutate(data,public_open);self.reply(200,result);return
                if path=='/hub/podcast':self.reply(200,{'imported':hub.podcast(data.get('url',''))});return
                if path=='/hub/convert':hub.convert(data.get('id'));self.reply(200,{'status':'Convirtiendo'});return
                self.reply(200,hub.mutate(data,auth['role'],self.server.tv));return
            if path=='/hub/upload' and method=='POST':
                if not self.hub_authorized():raise PermissionError('Solo el propietario puede subir archivos.')
                self.connection.settimeout(60)
                item=hub.upload(self.rfile,int(self.headers.get('Content-Length','0')),unquote(self.headers.get('X-Alma-Filename','')))
                self.reply(200,{'item':{k:v for k,v in item.items() if k!='filename'}});return
            if path.startswith('/hub/file/') and method=='GET':
                from puente import stream_media
                source=hub.source(path.rsplit('/',1)[1]);filename=source.get('filename','');file=hub.files/filename
                if not filename or file.is_symlink() or file.resolve().parent!=hub.files.resolve() or not file.is_file():raise ValueError('Archivo no disponible.')
                stream_media(self,file);return
            if path.startswith('/hub/stream/') and method=='GET':
                source=hub.source(path.rsplit('/',1)[1]);url=source.get('url','')
                headers={};byte_range=self.headers.get('Range','')
                if byte_range and re.fullmatch(r'bytes=\d+-\d*',byte_range):headers['Range']=byte_range
                connection,response=public_open(url,headers)
                try:
                    media_type=response.getheader('Content-Type','application/octet-stream').split(';')[0]
                    if not media_type.startswith(('audio/','video/')) and media_type!='application/octet-stream':raise ValueError('La fuente no devolvió audio o vídeo directo.')
                    self.send_response(response.status);origin=self.headers.get('Origin')
                    if origin in self.server.origins:self.send_header('Access-Control-Allow-Origin',origin)
                    self.send_header('Content-Type',media_type);self.send_header('Cache-Control','no-store')
                    for header in ('Content-Length','Content-Range','Accept-Ranges'):
                        value=response.getheader(header)
                        if value and len(value)<100 and '\r' not in value and '\n' not in value:self.send_header(header,value)
                    self.end_headers();left=512*1024*1024
                    while left:
                        chunk=response.read(min(left,65536))
                        if not chunk:break
                        self.wfile.write(chunk);left-=len(chunk)
                finally:response.close();connection.close()
                return
            self.reply(404,{'error':'Ruta no disponible'})
        except PermissionError as error:self.reply(403,{'error':str(error)})
        except (ValueError,KeyError,TypeError) as error:self.reply(400,{'error':str(error)})
        except (BrokenPipeError,ConnectionResetError):pass
        except Exception:self.reply(502,{'error':'No se pudo completar la operación; no se confirmó éxito.'})
