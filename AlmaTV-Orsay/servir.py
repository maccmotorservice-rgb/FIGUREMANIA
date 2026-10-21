#!/usr/bin/env python3
"""HTTP installer server. Only catalogue and widget ZIPs are exposed."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from preparar import private_ipv4

ROOT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path=urlsplit(self.path).path
        if path!='/widgetlist.xml' and not (path.startswith('/Widget/') and path.endswith('.zip') and path.count('/')==2 and '..' not in path):
            self.send_error(404)
            return
        super().do_GET()
    def do_HEAD(self):
        self.send_error(405)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bind',required=True, help='IP privada de la Mac; no 0.0.0.0')
    p.add_argument('--port',type=int,default=80)
    group=p.add_mutually_exclusive_group()
    group.add_argument('--rollback',action='store_true',help='Restaurar versión 7.1 conservada')
    group.add_argument('--rollback-7',action='store_true',help='Ofrecer versión 7.0')
    group.add_argument('--rollback-6',action='store_true',help='Ofrecer la base 6.0 original')
    a=p.parse_args()
    bind=private_ipv4(a.bind)
    directory=ROOT/('respaldo/version-7.1' if a.rollback else 'respaldo/version-7.0' if a.rollback_7 else 'respaldo/servidor' if a.rollback_6 else 'servidor')
    if not (directory/'widgetlist.xml').exists():
        p.error('Ejecuta preparar.py primero')
    print('Solo red local: http://%s:%s/widgetlist.xml · Ctrl+C detiene' % (bind,a.port),flush=True)
    try:
        ThreadingHTTPServer((bind,a.port),partial(Handler,directory=str(directory))).serve_forever()
    except PermissionError:
        p.exit(1,'macOS requiere permisos para puerto 80: repite solo este comando con sudo.\n')
    except KeyboardInterrupt:
        pass
if __name__=='__main__':
    main()
