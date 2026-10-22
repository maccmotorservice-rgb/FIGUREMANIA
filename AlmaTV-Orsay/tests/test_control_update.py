from pathlib import Path
import tempfile
import unittest
from actualizar_control_mac import install
ROOT=Path(__file__).resolve().parents[1]

class ControlUpdateTests(unittest.TestCase):
    def test_update_keeps_data_and_first_backup_and_never_touches_widget(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);panel=root/'hub_panel.html';panel.write_text('Página anterior')
            (root/'iptv.py').write_text('def edit(self,data):pass')
            (root/'hub.json').write_text('biblioteca');(root/'iptv.json').write_text('mis favoritos')
            source=ROOT/'hub_panel.html';install(source,root)
            self.assertEqual(panel.read_bytes(),source.read_bytes())
            self.assertEqual((root/'hub_panel.antes-guia.html').read_text(),'Página anterior')
            install(source,root)
            self.assertEqual((root/'hub_panel.antes-guia.html').read_text(),'Página anterior')
            self.assertEqual((root/'iptv.json').read_text(),'mis favoritos');self.assertEqual((root/'hub.json').read_text(),'biblioteca')
            self.assertEqual({p.name for p in root.iterdir()},{'hub_panel.html','hub_panel.antes-guia.html','iptv.py','hub.json','iptv.json'})
    def test_old_or_missing_bridge_and_invalid_update_leave_panel_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=ROOT/'hub_panel.html'
            with self.assertRaises(ValueError):install(source,root)
            (root/'hub_panel.html').write_text('Anterior');(root/'iptv.py').write_text('puente anterior')
            with self.assertRaises(ValueError):install(source,root)
            self.assertEqual((root/'hub_panel.html').read_text(),'Anterior')
            (root/'iptv.py').write_text('def edit(self,data):pass');bad=root/'bad.html';bad.write_text('No es el panel')
            with self.assertRaises(ValueError):install(bad,root)
            self.assertEqual((root/'hub_panel.html').read_text(),'Anterior')
