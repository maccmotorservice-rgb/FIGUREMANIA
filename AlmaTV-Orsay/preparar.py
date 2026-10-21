#!/usr/bin/env python3
"""Build reproducible Orsay widget and installer catalogue; Python >=3.8."""
import argparse
import hashlib
import ipaddress
import json
from pathlib import Path
import re
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent

def private_ipv4(value):
    value = str(ipaddress.IPv4Address(value))
    address = ipaddress.IPv4Address(value)
    if not any(address in ipaddress.IPv4Network(n) for n in ('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16')):
        raise ValueError('Usa una IPv4 privada de tu red local')
    return value

def validate(files):
    for name in ('index.html', 'main.js', 'config.xml', 'widget.info'):
        if name not in files:
            raise ValueError('Falta '+name)
    config = ET.fromstring(files['config.xml'])
    ident = config.findtext('cpname')
    version = config.findtext('ver')
    if not ident or not re.fullmatch(r'[A-Za-z0-9_]+', ident):
        raise ValueError('cpname inválido')
    if not re.fullmatch(r'\d+\.\d+\.\d+', version or ''):
        raise ValueError('Versión inválida')
    info = files['widget.info'].decode('utf-8')
    if '<' in info or 'Application Size = 1280x720' not in info:
        raise ValueError('widget.info debe ser texto plano 1280x720')
    for name, content in files.items():
        if name.endswith(('.html', '.css')):
            text = content.decode('utf-8')
            refs = re.findall(r'(?:src|href)=["\']([^"\']+)', text) + re.findall(r'url\(["\']?([^\)"\']+)', text)
            for ref in refs:
                if ref.startswith('$MANAGER_WIDGET/'):
                    continue
                if ref.startswith(('http:', 'https:', '/', 'data:')) or '..' in Path(ref).parts:
                    raise ValueError('Recurso externo o ruta no permitida: '+ref)
                if str(Path(name).parent / ref) not in files:
                    raise ValueError('Recurso ausente: '+ref)
    if 'assets/media.js' in files:
        media=files['assets/media.js'].decode('utf-8')
        match=re.search(r'saver\s*:\s*"([^"]*)"',media)
        if not match:raise ValueError('Configuración del salvapantallas inválida')
        name=match.group(1)
        if name:
            if not re.fullmatch(r'assets/salvapantallas\.(jpg|png)',name) or name not in files:
                raise ValueError('Falta la imagen local del salvapantallas')
    return ident, version, config.findtext('widgetname') or ident

def build(files, output, host):
    ident, version, title = validate(files)
    output = Path(output)
    (output/'Widget').mkdir(parents=True, exist_ok=True)
    archive = output/'Widget'/('%s_%s.zip' % (ident, version))
    with ZipFile(str(archive), 'w', compression=ZIP_DEFLATED) as z:
        for name in sorted(files):
            entry = ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            z.writestr(entry, files[name])
    with ZipFile(str(archive)) as z:
        if z.testzip() is not None:
            raise ValueError('ZIP dañado')
        validate({name:z.read(name) for name in z.namelist()})
    rsp = ET.Element('rsp', stat='ok')
    widget = ET.SubElement(ET.SubElement(rsp,'list'),'widget',id=ident)
    ET.SubElement(widget,'title').text = title
    ET.SubElement(widget,'compression',type='zip',size=str(archive.stat().st_size))
    ET.SubElement(widget,'description').text = title+' · Samsung Orsay 1280×720'
    ET.SubElement(widget,'download').text = 'http://%s/Widget/%s' % (host, archive.name)
    ET.ElementTree(rsp).write(str(output/'widgetlist.xml'), encoding='utf-8',xml_declaration=True)
    manifest = {'id':ident,'version':version,'archive':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False))
    return archive

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mac_ip', nargs='?',default='192.168.1.30', help='IPv4 de la Mac en la misma Wi-Fi')
    args=parser.parse_args()
    host=private_ipv4(args.mac_ip)
    files={str(p.relative_to(ROOT/'app')):p.read_bytes() for p in (ROOT/'app').rglob('*') if p.is_file()}
    build(files,ROOT/'servidor',host)
    # Original supplied by the owner: preserve exact widget contents and identifier.
    with ZipFile(str(ROOT/'respaldo'/'ALMA_TV_CODEX_STARTER_original.zip')) as z:
        prefix='AlmaTV_6_0_TVOS_Red/app/'
        original={n[len(prefix):]:z.read(n) for n in z.namelist() if n.startswith(prefix) and not n.endswith('/')}
    build(original,ROOT/'respaldo'/'servidor',host)
    print('Paquete validado; no se ha contactado ni instalado nada en la TV.')

if __name__=='__main__':
    main()
