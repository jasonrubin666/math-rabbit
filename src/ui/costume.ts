/**
 * Scratch's "switch costume to", given a sprite's costume names in order:
 * - a number picks by position, counted from 1 and wrapping around (so 0 is the last costume);
 * - text picks the costume with that name, falling back to a position if it looks like a number.
 *
 * The difference matters: Mad Dad's NumberTop costumes are in numeric order but their names are
 * scrambled (the costume named "50" shows 13), and the game always switched to them by number.
 */
export function resolveCostume(names: readonly string[], costume: string | number): number {
  if (typeof costume === 'string') {
    const i = names.indexOf(costume);
    if (i >= 0) return i + 1;
  }
  const n = Math.round(Number(costume));
  if (Number.isNaN(n)) throw new Error(`no costume "${costume}" (has ${names.join(', ')})`);
  const count = names.length;
  return (((n - 1) % count) + count) % count + 1;
}
