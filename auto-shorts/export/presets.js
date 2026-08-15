'use strict';
/**
 * Export targets.
 *
 * Defaults match what the short-form platforms actually want: 1080x1920, H.264
 * High profile, 30 fps, AAC. Rendering happens locally through the bundled
 * FFmpeg — there is no cloud render step and no upload.
 */

const config = require('../config');

const EXPORT_PRESETS = {
  '1080p': {
    id: '1080p',
    label: '1080p — 1080 x 1920',
    description: 'Full quality. What you upload to YouTube Shorts, TikTok and Reels.',
    width: 1080,
    height: 1920,
    fps: 30,
    crf: 20,
    preset: 'medium',
    audioBitrate: '192k',
  },
  '720p': {
    id: '720p',
    label: '720p — 720 x 1280',
    description: 'Smaller and quicker to render. Good for drafts and for slow connections.',
    width: 720,
    height: 1280,
    fps: 30,
    crf: 22,
    preset: 'fast',
    audioBitrate: '160k',
  },
};

/** Low-resolution proxy used by the render-accurate preview. */
const PREVIEW_TARGET = {
  id: 'preview',
  label: 'Preview proxy',
  width: config.preview.width,
  height: config.preview.height,
  fps: config.preview.fps,
  crf: config.preview.crf,
  preset: config.preview.preset,
  audioBitrate: '128k',
};

function get(id) {
  return EXPORT_PRESETS[id] || EXPORT_PRESETS[config.export.defaultPreset];
}

function list() {
  return Object.values(EXPORT_PRESETS).map((p) => ({
    id: p.id, label: p.label, description: p.description,
    width: p.width, height: p.height, fps: p.fps,
  }));
}

module.exports = { EXPORT_PRESETS, PREVIEW_TARGET, get, list };
