/**
 * Seeded randomness. The render path never calls Math.random(), so the same
 * image + settings + seed always produce a byte-identical clip — which is
 * what makes "Regenerate" meaningful and bug reports reproducible.
 */

/** mulberry32 — small, fast, good enough for visual noise. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeed() {
  // Only used to pick a *new* look on user request, never inside a render.
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}
