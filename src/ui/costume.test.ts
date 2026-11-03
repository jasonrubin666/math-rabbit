import { describe, expect, it } from 'vitest';
import { resolveCostume } from './costume';
import costumes from '../data/costumes.json';

const namesOf = (sprite: string) =>
  Object.entries(costumes as Record<string, { name: string }>)
    .filter(([k]) => k.startsWith(sprite + '/'))
    .sort(([a], [b]) => +a.split('/')[1] - +b.split('/')[1])
    .map(([, c]) => c.name);

describe('switching costumes like Scratch', () => {
  it('picks card numbers by position, not by their scrambled names', () => {
    const names = namesOf('NumberTop');
    expect(names[12]).toBe('50');            // costume 13 is named "50" but shows 13
    for (let n = 1; n <= 99; n++) expect(resolveCostume(names, n)).toBe(n);
  });
  it('picks named costumes by name', () => {
    expect(resolveCostume(namesOf('Cards'), '25')).toBe(3);
    expect(resolveCostume(namesOf('FrontCard'), 'CardGlow')).toBe(namesOf('FrontCard').indexOf('CardGlow') + 1);
  });
  it('wraps 0 to the last costume', () => {
    expect(resolveCostume(namesOf('FinalScoreOnes'), 0)).toBe(namesOf('FinalScoreOnes').length);
  });
});
