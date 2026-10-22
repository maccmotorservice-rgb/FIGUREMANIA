import datetime
from http.server import ThreadingHTTPServer
from http.client import HTTPConnection
from io import BytesIO
import json
from pathlib import Path
import socket
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from hub import Hub,public_open
from youtube_library import Library,Realtime,parse_video
import puente
ROOT=Path(__file__).resolve().parents[1]

class HubTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.now=[1770000000]
        self.hub=Hub(self.temp.name,'127.0.0.3',lambda:self.now[0]);self.target='127.0.0.3'
    def action(self,**data):return self.hub.mutate(data,'owner',self.target)
    def test_player_templates_do_not_mix_providers(self):
        youtube=(ROOT/'youtube_player.html').read_text();dm=(ROOT/'dailymotion_player.html').read_text()
        self.assertNotIn('dmcdn',youtube);self.assertNotIn('DM.player',youtube)
        self.assertNotIn('YouTube',dm);self.assertNotIn('YT-INICIO',dm);self.assertNotIn('youtube.com',dm)
        self.assertIn('DM-INICIO',dm);self.assertIn('DM.player',dm)
    def test_navigation_whitelist_fast_poll_and_confirmed_selection(self):
        with self.assertRaises(ValueError):self.action(action='control',command='navigate',view='bad-route')
        with self.assertRaises(ValueError):self.action(action='control',command='raw-key')
        self.action(action='control',command='navigate',view='apps')
        command=self.hub.tv(self.target)['commands'][0]
        self.assertEqual(command['view'],'apps');self.assertEqual(self.hub.tv(self.target)['poll_ms'],250)
        self.hub.tv(self.target,{'ack':command['id'],'telemetry':{'view':'apps','focus':'Netflix','focus_id':'app-netflix'}})
        self.assertEqual(self.hub.snapshot(self.target,'owner')['telemetry']['focus'],'Netflix')
        self.now[0]+=6;self.hub.snapshot(self.target,'owner');self.assertEqual(self.hub.tv(self.target)['poll_ms'],2000)
        with self.assertRaises(PermissionError):self.hub.mutate({'action':'control','command':'ok'},'guest',self.target)
    def test_absolute_volume_bounds_and_owner_only(self):
        for invalid in (-1,101,True,1.5,'50'):
            with self.assertRaises(ValueError):self.action(action='control',command='volume',seconds=invalid)
        self.action(action='control',command='volume',seconds=27)
        command=self.hub.tv(self.target)['commands'][0]
        self.assertEqual((command['action'],command['seconds']),('volume',27))
        for level in range(28,101):self.action(action='control',command='volume',seconds=level)
        pending=self.hub.tv(self.target)['commands']
        self.assertEqual(len(pending),1);self.assertEqual(pending[0]['seconds'],100)
        with self.assertRaises(PermissionError):self.hub.mutate({'action':'control','command':'volume','seconds':50},'guest',self.target)
    def test_pin_roles_rate_limit_revoke_and_persistence(self):
        token,session=self.hub.pair(self.hub.pin,'phone');self.assertEqual(session['role'],'owner')
        guest,session=self.hub.pair(self.hub.guest_pin,'guest');self.assertEqual(session['role'],'guest')
        for i in range(5):
            with self.assertRaises(ValueError):self.hub.pair('invalid','attacker')
        with self.assertRaisesRegex(ValueError,'Demasiados'):self.hub.pair(self.hub.pin,'attacker')
        self.assertIsNotNone(Hub(self.temp.name,self.target,lambda:self.now[0]).session(token))
        self.action(action='revoke');self.assertIsNone(self.hub.session(guest));self.assertIsNone(self.hub.session(token))
    def test_guest_can_enqueue_only_and_commands_are_isolated_by_tv(self):
        self.hub.mutate({'action':'enqueue','youtube':'https://youtu.be/M7lc1UVf-VE'},'guest',self.target)
        with self.assertRaises(PermissionError):self.hub.mutate({'action':'play','youtube':'https://youtu.be/M7lc1UVf-VE'},'guest',self.target)
        self.action(action='target',ip='127.0.0.4',name='Otra')
        self.action(action='next');one=self.hub.tv(self.target)['commands'][0]
        self.assertEqual(self.hub.tv('127.0.0.4')['commands'],[])
        self.hub.tv(self.target,{'ack':one['id']});self.assertEqual(self.hub.tv(self.target)['commands'],[])
    def test_queue_order_automatic_next_repeat_and_playlists(self):
        for name in ['Uno','Dos','Tres']:self.action(action='enqueue',youtube='https://youtu.be/M7lc1UVf-VE',name=name)
        queue=self.hub.channel(self.target)['queue'];self.action(action='move-queue',id=queue[2]['play_id'],direction=-1)
        self.assertEqual([i['name'] for i in self.hub.channel(self.target)['queue']],['Uno','Tres','Dos'])
        self.action(action='save-playlist',name='Fiesta');playlist=self.hub.data['playlists'][0]
        self.action(action='play-playlist',id=playlist['id']);self.assertEqual(self.hub.channel(self.target)['current']['name'],'Uno')
        current=self.hub.channel(self.target)['current'];self.hub.tv(self.target,{'ended':current['play_id']})
        self.assertEqual(self.hub.channel(self.target)['current']['name'],'Tres')
        self.hub.tv(self.target,{'ended':current['play_id']});self.assertEqual(self.hub.channel(self.target)['current']['name'],'Tres')
        self.action(action='repeat');current=self.hub.channel(self.target)['current'];self.hub.tv(self.target,{'ended':current['play_id']})
        self.assertEqual(self.hub.channel(self.target)['queue'][-1]['name'],'Tres')
        self.action(action='previous');self.assertEqual(self.hub.channel(self.target)['current']['name'],'Tres')
    def test_upload_photo_range_source_and_invalid_upload_cleanup(self):
        image=ROOT/'app/assets/salvapantallas.png'
        if not image.exists():image=ROOT/'app/assets/salvapantallas.jpg'
        raw=image.read_bytes()
        with patch('hub.shutil.which',return_value=None):source=self.hub.upload(BytesIO(raw),len(raw),'../../family'+image.suffix)
        self.assertEqual(source['kind'],'photo');self.assertEqual(len(list(self.hub.files.iterdir())),1)
        with self.assertRaises(ValueError):self.hub.upload(BytesIO(b'not an image'),12,'fake.png')
        self.assertEqual(len(list(self.hub.files.iterdir())),1)
        self.action(action='favorite',id=source['id']);self.assertTrue(self.hub.source(source['id'])['favorite'])
        self.action(action='play',source=source['id']);self.assertTrue(self.hub.channel(self.target)['current']['path'].startswith('/hub/file/'))
    def test_sources_rss_scene_and_schedule_once(self):
        class Response(BytesIO):pass
        class Connection:
            def close(self):pass
        rss=b'<rss><channel><item><title>Episode</title><enclosure url="https://pod.example/audio.mp3" /></item></channel></rss>'
        with patch('hub.public_open',return_value=(Connection(),Response(rss))):self.assertEqual(self.hub.podcast('https://pod.example/rss'),1)
        self.assertEqual(self.hub.data['sources'][0]['kind'],'podcast')
        self.action(action='source',kind='card',name='Carta',body='Comida $100\nSin HTML')
        card=self.hub.data['sources'][-1]
        self.action(action='scene',name='Restaurante',items=[card['id']],interval=5,music=self.hub.data['sources'][0]['id'])
        scene=self.hub.data['scenes'][0];now=datetime.datetime.fromtimestamp(self.now[0]).astimezone()
        self.action(action='schedule',scene=scene['id'],time=now.strftime('%H:%M'),days=[now.weekday()])
        self.hub.schedules();self.hub.schedules()
        self.assertEqual(len([c for c in self.hub.commands if c['kind']=='scene']),1)
        self.now[0]+=46;self.assertEqual(self.hub.tv(self.target)['commands'],[])
    def test_public_fetch_rejects_private_dns_credentials_and_protocols(self):
        for url in ['file:///etc/passwd','https://user:secret@example.com/x','http://example.com:8088/x']:
            with self.assertRaises(ValueError):public_open(url)
        with patch('hub.socket.getaddrinfo',return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('127.0.0.1',0))]):
            with self.assertRaises(ValueError):public_open('https://example.com')
        self.assertEqual(parse_video('https://dai.ly/x84sh87')['provider'],'dailymotion')
        self.assertIsNone(parse_video('https://dailymotion.com.evil.example/video/x84sh87'))
        library=Library(Path(self.temp.name)/'links.json')
        library.change({'action':'add','urls':'https://dai.ly/x84sh87'})
        self.assertEqual(library.read()[0]['provider'],'dailymotion')
        library.change({'action':'remove','id':'x84sh87','provider':'dailymotion'});self.assertEqual(library.read(),[])

class HubHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.server=ThreadingHTTPServer(('127.0.0.1',0),puente.Handler)
        self.server.tv='127.0.0.3';self.server.admin_token='owner-token';self.server.allow_launch=False;self.server.origins=['null'];self.server.media_dir=None
        self.server.hub=Hub(self.temp.name,self.server.tv);self.server.youtube_library=Library(Path(self.temp.name)/'links.json');self.server.realtime=Realtime()
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start();self.origin='http://127.0.0.1:'+str(self.server.server_port)
    def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join();self.temp.cleanup()
    def request(self,path,body=None,address='127.0.0.2',cookie=None,csrf=None,raw=None,filename=None):
        headers={'Host':'127.0.0.1:'+str(self.server.server_port),'Origin':self.origin}
        if cookie:headers['Cookie']=cookie
        if csrf:headers['X-Alma-Token']=csrf
        if filename:headers['X-Alma-Filename']=filename
        content=raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        if content is not None:headers['Content-Type']='application/octet-stream' if raw is not None else 'application/json'
        c=HTTPConnection('127.0.0.1',self.server.server_port,source_address=(address,0),timeout=3)
        c.request('POST' if content is not None else 'GET',path,content,headers);r=c.getresponse();result=(r.status,r.read(),dict(r.getheaders()));c.close();return result
    def test_pair_csrf_guest_owner_tv_and_photo_http(self):
        status,body,_=self.request('/hub/state');self.assertEqual(status,403)
        status,page,_=self.request('/control');self.assertEqual(status,200);self.assertIn(b'pair-form',page)
        status,body,headers=self.request('/hub/pair',{'pin':self.server.hub.guest_pin});self.assertEqual(status,200)
        cookie=headers['Set-Cookie'].split(';')[0];token=cookie.split('=',1)[1];csrf=self.server.hub.session(token)['csrf']
        status,body,_=self.request('/hub/state',cookie=cookie);self.assertEqual(status,200);self.assertNotIn('pin',json.loads(body))
        self.assertEqual(self.request('/hub/action',{'action':'play','youtube':'https://youtu.be/M7lc1UVf-VE'},cookie=cookie,csrf=csrf)[0],403)
        self.assertEqual(self.request('/hub/action',{'action':'enqueue','youtube':'https://youtu.be/M7lc1UVf-VE'},cookie=cookie,csrf='wrong')[0],403)
        self.assertEqual(self.request('/hub/action',{'action':'enqueue','youtube':'https://youtu.be/M7lc1UVf-VE'},cookie=cookie,csrf=csrf)[0],200)
        self.assertEqual(self.request('/hub/tv')[0],403)
        status,body,_=self.request('/hub/tv',address='127.0.0.3');self.assertEqual(status,200);self.assertIn('pin',json.loads(body))
        self.assertEqual(self.request('/hub/action',{'action':'next'},address='127.0.0.1',csrf='owner-token')[0],200)
        command=json.loads(self.request('/hub/tv',address='127.0.0.3')[1])['commands'][0]
        self.assertEqual(self.request('/hub/tv',{'ack':command['id']},address='127.0.0.3')[0],200)
        image=(ROOT/'app/assets/salvapantallas.png')
        if not image.exists():image=ROOT/'app/assets/salvapantallas.jpg'
        with patch('hub.shutil.which',return_value=None):status,body,_=self.request('/hub/upload',address='127.0.0.1',csrf='owner-token',raw=image.read_bytes(),filename='family'+image.suffix)
        self.assertEqual(status,200);ident=json.loads(body)['item']['id']
        status,content,_=self.request('/hub/file/'+ident,address='127.0.0.3');self.assertEqual(status,200);self.assertEqual(content,image.read_bytes())
