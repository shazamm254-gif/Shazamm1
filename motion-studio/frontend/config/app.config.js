/**
 * Every tunable number in one place. Nothing here depends on the DOM,
 * so it can be read by the engine, the UI and tests alike.
 */

export const APP = {
  name: 'Motion Studio',
  tagline: 'Still image → cinematic clip',
};

/** Output tiers. The app steps down this list if the device can't cope. */
export const QUALITY_TIERS = [
  { id: 'high',   label: '1080p',  width: 1080, height: 1920, bitrate: 12_000_000 },
  { id: 'medium', label: '864p',   width:  864, height: 1536, bitrate:  7_000_000 },
  { id: 'low',    label: '720p',   width:  720, height: 1280, bitrate:  4_500_000 },
];

export const DEFAULT_TIER = 'high';

/** Live preview runs at a fraction of export size so it stays at 60fps on a phone. */
export const PREVIEW = {
  width: 432,
  height: 768,
  fps: 30,
};

export const FPS_OPTIONS = [24, 30];
export const DEFAULT_FPS = 30;

export const DURATIONS = [3, 4, 5, 6, 8];
export const DEFAULT_DURATION = 5;

/** Motion Strength presets, as the brief specifies. */
export const STRENGTH_STOPS = [
  { id: 'subtle',  label: 'Subtle',  value: 0.25 },
  { id: 'medium',  label: 'Medium',  value: 0.50 },
  { id: 'strong',  label: 'Strong',  value: 0.75 },
  { id: 'extreme', label: 'Extreme', value: 1.00 },
];

export const DEFAULT_CONTROLS = {
  strength: 0.50,      // Motion Strength
  smoothness: 0.65,    // 0..1  → easing softness + handheld damping
  cameraSpeed: 0.50,   // 0..1  → how much of the move happens early vs late
  effectIntensity: 0.60, // 0..1 → particle count / opacity multiplier
};

/**
 * Hard safety rails. These exist so "Extreme" still looks like a camera
 * and never like a melting face. They are not user-editable.
 */
export const LIMITS = {
  /**
   * Max depth displacement as a fraction of frame width. This is the single
   * most important number in the app: above roughly 3% the displacement
   * starts visibly bending straight edges, which is exactly the "melting"
   * look the tool exists to avoid.
   */
  maxParallax: 0.026,
  /** Max zoom factor applied on top of a preset's own range. */
  maxZoom: 1.6,
  /** Max pan as a fraction of the frame. */
  maxPan: 0.22,
  /** Max roll in radians. */
  maxRoll: 0.06,
  /** Handheld noise amplitude ceiling (fraction of frame). */
  maxShake: 0.010,
  /** Oversample factor: the source is drawn slightly larger than the frame so
   *  panning and parallax never reveal an edge. */
  safetyScale: 1.08,
};

export const UPLOAD = {
  accept: 'image/jpeg,image/png,image/webp',
  extensions: ['jpg', 'jpeg', 'png', 'webp'],
  /** 25 MB — generous for a phone camera or an AI upscale, small enough to decode. */
  maxBytes: 25 * 1024 * 1024,
  /** The working copy is capped here; the original file is never modified. */
  maxWorkingEdge: 2560,
  minEdge: 160,
};

/** Encoder preference order. First supported one wins. */
export const ENCODER_CHAIN = [
  'webcodecs-avc1',
  'mediarecorder-mp4',
  'webcodecs-vp9-mp4',
  'mediarecorder-webm',
];

export const RENDER_STAGES = [
  { id: 'prepare', label: 'Preparing image…' },
  { id: 'depth',   label: 'Reading depth…' },
  { id: 'motion',  label: 'Creating motion…' },
  { id: 'encode',  label: 'Rendering video…' },
  { id: 'finalize',label: 'Finalizing MP4…' },
];
