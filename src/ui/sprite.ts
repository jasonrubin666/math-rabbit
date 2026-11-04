// A Scratch-like sprite showing one of a Scratch sprite's costumes, posed in stage units: a box holding
// the costume's image and, for text costumes, the text set in its font (see ./text.ts).
import slots, { type ArtSlot } from 'virtual:art';
import { drawText } from './text';
import { applyPose, type Pose } from './pose';
import { STAGE_H, STAGE_W } from './stage';
import { resolveCostume } from './costume';

const names = new Map<string, string[]>();   // sprite -> costume names in order
for (const key of Object.keys(slots)) {
  const [sprite, index] = key.split('/');
  if (!names.has(sprite)) names.set(sprite, []);
  names.get(sprite)![+index - 1] = slots[key].name;
}

/** Pass numbers for game values (digits, card numbers) and text for named costumes, as Mad Dad did. */
export const costumeIndex = (sprite: string, costume: string | number) => resolveCostume(names.get(sprite) ?? [], costume);

export type Effects = { ghost?: number; brightness?: number; color?: number };

export class Sprite {
  readonly el = document.createElement('div');
  private readonly img = document.createElement('img');
  private textEl?: SVGSVGElement;
  slot!: ArtSlot;
  private pose: Pose = {};

  constructor(readonly sprite: string, costume: string | number = 1, z = 0) {
    this.el.className = 'sprite';
    this.img.alt = '';
    this.img.draggable = false;
    this.el.append(this.img);
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
    // a text costume draws its shape (if any) inside its text <svg>, to paint text under or over it
    this.textEl?.remove();
    this.textEl = slot.text?.length ? drawText(slot) : undefined;
    if (this.textEl) this.el.append(this.textEl);
    const url = this.textEl ? '' : slot.url;
    if (url) this.img.src = url; else this.img.removeAttribute('src');
    const p = slot.place;   // a shared image placed inside the box (else it fills the box, per the CSS)
    Object.assign(this.img.style, p ? {
      left: `${(100 * p.x) / slot.stageW}%`, top: `${(100 * p.y) / slot.stageH}%`,
      width: `${(100 * p.w) / slot.stageW}%`, height: `${(100 * p.h) / slot.stageH}%`,
      transformOrigin: '0 0', transform: p.rotate ? `rotate(${p.rotate}deg)` : '',
    } : { left: '', top: '', width: '', height: '', transformOrigin: '', transform: '' });
    this.img.hidden = !url;
    this.el.classList.toggle('blank', !url && !this.textEl);
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
