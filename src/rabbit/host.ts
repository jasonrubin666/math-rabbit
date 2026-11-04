// The rabbit at his desk: a WebGL rabbit canvas with the desk image in front, laid out where the
// Mad Dad scientist costumes sat (same rotation centers, same size math) so Mad Dad's poses carry over.
import { createRabbit } from './rabbit-renderer.js';
import { extras } from 'virtual:art';

// The desk is art image 268 (art/replace/268* replaces it). New art is drawn into the same box (DESK),
// so the top edge that hides the bottom of the rabbit stays where it is.
const DESK_ART = 268;
import { applyPose, type Pose } from '../ui/pose';
import { voiceLevel } from '../audio';

// The scientist costumes' frames (the area the rabbit camera sees), in costume units, with each
// costume's rotation center inside it. Measured from the Scratch build's rabbit bridge.
export const HOST_COSTUMES = {
  title: { w: 347.815, cx: 172.245, cy: 136.523 },     // TitleScreenDad
  gameOver: { w: 382.812, cx: 336.152, cy: 163.151 },  // GameOver2T "Dad"
} as const;
const BASE = HOST_COSTUMES.title;
const FRAME_H = 260.861;
const DESK = { left: 5.0, top: 63.54, width: 86.23, height: 55.37 };   // % of the frame
// The camera frames the rabbit in the scientist's frame. His ears reach above it, so the canvas extends
// EARS_ROOM × the frame's height above the frame, with the same view (the extra fov and the off-center
// view keep everything in the frame exactly where it was).
const FOV = (30 * Math.PI) / 180;
const EARS_ROOM = 0.45;
const RABBIT_VIEW = {
  cam: {
    // dist 2.525 shows him at 80% of the size dist 2.02 did; target y puts the bottom of his
    // sweater (y -0.493) a hair (~3 stage units) below the desk's top edge, so as much of him shows as can
    yaw: 0, pitch: 0, dist: 2.525, target: [-0.045, 0.03, 0],
    fov: 2 * Math.atan(Math.tan(FOV / 2) * (1 + EARS_ROOM)),
    centerY: -EARS_ROOM / (1 + EARS_ROOM),
  },
  tint: [1.15, 1.13, 1.06],   // brighter than the splats as exported, slightly warm, to sit in the lit lab
  // the fur wisps along his outline at 40% strength: at this size full-strength wisps look scratchy
  fuzz: 0.4,
};

export type Host = Awaited<ReturnType<typeof createHost>>;

export async function createHost() {
  const el = document.createElement('div');
  el.className = 'host';
  Object.assign(el.style, {
    position: 'absolute',
    width: `${(100 * BASE.w) / 480}%`,
    height: `${(100 * FRAME_H) / 360}%`,
    left: `${(100 * (240 - BASE.cx)) / 480}%`,
    top: `${(100 * (180 - BASE.cy)) / 360}%`,
    transformOrigin: `${(100 * BASE.cx) / BASE.w}% ${(100 * BASE.cy) / FRAME_H}%`,
  });
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'absolute', left: '0', width: '100%', top: `${-100 * EARS_ROOM}%`, height: `${100 * (1 + EARS_ROOM)}%`,
  });
  const desk = document.createElement('img');
  desk.src = extras[DESK_ART]?.url ?? '';
  desk.alt = '';
  Object.assign(desk.style, {
    position: 'absolute', left: `${DESK.left}%`, top: `${DESK.top}%`, width: `${DESK.width}%`, height: `${DESK.height}%`,
  });
  el.append(canvas, desk);

  const rabbit = await createRabbit(canvas, RABBIT_VIEW);

  /**
   * Pose the host like the Scratch sprite wearing `costume`: (x, y) is where that costume's rotation
   * center sits, size and direction as in Scratch.
   */
  function setPose(costume: keyof typeof HOST_COSTUMES, { x = 0, y = 0, size = 100, direction = 90 }: Pose) {
    const c = HOST_COSTUMES[costume];
    const s = c.w / BASE.w;                     // this costume's frame is s× the base frame
    const k = (s * size) / 100;
    // the costume's rotation center, in base-frame units, relative to the element's transform origin
    const dx = c.cx / s - BASE.cx, dy = c.cy / s - BASE.cy;
    const r = ((direction - 90) * Math.PI) / 180;
    const ox = k * (dx * Math.cos(r) - dy * Math.sin(r)), oy = k * (dx * Math.sin(r) + dy * Math.cos(r));
    applyPose(el, { x: x - ox, y: y + oy, size: k * 100, direction });
  }

  /** Scratch graphic effects, as on sprites: ghost 0..100, brightness -100..100, color (hue) 0..200 per turn. */
  function setEffects({ ghost = 0, brightness = 0, color = 0 }: { ghost?: number; brightness?: number; color?: number }) {
    el.style.opacity = String(1 - Math.min(100, Math.max(0, ghost)) / 100);
    const filters = [];
    if (brightness) filters.push(`brightness(${Math.max(0, 1 + brightness / 100)})`);
    if (color) filters.push(`hue-rotate(${color * 1.8}deg)`);
    el.style.filter = filters.join(' ');
  }

  /** Draw one frame; keeps the canvas at device resolution for its on-screen size. */
  function render(dt: number) {
    if (!el.isConnected) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    rabbit.anim.voiceJaw = voiceLevel();
    rabbit.render(dt);
  }

  return { el, rabbit, render, setPose, setEffects };
}
