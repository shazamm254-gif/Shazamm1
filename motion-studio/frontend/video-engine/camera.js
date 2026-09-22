import { easeWithSmoothness, applySpeedBias, fbm1, clamp, lerp } from './easing.js';
import { LIMITS } from '../config/app.config.js';

/**
 * Camera + parallax solver.
 *
 * A preset's `camera` block describes a move; the user's controls scale and
 * reshape it. Everything here is a pure function of (preset, controls, seed,
 * t) — no hidden state, no Math.random() — so a clip is reproducible.
 *
 * Motion Strength is measured against "Medium" (0.50): at Medium a preset
 * plays exactly as authored, at Extreme it plays at 2×, at Subtle at 0.5×.
 * Hard rails in config/app.config.js then clamp the result, which is what
 * keeps "Extreme" looking like a camera instead of a melting lens.
 */

const STRENGTH_BASELINE = 0.5;

export function cameraAt(preset, controls, t01, seed = 1) {
  const cam = preset.camera;
  const amount = clamp(controls.strength / STRENGTH_BASELINE, 0, 2);

  const tBias = applySpeedBias(t01, controls.cameraSpeed);
  const e = easeWithSmoothness(cam.easing, tBias, controls.smoothness);

  // --- zoom: the delta is scaled, the opening framing is not -------------
  const [z0, z1] = cam.zoom;
  let zoom = z0 + (z1 - z0) * e * amount;

  // --- pan ---------------------------------------------------------------
  const [p0, p1] = cam.pan;
  let tx = (p0[0] + (p1[0] - p0[0]) * e) * amount;
  let ty = (p0[1] + (p1[1] - p0[1]) * e) * amount;

  // --- orbit: a circular dolly arc layered on top of pan -----------------
  if (cam.orbit) {
    const { radius, turns, phase } = cam.orbit;
    const ang = (t01 * turns + (phase || 0)) * Math.PI * 2;
    tx += Math.cos(ang) * radius * amount;
    ty += Math.sin(ang) * radius * 0.62 * amount; // flattened arc, not a barrel roll
  }

  // --- roll --------------------------------------------------------------
  let roll = (cam.roll[0] + (cam.roll[1] - cam.roll[0]) * e) * amount;

  // --- handheld: layered value noise, damped by Smoothness ---------------
  if (cam.handheld) {
    const damp = lerp(1.0, 0.42, controls.smoothness);
    const amp = LIMITS.maxShake * cam.handheld.amp * amount * damp;
    const f = cam.handheld.freq;
    const tt = t01 * (preset.duration || 5);
    tx += fbm1(tt * f, seed + 1) * amp;
    ty += fbm1(tt * f * 1.13, seed + 2) * amp * 1.15;
    roll += fbm1(tt * f * 0.61, seed + 3) * amp * 0.9;
    zoom *= 1 + fbm1(tt * f * 0.43, seed + 4) * amp * 0.6;
  }

  return {
    zoom: clamp(zoom, 1 / LIMITS.maxZoom, LIMITS.maxZoom),
    tx: clamp(tx, -LIMITS.maxPan, LIMITS.maxPan),
    ty: clamp(ty, -LIMITS.maxPan, LIMITS.maxPan),
    roll: clamp(roll, -LIMITS.maxRoll, LIMITS.maxRoll),
  };
}

/**
 * A solved motion path.
 *
 * Built once per render. It samples the camera across the clip so the
 * parallax can be *normalised to this particular move*: whatever the preset
 * does, the depth displacement uses the full (capped) budget and no more.
 * Without this, a preset with a small pan gets no visible depth and one with
 * a big pan tears.
 */
export function createMotionPath(preset, controls, seed = 1, samples = 64) {
  const pts = new Array(samples + 1);
  for (let i = 0; i <= samples; i++) {
    pts[i] = cameraAt(preset, controls, i / samples, seed);
  }

  // Centre of the move: the *mean* of the path, not the halfway sample. For a
  // linear move these coincide; for an orbit only the mean is actually the
  // centre, and using the halfway sample would push the whole clip to one
  // side of the parallax budget.
  const mid = { tx: 0, ty: 0, zoom: 0 };
  for (const p of pts) { mid.tx += p.tx; mid.ty += p.ty; mid.zoom += p.zoom; }
  mid.tx /= pts.length; mid.ty /= pts.length; mid.zoom /= pts.length;

  let maxLateral = 1e-6;
  let maxRadial = 1e-6;
  for (const p of pts) {
    const dx = p.tx - mid.tx;
    const dy = p.ty - mid.ty;
    maxLateral = Math.max(maxLateral, Math.hypot(dx, dy));
    maxRadial = Math.max(maxRadial, Math.abs(p.zoom - mid.zoom) / mid.zoom);
  }

  // Parallax budget for this clip, in UV units.
  const budget = LIMITS.maxParallax * preset.parallax *
                 clamp(0.45 + 1.1 * controls.strength, 0, 1.6);

  // A move that barely travels should not be amplified into full parallax —
  // scale the budget by how much ground the camera actually covers.
  const travel = clamp(maxLateral / 0.05, 0, 1);
  const push = clamp(maxRadial / 0.12, 0, 1);
  const lateralBudget = budget * lerp(0.35, 1.0, travel);
  const radialBudget = budget * lerp(0.25, 1.0, push) * 0.8;

  return {
    preset, controls, seed,

    /** Camera + depth displacement at normalised time t. */
    at(t01) {
      const c = cameraAt(preset, controls, t01, seed);
      const dx = c.tx - mid.tx;
      const dy = c.ty - mid.ty;
      const lat = Math.hypot(dx, dy);
      const scale = lat > 1e-9 ? (lat / maxLateral) * lateralBudget / lat : 0;
      const zr = (c.zoom - mid.zoom) / mid.zoom;

      return {
        ...c,
        // Lateral displacement: near layers slide opposite the camera.
        px: dx * scale,
        py: dy * scale,
        // Radial displacement: a push-in expands the near plane faster than
        // the far plane, which is what moving a real camera forward does.
        pz: clamp((zr / maxRadial) * radialBudget, -budget, budget),
      };
    },
  };
}
