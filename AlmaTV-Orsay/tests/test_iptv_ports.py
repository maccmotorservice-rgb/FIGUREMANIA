"""No provider credentials or real external network calls are used in these tests."""
import io
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import Mock,patch
from hub import public_open,PublicConnection
from iptv import IPTV,stream_url

PUBLIC=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('93.184.216.34',0))]
class IPTVPortTests(unittest.TestCase):
    def test_http_port_and_query_credentials_are_preserved(self):
        response=Mock(status=200);connection=Mock();connection.getresponse.return_value=response
        url='http://provider.example:25461/get.php?username=test%40user&password=example-only&type=m3u_plus'
        with patch('hub.socket.getaddrinfo',return_value=PUBLIC),patch('hub.http.client.HTTPConnection',return_value=connection) as factory:
            self.assertEqual(public_open(url,allow_custom_port=True),(connection,response))
            factory.assert_called_once_with('93.184.216.34',25461,timeout=12)
        args,kwargs=connection.request.call_args;self.assertEqual(args,('GET','/get.php?username=test%40user&password=example-only&type=m3u_plus'));self.assertEqual(kwargs['headers']['Host'],'provider.example:25461')
    def test_https_port_host_and_tls_server_name_are_correct(self):
        response=Mock(status=200);connection=Mock();connection.getresponse.return_value=response
        with patch('hub.socket.getaddrinfo',return_value=PUBLIC),patch('hub.PublicConnection',return_value=connection) as factory:
            public_open('https://provider.example:8880/get.php?username=@example@only&password=not-real&type=m3u_plus',allow_custom_port=True)
            factory.assert_called_once_with('provider.example','93.184.216.34',8880)
            self.assertEqual(connection.request.call_args[1]['headers']['Host'],'provider.example:8880')
        context=Mock();sock=Mock()
        with patch('hub.ssl.create_default_context',return_value=context),patch('hub.socket.create_connection',return_value=sock) as connect:
            tls=PublicConnection('provider.example','93.184.216.34',8880);tls.connect()
            connect.assert_called_once_with(('93.184.216.34',8880),12);context.wrap_socket.assert_called_once_with(sock,server_hostname='provider.example')
    def test_private_destinations_invalid_ports_and_url_userinfo_stay_blocked(self):
        for url in ('http://example.org:0/list','http://example.org:65536/list','https://name:pass@example.org:8880/list'):
            self.assertFalse(stream_url(url))
            with self.assertRaises(ValueError):public_open(url,allow_custom_port=True)
        with patch('hub.socket.getaddrinfo',return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('192.168.1.1',0))]):
            with self.assertRaises(ValueError):public_open('http://example.org:25461/list',allow_custom_port=True)
        with self.assertRaises(ValueError):public_open('http://example.org:25461/list')
    def test_import_and_redirect_allow_custom_ports_for_every_hop(self):
        with tempfile.TemporaryDirectory() as tmp:
            redirect=Mock(status=302);redirect.getheader.return_value='https://cdn.example:8880/list.m3u'
            content=io.BytesIO(b'#EXTM3U\n#EXTINF:-1,Prueba\nhttp://cdn.example:25461/live/example.m3u8\n');content.status=200;content.getheader=lambda n,d=None:d
            opener=Mock(side_effect=[(Mock(),redirect),(Mock(),content)])
            library=IPTV(Path(tmp)/'iptv.json',[]);library.mutate({'action':'import','url':'http://provider.example:25461/get.php?username=example&password=not-real&type=m3u_plus'},opener)
            for call in opener.call_args_list:self.assertEqual(call.kwargs,{'allow_redirect':True,'allow_custom_port':True})
            self.assertEqual(library.guide()['total'],1)
