import hashlib
from io import BytesIO
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from zipfile import ZipFile
import restaurar_estable_mac as rollback


class StableRestoreTests(unittest.TestCase):
    def archive(self):
        data=BytesIO()
        with ZipFile(data,'w') as z:z.writestr('AlmaTV-11.0.3/instalar_mac.py',b'print("estable")')
        return data.getvalue()

    def test_verified_cache_survives_and_restore_runs_only_stable_installer(self):
        raw=self.archive()
        with tempfile.TemporaryDirectory() as tmp, patch.object(rollback,'STABLE_SHA256',hashlib.sha256(raw).hexdigest()):
            opener=Mock(return_value=BytesIO(raw));archive=rollback.cache_stable(tmp,opener)
            self.assertEqual(archive.read_bytes(),raw)
            self.assertEqual(rollback.cache_stable(tmp,Mock(side_effect=AssertionError('No debe descargar'))),archive)
            self.assertTrue((Path(tmp)/'restaurar_estable_mac.py').exists())
            def run(command,check):
                self.assertTrue(check);self.assertEqual(Path(command[1]).read_bytes(),b'print("estable")')
            with patch.object(rollback.subprocess,'run',side_effect=run) as execute:
                rollback.restore_stable(tmp);self.assertEqual(execute.call_count,1)
            self.assertEqual(archive.read_bytes(),raw)

    def test_invalid_download_is_rejected_and_no_archive_is_installed(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError,'SHA-256'):
                rollback.cache_stable(tmp,Mock(return_value=BytesIO(b'corrupto')))
            self.assertEqual(list(Path(tmp).glob('*.zip')),[])
            self.assertEqual(list(Path(tmp).glob('*.download')),[])
