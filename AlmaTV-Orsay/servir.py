#!/usr/bin/env python3
"""HTTP installer server. Only catalogue and widget ZIPs are exposed."""
import argparse
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from preparar import private_ipv4

ROOT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store, no-cache, max-age=0')
        self.send_header('Pragma','no-cache')
        self.send_header('Expires','0')
        super().end_headers()
    def do_GET(self):
        path=urlsplit(self.path).path
        if path!='/widgetlist.xml' and not (path.startswith('/Widget/') and path.endswith('.zip') and path.count('/')==2 and '..' not in path):
            self.send_error(404)
            return
        # Some legacy clients retain validators from earlier installations.
        for name in ('If-Modified-Since','If-None-Match'):
            if name in self.headers: del self.headers[name]
        super().do_GET()
    def do_HEAD(self):
        self.send_error(405)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bind',required=True, help='IP privada de la Mac; no 0.0.0.0')
    p.add_argument('--port',type=int,default=80)
    p.add_argument('--duration',type=int,default=0,help='Detener tras N segundos; 0 mantiene el modo manual')
    group=p.add_mutually_exclusive_group()
    group.add_argument('--rollback',action='store_true',help='Restaurar versión 7.1 conservada')
    group.add_argument('--rollback-7',action='store_true',help='Ofrecer versión 7.0')
    group.add_argument('--rollback-6',action='store_true',help='Ofrecer la base 6.0 original')
    a=p.parse_args()
    if not 0<=a.duration<=3600:p.error('Duración no válida')
    bind=private_ipv4(a.bind)
    directory=ROOT/('respaldo/version-7.1' if a.rollback else 'respaldo/version-7.0' if a.rollback_7 else 'respaldo/servidor' if a.rollback_6 else 'servidor')
    if not (directory/'widgetlist.xml').exists():
        p.error('Ejecuta preparar.py primero')
    manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
    print('Instalador: %s · versión %s · %s' % (manifest['id'],manifest['version'],manifest['archive']),flush=True)
    print('Solo red local: http://%s:%s/widgetlist.xml · Ctrl+C detiene' % (bind,a.port),flush=True)
    try:
        server=ThreadingHTTPServer((bind,a.port),partial(Handler,directory=str(directory)))
        if a.duration:
            timer=threading.Timer(a.duration,server.shutdown);timer.daemon=True;timer.start()
        try:server.serve_forever()
        finally:server.server_close()
    except PermissionError:
        p.exit(1,'macOS requiere permisos para puerto 80: repite solo este comando con sudo.\n')
    except KeyboardInterrupt:
        pass
if __name__=='__main__':
    main()
