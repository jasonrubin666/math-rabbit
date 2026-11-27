"""Pull every sound the game plays out of the Scratch project into sounds/originals/, and write sounds/README.md.

    python3 tools/sounds/extract.py MadDad.sb3 sounds

Files are named exactly as the game asks for them ("Wrong3.mp3"), so a recording dropped into sounds/replace/
under the same name (any of .wav .mp3 .m4a .ogg) replaces it. They're sorted into originals/voice/, effects/
and music/ to make the voice lines easy to find; replace/ is flat.

When sprites share a sound name, the Stage's copy is the one taken, the same rule as the rewrite (vite.config.ts).
Needs ffprobe (brew install ffmpeg) for the clip lengths.
"""
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

# Every sound the game plays, in the order it comes up. (name, group, when it plays)
# Names never played (sprite-local copies like "pop", "Meow", "B Sax", unused card sounds) are left out.
CLIPS = [
    # Title and settings
    ('MadDad', 'voice', 'Title screen, with the music'),
    ('Family1', 'voice', 'Tapping a title card (one of 5 at random)'),
    ('Family2', 'voice', 'Tapping a title card'),
    ('Family3', 'voice', 'Tapping a title card'),
    ('Family4', 'voice', 'Tapping a title card'),
    ('Family5', 'voice', 'Tapping a title card'),
    ('SettingsOperatorAddition', 'voice', 'Settings: mode changed to Simple or 2-digit Addition'),
    ('SettingsOperatorSubtraction', 'voice', 'Settings: mode changed to Simple or 2-digit Subtraction'),
    ('SettingsOperatorMultiplication', 'voice', 'Settings: mode changed to Multiplication'),
    ('SettingsOperatorDivision', 'voice', 'Settings: mode changed to Division'),
    ('SettingsOperatorClock', 'voice', 'Settings: mode changed to Clock'),
    # Start of a game
    ('Start1', 'voice', 'Game start (one of 4 at random), before the shuffle'),
    ('Start2', 'voice', 'Game start'),
    ('Start3', 'voice', 'Game start'),
    ('Start4', 'voice', 'Game start'),
    ('Go0', 'voice?', 'Cards dealt onto the desk, just before "Go"; may be a voice or an effect, listen to it'),
    ('Go1', 'voice?', '"Go" at game start, before the starter pistol; may be a voice or an effect, listen to it'),
    ('WhatTime1', 'voice', 'Clock mode: each new clock question'),
    # Right answers
    ('Correct1', 'voice', 'Right answer, about half the time (one of 5 at random)'),
    ('Correct2', 'voice', 'Right answer'),
    ('Correct3', 'voice', 'Right answer'),
    ('Correct4', 'voice', 'Right answer (same recording as "Good Fantastic")'),
    ('Correct5', 'voice', 'Right answer'),
    ('Good Three In A Row', 'voice', 'Streak of 3'),
    ('Good You Are On Role', 'voice', 'Streak of 10'),
    ('Good Fantastic', 'voice', 'Streak of 20'),
    ('Card30', 'voice', 'Right answer with 30 cards left (card modes)'),
    ('Card20', 'voice', 'Right answer with 20 cards left'),
    ('Card10', 'voice', 'Right answer with 10 cards left'),
    ('Card1', 'voice', 'Right answer with 1 card left'),
    ('Clock30', 'voice', 'Right answer with 30 clocks left (clock mode)'),
    ('Clock20', 'voice', 'Right answer with 20 clocks left'),
    ('Clock10', 'voice', 'Right answer with 10 clocks left'),
    ('Clock5', 'voice', 'Right answer with 5 clocks left'),
    ('Clock1', 'voice', 'Right answer with 1 clock left'),
    # Wrong answers
    ('Wrong1', 'voice', 'Wrong answer with time left, about 1 in 3 (one of 6 at random)'),
    ('Wrong2', 'voice', 'Wrong answer'),
    ('Wrong3', 'voice', 'Wrong answer'),
    ('Wrong4', 'voice', 'Wrong answer'),
    ('Wrong5', 'voice', 'Wrong answer'),
    ('Wrong6', 'voice', 'Wrong answer'),
    ('Slow1', 'voice', 'Ran out of time, about half the time (one of 8 at random)'),
    ('Slow2', 'voice', 'Ran out of time'),
    ('Slow3', 'voice', 'Ran out of time'),
    ('Slow4', 'voice', 'Ran out of time'),
    ('Slow5', 'voice', 'Ran out of time'),
    ('Slow6', 'voice', 'Ran out of time'),
    ('Slow7', 'voice', 'Ran out of time'),
    ('Slow8', 'voice', 'Ran out of time'),
    ('Clock3Wrong1', 'voice', 'Clock mode: wrong answer (one of 5 at random)'),
    ('Clock3Wrong2', 'voice', 'Clock mode: wrong answer; also every wrong answer in Pad mode'),
    ('Clock3Wrong3', 'voice', 'Clock mode: wrong answer'),
    ('Clock3Wrong4', 'voice', 'Clock mode: wrong answer'),
    ('Clock3Wrong5', 'voice', 'Clock mode: wrong answer'),
    # End of game
    ('GameOver1', 'voice', 'Report card appears (one of 3 at random)'),
    ('GameOver2', 'voice', 'Report card appears'),
    ('GameOver3', 'voice', 'Report card appears'),
    ('100-1', 'voice', 'Perfect score, after the report card (one of 6 at random)'),
    ('100-2', 'voice', 'Perfect score'),
    ('100-3', 'voice', 'Perfect score'),
    ('100-4', 'voice', 'Perfect score'),
    ('100-5', 'voice', 'Perfect score'),
    ('100-6', 'voice', 'Perfect score'),
    # Effects
    ('Shuffle', 'effects', 'Game start: card shuffle'),
    ('CardHitsTable1', 'effects', 'Each card dealt onto the desk (one of 3 at random)'),
    ('CardHitsTable2', 'effects', 'Each card dealt onto the desk'),
    ('CardHitsTable3', 'effects', 'Each card dealt onto the desk'),
    ('Gunshot1', 'effects', 'Starter pistol after "Go" (one of 4 at random)'),
    ('Gunshot2', 'effects', 'Starter pistol'),
    ('Gunshot3', 'effects', 'Starter pistol'),
    ('Gunshot4', 'effects', 'Starter pistol'),
    ('Calculator', 'effects', 'Calculator slides in'),
    ('CalcButton', 'effects', 'Calculator key pressed'),
    ('Pop', 'effects', 'Digit typed or deleted'),
    ('Enter', 'effects', 'Answer entered'),
    ('Correct', 'effects', 'Right-answer chime (before any voice line)'),
    ('Wrong', 'effects', 'Wrong-answer buzzer'),
    ('Timer', 'effects', 'Each question: timer start'),
    ('TicTok', 'effects', 'Each question: tick-tock loop'),
    ('3SecondBleep', 'effects', 'Each of the last 3 seconds'),
    # Music
    ('music_zapsplat_game_music_action_agressive_pounding_tense_electro_synth_028', 'music',
     'Title screen and report card'),
]

# Lines the game asks for that were never recorded, so it stays quiet there today.
MISSING = [
    ('Card5', 'Right answer with 5 cards left (card modes)'),
    ('Pad30', 'Pad mode: 30 left (Pad mode has no countdown voice at all)'),
    ('Pad20', 'Pad mode: 20 left'),
    ('Pad10', 'Pad mode: 10 left'),
    ('Pad5', 'Pad mode: 5 left'),
    ('Pad1', 'Pad mode: 1 left'),
]


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                         capture_output=True, text=True).stdout.strip()
    return float(out) if out else 0.0


def main(sb3='MadDad.sb3', out='sounds'):
    out = Path(out)
    z = zipfile.ZipFile(sb3)
    project = json.loads(z.read('project.json'))
    found = {}
    for t in sorted(project['targets'], key=lambda t: not t['isStage']):  # Stage first, like vite.config.ts
        for s in t['sounds']:
            found.setdefault(s['name'], s['md5ext'])

    originals = out / 'originals'
    if originals.exists():
        shutil.rmtree(originals)
    (out / 'replace').mkdir(parents=True, exist_ok=True)

    md5_names = {}
    rows = []
    for name, group, when in CLIPS:
        md5ext = found[name]
        folder = originals / ('voice' if group.startswith('voice') else group)
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f'{name}.{md5ext.rsplit(".", 1)[1]}'
        path.write_bytes(z.read(md5ext))
        md5_names.setdefault(md5ext, []).append(name)
        rows.append((name, group, when, duration(path), path.relative_to(out)))

    voice = [r for r in rows if r[1].startswith('voice')]
    sure = [r for r in voice if r[1] == 'voice']
    lines = [
        '# Math Rabbit sounds',
        '',
        f'**{len(sure)} voice lines to record** (plus {len(voice) - len(sure)} short "Go" clips that may be voice; '
        f'listen to them), {len(rows) - len(voice)} effects and music that can be swapped the same way, and '
        f'{len(MISSING)} lines the game asks for that were never recorded.',
        '',
        '## Files',
        '',
        '- `originals/voice|effects|music/<name>.<ext>`: every sound the game plays, named exactly as the game asks for it.',
        '- `replace/`: put a recording here with the **same name** (`replace/Wrong3.m4a` replaces `Wrong3`). Any of '
        '`.wav`, `.mp3`, `.m4a`, `.ogg`; when one name has several files, `.wav` wins, then `.m4a`, `.mp3`, `.ogg`. '
        'Subfolders are ignored, so takes you\'re not using yet can sit in `replace/takes/`.',
        '- Names are case-sensitive and keep their spaces (`Good You Are On Role.m4a`).',
        '',
        'The rewrite (`npm run dev`) picks up `replace/` on reload. To hear new lines in the Scratch build:',
        '',
        '```bash',
        'python3 tools/art/apply.py MadDad.sb3 art MathRabbit.sb3',
        'python3 tools/sounds/apply.py MathRabbit.sb3 sounds MathRabbit.sb3',
        'node tools/build.js MathRabbit.sb3 docs',
        '```',
        '',
        'Lengths don\'t have to match: the game waits a fixed time after each line, not for it to finish.',
        '',
    ]
    shared = [names for names in md5_names.values() if len(names) > 1]
    if shared:
        lines += ['Same recording under several names today (one take can be copied to each): '
                  + '; '.join(' = '.join(f'`{n}`' for n in names) for names in shared) + '.', '']

    def table(title, group_rows):
        out = [f'## {title}', '', '| Name | Length | When it plays |', '|---|---|---|']
        out += [f'| `{n}` | {d:.1f}s | {w} |' for n, _, w, d, _ in group_rows]
        return out + ['']

    lines += table('Voice', voice)
    lines += ['## Never recorded', '', 'The game asks for these but they don\'t exist, so it stays quiet there. '
              'Drop a file with this name into `replace/` to add it.', '', '| Name | When it would play |', '|---|---|']
    lines += [f'| `{n}` | {w} |' for n, w in MISSING] + ['']
    lines += table('Effects', [r for r in rows if r[1] == 'effects'])
    lines += table('Music', [r for r in rows if r[1] == 'music'])
    lines += ['## Regenerating', '', '```bash', 'python3 tools/sounds/extract.py MadDad.sb3 sounds', '```', '',
              'Rewrites `originals/` and this README; `replace/` is left alone. The list of sounds and when they play '
              'is in `tools/sounds/extract.py`.', '']
    (out / 'README.md').write_text('\n'.join(lines))
    print(f'{len(rows)} sounds ({len(voice)} voice) -> {originals}')


if __name__ == '__main__':
    main(*sys.argv[1:])
