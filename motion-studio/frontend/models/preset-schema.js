/**
 * A MotionPreset is plain data. Adding a new look means adding one object to
 * models/presets.js — no renderer change, no UI change.
 *
 * MotionPreset {
 *   id            string    stable key
 *   name          string    shown on the chip
 *   emoji         string    shown on the chip
 *   category      'camera' | 'parallax' | 'environment' | 'particles' | 'atmosphere'
 *   duration      number    suggested seconds (the user can override)
 *   intensity     number    0..1 suggested Motion Strength
 *
 *   camera {
 *     zoom     [from, to]      scale multipliers, 1 = fit
 *     pan      [[x0,y0],[x1,y1]]  fractions of frame width
 *     roll     [from, to]      radians
 *     orbit    { radius, turns, phase }   circular path, adds to pan
 *     easing   keyof EASINGS
 *     handheld { amp, freq }   seeded noise on top of everything
 *   }
 *
 *   parallax  number     0..1 how much the depth map displaces (scaled by LIMITS.maxParallax)
 *
 *   environment {
 *     type      'rain'|'snow'|'dust'|'embers'|'sparks'|'debris'|'bokeh'
 *     amount    0..1
 *     ...per-system fields (see effects/particles.js)
 *   }[]                  several systems can be layered
 *
 *   atmosphere {
 *     type      'fog'|'haze'|'smoke'|'mist'|'godrays'
 *     amount    0..1
 *     speed     number
 *     depthBias 0..1      how strongly it pools in the distance
 *   }[]
 *
 *   lightning { rate, intensity, color }   optional
 *   flicker   boolean    warm exposure flicker (firelight)
 *
 *   grade {
 *     vignette, grain, bloom, contrast, warmth   each 0..1 (contrast/warmth centred at 0)
 *   }
 * }
 */

const DEFAULT_GRADE = { vignette: 0.22, grain: 0.05, bloom: 0.12, contrast: 0.05, warmth: 0 };

/** Fills in every optional field so the renderer can read the shape blindly. */
export function normalizePreset(p) {
  const cam = p.camera || {};
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji || '🎬',
    category: p.category || 'camera',
    description: p.description || '',
    duration: p.duration ?? 5,
    intensity: p.intensity ?? 0.5,
    camera: {
      zoom: cam.zoom || [1, 1],
      pan: cam.pan || [[0, 0], [0, 0]],
      roll: cam.roll || [0, 0],
      orbit: cam.orbit || null,
      easing: cam.easing || 'dolly',
      handheld: cam.handheld || null,
    },
    parallax: p.parallax ?? 0.35,
    environment: (p.environment || []).map(e => ({ amount: 0.6, ...e })),
    atmosphere: (p.atmosphere || []).map(a => ({ amount: 0.5, speed: 1, depthBias: 0.6, ...a })),
    lightning: p.lightning || null,
    flicker: !!p.flicker,
    grade: { ...DEFAULT_GRADE, ...(p.grade || {}) },
  };
}
