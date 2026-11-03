// Game modes, settings options and problem generation (SPEC.md §1, §3, §4, §5).

export const MODES = [
  'Multiplication', 'SimpleAddition', '2DigitAddition', 'SimpleSubtraction', '2DigitSubtraction', 'Division',
  'ClockMinutes', 'ClockHours', 'ClockHard', '4DigitAddition', '4DigitSubtraction',
] as const;
export type Mode = (typeof MODES)[number];

export type Kind = 'card' | 'clock' | 'pad';
export const kindOf = (mode: Mode): Kind =>
  mode.startsWith('Clock') ? 'clock' : mode.startsWith('4Digit') ? 'pad' : 'card';

export const CARD_COUNTS = [5, 10, 25, 50, 100] as const;
export const TIMER_SECONDS = [3, 5, 10, 15, 20, 30, 60, Infinity] as const;
export const DEFAULT_SETTINGS = { mode: 'Multiplication' as Mode, cards: 5, seconds: 20 };

/** Uniform random integer in [lo, hi], inclusive (Scratch's "pick random"). */
export type Rng = () => number;
export const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

export type ArithmeticProblem = { top: number; bottom: number; op: '+' | '−' | '×' | '÷'; answer: number };

export function arithmeticProblem(mode: Mode, rng: Rng = Math.random): ArithmeticProblem {
  switch (mode) {
    case 'Multiplication': {
      const top = randInt(rng, 1, 11), bottom = randInt(rng, 1, 11);
      return { top, bottom, op: '×', answer: top * bottom };
    }
    case 'SimpleAddition': {
      const top = randInt(rng, 1, 12), bottom = randInt(rng, 1, 12);
      return { top, bottom, op: '+', answer: top + bottom };
    }
    case '2DigitAddition': {
      const top = randInt(rng, 10, 99), bottom = randInt(rng, 1, 9);
      return { top, bottom, op: '+', answer: top + bottom };
    }
    case 'SimpleSubtraction': {
      const bottom = randInt(rng, 1, 9), top = bottom + randInt(rng, 1, 10);
      return { top, bottom, op: '−', answer: top - bottom };
    }
    case '2DigitSubtraction': {
      const top = randInt(rng, 10, 99), bottom = randInt(rng, 1, 9);
      return { top, bottom, op: '−', answer: top - bottom };
    }
    case 'Division': {
      const bottom = randInt(rng, 1, 9), answer = randInt(rng, 1, 10);
      return { top: bottom * answer, bottom, op: '÷', answer };
    }
    case '4DigitAddition': {
      const top = randInt(rng, 100, 9999), bottom = randInt(rng, 100, 9999);
      return { top, bottom, op: '+', answer: top + bottom };
    }
    case '4DigitSubtraction': {
      // Never worked in Mad Dad (it checked the sum); this is the intended version.
      const top = randInt(rng, 1000, 9999), bottom = randInt(rng, 1, top);
      return { top, bottom, op: '−', answer: top - bottom };
    }
    default:
      throw new Error(`${mode} is not an arithmetic mode`);
  }
}

export type ClockTime = { hour: number; minute: number };
export const clockTime = (rng: Rng = Math.random): ClockTime => ({ hour: randInt(rng, 1, 12), minute: randInt(rng, 0, 59) });

/** Clock answers are typed as H:MM or HH:MM digits. Hour must match; minutes may be off by one. */
export function clockAnswerCorrect(time: ClockTime, digits: string): boolean {
  if (digits.length < 3) return false;
  const hour = +digits.slice(0, -2), minute = +digits.slice(-2);
  return hour === time.hour && Math.abs(minute - time.minute) <= 1;
}
