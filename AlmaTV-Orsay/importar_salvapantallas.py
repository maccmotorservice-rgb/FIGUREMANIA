#!/usr/bin/env python3
"""Importa un JPG/PNG local sin regenerarlo ni depender de Pillow. Python 3.8+."""
import argparse
import binascii
import hashlib
from pathlib import Path
import shutil
import struct
from datetime import datetime
ROOT=Path(__file__).resolve().parent

def dimensions(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n') and len(data)>=24 and data[12:16]==b'IHDR':
        pos=8
        image_data=False
        ended=False
        while pos+12<=len(data):
            length=struct.unpack('>I',data[pos:pos+4])[0]
            end=pos+12+length
            if end>len(data):raise ValueError('PNG truncado')
            chunk=data[pos+4:pos+8+length]
            expected=struct.unpack('>I',data[pos+8+length:end])[0]
            if binascii.crc32(chunk)&0xffffffff!=expected:raise ValueError('CRC de PNG inválido')
            if chunk[:4]==b'IDAT':image_data=True
            if chunk[:4]==b'IEND':
                ended=True
                break
            pos=end
        if not image_data or not ended:raise ValueError('PNG incompleto')
        return 'png',struct.unpack('>II',data[16:24])
    if data.startswith(b'\xff\xd8'):
        if not data.endswith(b'\xff\xd9'):raise ValueError('JPEG truncado')
        pos=2
        while pos+4<=len(data):
            if data[pos]!=255:
                raise ValueError('JPEG inválido')
            while pos<len(data) and data[pos]==255:pos+=1
            if pos>=len(data):raise ValueError('JPEG truncado')
            marker=data[pos];pos+=1
            if marker in (0xD8,0xD9):continue
            length=struct.unpack('>H',data[pos:pos+2])[0]
            if length<2 or pos+length>len(data):raise ValueError('JPEG truncado')
            if marker in (0xC0,0xC1,0xC2):
                if length<7:raise ValueError('JPEG SOF inválido')
                height,width=struct.unpack('>HH',data[pos+3:pos+7])
                return 'jpg',(width,height)
            pos+=length
    raise ValueError('Solo se admite JPG o PNG válido')

def install(source,root=ROOT):
    source=Path(source)
    with source.open('rb') as stream:
        data=stream.read(4*1024*1024+1)
    if len(data)>4*1024*1024:raise ValueError('Máximo 4 MB para proteger la TV')
    extension,(width,height)=dimensions(data)
    if width<1 or height<1 or width>1920 or height>1080:
        raise ValueError('Máximo 1920×1080. Reduce el archivo antes de importarlo.')
    # Preserve prior media configuration and any installed picture before replacement.
    assets=root/'app/assets'
    previous=list(assets.glob('salvapantallas.*'))
    if previous:
        backup=root/'respaldo'/('imagen-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
        backup.mkdir(parents=True)
        for item in previous:shutil.copy2(str(item),str(backup/item.name))
        if (assets/'media.js').exists():shutil.copy2(str(assets/'media.js'),str(backup/'media.js'))
        for item in previous:item.unlink()
    target=assets/('salvapantallas.'+extension)
    target.write_bytes(data)
    (assets/'media.js').write_text('/* Imagen local proporcionada por el usuario; sin descargas. */\nvar AlmaMedia = { saver: "assets/%s" };\n'%target.name,encoding='utf-8')
    print('Imagen importada sin alterar: %s · %s×%s · SHA-256 %s'%(target.name,width,height,hashlib.sha256(data).hexdigest()))
    print('Regenera el paquete con python3 preparar.py IP_DE_LA_MAC')
    return target

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('imagen',help='Ruta al JPG o PNG adjunto por el usuario')
    a=p.parse_args()
    install(a.imagen)
if __name__=='__main__':main()
