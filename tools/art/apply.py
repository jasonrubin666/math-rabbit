"""Build a Scratch project with the new art from art/replace/ swapped into every costume that uses it.

    python3 tools/art/apply.py MadDad.sb3 art MathRabbit.sb3
    node tools/build.js MathRabbit.sb3 docs

This is for the current Scratch-packaged game. A rewrite can read art/manifest.json instead.

A file in replace/ matches an image by its 3-digit number (the rest of the name can change), .png or .svg.
Some images appear at several sizes in the game (the digit "1" is drawn small on the cards and big on the
pad), so each costume gets a copy scaled to its own spot: the new art keeps the size it has relative to
the original file in originals/. Draw a PNG at 2 pixels per stage unit, i.e. twice the stage size in the
manifest, for the same sharpness as the original.
"""
import base64
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from extract import svg_head, svg_size  # noqa: E402


def stage_size(data, fmt, res=None):
    if fmt == 'svg':
        return svg_size(data)
    w, h = Image.open(io.BytesIO(data)).size
    return w / (res or 2), h / (res or 2)


def scaled_svg(data, w, h):
    text = data.decode('utf-8')
    head = svg_head(text)
    ow, oh = svg_size(data)
    new = re.sub(r'\s(width|height)="[^"]*"', '', head)
    if 'viewBox' not in new:
        new = new.replace('<svg', f'<svg viewBox="0 0 {ow} {oh}"', 1)
    new = new.replace('<svg', f'<svg width="{w}" height="{h}" preserveAspectRatio="none"', 1)
    return text.replace(head, new, 1).encode()


def scaled_png(data, w, h):
    im = Image.open(io.BytesIO(data))
    size = (max(1, round(w * 2)), max(1, round(h * 2)))
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def main(sb3='MadDad.sb3', art='art', out='MathRabbit.sb3'):
    art = Path(art)
    manifest = json.loads((art / 'manifest.json').read_text())
    src = zipfile.ZipFile(sb3)
    project = json.loads(src.read('project.json'))
    targets = {t['name']: t for t in project['targets']}
    replacements = {}
    for p in sorted((art / 'replace').glob('*')):
        m = re.match(r'(\d{3})\b', p.name)
        if m and p.suffix.lower() in ('.png', '.svg'):
            replacements[int(m.group(1))] = p

    new_assets, count, warnings = {}, 0, []
    for image in manifest['images']:
        path = replacements.get(image['id'])
        if not path:
            continue
        data, fmt = path.read_bytes(), path.suffix.lower()[1:]
        new_w, new_h = stage_size(data, fmt)
        if not (new_w and new_h):
            warnings.append(f'{path.name}: could not read its size, skipped')
            continue
        orig_w, orig_h = image['stage_w'], image['stage_h']
        if abs((new_w / new_h) / (orig_w / orig_h) - 1) > 0.05:
            warnings.append(f'{path.name}: different proportions from the original '
                            f'({new_w:g}x{new_h:g} vs {orig_w:g}x{orig_h:g}), check it lines up in the game')

        for use in image['uses']:
            c = targets[use['sprite']]['costumes'][use['index'] - 1]
            old_w, old_h = stage_size(src.read(c['md5ext']), c['dataFormat'], c.get('bitmapResolution', 1))
            if 'place' in use:  # a smaller, tilted copy: same box and centre, the new art drawn where "place" says
                p = use['place']
                href = f'data:image/{"svg+xml" if fmt == "svg" else "png"};base64,{base64.b64encode(data).decode()}'
                body = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                        f'width="{old_w}" height="{old_h}" viewBox="0 0 {old_w} {old_h}"><image x="{p["x"]}" '
                        f'y="{p["y"]}" width="{p["w"]}" height="{p["h"]}" preserveAspectRatio="none" '
                        f'transform="rotate({p["rotate"]} {p["x"]} {p["y"]})" xlink:href="{href}"/></svg>').encode()
                md5 = hashlib.md5(body).hexdigest()
                res = c.get('bitmapResolution', 1)
                c.update(assetId=md5, md5ext=f'{md5}.svg', dataFormat='svg',
                         rotationCenterX=c['rotationCenterX'] / res, rotationCenterY=c['rotationCenterY'] / res)
                c.pop('bitmapResolution', None)
                new_assets[c['md5ext']] = body
                count += 1
                continue
            k = old_w / orig_w if orig_w else 1  # how much bigger this spot draws the art than originals/ has it
            w, h = new_w * k, new_h * k
            body = scaled_svg(data, w, h) if fmt == 'svg' else scaled_png(data, w, h)
            md5 = hashlib.md5(body).hexdigest()
            res = c.get('bitmapResolution', 1)
            cx = c.get('rotationCenterX', 0) / res * (w / old_w if old_w else 1)
            cy = c.get('rotationCenterY', 0) / res * (h / old_h if old_h else 1)
            new_res = 2 if fmt == 'png' else 1
            c.update(assetId=md5, md5ext=f'{md5}.{fmt}', dataFormat=fmt,
                     rotationCenterX=cx * new_res, rotationCenterY=cy * new_res)
            if fmt == 'png':
                c['bitmapResolution'] = 2
            else:
                c.pop('bitmapResolution', None)
            new_assets[c['md5ext']] = body
            count += 1
        print(f'  {path.name} -> {len(image["uses"])} costume(s)')

    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('project.json', json.dumps(project, separators=(',', ':')))
        for name in src.namelist():
            if name != 'project.json' and name not in new_assets:
                z.writestr(name, src.read(name))
        for name, body in new_assets.items():
            z.writestr(name, body)

    for w in warnings:
        print('WARNING', w)
    print(f'{len(replacements)} new images -> {count} costumes -> {out}')


if __name__ == '__main__':
    main(*sys.argv[1:])
