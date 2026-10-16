'use strict';
/**
 * Editing presets.
 *
 * A preset is a set of dials, not a template. It changes how aggressively the
 * engine cuts, how often it moves the camera, how dense the captions are and
 * how much sound design it places — but the edit is still derived from the
 * creator's actual content, so two videos on the same preset do not come out
 * looking like the same video.
 */

const PRESETS = {
  high_retention: {
    id: 'high_retention',
    label: 'High Retention',
    tagline: 'Fast pacing, tight cuts, kinetic captions, occasional punch-ins.',
    description: 'The default. Cuts pauses tight, animates captions word by word, moves the camera on the moments that matter, and places restrained sound design. Built to hold attention without turning into a template.',
    settings: {
      silenceRemoval: 'medium',
      captionStyle: 'kinetic',
      captionPace: 1.15,        // >1 = fewer words per card, faster cadence
      emphasisIntensity: 1.15,
      zoomDensity: 0.55,        // punch-ins per 10s of runtime
      zoomScales: { normal: 1.07, strong: 1.14 },
      zoomHold: 1.5,
      brollDensity: 0.6,
      sfxIntensity: 'medium',
      transition: 'flash',
      patternInterrupt: true,
      musicLevel: 0.16,
      imageDuration: 2.6,
      kenBurns: 0.09,
    },
  },

  clean_documentary: {
    id: 'clean_documentary',
    label: 'Clean Documentary',
    tagline: 'Minimal movement, elegant captions, subtle transitions.',
    description: 'Lets the footage speak. Keeps natural pauses, barely moves the camera, and uses small captions low on the frame. Good for interviews and talking-head explainers.',
    settings: {
      silenceRemoval: 'low',
      captionStyle: 'minimal',
      captionPace: 0.85,
      emphasisIntensity: 0.45,
      zoomDensity: 0.12,
      zoomScales: { normal: 1.04, strong: 1.07 },
      zoomHold: 3.0,
      brollDensity: 0.45,
      sfxIntensity: 'low',
      transition: 'none',
      patternInterrupt: false,
      musicLevel: 0.12,
      imageDuration: 4.0,
      kenBurns: 0.06,
    },
  },

  storytelling: {
    id: 'storytelling',
    label: 'Storytelling',
    tagline: 'Cinematic pacing, images and B-roll, subtle sound design.',
    description: 'Paced for narration over visuals. Holds shots longer, leans on Ken Burns movement across stills, and places sound design on story beats rather than on every accent.',
    settings: {
      silenceRemoval: 'medium',
      captionStyle: 'clean',
      captionPace: 0.95,
      emphasisIntensity: 0.8,
      zoomDensity: 0.25,
      zoomScales: { normal: 1.05, strong: 1.10 },
      zoomHold: 2.6,
      brollDensity: 0.9,
      sfxIntensity: 'medium',
      transition: 'fade',
      patternInterrupt: false,
      musicLevel: 0.20,
      imageDuration: 3.4,
      kenBurns: 0.12,
    },
  },

  news: {
    id: 'news',
    label: 'News',
    tagline: 'Fast captions, headline emphasis, frequent visual changes.',
    description: 'Reads like a bulletin. Boxed headline captions, hard cuts, and a visual change on nearly every sentence.',
    settings: {
      silenceRemoval: 'aggressive',
      captionStyle: 'news',
      captionPace: 1.3,
      emphasisIntensity: 1.3,
      zoomDensity: 0.4,
      zoomScales: { normal: 1.06, strong: 1.11 },
      zoomHold: 1.2,
      brollDensity: 1.1,
      sfxIntensity: 'medium',
      transition: 'hard',
      patternInterrupt: true,
      musicLevel: 0.14,
      imageDuration: 2.2,
      kenBurns: 0.07,
    },
  },

  dark_cinematic: {
    id: 'dark_cinematic',
    label: 'Dark / Cinematic',
    tagline: 'For horror, science, mystery, crime and documentary.',
    description: 'Slow, deliberate, and heavy on atmosphere. Long holds, slow drifts across stills, warm accent captions, and low sub-heavy sound design.',
    settings: {
      silenceRemoval: 'low',
      captionStyle: 'cinematic',
      captionPace: 0.8,
      emphasisIntensity: 0.7,
      zoomDensity: 0.18,
      zoomScales: { normal: 1.05, strong: 1.09 },
      zoomHold: 3.5,
      brollDensity: 0.8,
      sfxIntensity: 'medium',
      transition: 'fade',
      patternInterrupt: false,
      musicLevel: 0.24,
      imageDuration: 4.2,
      kenBurns: 0.14,
      sfxPalette: ['sub', 'impact', 'rise', 'transition'],
    },
  },

  custom: {
    id: 'custom',
    label: 'Custom',
    tagline: 'You control every dial.',
    description: 'Starts from High Retention and keeps whatever you change. Nothing is overwritten on re-edit.',
    settings: null, // filled from high_retention, then overridden by the user
  },
};

const DEFAULT_PRESET = 'high_retention';

function get(presetId) {
  const p = PRESETS[presetId] || PRESETS[DEFAULT_PRESET];
  if (p.id === 'custom') {
    return { ...p, settings: { ...PRESETS[DEFAULT_PRESET].settings } };
  }
  return p;
}

/** Preset dials with the project's own overrides layered on top. */
function resolveSettings(project) {
  const preset = get(project.settings?.preset);
  const base = { ...preset.settings };
  const overrides = project.settings?.overrides || {};

  // Explicit user choices in the sidebar always win over the preset.
  for (const key of ['silenceRemoval', 'captionStyle', 'sfxIntensity', 'brollMode']) {
    if (project.settings && project.settings[key] !== undefined && project.settings[key] !== null) {
      base[key] = project.settings[key];
    }
  }
  return { ...base, ...overrides, preset: preset.id };
}

function list() {
  return Object.values(PRESETS).map((p) => ({
    id: p.id, label: p.label, tagline: p.tagline, description: p.description,
  }));
}

module.exports = { PRESETS, DEFAULT_PRESET, get, list, resolveSettings };
