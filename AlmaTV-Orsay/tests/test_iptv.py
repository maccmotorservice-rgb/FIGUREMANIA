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

    def test_guide_filters_all_imported_lists_not_only_tv_catalogue_and_pins_remote_selection(self):
        raw=('#EXTM3U\n'+''.join('#EXTINF:-1 tvg-country="MX",Primera %d\nhttps://example.org/%d.m3u8\n'%(i,i) for i in range(530))).encode()
        second=b'#EXTM3U\n#EXTINF:-1 tvg-country="MX",Compartido\nhttps://example.org/0.m3u8\n#EXTINF:-1 tvg-country="US",Exclusivo segunda\nhttps://example.org/second.m3u8\n'
        with tempfile.TemporaryDirectory() as tmp:
            hub=Hub(tmp,'127.0.0.3');lib=hub.iptv
            for url,content in [('https://example.org/primera.m3u',raw),('https://example.org/segunda.m3u',second)]:lib.mutate({'action':'import','url':url},lambda *a,raw=content,**k:response(raw))
            self.assertEqual(len(lib.catalog),504);before=lib.revision
            all_channels=lib.guide();self.assertEqual(all_channels['total'],535);self.assertEqual(len(all_channels['channels']),20)
            first,second_list=all_channels['lists'];self.assertEqual((first['count'],second_list['count']),(530,2))
            result=lib.guide(source=second_list['id']);self.assertEqual(result['total'],2);self.assertEqual(lib.revision,before,'Browsing must not replace the TV catalogue')
            selected=next(c for c in result['channels'] if c['name']=='Exclusivo segunda');self.assertNotIn('url',selected)
            self.assertFalse(any(c['id']==selected['id'] for c in lib.catalog))
            hub.mutate({'action':'control','command':'live-channel','view':selected['id']},'owner','127.0.0.3')
            packet=hub.tv('127.0.0.3',{'live_revision':before});self.assertTrue(any(c['id']==selected['id'] for c in packet['live_catalog']));self.assertEqual(len(packet['live_catalog']),504)
            lib.edit({'action':'favorite','id':selected['id'],'enabled':True,'category':'Noticias'})
            self.assertEqual(lib.guide(source=second_list['id'],category='category:Noticias')['total'],1)
            self.assertEqual(lib.guide(source=first['id'],category='category:Noticias')['total'],0)
            lib.edit({'action':'delete-channel','id':selected['id']});self.assertEqual(lib.guide(source=second_list['id'])['total'],1)
            lib.mutate({'action':'refresh','url':'https://example.org/segunda.m3u'},lambda *a,**k:response(second));self.assertEqual(lib.guide(source=second_list['id'])['total'],1)
            lib.mutate({'action':'remove','url':'https://example.org/segunda.m3u'},None);self.assertEqual(lib.guide(source=second_list['id'])['source'],'all')

    def test_rapid_channel_choices_keep_latest_command_and_refreshed_recent_metadata(self):
        raw=('#EXTM3U\n'+''.join('#EXTINF:-1 tvg-country="US",Canal %d\nhttps://example.org/zap%d.m3u8\n'%(i,i) for i in range(12))).encode()
        with tempfile.TemporaryDirectory() as tmp:
            hub=Hub(tmp,'127.0.0.3');lib=hub.iptv;lib.mutate({'action':'import','url':'https://example.org/list'},lambda *a,**k:response(raw))
            for channel in lib.guide()['channels'][4:]:hub.mutate({'action':'control','command':'live-channel','view':channel['id']},'owner','127.0.0.3')
            commands=hub.tv('127.0.0.3')['commands'];self.assertEqual(len(commands),1);selected=commands[0]['view'];self.assertTrue(any(c['id']==selected for c in lib.catalog))
            lib.mutate({'action':'refresh','url':'https://example.org/list'},lambda *a,**k:response(raw.replace(b'Canal 11',b'Nuevo nombre')))
            self.assertEqual(next(c for c in lib.catalog if c['id']==selected)['name'],'Nuevo nombre')

    def test_headerless_channel_entries_import_and_embedded_headers_do_not_break_list(self):
        raw=b'#EXTINF:-1 tvg-name="Uno" group-title="Noticias",Uno\nhttps://example.org/one.m3u8\n#EXTM3U\n#EXTINF:0,Dos\nhttps://example.org/two.m3u8\n'
        channels,skipped=parse_m3u(raw,'https://example.org/TELEVISION2')
        self.assertEqual([c['name'] for c in channels],['Uno','Dos']);self.assertEqual(skipped,0)
        for manifest in (b'#EXTINF:6.0,\nhttps://example.org/segment.ts',b'#EXTINF:-1,Uno\nhttps://example.org/a.ts\n#EXT-X-MEDIA-SEQUENCE:1',b'<html>Una lista #EXTINF:-1</html>'):
            with self.assertRaises(ValueError):parse_m3u(manifest,'https://example.org/list')

    def test_larger_download_budget_and_separate_limits_preserve_previous_list(self):
        from unittest.mock import patch
        import iptv
        self.assertEqual(iptv.MAX_BYTES,64*1024*1024);self.assertEqual(iptv.DOWNLOAD_TIMEOUT,180);self.assertEqual(iptv.MAX_CHANNELS,200000)
        with tempfile.TemporaryDirectory() as tmp:
            lib=IPTV(Path(tmp)/'iptv.json',[]);url='https://example.org/list'
            lib.mutate({'action':'import','url':url},lambda *a,**k:response());previous=lib.path.read_bytes();revision=lib.revision
            for reason in ('size','time'):
                conn,res=response();opener=lambda *a,**k:(conn,res)
                if reason=='size':
                    with patch('iptv.MAX_BYTES',16):
                        with self.assertRaisesRegex(ValueError,'64 MB'):lib.mutate({'action':'refresh','url':url},opener)
                else:
                    with patch('iptv.time.monotonic',side_effect=[0,0,181]):
                        with self.assertRaisesRegex(ValueError,'3 minutos'):lib.mutate({'action':'refresh','url':url},opener)
                self.assertEqual(lib.path.read_bytes(),previous);self.assertEqual(lib.revision,revision);self.assertTrue(res.closed);conn.close.assert_called_once()
            # More than the previous one-minute deadline still succeeds.
            with patch('iptv.time.monotonic',side_effect=[0,0,70,80,90]):lib.mutate({'action':'refresh','url':url},lambda *a,**k:response())
    def test_content_length_and_entry_limit_have_specific_errors(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            conn,res=response();res.getheader=lambda name,default=None:str(65*1024*1024) if name=='Content-Length' else default
            with self.assertRaisesRegex(ValueError,'64 MB'):IPTV(Path(tmp)/'iptv.json',[]).mutate({'action':'import','url':'https://example.org/list'},lambda *a,**k:(conn,res))
            self.assertTrue(res.closed);conn.close.assert_called_once()
        raw=b'#EXTM3U\n#EXTINF:-1,Uno\nhttps://example.org/1.m3u8\n#EXTINF:-1,Dos\nhttps://example.org/2.m3u8\n'
        with patch('iptv.MAX_CHANNELS',1):
            with self.assertRaisesRegex(ValueError,'200 000 entradas'):parse_m3u(raw,'https://example.org/list')


class DisabledListTests(unittest.TestCase):
    def test_disable_retains_favorite_category_and_reenable_needs_no_download(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'iptv.json';lib=IPTV(path,[]);url='https://example.org/list.m3u'
            lib.mutate({'action':'import','url':url},lambda *a,**k:response())
            lib.mutate({'action':'publish','country':'','search':''},None)
            favorite,other=lib.data['sources'][0]['channels']
            lib.edit({'action':'favorite','id':favorite['id'],'enabled':True,'category':'Noticias'})
            lib.ensure_channel(other['id'])
            result=lib.mutate({'action':'set-enabled','url':url,'enabled':False},None)
            self.assertEqual(result['matched'],0)
            self.assertEqual([c['id'] for c in lib.catalog],[favorite['id']])
            self.assertTrue(lib.catalog[0]['favorite']);self.assertEqual(lib.catalog[0]['category'],'Noticias')
            self.assertEqual(lib.guide()['total'],1);self.assertEqual(lib.guide()['lists'],[])
            self.assertEqual(lib.resolve_channel(favorite['id'])['id'],favorite['id'])
            self.assertEqual(IPTV(path,[]).catalog,lib.catalog)
            lib.mutate({'action':'set-enabled','url':url,'enabled':True},None)
            self.assertEqual(len(lib.catalog),2);self.assertEqual(lib.data['favorites'][favorite['id']]['category'],'Noticias')
            lib.mutate({'action':'set-enabled','url':url,'enabled':False},None)
            lib.edit({'action':'favorite','id':favorite['id'],'enabled':False})
            self.assertEqual(lib.catalog,[]);self.assertEqual(lib.guide()['total'],0)

    def test_refresh_does_not_reactivate_and_shared_active_channel_survives(self):
        with tempfile.TemporaryDirectory() as tmp:
            lib=IPTV(Path(tmp)/'iptv.json',[]);first='https://example.org/one';second='https://example.org/two'
            for url in (first,second):lib.mutate({'action':'import','url':url},lambda *a,**k:response())
            lib.mutate({'action':'publish','country':'','search':''},None)
            lib.mutate({'action':'set-enabled','url':first,'enabled':False},None)
            self.assertEqual(len(lib.catalog),2)
            lib.mutate({'action':'refresh','url':first},lambda *a,**k:response())
            self.assertFalse(lib.info()['sources'][0]['enabled']);self.assertEqual(len(lib.guide()['lists']),1)
            lib.mutate({'action':'set-enabled','url':second,'enabled':False},None)
            self.assertEqual(lib.catalog,[])
            with self.assertRaises(ValueError):lib.mutate({'action':'set-enabled','url':first,'enabled':'false'},None)

    def test_connection_timeout_preserves_prior_list_and_uses_playlist_budget(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'iptv.json';lib=IPTV(path,[]);url='https://example.org/list'
            lib.mutate({'action':'import','url':url},lambda *a,**k:response());before=path.read_bytes()
            opener=Mock(side_effect=TimeoutError('timed out'))
            with self.assertRaisesRegex(ValueError,'cabeceras'):
                lib.mutate({'action':'refresh','url':url},opener)
            self.assertEqual(path.read_bytes(),before);self.assertEqual(opener.call_args.kwargs['timeout'],60)

class ManualChannelTests(unittest.TestCase):
    def test_manual_channels_are_persistent_independent_of_filters_and_lists(self):
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/'iptv.json';lib=IPTV(file,[])
            no_network=Mock(side_effect=AssertionError('No debe descargar la señal'))
            ident=lib.mutate({'action':'manual-add','name':'Mi canal','url':'https://streams.example.org/one.m3u8','category':'Noticias'},no_network)['id']
            self.assertEqual(lib.guide(source='manual')['lists'][0]['name'],'Lista de agregados')
            self.assertEqual(lib.guide(source='manual')['channels'][0]['id'],ident)
            self.assertEqual(lib.catalog[0]['region'],'Noticias');self.assertNotIn('url',lib.guide(source='manual')['channels'][0])
            lib.publish('mx','no coincide');self.assertEqual(lib.catalog[0]['id'],ident)
            lib=IPTV(file,[]);self.assertEqual(lib.info()['manual'][0]['id'],ident)
            lib.edit({'action':'favorite','id':ident,'enabled':True,'category':'Noticias'})
            lib.mutate({'action':'manual-update','id':ident,'name':'Nombre nuevo','url':'https://streams.example.org/new.m3u8','category':'Cultura'},no_network)
            self.assertEqual(lib.catalog[0]['name'],'Nombre nuevo');self.assertTrue(lib.catalog[0]['favorite'])
            self.assertEqual(lib.catalog[0]['category'],'Noticias');self.assertEqual(lib.resolve_channel(ident)['url'],'https://streams.example.org/new.m3u8')
            lib.edit({'action':'delete-channel','id':ident});self.assertEqual(lib.guide(source='manual')['total'],0)
            lib.edit({'action':'restore','id':ident});self.assertEqual(lib.guide(source='manual')['total'],1)
            self.assertTrue(lib.catalog[0]['favorite']);no_network.assert_not_called()
    def test_invalid_and_duplicate_manual_input_preserves_existing_catalogue(self):
        with tempfile.TemporaryDirectory() as folder:
            lib=IPTV(Path(folder)/'iptv.json',[]);opener=Mock()
            good={'action':'manual-add','name':'Canal','url':'https://streams.example.org/a.m3u8'}
            lib.mutate(good,opener);before=lib.path.read_bytes()
            for update in [{},{'name':''},{'name':'a\nb'},{'url':'http://127.0.0.1/test.m3u8'},{'url':'javascript:alert(1)'},{'url':'file:///tmp/test'},{'category':'x'*81},{'action':'manual-update','id':'inexistente'}]:
                with self.assertRaises(ValueError):lib.mutate(dict(good,**update),opener)
                self.assertEqual(lib.path.read_bytes(),before)
            self.assertEqual(len(lib.data['manual']),1);opener.assert_not_called()
