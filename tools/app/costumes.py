"""Costume geometry from the Scratch project, for the rewrite's art slots.

    python3 tools/app/costumes.py MadDad.sb3 art/manifest.json src/data/costumes.json

For every costume ("<Sprite>/<index>") records the art image id from art/manifest.json (null for the
blank costumes the art pipeline leaves out) plus where the costume sat in Scratch: its on-stage size and
rotation center, in stage units. The app draws whatever file currently holds that image id
(art/replace/ first) into that box, or, when the manifest gives the use a "place", at that spot inside
it (the end-of-game score digits reuse the big score digit art, shrunk and tilted).
"""
import json
import re
import struct
import sys
import zipfile

sb3, manifest_path, out_path = sys.argv[1:4]
manifest = json.load(open(manifest_path))
use_of = {(u['sprite'], u['index']): (img['id'], u.get('place')) for img in manifest['images'] for u in img['uses']}

with zipfile.ZipFile(sb3) as z:
    project = json.loads(z.read('project.json'))

    def pixel_size(md5ext, data_format):
        data = z.read(md5ext)
        if data_format == 'png':
            return struct.unpack('>II', data[16:24])
        head = re.search(rb'<svg\b[^>]*>', data, re.S).group(0)
        w, h = re.search(rb'\bwidth="([\d.]+)', head), re.search(rb'\bheight="([\d.]+)', head)
        if w and h:
            return float(w.group(1)), float(h.group(1))
        vb = re.search(rb'viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)', head)
        return float(vb.group(1)), float(vb.group(2))

    out = {}
    for t in project['targets']:
        for i, c in enumerate(t['costumes'], 1):
            image, place = use_of.get((t['name'], i), (None, None))   # None: a blank costume
            res = c.get('bitmapResolution', 1)
            pw, ph = pixel_size(c['md5ext'], c['dataFormat'])
            out[f"{t['name']}/{i}"] = {
                'image': image, 'name': c['name'],
                'stageW': round(pw / res, 3), 'stageH': round(ph / res, 3),
                'centerX': round(c['rotationCenterX'] / res, 3), 'centerY': round(c['rotationCenterY'] / res, 3),
            }
            if place:
                out[f"{t['name']}/{i}"]['place'] = place

json.dump(out, open(out_path, 'w'), indent=0, sort_keys=True)
print(f'{len(out)} costumes -> {out_path}')
