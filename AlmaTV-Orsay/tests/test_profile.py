import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import perfil_widget


class ProfileTests(unittest.TestCase):
    def make_widget(self, root):
        (root / 'servidor/Widget').mkdir(parents=True)
        archive = root / 'servidor/Widget/AlmaTV86_11.0.1.zip'
        with ZipFile(archive, 'w', ZIP_DEFLATED) as z:
            z.writestr('main.js', 'var keepPlayback = true;')
            z.writestr('assets/profile.js', 'var AlmaProfile={image:""};')
        (root / 'servidor/manifest.json').write_text(json.dumps({'archive': archive.name, 'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}))
        (root / 'servidor/widgetlist.xml').write_text('<rsp><list><widget><compression size="0"/></widget></list></rsp>')
        return archive

    def test_photo_is_exact_local_and_survives_another_installer(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            archive = self.make_widget(base / 'first')
            photo = ROOT / 'app/assets/logos/livetv.png'
            original = photo.read_bytes()
            cache = base / 'cache'
            self.assertTrue(perfil_widget.personalize(base / 'first', photo, cache))
            with ZipFile(archive) as z:
                self.assertEqual(z.read('assets/profile-photo.png'), original)
                self.assertEqual(z.read('main.js'), b'var keepPlayback = true;')
                self.assertIn(b'assets/profile-photo.png', z.read('assets/profile.js'))
            manifest = json.loads((base / 'first/servidor/manifest.json').read_text())
            self.assertEqual(manifest['sha256'], hashlib.sha256(archive.read_bytes()).hexdigest())
            second = self.make_widget(base / 'second')
            self.assertTrue(perfil_widget.personalize(base / 'second', cache=cache))
            with ZipFile(second) as z:
                self.assertEqual(z.read('assets/profile-photo.png'), original)
            self.assertEqual(photo.read_bytes(), original)

    def test_missing_photo_keeps_template_and_bad_photo_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            archive = self.make_widget(root)
            original = archive.read_bytes()
            self.assertFalse(perfil_widget.personalize(root, cache=root / 'missing'))
            photo = root / 'not-a-photo.png'
            photo.write_bytes(b'not an image')
            with self.assertRaises(ValueError):
                perfil_widget.personalize(root, photo, root / 'cache')
            self.assertEqual(archive.read_bytes(), original)
