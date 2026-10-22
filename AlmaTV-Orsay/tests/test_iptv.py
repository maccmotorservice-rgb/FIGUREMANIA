import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock
from iptv import IPTV, parse_m3u, stream_url
from hub import Hub

SAMPLE=b'''\xef\xbb\xbf#EXTM3U
#EXTINF:-1 tvg-id="Uno.mx@SD" group-title="Noticias, locales",Canal Uno
https://stream.example.org/one.m3u8
#EXTINF:-1 tvg-country="US",Otro
/two.m3u8
#EXTINF:-1,Duplicado
https://stream.example.org/one.m3u8
#EXTINF:-1,Privado
http://127.0.0.1/secret
'''
def response(raw=SAMPLE):
    conn=Mock();res=io.BytesIO(raw);res.status=200;res.getheader=lambda name,default=None:default
    return conn,res

class IPTVTests(unittest.TestCase):
    def test_parse_metadata_relative_dedupe_and_unsafe(self):
        channels,skipped=parse_m3u(SAMPLE,'https://lists.example.org/index.m3u')
        self.assertEqual(len(channels),2);self.assertEqual(skipped,2)
        self.assertEqual(channels[0]['name'],'Canal Uno');self.assertEqual(channels[0]['group'],'Noticias, locales')
        self.assertEqual(channels[0]['country'],'mx');self.assertEqual(channels[1]['url'],'https://lists.example.org/two.m3u8')
        self.assertEqual(channels[0]['id'],parse_m3u(SAMPLE,'https://other.example.org/')[0][0]['id'])
    def test_manifest_and_empty_rejected(self):
        for raw in (b'#EXTM3U\n#EXT-X-TARGETDURATION:10\nx.ts',b'not m3u',b'#EXTM3U\n'):
            with self.assertRaises(ValueError):parse_m3u(raw,'https://example.org/list')
        for url in ('file:///secret','http://192.168.1.1/a','http://localhost/a','https://name:pass@example.org/a','https://example.org/a|COMPONENT=X'):
            self.assertFalse(stream_url(url))
    def test_import_filter_update_failure_persistence_and_revisions(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'iptv.json';lib=IPTV(path,[])
            result=lib.mutate({'action':'import','url':'https://example.org/list.m3u'},lambda *a,**k:response())
            self.assertEqual(result,{'matched':1,'published':1,'available':2});revision=lib.revision
            self.assertEqual(IPTV(path,[]).catalog,lib.catalog)
            with self.assertRaises(ValueError):lib.mutate({'action':'refresh','url':'https://example.org/list.m3u'},lambda *a,**k:response(b'bad'))
            self.assertEqual(revision,lib.revision)
            self.assertEqual(lib.mutate({'action':'publish','country':'','search':''},None)['published'],2)
            self.assertNotEqual(revision,lib.revision)
            lib.mutate({'action':'remove','url':'https://example.org/list.m3u'},None);self.assertEqual(lib.catalog,[])
    def test_catalogue_bounded_and_only_sent_on_revision_change(self):
        raw=('#EXTM3U\n'+''.join('#EXTINF:-1 tvg-country="MX",Canal %d\nhttps://example.org/%d.m3u8\n'%(i,i) for i in range(510))).encode()
        with tempfile.TemporaryDirectory() as tmp:
            hub=Hub(tmp,'127.0.0.3');result=hub.iptv.mutate({'action':'import','url':'https://example.org/list'},lambda *a,**k:response(raw))
            self.assertEqual(result,{'matched':510,'published':500,'available':510});first=hub.tv('127.0.0.3',{})
            self.assertEqual(len(first['live_catalog']),504)
            self.assertNotIn('live_catalog',hub.tv('127.0.0.3',{'live_revision':first['live_revision']}))
            hub.mutate({'action':'control','command':'live-channel','view':hub.iptv.catalog[-1]['id']},'owner','127.0.0.3')
            self.assertEqual(len(hub.snapshot('127.0.0.3','owner')['live_tv']),504)
    def test_redirect_private_destination_is_not_opened(self):
        with tempfile.TemporaryDirectory() as tmp:
            conn,res=response();res.status=302;res.getheader=lambda n,d=None:'http://127.0.0.1/private' if n=='Location' else d
            opener=Mock(return_value=(conn,res))
            with self.assertRaises(ValueError):IPTV(Path(tmp)/'iptv.json',[]).mutate({'action':'import','url':'https://example.org/list'},opener)
            self.assertEqual(opener.call_count,1);conn.close.assert_called_once()

    def test_manual_categories_favorites_delete_refresh_restore_and_migration(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'iptv.json';path.write_text(json.dumps({'sources':[],'country':'mx','search':'','published':[]}))
            lib=IPTV(path,[]);lib.mutate({'action':'import','url':'https://example.org/list'},lambda *a,**k:response())
            channel=lib.catalog[0];self.assertFalse(channel['favorite']);self.assertEqual(channel['category'],'')
            lib.edit({'action':'favorite','id':channel['id'],'enabled':True});self.assertEqual(lib.catalog[0]['category'],'')
            lib.edit({'action':'favorite','id':channel['id'],'enabled':True,'category':'Deportes'})
            self.assertEqual(lib.catalog[0]['category'],'Deportes')
            with self.assertRaises(ValueError):lib.edit({'action':'favorite','id':channel['id'],'enabled':True,'category':'Inventada'})
            lib.edit({'action':'category','name':'Mis especiales'});lib.edit({'action':'favorite','id':channel['id'],'enabled':True,'category':'Mis especiales'})
            lib.mutate({'action':'refresh','url':'https://example.org/list'},lambda *a,**k:response(SAMPLE.replace(b'Canal Uno',b'Canal nuevo')))
            self.assertEqual(lib.catalog[0]['name'],'Canal nuevo')
            lib.mutate({'action':'publish','country':'us'},None);self.assertTrue(any(c['id']==channel['id'] for c in lib.catalog),'Favorite survives selection changes')
            lib.edit({'action':'delete-channel','id':channel['id'],'op':'delete-1'})
            lib.edit({'action':'delete-channel','id':channel['id'],'op':'delete-1'})
            self.assertFalse(any(c['id']==channel['id'] for c in lib.catalog))
            lib.mutate({'action':'refresh','url':'https://example.org/list'},lambda *a,**k:response())
            lib=IPTV(path,[]);self.assertEqual(len(lib.info()['deleted']),1)
            self.assertFalse(any(c['id']==channel['id'] for c in lib.catalog))
            lib.edit({'action':'restore','id':channel['id']});self.assertEqual(next(c for c in lib.catalog if c['id']==channel['id'])['category'],'Mis especiales')
    def test_tv_edits_are_acknowledged_and_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            hub=Hub(tmp,'127.0.0.3');event={'live_edits':[{'op':'f1','action':'favorite','id':'capital21','enabled':True,'category':'Noticias'}]}
            for attempt in range(2):
                state=hub.tv('127.0.0.3',event);self.assertEqual(state['live_edit_ack'],['f1']);self.assertEqual(state['live_catalog'][0]['category'],'Noticias')
            bad=hub.tv('127.0.0.3',{'live_edits':[{'op':'bad','action':'restore','id':'capital21'}]})
            self.assertIn('live_edit_error',bad);self.assertEqual(bad['live_edit_ack'],['bad'])
