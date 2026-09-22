import { makeRng } from '../../utils/rng.js';

/**
 * Lightning.
 *
 * A strike schedule is generated once per clip from the seed, so the flashes
 * land in the same places every time the clip is rendered — and each strike
 * has its own bolt shape, decay and brightness.
 *
 * A real strike is not one flash: it is a bright leader, a dip, one or two
 * return strokes, then a decay. That double-tap is most of what makes it
 * read as lightning rather than as a camera flash.
 */
export function buildLightningSchedule(cfg, durationSec, seed = 1) {
  if (!cfg) return null;
  const rng = makeRng(seed ^ 0x9E3779B9);

  const rate = cfg.rate ?? 0.8;             // strikes per second, roughly
  const expected = Math.max(1, Math.round(durationSec * rate * 0.55));
  const strikes = [];

  for (let i = 0; i < expected; i++) {
    // Spread strikes over the clip with jitter, never in the last 4 frames
    // (a flash clipped by the end of the clip looks like an encoding fault).
    const slot = (i + 0.5) / expected;
    const t = clamp(slot + (rng() - 0.5) * (0.8 / expected), 0.02, 0.93) * durationSec;

    strikes.push({
      t,
      peak: (0.55 + rng() * 0.45) * (cfg.intensity ?? 0.7),
      decay: 0.16 + rng() * 0.26,
      doubleTap: rng() < 0.6,
      gap: 0.055 + rng() * 0.07,
      boltSeed: rng() * 400,
      boltX: 0.14 + rng() * 0.72,
      showBolt: rng() < 0.62,
      boltLife: 0.06 + rng() * 0.07,
    });
  }

  return {
    strikes,
    color: cfg.color || [0.8, 0.87, 1.0],
  };
}

/** Exposure multiplier and bolt visibility at a moment in the clip. */
export function lightningAt(schedule, timeSec) {
  if (!schedule) return { exposure: 1, bolt: 0, boltSeed: 0, boltX: 0.5, tint: [1, 1, 1] };

  let exposure = 0;
  let bolt = 0;
  let boltSeed = 0;
  let boltX = 0.5;

  for (const s of schedule.strikes) {
    const dt = timeSec - s.t;
    if (dt < -0.02 || dt > s.decay * 3.5) continue;

    // Leader: a fast rise, then exponential decay.
    let e = dt < 0 ? 0 : Math.exp(-dt / s.decay) * (1 - Math.exp(-dt / 0.012));
    if (s.doubleTap) {
      const dt2 = dt - s.gap;
      if (dt2 > 0) e += Math.exp(-dt2 / (s.decay * 0.75)) * 0.75 * (1 - Math.exp(-dt2 / 0.01));
    }
    exposure = Math.max(exposure, e * s.peak);

    if (s.showBolt && dt >= 0 && dt < s.boltLife) {
      const b = Math.pow(1 - dt / s.boltLife, 1.6);
      if (b > bolt) { bolt = b; boltSeed = s.boltSeed; boltX = s.boltX; }
    }
  }

  return {
    exposure: 1 + exposure * 1.45,
    bolt,
    boltSeed,
    boltX,
    tint: schedule.color,
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
