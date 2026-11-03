// A Scratch-like sprite: an <img> showing one of a Scratch sprite's costumes, posed in stage units.
import slots, { type ArtSlot } from 'virtual:art';
import { applyPose, type Pose } from './pose';
import { STAGE_H, STAGE_W } from './stage';

const byName = new Map<string, Map<string, number>>();   // sprite -> costume name -> index
const countOf = new Map<string, number>();
for (const key of Object.keys(slots)) {
  const [sprite, index] = key.split('/');
  if (!byName.has(sprite)) byName.set(sprite, new Map());
  byName.get(sprite)!.set(slots[key].name, +index);
  countOf.set(sprite, Math.max(countOf.get(sprite) ?? 0, +index));
}

/**
 * Scratch's "switch costume to": a costume name if one matches, otherwise a number counted from 1
 * that wraps around (so 0 is the last costume, which is how Mad Dad shows the digit 0).
 */
export function costumeIndex(sprite: string, costume: string | number): number {
  const named = byName.get(sprite)?.get(String(costume));
  if (named) return named;
  const n = Math.round(Number(costume));
  if (Number.isNaN(n)) throw new Error(`${sprite} has no costume "${costume}"`);
  const count = countOf.get(sprite) ?? 1;
  return (((n - 1) % count) + count) % count + 1;
}

export type Effects = { ghost?: number; brightness?: number; color?: number };

export class Sprite {
  readonly el = document.createElement('img');
  slot!: ArtSlot;
  private pose: Pose = {};

  constructor(readonly sprite: string, costume: string | number = 1, z = 0) {
    this.el.alt = '';
    this.el.draggable = false;
    this.el.style.position = 'absolute';
    this.el.style.zIndex = String(z);
    this.setCostume(costume);
  }

  setCostume(costume: string | number) {
    const slot = slots[`${this.sprite}/${costumeIndex(this.sprite, costume)}`];
    if (!slot || slot === this.slot) return this;
    this.slot = slot;
    // laid out at size 100 with its rotation center on the stage center; poses move it from there
    Object.assign(this.el.style, {
      left: `${(100 * (STAGE_W / 2 - slot.centerX)) / STAGE_W}%`,
      top: `${(100 * (STAGE_H / 2 - slot.centerY)) / STAGE_H}%`,
      width: `${(100 * slot.stageW) / STAGE_W}%`,
      height: `${(100 * slot.stageH) / STAGE_H}%`,
      transformOrigin: `${(100 * slot.centerX) / slot.stageW}% ${(100 * slot.centerY) / slot.stageH}%`,
    });
    if (slot.url) this.el.src = slot.url; else this.el.removeAttribute('src');
    this.el.classList.toggle('blank', !slot.url);
    return this;
  }

  get costumeName() { return this.slot.name; }

  setPose(p: Pose) {
    this.pose = { ...this.pose, ...p };
    applyPose(this.el, this.pose);
    return this;
  }

  getPose() { return { x: 0, y: 0, size: 100, direction: 90, ...this.pose }; }

  /** Scratch graphic effects: ghost 0..100, brightness -100..100, color (hue) 0..200 per full turn. */
  setEffects({ ghost = 0, brightness = 0, color = 0 }: Effects) {
    this.el.style.opacity = String(1 - Math.min(100, Math.max(0, ghost)) / 100);
    const filters = [];
    if (brightness) filters.push(`brightness(${Math.max(0, 1 + brightness / 100)})`);
    if (color) filters.push(`hue-rotate(${color * 1.8}deg)`);
    this.el.style.filter = filters.join(' ');
    return this;
  }

  show(visible = true) {
    this.el.style.visibility = visible ? 'visible' : 'hidden';
    return this;
  }

  get visible() { return this.el.style.visibility !== 'hidden'; }

  onTap(fn: () => void) {
    this.el.style.pointerEvents = 'auto';
    this.el.style.cursor = 'pointer';
    this.el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.visible) fn(); });
    return this;
  }

  addTo(parent: HTMLElement) { parent.append(this.el); return this; }
  remove() { this.el.remove(); }
}
