#!/usr/bin/env python3
"""Vista previa local con soporte HTTP Range para audio y video."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from puente import Handler as BridgeHandler, MEDIA_TYPES, stream_media

class Handler(SimpleHTTPRequestHandler):
    reply=BridgeHandler.reply
    def do_GET(self):
        path=Path(self.translate_path(urlsplit(self.path).path)).resolve()
        root=Path(self.directory).resolve()
        if path.suffix.lower() in MEDIA_TYPES:
            if not path.is_file() or root not in path.parents:
                self.send_error(404)
                return
            try:stream_media(self,path)
            except (BrokenPipeError,ConnectionResetError):pass
            return
        super().do_GET()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory',default='app')
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--bind',choices=['127.0.0.1','localhost'],default='127.0.0.1')
    args=parser.parse_args()
    server=ThreadingHTTPServer((args.bind,args.port),partial(Handler,directory=str(Path(args.directory).resolve())))
    server.origins=['http://127.0.0.1:'+str(args.port),'http://localhost:'+str(args.port)]
    try:server.serve_forever()
    except KeyboardInterrupt:pass
if __name__=='__main__':main()
