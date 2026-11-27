// Listening for spoken answers, with the browser's built-in speech recognizer (Safari on iPad and Mac,
// Chrome, Edge; Firefox has none). One listener serves the whole game: it starts from the first tap
// (so the browser asks for the microphone on the title screen, and iPad allows it), keeps listening, and
// restarts itself whenever the browser stops it (they stop after a pause or a time limit). Whichever
// screen is up receives what's heard. On Safari the speech is recognized by Apple, on Chrome by Google.

type Result = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const W = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;

export const voiceSupported = !!Ctor;

const KEY = 'math-rabbit-voice';
/** Voice answers are on unless the player turned them off on this device. */
export const voiceWanted = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
const setVoiceWanted = (on: boolean) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* not kept */ } };

export type VoiceHandler = {
  /** Each thing heard: every alternative the recognizer offers, best first. `final` is false while still talking. */
  onHeard: (alternatives: string[], final: boolean) => void;
  /** The microphone was refused or isn't available. */
  onDenied?: () => void;
};

let on = false;
let rec: Recognition | null = null;
let restarts = 0;
let handler: VoiceHandler | null = null;

function start() {
  if (!on || !Ctor) return;
  const r = new Ctor();
  rec = r;
  r.lang = 'en-US';
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 5;
  // Safari hands back every result so far with each event, not just the new ones, so finished results are
  // counted and passed on once each; otherwise an answer already entered would come back on the next card
  let finals = 0;
  r.onresult = (e) => {
    if (rec !== r) return;   // a recognizer that has been replaced
    restarts = 0;
    for (let i = Math.max(e.resultIndex, finals); i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finals = i + 1;
      handler?.onHeard(Array.from(res, a => a.transcript.trim()).filter(Boolean), res.isFinal);
    }
  };
  r.onerror = (e) => {
    if (rec !== r) return;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
      on = false;
      rec = null;
      handler?.onDenied?.();
    }
  };
  r.onend = () => {
    // the browser ended it (silence, time limit, a hiccup): start again, backing off if it keeps failing
    if (rec !== r || !on) return;
    restarts++;
    setTimeout(() => { if (rec === r) start(); }, Math.min(2000, 100 * restarts));
  };
  try { r.start(); } catch { /* already running */ }
}

function stop() {
  const r = rec;
  rec = null;
  try { r?.abort(); } catch { /* not running */ }
}

/** Turn listening on or off (from a tap, the first time, for iPad), and remember the choice. */
export function setVoice(want: boolean, remember = true) {
  if (remember) setVoiceWanted(want);
  if (want === on) return;
  on = want && voiceSupported;
  if (on) start(); else stop();
}

export const voiceOn = () => on;

/** Forget anything half-heard and listen afresh (a new question is up). */
export function resetVoice() {
  if (!on) return;
  stop();
  start();
}

/** The screen that gets what's heard; returns a function that stops sending it there. */
export function onVoice(h: VoiceHandler): () => void {
  handler = h;
  return () => { if (handler === h) handler = null; };
}
