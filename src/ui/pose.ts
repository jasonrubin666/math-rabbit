// Scratch-style poses for absolutely positioned elements created at size 100 and position (0, 0).
// x/y in stage units (y up), size in percent, direction in Scratch degrees (90 = upright).

export type Pose = { x?: number; y?: number; size?: number; direction?: number };

/** Stage pixels per stage unit, kept current by the stage's resize observer. */
let unit = 1;
export const setStageUnit = (u: number) => { unit = u; };

export function applyPose(el: HTMLElement, { x = 0, y = 0, size = 100, direction = 90 }: Pose) {
  el.style.transform = `translate(${x * unit}px, ${-y * unit}px) rotate(${direction - 90}deg) scale(${size / 100})`;
}
