/**
 * Easing curves and deterministic noise.
 *
 * Real cameras do not move linearly: an operator eases into a push, holds a
 * near-constant middle, and settles out of it. Every preset here defaults to
 * a curve with that shape.
 */

export const EASINGS = {
  linear: t => t,

  smoothstep: t => t * t * (3 - 2 * t),
  smootherstep: t => t * t * t * (t * (t * 6 - 15) + 10),

  easeInOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeInOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),

  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeOutQuint: t => 1 - Math.pow(1 - t, 5),
  easeInCubic: t => t * t * t,

  /** Accelerates, holds, then decelerates — a dolly on a good fluid head. */
  dolly: t => {
    const a = EASINGS.easeInOutCubic(t);
    return a * 0.82 + EASINGS.smootherstep(t) * 0.18;
  },

  /** Critically damped arrival: overshoots by a hair, then settles. */
  settle: t => {
    if (t >= 1) return 1;
    const w = 7.0;
    return 1 - Math.exp(-w * t) * (1 + w * t) * (1 - 0.06 * Math.sin(10 * t));
  },
};

export function ease(name, t) {
  const fn = EASINGS[name] || EASINGS.easeInOutCubic;
  return fn(clamp01(t));
}

/**
 * Blends an eased value toward/away from a harder curve.
 * smoothness 1 → the softest available curve; smoothness 0 → near linear.
 */
export function easeWithSmoothness(name, t, smoothness = 0.65) {
  const shaped = ease(name, t);
  const s = clamp01(smoothness);
  // s=0 → 25% shaped (already not robotic), s=1 → fully shaped.
  return lerp(t, shaped, 0.25 + 0.75 * s);
}

/**
 * cameraSpeed biases *when* the movement happens without changing where it
 * ends: 0 = lazy start / late rush, 1 = fast off the mark / long settle.
 */
export function applySpeedBias(t, cameraSpeed = 0.5) {
  const k = clamp01(cameraSpeed);
  const gamma = 2 ** ((0.5 - k) * 1.6); // 0.5→1.0, 0→~1.74, 1→~0.57
  return Math.pow(clamp01(t), gamma);
}

export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

/* ------------------------------------------------------------------ */
/* Deterministic value noise — for handheld and drift.                 */
/* ------------------------------------------------------------------ */

function hash1(n) {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash1(i + seed * 57.13);
  const b = hash1(i + 1 + seed * 57.13);
  return (lerp(a, b, u) * 2 - 1);
}

/** Layered noise: the irregular-but-not-jittery signature of a human hand. */
export function fbm1(x, seed = 0, octaves = 3) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise1(x * freq, seed + i * 11) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}
