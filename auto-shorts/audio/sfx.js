'use strict';
/**
 * Procedural sound-effect synthesis.
 *
 * The spec rules out paid stock services, and shipping a library of licensed
 * one-shots is not an option either. So the whole SFX palette is synthesized
 * here in plain JavaScript and written out as 48 kHz stereo WAV files the first
 * time the server boots. They are real audio files with real waveforms — noise
 * bursts through moving filters, pitched sweeps, and enveloped transients.
 *
 * Every effect is deliberately short and mixed low. Sound design that announces
 * itself is worse than none at all.
 */

const fs = require('fs');
const path = require('path');

const SR = 48000;

/* ---------------------------------------------------------------- helpers */

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Exponential decay envelope, optionally with a short fade-in to kill clicks. */
function envDecay(t, dur, { attack = 0.004, curve = 4 } = {}) {
  if (t < attack) return t / attack;
  const x = (t - attack) / Math.max(1e-6, dur - attack);
  return Math.exp(-curve * x) * (1 - clamp(x, 0, 1) * 0.15);
}

/** Symmetric rise/fall envelope for whooshes. */
function envSwell(t, dur, { peak = 0.45 } = {}) {
  const x = t / dur;
  const p = clamp(peak, 0.05, 0.95);
  return x < p
    ? Math.pow(x / p, 1.6)
    : Math.pow(1 - (x - p) / (1 - p), 2.0);
}

/** One-pole low-pass. Called per sample with a moving cutoff. */
function makeLowpass() {
  let z = 0;
  return (x, cutoffHz) => {
    const c = clamp(cutoffHz, 20, SR / 2 - 100);
    const a = 1 - Math.exp((-2 * Math.PI * c) / SR);
    z += a * (x - z);
    return z;
  };
}

/** One-pole high-pass derived from the low-pass. */
function makeHighpass() {
  const lp = makeLowpass();
  return (x, cutoffHz) => x - lp(x, cutoffHz);
}

/** Deterministic noise so builds are reproducible. */
function makeNoise(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

/** Soft saturation — keeps transients punchy without hard clipping. */
function softClip(x) {
  return Math.tanh(x * 1.4) / Math.tanh(1.4);
}

/* ------------------------------------------------------------- generators */

/**
 * Each generator returns mono Float32 samples. Stereo width is applied later.
 */
const GENERATORS = {
  /** Low, round thump for a reveal. Sine sweeping down + filtered noise body. */
  impact(dur = 0.60) {
    const n = Math.floor(SR * dur);
    const out = new Float32Array(n);
    const noise = makeNoise(7001);
    const lp = makeLowpass();
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const x = t / dur;
      const freq = 150 * Math.exp(-5.5 * x) + 42;      // 150 Hz -> 42 Hz
      phase += (2 * Math.PI * freq) / SR;
      const body = Math.sin(phase) * envDecay(t, dur, { curve: 4.5 });
      const click = lp(noise(), 2600 * Math.exp(-30 * x)) * envDecay(t, dur, { attack: 0.001, curve: 40 }) * 0.5;
      out[i] = softClip(body * 0.92 + click);
    }
    return out;
  },

  /** Air moving past — band-passed noise that sweeps up then down. */
  whoosh(dur = 0.75) {
    const n = Math.floor(SR * dur);
    const out = new Float32Array(n);
    const noise = makeNoise(3313);
    const lp = makeLowpass();
    const hp = makeHighpass();
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const x = t / dur;
      const centre = 380 + 4200 * Math.sin(Math.PI * Math.pow(x, 0.85));
      let s = noise();
      s = hp(s, centre * 0.55);
      s = lp(s, centre * 2.1);
      out[i] = softClip(s * envSwell(t, dur, { peak: 0.52 }) * 1.5);
    }
    return out;
  },

  /** Tight UI click for a caption change or a hard cut. */
  click(dur = 0.09) {
    const n = Math.floor(SR * dur);
    const out = new Float32Array(n);
    const noise = makeNoise(991);
    const hp = makeHighpass();
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const e = envDecay(t, dur, { attack: 0.0008, curve: 28 });
      phase += (2 * Math.PI * 2100) / SR;
      const tone = Math.sin(phase) * 0.35;
      const air = hp(noise(), 3000) * 0.7;
      out[i] = softClip((tone + air) * e);
    }
    return out;
  },

  /** Tension build before a payoff. Rising noise + rising pitched partials. */
  rise(dur = 1.30) {
    const n = Math.floor(SR * dur);
    const out = new Float32Array(n);
    const noise = makeNoise(5150);
    const hp = makeHighpass();
    let p1 = 0; let p2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const x = t / dur;
      const f = 180 * Math.pow(9, x);                 // 180 Hz -> ~1.6 kHz
      p1 += (2 * Math.PI * f) / SR;
      p2 += (2 * Math.PI * f * 1.5) / SR;
      const tone = (Math.sin(p1) * 0.6 + Math.sin(p2) * 0.25);
      const air = hp(noise(), 500 + 5000 * x) * 0.6;
      const amp = Math.pow(x, 1.7) * (1 - Math.pow(clamp((x - 0.93) / 0.07, 0, 1), 2));
      out[i] = softClip((tone + air) * amp * 0.85);
    }
    return out;
  },

  /** Short bright hit for a hook. Brighter and faster than `impact`. */
  hit(dur = 0.34) {
    const n = Math.floor(SR * dur);
    const out = new Float32Array(n);
    const noise = makeNoise(2027);
    const lp = makeLowpass();
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const x = t / dur;
      const freq = 420 * Math.exp(-9 * x) + 88;
      phase += (2 * Math.PI * freq) / SR;
      const body = Math.sin(phase) * envDecay(t, dur, { curve: 7 });
      const snap = lp(noise(), 7000 * Math.exp(-16 * x)) * envDecay(t, dur, { attack: 0.001, curve: 26 }) * 0.75;
      out[i] = softClip(body * 0.8 + snap);
    }
    return out;
  },

  /** Digital stutter for a pattern interrupt. Gated, aliased noise bursts. */
  glitch(dur = 0.26) {
    const n = Math.floor(SR * dur);
    const out = new Float32Array(n);
    const noise = makeNoise(8191);
    const hp = makeHighpass();
    let hold = 0;
    let held = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const x = t / dur;
      // Sample-and-hold at a rate that speeds up across the effect.
      const period = Math.max(8, Math.floor(SR / (900 + 4200 * x)));
      if (hold-- <= 0) { held = noise(); hold = period; }
      const gate = Math.sin(t * Math.PI * 46) > -0.15 ? 1 : 0.12;
      const s = hp(held, 700) * gate;
      out[i] = softClip(s * envDecay(t, dur, { attack: 0.002, curve: 3.2 }) * 0.9);
    }
    return out;
  },

  /** Neutral scene-change sweep — softer than a whoosh, sits under captions. */
  transition(dur = 0.55) {
    const n = Math.floor(SR * dur);
    const out = new Float32Array(n);
    const noise = makeNoise(4242);
    const lp = makeLowpass();
    const hp = makeHighpass();
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const x = t / dur;
      const centre = 2600 * (1 - 0.72 * x) + 260;
      let s = hp(noise(), centre * 0.4);
      s = lp(s, centre * 1.8);
      out[i] = softClip(s * envSwell(t, dur, { peak: 0.22 }) * 1.25);
    }
    return out;
  },

  /** Sub drop for a dark/cinematic beat. Nearly pure low sine. */
  sub(dur = 0.90) {
    const n = Math.floor(SR * dur);
    const out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const x = t / dur;
      const freq = 78 * Math.exp(-2.6 * x) + 30;
      phase += (2 * Math.PI * freq) / SR;
      out[i] = Math.sin(phase) * envDecay(t, dur, { attack: 0.01, curve: 3.4 }) * 0.95;
    }
    return out;
  },

  /** Tiny pop for a word appearing. Used sparingly on kinetic captions. */
  pop(dur = 0.11) {
    const n = Math.floor(SR * dur);
    const out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const x = t / dur;
      const freq = 900 * Math.exp(-11 * x) + 190;
      phase += (2 * Math.PI * freq) / SR;
      out[i] = softClip(Math.sin(phase) * envDecay(t, dur, { attack: 0.001, curve: 16 }) * 0.8);
    }
    return out;
  },
};

/** Metadata the AI layer uses when choosing an effect for a moment. */
const SFX_LIBRARY = {
  impact: { label: 'Impact', role: 'reveal', weight: 0.55, duration: 0.60 },
  whoosh: { label: 'Whoosh', role: 'motion', weight: 0.42, duration: 0.75 },
  click: { label: 'Click', role: 'accent', weight: 0.30, duration: 0.09 },
  rise: { label: 'Rise', role: 'build', weight: 0.38, duration: 1.30 },
  hit: { label: 'Hit', role: 'hook', weight: 0.60, duration: 0.34 },
  glitch: { label: 'Glitch', role: 'interrupt', weight: 0.40, duration: 0.26 },
  transition: { label: 'Transition', role: 'scene', weight: 0.36, duration: 0.55 },
  sub: { label: 'Sub Drop', role: 'cinematic', weight: 0.50, duration: 0.90 },
  pop: { label: 'Pop', role: 'caption', weight: 0.22, duration: 0.11 },
};

/* -------------------------------------------------------------- wav output */

/** Mono Float32 -> 16-bit stereo WAV buffer, with a light stereo spread. */
function toWav(mono, { spread = 0.0, gain = 0.85 } = {}) {
  const n = mono.length;
  const channels = 2;
  const bytesPerSample = 2;
  const dataSize = n * channels * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);                      // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * channels * bytesPerSample, 28);
  buf.writeUInt16LE(channels * bytesPerSample, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  // Haas-style spread: delay one channel by a few samples for width.
  const delay = Math.round(spread * SR * 0.0008);
  let offset = 44;
  for (let i = 0; i < n; i++) {
    const l = mono[i];
    const r = delay > 0 && i >= delay ? mono[i - delay] : mono[i];
    buf.writeInt16LE(clamp(Math.round(l * gain * 32767), -32768, 32767), offset); offset += 2;
    buf.writeInt16LE(clamp(Math.round(r * gain * 32767), -32768, 32767), offset); offset += 2;
  }
  return buf;
}

/** Generate the whole palette into `dir`. Idempotent — skips existing files. */
function generateAll(dir, { force = false } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  for (const [name, meta] of Object.entries(SFX_LIBRARY)) {
    const file = path.join(dir, `${name}.wav`);
    if (!force && fs.existsSync(file) && fs.statSync(file).size > 1000) continue;
    const gen = GENERATORS[name];
    if (!gen) continue;
    const mono = gen(meta.duration);
    fs.writeFileSync(file, toWav(mono, { spread: name === 'whoosh' || name === 'transition' ? 1 : 0.3 }));
    written.push(name);
  }
  return written;
}

function sfxPath(dir, name) {
  return path.join(dir, `${name}.wav`);
}

function listSfx(dir) {
  return Object.entries(SFX_LIBRARY).map(([name, meta]) => ({
    name,
    ...meta,
    exists: fs.existsSync(sfxPath(dir, name)),
  }));
}

module.exports = { SR, SFX_LIBRARY, GENERATORS, generateAll, sfxPath, listSfx, toWav };
