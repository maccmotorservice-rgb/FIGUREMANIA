"""Lista local de enlaces de YouTube; no descarga ni consulta vídeos."""
import json
import os
from pathlib import Path
import re
import tempfile
import threading
from urllib.parse import parse_qs, urlsplit

VIDEO_ID = re.compile(r'[A-Za-z0-9_-]{11}')
LIMIT = 50


def video_id(value):
    if not isinstance(value, str):
        return ''
    value = value.strip()
    if len(value) > 1000 or re.search(r'[\x00-\x20<>"\']', value):
        return ''
    try:
        url = urlsplit(value)
        if url.scheme not in ('http', 'https') or url.username is not None or url.port not in (None, 80, 443):
            return ''
        host = (url.hostname or '').lower()
        path = url.path.lstrip('/')
        ident = ''
        if host == 'youtu.be':
            ident = path.split('/')[0]
        elif host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'):
            if path == 'watch':
                ident = parse_qs(url.query).get('v', [''])[0]
            elif re.match(r'^(shorts|live|embed)/', path):
                ident = path.split('/')[1]
        return ident if VIDEO_ID.fullmatch(ident) else ''
    except (ValueError, IndexError):
        return ''


def parse_video(value):
    ident=video_id(value)
    if ident:return {'provider':'youtube','id':ident}
    if not isinstance(value,str) or len(value)>1000:return None
    try:
        url=urlsplit(value.strip())
        if url.scheme not in ('http','https') or url.username or url.password or url.port not in (None,80,443):return None
        host=(url.hostname or '').lower();parts=url.path.strip('/').split('/')
        ident=parts[0] if host=='dai.ly' else (parts[1] if host in ('dailymotion.com','www.dailymotion.com','m.dailymotion.com') and len(parts)>=2 and parts[0]=='video' else '')
        ident=ident.split('_')[0]
        return {'provider':'dailymotion','id':ident} if re.fullmatch(r'[A-Za-z0-9]{5,12}',ident) else None
    except ValueError:return None


class Library:
    def __init__(self, path):
        self.path = Path(path)
        self.lock = threading.RLock()

    def read(self):
        with self.lock:
            if not self.path.exists():
                return []
            if self.path.stat().st_size > 65536:
                raise ValueError('La lista guardada es demasiado grande. No se ha modificado.')
            try:
                data = json.loads(self.path.read_text(encoding='utf-8'))
                items = data['items']
                if data.get('version') != 1 or not isinstance(items, list) or len(items) > LIMIT:
                    raise ValueError()
                found = set()
                result = []
                for item in items:
                    ident, name = item['id'], item['name']
                    if not isinstance(ident, str) or not (re.fullmatch(r'[A-Za-z0-9]{5,12}',ident) if item.get('provider')=='dailymotion' else VIDEO_ID.fullmatch(ident)) or not isinstance(name, str) or not 0 < len(name) <= 80 or (ident,item.get('provider','youtube')) in found:
                        raise ValueError()
                    result.append(dict({'id': ident, 'name': name},**({'provider':'dailymotion'} if item.get('provider')=='dailymotion' else {})))
                    found.add((ident,item.get('provider','youtube')))
                return result
            except (ValueError, KeyError, TypeError):
                raise ValueError('No se pudo leer la lista guardada. No se ha modificado.') from None

    def change(self, data):
        if not isinstance(data, dict):
            raise ValueError('Solicitud no válida.')
        with self.lock:
            items = self.read()
            action = data.get('action')
            if action == 'add':
                urls, name = data.get('urls', ''), data.get('name', '')
                if not isinstance(urls, str) or not isinstance(name, str) or len(name.strip()) > 80:
                    raise ValueError('Enlaces o nombre no válidos.')
                lines = [line.strip() for line in urls.splitlines() if line.strip()]
                if not 1 <= len(lines) <= LIMIT:
                    raise ValueError('Pega de 1 a 50 enlaces, uno por línea.')
                name = name.strip()
                if name and len(lines) > 1:
                    raise ValueError('Para varios enlaces, deja el nombre vacío.')
                ids = []
                for number, line in enumerate(lines, 1):
                    parsed = parse_video(line)
                    ident = parsed['id'] if parsed else ''
                    if not ident:
                        raise ValueError('Revisa el enlace de la línea %s: debe ser un vídeo individual de YouTube.' % number)
                    ids.append((ident,parsed['provider']))
                existing = {(item['id'],item.get('provider','youtube')): item for item in items}
                for ident,provider in ids:
                    key=(ident,provider)
                    if key in existing:
                        if name:
                            existing[key]['name'] = name
                    else:
                        item = {'id': ident, 'name': name or ('Dailymotion' if provider=='dailymotion' else 'YouTube') + ' · ' + ident}
                        if provider=='dailymotion':item['provider']=provider
                        items.append(item)
                        existing[key] = item
                if len(items) > LIMIT:
                    raise ValueError('La lista admite hasta 50 vídeos. Quita alguno antes de añadir más.')
            elif action == 'remove':
                ident = data.get('id', '')
                provider=data.get('provider','youtube')
                if not isinstance(ident,str) or not (re.fullmatch(r'[A-Za-z0-9]{5,12}',ident) if provider=='dailymotion' else VIDEO_ID.fullmatch(ident)):
                    raise ValueError('El vídeo no es válido.')
                items=[item for item in items if not (item['id']==ident and item.get('provider','youtube')==provider)]
            else:
                raise ValueError('Acción no disponible.')
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=str(self.path.parent), prefix='.youtube-', delete=False) as output:
                    temporary = Path(output.name)
                    json.dump({'version': 1, 'items': items}, output, ensure_ascii=False, indent=2)
                    output.flush()
                    os.fsync(output.fileno())
                os.replace(str(temporary), str(self.path))
            finally:
                if temporary is not None and temporary.exists():
                    temporary.unlink()
            return items


class Realtime:
    """One short-lived user command; never persisted or replayed after bridge restart."""
    def __init__(self, clock=None):
        import time
        self.clock = clock or time.time
        self.lock = threading.RLock()
        self.command = None
        self.status = 'idle'

    def publish(self, data):
        import secrets
        if not isinstance(data, dict):
            raise ValueError('Solicitud no válida.')
        parsed = parse_video(data.get('url'));ident=parsed['id'] if parsed else ''
        mode = data.get('mode')
        name = data.get('name', '').strip() if isinstance(data.get('name', ''), str) else None
        if not ident or mode not in ('video', 'audio') or name is None or len(name) > 80:
            raise ValueError('Usa un enlace individual de YouTube y elige vídeo o solo audio.')
        with self.lock:
            self.command = {'id': secrets.token_hex(16), 'video': ident, 'name': name or 'YouTube en tiempo real', 'mode': mode, 'provider':parsed['provider'], 'expires': self.clock() + 45}
            self.status = 'waiting'
            return self.snapshot()

    def snapshot(self):
        with self.lock:
            command = self.command
            if command and self.clock() >= command['expires']:
                if self.status in ('waiting', 'received'):
                    self.status = 'expired'
                command = None
            return {'command': dict(command) if command else None, 'status': self.status}

    def acknowledge(self, data):
        with self.lock:
            if not isinstance(data, dict) or not self.command or data.get('id') != self.command['id'] or self.clock() >= self.command['expires']:
                raise ValueError('La orden ya no está disponible.')
            status = data.get('status')
            if status not in ('received', 'playing', 'blocked', 'error'):
                raise ValueError('Estado no válido.')
            if self.status not in ('playing', 'blocked', 'error'):
                self.status = status
            return self.snapshot()
