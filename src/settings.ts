// Player settings (Mode / Cards / Timer), remembered on this device.
import { CARD_COUNTS, DEFAULT_SETTINGS, TIMER_SECONDS, kindOf, MODES, type Mode } from './game/modes';

export type Settings = { mode: Mode; cards: number; seconds: number };

const KEY = 'math-rabbit-settings';

/** Modes the rewrite can play so far. */
export const PLAYABLE_MODES = MODES.filter(m => kindOf(m) === 'card');

export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && PLAYABLE_MODES.includes(s.mode) && (CARD_COUNTS as readonly number[]).includes(s.cards)) {
      return { mode: s.mode, cards: s.cards, seconds: s.seconds === null ? Infinity : s.seconds };
    }
  } catch { /* private mode or bad data: use defaults */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not persisted */ }
}

/** Step to the next/previous option, wrapping around like the Mad Dad arrows. */
export function step<T>(options: readonly T[], current: T, by: 1 | -1): T {
  const i = options.indexOf(current);
  return options[(i + by + options.length) % options.length];
}

export const TIMER_OPTIONS = TIMER_SECONDS;
export const CARD_OPTIONS = CARD_COUNTS;
