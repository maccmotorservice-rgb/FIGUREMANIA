#!/usr/bin/env python3
"""Empaqueta el instalador compacto y un asistente macOS sin firma."""
from pathlib import Path
import hashlib
import json
import plistlib
import shutil
import tempfile
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED
ROOT=Path(__file__).resolve().parent
FILES=('perfil_widget.py','iptv.py','tv_channels.json','puente.py','preparar.py','servir.py','configurar_puente_mac.py','instalar_mac.py','youtube_player.html','dailymotion_player.html','youtube_library.py','link_panel.html','hub.py','hub_http.py','hub_panel.html','importar_salvapantallas.py','app/assets/qrcode.js','app/assets/QR-LICENSE.txt','app/assets/salvapantallas.png') + tuple(str(path.relative_to(ROOT)) for path in sorted((ROOT/'app/assets/icons').glob('*.png')))
def build():
    manifest=json.loads((ROOT/'servidor/manifest.json').read_text());version=manifest['version']
    result=ROOT/'instaladores'/('AlmaTV-'+version+'-instalador.zip')
    with tempfile.TemporaryDirectory() as temp:
        folder=Path(temp)/('AlmaTV-'+version);folder.mkdir()
        for name in FILES:
            target=folder/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,target)
        (folder/'servidor/Widget').mkdir(parents=True)
        for name in ('manifest.json','widgetlist.xml','Widget/'+manifest['archive']):shutil.copy2(ROOT/'servidor'/name,folder/'servidor'/name)
        archive=ROOT/'servidor/Widget/AlmaTV86_8.7.0.zip'
        backup=folder/'respaldo/8.7.0';(backup/'Widget').mkdir(parents=True);shutil.copy2(archive,backup/'Widget'/archive.name)
        old={'id':'AlmaTV86','version':'8.7.0','archive':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
        (backup/'manifest.json').write_text(json.dumps(old))
        tree=ET.parse(folder/'servidor/widgetlist.xml');widget=tree.find('.//widget');widget.find('title').text='Alma TV 8.7.0';widget.find('compression').set('size',str(old['bytes']));widget.find('download').text='http://192.168.1.30/Widget/'+archive.name;tree.write(backup/'widgetlist.xml',encoding='utf-8',xml_declaration=True)
        (folder/'LEEME.txt').write_text('Alma TV '+version+'\nAbre Instalar Alma TV.app en macOS. Requiere Python 3.8 o posterior.\nAsistente sin firma ni notarización: validación física pendiente.\nSi el instalador anterior sigue abierto, detenlo con Control+C antes de instalar.\nEl puente queda en segundo plano; la Mac debe permanecer encendida y despierta.\nControl desde el celular en http://192.168.1.30:8088/control\nVolumen del panel: solo audio de Alma TV, no volumen general de la TV.\n')
        app=folder/'Instalar Alma TV.app/Contents';resources=app/'Resources';resources.mkdir(parents=True)
        for source in list(folder.iterdir()):
            if source.name.endswith('.app'):continue
            if source.is_dir():shutil.copytree(source,resources/source.name)
            else:shutil.copy2(source,resources/source.name)
        (app/'MacOS').mkdir()
        launcher=app/'MacOS/AlmaTV';launcher.write_text('#!/bin/sh\nALMA_RESOURCES="$(dirname "$0")/../Resources"\nexec /usr/bin/python3 "$ALMA_RESOURCES/instalar_mac.py"\n');launcher.chmod(0o755)
        with (app/'Info.plist').open('wb') as output:plistlib.dump({'CFBundleExecutable':'AlmaTV','CFBundleIdentifier':'local.almatv.instalador','CFBundleName':'Instalar Alma TV','CFBundlePackageType':'APPL','CFBundleShortVersionString':version,'CFBundleVersion':version,'LSUIElement':True},output)
        with ZipFile(result,'w',ZIP_DEFLATED) as package:
            for path in sorted(folder.rglob('*')):
                if path.is_file():package.write(path,path.relative_to(folder.parent))
        with ZipFile(result) as package:
            if package.testzip():raise ValueError('Instalador dañado')
    print(result)
    return result
if __name__=='__main__':build()
