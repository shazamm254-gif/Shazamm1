import { normalizePreset } from './preset-schema.js';

/**
 * The preset library. Each entry is data only — see preset-schema.js for the
 * shape. Add an object here and it appears in the UI automatically.
 */
const RAW = [

  /* ---------------------------- CAMERA ---------------------------- */
  {
    id: 'cinematic_push_in', name: 'Cinematic Push In', emoji: '🎥', category: 'camera',
    description: 'Slow dolly toward the subject. The safe default.',
    duration: 5, intensity: 0.5, parallax: 0.45,
    camera: { zoom: [1.0, 1.16], pan: [[0, 0], [0, -0.012]], easing: 'dolly' },
    grade: { vignette: 0.26, bloom: 0.14 },
  },
  {
    id: 'slow_zoom_in', name: 'Slow Zoom In', emoji: '🔍', category: 'camera',
    description: 'Gentle, almost imperceptible magnification.',
    duration: 6, intensity: 0.35, parallax: 0.2,
    camera: { zoom: [1.0, 1.09], easing: 'smootherstep' },
  },
  {
    id: 'slow_zoom_out', name: 'Slow Zoom Out', emoji: '🔎', category: 'camera',
    description: 'Reveals the frame a little at a time.',
    duration: 6, intensity: 0.35, parallax: 0.2,
    camera: { zoom: [1.12, 1.0], easing: 'smootherstep' },
  },
  {
    id: 'dramatic_zoom_in', name: 'Dramatic Zoom In', emoji: '💥', category: 'camera',
    description: 'Hard punch in. Good for a reveal or a beat drop.',
    duration: 4, intensity: 0.8, parallax: 0.55,
    camera: { zoom: [1.0, 1.42], easing: 'easeInOutQuint' },
    grade: { vignette: 0.34, contrast: 0.12, bloom: 0.16 },
  },
  {
    id: 'dramatic_zoom_out', name: 'Dramatic Zoom Out', emoji: '🌌', category: 'camera',
    description: 'Pulls back fast to show scale.',
    duration: 4, intensity: 0.8, parallax: 0.55,
    camera: { zoom: [1.45, 1.02], easing: 'easeOutQuint' },
    grade: { vignette: 0.3, contrast: 0.1 },
  },
  {
    id: 'camera_push_in', name: 'Camera Push In', emoji: '🎯', category: 'camera',
    description: 'Dolly forward with depth — the background lags behind.',
    duration: 5, intensity: 0.6, parallax: 0.85,
    camera: { zoom: [1.0, 1.2], easing: 'dolly', handheld: { amp: 0.1, freq: 0.5 } },
  },
  {
    id: 'camera_pull_back', name: 'Camera Pull Back', emoji: '↩️', category: 'camera',
    description: 'Dolly away, foreground separates from the background.',
    duration: 5, intensity: 0.6, parallax: 0.85,
    camera: { zoom: [1.22, 1.01], easing: 'dolly', handheld: { amp: 0.1, freq: 0.5 } },
  },
  {
    id: 'pan_left', name: 'Pan Left', emoji: '⬅️', category: 'camera',
    duration: 5, intensity: 0.5, parallax: 0.5,
    camera: { zoom: [1.12, 1.12], pan: [[0.07, 0], [-0.07, 0]], easing: 'dolly' },
  },
  {
    id: 'pan_right', name: 'Pan Right', emoji: '➡️', category: 'camera',
    duration: 5, intensity: 0.5, parallax: 0.5,
    camera: { zoom: [1.12, 1.12], pan: [[-0.07, 0], [0.07, 0]], easing: 'dolly' },
  },
  {
    id: 'tilt_up', name: 'Tilt Up', emoji: '⬆️', category: 'camera',
    duration: 5, intensity: 0.5, parallax: 0.45,
    camera: { zoom: [1.12, 1.12], pan: [[0, 0.08], [0, -0.08]], easing: 'dolly' },
  },
  {
    id: 'tilt_down', name: 'Tilt Down', emoji: '⬇️', category: 'camera',
    duration: 5, intensity: 0.5, parallax: 0.45,
    camera: { zoom: [1.12, 1.12], pan: [[0, -0.08], [0, 0.08]], easing: 'dolly' },
  },
  {
    id: 'diagonal_pan', name: 'Diagonal Pan', emoji: '↗️', category: 'camera',
    duration: 5, intensity: 0.55, parallax: 0.55,
    camera: { zoom: [1.1, 1.16], pan: [[-0.06, 0.05], [0.06, -0.05]], roll: [-0.006, 0.006], easing: 'dolly' },
  },
  {
    id: 'handheld', name: 'Handheld', emoji: '🎬', category: 'camera',
    description: 'Operator breathing, with a slow creep forward.',
    duration: 5, intensity: 0.55, parallax: 0.6,
    camera: {
      zoom: [1.06, 1.12], easing: 'smoothstep',
      handheld: { amp: 1.0, freq: 1.35 },
    },
    grade: { grain: 0.1, vignette: 0.28 },
  },
  {
    id: 'cinematic_drift', name: 'Cinematic Drift', emoji: '🌊', category: 'camera',
    description: 'A long, weightless float. Very hard to make look wrong.',
    duration: 8, intensity: 0.4, parallax: 0.7,
    camera: {
      zoom: [1.05, 1.14], pan: [[-0.03, 0.02], [0.03, -0.02]], roll: [-0.004, 0.005],
      easing: 'smootherstep', handheld: { amp: 0.25, freq: 0.35 },
    },
    grade: { vignette: 0.24, bloom: 0.16 },
  },

  /* --------------------------- PARALLAX --------------------------- */
  {
    id: 'parallax_orbit', name: 'Orbit Parallax', emoji: '🧊', category: 'parallax',
    description: 'The camera circles the subject. The strongest 3D illusion here.',
    duration: 6, intensity: 0.6, parallax: 1.0,
    camera: { zoom: [1.14, 1.14], orbit: { radius: 0.05, turns: 1, phase: 0 }, easing: 'linear' },
    grade: { vignette: 0.26 },
  },
  {
    id: 'parallax_sweep', name: 'Depth Sweep', emoji: '🪞', category: 'parallax',
    description: 'Lateral move with a strong foreground/background split.',
    duration: 5, intensity: 0.65, parallax: 1.0,
    camera: { zoom: [1.14, 1.14], pan: [[-0.05, 0], [0.05, 0]], easing: 'dolly' },
  },
  {
    id: 'parallax_3d_push', name: '3D Push', emoji: '📦', category: 'parallax',
    description: 'Forward move where near objects grow faster than far ones.',
    duration: 5, intensity: 0.7, parallax: 1.0,
    camera: { zoom: [1.0, 1.24], easing: 'dolly', handheld: { amp: 0.15, freq: 0.6 } },
    grade: { vignette: 0.3, bloom: 0.15 },
  },
  {
    id: 'parallax_breathe', name: 'Breathe', emoji: '🫁', category: 'parallax',
    description: 'A slow in-and-out. Loops seamlessly.',
    duration: 6, intensity: 0.4, parallax: 0.8,
    camera: { zoom: [1.04, 1.04], orbit: { radius: 0.018, turns: 1, phase: 0.25 }, easing: 'linear',
              handheld: { amp: 0.3, freq: 0.4 } },
  },

  /* -------------------------- ENVIRONMENT ------------------------- */
  {
    id: 'heavy_rain', name: 'Heavy Rain', emoji: '🌧', category: 'environment',
    description: 'Driving rain with a slow drift. Reads instantly on a phone.',
    duration: 5, intensity: 0.55, parallax: 0.5,
    camera: { zoom: [1.04, 1.12], pan: [[0.015, 0], [-0.015, 0]], easing: 'smootherstep',
              handheld: { amp: 0.2, freq: 0.5 } },
    environment: [{ type: 'rain', amount: 0.8, angle: -0.16, speed: 1.0 }],
    atmosphere: [{ type: 'mist', amount: 0.3, speed: 0.8, depthBias: 0.7 }],
    grade: { vignette: 0.32, contrast: 0.08, warmth: -0.12, bloom: 0.1 },
  },
  {
    id: 'lightning_storm', name: 'Lightning Storm', emoji: '⚡', category: 'environment',
    description: 'Rain plus seeded strikes that light the whole frame.',
    duration: 6, intensity: 0.7, parallax: 0.6,
    camera: { zoom: [1.02, 1.1], easing: 'smootherstep', handheld: { amp: 0.4, freq: 0.7 } },
    environment: [{ type: 'rain', amount: 0.6, angle: -0.2, speed: 1.1 }],
    atmosphere: [{ type: 'fog', amount: 0.35, speed: 0.6, depthBias: 0.8 }],
    lightning: { rate: 0.85, intensity: 0.75, color: [0.78, 0.86, 1.0] },
    grade: { vignette: 0.34, contrast: 0.12, warmth: -0.15, bloom: 0.3 },
  },
  {
    id: 'snowfall', name: 'Snowfall', emoji: '❄', category: 'environment',
    description: 'Layered flakes with depth — near ones blur past the lens.',
    duration: 6, intensity: 0.45, parallax: 0.55,
    camera: { zoom: [1.0, 1.1], pan: [[0, 0], [0, -0.02]], easing: 'smootherstep' },
    environment: [{ type: 'snow', amount: 0.75, speed: 0.55, drift: 1.0 }],
    atmosphere: [{ type: 'mist', amount: 0.28, speed: 0.5, depthBias: 0.75 }],
    grade: { vignette: 0.24, warmth: -0.1, bloom: 0.18 },
  },
  {
    id: 'fire_embers', name: 'Fire & Embers', emoji: '🔥', category: 'environment',
    description: 'Rising embers, heat flicker and a warm glow.',
    duration: 5, intensity: 0.6, parallax: 0.5,
    camera: { zoom: [1.03, 1.14], easing: 'dolly', handheld: { amp: 0.3, freq: 0.9 } },
    environment: [{ type: 'embers', amount: 0.8, speed: 1.0 }],
    atmosphere: [{ type: 'smoke', amount: 0.3, speed: 1.2, depthBias: 0.4 }],
    grade: { vignette: 0.3, warmth: 0.3, bloom: 0.42, contrast: 0.08 },
    flicker: true,
  },
  {
    id: 'smoke_drift', name: 'Smoke', emoji: '💨', category: 'environment',
    description: 'Thick smoke rolling through the frame.',
    duration: 6, intensity: 0.5, parallax: 0.6,
    camera: { zoom: [1.05, 1.15], easing: 'smootherstep', handheld: { amp: 0.25, freq: 0.4 } },
    atmosphere: [{ type: 'smoke', amount: 0.62, speed: 1.0, depthBias: 0.35 }],
    grade: { vignette: 0.3, contrast: 0.06, bloom: 0.12 },
  },
  {
    id: 'debris_storm', name: 'Flying Debris', emoji: '🍂', category: 'environment',
    description: 'Fast-moving fragments crossing the lens.',
    duration: 5, intensity: 0.7, parallax: 0.7,
    camera: { zoom: [1.08, 1.18], pan: [[0.03, 0], [-0.03, 0]], easing: 'dolly',
              handheld: { amp: 0.5, freq: 1.1 } },
    environment: [{ type: 'debris', amount: 0.7, angle: 0.25, speed: 1.4 }],
    atmosphere: [{ type: 'haze', amount: 0.25, speed: 1.4, depthBias: 0.5 }],
    grade: { vignette: 0.32, contrast: 0.1, warmth: 0.08 },
  },

  /* --------------------------- PARTICLES -------------------------- */
  {
    id: 'floating_dust', name: 'Floating Dust', emoji: '✨', category: 'particles',
    description: 'Backlit motes drifting through a shaft of light.',
    duration: 6, intensity: 0.4, parallax: 0.6,
    camera: { zoom: [1.02, 1.11], easing: 'smootherstep', handheld: { amp: 0.2, freq: 0.3 } },
    environment: [{ type: 'dust', amount: 0.7, speed: 0.35 }],
    atmosphere: [{ type: 'godrays', amount: 0.3, speed: 0.4, depthBias: 0.5 }],
    grade: { vignette: 0.26, warmth: 0.12, bloom: 0.3 },
  },
  {
    id: 'spark_shower', name: 'Sparks', emoji: '🎇', category: 'particles',
    description: 'Hot sparks arcing across the frame.',
    duration: 4, intensity: 0.65, parallax: 0.5,
    camera: { zoom: [1.04, 1.16], easing: 'dolly', handheld: { amp: 0.35, freq: 1.0 } },
    environment: [{ type: 'sparks', amount: 0.75, speed: 1.6 }],
    grade: { vignette: 0.32, warmth: 0.26, bloom: 0.5, contrast: 0.1 },
  },
  {
    id: 'bokeh_lights', name: 'Bokeh Lights', emoji: '🫧', category: 'particles',
    description: 'Soft out-of-focus orbs, slow and dreamy.',
    duration: 6, intensity: 0.35, parallax: 0.55,
    camera: { zoom: [1.03, 1.1], easing: 'smootherstep' },
    environment: [{ type: 'bokeh', amount: 0.6, speed: 0.3 }],
    grade: { vignette: 0.28, bloom: 0.45, warmth: 0.1 },
  },
  {
    id: 'ash_fall', name: 'Falling Ash', emoji: '🌋', category: 'particles',
    description: 'Grey flakes drifting down through still air.',
    duration: 6, intensity: 0.45, parallax: 0.6,
    camera: { zoom: [1.02, 1.12], easing: 'smootherstep', handheld: { amp: 0.2, freq: 0.4 } },
    environment: [{ type: 'snow', amount: 0.55, speed: 0.4, drift: 1.4, tint: [0.72, 0.70, 0.68] }],
    atmosphere: [{ type: 'smoke', amount: 0.3, speed: 0.7, depthBias: 0.6 }],
    grade: { vignette: 0.34, warmth: 0.06, contrast: 0.08 },
  },

  /* -------------------------- ATMOSPHERE -------------------------- */
  {
    id: 'rolling_fog', name: 'Rolling Fog', emoji: '🌫', category: 'atmosphere',
    description: 'Fog banks that pool in the distance, not on the subject.',
    duration: 6, intensity: 0.45, parallax: 0.65,
    camera: { zoom: [1.03, 1.13], easing: 'smootherstep', handheld: { amp: 0.2, freq: 0.35 } },
    atmosphere: [{ type: 'fog', amount: 0.6, speed: 0.7, depthBias: 0.85 }],
    grade: { vignette: 0.28, contrast: 0.04, bloom: 0.2 },
  },
  {
    id: 'god_rays', name: 'God Rays', emoji: '🌤', category: 'atmosphere',
    description: 'Volumetric light shafts with dust caught in them.',
    duration: 6, intensity: 0.45, parallax: 0.6,
    camera: { zoom: [1.02, 1.12], easing: 'smootherstep' },
    atmosphere: [{ type: 'godrays', amount: 0.55, speed: 0.35, depthBias: 0.4 }],
    environment: [{ type: 'dust', amount: 0.4, speed: 0.3 }],
    grade: { vignette: 0.26, warmth: 0.18, bloom: 0.42 },
  },
  {
    id: 'heat_haze', name: 'Heat Haze', emoji: '♨️', category: 'atmosphere',
    description: 'Shimmering air, like a long lens over hot ground.',
    duration: 5, intensity: 0.5, parallax: 0.5,
    camera: { zoom: [1.04, 1.13], easing: 'smootherstep' },
    atmosphere: [{ type: 'haze', amount: 0.5, speed: 1.6, depthBias: 0.55 }],
    grade: { vignette: 0.26, warmth: 0.22, bloom: 0.2 },
  },
  {
    id: 'night_mist', name: 'Night Mist', emoji: '🌙', category: 'atmosphere',
    description: 'Cold low mist with a slow, quiet drift.',
    duration: 8, intensity: 0.35, parallax: 0.7,
    camera: { zoom: [1.04, 1.12], pan: [[-0.02, 0], [0.02, 0]], easing: 'smootherstep',
              handheld: { amp: 0.15, freq: 0.25 } },
    atmosphere: [{ type: 'mist', amount: 0.5, speed: 0.4, depthBias: 0.8 }],
    grade: { vignette: 0.36, warmth: -0.18, contrast: 0.06, bloom: 0.22 },
  },
];

export const PRESETS = RAW.map(normalizePreset);

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map(p => [p.id, p]));

export const DEFAULT_PRESET_ID = 'cinematic_push_in';

export function presetsInCategory(categoryId) {
  return PRESETS.filter(p => p.category === categoryId);
}

export function getPreset(id) {
  return PRESET_BY_ID[id] || PRESET_BY_ID[DEFAULT_PRESET_ID];
}
