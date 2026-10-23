"""Bounded M3U catalogue. Imports never replace a working list on failure."""
import hashlib
import ipaddress
import json
import re
import threading
import time
from urllib.parse import urljoin, urlsplit

LIMIT = 500
MAX_BYTES = 64 * 1024 * 1024
MAX_CHANNELS = 200000
DOWNLOAD_TIMEOUT = 180

def stream_url(url):
    if not isinstance(url,str) or len(url)>2048 or any(ord(c)<33 for c in url) or '|' in url:return False
    try:
        p=urlsplit(url)
        if p.scheme not in ('http','https') or not p.hostname or p.username or p.password or p.port==0:return False
        if p.hostname.lower() in ('localhost','localhost.localdomain') or p.hostname.lower().endswith('.local'):return False
        try:return ipaddress.ip_address(p.hostname).is_global
        except ValueError:return '.' in p.hostname
    except ValueError:return False

def parse_m3u(raw, base):
    if len(raw)>MAX_BYTES:raise ValueError('La lista supera el límite de 64 MB. Pide al proveedor una lista más pequeña o dividida.')
    try:text=raw.decode('utf-8-sig')
    except UnicodeDecodeError:text=raw.decode('cp1252',errors='replace')
    if re.search(r'^\s*#EXT-X-(?:TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE|PLAYLIST-TYPE|ENDLIST)(?::|\s*$)',text,re.MULTILINE):raise ValueError('Usa una lista M3U de canales, no el enlace de una sola señal HLS.')
    first=text.lstrip().splitlines()[0] if text.strip() else ''
    if not first.startswith('#EXTM3U') and not re.match(r'^#EXTINF:\s*(?:-1|0)(?=[,\s])',first):raise ValueError('El archivo no contiene una cabecera M3U ni entradas de canales reconocibles.')
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
                if len(channels)>MAX_CHANNELS:raise ValueError('La lista supera el límite de 200 000 entradas. Pide al proveedor una lista dividida.')
            else:skipped+=1
            meta=None
    if not channels:raise ValueError('No se encontraron canales HTTP/HTTPS compatibles en la lista.')
    return channels,skipped

class IPTV:
    def __init__(self,path,builtins):
        self.path=path;self.builtins=builtins;self.lock=threading.RLock()
        self.data={'sources':[],'country':'mx','search':'','published':[]}
        if path.exists():self.data=json.loads(path.read_text(encoding='utf-8'))
        self.data.setdefault('edit_receipts',[]);self.data.setdefault('favorites',{});self.data.setdefault('deleted',{});self.data.setdefault('categories',['Deportes','Entretenimiento','Películas','Series','Documentales','Noticias','Streaming'])
        self.data.setdefault('recent_channels',[])
        self.reindex();self.rebuild()
    def reindex(self):
        self.channel_index={c['id']:c for c in self.builtins};self.memberships={};self.list_info=[]
        digest=hashlib.sha256()
        for source in self.data['sources']:
            ident='list-'+hashlib.sha256(source['url'].encode()).hexdigest()[:20]
            parsed=urlsplit(source['url']);path='/'.join(parsed.path.rstrip('/').split('/')[-2:]).lstrip('/');name=((path+' · ' if path else '')+parsed.hostname)[:150]
            self.list_info.append({'id':ident,'name':name})
            digest.update(source['url'].encode())
            for channel in source['channels']:
                key=channel['id'];self.channel_index[key]=channel;self.memberships.setdefault(key,[]).append(ident)
                digest.update(json.dumps(channel,sort_keys=True).encode())
        self.source_revision=digest.hexdigest()[:24]
    def rebuild(self):
        recent=[]
        for previous in self.data['recent_channels']:
            current=self.channel_index.get(previous['id']) or self.data['favorites'].get(previous['id'],{}).get('channel')
            if current:recent.append(current)
        candidates=self.builtins+recent+[v['channel'] for v in self.data['favorites'].values()]+self.data['published']
        self.catalog=[];seen=set()
        for channel in candidates:
            ident=channel['id']
            if ident in seen or ident in self.data['deleted']:continue
            seen.add(ident);favorite=self.data['favorites'].get(ident)
            self.catalog.append(dict(channel,favorite=bool(favorite),category=favorite['category'] if favorite else ''))
        self.catalog=self.catalog[:504]
        self.guide_revision=hashlib.sha256(json.dumps([self.source_revision,self.data['favorites'],self.data['deleted'],self.data['categories']],sort_keys=True).encode()).hexdigest()[:24]
        self.revision=hashlib.sha256(json.dumps([self.catalog,self.data["categories"]],sort_keys=True).encode()).hexdigest()[:24]
    def save(self):
        tmp=self.path.with_suffix('.tmp');tmp.write_text(json.dumps(self.data,ensure_ascii=False),encoding='utf-8');tmp.replace(self.path);self.rebuild()
    def published_count(self):
        builtin_ids={c["id"] for c in self.builtins}
        return sum(c["id"] not in builtin_ids for c in self.catalog)
    def info(self):
        with self.lock:
            return {'sources':[{k:v for k,v in s.items() if k!='channels'} for s in self.data['sources']], 'country':self.data['country'],'search':self.data['search'],'published':self.published_count(),'matched':self.data.get('matched',len(self.data['published'])),'limit':LIMIT,'revision':self.revision,'guide_revision':self.guide_revision,'categories':self.data['categories'],'deleted':[{'id':k,'name':v['name']} for k,v in self.data['deleted'].items()]}
    def publish(self,country,search):
        country=str(country).lower()[:8];search=str(search)[:100];found=[];seen=set()
        for source in self.data['sources']:
            for c in source['channels']:
                if c['id'] in self.data['favorites']:self.data['favorites'][c['id']]['channel']=c
                if country and c['country']!=country:continue
                if search and search.casefold() not in (c['name']+' '+c['group']).casefold():continue
                if c['url'] not in seen:seen.add(c['url']);found.append(c)
        self.data.update(country=country,search=search,published=found[:LIMIT],matched=len(found));self.reindex();self.save()
        return len(found)
    def resolve_channel(self,ident):
        if not isinstance(ident,str) or ident in self.data['deleted']:raise ValueError('Canal no disponible.')
        channel=self.channel_index.get(ident) or self.data['favorites'].get(ident,{}).get('channel')
        if not channel:raise ValueError('Canal no disponible.')
        return channel
    def ensure_channel(self,ident):
        with self.lock:
            channel=self.resolve_channel(ident)
            if not any(c['id']==ident for c in self.catalog):
                self.data['recent_channels']=([channel]+[c for c in self.data['recent_channels'] if c['id']!=ident])[:8]
                self.save()
            return channel
    def guide(self,source='all',category='all',query='',page=0):
        with self.lock:
            if not isinstance(source,str) or len(source)>80 or not isinstance(category,str) or len(category)>60 or not isinstance(query,str) or len(query)>100:raise ValueError('Filtro de guía no válido.')
            page=max(0,int(page));query=query.strip().casefold()
            source_ids={item['id'] for item in self.list_info}
            if source not in source_ids|{'all','builtin'}:source='all'
            channels=dict(self.channel_index)
            for ident,favorite in self.data['favorites'].items():channels.setdefault(ident,favorite['channel'])
            builtins={c['id'] for c in self.builtins};counts={ident:0 for ident in source_ids};base=[];builtin_count=0
            for ident,channel in channels.items():
                if ident in self.data['deleted']:continue
                memberships=self.memberships.get(ident,[])
                for membership in memberships:counts[membership]+=1
                if ident in builtins:builtin_count+=1
                if source=='builtin' and ident not in builtins:continue
                if source not in ('all','builtin') and source not in memberships:continue
                if query and query not in (channel['name']+' '+channel.get('region','')+' '+channel.get('group','')).casefold():continue
                favorite=self.data['favorites'].get(ident)
                base.append(dict(channel,favorite=bool(favorite),category=favorite['category'] if favorite else ''))
            facets=[{'id':'all','name':'Todos los canales','count':len(base)},{'id':'favorites','name':'★ Favoritos','count':sum(c['favorite'] for c in base)},{'id':'uncategorized','name':'Sin categoría','count':sum(c['favorite'] and not c['category'] for c in base)}]
            facets.extend({'id':'category:'+name,'name':name,'count':sum(c['favorite'] and c['category']==name for c in base)} for name in self.data['categories'])
            if category not in {f['id'] for f in facets}:category='all'
            def matches(c):
                if category=='all':return True
                if category=='favorites':return c['favorite']
                if category=='uncategorized':return c['favorite'] and not c['category']
                return c['favorite'] and c['category']==category[9:]
            matching=[c for c in base if matches(c)];pages=max(1,(len(matching)+19)//20);page=min(page,pages-1)
            # The web guide never transfers the complete source catalogue to the TV.
            items=[{k:v for k,v in c.items() if k!='url'} for c in matching[page*20:(page+1)*20]]
            return {'channels':items,'source':source,'category':category,'page':page,'pages':pages,'total':len(matching),'facets':facets,'categories':self.data['categories'],'lists':[dict(item,count=counts[item['id']]) for item in self.list_info],'builtin_count':builtin_count,'revision':self.guide_revision}
    def edit(self,data):
        with self.lock:
            action=data.get('action');ident=data.get('id');op=data.get('op')
            if isinstance(op,str) and op in self.data['edit_receipts']:return {'matched':self.data.get('matched',0),'published':self.published_count(),'available':sum(s['count'] for s in self.data['sources'])}
            if action=='category':
                name=str(data.get('name','')).strip()[:40]
                if not name or name=='__none' or any(ord(c)<32 for c in name):raise ValueError('Escribe un nombre de categoría válido.')
                if name not in self.data['categories']:
                    if len(self.data['categories'])>=30:raise ValueError('Puedes crear hasta 30 categorías.')
                    self.data['categories'].append(name)
            elif action=='restore':
                if ident not in self.data['deleted']:raise ValueError('Canal eliminado no disponible.')
                del self.data['deleted'][ident]
            else:
                channel=next((c for c in self.builtins+self.data['published']+[v['channel'] for v in self.data['favorites'].values()] if c['id']==ident),None)
                if not channel:
                    channel=next((c for source in self.data['sources'] for c in source['channels'] if c['id']==ident),None)
                if not channel or ident in self.data['deleted']:raise ValueError('Canal no disponible.')
                if action=='delete-channel':self.data['deleted'][ident]={'name':channel['name']}
                elif action=='favorite':
                    if data.get('enabled') is not True:self.data['favorites'].pop(ident,None)
                    else:
                        category=str(data.get('category',''))
                        if category and category not in self.data['categories']:raise ValueError('Categoría no disponible.')
                        if ident not in self.data['favorites'] and len(self.data['favorites'])>=500:raise ValueError('Puedes guardar hasta 500 favoritos.')
                        self.data['favorites'][ident]={'channel':channel,'category':category}
                else:raise ValueError('Acción de canal no válida.')
            if isinstance(op,str) and len(op)<=80:self.data['edit_receipts']=(self.data['edit_receipts']+[op])[-200:]
            self.save()
            return {'matched':self.data.get('matched',len(self.data['published'])),'published':self.published_count(),'available':sum(s['count'] for s in self.data['sources'])}
    def mutate(self,data,opener):
        action=data.get('action')
        if action in ('favorite','delete-channel','restore','category'):return self.edit(data)
        if action in ('import','refresh'):
            url=str(data.get('url','')).strip()
            if not stream_url(url):raise ValueError('Usa una URL pública HTTP o HTTPS de una lista M3U.')
            final_url=url;start=time.monotonic()
            for redirect in range(5):
                connection,response=opener(final_url,allow_redirect=True,allow_custom_port=True)
                if response.status not in (301,302,303,307,308):break
                location=response.getheader('Location','');response.close();connection.close()
                final_url=urljoin(final_url,location)
                if not location or not stream_url(final_url) or redirect==4:raise ValueError('Demasiadas redirecciones o destino no válido.')
            try:
                if int(response.getheader('Content-Length','0'))>MAX_BYTES:raise ValueError('La lista supera el límite de 64 MB. Pide al proveedor una lista más pequeña o dividida.')
                chunks=[];size=0
                while True:
                    if time.monotonic()-start>DOWNLOAD_TIMEOUT:raise ValueError("La descarga de la lista superó los 3 minutos. El proveedor está enviando los datos demasiado despacio.")
                    chunk=(response.read1 if hasattr(response,"read1") else response.read)(65536)
                    if not chunk:break
                    size+=len(chunk)
                    if size>MAX_BYTES:raise ValueError('La lista supera el límite de 64 MB. Pide al proveedor una lista más pequeña o dividida.')
                    if time.monotonic()-start>DOWNLOAD_TIMEOUT:raise ValueError('La descarga de la lista superó los 3 minutos. El proveedor está enviando los datos demasiado despacio.')
                    chunks.append(chunk)
                channels,skipped=parse_m3u(b''.join(chunks),final_url)
            except TimeoutError:raise ValueError("El proveedor dejó de enviar datos y se agotó la espera de red. Vuelve a intentarlo más tarde.")
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
        return {'matched':matched,'published':self.published_count(),'available':sum(s['count'] for s in self.data['sources'])}
