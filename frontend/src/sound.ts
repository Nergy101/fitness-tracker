// Workout audio cues + TTS, with a global mute flag shared across the app.

const STORAGE_KEY = "muted";

let muted =
  typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1";

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore storage failures
  }
  if (value) {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
  }
}

// One shared AudioContext — creating a new one per cue exhausts the browser's
// context cap (~6) and silently kills audio mid-workout.
let audioCtx: AudioContext | null = null;

interface Note {
  freq: number;
  start: number; // seconds from now
  dur: number;
}

function tones(seq: Note[], vibe?: number | number[]): void {
  if (muted) return;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    if (!audioCtx) audioCtx = new Ctor();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    for (const n of seq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = n.freq;
      const s = t0 + n.start;
      gain.gain.setValueAtTime(0.0001, s);
      gain.gain.exponentialRampToValueAtTime(0.3, s + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + n.dur);
      osc.start(s);
      osc.stop(s + n.dur + 0.02);
    }
    if (vibe !== undefined && navigator.vibrate) navigator.vibrate(vibe);
  } catch {
    // AudioContext may be unavailable (autoplay policy / SSR); ignore.
  }
}

// Rising two-note cue — an exercise is starting.
export const soundStart = () =>
  tones(
    [
      { freq: 660, start: 0, dur: 0.12 },
      { freq: 990, start: 0.12, dur: 0.16 },
    ],
    120,
  );

// Single soft lower tone — exercise done, resting now.
export const soundRest = () => tones([{ freq: 440, start: 0, dur: 0.28 }], 80);

// Triumphant C-E-G rise — the whole workout is complete.
export const soundFinish = () =>
  tones(
    [
      { freq: 523, start: 0, dur: 0.15 },
      { freq: 659, start: 0.15, dur: 0.15 },
      { freq: 784, start: 0.3, dur: 0.32 },
    ],
    [120, 60, 200],
  );

// Preferred TTS voice — Apple's "Daniel" (en-GB). Voices populate
// asynchronously, so cache the pick and refresh on `voiceschanged`.
let preferredVoice: SpeechSynthesisVoice | null = null;

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (!voices.length) return preferredVoice;
  preferredVoice =
    voices.find((v) => v.name === "Daniel" && v.lang === "en-GB") ??
    voices.find((v) => v.name === "Daniel") ??
    voices.find((v) => v.lang === "en-GB") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
  return preferredVoice;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  // Prime the cache; the event fires once voices are ready.
  pickVoice(window.speechSynthesis);
  window.speechSynthesis.addEventListener("voiceschanged", () =>
    pickVoice(window.speechSynthesis),
  );
}

export function speak(text: string): void {
  if (muted || !text) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel(); // drop any queued/in-progress utterance
    const u = new SpeechSynthesisUtterance(text);
    const voice = preferredVoice ?? pickVoice(synth);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.rate = 1;
    u.pitch = 1;
    synth.speak(u);
  } catch {
    // speechSynthesis missing or blocked; ignore.
  }
}
