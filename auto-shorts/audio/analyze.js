'use strict';
/**
 * Voice-track analysis.
 *
 * We decode the audio to 16 kHz mono 16-bit PCM through FFmpeg and do the
 * analysis in plain JavaScript. That gives us frame-accurate energy data we can
 * reuse for several jobs at once: voice activity detection, silence removal,
 * pause ranking, waveform drawing for the timeline, and music ducking.
 *
 * This is a real signal-processing pass over the actual samples — not an
 * estimate derived from file duration.
 */

const ff = require('../video-engine/ffmpeg');
const { round, mergeRanges, invertRanges, clamp } = require('../utils');

const SAMPLE_RATE = 16000;
const FRAME_MS = 20;                            // 320 samples per frame
const FRAME_SIZE = (SAMPLE_RATE * FRAME_MS) / 1000;

/** Decode any audio-bearing file to mono Float32 samples at 16 kHz. */
async function decodePcm(filePath) {
  const buf = await ff.runForBuffer([
    '-i', filePath,
    '-vn',
    '-ac', '1',
    '-ar', String(SAMPLE_RATE),
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    '-',
  ], { stage: 'audio decode' });

  const count = Math.floor(buf.length / 2);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) samples[i] = buf.readInt16LE(i * 2) / 32768;
  return samples;
}

/** Per-frame RMS energy, in dBFS. */
function frameEnergy(samples) {
  const frames = Math.floor(samples.length / FRAME_SIZE);
  const rms = new Float32Array(frames);
  const db = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let acc = 0;
    const base = f * FRAME_SIZE;
    for (let i = 0; i < FRAME_SIZE; i++) {
      const s = samples[base + i];
      acc += s * s;
    }
    const r = Math.sqrt(acc / FRAME_SIZE);
    rms[f] = r;
    db[f] = r > 1e-7 ? 20 * Math.log10(r) : -120;
  }
  return { rms, db, frames };
}

/**
 * Adaptive noise floor. Rather than a fixed -35 dB threshold (which breaks on
 * quiet phone recordings and on loud studio mics alike), we take a low
 * percentile of frame energy as the room tone and set the speech gate a fixed
 * margin above it, clamped to a sane range.
 */
function adaptiveThreshold(db) {
  const sorted = Array.from(db).filter((v) => v > -119).sort((a, b) => a - b);
  if (!sorted.length) return { floor: -60, gate: -45, peak: -20 };
  const pick = (p) => sorted[clamp(Math.floor(sorted.length * p), 0, sorted.length - 1)];
  const floor = pick(0.10);
  const peak = pick(0.95);
  const span = peak - floor;
  // With a wide dynamic range, sit closer to the floor; with a compressed
  // recording, sit proportionally higher so we do not gate on noise.
  const margin = clamp(span * 0.28, 6, 18);
  const gate = clamp(floor + margin, -60, -18);
  return { floor: round(floor, 1), gate: round(gate, 1), peak: round(peak, 1) };
}

/**
 * Voice activity detection with hysteresis and hangover.
 * Hysteresis stops the gate from chattering on consonants; the hangover keeps
 * short inter-word gaps inside a speech run instead of shattering every word
 * into its own segment.
 */
function detectSpeech(db, gate, { hangoverMs = 220, minSpeechMs = 120 } = {}) {
  const openGate = gate;
  const closeGate = gate - 4;
  const hangoverFrames = Math.round(hangoverMs / FRAME_MS);

  const speech = [];
  let inSpeech = false;
  let startFrame = 0;
  let quietRun = 0;

  for (let f = 0; f < db.length; f++) {
    const v = db[f];
    if (!inSpeech) {
      if (v >= openGate) { inSpeech = true; startFrame = f; quietRun = 0; }
    } else if (v < closeGate) {
      quietRun++;
      if (quietRun >= hangoverFrames) {
        const endFrame = f - quietRun + 1;
        speech.push({ start: (startFrame * FRAME_MS) / 1000, end: (endFrame * FRAME_MS) / 1000 });
        inSpeech = false;
        quietRun = 0;
      }
    } else {
      quietRun = 0;
    }
  }
  if (inSpeech) speech.push({ start: (startFrame * FRAME_MS) / 1000, end: (db.length * FRAME_MS) / 1000 });

  return mergeRanges(speech, 0.08)
    .filter((r) => (r.end - r.start) * 1000 >= minSpeechMs)
    .map((r) => ({ start: round(r.start, 3), end: round(r.end, 3) }));
}

/**
 * Silence-removal policy.
 *
 * The rule the spec asks for: do not strip every pause. A pause after a
 * sentence is delivery; a four-second gap while someone reads their notes is
 * dead air. Each level keeps a different amount of breathing room, and we never
 * cut a pause down below `keep` seconds so the edit still breathes.
 */
const SILENCE_LEVELS = {
  off: null,
  low: { minCut: 1.10, keep: 0.42, edgeTrim: 0.06 },
  medium: { minCut: 0.60, keep: 0.26, edgeTrim: 0.05 },
  aggressive: { minCut: 0.32, keep: 0.11, edgeTrim: 0.03 },
};

/**
 * Turn detected speech into a list of cuts to remove.
 * Returns { keepRanges, removed, removedSeconds } where keepRanges are the
 * source ranges the edit should retain, in order.
 */
function planSilenceRemoval(speech, totalDuration, level = 'medium') {
  const policy = SILENCE_LEVELS[level];
  if (!policy || !speech.length) {
    return { keepRanges: [{ start: 0, end: totalDuration }], removed: [], removedSeconds: 0 };
  }

  const gaps = invertRanges(speech, totalDuration);
  const removed = [];

  for (const gap of gaps) {
    const len = gap.end - gap.start;
    if (len < policy.minCut) continue;

    const isLead = gap.start <= 0.001;
    const isTail = gap.end >= totalDuration - 0.001;

    if (isLead) {
      // Trim dead air before the first word, leaving a short run-up.
      const cutEnd = Math.max(0, gap.end - Math.min(policy.keep, 0.18));
      if (cutEnd > 0.05) removed.push({ start: 0, end: round(cutEnd, 3), reason: 'lead-in silence' });
      continue;
    }
    if (isTail) {
      const cutStart = gap.start + Math.min(policy.keep, 0.35);
      if (totalDuration - cutStart > 0.05) removed.push({ start: round(cutStart, 3), end: round(totalDuration, 3), reason: 'trailing silence' });
      continue;
    }

    // Interior pause: keep `keep` seconds of it, split evenly either side of
    // the cut so the words on both sides keep their natural spacing.
    const keepHalf = policy.keep / 2;
    const cutStart = gap.start + keepHalf;
    const cutEnd = gap.end - keepHalf;
    if (cutEnd - cutStart > 0.08) {
      removed.push({ start: round(cutStart, 3), end: round(cutEnd, 3), reason: len > 2 ? 'dead air' : 'long pause' });
    }
  }

  const merged = mergeRanges(removed);
  const keepRanges = invertRanges(merged, totalDuration).filter((r) => r.end - r.start > 0.04);
  const removedSeconds = merged.reduce((a, r) => a + (r.end - r.start), 0);

  return {
    keepRanges: keepRanges.map((r) => ({ start: round(r.start, 3), end: round(r.end, 3) })),
    removed: merged.map((r) => ({ start: round(r.start, 3), end: round(r.end, 3) })),
    removedSeconds: round(removedSeconds, 2),
  };
}

/** Downsampled envelope for drawing the timeline waveform. */
function buildWaveform(rms, buckets = 900) {
  const out = new Array(Math.min(buckets, rms.length || 1)).fill(0);
  if (!rms.length) return out;
  const per = rms.length / out.length;
  let max = 1e-6;
  for (let i = 0; i < out.length; i++) {
    let peak = 0;
    const s = Math.floor(i * per);
    const e = Math.min(rms.length, Math.floor((i + 1) * per));
    for (let j = s; j < e; j++) if (rms[j] > peak) peak = rms[j];
    out[i] = peak;
    if (peak > max) max = peak;
  }
  return out.map((v) => round(Math.min(1, v / max), 3));
}

/**
 * Full analysis of one voice-bearing file.
 * This is the single entry point the auto-edit pipeline calls.
 */
async function analyzeVoice(filePath, { silenceLevel = 'medium' } = {}) {
  const samples = await decodePcm(filePath);
  const duration = samples.length / SAMPLE_RATE;
  if (duration <= 0.05) {
    return {
      duration: 0, speech: [], silences: [], threshold: null, waveform: [],
      plan: { keepRanges: [], removed: [], removedSeconds: 0 }, energy: [], frameMs: FRAME_MS,
    };
  }

  const { rms, db } = frameEnergy(samples);
  const threshold = adaptiveThreshold(db);
  const speech = detectSpeech(db, threshold.gate);
  const silences = invertRanges(speech, duration)
    .filter((r) => r.end - r.start >= 0.2)
    .map((r) => ({ start: round(r.start, 3), end: round(r.end, 3), duration: round(r.end - r.start, 3) }));
  const plan = planSilenceRemoval(speech, duration, silenceLevel);

  // Coarse energy curve (10 fps) — used to place sound effects on real accents
  // rather than on arbitrary beats.
  const energy = [];
  const step = Math.round(100 / FRAME_MS);
  for (let f = 0; f < db.length; f += step) {
    let peak = -120;
    for (let k = f; k < Math.min(db.length, f + step); k++) if (db[k] > peak) peak = db[k];
    energy.push(round(peak, 1));
  }

  return {
    duration: round(duration, 3),
    speech,
    silences,
    threshold,
    waveform: buildWaveform(rms),
    plan,
    energy,
    frameMs: FRAME_MS,
    speechSeconds: round(speech.reduce((a, r) => a + (r.end - r.start), 0), 2),
  };
}

module.exports = {
  SAMPLE_RATE, FRAME_MS, SILENCE_LEVELS,
  decodePcm, frameEnergy, adaptiveThreshold, detectSpeech,
  planSilenceRemoval, buildWaveform, analyzeVoice,
};
