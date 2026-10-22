#!/usr/bin/env python3
"""Paquete pequeño para actualizar la guía web sin cambiar el widget Samsung."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from actualizar_control_mac import VERSION
ROOT=Path(__file__).resolve().parent

def build():
    folder='AlmaTV-Control-'+VERSION
    target=ROOT/'instaladores'/(folder+'.zip')
    files={name:(ROOT/name).read_bytes() for name in ('hub_panel.html','actualizar_control_mac.py')}
    files['LEEME.txt']=('Alma TV · Control web '+VERSION+'\nRequiere el puente de Alma TV 10.3.0 instalado.\nEjecuta python3 actualizar_control_mac.py sin sudo y recarga /control.\nNo reinicia servicios ni modifica el widget Samsung, listas, favoritos o archivos multimedia.\nGuía de TV: navegar por categorías y elegir canales.\nImportar canales: listas, búsqueda, favoritos, categorías y eliminación.\nSe conserva hub_panel.antes-guia.html como respaldo de la página anterior.\n').encode('utf-8')
    with ZipFile(target,'w',ZIP_DEFLATED) as archive:
        for name,content in sorted(files.items()):
            entry=ZipInfo(folder+'/'+name,(2026,1,1,0,0,0));entry.compress_type=ZIP_DEFLATED;entry.external_attr=0o100644<<16;archive.writestr(entry,content)
    with ZipFile(target) as archive:
        if archive.testzip():raise ValueError('Paquete dañado.')
    print(target)
    return target

if __name__=='__main__':build()
