import json
from pathlib import Path
import tempfile
import unittest
from hub import Hub
ROOT=Path(__file__).resolve().parents[1]
class LiveTVTests(unittest.TestCase):
    def test_catalogue_matches_offline_widget_and_only_public_https_streams(self):
        channels=json.loads((ROOT/'tv_channels.json').read_text())
        script=(ROOT/'app/live-tv.js').read_text().split('var AlmaLiveTV = ',1)[1].rstrip().rstrip(';')
        self.assertEqual(json.loads(script),channels)
        self.assertEqual(len({c['id'] for c in channels}),4)
        for c in channels:
            self.assertTrue(c['url'].startswith('https://'));self.assertNotIn('192.168.',c['url']);self.assertNotIn('@',c['url'])
            self.assertTrue(c['source'].startswith(('http://','https://')))
    def test_remote_channel_whitelist_and_requested_observed_levels(self):
        with tempfile.TemporaryDirectory() as folder:
            hub=Hub(folder,'127.0.0.3');target='127.0.0.3'
            hub.mutate({'action':'control','command':'live-channel','view':'capital21'},'owner',target)
            cmd=hub.tv(target)['commands'][0];self.assertEqual((cmd['action'],cmd['view']),('live-channel','capital21'))
            with self.assertRaises(ValueError):hub.mutate({'action':'control','command':'live-channel','view':'https://evil.test/'},'owner',target)
            with self.assertRaises(PermissionError):hub.mutate({'action':'control','command':'live-channel','view':'capital21'},'guest',target)
            hub.tv(target,{'telemetry':{'volume':20,'observed_volume':100}})
            result=hub.snapshot(target,'owner');self.assertEqual(result['telemetry']['volume'],20);self.assertEqual(result['telemetry']['observed_volume'],100)
            self.assertEqual(len(result['live_tv']),4)

class AudioTrackControlTests(unittest.TestCase):
    def test_audio_telemetry_is_bounded_and_commands_validate_source_and_track(self):
        with tempfile.TemporaryDirectory() as folder:
            hub=Hub(folder,'127.0.0.3');target='127.0.0.3'
            tracks=[{'id':0,'label':'Inglés'},{'id':1,'label':'Español'},{'id':True,'label':'Inválido'},{'id':17,'label':'Fuera de rango'},{'id':2,'label':'x'*81}]
            hub.tv(target,{'telemetry':{'audio_source':'session-1','audio_tracks':tracks,'audio_selected':-1}})
            self.assertEqual(len(hub.snapshot(target,'owner')['telemetry']['audio_tracks']),2)
            hub.mutate({'action':'control','command':'audio-track','view':'session-1','seconds':1},'owner',target)
            self.assertEqual(hub.tv(target)['commands'][-1]['action'],'audio-track')
            for data in [{'view':'old','seconds':1},{'view':'session-1','seconds':True},{'view':'session-1','seconds':2}]:
                with self.assertRaises(ValueError):hub.mutate(dict(action='control',command='audio-track',**data),'owner',target)
            with self.assertRaises(PermissionError):hub.mutate({'action':'control','command':'audio-track','view':'session-1','seconds':1},'guest',target)
            hub.tv(target,{'telemetry':{'audio_source':'session-2','audio_tracks':[]}})
            self.assertEqual(hub.snapshot(target,'owner')['telemetry']['audio_tracks'],[])
