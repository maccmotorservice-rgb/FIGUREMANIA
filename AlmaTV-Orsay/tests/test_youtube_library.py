from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import puente
from youtube_library import Library, video_id


class LibraryTests(unittest.TestCase):
    def test_urls_accept_only_individual_youtube_videos(self):
        for url in ['https://youtu.be/M7lc1UVf-VE?t=10', 'https://www.youtube.com/watch?v=M7lc1UVf-VE', 'https://m.youtube.com/shorts/M7lc1UVf-VE', 'https://www.youtube.com/live/M7lc1UVf-VE']:
            self.assertEqual(video_id(url), 'M7lc1UVf-VE')
        for url in ['https://youtube.com.evil.example/watch?v=M7lc1UVf-VE', 'https://youtube.com@evil.example/watch?v=M7lc1UVf-VE', 'http://127.0.0.1/file.mp4', 'javascript:alert(1)', 'https://youtube.com/playlist?list=foo', 'https://youtu.be/bad', 'https://youtu.be:999/M7lc1UVf-VE']:
            self.assertEqual(video_id(url), '')

    def test_bulk_deduplicates_renames_and_persists_across_restarts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'links.json'
            library = Library(path)
            links = 'https://youtu.be/M7lc1UVf-VE\nhttps://youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtu.be/M7lc1UVf-VE'
            items = library.change({'action': 'add', 'urls': links})
            self.assertEqual(len(items), 2)
            library.change({'action': 'add', 'urls': 'https://youtu.be/M7lc1UVf-VE', 'name': 'Música y vídeos de México'})
            restarted = Library(path)
            self.assertEqual(restarted.read()[0]['name'], 'Música y vídeos de México')
            items = restarted.change({'action': 'remove', 'id': 'M7lc1UVf-VE'})
            self.assertEqual([item['id'] for item in items], ['dQw4w9WgXcQ'])

    def test_bad_batch_does_not_partially_save_and_corruption_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'links.json'
            library = Library(path)
            library.change({'action': 'add', 'urls': 'https://youtu.be/M7lc1UVf-VE'})
            before = path.read_bytes()
            for change in [{'action': 'add', 'urls': 'https://youtu.be/dQw4w9WgXcQ\nhttps://evil.example/video'}, {'action': 'add', 'urls': 'https://youtu.be/M7lc1UVf-VE', 'name': 'x' * 81}, {'action': 'remove', 'id': '../../private'}]:
                with self.assertRaises(ValueError): library.change(change)
                self.assertEqual(path.read_bytes(), before)
            path.write_text('broken', encoding='utf-8')
            with self.assertRaises(ValueError): library.change({'action': 'add', 'urls': 'https://youtu.be/dQw4w9WgXcQ'})
            self.assertEqual(path.read_text(), 'broken')

    def test_fifty_limit_is_transactional(self):
        with tempfile.TemporaryDirectory() as directory:
            library = Library(Path(directory) / 'links.json')
            library.change({'action': 'add', 'urls': '\n'.join('https://youtu.be/%011d' % n for n in range(50))})
            with self.assertRaises(ValueError): library.change({'action': 'add', 'urls': 'https://youtu.be/M7lc1UVf-VE'})
            self.assertEqual(len(library.read()), 50)


class PanelTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), puente.Handler)
        self.server.origins = ['null']
        self.server.youtube_library = Library(Path(self.directory.name) / 'links.json')
        self.server.admin_token = 'a' * 32
        self.server.allow_launch = False
        self.server.tv = '192.168.1.249'
        self.base = 'http://127.0.0.1:' + str(self.server.server_port)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        self.directory.cleanup()

    def post(self, data, origin=None, token=None, content_type='application/json', host=None):
        headers = {'Origin': self.base if origin is None else origin, 'X-Alma-Token': self.server.admin_token if token is None else token, 'Content-Type': content_type}
        if host: headers['Host'] = host
        body = data if isinstance(data, bytes) else json.dumps(data).encode('utf-8')
        return urlopen(Request(self.base + '/youtube/library', data=body, headers=headers, method='POST'), timeout=3)

    def test_panel_and_real_http_write_read_remove(self):
        with urlopen(self.base + '/enlaces') as response:
            page = response.read().decode('utf-8')
            self.assertIn(self.server.admin_token, page)
            self.assertNotIn('__ALMA_PANEL_TOKEN__', page)
            self.assertEqual(response.headers['X-Frame-Options'], 'DENY')
        with self.post({'action': 'add', 'urls': 'https://youtu.be/M7lc1UVf-VE', 'name': 'Mi concierto'}) as response:
            self.assertEqual(json.load(response)['items'][0]['name'], 'Mi concierto')
        with urlopen(Request(self.base + '/youtube/library', headers={'Origin': 'null'})) as response:
            self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'null')
            self.assertEqual(json.load(response)['items'][0]['id'], 'M7lc1UVf-VE')
        with self.post({'action': 'remove', 'id': 'M7lc1UVf-VE'}) as response:
            self.assertEqual(json.load(response)['items'], [])

    def test_direct_player_and_diagnostic_use_bridge_without_playlist_changes(self):
        with urlopen(self.base+'/youtube/prueba') as response:
            body=response.read().decode('utf-8')
            self.assertIn('"standalone": true',body)
            self.assertIn('"parent": "'+self.base+'"',body)
            self.assertIn('direct-play',body)
        with urlopen(self.base+'/youtube/diagnostic') as response:
            self.assertIsNone(json.load(response)['report'])
        data=json.dumps({'token':'a'*32,'phase':'timeout','status':'YT-INICIO','state':-1,'seconds':0,'width':900,'height':300,'h264':'probably','mse':False}).encode('utf-8')
        headers={'Origin':self.base,'Content-Type':'application/json'}
        with urlopen(Request(self.base+'/youtube/diagnostic',data=data,headers=headers,method='POST')) as response:
            self.assertTrue(json.load(response)['ok'])
        with urlopen(self.base+'/youtube/diagnostic') as response:
            report=json.load(response)['report']
            self.assertEqual(report['state'],-1)
            self.assertEqual(report['phase'],'timeout')
            self.assertNotIn('token',report)
        headers['Origin']='https://evil.example'
        with self.assertRaises(HTTPError) as error:urlopen(Request(self.base+'/youtube/diagnostic',data=data,headers=headers,method='POST'))
        self.assertEqual(error.exception.code,403)
        self.assertEqual(self.server.youtube_library.read(),[])

    def test_writes_require_own_origin_valid_token_and_json(self):
        data = {'action': 'add', 'urls': 'https://youtu.be/M7lc1UVf-VE'}
        for options, code in [({'origin': 'null'}, 403), ({'origin': 'https://evil.example'}, 403), ({'token': 'wrong'}, 403), ({'token': ''}, 403), ({'host': 'evil.example'}, 403), ({'content_type': 'text/plain'}, 415)]:
            with self.assertRaises(HTTPError) as error: self.post(data, **options)
            self.assertEqual(error.exception.code, code)
        with self.assertRaises(HTTPError) as error: self.post(b'x' * 32769)
        self.assertEqual(error.exception.code, 413)
        with self.assertRaises(HTTPError) as error: self.post(b'{bad json')
        self.assertEqual(error.exception.code, 400)
        self.assertEqual(self.server.youtube_library.read(), [])


if __name__ == '__main__':
    unittest.main()
