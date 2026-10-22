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
