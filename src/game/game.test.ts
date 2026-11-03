import { describe, expect, it } from 'vitest';
import { MODES, arithmeticProblem, clockAnswerCorrect, kindOf, type Mode } from './modes';
import { percentCorrect, pointsForCorrect, popupLabel } from './scoring';
import { calculatorType, columnType } from './entry';

const arithmetic = MODES.filter(m => kindOf(m) !== 'clock') as Mode[];

describe('problems', () => {
  it.each(arithmetic)('%s stays in range and is consistent', (mode) => {
    for (let i = 0; i < 2000; i++) {
      const p = arithmeticProblem(mode);
      const expected = { '+': p.top + p.bottom, '−': p.top - p.bottom, '×': p.top * p.bottom, '÷': p.top / p.bottom }[p.op];
      expect(p.answer).toBe(expected);
      expect(Number.isInteger(p.answer)).toBe(true);
      expect(p.answer).toBeGreaterThanOrEqual(0);
    }
  });

  it('matches the Mad Dad ranges', () => {
    const lo = (rng: () => number) => arithmeticProblem('Multiplication', rng);
    expect(lo(() => 0)).toMatchObject({ top: 1, bottom: 1 });
    expect(lo(() => 0.999999)).toMatchObject({ top: 11, bottom: 11 });
    expect(arithmeticProblem('SimpleSubtraction', () => 0)).toMatchObject({ bottom: 1, top: 2, answer: 1 });
    expect(arithmeticProblem('Division', () => 0.999999)).toMatchObject({ bottom: 9, top: 90, answer: 10 });
  });
});

describe('clock answers', () => {
  it('needs the exact hour and minutes within one', () => {
    const t = { hour: 3, minute: 30 };
    expect(clockAnswerCorrect(t, '330')).toBe(true);
    expect(clockAnswerCorrect(t, '331')).toBe(true);
    expect(clockAnswerCorrect(t, '329')).toBe(true);
    expect(clockAnswerCorrect(t, '332')).toBe(false);
    expect(clockAnswerCorrect(t, '430')).toBe(false);
    expect(clockAnswerCorrect({ hour: 12, minute: 5 }, '1205')).toBe(true);
    expect(clockAnswerCorrect({ hour: 12, minute: 5 }, '30')).toBe(false);
  });
});

describe('scoring', () => {
  it('rewards speed and streaks', () => {
    expect(pointsForCorrect(20, 20, 0)).toBe(10);
    expect(pointsForCorrect(0, 20, 0)).toBe(5);
    expect(pointsForCorrect(10, 20, 6)).toBe(10);
    expect(pointsForCorrect(7, 20, 0)).toBe(7);
    expect(pointsForCorrect(0, Infinity, 0)).toBe(10);
  });
  it('labels popups like the original', () => {
    expect(popupLabel(7.5)).toBe('7');
    expect(popupLabel(11)).toBe('HUGE');
    expect(popupLabel(14)).toBe('WOW');
    expect(popupLabel(-5)).toBe('−5');
  });
  it('computes percentage from attempts', () => {
    expect(percentCorrect(5, 5)).toBe(100);
    expect(percentCorrect(5, 8)).toBe(63);
  });
});

describe('entry', () => {
  it('types calculator-style and clears past the limit', () => {
    expect(['1', '2', '3'].reduce((e, d) => calculatorType(e, d, 3), '')).toBe('123');
    expect(calculatorType('123', '4', 3)).toBe('');
  });
  it('types pad answers ones place first', () => {
    expect(['5', '2', '1'].reduce((e, d) => columnType(e, d, 5), '')).toBe('125');
  });
});
