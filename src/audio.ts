// Sound playback over Web Audio. iPad Safari only plays audio after a tap, so call unlock() from one.
// Voice clips go through an analyser so the rabbit's jaw can follow how loud the speech is.
import urls from 'virtual:sounds';

const ctx = new AudioContext();
const out = ctx.createGain();
out.connect(ctx.destination);
const voiceBus = ctx.createAnalyser();
voiceBus.fftSize = 512;
voiceBus.connect(out);
const levelBuf = new Float32Array(voiceBus.fftSize);

const buffers = new Map<string, Promise<AudioBuffer | null>>();
const playing = new Set<AudioBufferSourceNode>();

/** Clips of someone talking (the host's lines). */
const VOICE = /^(MadDad|Family\d|Start\d|Correct\d|Wrong\d|Slow\d|Good |Card\d|Clock\d|Clock3Wrong|GameOver\d|100-|SettingsOperator|WhatTime)/;
/** The per-question timer music: the timer start and its tick-tock loop. */
const TIMER_MUSIC = /^(Timer|TicTok)$/;
/** The background music on the title screen and report card. */
const BACKGROUND_MUSIC = /^music_/;

/**
 * Switched off for now. Every call to play() stays in place, and the sounds are still loaded by name,
 * so setting a flag back to true brings that group back.
 */
export const SOUND_ON = { timerMusic: false, backgroundMusic: false, voice: true };

const isOn = (name: string) =>
  (SOUND_ON.timerMusic || !TIMER_MUSIC.test(name)) &&
  (SOUND_ON.backgroundMusic || !BACKGROUND_MUSIC.test(name)) &&
  (SOUND_ON.voice || !VOICE.test(name));

export function unlock() {
  if (ctx.state !== 'running') void ctx.resume();
}

function load(name: string): Promise<AudioBuffer | null> {
  let b = buffers.get(name);
  if (!b) {
    const url = urls[name];
    b = url
      ? fetch(url).then(r => r.arrayBuffer()).then(data => ctx.decodeAudioData(data)).catch(() => null)
      : Promise.resolve(null);
    if (!url) console.warn(`[audio] no sound named "${name}"`);
    buffers.set(name, b);
  }
  return b;
}

export const preload = (names: string[]) => Promise.all(names.map(load));

/** Plays a sound; resolves when it finishes (or immediately if it's missing or gets stopped). */
export async function play(name: string): Promise<void> {
  if (!isOn(name)) return;
  const buffer = await load(name);
  if (!buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(VOICE.test(name) ? voiceBus : out);
  playing.add(src);
  await new Promise<void>(done => {
    src.onended = () => { playing.delete(src); done(); };
    src.start();
  });
}

export function stopAll() {
  for (const src of playing) {
    try { src.stop(); } catch { /* already stopped */ }
  }
  playing.clear();
}

/** 0..1 loudness of whatever voice clip is playing right now. */
export function voiceLevel(): number {
  voiceBus.getFloatTimeDomainData(levelBuf);
  let sum = 0;
  for (const v of levelBuf) sum += v * v;
  return Math.min(1, Math.sqrt(sum / levelBuf.length) * 6);
}

export const pick = (prefix: string, from: number, to: number) => `${prefix}${from + Math.floor(Math.random() * (to - from + 1))}`;
