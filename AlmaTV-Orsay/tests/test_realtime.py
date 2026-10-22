import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from youtube_library import Realtime, Library
import puente

class RealtimeTests(unittest.TestCase):
    def test_validation_expiry_replacement_and_confirmation(self):
        now=[100]
        live=Realtime(lambda:now[0])
        for data in [{}, {'url':'https://evil.example/watch?v=M7lc1UVf-VE','mode':'video'}, {'url':'https://youtu.be/M7lc1UVf-VE','mode':'bad'}]:
            with self.assertRaises(ValueError):live.publish(data)
        one=live.publish({'url':'https://youtu.be/M7lc1UVf-VE','mode':'audio'})['command']
        self.assertEqual(one['mode'],'audio')
        self.assertEqual(live.snapshot()['command']['id'],one['id'])
        live.acknowledge({'id':one['id'],'status':'received'})
        now[0]=146
        self.assertIsNone(live.snapshot()['command'])
        self.assertEqual(live.snapshot()['status'],'expired')
        two=live.publish({'url':'https://youtu.be/M7lc1UVf-VE','mode':'video'})['command']
        self.assertNotEqual(two['id'],one['id'])
        with self.assertRaises(ValueError):live.acknowledge({'id':one['id'],'status':'playing'})
        live.acknowledge({'id':two['id'],'status':'playing'})
        live.acknowledge({'id':two['id'],'status':'received'})
        self.assertEqual(live.snapshot()['status'],'playing')
        self.assertIsNone(Realtime().snapshot()['command'])

    def test_http_requires_panel_token_and_tv_for_ack(self):
        with tempfile.TemporaryDirectory() as d:
            server=ThreadingHTTPServer(('127.0.0.1',0),puente.Handler)
            server.tv='127.0.0.1';server.origins=['null'];server.admin_token='secret';server.realtime=Realtime();server.youtube_library=Library(Path(d)/'list.json')
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            base='http://127.0.0.1:'+str(server.server_port)
            def req(path,data=None,token=None,origin=None):
                headers={'Origin':origin or base}
                if data is not None:headers['Content-Type']='application/json'
                if token:headers['X-Alma-Token']=token
                return urlopen(Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers),timeout=3)
            try:
                body={'url':'https://youtu.be/M7lc1UVf-VE','mode':'video'}
                for token,origin in [(None,base),('wrong',base),('secret','https://evil.example')]:
                    with self.assertRaises(HTTPError) as error:req('/youtube/live',body,token,origin)
                    self.assertEqual(error.exception.code,403)
                with req('/youtube/live',body,'secret') as response:command=json.load(response)['command']
                with req('/youtube/live',origin='null') as response:self.assertEqual(json.load(response)['command']['id'],command['id'])
                server.tv='192.168.1.249'
                with self.assertRaises(HTTPError) as error:req('/youtube/live/ack',{'id':command['id'],'status':'playing'},origin='null')
                self.assertEqual(error.exception.code,403)
                server.tv='127.0.0.1'
                with req('/youtube/live/ack',{'id':command['id'],'status':'playing'},origin='null') as response:self.assertEqual(json.load(response)['status'],'playing')
                self.assertEqual(server.youtube_library.read(),[])
            finally:server.shutdown();server.server_close();thread.join()
