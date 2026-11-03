# Math Rabbit

The successor to [Mad Dad Math Lab](https://github.com/jasonrubin666/mad-dad-math-lab), the Scratch math game written for my older daughter. Mad Dad is kept as it was, as a memory. Math Rabbit is where the game gets redone with a 3D rabbit host, new art to match him, and eventually voice: speech-to-text in, an LLM for conversation, text-to-speech out.

## Where it is now

The game is still the original Scratch project (`MadDad.sb3`), packaged for the web with the TurboWarp packager and playable on iPad. The difference: the scientist is replaced by an animated 3D Gaussian-splat rabbit sitting behind the same desk.

- `docs/`: the playable game (open `docs/index.html` through a local web server)
- `docs/rabbit/`: the rabbit
  - `rabbit-renderer.js`: WebGL2 splat renderer with joint skinning (torso, head, ears, jaw), blinking eyelids, mouth interior, fur wisps
  - `rig.js`: the rabbit's landmarks, per-splat joint weights, and procedural idle animation
  - `bridge.js`: draws "rabbit + desk" into the scientist sprites' own costumes before each stage draw. The rabbit therefore follows Scratch's show/hide, size, fades and layering, and the scientist's mouth and blink costumes drive the rabbit's jaw and eyelids.
  - `rabbit.splat`: the cleaned splats; `desk.png`: the desk art from Mad Dad
- `rabbit-source/rabbit_brown.ply`: the original TRELLIS export (image → 3D Gaussians)
- `tools/build.js`: rebuilds `docs/` from the `.sb3` (keeps `docs/rabbit/`, adds the iPad tags and the rabbit hook)
- `tools/rabbit/prepare.py`: `.ply` → `rabbit.splat` (drops near-transparent splats and the two stray tails TRELLIS invented)

## Run locally

```bash
npx http-server docs -p 8792 -c-1
```

## Rebuild the game from the Scratch file

```bash
npm i @turbowarp/packager && node tools/build.js MadDad.sb3 docs
```

## Rebuild the rabbit splats

```bash
python3 -m venv /tmp/rv && /tmp/rv/bin/pip install numpy pillow
/tmp/rv/bin/python tools/rabbit/prepare.py rabbit-source/rabbit_brown.ply docs/rabbit/rabbit.splat
```

A different rabbit needs its face landmarks (`RIG` in `docs/rabbit/rig.js`) re-measured, and the tail-removal boxes in `prepare.py` re-checked.
