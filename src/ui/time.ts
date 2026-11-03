// Small timing helpers for screen scripts. A Scope is cancelled when its screen goes away,
// which ends every pending wait/tween in it (they reject with Cancelled).

export class Cancelled extends Error {}

export class Scope {
  private ctrl = new AbortController();
  get signal() { return this.ctrl.signal; }
  get alive() { return !this.ctrl.signal.aborted; }
  cancel() { this.ctrl.abort(); }

  wait(seconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.alive) return reject(new Cancelled());
      const id = setTimeout(resolve, seconds * 1000);
      this.signal.addEventListener('abort', () => { clearTimeout(id); reject(new Cancelled()); }, { once: true });
    });
  }

  /** Calls fn(progress 0..1) every animation frame for `seconds`, ending exactly at 1. */
  tween(seconds: number, fn: (p: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.alive) return reject(new Cancelled());
      const start = performance.now();
      const step = (now: number) => {
        if (!this.alive) return reject(new Cancelled());
        const p = Math.min(1, (now - start) / (seconds * 1000));
        fn(p);
        if (p < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /** Runs an async script, ignoring cancellation when the screen goes away. */
  run(script: () => Promise<void>) {
    script().catch(e => { if (!(e instanceof Cancelled)) console.error(e); });
  }
}

/** Mad Dad ran at 30 frames a second; motion written "per frame" uses this to stay the same speed. */
export const FPS = 30;
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
export const sinD = (deg: number) => Math.sin((deg * Math.PI) / 180);
export const cosD = (deg: number) => Math.cos((deg * Math.PI) / 180);
