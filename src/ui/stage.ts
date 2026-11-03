// The 480×360 stage, letterboxed to the window, plus helpers to place art the way Scratch did.
import slots, { type ArtSlot } from 'virtual:art';

export const STAGE_W = 480;
export const STAGE_H = 360;

export function art(key: string): ArtSlot {
  const slot = slots[key];
  if (!slot) throw new Error(`No art slot "${key}" (see art/manifest.csv)`);
  return slot;
}

/**
 * An <img> positioned like a Scratch sprite: (x, y) is the sprite position in Scratch coordinates
 * (origin at stage center, y up), size in percent. Everything is expressed in % of the stage so it
 * scales with the letterboxed stage.
 */
export function sprite(key: string, opts: { x?: number; y?: number; size?: number; className?: string } = {}) {
  const { x = 0, y = 0, size = 100, className } = opts;
  const slot = art(key);
  const k = size / 100;
  const img = document.createElement('img');
  img.src = slot.url;
  img.alt = '';
  img.draggable = false;
  if (className) img.className = className;
  const left = STAGE_W / 2 + x - slot.centerX * k;
  const top = STAGE_H / 2 - y - slot.centerY * k;
  Object.assign(img.style, {
    position: 'absolute',
    left: `${(100 * left) / STAGE_W}%`,
    top: `${(100 * top) / STAGE_H}%`,
    width: `${(100 * slot.stageW * k) / STAGE_W}%`,
    height: `${(100 * slot.stageH * k) / STAGE_H}%`,
    transformOrigin: `${(100 * slot.centerX) / slot.stageW}% ${(100 * slot.centerY) / slot.stageH}%`,
  });
  return img;
}
