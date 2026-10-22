from pathlib import Path
import tempfile
import unittest
from actualizar_control_mac import install
ROOT=Path(__file__).resolve().parents[1]

class ControlUpdateTests(unittest.TestCase):
    def test_update_keeps_data_and_first_backup_and_never_touches_widget(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);panel=root/'hub_panel.html';panel.write_text('Página anterior')
            (root/'iptv.py').write_text('def edit(self,data):pass');(root/'hub.py').write_text('puente anterior');(root/'hub_http.py').write_text('rutas anteriores')
            (root/'hub.json').write_text('biblioteca');(root/'iptv.json').write_text('mis favoritos')
            source=ROOT/'hub_panel.html';install(source,root)
            self.assertEqual(panel.read_bytes(),source.read_bytes())
            self.assertEqual((root/'hub_panel.antes-guia.html').read_text(),'Página anterior')
            install(source,root)
            self.assertEqual((root/'hub_panel.antes-guia.html').read_text(),'Página anterior')
            self.assertEqual((root/'iptv.json').read_text(),'mis favoritos');self.assertEqual((root/'hub.json').read_text(),'biblioteca')
            self.assertEqual({p.name for p in root.iterdir()},{'hub_panel.html','hub_panel.antes-guia.html','iptv.py','hub.py','hub_http.py','iptv.py.antes-listas','hub.py.antes-listas','hub_http.py.antes-listas','hub.json','iptv.json'})
    def test_old_or_missing_bridge_and_invalid_update_leave_panel_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=ROOT/'hub_panel.html'
            with self.assertRaises(ValueError):install(source,root)
            (root/'hub_panel.html').write_text('Anterior');(root/'iptv.py').write_text('puente anterior')
            with self.assertRaises(ValueError):install(source,root)
            self.assertEqual((root/'hub_panel.html').read_text(),'Anterior')
            (root/'iptv.py').write_text('def edit(self,data):pass');(root/'hub.py').write_text('puente anterior');(root/'hub_http.py').write_text('rutas anteriores');bad=root/'bad.html';bad.write_text('No es el panel')
            with self.assertRaises((ValueError,OSError)):install(bad,root)
            self.assertEqual((root/'hub_panel.html').read_text(),'Anterior')
    def test_failed_module_replacement_restores_previous_files(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);originals={'hub_panel.html':'Página anterior','iptv.py':'def edit(self,data):pass','hub.py':'Módulo anterior','hub_http.py':'Rutas anteriores'}
            for name,text in originals.items():(root/name).write_text(text)
            replace=Path.replace;failed=[False]
            def flaky(path,target):
                if path.name=='hub_http.py' and not failed[0]:failed[0]=True;raise OSError('Simulación de fallo al reemplazar')
                return replace(path,target)
            with patch.object(Path,'replace',flaky):
                with self.assertRaises(OSError):install(ROOT/'hub_panel.html',root)
            for name,text in originals.items():self.assertEqual((root/name).read_text(),text)
    def test_mac_main_restarts_only_installed_bridge_after_updating(self):
        from unittest.mock import patch
        import actualizar_control_mac
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp);root=home/'Library/Application Support/AlmaTV';root.mkdir(parents=True)
            for name,text in {'hub_panel.html':'Anterior','iptv.py':'def edit(self,data):pass','hub.py':'Anterior','hub_http.py':'Anterior'}.items():(root/name).write_text(text)
            agent=home/'Library/LaunchAgents/local.almatv.puente.plist';agent.parent.mkdir(parents=True);agent.write_text('Agente instalado')
            with patch('actualizar_control_mac.sys.platform','darwin'),patch('actualizar_control_mac.Path.home',return_value=home),patch('actualizar_control_mac.subprocess.run') as run:
                actualizar_control_mac.main()
                self.assertEqual(run.call_count,1);command=run.call_args[0][0];self.assertEqual(command[:3],['launchctl','kickstart','-k']);self.assertTrue(command[3].endswith('/local.almatv.puente'))
            self.assertEqual((root/'iptv.py').read_bytes(),(ROOT/'iptv.py').read_bytes())
