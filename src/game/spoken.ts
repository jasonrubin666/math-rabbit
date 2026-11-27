// Reading spoken answers: what the speech recognizer heard → a number.
// Recognizers return digits ("16") or words ("sixteen", "one hundred and five"), and sometimes
// sound-alikes for short words ("to" for 2, "for" for 4), so all of those count.

const ONES: Record<string, number> = {
  zero: 0, oh: 0, o: 0, nought: 0,
  one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, fore: 4, five: 5,
  six: 6, seven: 7, eight: 8, ate: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const words = (text: string) =>
  text.toLowerCase().replace(/(\d),(\d)/g, '$1$2').replace(/-/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);

/**
 * The number in what was heard, or null if there isn't exactly one. "16", "sixteen", "a hundred and
 * five" and "one six" (digit by digit) all work; filler like "it's" or "um" is skipped. If the phrase has
 * a word that is neither a number nor filler, it doesn't count, so a sentence with "for" in it isn't a 4.
 */
export function spokenNumber(text: string): number | null {
  const ws = words(text).filter(w => !FILLER.has(w));
  if (!ws.length) return null;
  // a recognizer that writes digits: "16", or "1 6" said digit by digit
  if (ws.every(w => /^\d+$/.test(w))) return +ws.join('');

  // said digit by digit: "one six", "1 six"
  const digit = (w: string) => (/^\d$/.test(w) ? +w : w in ONES && ONES[w] < 10 ? ONES[w] : null);
  if (ws.length > 1 && ws.every(w => digit(w) !== null)) return +ws.map(digit).join('');

  // words: "one hundred and twenty one", "a hundred", "two thousand five"
  let total = 0, group = 0, any = false;
  for (const [i, w] of ws.entries()) {
    if (w === 'and' && any) continue;
    if (w === 'a' && i === 0) { group = 1; continue; }   // "a hundred"
    if (/^\d+$/.test(w)) group += +w;
    else if (w in ONES) group += ONES[w];
    else if (w in TENS) group += TENS[w];
    else if (w === 'hundred') group = (group || 1) * 100;
    else if (w === 'thousand') { total += (group || 1) * 1000; group = 0; }
    else return null;   // a word that isn't part of a number
    any = true;
  }
  return any ? total + group : null;
}

/** Filler around an answer: "it's sixteen", "the answer is 16", "um, 16". */
const FILLER = new Set(['um', 'uh', 'umm', 'uhh', 'er', 'hmm', 'its', 'it', 's', 'is', 'the', 'answer', 'i', 'think', 'say', 'equals', 'makes', 'that', 'thats', 'like']);
