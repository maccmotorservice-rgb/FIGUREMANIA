"""Local paired control hub. No cloud account, scraping or protected streams."""
import datetime
import hashlib
import http.client
import ipaddress
import json
import mimetypes
from pathlib import Path
import secrets
import shutil
import socket
import ssl
import subprocess
import tempfile
import threading
import time
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET

ACTIONS = {'play','pause','toggle','stop','seek','home','media','saver','volume-up','volume-down','volume','mute','live-channel','navigate','up','down','left','right','ok','back','fullscreen','background-stop'}
VIEWS={'home','search','apps','media','hub','clock','weather','calendar','timer','settings','saver','livetv'}
EXTENSIONS = {'.mp3':'audio','.m4a':'audio','.wav':'audio','.mp4':'video','.m4v':'video','.jpg':'photo','.jpeg':'photo','.png':'photo','.mov':'convert','.mkv':'convert'}

class PublicConnection(http.client.HTTPSConnection):
    def __init__(self, host, address, port=443, timeout=12):
        super().__init__(host, port=port, timeout=timeout, context=ssl.create_default_context())
        self.address = address
    def connect(self):
        self.sock = self._context.wrap_socket(socket.create_connection((self.address,self.port),self.timeout),server_hostname=self.host)

def public_open(url, headers=None, allow_redirect=False, allow_custom_port=False, timeout=12):
    """Pin public DNS; custom ports and redirects are opt-in for playlist downloads."""
    parsed=urlsplit(url)
    if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Usa una dirección pública HTTP o HTTPS sin credenciales.')
    default_port=443 if parsed.scheme=='https' else 80
    port=parsed.port if parsed.port is not None else default_port
    if not 1<=port<=65535:raise ValueError('El puerto debe estar entre 1 y 65535.')
    if not allow_custom_port and port!=default_port:raise ValueError('Esta fuente requiere un puerto HTTP o HTTPS estándar.')
    addresses=list(dict.fromkeys(item[4][0] for item in socket.getaddrinfo(parsed.hostname,None,type=socket.SOCK_STREAM)))
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError('Las fuentes externas deben usar direcciones públicas.')
    if parsed.scheme=='https': connection=PublicConnection(parsed.hostname,addresses[0],port,timeout=timeout)
    else:
        connection=http.client.HTTPConnection(addresses[0],port,timeout=timeout)
    host=('['+parsed.hostname+']') if ':' in parsed.hostname else parsed.hostname
    if port!=default_port:host+=':'+str(port)
    safe_headers={'Host':host,'User-Agent':'AlmaTV/9 local media player'}
    safe_headers.update(headers or {})
    try:
        connection.request('GET',(parsed.path or '/')+('?' + parsed.query if parsed.query else ''),headers=safe_headers)
        response=connection.getresponse()
    except Exception:
        connection.close()
        raise
    if response.status not in (200,206) and not (allow_redirect and response.status in (301,302,303,307,308)):
        response.close();connection.close()
        raise ValueError('La fuente devolvió HTTP %s. Usa su enlace directo, sin redirecciones.' % response.status)
    return connection,response

class Hub:
    def __init__(self, root, tv, clock=None):
        self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True)
        self.files=self.root/'uploads';self.files.mkdir(exist_ok=True)
        from iptv import IPTV
        self.iptv=IPTV(self.root/'iptv.json',json.loads((Path(__file__).resolve().parent/'tv_channels.json').read_text()))
        self.path=self.root/'hub.json';self.lock=threading.RLock();self.clock=clock or time.time
        self.pin='%06d'%secrets.randbelow(1000000);self.guest_pin='%06d'%secrets.randbelow(1000000)
        self.mac_files={};self.attempts={};self.commands=[];self.jobs={};self.converting=threading.Lock();self.schedule_seen=set();self.remote_until={}
        self.data={'favorites':[],'playlists':[],'sources':[],'scenes':[],'schedules':[],'sessions':{},'channels':{tv:{'name':'Mi TV','queue':[],'history':[],'current':None,'telemetry':{},'seen':0}}}
        if self.path.exists():
            try:
                loaded=json.loads(self.path.read_text())
                if isinstance(loaded,dict):loaded.setdefault('favorites',[]);loaded.setdefault('playlists',[])
                if not isinstance(loaded,dict) or any(not isinstance(loaded.get(k),type(v)) for k,v in self.data.items()):raise ValueError()
                self.data=loaded
                for channel in self.data['channels'].values():channel['seen']=0
            except (ValueError,OSError):raise ValueError('No se pudo leer hub.json. Se conserva el archivo; restaura una copia válida.')
        if tv not in self.data['channels']:self.data['channels'][tv]={'name':'Mi TV','queue':[],'history':[],'current':None,'telemetry':{},'seen':0}
    def save(self):
        with self.lock:
            target=self.path.with_suffix('.tmp');target.write_text(json.dumps(self.data,ensure_ascii=False),encoding='utf-8');target.replace(self.path)
    def session(self, token):
        session=self.data['sessions'].get(hashlib.sha256(token.encode()).hexdigest()) if token else None
        return session if session and session['expires']>self.clock() else None
    def pair(self, pin, address):
        with self.lock:
            tries=self.attempts.setdefault(address,[]);tries[:]=[stamp for stamp in tries if self.clock()-stamp<60]
            if len(tries)>=5:raise ValueError('Demasiados intentos. Espera un minuto.')
            tries.append(self.clock())
            role='owner' if secrets.compare_digest(str(pin),self.pin) else ('guest' if secrets.compare_digest(str(pin),self.guest_pin) else None)
            if not role:raise ValueError('Código incorrecto.')
            token=secrets.token_urlsafe(32);csrf=secrets.token_urlsafe(24)
            self.data['sessions']={key:value for key,value in self.data['sessions'].items() if value['expires']>self.clock()}
            if len(self.data['sessions'])>=100:raise ValueError('Se alcanzó el límite de dispositivos.')
            self.data['sessions'][hashlib.sha256(token.encode()).hexdigest()]={'role':role,'csrf':csrf,'expires':self.clock()+7*86400}
            self.save();return token,self.session(token)
    def channel(self,target):
        if target not in self.data['channels']:raise ValueError('Pantalla no registrada.')
        return self.data['channels'][target]
    def source(self,ident):
        if ident in self.mac_files:
            path,kind=self.mac_files[ident]
            return {'id':ident,'name':path.stem,'kind':kind,'local':True}
        for source in self.data['sources']:
            if source['id']==ident:return dict(source)
        raise ValueError('Contenido no disponible.')
    def emit(self,target,payload):
        self.channel(target)
        command=dict(payload,id=secrets.token_hex(16),target=target,expires=self.clock()+45)
        self.commands=[c for c in self.commands if c['expires']>self.clock()][-99:]+[command]
        return command
    def play(self,target,item):
        channel=self.channel(target)
        if channel['current']:channel['history']=(channel['history']+[channel['current']])[-30:]
        channel['current']=item
        self.emit(target,{'kind':'item','item':item});self.save()
    def advance(self,target,previous=False):
        channel=self.channel(target)
        if previous and channel['history']:
            item=channel['history'].pop()
            if channel['current']:channel['queue'].insert(0,channel['current'])
            channel['current']=None;self.play(target,item)
        elif channel['queue']:self.play(target,channel['queue'].pop(0))
        else:channel['current']=None;self.emit(target,{'kind':'control','action':'stop'});self.save()
    def schedules(self):
        now=datetime.datetime.fromtimestamp(self.clock()).astimezone()
        for rule in self.data['schedules']:
            key=(rule['id'],now.strftime('%Y-%m-%d %H:%M'))
            if rule.get('enabled') and now.weekday() in rule['days'] and now.strftime('%H:%M')==rule['time'] and key not in self.schedule_seen:
                self.schedule_seen.add(key)
                for scene in self.data['scenes']:
                    if scene['id']==rule['scene']:self.emit(rule['target'],{'kind':'scene','scene':scene})
        if len(self.schedule_seen)>1000:self.schedule_seen={key for key in self.schedule_seen if key[1][:10]==now.strftime('%Y-%m-%d')}
    def tv(self,target,event=None):
        with self.lock:
            channel=self.channel(target);self.schedules();channel['seen']=self.clock()
            live_ack=[];live_error=''
            if event:
                edits=event.get('live_edits',[])
                if isinstance(edits,list):
                    for edit in edits[:20]:
                        if not isinstance(edit,dict) or not isinstance(edit.get('op'),str) or len(edit['op'])>80:continue
                        try:
                            if edit.get('action') not in ('favorite','delete-channel'):raise ValueError('Acción de canal no válida.')
                            self.iptv.edit(edit)
                        except ValueError as error:live_error=str(error)
                        live_ack.append(edit['op'])
                if event.get('ack'):
                    self.commands=[command for command in self.commands if not (command['target']==target and command['id']==event['ack'])]
                if event.get('ended') and channel['current'] and event['ended']==channel['current'].get('play_id'):
                    if channel.get('repeat'):
                        repeated=dict(channel['current'],play_id=secrets.token_hex(16));channel['queue'].append(repeated)
                    self.advance(target)
                telemetry=event.get('telemetry')
                if isinstance(telemetry,dict):channel['telemetry']={k:v for k,v in telemetry.items() if k in ('background_audio','title','state','seconds','duration','kind','error','volume','muted','observed_volume','observed_muted','engine','view','focus','focus_id') and isinstance(v,(str,int,float,bool)) and len(str(v))<=300}
            result={'commands':[dict(command) for command in self.commands if command['target']==target and command['expires']>self.clock()], 'pin':self.pin,'guest_pin':self.guest_pin,'poll_ms':250 if self.remote_until.get(target,0)>self.clock() else 2000}
            result['live_edit_ack']=live_ack
            if live_error:result['live_edit_error']=live_error
            result['live_revision']=self.iptv.revision
            if live_ack or not event or event.get('live_revision')!=self.iptv.revision:
                result['live_catalog']=self.iptv.catalog;result['live_categories']=self.iptv.data['categories']
            return result
    def snapshot(self,target,role):
        with self.lock:
            self.schedules();channel=self.channel(target)
            result={'iptv':self.iptv.info(),'live_tv':self.iptv.catalog,'target':target,'channels':[{'id':key,'name':value['name'],'online':self.clock()-value['seen']<10} for key,value in self.data['channels'].items()], 'queue':channel['queue'],'repeat':channel.get('repeat',False),'playlists':self.data['playlists'],'current':channel['current'],'telemetry':channel['telemetry'],'sources':[{k:v for k,v in source.items() if k not in ('url','filename')} for source in self.data['sources']]+[{'id':ident,'name':file.stem,'kind':kind,'local':True,'favorite':ident in self.data['favorites']} for ident,(file,kind) in self.mac_files.items()], 'scenes':self.data['scenes'],'role':role,'jobs':self.jobs}
            if role=='owner':result.update(pin=self.pin,guest_pin=self.guest_pin,schedules=self.data['schedules'],ffmpeg=bool(shutil.which('ffmpeg')))
            return result
    def item(self,data):
        from youtube_library import parse_video
        if data.get('youtube'):
            parsed=parse_video(data['youtube']);ident=parsed['id'] if parsed else ''
            if not ident:raise ValueError('Enlace de YouTube no válido.')
            item={'kind':'youtube','video':ident,'provider':parsed['provider'],'name':str(data.get('name') or 'YouTube')[:80],'mode':'audio' if data.get('mode')=='audio' else 'video'}
        else:
            source=self.source(data.get('source'))
            if source['kind']=='convert':raise ValueError('Convierte primero este vídeo a MP4 compatible.')
            item={k:v for k,v in source.items() if k in ('id','name','kind','body')}
            item['path']=('/media/file/'+source['id'][4:]) if source.get('local') else ('/hub/file/'+source['id'] if source.get('filename') else '/hub/stream/'+source['id'])
        item['play_id']=secrets.token_hex(16);return item
    def mutate(self,data,role,default):
        if not isinstance(data,dict):raise ValueError('Solicitud no válida.')
        action=data.get('action');target=data.get('target',default)
        with self.lock:
            self.channel(target)
            if role!='owner' and action!='enqueue':raise PermissionError('Los invitados solo pueden añadir a la cola.')
            if action in ('enqueue','play'):
                item=self.item(data)
                if action=='play':self.play(target,item)
                else:
                    channel=self.channel(target)
                    if len(channel['queue'])>=100:raise ValueError('La cola admite hasta 100 elementos.')
                    channel['queue'].append(item);self.save()
            elif action=='background-audio':
                from youtube_library import parse_video
                parsed=parse_video(data.get('youtube',''))
                if not parsed or parsed['provider']!='youtube':raise ValueError('La prueba admite un enlace individual de YouTube.')
                self.emit(target,{'kind':'control','action':'background-audio','seconds':0,'view':parsed['id']})
            elif action=='control':
                command=data.get('command')
                if command not in ACTIONS:raise ValueError('Control no disponible.')
                seconds=data.get('seconds',10)
                if command=='volume' and (type(seconds) is not int or not 0<=seconds<=100):raise ValueError('Volumen no válido.')
                if command=='seek' and seconds not in (-30,-10,-5,5,10,30):raise ValueError('Salto no válido.')
                view=data.get('view','')
                if command=='live-channel':
                    self.iptv.ensure_channel(view)
                    self.commands=[c for c in self.commands if not (c['target']==target and c.get('action')=='live-channel')]
                if command=='navigate' and view not in VIEWS:raise ValueError('Menú no disponible.')
                self.remote_until[target]=self.clock()+5
                if command=='volume':self.commands=[c for c in self.commands if not (c['target']==target and c.get('action')=='volume')]
                self.emit(target,{'kind':'control','action':command,'seconds':seconds,'view':view})
            elif action in ('next','previous'):self.advance(target,action=='previous')
            elif action=='remove-queue':
                channel=self.channel(target);channel['queue']=[item for item in channel['queue'] if item['play_id']!=data.get('id')];self.save()
            elif action=='move-queue':
                queue=self.channel(target)['queue'];index=next((i for i,item in enumerate(queue) if item['play_id']==data.get('id')),-1)
                direction=data.get('direction')
                if index<0 or direction not in (-1,1):raise ValueError('Movimiento no válido.')
                new=max(0,min(len(queue)-1,index+direction));queue.insert(new,queue.pop(index));self.save()
            elif action=='source':
                kind=data.get('kind');name=str(data.get('name','')).strip()[:80];url=data.get('url','')
                if kind not in ('audio','video','radio','card') or not name:raise ValueError('Nombre o tipo no válido.')
                if len(self.data['sources'])>=500:raise ValueError('La biblioteca admite 500 elementos.')
                if kind!='card':
                    connection,response=public_open(url);response.close();connection.close()
                self.data['sources'].append({'id':secrets.token_hex(12),'kind':kind,'name':name,'url':url if kind!='card' else '', 'body':str(data.get('body',''))[:4000],'favorite':False});self.save()
            elif action=='save-playlist':
                name=str(data.get('name','')).strip()[:80];channel=self.channel(target);items=([channel['current']] if channel['current'] else [])+channel['queue']
                if not name or not items or len(self.data['playlists'])>=50:raise ValueError('Pon un nombre y añade contenido a la cola; máximo 50 listas.')
                self.data['playlists'].append({'id':secrets.token_hex(12),'name':name,'items':items[:100]});self.save()
            elif action=='play-playlist':
                playlist=next((p for p in self.data['playlists'] if p['id']==data.get('id')),None)
                if not playlist:raise ValueError('Lista no disponible.')
                self.channel(target)['queue']=[dict(item,play_id=secrets.token_hex(16)) for item in playlist['items']];self.advance(target)
            elif action=='shuffle':
                import random
                random.SystemRandom().shuffle(self.channel(target)['queue']);self.save()
            elif action=='repeat':
                channel=self.channel(target);channel['repeat']=not channel.get('repeat',False);self.save()
            elif action=='favorite':
                if data.get('id') in self.mac_files:
                    ident=data['id'];favorites=self.data['favorites']
                    if ident in favorites:favorites.remove(ident)
                    else:favorites.append(ident)
                for source in self.data['sources']:
                    if source['id']==data.get('id'):source['favorite']=not source.get('favorite',False)
                self.save()
            elif action=='delete-source':
                self.data['sources']=[s for s in self.data['sources'] if s['id']!=data.get('id')];self.save()
            elif action=='scene':
                name=str(data.get('name','')).strip()[:80];ids=data.get('items',[]);interval=data.get('interval',15)
                if not name or not isinstance(ids,list) or not 1<=len(ids)<=50 or not isinstance(interval,int) or not 5<=interval<=300:raise ValueError('Escena no válida.')
                items=[self.item({'source':ident}) for ident in ids]
                if any(item['kind'] not in ('photo','card') for item in items):raise ValueError('Las escenas usan fotos o tarjetas.')
                music=self.item({'source':data['music']}) if data.get('music') else None
                if music and music['kind'] not in ('audio','radio','podcast'):raise ValueError('El fondo debe ser audio.')
                if len(self.data['scenes'])>=50:raise ValueError('Límite de escenas alcanzado.')
                self.data['scenes'].append({'id':secrets.token_hex(12),'name':name,'items':items,'interval':interval,'music':music});self.save()
            elif action=='play-scene':
                scene=next((scene for scene in self.data['scenes'] if scene['id']==data.get('id')),None)
                if not scene:raise ValueError('Escena no disponible.')
                self.emit(target,{'kind':'scene','scene':scene})
            elif action=='schedule':
                when=data.get('time','');days=data.get('days',list(range(7)))
                import re
                if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',when) or not isinstance(days,list) or not days or any(type(day)!=int or day not in range(7) for day in days) or not any(s['id']==data.get('scene') for s in self.data['scenes']):raise ValueError('Horario o escena no válido.')
                if len(self.data['schedules'])>=100:raise ValueError('Límite de horarios alcanzado.')
                self.data['schedules'].append({'id':secrets.token_hex(12),'scene':data['scene'],'target':target,'time':when,'days':days,'enabled':True});self.save()
            elif action=='delete-schedule':self.data['schedules']=[r for r in self.data['schedules'] if r['id']!=data.get('id')];self.save()
            elif action=='target':
                address=str(ipaddress.IPv4Address(data.get('ip','')))
                if not ipaddress.ip_address(address).is_private or len(self.data['channels'])>=20:raise ValueError('Usa una IP privada; máximo 20 pantallas.')
                self.data['channels'].setdefault(address,{'name':str(data.get('name') or address)[:80],'queue':[],'history':[],'current':None,'telemetry':{},'seen':0});self.save()
            elif action=='revoke':self.data['sessions']={};self.pin='%06d'%secrets.randbelow(1000000);self.guest_pin='%06d'%secrets.randbelow(1000000);self.save()
            else:raise ValueError('Acción no disponible.')
            return self.snapshot(target,role)
    def podcast(self,url):
        connection,response=public_open(url)
        try:
            raw=response.read(2*1024*1024+1)
            if len(raw)>2*1024*1024 or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():raise ValueError('RSS demasiado grande o no permitido.')
            tree=ET.fromstring(raw);items=[]
            for node in tree.findall('.//item')[:100]:
                enclosure=node.find('enclosure');title=node.findtext('title') or 'Episodio'
                if enclosure is None or not enclosure.get('url'):continue
                parsed=urlsplit(enclosure.get('url'))
                if parsed.scheme not in ('http','https'):continue
                items.append({'id':secrets.token_hex(12),'name':title[:120],'kind':'podcast','url':enclosure.get('url'),'favorite':False})
            with self.lock:
                known={source.get('url') for source in self.data['sources']}
                self.data['sources']+=( [item for item in items if item['url'] not in known][:max(0,500-len(self.data['sources']))]);self.save()
            return len(items)
        finally:response.close();connection.close()
    def upload(self,stream,length,name):
        name=Path(name).name;extension=Path(name).suffix.lower();kind=EXTENSIONS.get(extension)
        if not kind or not 0<length<=250*1024*1024 or (kind=='photo' and length>16*1024*1024):raise ValueError('Formato o tamaño no permitido. Fotos hasta 16 MB; audio/vídeo hasta 250 MB.')
        if shutil.disk_usage(self.root).free < length*2+100*1024*1024:raise ValueError('No hay suficiente espacio libre en la Mac.')
        ident=secrets.token_hex(12);path=self.files/(ident+extension)
        try:
            with path.open('xb') as output:
                left=length
                while left:
                    chunk=stream.read(min(left,65536))
                    if not chunk:raise ValueError('Carga incompleta.')
                    output.write(chunk);left-=len(chunk)
            if kind=='photo':
                from importar_salvapantallas import dimensions
                _,size=dimensions(path.read_bytes())
                if min(size)<1 or max(size)>10000 or size[0]*size[1]>40000000:raise ValueError('Dimensiones de imagen no permitidas.')
                if max(size)>1920 and not shutil.which('sips'):raise ValueError('Esta imagen necesita reducirse a 1920 píxeles antes de compartirla.')
                with path.open('rb') as photo:header=photo.read(16)
                if not (header.startswith(b'\x89PNG\r\n\x1a\n') or header.startswith(b'\xff\xd8\xff')):raise ValueError('Imagen no válida.')
                if shutil.which('sips'):
                    converted=self.files/(ident+'.jpg')
                    subprocess.run(['sips','-s','format','jpeg','-Z','1920',str(path),'--out',str(converted)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=60)
                    if converted!=path:path.unlink();path=converted
            source={'id':ident,'filename':path.name,'name':Path(name).stem[:80],'kind':kind,'favorite':False}
            with self.lock:
                if len(self.data['sources'])>=500:raise ValueError('Biblioteca llena.')
                self.data['sources'].append(source);self.save()
            return source
        except Exception:
            path.unlink(missing_ok=True);raise
    def convert(self,ident):
        source=self.source(ident)
        if source.get('kind') not in ('video','convert') or not source.get('filename') or not shutil.which('ffmpeg'):raise ValueError('La conversión requiere FFmpeg instalado en la Mac.')
        if not self.converting.acquire(False):raise ValueError('Ya hay una conversión en curso.')
        self.jobs[ident]='Convirtiendo'
        def worker():
            output=self.files/(secrets.token_hex(12)+'.mp4')
            try:
                subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(self.files/source['filename']),'-vf','scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',str(output)],check=True,timeout=900,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                with self.lock:self.data['sources'].append({'id':secrets.token_hex(12),'filename':output.name,'name':source['name']+' · compatible','kind':'video','favorite':False});self.jobs[ident]='Listo';self.save()
            except Exception:output.unlink(missing_ok=True);self.jobs[ident]='No se pudo convertir'
            finally:self.converting.release()
        threading.Thread(target=worker,daemon=True).start()
