"""Personaliza solo la copia local del widget con una foto, sin publicarla."""
from pathlib import Path
import hashlib
import json
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED
from importar_salvapantallas import dimensions


def personalize(root, photo=None, cache=None):
    root = Path(root)
    cache = Path(cache) if cache else Path.home() / 'Library/Application Support/AlmaTV/profile'
    selected = Path(photo) if photo else None
    if selected is None:
        saved = cache / 'photo.json'
        if not saved.exists():
            return False
        extension = json.loads(saved.read_text())['extension']
        if extension not in ('jpg', 'png'):
            raise ValueError('Formato de perfil no válido')
        selected = cache / ('photo.' + extension)
    with selected.open('rb') as stream:
        data = stream.read(4 * 1024 * 1024 + 1)
    if len(data) > 4 * 1024 * 1024:
        raise ValueError('La foto de perfil debe pesar menos de 4 MB')
    extension, (width, height) = dimensions(data)
    if not (1 <= width <= 4096 and 1 <= height <= 4096):
        raise ValueError('La foto de perfil debe medir como máximo 4096 × 4096')
    manifest_path = root / 'servidor/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    archive = root / 'servidor/Widget' / manifest['archive']
    if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['sha256']:
        raise ValueError('El widget no coincide con su huella de integridad')
    with ZipFile(archive) as package:
        if package.testzip():
            raise ValueError('Widget dañado')
        files = {name: package.read(name) for name in package.namelist()
                 if not name.startswith('assets/profile-photo.')}
    files['assets/profile-photo.' + extension] = data
    files['assets/profile.js'] = ('var AlmaProfile = {image:"assets/profile-photo.' + extension + '"};\n').encode('ascii')
    temporary = archive.with_suffix('.profile.tmp')
    try:
        with ZipFile(temporary, 'w', ZIP_DEFLATED) as package:
            for name in sorted(files):
                package.writestr(name, files[name])
        with ZipFile(temporary) as package:
            if package.testzip():
                raise ValueError('No se pudo verificar el widget personalizado')
        content = temporary.read_bytes()
        manifest.update(bytes=len(content), sha256=hashlib.sha256(content).hexdigest())
        catalogue_path = root / 'servidor/widgetlist.xml'
        catalogue = ET.parse(catalogue_path)
        catalogue.find('.//compression').set('size', str(len(content)))
        temporary.replace(archive)
        manifest_path.write_text(json.dumps(manifest, indent=2))
        catalogue.write(catalogue_path, encoding='utf-8', xml_declaration=True)
        cache.mkdir(parents=True, exist_ok=True)
        (cache / ('photo.' + extension)).write_bytes(data)
        (cache / 'photo.json').write_text(json.dumps({'extension': extension}))
    finally:
        if temporary.exists():
            temporary.unlink()
    return True
