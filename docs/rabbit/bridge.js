// Swaps the 3D rabbit in for the Mad Dad scientist inside the packaged Scratch game.
//
// The scientist is two Scratch sprites (title screen + game over) whose costumes are SVGs
// holding his portrait (and usually the desk). Instead of overlaying a canvas, we draw
// "rabbit + desk" into the sprite's own costume skin right before each stage draw. So the
// rabbit inherits everything Scratch does to that sprite: show/hide, size, ghost fades,
// and layering under the logo and flying cards. The costume Scratch picks drives the face:
// a "...Mouth..." costume opens the jaw, a "...Blink..." costume shuts the eyes.
import { createRabbit } from './rabbit-renderer.js';

const SCIENTIST_SPRITES = ['TitleScreenDad', 'GameOver2T'];
const PORTRAIT_WIDTH = 795;   // pixel width of the scientist portrait embedded in every costume SVG

// Placement relative to the portrait's rectangle (fractions of its width/height),
// measured from the title screen so the rabbit's head lands where the scientist's was.
const FRAME = { x: -0.391, y: -0.1817, w: 1.518, h: 1.2587 };   // area the rabbit camera sees
const DESK = { x: -0.315, y: 0.618, w: 1.309, h: 0.697 };       // desk drawn in front of the rabbit
const RABBIT_VIEW = { cam: { yaw: 0, pitch: 0, fov: 30 * Math.PI / 180, dist: 2.02, target: [-0.045, 0.045, 0] }, tint: [0.9, 0.93, 0.82] };
const OUT_W = 960, OUT_H = 720;   // composite bitmap size (matches FRAME's 4:3)

const loadImage = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });

// Portrait rectangle in costume (SVG viewBox) units, accumulating translate()s from parent groups.
// The packaged runtime drops costume asset data after loading, so read the SVG from the assets folder.
async function portraitRect(costume) {
  const text = await (await fetch(new URL(`../assets/${costume.md5}`, import.meta.url))).text();
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
  const img = [...svg.querySelectorAll('image')].find(el => +el.getAttribute('width') === PORTRAIT_WIDTH);
  if (!img) return null;
  const scale = +((img.getAttribute('transform') || '').match(/scale\(([-\d.e]+)/)?.[1] ?? 1);
  let tx = 0, ty = 0;
  for (let el = img.parentElement; el && el.tagName !== 'svg'; el = el.parentElement) {
    const m = (el.getAttribute('transform') || '').match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/);
    if (m) { tx += +m[1]; ty += +m[2]; }
  }
  return { x: +img.getAttribute('x') * scale + tx, y: +img.getAttribute('y') * scale + ty,
    w: PORTRAIT_WIDTH * scale, h: +img.getAttribute('height') * scale };
}

async function waitForScientists(vm) {
  for (;;) {
    const targets = vm.runtime.targets.filter(t => t.isOriginal && SCIENTIST_SPRITES.includes(t.sprite.name));
    if (targets.length === SCIENTIST_SPRITES.length && vm.renderer) return targets;
    await new Promise(r => setTimeout(r, 200));
  }
}

async function main() {
  while (!window.vm) await new Promise(r => setTimeout(r, 100));
  const vm = window.vm;
  const targets = await waitForScientists(vm);
  const renderer = vm.renderer;

  const glCanvas = document.createElement('canvas');
  glCanvas.width = OUT_W; glCanvas.height = OUT_H;
  const out = document.createElement('canvas');
  out.width = OUT_W; out.height = OUT_H;
  const ctx = out.getContext('2d');
  const [rabbit, desk] = await Promise.all([createRabbit(glCanvas, RABBIT_VIEW), loadImage(new URL('desk.png', import.meta.url))]);

  // Per costume: where the composite goes (bitmap resolution + rotation center) and where the desk sits.
  const layout = new Map();
  for (const t of targets) {
    for (const c of t.getCostumes()) {
      const p = await portraitRect(c);
      if (!p) continue;
      const f = { x: p.x + FRAME.x * p.w, y: p.y + FRAME.y * p.h, w: FRAME.w * p.w, h: FRAME.h * p.h };
      const res = OUT_W / f.w;   // bitmap pixels per costume unit
      layout.set(c, {
        res, center: [c.rotationCenterX - f.x, c.rotationCenterY - f.y],
        desk: [(p.x + DESK.x * p.w - f.x) * res, (p.y + DESK.y * p.h - f.y) * res, DESK.w * p.w * res, DESK.h * p.h * res],
      });
    }
  }

  let last = performance.now();
  const visibleScientist = () => targets.find(t => t.visible);

  // Redraw the rabbit into the current costume just before Scratch draws the stage.
  const draw = renderer.draw.bind(renderer);
  renderer.draw = function () {
    const t = visibleScientist();
    if (t) {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      const costume = t.getCostumes()[t.currentCostume];
      const l = layout.get(costume);
      if (l) {
        rabbit.anim.external = { jaw: /mouth/i.test(costume.name) ? 1 : 0, lid: /blink/i.test(costume.name) ? 1 : 0 };
        rabbit.render(dt);
        ctx.clearRect(0, 0, OUT_W, OUT_H);
        ctx.drawImage(glCanvas, 0, 0);
        ctx.drawImage(desk, ...l.desk);
        renderer.updateBitmapSkin(costume.skinId, out, l.res, l.center);
      }
    }
    return draw();
  };

  // Scratch only redraws when something changes; keep the rabbit breathing while it's on screen.
  const tick = () => { if (visibleScientist()) vm.runtime.requestRedraw(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.mathRabbit = { rabbit, layout };
}

main().catch(err => console.error('[rabbit] failed to start:', err));
