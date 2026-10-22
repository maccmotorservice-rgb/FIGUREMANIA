#!/usr/bin/env python3
"""Actualiza control y puente de la Mac sin reinstalar el widget Samsung."""
from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile

VERSION = '10.3.3'
FILES = ('hub_panel.html','hub.py','hub_http.py','iptv.py')

def install(source, directory):
    source=Path(source);directory=Path(directory);destination=directory/'hub_panel.html'
    if not destination.is_file() or destination.is_symlink() or not (directory/'iptv.py').is_file():
        raise ValueError('No se encontró el puente instalado. Instala primero Alma TV 10.3.0.')
    if 'def edit(self,data)' not in (directory/'iptv.py').read_text(encoding='utf-8'):
        raise ValueError('Esta guía necesita el puente de Alma TV 10.3.0 para usar tus categorías.')
    contents={name:(source if name=='hub_panel.html' else source.parent/name).read_bytes() for name in FILES}
    if ('content="'+VERSION+'"').encode() not in contents['hub_panel.html'] or b'id="guide-list"' not in contents['hub_panel.html']:
        raise ValueError('La actualización del control no es válida.')
    if b'def guide(' not in contents['iptv.py'] or b'/hub/guide' not in contents['hub_http.py']:
        raise ValueError('Faltan los archivos del nuevo selector de listas.')
    originals={}
    for name in FILES:
        target=directory/name
        if not target.is_file() or target.is_symlink():raise ValueError('Falta un archivo del puente instalado: '+name)
        originals[name]=target.read_bytes()
    installed=[]
    with tempfile.TemporaryDirectory(dir=str(directory),prefix='.alma-control-') as temporary:
        staging=Path(temporary)
        for name,content in contents.items():
            target=staging/name;target.write_bytes(content);target.chmod(0o644)
        for name in FILES:
            target=directory/name;backup=directory/('hub_panel.antes-guia.html' if name=='hub_panel.html' else name+'.antes-listas')
            if not backup.exists():shutil.copy2(target,backup)
        try:
            for name in FILES:(staging/name).replace(directory/name);installed.append(name)
        except OSError:
            for name in reversed(installed):
                rollback=staging/('rollback-'+name);rollback.write_bytes(originals[name]);rollback.chmod(0o644);rollback.replace(directory/name)
            raise
    return destination

def main():
    if sys.platform!='darwin':raise SystemExit('Ejecuta este actualizador en tu Mac, sin sudo.')
    if not (Path.home()/'Library/LaunchAgents/local.almatv.puente.plist').is_file():
        raise SystemExit('No se encontró el inicio automático del puente. Configura primero el puente de Alma TV 10.3.0.')
    try:install(Path(__file__).resolve().parent/'hub_panel.html',Path.home()/'Library/Application Support/AlmaTV')
    except (ValueError,OSError) as error:raise SystemExit(str(error))
    try:subprocess.run(['launchctl','kickstart','-k','gui/'+str(os.getuid())+'/local.almatv.puente'],check=True)
    except subprocess.CalledProcessError:raise SystemExit('Archivos actualizados, pero no se pudo reiniciar el puente. Reinicia sesión en la Mac para iniciarlo y recarga el control.')
    print('Control web '+VERSION+' y puente actualizados. No necesitas sincronizar ni reiniciar la TV.')
    print('El puente se reinició; puede tardar unos segundos en responder. Recarga http://192.168.1.30:8088/control. Puedes cerrar Terminal.')

if __name__=='__main__':main()
