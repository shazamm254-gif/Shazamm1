import { makeRng } from '../../utils/rng.js';

/**
 * Particle systems.
 *
 * Every particle's position is solved in the vertex shader from a static
 * per-instance seed and the current time. The CPU uploads one buffer at
 * setup and then touches nothing per frame, which is why 40k rain streaks
 * are free on a phone.
 */

export const PARTICLE_TYPES = {
  rain: 0, snow: 1, dust: 2, embers: 3, sparks: 4, debris: 5, bokeh: 6,
};

/** Instance budget per system, at effectIntensity = 1. */
const MAX_COUNT = {
  rain: 3600, snow: 2400, dust: 1800, embers: 1400,
  sparks: 800, debris: 900, bokeh: 260,
};

const DEFAULT_TINT = {
  rain:   [0.82, 0.88, 0.98],
  snow:   [1.0, 1.0, 1.0],
  dust:   [1.0, 0.95, 0.85],
  embers: [1.0, 0.6, 0.2],
  sparks: [1.0, 0.85, 0.45],
  debris: [0.55, 0.45, 0.35],
  bokeh:  [1.0, 0.93, 0.8],
};

/** The largest buffer we ever allocate; layers draw a prefix of it. */
export const INSTANCE_CAPACITY = Math.max(...Object.values(MAX_COUNT));

/**
 * Per-instance seeds: x, y, depth band, draw-order key.
 * The draw-order key lets a layer render only a fraction of the buffer
 * (`uVisible`) without re-uploading when Effect Intensity changes.
 */
export function buildInstanceSeeds(seed = 12345, count = INSTANCE_CAPACITY) {
  const rng = makeRng(seed);
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4 + 0] = rng();
    data[i * 4 + 1] = rng();
    // Bias the depth band toward the distance: a few big near particles,
    // many small far ones. That is what reads as depth rather than confetti.
    data[i * 4 + 2] = Math.pow(rng(), 1.7);
    data[i * 4 + 3] = (i + 0.5) / count;
  }
  return data;
}

/** The unit quad every instance is drawn from. */
export const CORNERS = new Float32Array([
  -1, -1,   1, -1,  -1, 1,
   1, -1,   1,  1,  -1, 1,
]);

/**
 * Resolves a preset's environment layers into concrete draw calls for one
 * frame. Returns [] when the preset has no particles, so the whole pass is
 * skipped rather than drawn empty.
 */
export function resolveParticleLayers(preset, controls, camera, timeSec) {
  const layers = [];
  const intensity = controls.effectIntensity;

  for (const env of preset.environment) {
    const type = PARTICLE_TYPES[env.type];
    if (type === undefined) continue;

    const amount = clamp01(env.amount * (0.35 + 1.15 * intensity));
    if (amount < 0.02) continue;

    const max = MAX_COUNT[env.type] || 1000;
    // Density scales with amount; opacity carries the rest, so lowering
    // Effect Intensity thins the field instead of just fading it out.
    const visible = clamp01(0.18 + 0.82 * amount);

    layers.push({
      type,
      typeName: env.type,
      count: Math.max(24, Math.round(max * visible)),
      visible,
      amount: clamp01(0.45 + 0.55 * amount),
      speed: (env.speed ?? 1) * (0.6 + 0.8 * controls.strength),
      angle: env.angle ?? 0,
      drift: env.drift ?? 1,
      tint: env.tint || DEFAULT_TINT[env.type] || [1, 1, 1],
      additive: env.type === 'embers' || env.type === 'sparks' ||
                env.type === 'bokeh' || env.type === 'dust',
      camPan: [camera.tx * 0.5, camera.ty * 0.5],
      camZoom: camera.zoom,
      time: timeSec,
    });
  }
  return layers;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
