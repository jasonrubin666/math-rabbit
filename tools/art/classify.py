"""Mark which art images are really just text, so they can be drawn with a font instead of drawn by hand.

    python3 tools/art/classify.py art            (extract.py runs this too)

Adds to each image in art/manifest.json, without renumbering or removing anything:
  kind: "art"          a picture to draw
        "text"         only text (the card numbers, percent digits, settings labels): use a font, no art
        "text on art"  text over a shape (score popups, pressed keys, pad carry bubbles, report card hint):
                       draw the shape once, the text goes on top in a font
  text: [{text, font, css_font, color, size}]   size in costume units, like stage_w / stage_h
  base: for "text on art", the id of the image holding the shape without its text
Shapes that aren't already an image get new ids after the last image, listed under "shapes" in the
manifest, with their file in originals/ like any other image.

The original files of text and text-on-art images are then deleted from originals/: nothing draws them
(the rewrite sets the text in a font, over the shape's own file). Each image's "asset" field names its
copy inside the .sb3, which is where this reads the SVG from when the file is gone.
"""
import csv
import hashlib
import html
import json
import re
import sys
import zipfile
from pathlib import Path

# Scratch 3's built-in fonts (scratch-render-fonts)
CSS_FONT = {
    'Sans Serif': '"Noto Sans", sans-serif; font-weight: 500',
    'Serif': '"Source Serif Pro", serif',
    'Handwriting': 'Handlee, cursive',
    'Marker': 'Knewave, cursive',
    'Curly': 'Griffy, cursive',
    'Pixel': '"Grand9K Pixel", monospace',
}
# Art the game draws that isn't a Scratch costume: (name, file in the repo, stage units per pixel).
# The desk is cut from the scientist portraits (TitleScreenDad, GameOver2T), which are skipped because the
# 3D rabbit draws over them; the rabbit sits behind it on the title and report card screens.
EXTRAS = [('Rabbit desk', 'src/rabbit/desk.png', 0.5)]
# Drawn as a path but really a character
GLYPH_PATHS = {('Timer', '999'): '∞'}

TEXT_RE = re.compile(r'<text\b([^>]*)>(.*?)</text>', re.S)
DRAWN = re.compile(r'<(path|image|rect|circle|ellipse|polygon|polyline|line|use)\b')


def attr(tag, name):
    m = re.search(rf'\b{name}="([^"]*)"', tag)
    return m.group(1) if m else None


TAG_RE = re.compile(r'<(/?)([a-zA-Z]+)\b([^>]*?)(/?)>', re.S)
NUM = r'(-?[\d.]+(?:e-?\d+)?)'


def translate_of(transform):
    m = re.search(rf'translate\(\s*{NUM}[\s,]+{NUM}\s*\)', transform or '')
    return (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)


def text_runs(svg):
    """Text elements in paint order, placed in costume units from the image's top-left.

    Paper.js exports every run as <text transform="translate(x,y) [rotate(deg)] scale(s,s)"> inside groups
    that only translate (checked for all of Mad Dad's SVGs), with <tspan x="0" dy="0">: so the origin
    (start of the baseline) is the sum of the translates, and the font size is font-size × s.
    """
    runs, stack, drawn_before = [], [], False
    for m in TAG_RE.finditer(svg):
        closing, name, attrs, selfclosing = m.groups()
        if name == 'g':
            if closing:
                stack.pop()
            elif not selfclosing:
                stack.append(translate_of(attr(attrs, 'transform')))
            continue
        if closing:
            continue
        if DRAWN.match(m.group(0)):
            drawn_before = True
            continue
        if name != 'text':
            continue
        body = svg[m.end():svg.index('</text>', m.end())]
        text = html.unescape(re.sub(r'<[^>]+>', '', body)).strip()
        if not text:
            continue
        transform = attr(attrs, 'transform') or ''
        tx, ty = translate_of(transform)
        x = sum(t[0] for t in stack) + tx
        y = sum(t[1] for t in stack) + ty
        scale = re.search(rf'scale\(\s*{NUM}', transform)
        scale = float(scale.group(1)) if scale else 1.0
        rotate = re.search(rf'rotate\(\s*{NUM}', transform)
        family = attr(attrs, 'font-family') or 'Sans Serif'
        stroke = attr(attrs, 'stroke')
        stroke_w = float(attr(attrs, 'stroke-width') or 1) * scale
        visible = stroke not in (None, 'none') and stroke_w > 0 and float(attr(attrs, 'stroke-opacity') or 1) > 0
        runs.append({
            'text': text, 'font': family, 'css_font': CSS_FONT.get(family, family),
            'color': attr(attrs, 'fill') or '#000000',
            'size': round(float(attr(attrs, 'font-size') or 12) * scale, 3),
            'x': round(x, 3), 'y': round(y, 3),
            'rotate': round(float(rotate.group(1)), 3) if rotate else 0,
            'anchor': attr(attrs, 'text-anchor') or 'start',
            'stroke': stroke if visible else None,
            'stroke_width': round(stroke_w, 3) if visible else 0,
            # False when the run is painted before any shape in the SVG, i.e. under the base image
            'over_base': drawn_before,
        })
    return runs


def drawing_key(svg):
    """What's drawn apart from text, independent of where: path outlines + fills, embedded image bytes."""
    parts = sorted(re.findall(r'<path\b[^>]*\bd="([^"]*)"[^>]*?(?:fill="([^"]*)")?', svg))
    parts += sorted(hashlib.md5(h.encode()).hexdigest() for h in re.findall(r'href="(data:[^"]*)"', svg))
    return hashlib.md5(repr(parts).encode()).hexdigest() if parts else None


def main(art='art'):
    art = Path(art)
    manifest = json.loads((art / 'manifest.json').read_text())
    images = manifest['images']
    for f in art.glob('originals/* shape.svg'):  # shapes from an earlier run
        f.unlink()

    art_by_key, shapes, next_id = {}, {}, max(im['id'] for im in images) + 1
    sb3 = None
    svgs = {}
    for im in images:
        f = art / im['file']
        if f.exists():
            data = f.read_bytes()
            im['asset'] = f'{hashlib.md5(data).hexdigest()}.{im["format"]}'
        else:
            sb3 = sb3 or zipfile.ZipFile(art.resolve().parent / manifest['source'])
            data = sb3.read(im['asset'])
        if im['format'] == 'svg':
            svgs[im['id']] = data.decode('utf-8')
    for im in images:
        svg = svgs.get(im['id'])
        im.pop('base', None)
        im['text'] = []
        im['kind'] = 'art'
        first = im['uses'][0]
        glyph = GLYPH_PATHS.get((first['sprite'], first['costume']))
        if glyph:
            colors = re.findall(r'\b(?:fill|stroke)="(#[0-9a-fA-F]{3,6})"', svg or '')
            fill = colors[0] if colors else None
            im.update(kind='text', text=[{'text': glyph, 'font': 'Sans Serif', 'css_font': CSS_FONT['Sans Serif'],
                                          'color': fill or '#000000', 'size': im['stage_h'],
                                          'x': round(im['stage_w'] / 2, 3), 'y': round(im['stage_h'] / 2, 3),
                                          'rotate': 0, 'anchor': 'middle', 'center': True,
                                          'stroke': None, 'stroke_width': 0, 'over_base': True}])
        elif svg:
            runs = text_runs(svg)
            if runs:
                im['text'] = runs
                im['kind'] = 'text on art' if DRAWN.search(TEXT_RE.sub('', svg)) else 'text'
                if im['kind'] == 'text':
                    for r in runs:
                        r.pop('over_base')  # only means something over a base image
            elif drawing_key(svg):
                art_by_key.setdefault(drawing_key(svg), im['id'])

    for im in images:
        if im['kind'] != 'text on art':
            continue
        stripped = TEXT_RE.sub('', svgs[im['id']])
        key = drawing_key(stripped)
        if key in art_by_key:
            im['base'] = art_by_key[key]
            continue
        if key not in shapes:
            stem = f'{next_id:03d} {im["name"][4:]} shape'
            (art / 'originals' / f'{stem}.svg').write_text(stripped)
            shapes[key] = {'id': next_id, 'name': stem, 'file': f'originals/{stem}.svg', 'format': 'svg',
                           'stage_w': im['stage_w'], 'stage_h': im['stage_h'], 'kind': 'art', 'used_by': []}
            next_id += 1
        im['base'] = shapes[key]['id']
        shapes[key]['used_by'].append(im['id'])

    manifest['shapes'] = list(shapes.values())
    add_extras(art, manifest, next_id)
    for im in images:
        if im['kind'] != 'art':
            (art / im['file']).unlink(missing_ok=True)
    (art / 'manifest.json').write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    with open(art / 'manifest.csv', 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'kind', 'file', 'format', 'stage_w', 'stage_h', 'text', 'font', 'base', 'uses', 'used_by'])
        for im in images + manifest['shapes'] + manifest['extras']:
            t = im.get('text') or []
            w.writerow([im['id'], im['kind'], im['file'], im['format'], im['stage_w'], im['stage_h'],
                        ' | '.join(r['text'] for r in t), ', '.join(sorted({r['font'] for r in t})), im.get('base', ''),
                        len(im.get('uses', [])),
                        '; '.join(f'{u["sprite"]}#{u["index"]} {u["costume"]}' for u in im.get('uses', []))
                        or im.get('used_in') or 'shape for images ' + ', '.join(map(str, im.get('used_by', [])))])
    write_gallery(art, manifest)

    kinds = {k: sum(1 for im in images if im['kind'] == k) for k in ('art', 'text', 'text on art')}
    todo = kinds['art'] + len(shapes) + len(manifest['extras'])
    print(f'{len(images)} images: {kinds["art"]} art, {kinds["text"]} text only, {kinds["text on art"]} text on a shape '
          f'({len(shapes)} new shape files). Art to draw: {todo}')


def add_extras(art, manifest, next_id):
    """Copy EXTRAS into originals/ with ids after the shapes, listed under "extras" in the manifest."""
    from PIL import Image
    manifest['extras'] = []
    for n, (name, src, unit) in enumerate(EXTRAS, next_id):
        src = art.resolve().parent / src
        stem = f'{n:03d} {name}'
        fmt = src.suffix[1:].lower()
        (art / 'originals' / f'{stem}.{fmt}').write_bytes(src.read_bytes())
        w, h = Image.open(src).size
        manifest['extras'].append({'id': n, 'name': stem, 'file': f'originals/{stem}.{fmt}', 'format': fmt,
                                   'stage_w': round(w * unit, 1), 'stage_h': round(h * unit, 1), 'kind': 'art',
                                   'used_in': str(src.relative_to(art.resolve().parent))})


def write_gallery(art, manifest):
    images = manifest['images']
    by_id = {im['id']: im for im in images + manifest['shapes'] + manifest.get('extras', [])}

    def tile(im):
        if im.get('uses'):
            used = '<br>'.join(html.escape(f'{u["sprite"]} #{u["index"]} {u["costume"]}') for u in im['uses'][:5])
            if len(im['uses']) > 5:
                used += f'<br>+{len(im["uses"]) - 5} more'
        elif im.get('used_in'):
            used = html.escape(f'not a Scratch costume: {im["used_in"]}')
        else:
            used = f'shape under {len(im["used_by"])} text images'
        return (f'<figure data-name="{html.escape(im["name"])}"><div class="img">'
                f'<img loading="lazy" src="{html.escape(im["file"])}"></div>'
                f'<figcaption><b>{html.escape(im["name"])}</b><br><small>{im["format"]} · '
                f'{im["stage_w"]:g}×{im["stage_h"]:g} on stage</small><div class="uses">{used}</div></figcaption></figure>')

    draw = [im for im in images if im['kind'] == 'art'] + manifest['shapes'] + manifest.get('extras', [])

    styles = {}
    for im in images:
        if im['kind'] == 'art':
            continue
        for r in im['text']:
            styles.setdefault((r['font'], r['color']), []).append((im, r))
    rows = []
    for (font, color), items in sorted(styles.items(), key=lambda kv: -len(kv[1])):
        texts = ' '.join(html.escape(r['text']) for _, r in items[:40]) + (' …' if len(items) > 40 else '')
        sizes = sorted({r['size'] for _, r in items})
        rows.append(f'<tr><td>{html.escape(font)}<br><small>{html.escape(CSS_FONT.get(font, font))}</small></td>'
                    f'<td><span class="sw" style="background:{html.escape(color)}"></span>{html.escape(color)}</td>'
                    f'<td>{len(items)}</td><td>{", ".join(f"{s:g}" for s in sizes)}</td><td>{texts}</td></tr>')
    on_art = [im for im in images if im['kind'] == 'text on art']
    on_rows = ''.join(f'<li>{html.escape(" | ".join(r["text"] for r in im["text"]))} over '
                      f'<code>{html.escape(by_id[im["base"]]["name"])}</code></li>' for im in on_art)

    (art / 'index.html').write_text(f'''<!doctype html><meta charset="utf-8"><title>Math Rabbit art</title>
<style>
body{{font:14px system-ui;margin:16px;background:#f4f1ea;color:#222}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}}
figure{{margin:0;background:#fff;border-radius:8px;padding:6px;box-shadow:0 1px 2px #0002}}
figure.done{{outline:3px solid #3a3}}
.img{{height:120px;display:flex;align-items:center;justify-content:center;
  background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px}}
.img img{{max-width:100%;max-height:120px}} figcaption{{font-size:12px;margin-top:4px;word-break:break-word}}
.uses{{color:#777;font-size:11px;margin-top:3px}}
table{{border-collapse:collapse;background:#fff}} td,th{{border:1px solid #ddd;padding:4px 8px;vertical-align:top;text-align:left}}
.sw{{display:inline-block;width:12px;height:12px;border:1px solid #999;margin-right:4px;vertical-align:middle}}
</style>
<h1>Math Rabbit art: {len(draw)} images to draw</h1>
<p>To replace one, save new art as <code>replace/&lt;same 3-digit number&gt; anything.png</code> (or .svg).
Green outline = already replaced. Serve this folder (<code>npx http-server art</code>), not file://.
<span id="count">0</span> of {len(draw)} done.</p>
<div class="grid">{''.join(tile(im) for im in draw)}</div>
<h2>Text: {sum(len(v) for v in styles.values())} pieces in {len(styles)} styles, no art needed</h2>
<p>These are typed text in Scratch's built-in fonts. The rewrite can draw them with a font, so they don't need
images. Sizes are in costume units (the sprite's own size % scales them on stage).</p>
<table><tr><th>Font</th><th>Color</th><th>Count</th><th>Sizes</th><th>Text</th></tr>{''.join(rows)}</table>
<h3>Text over a shape ({len(on_art)})</h3><ul>{on_rows}</ul>
<script>
// Replacements match by their 3-digit number; read replace/ from the server's directory listing
(async () => {{
  let names = [];
  try {{
    const listing = await (await fetch('replace/')).text();
    names = [...listing.matchAll(/href="([^"?]+)"/g)].map(m => decodeURIComponent(m[1].split('/').pop()))
      .filter(n => /^\\d{{3}}.*\\.(png|svg|jpe?g|webp)$/i.test(n));
  }} catch {{}}
  let done = 0;
  for (const fig of document.querySelectorAll('figure')) {{
    const hit = names.find(n => n.startsWith(fig.dataset.name.slice(0, 3)));
    if (!hit) continue;
    fig.querySelector('img').src = 'replace/' + encodeURIComponent(hit);
    fig.classList.add('done');
    document.getElementById('count').textContent = ++done;
  }}
}})();
</script>
''')


if __name__ == '__main__':
    main(*sys.argv[1:])
