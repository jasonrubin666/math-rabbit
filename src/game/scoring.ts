// Scoring and streaks (SPEC.md §7).

export const WRONG_PENALTY = 5;

/**
 * Points for a correct answer: 5, plus up to 5 for speed, plus a streak bonus.
 * `streakBefore` is the streak before this answer counts (Mad Dad's order of operations).
 */
export function pointsForCorrect(secondsLeft: number, fullSeconds: number, streakBefore: number): number {
  const speed = Number.isFinite(fullSeconds) ? Math.max(0, Math.min(1, secondsLeft / fullSeconds)) : 1;
  // whole points (Mad Dad allowed fractions like 9.5, which its digit display then mis-rounded)
  return Math.round(5 + 5 * speed) + Math.round(streakBefore / 3);
}

/** What the score popup shows. */
export function popupLabel(points: number): string {
  if (points < 0) return `−${Math.abs(points)}`;
  if (points < 10) return String(Math.floor(points));
  return points > 12 ? 'WOW' : 'HUGE';
}

export const clampScore = (score: number) => Math.max(0, score);

/** Report-card percentage: questions answered correctly ÷ total attempts. */
export const percentCorrect = (questions: number, attempts: number) =>
  attempts === 0 ? 100 : Math.round((100 * questions) / attempts);
