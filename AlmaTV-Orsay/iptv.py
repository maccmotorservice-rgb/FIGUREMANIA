"""Bounded M3U catalogue. Imports never replace a working list on failure."""
import hashlib
import ipaddress
import json
import re
import threading
import time
from urllib.parse import urljoin, urlsplit

LIMIT = 500
MAX_BYTES = 16 * 1024 * 1024

def stream_url(url):
    if not isinstance(url,str) or len(url)>2048 or any(ord(c)<33 for c in url) or '|' in url:return False
    try:
        p=urlsplit(url)
        if p.scheme not in ('http','https') or not p.hostname or p.username or p.password:return False
        if p.hostname.lower() in ('localhost','localhost.localdomain') or p.hostname.lower().endswith('.local'):return False
        try:return ipaddress.ip_address(p.hostname).is_global
        except ValueError:return '.' in p.hostname
    except ValueError:return False

def parse_m3u(raw, base):
    if len(raw)>MAX_BYTES:raise ValueError('La lista supera 16 MB.')
    try:text=raw.decode('utf-8-sig')
    except UnicodeDecodeError:text=raw.decode('cp1252',errors='replace')
    if not text.lstrip().startswith('#EXTM3U') or '#EXT-X-TARGETDURATION:' in text or '#EXT-X-STREAM-INF:' in text:raise ValueError('Usa una lista M3U de canales, no el enlace de una sola señal HLS.')
    channels=[];seen=set();meta=None;skipped=0
    for line in text.splitlines():
        line=line.strip()
        if len(line)>16384:raise ValueError('La lista contiene una línea demasiado larga.')
        if line.startswith('#EXTINF:'):
            match=re.search(r',(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)',line)
            attrs=dict(re.findall(r'([\w-]+)="([^\"]*)"',line[:match.start()] if match else line))
            name=line[match.end():].strip() if match else attrs.get('tvg-name','Canal')
            country=attrs.get('tvg-country','').lower().split(';')[0]
            if not country:
                country_match=re.search(r'\.([a-zA-Z]{2})(?:@|$)',attrs.get('tvg-id',''))
                country=country_match.group(1).lower() if country_match else ''
            meta={'name':name[:120] or 'Canal','country':country[:8],'group':attrs.get('group-title','')[:80]}
        elif line.startswith(('#KODIPROP:','#EXTVLCOPT:')):meta=None
        elif line and not line.startswith('#'):
            url=urljoin(base,line)
            if meta and stream_url(url) and url not in seen:
                seen.add(url);channels.append(dict(meta,id='iptv-'+hashlib.sha256(url.encode()).hexdigest()[:20],url=url,region=meta['country'].upper() or meta['group'] or 'Internet',note='Señal importada; disponibilidad según el proveedor.'))
                if len(channels)>50000:raise ValueError('La lista supera 50 000 canales.')
            else:skipped+=1
            meta=None
    if not channels:raise ValueError('No se encontraron canales HTTP/HTTPS compatibles en la lista.')
    return channels,skipped

class IPTV:
    def __init__(self,path,builtins):
        self.path=path;self.builtins=builtins;self.lock=threading.RLock()
        self.data={'sources':[],'country':'mx','search':'','published':[]}
        if path.exists():self.data=json.loads(path.read_text(encoding='utf-8'))
        self.rebuild()
    def rebuild(self):
        self.catalog=self.builtins+self.data['published']
        self.revision=hashlib.sha256(json.dumps(self.catalog,sort_keys=True).encode()).hexdigest()[:24]
    def save(self):
        tmp=self.path.with_suffix('.tmp');tmp.write_text(json.dumps(self.data,ensure_ascii=False),encoding='utf-8');tmp.replace(self.path);self.rebuild()
    def info(self):
        with self.lock:
            return {'sources':[{k:v for k,v in s.items() if k!='channels'} for s in self.data['sources']], 'country':self.data['country'],'search':self.data['search'],'published':len(self.data['published']),'matched':self.data.get('matched',len(self.data['published'])),'limit':LIMIT,'revision':self.revision}
    def publish(self,country,search):
        country=str(country).lower()[:8];search=str(search)[:100];found=[];seen=set()
        for source in self.data['sources']:
            for c in source['channels']:
                if country and c['country']!=country:continue
                if search and search.casefold() not in (c['name']+' '+c['group']).casefold():continue
                if c['url'] not in seen:seen.add(c['url']);found.append(c)
        self.data.update(country=country,search=search,published=found[:LIMIT],matched=len(found));self.save()
        return len(found)
    def mutate(self,data,opener):
        action=data.get('action')
        if action in ('import','refresh'):
            url=str(data.get('url','')).strip()
            if not stream_url(url):raise ValueError('Usa una URL pública HTTP o HTTPS de una lista M3U.')
            final_url=url
            for redirect in range(5):
                connection,response=opener(final_url,allow_redirect=True)
                if response.status not in (301,302,303,307,308):break
                location=response.getheader('Location','');response.close();connection.close()
                final_url=urljoin(final_url,location)
                if not location or not stream_url(final_url) or redirect==4:raise ValueError('Demasiadas redirecciones o destino no válido.')
            try:
                if int(response.getheader('Content-Length','0'))>MAX_BYTES:raise ValueError('La lista supera 16 MB.')
                chunks=[];size=0;start=time.monotonic()
                while True:
                    chunk=response.read(65536)
                    if not chunk:break
                    size+=len(chunk)
                    if size>MAX_BYTES or time.monotonic()-start>60:raise ValueError('La lista es demasiado grande o tarda más de un minuto.')
                    chunks.append(chunk)
                channels,skipped=parse_m3u(b''.join(chunks),final_url)
            finally:response.close();connection.close()
            with self.lock:
                sources=self.data['sources'];existing=next((s for s in sources if s['url']==url),None)
                if not existing and len(sources)>=8:raise ValueError('Puedes guardar hasta ocho listas; elimina una antes de añadir otra.')
                new={'url':url,'name':urlsplit(url).hostname,'count':len(channels),'skipped':skipped,'updated':int(time.time()),'channels':channels}
                if existing:sources[sources.index(existing)]=new
                else:sources.append(new)
                matched=self.publish(self.data['country'],self.data['search'])
        elif action=='publish':
            with self.lock:matched=self.publish(data.get('country','mx'),data.get('search',''))
        elif action=='remove':
            with self.lock:
                self.data['sources']=[s for s in self.data['sources'] if s['url']!=data.get('url')]
                matched=self.publish(self.data['country'],self.data['search'])
        else:raise ValueError('Acción de lista no válida.')
        return {'matched':matched,'published':min(matched,LIMIT)}
