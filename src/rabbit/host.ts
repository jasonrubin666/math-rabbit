// The rabbit at his desk: a WebGL rabbit canvas with the desk image in front, laid out where the
// Mad Dad scientist costume sat (same rotation center, same size math) so Scratch-style poses carry over.
import { createRabbit } from './rabbit-renderer.js';
import deskUrl from './desk.png';

// The scientist's title costume frame, in costume units, measured in the Scratch build:
// the area the rabbit camera sees, and the costume's rotation center inside it.
const FRAME_W = 347.8, FRAME_H = 260.8;
export const HOST_CENTER = { x: 172.25, y: 136.52 };
const DESK = { left: 5.0, top: 63.54, width: 86.23, height: 55.37 };   // % of the frame
const RABBIT_VIEW = { cam: { yaw: 0, pitch: 0, fov: (30 * Math.PI) / 180, dist: 2.02, target: [-0.045, 0.045, 0] }, tint: [0.9, 0.93, 0.82] };

export type Host = Awaited<ReturnType<typeof createHost>>;

export async function createHost() {
  const el = document.createElement('div');
  el.className = 'host';
  Object.assign(el.style, {
    position: 'absolute',
    width: `${(100 * FRAME_W) / 480}%`,
    height: `${(100 * FRAME_H) / 360}%`,
    left: `${(100 * (240 - HOST_CENTER.x)) / 480}%`,
    top: `${(100 * (180 - HOST_CENTER.y)) / 360}%`,
    transformOrigin: `${(100 * HOST_CENTER.x) / FRAME_W}% ${(100 * HOST_CENTER.y) / FRAME_H}%`,
  });
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  const desk = document.createElement('img');
  desk.src = deskUrl;
  desk.alt = '';
  Object.assign(desk.style, {
    position: 'absolute', left: `${DESK.left}%`, top: `${DESK.top}%`, width: `${DESK.width}%`, height: `${DESK.height}%`,
  });
  el.append(canvas, desk);

  const rabbit = await createRabbit(canvas, RABBIT_VIEW);

  /** Draw one frame; keeps the canvas at device resolution for its on-screen size. */
  function render(dt: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    rabbit.render(dt);
  }

  return { el, rabbit, render };
}
