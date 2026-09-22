import { fbm1 } from '../easing.js';
import { lightningAt } from './lightning.js';

/**
 * Final colour pass uniforms.
 *
 * Grain and flicker are functions of clip time, not of wall clock, so the
 * same clip renders identically every time — which matters for "Regenerate"
 * and for the preview matching the export.
 */
export function resolveGrade(preset, controls, timeSec, lightning, seed = 1) {
  const g = preset.grade;
  const fx = controls.effectIntensity;

  const strike = lightningAt(lightning, timeSec);

  let exposure = strike.exposure;
  let tint = strike.tint;

  // Firelight flicker: a warm, irregular exposure wobble.
  if (preset.flicker) {
    const f = fbm1(timeSec * 6.5, seed + 21, 3) * 0.5 + fbm1(timeSec * 2.1, seed + 22, 2) * 0.5;
    exposure *= 1 + f * 0.085 * (0.5 + fx);
    if (strike.bolt <= 0 && strike.exposure <= 1.0001) tint = [1.0, 0.86, 0.68];
  }

  return {
    vignette: g.vignette,
    grain: g.grain * (0.5 + 0.8 * fx),
    bloom: g.bloom * (0.55 + 0.75 * fx),
    contrast: g.contrast,
    warmth: g.warmth,
    exposure,
    flashTint: tint,
    bolt: strike.bolt,
    boltSeed: strike.boltSeed,
    boltX: strike.boltX,
    time: timeSec,
  };
}
