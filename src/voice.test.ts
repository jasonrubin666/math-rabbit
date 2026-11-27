import { beforeAll, describe, expect, it } from 'vitest';

// A stand-in for Safari's recognizer, which hands back every result so far with each event.
class FakeRecognition {
  static live: FakeRecognition[] = [];
  results: ({ transcript: string }[] & { isFinal: boolean })[] = [];
  onresult: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
  start() { FakeRecognition.live.push(this); }
  abort() { FakeRecognition.live = FakeRecognition.live.filter(r => r !== this); }
  say(text: string, isFinal: boolean) {
    const last = this.results[this.results.length - 1];
    const res = Object.assign([{ transcript: text }], { isFinal });
    if (last && !last.isFinal) this.results[this.results.length - 1] = res; else this.results.push(res);
    this.onresult?.({ resultIndex: 0, results: this.results });   // Safari: always from 0
  }
}

let voice: typeof import('./voice');
beforeAll(async () => {
  (globalThis as Record<string, unknown>).window = { webkitSpeechRecognition: FakeRecognition };
  voice = await import('./voice');
});
const rec = () => FakeRecognition.live[FakeRecognition.live.length - 1];

describe('voice listener', () => {
  it('passes each finished result on once, even when Safari sends them all again', () => {
    const heard: string[] = [];
    voice.onVoice({ onHeard: (a, final) => { if (final) heard.push(a[0]); } });
    voice.setVoice(true, false);
    rec().say('15', false);
    rec().say('15', true);
    rec().say('yes', true);
    rec().say('7', true);
    expect(heard).toEqual(['15', 'yes', '7']);
  });

  it('forgets the last question when reset', () => {
    const heard: string[] = [];
    voice.onVoice({ onHeard: (a, final) => heard.push(`${a[0]}${final ? '' : '…'}`) });
    const old = rec();
    old.say('15', false);
    voice.resetVoice();
    old.say('15', true);   // the old recognizer finishing late is ignored
    expect(FakeRecognition.live).not.toContain(old);
    rec().say('8', true);
    expect(heard).toEqual(['15…', '8']);
  });
});
