import hashlib
from http.server import ThreadingHTTPServer
from io import BytesIO
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import importar_salvapantallas
import preparar
import puente
from servir import Handler as InstallerHandler
from functools import partial

class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.files={str(p.relative_to(ROOT/'app')):p.read_bytes() for p in (ROOT/'app').rglob('*') if p.is_file()}
    def test_manifest_identity_plain_info_and_relative_resources(self):
        ident,version,_=preparar.validate(self.files)
        self.assertEqual((ident,version),('AlmaTV72','7.2.1'))
        self.assertNotIn(b'<',self.files['widget.info'])
        self.assertIn(b'1280x720',self.files['widget.info'])
        with tempfile.TemporaryDirectory() as directory:
            archive=preparar.build(self.files,directory,'192.168.1.30')
            first=archive.read_bytes()
            tree=ET.parse(str(Path(directory)/'widgetlist.xml'))
            self.assertEqual(tree.find('.//widget').get('id'),ident)
            self.assertEqual(int(tree.find('.//compression').get('size')),len(first))
            self.assertEqual(tree.findtext('.//download'),'http://192.168.1.30/Widget/'+archive.name)
            archive=preparar.build(self.files,directory,'192.168.1.31')
            self.assertEqual(first,archive.read_bytes(),'Build ZIP must be byte-for-byte reproducible')
            with ZipFile(str(archive)) as z:
                self.assertIsNone(z.testzip())
                self.assertIn('index.html',z.namelist())
                self.assertNotIn('app/index.html',z.namelist())
            manifest=json.loads((Path(directory)/'manifest.json').read_text())
            self.assertEqual(manifest['sha256'],hashlib.sha256(first).hexdigest())
    def test_version_7_installed_backup_is_exact_and_catalogue_can_change_ip(self):
        archive=ROOT/'respaldo/version-7.0/Widget/AlmaTV70_7.0.0.zip'
        data=archive.read_bytes()
        self.assertEqual(hashlib.sha256(data).hexdigest(),'8de13daa70f719364c5e6a5cb966f53c73366b9b8e29424a9a9a35c47a24e9c3')
        with ZipFile(str(archive)) as z:
            self.assertIsNone(z.testzip())
            ident,version,title=preparar.validate({n:z.read(n) for n in z.namelist()})
        self.assertEqual((ident,version),('AlmaTV70','7.0.0'))
        with tempfile.TemporaryDirectory() as directory:
            preparar.catalogue(ident,version,title,archive,Path(directory),'10.0.0.30')
            tree=ET.parse(str(Path(directory)/'widgetlist.xml'))
            self.assertEqual(tree.find('.//widget').get('id'),'AlmaTV70')
            self.assertIn('http://10.0.0.30/Widget/',tree.findtext('.//download'))
        self.assertEqual(archive.read_bytes(),data)
    def test_spanish_assets_are_ascii_safe_without_losing_accents(self):
        files=preparar.runtime_files(self.files)
        for name,body in files.items():
            if name.endswith(('.js','.css','.html')):self.assertTrue(body.isascii(),name)
        self.assertIn(b'\\u00f1',files['main.js'])
        self.assertIn(b'charset="UTF-8"',files['index.html'])
        source={'test.js':'var value="Peña, México";'.encode('utf-8')}
        encoded=preparar.runtime_files(source)['test.js']
        self.assertEqual(encoded.decode('ascii').encode('ascii').decode('unicode_escape'),'var value="Peña, México";')
    def test_version_71_backup_is_unchanged(self):
        archive=ROOT/'respaldo/version-7.1/Widget/AlmaTV71_7.1.0.zip'
        self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(),'f5558bd8152d8b3e0f3de5832d46a3ea0f9ccf519dfee044e1922d7dc578fc7d')
        with ZipFile(str(archive)) as z:self.assertIsNone(z.testzip())
    def test_invalid_package_rejected(self):
        for name,body in [('widget.info',b'<widget/>'),('config.xml',b'<widget><cpname>bad id</cpname></widget>'),('index.html',b'<script src="https://cdn.example/app.js"></script>')]:
            files=dict(self.files);files[name]=body
            with self.assertRaises(ValueError):
                preparar.validate(files)
    def test_original_rollback_contents_are_preserved(self):
        with ZipFile(str(ROOT/'respaldo/ALMA_TV_CODEX_STARTER_original.zip')) as source, ZipFile(str(ROOT/'respaldo/servidor/Widget/AlmaTV60_6.0.0.zip')) as backup:
            prefix='AlmaTV_6_0_TVOS_Red/app/'
            expected={n[len(prefix):]:source.read(n) for n in source.namelist() if n.startswith(prefix) and not n.endswith('/')}
            actual={n:backup.read(n) for n in backup.namelist()}
            self.assertEqual(expected,actual)
            self.assertEqual(ET.parse(str(ROOT/'respaldo/servidor/widgetlist.xml')).find('.//widget').get('id'),'AlmaTV60')
    def test_private_ipv4_only(self):
        for value in ['192.168.1.30','10.1.2.3','172.16.2.1']:
            self.assertEqual(preparar.private_ipv4(value),value)
        for value in ['8.8.8.8','127.0.0.1','0.0.0.0','192.168.1.999','example.com','::1','169.254.1.2']:
            with self.assertRaises(ValueError):preparar.private_ipv4(value)
    def test_actual_installer_http_serves_catalogue_zip_but_not_source(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(InstallerHandler,directory=str(ROOT/'servidor')))
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            base='http://127.0.0.1:'+str(server.server_port)
            with urlopen(base+'/widgetlist.xml') as response:
                self.assertEqual(response.status,200)
                tree=ET.fromstring(response.read())
                zip_name=tree.findtext('.//download').rsplit('/',1)[1]
            with urlopen(base+'/Widget/'+zip_name) as response:
                self.assertIsNone(ZipFile(BytesIO(response.read())).testzip())
            for route in ['/','/manifest.json','/../preparar.py','/Widget/../../README.md']:
                with self.assertRaises(HTTPError) as error:urlopen(base+route)
                self.assertEqual(error.exception.code,404)
        finally:
            server.shutdown();server.server_close();thread.join()

class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.server=ThreadingHTTPServer(('127.0.0.1',0),puente.Handler)
        self.server.tv='192.168.1.249';self.server.allow_launch=False;self.server.origins=['null','http://127.0.0.1:8765']
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.base='http://127.0.0.1:'+str(self.server.server_port)
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join()
    def req(self,route,method='GET',origin='null'):
        return urlopen(Request(self.base+route,data=b'' if method=='POST' else None,method=method,headers={'Origin':origin}),timeout=3)
    def test_health_cors_and_unknown_routes(self):
        with self.req('/health') as response:
            self.assertEqual(response.headers['Access-Control-Allow-Origin'],'null')
            self.assertFalse(json.load(response)['dial_launch_enabled'])
        for route,origin,code in [('/health','https://evil.example',403),('/unknown','null',404),('/dial/PrimeVideo','null',404),('/weather','null',400)]:
            with self.assertRaises(HTTPError) as error:self.req(route,origin=origin)
            self.assertEqual(error.exception.code,code)
    def test_launch_is_opt_in_and_tv_target_fixed(self):
        with self.assertRaises(HTTPError) as error:self.req('/dial/Netflix','POST')
        self.assertEqual(error.exception.code,403)
        with self.assertRaises(HTTPError) as error:self.req('/dial/YouTube?tv=10.0.0.2')
        self.assertEqual(error.exception.code,403)
    def test_successful_dial_relay_and_failure_propagation(self):
        class Response:
            status=201
            def geturl(self):return 'http://192.168.1.249:8080/ws/app/Netflix'
            def read(self,n):return b'<service><state>running</state></service>'
            def __enter__(self):return self
            def __exit__(self,*args):pass
        self.server.allow_launch=True
        with patch.object(puente.LOCAL_OPENER,'open',return_value=Response()) as opened:
            with self.req('/dial/Netflix','POST') as response:self.assertEqual(response.status,201)
            request=opened.call_args.args[0]
            self.assertEqual(request.get_method(),'POST')
            self.assertEqual(request.full_url,'http://192.168.1.249:8080/ws/app/Netflix')
        with patch.object(puente.LOCAL_OPENER,'open',side_effect=TimeoutError):
            with self.assertRaises(HTTPError) as error:self.req('/dial/YouTube')
            self.assertEqual(error.exception.code,502)
    def test_weather_actual_schema_cache_and_failure(self):
        puente.CACHE.clear()
        geocode={'results':[{'name':'Tuxtla Gutiérrez','admin1':'Chiapas','country':'México','latitude':16.75,'longitude':-93.12}]}
        forecast={'current':{'temperature_2m':24,'weather_code':3,'time':'2026-10-21T12:00'},'timezone':'America/Mexico_City'}
        with patch.object(puente,'read_json',side_effect=[geocode,forecast]) as reader:
            with self.req('/weather?city=Tuxtla') as response:
                result=json.load(response)
            self.assertEqual(result['temperature'],24)
            self.assertEqual(result['description'],'Nublado')
            self.assertEqual(result['code'],3)
            self.assertIn('Chiapas',result['city'])
            with self.req('/weather?city=Tuxtla') as response:self.assertEqual(json.load(response),result)
            self.assertEqual(reader.call_count,2)
            for call in reader.call_args_list:self.assertTrue(call.args[0].startswith('https://'))
        with patch.object(puente,'read_json',side_effect=TimeoutError):
            with self.assertRaises(HTTPError) as error:self.req('/weather?city=Otra')
            self.assertEqual(error.exception.code,502)
    def test_redirects_are_rejected_before_following(self):
        with self.assertRaises(ValueError):puente.NoRedirect().redirect_request(None,None,302,'',{},'https://evil.example')

class LibraryTests(unittest.TestCase):
    setUp=BridgeTests.setUp
    tearDown=BridgeTests.tearDown
    req=BridgeTests.req
    def test_media_library_and_range_requests(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);track=root/'Mi canción.mp3'
            data=(ROOT/'app/assets/media/prueba-sonido.mp3').read_bytes();track.write_bytes(data)
            (root/'privado.txt').write_text('not served')
            self.server.media_dir=root
            with self.req('/media/library') as response:listing=json.load(response)
            self.assertTrue(listing['enabled']);self.assertEqual(len(listing['items']),1)
            item=listing['items'][0];self.assertEqual(item['name'],'Mi canción');self.assertEqual(item['kind'],'audio')
            with self.req('/media/file/'+item['id']) as response:
                self.assertEqual(response.headers['Content-Type'],'audio/mpeg');self.assertEqual(response.read(),data)
            request=Request(self.base+'/media/file/'+item['id'],headers={'Origin':'null','Range':'bytes=100-299'})
            with urlopen(request) as response:
                self.assertEqual(response.status,206);self.assertEqual(response.read(),data[100:300]);self.assertEqual(response.headers['Content-Range'],'bytes 100-299/'+str(len(data)))
    def test_media_does_not_expose_unselected_paths_or_symlinks(self):
        with tempfile.TemporaryDirectory() as directory,tempfile.TemporaryDirectory() as external:
            root=Path(directory);outside=Path(external)/'outside.mp3';outside.write_bytes(b'private')
            (root/'outside.mp3').symlink_to(outside)
            self.server.media_dir=root
            with self.req('/media/library') as response:self.assertEqual(json.load(response)['items'],[])
            for route in ['/media/file/0000000000000000','/media/file/../outside.mp3','/media/file/%2e%2e/outside.mp3']:
                with self.assertRaises(HTTPError) as error:self.req(route)
                self.assertEqual(error.exception.code,404)
    def test_media_invalid_range_fails_without_returning_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'track.mp3').write_bytes(b'1234567890');self.server.media_dir=root
            ident=next(iter(puente.media_files(root)))
            for value in ['bytes=999-1000','bytes=7-3','bytes=1-2,4-5','invalid']:
                with self.assertRaises(HTTPError) as error:urlopen(Request(self.base+'/media/file/'+ident,headers={'Range':value,'Origin':'null'}))
                self.assertEqual(error.exception.code,416)

class MediaTests(unittest.TestCase):
    def png(self,width=1,height=1):
        import struct,zlib,binascii
        def chunk(kind,payload):
            return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',binascii.crc32(kind+payload)&0xffffffff)
        return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\0\0\0\0'))+chunk(b'IEND',b'')
    def test_import_preserves_exact_bytes_and_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'app/assets').mkdir(parents=True)
            source=root/'original.png';source.write_bytes(self.png())
            target=importar_salvapantallas.install(source,root)
            self.assertEqual(target.read_bytes(),source.read_bytes())
            self.assertIn('assets/salvapantallas.png',(root/'app/assets/media.js').read_text())
            importar_salvapantallas.install(source,root)
            backup=list((root/'respaldo').glob('*/salvapantallas.png'))
            self.assertEqual(len(backup),1)
            self.assertEqual(backup[0].read_bytes(),source.read_bytes())
    def test_invalid_oversized_and_corrupt_image_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'app/assets').mkdir(parents=True)
            source=root/'image.png'
            for data in [b'not-an-image',self.png(1921,1080),self.png()[:-8],self.png()[:40]+b'wrongCRC',b'x'*(4*1024*1024+1)]:
                source.write_bytes(data)
                with self.assertRaises(ValueError):importar_salvapantallas.install(source,root)

if __name__=='__main__':unittest.main()
