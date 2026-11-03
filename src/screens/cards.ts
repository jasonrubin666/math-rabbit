// Card modes: deal a deck, flip cards, answer on the calculator (SPEC.md §2, §3, §6, §7, §8).
// Timings and motion follow Mad Dad's scripts; "frames" are Mad Dad's 1/30 s steps, computed
// from continuous time so everything moves smoothly.
import { Sprite } from '../ui/sprite';
import { Scope, FPS, rand, randInt, sinD } from '../ui/time';
import { play, pick, stopAll } from '../audio';
import { arithmeticProblem, type ArithmeticProblem } from '../game/modes';
import { pointsForCorrect, popupLabel, WRONG_PENALTY, clampScore } from '../game/scoring';
import { calculatorType, CARD_MAX_DIGITS } from '../game/entry';
import type { Settings } from '../settings';

export type GameResult = { score: number; questions: number; attempts: number; kind: 'card' };

type Card = { problem: ArithmeticProblem; x: number; y: number; rot: number; back: Sprite; z: number };
type CardPose = { x: number; y: number; size: number; direction: number };

const KEYS: [string, number, number, number][] = [   // sprite, costume, x, y (Mad Dad's card-mode layout)
  ['Key1', 1, 79, -38], ['Key2', 2, 119, -34], ['Key3', 2, 162, -30],
  ['Key4', 2, 82, -78], ['Key5', 2, 124, -75], ['Key6', 2, 166, -71],
  ['Key7', 2, 86, -119], ['Key8', 2, 126, -114], ['Key9', 2, 169, -109],
  ['Key0', 2, 132, -157], ['KeyD', 2, 204, -48], ['KeyE', 2, 218, -126],
];
const SCORE_DIGITS: [string, number, number][] = [['ScoreHundreds', 111, 43], ['ScoreTens', 153, 47], ['ScoreOnes', 193, 52]];

export function cardsScreen(stage: HTMLElement, settings: Settings, onGameOver: (r: GameResult) => void) {
  const scope = new Scope();
  const n = settings.cards;
  const backdrop = new Sprite('Stage', 'DeskCards', 0).addTo(stage);

  // the deck: index n-1 is the top card
  const deck: Card[] = Array.from({ length: n }, (_, i) => ({
    problem: arithmeticProblem(settings.mode),
    x: randInt(-125, -85), y: randInt(-20, 20), rot: randInt(-15, 15),
    back: new Sprite('BackCards', 'CardBack', 10 + i).addTo(stage).show(false),
    z: 10 + i,
  }));
  let cur = n - 1;

  const front = new Sprite('FrontCard', 'CardBack', 200).addTo(stage).show(false);
  const top = new Sprite('NumberTop', 1, 210).addTo(stage).show(false);
  const bottom = new Sprite('NumberBottom', 1, 210).addTo(stage).show(false);
  const entryDigits = ['EntryHundreds', 'EntryTens', 'EntryOnes'].map(s => new Sprite(s, 11, 220).addTo(stage).show(false));
  const calculator = new Sprite('Calculator', 1, 300).addTo(stage).show(false);
  const keys = KEYS.map(([name, costume, x, y]) => {
    const k = new Sprite(name, costume, 310).setPose({ x, y, size: 50, direction: 85 }).addTo(stage).show(false);
    k.onTap(() => scope.run(async () => {
      if (!keysShown) return;
      k.show(false);
      press(name === 'KeyE' ? 'enter' : name === 'KeyD' ? 'delete' : name.slice(3));
      await scope.wait(0.15);
      k.show(true);
    }));
    return k;
  });
  const scoreDigits = SCORE_DIGITS.map(([name, x, y]) => ({ sprite: new Sprite(name, 11, 320).addTo(stage).show(false), x, y }));
  const boom = new Sprite('Boom', '5', 400).addTo(stage).show(false);

  let score = 0, streak = 0, attempts = 0;
  let entry = '';
  let accepting = false;            // keypad input allowed (a card is up and settled)
  let keysShown = false;
  let secondsLeft = settings.seconds;
  let timerRun = 0;                 // bumps to cancel the running countdown
  let cardAnim: ((t: number) => CardPose) | null = null;
  let cardPose: CardPose = { x: 0, y: 0, size: 250, direction: 90 };   // as last drawn
  let now = 0;
  let flash = { start: -1 };

  // ---- display helpers ----
  function showEntry() {
    const d = entry.padStart(3, ' ');
    entryDigits.forEach((s, i) => s.setCostume(d[i] === ' ' ? 11 : d[i] === '0' ? 10 : +d[i]));
  }
  function showScore() {
    // costumes Score1..Score9 are the digits, Score10 is 0, Score11 is blank. Mad Dad showed every 0 as
    // blank (so 20 read "2 "); here only leading zeros are blank.
    const text = String(Math.min(999, Math.round(score))).padStart(3, ' ');
    scoreDigits.forEach((d, i) => d.sprite.setCostume(text[i] === ' ' ? 11 : text[i] === '0' ? 10 : +text[i]));
  }
  const card = () => deck[cur];

  // ---- timer (SPEC.md §6) ----
  function startTimer() {
    const run = ++timerRun;
    secondsLeft = settings.seconds;
    void play('Timer');
    void play('TicTok');
    if (!Number.isFinite(secondsLeft)) return;
    scope.run(async () => {
      for (;;) {
        await scope.wait(1);
        if (run !== timerRun) return;
        secondsLeft -= 1;
        if (secondsLeft < 4) void play('3SecondBleep');
        if (secondsLeft < 1) { timeOut(); return; }
      }
    });
  }
  const stopTimer = () => { timerRun++; };

  // ---- card motion ----
  /** Deal the deck onto the desk: each card slides in from the left and lands with a thunk. */
  async function deal() {
    await scope.wait(0.25);
    deck.forEach((c, i) => scope.run(async () => {
      await scope.wait((i + 1) / 10);
      c.back.setPose({ x: c.x - 300, y: c.y, size: 250, direction: 90 + c.rot }).show(true);
      await scope.tween(0.2, p => c.back.setPose({ x: c.x - 300 + 300 * p }));
      void play(pick('CardHitsTable', 1, 3));
    }));
    if (n > 15) scope.run(async () => { await scope.wait(Math.max(0, (n - 20) * 0.105)); void play('Go0'); });
  }

  /** Flip the current card face up; it then floats until answered. */
  function flip() {
    const c = card();
    attempts++;
    entry = '';
    showEntry();
    c.back.show(false);
    front.setCostume('CardBack').setEffects({}).show(true);
    front.el.style.zIndex = '200';
    top.setCostume(c.problem.top).setEffects({}).show(false);
    bottom.setCostume(c.problem.bottom).setEffects({}).show(false);
    for (const d of entryDigits) d.setEffects({}).show(true);
    const t0 = now, spin0 = rand(0, 100), mover0 = rand(0, 100);
    let settled = false;
    accepting = false;
    cardAnim = (t) => {
      const f = (t - t0) * FPS;
      if (f >= 3 && front.costumeName === 'CardBack') {
        front.setCostume(settingsFace());
        top.show(true);
        bottom.show(true);
      }
      if (f >= 6 && !settled) { settled = true; accepting = true; }
      const amp = Math.min(1, f / 6);
      const size = f < 3 ? 250 + 20 * f : f < 6 ? 310 - 20 * (f - 3) : 250;
      return {
        x: c.x, y: c.y + amp * 10 * sinD(mover0 + 2 * f), size,
        direction: 90 + c.rot + amp * 10 * sinD(spin0 + 2 * f),
      };
    };
  }
  const settingsFace = () => settings.mode;

  /** Correct: the card glows and spins away to the left. */
  function flyAway() {
    const from = cardPose, t0 = now, spinner = randInt(-5, 5);
    front.setCostume('CardGlow');
    top.setEffects({ brightness: 80 });
    bottom.setEffects({ brightness: 80 });
    for (const d of entryDigits) d.setEffects({ color: 80 });
    cardAnim = (t) => {
      const f = Math.min(10, (t - t0) * FPS);
      if (f >= 10) hideCard();
      const size = f < 1 ? 250 + 150 * f : f < 2 ? 400 - 100 * (f - 1) : 300 + 10 * (f - 2);
      return { x: from.x - (10 * (2.4 ** f - 1)) / 1.4, y: from.y, size, direction: from.direction + spinner * f };
    };
  }

  /** Wrong: the card slides right, then turns face down and slips back under the deck. */
  function slideBack(c: Card) {
    const from = cardPose, t0 = now, spinner = randInt(-1, 1);
    let reversed = false;
    cardAnim = (t) => {
      const f = (t - t0) * FPS;
      const x = from.x + 64 * f - 4 * f * f;
      if (f >= 8 && !reversed) {
        reversed = true;
        front.setCostume('CardBack');
        front.el.style.zIndex = '5';
        top.show(false);
        bottom.show(false);
        for (const d of entryDigits) d.show(false);
      }
      if (reversed && x < -100) {
        hideCard();
        c.z = Math.min(...deck.map(d => d.z)) - 1;   // back of the pile
        c.back.el.style.zIndex = String(c.z);
        scope.run(async () => { await scope.wait(0.1); c.back.show(true); });
      }
      return { x, y: from.y, size: from.size, direction: from.direction + spinner * f };
    };
  }

  function hideCard() {
    cardAnim = null;
    for (const s of [front, top, bottom, ...entryDigits]) s.show(false);
  }

  // ---- answers ----
  function press(key: string) {
    if (!accepting) return;
    if (key === 'enter') return enter();
    if (key === 'delete') {
      if (entry) void play('Pop');
      entry = '';
    } else {
      const next = calculatorType(entry, key, CARD_MAX_DIGITS);
      if (!next) void play('Pop');
      entry = next;
      void play('CalcButton');
    }
    showEntry();
    popEntry();
  }

  function popEntry() {
    const t0 = now;
    entryPop = (t) => { const f = (t - t0) * FPS; return f < 2 ? 290 - 15 * f : 250; };
  }
  let entryPop: ((t: number) => number) | null = null;

  function enter() {
    if (!entry) return;                // an empty Enter doesn't cost points (Mad Dad counted it wrong)
    accepting = false;
    void play('Enter');
    stopTimer();
    if (+entry === card().problem.answer) correct(); else wrong(false);
  }

  function timeOut() {
    if (!accepting) return;
    accepting = false;
    wrong(true);
  }

  function correct() {
    const points = pointsForCorrect(secondsLeft, settings.seconds, streak);
    score += points;
    showScore();
    popup(points);
    flyAway();
    stopAll();
    streak++;
    deck.splice(cur, 1)[0].back.remove();
    cur--;
    scope.run(async () => {
      await correctSounds();
      if (!deck.length) return gameOver();
      if (cur < 0) cur = deck.length - 1;
      startTimer();
      flip();
    });
  }

  function wrong(timedOut: boolean) {
    const c = card();
    score = clampScore(score - WRONG_PENALTY);
    showScore();
    popup(-WRONG_PENALTY);
    streak = 0;
    flash = { start: now };
    slideBack(c);
    stopAll();
    void play('Wrong');
    scope.run(async () => {
      await scope.wait(0.25);
      if (timedOut ? Math.random() < 0.5 : Math.random() < 0.3) void play(timedOut ? pick('Slow', 1, 8) : pick('Wrong', 1, 6));
      await scope.wait(0.5);
      cur = cur - 1 < 0 ? deck.length - 1 : cur - 1;
      startTimer();
      flip();
    });
  }

  /** Mad Dad's CorrectSounds: chime, then a streak cheer, a countdown, or sometimes a "correct" line. */
  async function correctSounds() {
    void play('Correct');
    await scope.wait(0.25);
    const cheer = { 3: 'Good Three In A Row', 10: 'Good You Are On Role', 20: 'Good Fantastic' }[streak];
    const left = deck.length;
    if (cheer) { void play(cheer); await scope.wait(0.5); return; }
    if ([30, 20, 10, 5, 1].includes(left)) { void play(`Card${left}`); await scope.wait(0.5); }
    else if (left > 2 && Math.random() < 0.5) void play(pick('Correct', 1, 5));
    await scope.wait(0.5);
  }

  /** Score popup: rises from the top of the screen and grows (Mad Dad's "Boom"). */
  function popup(points: number) {
    const label = popupLabel(points);
    boom.setCostume(label === 'HUGE' ? 'huge' : label === 'WOW' ? 'wow' : label.replace('−', '-')).show(true);
    const t0 = now, vx = rand(3, 6), vy = rand(3, 6);
    boomAnim = (t) => {
      const f = (t - t0) * FPS;
      if (f >= 10) { boom.show(false); boomAnim = null; return; }
      boom.setPose({ x: vx * f - 0.05 * f * f, y: 106 + vy * f, size: 100 + 10 * f });
    };
  }
  let boomAnim: ((t: number) => void) | null = null;

  function gameOver() {
    accepting = false;
    stopTimer();
    keysShown = false;
    onGameOver({ score: Math.round(score), questions: n, attempts, kind: 'card' });
  }

  // ---- keyboard ----
  const onKey = (e: KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === ' ' || e.key === 'Enter') press('enter');
    else if (e.key === 'Backspace' || e.key === 'ArrowLeft') press('delete');
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  // ---- start: shuffle and deal, bring in the calculator, flip the first card ----
  scope.run(async () => {
    showScore();
    scope.run(async () => {
      await scope.wait(0.7 + n * 0.105);
      calculator.setPose({ x: 133, y: -275, direction: 85 }).show(true);
      for (const d of scoreDigits) d.sprite.setPose({ x: d.x, y: d.y, size: 22, direction: 85 }).show(true);
      void play('Calculator');
      await scope.tween(0.1, p => calculator.setPose({ y: -275 + 230 * p }));
      await scope.wait(0.1);
      keysShown = true;
      for (const k of keys) k.show(true);
    });
    await scope.wait(1);
    void play(pick('Start', 1, 4));
    void play('Shuffle');
    scope.run(deal);
    await scope.wait(0.5 + n * 0.105);
    startTimer();
    flip();
    void play('Go1');
    await scope.wait(0.4);
    void play(pick('Gunshot', 1, 4));
  });

  let lastFlicker = -1;
  return {
    /** for tests and debugging */
    get state() { return { problem: deck[cur]?.problem, accepting, entry, score, streak, attempts, left: deck.length }; },
    press,
    update(t: number) {
      now = t;
      const anim = cardAnim;
      if (anim) {
        const p = anim(t);
        if (cardAnim === anim) {   // (the animation may have just finished and hidden the card)
          cardPose = p;
          front.setPose(p);
          top.setPose(p);
          bottom.setPose(p);
          const size = entryPop ? entryPop(t) * (p.size / 250) : p.size;
          for (const d of entryDigits) d.setPose({ ...p, size });
        }
      }
      boomAnim?.(t);
      // wrong-answer flash: the desk goes red and dark, then fades back over 10 frames
      const ff = (t - flash.start) * FPS;
      backdrop.setEffects(flash.start >= 0 && ff < 10 ? { color: -30 + 3 * ff, brightness: -20 + 2 * ff } : {});
      // Mad Dad's buzzing calculator: frames cycle and keys/screen flicker 30 times a second
      const frame = Math.floor(t * FPS);
      if (frame !== lastFlicker) {
        lastFlicker = frame;
        calculator.setCostume((frame % 4) + 1);
        if (keysShown) for (const k of keys) k.setEffects({ ghost: rand(0, 40) });
        for (const d of scoreDigits) {
          d.sprite.setPose({ y: d.y + rand(-1, 1), size: rand(20, 24) })
            .setEffects({ ghost: rand(5, 10), color: rand(-10, 10), brightness: rand(50, 70) });
        }
      }
    },
    destroy() {
      scope.cancel();
      stopTimer();
      window.removeEventListener('keydown', onKey);
      for (const s of [backdrop, front, top, bottom, ...entryDigits, calculator, ...keys, boom, ...scoreDigits.map(d => d.sprite), ...deck.map(c => c.back)]) s.remove();
    },
  };
}
