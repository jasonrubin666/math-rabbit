// Listening for spoken answers, with the browser's built-in speech recognizer (Safari on iPad and Mac,
// Chrome, Edge; Firefox has none). It listens continuously while on, and restarts itself whenever the
// browser stops it (they stop after a pause or a time limit). The browser asks for the microphone the
// first time; on Safari the speech is recognized by Apple, on Chrome by Google.

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
  .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

export const voiceSupported = !!Ctor;

const KEY = 'math-rabbit-voice';
/** Whether the player turned voice answers on, remembered on this device. */
export const voiceWanted = () => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } };
export const setVoiceWanted = (on: boolean) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* not kept */ } };

export type Listener = {
  /** Called with each thing heard: every alternative the recognizer offers, best first. `final` is false while still talking. */
  onHeard: (alternatives: string[], final: boolean) => void;
  /** The microphone was refused or isn't available. */
  onDenied?: () => void;
};

/** Starts listening; call the returned function to stop. Must first be called from a tap on iPad. */
export function listen(l: Listener): () => void {
  if (!Ctor) return () => {};
  let on = true;
  let rec: Recognition | null = null;
  let restarts = 0;

  const start = () => {
    if (!on) return;
    rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.onresult = (e) => {
      restarts = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        l.onHeard(Array.from(r, a => a.transcript.trim()).filter(Boolean), r.isFinal);
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        on = false;
        l.onDenied?.();
      }
    };
    rec.onend = () => {
      // the browser ended it (silence, time limit, a hiccup): start again, backing off if it keeps failing
      if (!on) return;
      restarts++;
      setTimeout(start, Math.min(2000, 100 * restarts));
    };
    try { rec.start(); } catch { /* already running */ }
  };
  start();

  return () => {
    on = false;
    try { rec?.abort(); } catch { /* not running */ }
    rec = null;
  };
}
