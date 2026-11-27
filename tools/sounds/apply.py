"""Build a Scratch project with the recordings from sounds/replace/ swapped in for the sounds of the same name.

    python3 tools/sounds/apply.py MathRabbit.sb3 sounds MathRabbit.sb3
    node tools/build.js MathRabbit.sb3 docs

A file in replace/ named "<sound name>.<ext>" replaces that sound in every sprite that has it (the rewrite picks
the same file, see vite.config.ts). .wav and .mp3 go in as they are; .m4a and .ogg are converted to .mp3, which
needs ffmpeg (brew install ffmpeg). Input and output can be the same file.
"""
import hashlib
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

# When one name has several files, the first kind here wins (same order as vite.config.ts). Subfolders are ignored.
REPLACE_ORDER = {'.wav': 0, '.m4a': 1, '.mp3': 2, '.ogg': 3}


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries',
                          'stream=sample_rate:format=duration', '-of', 'json', str(path)],
                         capture_output=True, text=True, check=True).stdout
    info = json.loads(out)
    rate = int(info['streams'][0]['sample_rate'])
    return rate, round(float(info['format']['duration']) * rate)


def main(sb3='MadDad.sb3', sounds='sounds', out='MathRabbit.sb3'):
    replace = Path(sounds) / 'replace'
    files = {}
    if replace.exists():
        for p in sorted(replace.iterdir(), key=lambda p: (REPLACE_ORDER.get(p.suffix.lower(), 9), p.name)):
            if p.is_file() and p.suffix.lower() in REPLACE_ORDER:
                files.setdefault(p.stem, p)

    with zipfile.ZipFile(sb3) as z:
        entries = {n: z.read(n) for n in z.namelist()}
    project = json.loads(entries.pop('project.json'))
    names = {s['name'] for t in project['targets'] for s in t['sounds']}

    new_assets, count = {}, 0
    with tempfile.TemporaryDirectory() as tmp:
        for name, path in sorted(files.items()):
            if name not in names:
                print(f'WARNING {path.name}: the Scratch game has no sound named "{name}", skipped '
                      '(the rewrite still plays it if it asks for that name)')
                continue
            src = path
            if path.suffix.lower() not in ('.wav', '.mp3'):
                src = Path(tmp) / f'{hashlib.md5(name.encode()).hexdigest()}.mp3'
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-codec:a', 'libmp3lame', '-q:a', '2',
                                str(src)], check=True)
            data = src.read_bytes()
            fmt = src.suffix.lower()[1:]
            rate, samples = probe(src)
            md5 = hashlib.md5(data).hexdigest()
            new_assets[f'{md5}.{fmt}'] = data
            uses = 0
            for t in project['targets']:
                for s in t['sounds']:
                    if s['name'] == name:
                        s.update(assetId=md5, md5ext=f'{md5}.{fmt}', dataFormat=fmt, rate=rate, sampleCount=samples)
                        uses += 1
            count += uses
            print(f'  {path.name} -> {uses} sprite(s)')

    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('project.json', json.dumps(project, separators=(',', ':')))
        for name, data in {**entries, **new_assets}.items():
            z.writestr(name, data)
    print(f'{len(files)} new recordings -> {count} sounds -> {out}')


if __name__ == '__main__':
    main(*sys.argv[1:])
