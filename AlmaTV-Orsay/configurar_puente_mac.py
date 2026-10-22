#!/usr/bin/env python3
"""Instala o retira el puente del usuario actual en launchd (macOS)."""
import argparse
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--remove', action='store_true')
    parser.add_argument('--bind', default='192.168.1.30')
    parser.add_argument('--tv', default='192.168.1.249')
    args = parser.parse_args()
    if sys.platform != 'darwin':
        parser.error('Este asistente se ejecuta en tu Mac, sin sudo.')
    from preparar import private_ipv4
    bind, tv = private_ipv4(args.bind), private_ipv4(args.tv)
    home = Path.home()
    label = 'local.almatv.puente'
    domain = 'gui/' + str(os.getuid())
    plist = home / 'Library/LaunchAgents' / (label + '.plist')
    subprocess.run(['launchctl', 'bootout', domain + '/' + label], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if args.remove:
        if plist.exists():
            plist.unlink()
        print('Inicio automático desactivado. Tus archivos multimedia siguen intactos.')
        return
    target = home / 'Library/Application Support/AlmaTV'
    target.mkdir(parents=True, exist_ok=True)
    for name in ('puente.py', 'preparar.py', 'youtube_player.html', 'youtube_library.py', 'link_panel.html', 'hub.py', 'hub_http.py', 'hub_panel.html', 'app/assets/qrcode.js', 'app/assets/QR-LICENSE.txt', 'importar_salvapantallas.py'):
        (target / name).parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(Path(__file__).resolve().parent / name, target / name)
    media = home / 'Music/AlmaTV'
    media.mkdir(parents=True, exist_ok=True)
    logs = home / 'Library/Logs/AlmaTV'
    logs.mkdir(parents=True, exist_ok=True)
    config = dict(Label=label, ProgramArguments=[sys.executable, str(target / 'puente.py'), '--bind', bind, '--tv', tv, '--media-dir', str(media)], RunAtLoad=True, KeepAlive=True, ThrottleInterval=30, StandardOutPath=str(logs / 'puente.log'), StandardErrorPath=str(logs / 'errores.log'), EnvironmentVariables={'PYTHONUNBUFFERED': '1','PATH':'/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'})
    plist.parent.mkdir(parents=True, exist_ok=True)
    with plist.open('wb') as output:
        plistlib.dump(config, output)
    subprocess.run(['launchctl', 'bootstrap', domain, str(plist)], check=True)
    print('Puente configurado en segundo plano y al iniciar sesión. Ya puedes cerrar Terminal.')
    print('La Mac debe seguir encendida y despierta. Registros: ' + str(logs))


if __name__ == '__main__':
    main()
