import { describe, expect, it } from 'vitest';
import { spokenNumber } from './spoken';

describe('spoken numbers', () => {
  it.each([
    ['16', 16], ['sixteen', 16], ['Sixteen.', 16], ['twenty one', 21], ['twenty-one', 21], ['forty two', 42],
    ['one hundred', 100], ['a hundred and five', 105], ['one hundred twenty one', 121], ['121', 121],
    ['one six', 16], ['1 6', 16], ['zero', 0], ['oh', 0], ['to', 2], ['for', 4], ['ate', 8],
    ["it's 16", 16], ['um sixteen', 16], ['the answer is 72', 72], ['1,000', 1000], ['two thousand five', 2005],
  ])('"%s" is %d', (heard, n) => expect(spokenNumber(heard)).toBe(n));

  it.each(['', 'banana', 'is it for me', 'yes', 'and', 'sixteen bananas'])('"%s" is not a number', (heard) => {
    expect(spokenNumber(heard)).toBeNull();
  });
});
