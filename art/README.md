# Math Rabbit art

**81 images to draw**, down from 549 Scratch costumes:

- 549 costumes → 249 distinct images once copies are merged (the digit "1" alone was 18 costumes). That includes
  the end-of-game score digits, which are smaller, slightly tilted crops of the in-game score digits (112–121): one
  drawing serves both, and the manifest says where it sits in each end-of-game spot (`place`).
- 135 of those are only text: the card numbers 0–99, the percentage digits, the settings labels (Multiplication, Simple Addition, …, card counts, timer values, ∞). They don't need art; the rewrite can draw them with a font.
- 40 more are text over a simple shape: score popups (+5 … WOW!), pressed calculator keys, the pad's carry bubbles, the report card's "Click to Restart!". Each shape is drawn once and the text goes on top. That's 6 shapes, plus the report card paper that already exists as an image.

So: 74 pictures + 6 shapes, plus the desk the rabbit sits behind (268), which isn't a Scratch costume.

## Files

- `originals/NNN <name>.svg|png`: the 81 images to draw. Numbers up to 261 are the merged images (gaps are text, drawn with a font, or were folded into another image, so they have no file); 262–267 are the shapes split out from under text; 268 is the rabbit's desk.
- `replace/`: put new art here starting with the same 3-digit number (`112 rabbit one.png` replaces `112 ScoreThousands Score1.png`).
  JPG, WebP, PNG or SVG. When one number has several files, `.jpg`/`.jpeg` wins, then `.webp`, `.png`, `.svg` (then
  by name), so a compressed `.jpg` can sit next to its full-quality `.png`. Subfolders (like `Original Size/`) are
  ignored. The rewrite and `apply.py` pick the same file.
- `index.html`: what to draw, then a table of the text styles. Serve the folder so replacements show up: `npx http-server art -p 8793`.
- `manifest.json` / `manifest.csv`: every image, with:
  - `kind`: `art`, `text` or `text on art`
  - `text`: runs in paint order (back first), each with the words, the Scratch font (`Sans Serif` = Noto Sans medium, `Marker` = Knewave), color, size, and placement in costume units from the image's top-left: `x`, `y` (start of the baseline), `rotate` (degrees clockwise about x,y), `anchor`, `stroke` / `stroke_width`, and for text on a shape `over_base` (false = painted under the shape)
  - `base`: for `text on art`, the image holding the shape
  - `uses`: every costume (sprite + number) that shows it. A use with `place` shows the image smaller and tilted
    inside that costume's box: `x`, `y` (the image's top-left), `w`, `h`, `rotate` (degrees clockwise about x, y),
    in costume units
  - `shapes`: the 6 split-out shapes and which images sit on them
  - `extras`: art the game draws that isn't a Scratch costume (the desk), and where it's used

Not included: the scientist costumes the 3D rabbit draws over (`TitleScreenDad`, `GameOver2T`; their desk is 268) and 8 blank costumes.

## Sizes

`stage_w` × `stage_h` is the size in Scratch stage units (the stage is 480 × 360). Draw PNGs at twice that for
the same sharpness. Images used at several sizes only need drawing once.

## Trying new art in the old Scratch game

```bash
python3 tools/art/apply.py MadDad.sb3 art MathRabbit.sb3
node tools/build.js MathRabbit.sb3 docs
```

This swaps images 001–261 only (the end-of-game digits get the new 112–121 at their `place`). The Scratch game has no font rendering, so the text and the split-out
shapes show up only in the rewrite.

## Regenerating

```bash
python3 tools/art/extract.py MadDad.sb3 art
```

macOS only (it renders SVGs with Quick Look to compare them). Running it again gives the same numbers as long as
`MadDad.sb3` doesn't change. Costumes are grouped when they look the same once trimmed and scaled; the hand-set
exceptions are in `tools/art/extract.py` (report card blink frames kept apart, per-column carry digits merged, end-of-game digits folded into the score digits)
and `tools/art/classify.py` (the timer's ∞ is a drawn path, counted as text).
