#!/usr/bin/env python3
"""Respaldo verificado y restauración de Alma TV 11.0.3, solo en la Mac."""
from pathlib import Path
import hashlib
import shutil
import subprocess
import sys
import tempfile
from urllib.request import urlopen
from zipfile import ZipFile

STABLE_VERSION = '11.0.3'
STABLE_URL = 'https://raw.githubusercontent.com/maccmotorservice-rgb/FIGUREMANIA/4e1f373a80a8d257d5968188526eca56cca2f4d1/AlmaTV-Orsay/instaladores/AlmaTV-11.0.3-instalador.zip'
STABLE_SHA256 = 'fa00f93c5c3ab7e5fb7d7087d2c580fbf871f7f5ebe76a69d3acf02027098576'


def cache_stable(directory=None, opener=None):
    directory = Path(directory) if directory else Path.home() / 'Library/Application Support/AlmaTV/rollback'
    directory.mkdir(parents=True, exist_ok=True)
    archive = directory / ('AlmaTV-' + STABLE_VERSION + '-instalador.zip')
    if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest() != STABLE_SHA256:
        temporary = archive.with_suffix('.download')
        try:
            size = 0
            with (opener or urlopen)(STABLE_URL, timeout=30) as response, temporary.open('wb') as output:
                while True:
                    data = response.read(65536)
                    if not data:
                        break
                    size += len(data)
                    if size > 32 * 1024 * 1024:
                        raise ValueError('El respaldo excede el tamaño esperado.')
                    output.write(data)
            if hashlib.sha256(temporary.read_bytes()).hexdigest() != STABLE_SHA256:
                raise ValueError('El respaldo estable no coincide con su SHA-256. No se instalará la prueba.')
            with ZipFile(temporary) as package:
                if package.testzip():
                    raise ValueError('El respaldo estable está dañado.')
            temporary.replace(archive)
        finally:
            if temporary.exists():
                temporary.unlink()
    helper = directory / 'restaurar_estable_mac.py'
    if helper.resolve() != Path(__file__).resolve():
        shutil.copy2(Path(__file__), helper)
    return archive


def restore_stable(directory=None):
    archive = cache_stable(directory)
    with tempfile.TemporaryDirectory(prefix='alma-estable-') as temporary:
        root = Path(temporary)
        with ZipFile(archive) as package:
            for name in package.namelist():
                target = (root / name).resolve()
                if root.resolve() not in target.parents:
                    raise ValueError('Ruta no válida en el respaldo.')
            package.extractall(root)
        installer = root / ('AlmaTV-' + STABLE_VERSION) / 'instalar_mac.py'
        subprocess.run([sys.executable, str(installer)], check=True)


if __name__ == '__main__':
    if sys.platform != 'darwin':
        raise SystemExit('Este asistente se ejecuta en tu Mac.')
    if '--prepare' in sys.argv:
        print('Respaldo estable verificado: ' + str(cache_stable()))
    else:
        restore_stable()
