// The rabbit at his desk: a WebGL rabbit canvas with the desk image in front, laid out where the
// Mad Dad scientist costumes sat (same rotation centers, same size math) so Mad Dad's poses carry over.
import { createRabbit } from './rabbit-renderer.js';
import deskUrl from './desk.png';
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
    yaw: 0, pitch: 0, dist: 1.6, target: [-0.035, -0.02, 0],
    fov: 2 * Math.atan(Math.tan(FOV / 2) * (1 + EARS_ROOM)),
    centerY: -EARS_ROOM / (1 + EARS_ROOM),
  },
  tint: [0.9, 0.93, 0.82],
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
  desk.src = deskUrl;
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

  function setEffects({ ghost = 0, brightness = 0 }: { ghost?: number; brightness?: number }) {
    el.style.opacity = String(1 - Math.min(100, Math.max(0, ghost)) / 100);
    el.style.filter = brightness ? `brightness(${Math.max(0, 1 + brightness / 100)})` : '';
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
