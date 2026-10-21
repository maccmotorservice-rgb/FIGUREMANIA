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
                    if not isinstance(ident, str) or not VIDEO_ID.fullmatch(ident) or not isinstance(name, str) or not 0 < len(name) <= 80 or ident in found:
                        raise ValueError()
                    result.append({'id': ident, 'name': name})
                    found.add(ident)
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
                    ident = video_id(line)
                    if not ident:
                        raise ValueError('Revisa el enlace de la línea %s: debe ser un vídeo individual de YouTube.' % number)
                    ids.append(ident)
                existing = {item['id']: item for item in items}
                for ident in ids:
                    if ident in existing:
                        if name:
                            existing[ident]['name'] = name
                    else:
                        item = {'id': ident, 'name': name or 'YouTube · ' + ident}
                        items.append(item)
                        existing[ident] = item
                if len(items) > LIMIT:
                    raise ValueError('La lista admite hasta 50 vídeos. Quita alguno antes de añadir más.')
            elif action == 'remove':
                ident = data.get('id', '')
                if not isinstance(ident, str) or not VIDEO_ID.fullmatch(ident):
                    raise ValueError('El vídeo no es válido.')
                items = [item for item in items if item['id'] != ident]
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
