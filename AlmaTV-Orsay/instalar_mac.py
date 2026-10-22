#!/usr/bin/env python3
"""Native macOS dialogs for installing the LAN bridge and a ten-minute installer."""
from pathlib import Path
import hashlib
import json
import plistlib
import shlex
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen
from xml.etree import ElementTree as ET
from zipfile import ZipFile
from preparar import private_ipv4
ROOT=Path(__file__).resolve().parent

def osa(script,*args):
    result=subprocess.run(['osascript','-e',script,*map(str,args)],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    return result.stdout.strip()

def alert(title,text):
    return osa('on run argv\ndisplay dialog (item 2 of argv) with title (item 1 of argv) buttons {"Aceptar"} default button 1\nend run',title,text)

def admin(command):
    return osa('on run argv\ndo shell script (item 1 of argv) with administrator privileges\nend run',command)

def main():
    if sys.platform!='darwin':raise ValueError('Este instalador se abre en macOS.')
    selection=osa('choose from list {"Instalar o actualizar Alma TV 9", "Recuperar Alma TV 8.7", "Detener instalador Wi-Fi", "Abrir centro de control"} with title "Alma TV" with prompt "Elige una acción" default items {"Instalar o actualizar Alma TV 9"}')
    if selection=='false':return
    home=Path.home();saved=home/'Library/Application Support/AlmaTV/installer-settings.json'
    settings=json.loads(saved.read_text()) if saved.exists() else {'tv':'192.168.1.249','mac':'192.168.1.30'}
    if selection=='Abrir centro de control':subprocess.run(['open','http://'+private_ipv4(settings['mac'])+':8088/control'],check=True);return
    if selection=='Detener instalador Wi-Fi':admin('/bin/launchctl bootout system/local.almatv.instalador >/dev/null 2>&1 || true');alert('Alma TV','Instalador detenido. El puente multimedia sigue funcionando.');return
    answer=osa('on run argv\nreturn text returned of (display dialog "IP de la televisión Samsung" default answer (item 1 of argv) with title "Alma TV")\nend run',settings['tv'])
    tv=private_ipv4(answer.strip())
    with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as route:
        route.connect((tv,9));mac=private_ipv4(route.getsockname()[0])
    subprocess.run([sys.executable,str(ROOT/'configurar_puente_mac.py'),'--bind',mac,'--tv',tv],check=True)
    saved.parent.mkdir(parents=True,exist_ok=True);saved.write_text(json.dumps({'tv':tv,'mac':mac}))
    source=ROOT/'servidor'
    if selection=='Recuperar Alma TV 8.7':source=ROOT/'respaldo/8.7.0'
    manifest=json.loads((source/'manifest.json').read_text());archive=source/'Widget'/manifest['archive']
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=manifest['sha256']:raise ValueError('El paquete no coincide con su huella de integridad. Descarga otra copia.')
    with ZipFile(archive) as package:
        if package.testzip():raise ValueError('El archivo está dañado.')
    catalogue=ET.parse(source/'widgetlist.xml');catalogue.find('.//download').text='http://'+mac+'/Widget/'+archive.name
    destination='/Library/Application Support/AlmaTV Installer'
    with tempfile.TemporaryDirectory() as temp:
        folder=Path(temp);catalogue.write(folder/'widgetlist.xml',encoding='utf-8',xml_declaration=True)
        daemon={'Label':'local.almatv.instalador','ProgramArguments':['/usr/bin/python3',destination+'/servir.py','--bind',mac,'--duration','600'],'RunAtLoad':True,'KeepAlive':False,'StandardOutPath':destination+'/installer.log','StandardErrorPath':destination+'/installer-errors.log'}
        with (folder/'installer.plist').open('wb') as output:plistlib.dump(daemon,output)
        files=[(ROOT/'servir.py','servir.py'),(ROOT/'preparar.py','preparar.py'),(folder/'widgetlist.xml','servidor/widgetlist.xml'),(source/'manifest.json','servidor/manifest.json'),(archive,'servidor/Widget/'+archive.name),(folder/'installer.plist','installer.plist')]
        commands=['/bin/launchctl bootout system/local.almatv.instalador >/dev/null 2>&1 || true','/bin/mkdir -p '+shlex.quote(destination+'/servidor/Widget')]
        for original,name in files:commands.append('/usr/bin/install -m 0644 '+shlex.quote(str(original))+' '+shlex.quote(destination+'/'+name))
        commands.append('/bin/launchctl bootstrap system '+shlex.quote(destination+'/installer.plist'))
        admin(' && '.join(commands))
    reachable=False
    for attempt in range(10):
        try:
            with urlopen('http://'+mac+'/widgetlist.xml',timeout=1) as response:served=ET.fromstring(response.read(65536)).findtext('.//download')
            if served and served.endswith('/'+archive.name):reachable=True;break
        except Exception:pass
        time.sleep(0.2)
    if not reachable:raise ValueError('El instalador nuevo no respondió. Si otro instalador sigue abierto en Terminal, pulsa Control+C allí y vuelve a intentarlo.')
    alert('Alma TV '+manifest['version'],'El instalador Wi-Fi estará disponible durante 10 minutos.\n\nEn la TV configura la IP '+mac+' y sincroniza aplicaciones. Abre Alma TV '+manifest['version']+'.\n\nLa Mac debe seguir encendida. Si el puerto 80 está ocupado por el instalador anterior, detenlo primero con Control+C. El puente ya funciona en segundo plano.')
    subprocess.run(['open','http://'+mac+':8088/control'],check=True)

if __name__=='__main__':
    try:main()
    except subprocess.CalledProcessError as error:
        if 'User canceled' not in str(error.stderr):alert('No se pudo completar la instalación',str(error.stderr or error)[:1200])
    except Exception as error:
        if sys.platform=='darwin':alert('No se pudo completar la instalación',str(error)[:1200])
        else:raise
