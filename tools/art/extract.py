"""Pull the game's art out of the Scratch project, one file per distinct image.

    python3 tools/art/extract.py MadDad.sb3 art        (macOS: uses Quick Look to render SVGs for comparison)

The 549 costumes share a lot of art: the digit "1" alone is 18 separate copies across the score, entry and
4-digit sprites. Costumes are grouped when they look the same (rendered, trimmed and compared at 256px, so
copies that differ only in SVG bytes, size or position count as one), and each group becomes one file.

Writes into the art folder:
  originals/NNN <name>.svg|png   one per distinct image, the art to replace
  replace/                       put new art here with the same file name (.png or .svg)
  manifest.json / manifest.csv   every image: its size, and every costume (sprite + number) that uses it
  index.html                     contact sheet, showing replacements once they exist
Then classify.py marks the images that are only text (to draw with a font) and splits text off shapes.
Skipped: the scientist sprites the 3D rabbit draws over, and blank (fully transparent) costumes.
"""
import csv
import hashlib
import io
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image, ImageChops

RABBIT_DRIVEN = {'TitleScreenDad', 'GameOver2T'}  # docs/rabbit/bridge.js draws the rabbit over these
KEEP_FRAMES_APART = {'ScoreSheet'}  # near-identical animation frames ("tap me" blink) that must stay two images
# Column copies of the same art, offset by a few pixels per column: costume N of each is one image
SAME_ART = [{'4DigitTopThousands', '4DigitTopHundreds', '4DigitTopTens'}]
KEY = (255, 0, 255)  # render background, so white-on-transparent art still shows up


def safe(name):
    return re.sub(r'[\\/:*?"<>|]', '_', name).strip() or '_'


def svg_head(text):
    m = re.search(r'<svg\b[^>]*>', text, re.S)
    return m.group(0) if m else ''


def svg_size(data):
    head = svg_head(data.decode('utf-8', 'replace'))
    w = re.search(r'\bwidth="([\d.]+)', head)
    h = re.search(r'\bheight="([\d.]+)', head)
    if w and h:
        return float(w.group(1)), float(h.group(1))
    vb = re.search(r'viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)', head)
    return (float(vb.group(1)), float(vb.group(2))) if vb else (0.0, 0.0)


def render_svgs(svgs):
    """md5ext -> RGB render on the key color, via Quick Look (scaled up so small art keeps its detail)."""
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / 'in').mkdir()
        (tmp / 'out').mkdir()
        for name, data in svgs.items():
            text = data.decode('utf-8', 'replace')
            head = svg_head(text)
            w, h = svg_size(data)
            new = head
            if w and h:
                k = 1024 / max(w, h)
                new = re.sub(r'\bwidth="[^"]*"', f'width="{w * k}"', new, count=1)
                new = re.sub(r'\bheight="[^"]*"', f'height="{h * k}"', new, count=1)
                if 'viewBox' not in new:
                    new = new.replace('<svg', f'<svg viewBox="0 0 {w} {h}"', 1)
            bg = '<rect x="-100000" y="-100000" width="200000" height="200000" fill="#ff00ff"/>'
            (tmp / 'in' / name).write_text(text.replace(head, new + bg, 1))
        names = sorted(svgs)
        for i in range(0, len(names), 50):
            subprocess.run(['qlmanage', '-t', '-s', '1024', '-o', str(tmp / 'out'),
                            *[str(tmp / 'in' / n) for n in names[i:i + 50]]], capture_output=True)
        for n in names:
            f = tmp / 'out' / f'{n}.png'
            out[n] = Image.open(f).convert('RGB') if f.exists() else None
    return out


def signature(im):
    """Trim to the drawn area and normalise size: (256px RGB, aspect ratio), or None when blank."""
    if im is None:
        return None
    # Quick Look pads non-square SVGs to a square with white: crop to the (key-filled) viewport first
    pad = ImageChops.difference(im, Image.new('RGB', im.size, (255, 255, 255))).convert('L').point(lambda v: 255 if v > 4 else 0)
    if pad.getbbox():
        im = im.crop(pad.getbbox())
    mask = ImageChops.difference(im, Image.new('RGB', im.size, KEY)).convert('L').point(lambda v: 255 if v > 24 else 0)
    box = mask.getbbox()
    if not box:
        return None
    im = im.crop(box)
    return im.resize((256, 256), Image.LANCZOS), im.width / im.height


def same(a, b):
    (ia, ra), (ib, rb) = a, b
    if abs(ra / rb - 1) > 0.03:
        return False
    d = ImageChops.difference(ia, ib).convert('L').getdata()
    return sum(1 for v in d if v > 48) / len(d) < 0.0015


def main(sb3='MadDad.sb3', out='art'):
    out = Path(out)
    z = zipfile.ZipFile(sb3)
    project = json.loads(z.read('project.json'))

    uses, skipped = {}, []  # md5ext -> list of costume uses (game order)
    for t in project['targets']:
        for i, c in enumerate(t['costumes'], 1):
            use = {'sprite': t['name'], 'index': i, 'costume': c['name']}
            if t['name'] in RABBIT_DRIVEN:
                skipped.append({**use, 'why': 'the 3D rabbit draws over it'})
            else:
                uses.setdefault(c['md5ext'], []).append(use)

    data = {k: z.read(k) for k in uses}
    renders = render_svgs({k: v for k, v in data.items() if k.endswith('.svg')})
    sigs = {}
    for k, d in data.items():
        if k.endswith('.svg'):
            sigs[k] = signature(renders[k]) if min(svg_size(d)) > 0 else None
        else:
            im = Image.open(io.BytesIO(d)).convert('RGBA')
            bg = Image.new('RGBA', im.size, KEY + (255,))
            bg.alpha_composite(im)
            sigs[k] = signature(bg.convert('RGB'))

    def family(k):
        return {(i, u['index']) for u in uses[k] for i, f in enumerate(SAME_ART) if u['sprite'] in f}

    groups = []  # lists of md5ext, first = the copy kept
    for k in uses:
        if sigs[k] is None:
            skipped += [{**u, 'why': 'blank'} for u in uses[k]]
            continue
        for g in groups:
            if not (family(k) & family(g[0]) or same(sigs[k], sigs[g[0]])):
                continue
            frames = {u['sprite'] for u in uses[k]} & {u['sprite'] for x in g for u in uses[x]} & KEEP_FRAMES_APART
            if not frames:
                g.append(k)
                break
        else:
            groups.append([k])

    # Keep the best-quality copy of each group: the largest one (an SVG over a PNG at equal size)
    def area(k):
        if k.endswith('.svg'):
            w, h = svg_size(data[k])
            return w * h, 1
        w, h = Image.open(io.BytesIO(data[k])).size
        return w * h / 4, 0  # Scratch PNGs are 2 pixels per stage unit

    (out / 'originals').mkdir(parents=True, exist_ok=True)
    (out / 'replace').mkdir(exist_ok=True)
    images = []
    for n, g in enumerate(groups, 1):
        keep = max(g, key=area)
        first = uses[g[0]][0]
        fmt = keep.rsplit('.', 1)[1]
        stem = f'{n:03d} {safe(first["sprite"])} {safe(first["costume"])}'
        (out / 'originals' / f'{stem}.{fmt}').write_bytes(data[keep])
        if fmt == 'svg':
            w, h = svg_size(data[keep])
        else:
            pw, ph = Image.open(io.BytesIO(data[keep])).size
            w, h = pw / 2, ph / 2
        images.append({
            'id': n, 'name': stem, 'file': f'originals/{stem}.{fmt}', 'format': fmt,
            'stage_w': round(w, 1), 'stage_h': round(h, 1),
            'uses': [{**u, 'md5ext': k} for k in g for u in uses[k]],
        })

    manifest = {'source': Path(sb3).name, 'images': images, 'skipped': skipped}
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=1))
    with open(out / 'manifest.csv', 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'file', 'format', 'stage_w', 'stage_h', 'uses', 'used_by'])
        for im in images:
            w.writerow([im['id'], im['file'], im['format'], im['stage_w'], im['stage_h'], len(im['uses']),
                        '; '.join(f'{u["sprite"]}#{u["index"]} {u["costume"]}' for u in im['uses'])])
    total = sum(len(im['uses']) for im in images) + len(skipped)
    print(f'{total} costumes -> {len(images)} distinct images in {out}/originals '
          f'({len(skipped)} skipped: rabbit-driven or blank)')
    import classify  # marks text-only images and splits text off shapes; writes the gallery
    classify.main(out)



if __name__ == '__main__':
    main(*sys.argv[1:])
