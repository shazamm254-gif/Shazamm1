/**
 * Atmosphere layer packing.
 *
 * Fog, mist, smoke, heat haze and god rays are all one fullscreen pass that
 * reads the scene (and its depth, carried in the alpha channel) and writes
 * the composite. Doing it in one pass is what lets heat haze *refract* the
 * scene instead of being painted on top of it.
 */

export const ATMOSPHERE_TYPES = {
  fog: 0, mist: 1, smoke: 2, haze: 3, godrays: 4,
};

const MAX_LAYERS = 4;

export function resolveAtmosphere(preset, controls, camera, timeSec) {
  const types = [0, 0, 0, 0];
  const amount = [0, 0, 0, 0];
  const speed = [0, 0, 0, 0];
  const depthBias = [0, 0, 0, 0];

  let n = 0;
  for (const layer of preset.atmosphere) {
    if (n >= MAX_LAYERS) break;
    const t = ATMOSPHERE_TYPES[layer.type];
    if (t === undefined) continue;

    const a = clamp01(layer.amount * (0.3 + 1.2 * controls.effectIntensity));
    if (a < 0.02) continue;

    types[n] = t;
    amount[n] = a;
    speed[n] = (layer.speed ?? 1) * (0.55 + 0.9 * controls.strength);
    depthBias[n] = clamp01(layer.depthBias ?? 0.6);
    n++;
  }

  return {
    count: n,
    types, amount, speed, depthBias,
    time: timeSec,
    // The fog field drifts with the camera, so it sits in the world rather
    // than being stuck to the lens.
    drift: [-camera.tx * 1.4, -camera.ty * 1.4],
  };
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
