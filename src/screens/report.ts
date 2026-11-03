// Game over: the report card (SPEC.md §1 "Report card"). The rabbit sits at his desk on the left,
// the paper fades in with the score and percentage, and a perfect game rains confetti.
import { Sprite } from '../ui/sprite';
import { Scope, FPS, rand, randInt, sinD, cosD } from '../ui/time';
import { play, pick, stopAll } from '../audio';
import { percentCorrect } from '../game/scoring';
import type { Host } from '../rabbit/host';
import type { GameResult } from './cards';

type Confetti = { sprite: Sprite; x: number; y: number; vx: number; c: number; dir: number; color: number; ghost: number; born: number };

const SCENE = { card: 'Card', clock: 'Clock', pad: 'Pad' } as const;

export function reportScreen(stage: HTMLElement, host: Host, result: GameResult, onDone: () => void) {
  const scope = new Scope();
  const pct = percentCorrect(result.questions, result.attempts);
  const perfect = pct === 100;

  const backdrop = new Sprite('Stage', 'Win', 0).addTo(stage);
  const scene = new Sprite('GameOver', SCENE[result.kind], 1).addTo(stage).setEffects({ ghost: 100 });
  stage.append(host.el);
  host.el.style.zIndex = '2';
  host.setEffects({ ghost: 100 });

  // the report card and everything printed on it share the paper's pose
  const paper = new Sprite('ScoreSheet', 'ScorePaper', 50).addTo(stage);
  const s = Math.max(0, Math.min(999, result.score));
  const scoreDigits = [
    new Sprite('FinalScoreHundreds', Math.floor(s / 100) % 10, 51),
    new Sprite('FinalTens', Math.floor(s / 10) % 10, 51),
    new Sprite('FinalScoreOnes', s % 10, 51),
  ];
  const pctDigits = [
    new Sprite('PercentageHundreds', perfect ? '1' : '10', 51),
    new Sprite('PercentageTens', Math.floor(pct / 10) % 10, 51),
    new Sprite('PercentageOnes', pct % 10, 51),
  ];
  const printed = [...scoreDigits, ...pctDigits];
  for (const p of [paper, ...printed]) p.addTo(stage).setEffects({ ghost: 100, brightness: -100 });
  paper.onTap(() => { if (fadeIn >= 1) onDone(); });

  let t0 = -1, fadeIn = 0;          // paper fade 0..1, starts 2 s in
  let sceneFade = 0;                // scene + rabbit fade 0..1, starts 0.25 s in
  const spin0 = rand(0, 100);
  const confetti: Confetti[] = [];
  let confettiOn = false, lastSpawn = 0, lastFrame = -1;

  scope.run(async () => {
    stopAll();
    await scope.wait(0.25);
    void play(pick('GameOver', 1, 3));
    void play('music_zapsplat_game_music_action_agressive_pounding_tense_electro_synth_028');
    if (perfect) confettiOn = true;
    await scope.tween(10 / FPS, p => { sceneFade = p; });
  });
  scope.run(async () => {
    await scope.wait(2);
    await scope.tween(20 / FPS, p => { fadeIn = p; });
    await scope.wait(2);
    for (;;) {   // blink "tap me"
      paper.setCostume('ScorePaper2');
      await scope.wait(0.5);
      paper.setCostume('ScorePaper');
      await scope.wait(0.5);
    }
  });
  if (perfect) scope.run(async () => { await scope.wait(5.25); void play(pick('100-', 1, 6)); });

  function spawnConfetti(t: number) {
    let c = randInt(1, 100);
    if (c > 95) c = 100 + 20 * (c - 95);
    const sprite = new Sprite('Confetti', randInt(1, 8), c > 60 ? 90 : 5).addTo(stage);
    confetti.push({ sprite, x: randInt(-220, 220), y: 180, vx: randInt(-2, 2), c, dir: 90, color: c, ghost: 10 + (100 - c) / 4, born: t });
  }

  return {
    update(t: number) {
      if (t0 < 0) t0 = t;
      const spin = spin0 + 120 * (t - t0);   // Mad Dad's CardSpinner, +4 per frame here
      // scene and rabbit: gentle zoom from 100%, tilt ±¾° (calmed from Mad Dad)
      const zoom = 100.75 + 0.75 * sinD(spin);
      const dir = 90 + 0.75 * sinD(spin / 2);
      scene.setPose({ size: zoom, direction: dir }).setEffects({ ghost: 100 * (1 - sceneFade), color: perfect ? -150 * (t - t0) : 0 });
      host.setPose('gameOver', { x: 0, y: -30, size: zoom + 1.25 * (sinD(spin) + 1), direction: dir });
      host.setEffects({ ghost: 100 * (1 - sceneFade) });
      // the report card floats
      const pose = { x: 90, y: -10 * cosD(spin), size: 89.75 + 1.75 * sinD(spin / 2), direction: 90 - 1.25 * cosD(spin / 2) };
      const fade = 100 * (1 - fadeIn);
      paper.setPose(pose).setEffects({ ghost: fade, brightness: -fade, color: perfect ? (t * 300) % 200 : 0 });
      const frame = Math.floor(t * FPS);
      for (const p of printed) {
        p.setPose(pose);
        if (frame !== lastFrame) p.setEffects({ ghost: fade, brightness: -fade + rand(0, 5), color: rand(-5, 5) });
      }
      // confetti: a new piece every 0.04 s, falling, spinning and flickering
      if (confettiOn) {
        while (lastSpawn < t - 0.04) { lastSpawn = Math.max(lastSpawn + 0.04, t - 0.2); spawnConfetti(t); }
      }
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i], f = (t - c.born) * FPS;
        const x = c.x + c.vx * f, y = c.y - (1 + c.c / 25) * f;
        if (y < -180 || Math.abs(x) > 235) { c.sprite.remove(); confetti.splice(i, 1); continue; }
        c.sprite.setPose({ x, y, size: 40 + c.c / 1.6, direction: c.dir + ((c.c - 50) / 3) * f });
        if (frame !== lastFrame) {
          c.color += rand(-10, 10);
          c.sprite.setCostume(((Math.floor(f) % 8) + 8) % 8 + 1)
            .setEffects({ color: c.color, brightness: rand(-50, 50) + 25, ghost: c.ghost + (y < -160 ? 25 * Math.ceil((-160 - y) / (1 + c.c / 25)) : 0) });
        }
      }
      lastFrame = frame;
    },
    destroy() {
      scope.cancel();
      stopAll();
      for (const x of [backdrop, scene, paper, ...printed, ...confetti.map(c => c.sprite)]) x.remove();
      host.el.remove();
    },
  };
}
