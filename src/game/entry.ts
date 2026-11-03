// Answer entry rules (SPEC.md §2, §3, §4, §5). Entries are digit strings; '' means nothing typed.

/** Calculator-style: each digit pushes the others left; typing past `max` digits clears the entry. */
export function calculatorType(entry: string, digit: string, max: number): string {
  return entry.length >= max ? '' : entry + digit;
}

/**
 * Pad (column) style: the first digit typed is the ones place, then tens, and so on.
 * Returned string is the number as read left to right. Typing past `max` digits clears it.
 */
export function columnType(entry: string, digit: string, max: number): string {
  return entry.length >= max ? '' : digit + entry;
}

export const CARD_MAX_DIGITS = 3;
export const CLOCK_MAX_DIGITS = 4;
export const PAD_MAX_DIGITS = 5;
