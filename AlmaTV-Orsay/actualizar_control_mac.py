#!/usr/bin/env python3
"""Actualiza solo el panel web de Alma TV, sin reiniciar el puente ni la TV."""
from pathlib import Path
import os
import shutil
import sys
import tempfile

VERSION = '10.3.1'

def install(source, directory):
    source=Path(source);directory=Path(directory)
    destination=directory/'hub_panel.html'
    if not destination.is_file() or destination.is_symlink() or not (directory/'iptv.py').is_file():
        raise ValueError('No se encontró el puente instalado. Instala primero Alma TV 10.3.0.')
    if 'def edit(self,data)' not in (directory/'iptv.py').read_text(encoding='utf-8'):
        raise ValueError('Esta guía necesita el puente de Alma TV 10.3.0 para usar tus categorías.')
    content=source.read_bytes()
    if b'content="10.3.1"' not in content or b'id="tv-guide"' not in content:
        raise ValueError('La actualización del control no es válida.')
    backup=directory/'hub_panel.antes-guia.html'
    if not backup.exists():shutil.copy2(destination,backup)
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(dir=str(directory),prefix='.alma-control-',suffix='.tmp',delete=False) as output:
            temporary=Path(output.name);output.write(content);output.flush();os.fsync(output.fileno())
        os.chmod(str(temporary),0o644);temporary.replace(destination)
    finally:
        if temporary and temporary.exists():temporary.unlink()
    return destination

def main():
    if sys.platform!='darwin':raise SystemExit('Ejecuta este actualizador en tu Mac, sin sudo.')
    try:install(Path(__file__).resolve().parent/'hub_panel.html',Path.home()/'Library/Application Support/AlmaTV')
    except (ValueError,OSError) as error:raise SystemExit(str(error))
    print('Control web '+VERSION+' actualizado. No necesitas sincronizar ni reiniciar la TV.')
    print('Recarga http://192.168.1.30:8088/control en tu celular o laptop. Puedes cerrar Terminal.')

if __name__=='__main__':main()
