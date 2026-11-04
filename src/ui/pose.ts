// Scratch-style poses for absolutely positioned elements created at size 100 and position (0, 0).
// x/y in stage units (y up), size in percent, direction in Scratch degrees (90 = upright).

export type Pose = { x?: number; y?: number; size?: number; direction?: number };

export function applyPose(el: HTMLElement, { x = 0, y = 0, size = 100, direction = 90 }: Pose) {
  // --u is the stage's pixels per stage unit (set on #stage when it resizes), so poses follow the stage
  // when the window changes size, even for sprites that are standing still
  el.style.transform = `translate(calc(${x} * var(--u)), calc(${-y} * var(--u))) rotate(${direction - 90}deg) scale(${size / 100})`;
}
