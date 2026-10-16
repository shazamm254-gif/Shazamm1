'use strict';
/**
 * Central configuration. Everything is local-first: paths point at this repo,
 * no cloud service is required for any part of the pipeline.
 */
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

const config = {
  root: ROOT,
  port: parseInt(env('PORT', '5174'), 10),
  host: env('HOST', '0.0.0.0'),

  paths: {
    data: env('AUTOSHORTS_DATA', path.join(ROOT, 'data')),
    projects: path.join(env('AUTOSHORTS_DATA', path.join(ROOT, 'data')), 'projects'),
    tmp: path.join(env('AUTOSHORTS_DATA', path.join(ROOT, 'data')), 'tmp'),
    assets: path.join(ROOT, 'assets'),
    sfx: path.join(ROOT, 'assets', 'sfx'),
    frontendDist: path.join(ROOT, 'frontend', 'dist'),
  },

  // Upload limits (bytes). Generous — everything stays on this machine.
  upload: {
    maxFileSize: parseInt(env('AUTOSHORTS_MAX_UPLOAD', String(2 * 1024 * 1024 * 1024)), 10),
    maxFiles: 40,
  },

  // Canonical output geometry for a vertical Short.
  video: {
    aspect: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    // Oversample factor: source is scaled to this multiple of the output so
    // punch-ins and Ken Burns never upscale beyond native resolution.
    zoomHeadroom: 1.3,
  },

  preview: {
    width: 540,
    height: 960,
    fps: 24,
    crf: 30,
    preset: 'veryfast',
  },

  export: {
    presets: {
      '1080p': { width: 1080, height: 1920, crf: 20, preset: 'medium', audioBitrate: '192k' },
      '720p': { width: 720, height: 1280, crf: 22, preset: 'fast', audioBitrate: '160k' },
    },
    defaultPreset: '1080p',
  },

  // Fonts available to libass. Resolved at boot; first hit wins.
  fontCandidates: [
    { family: 'DejaVu Sans', file: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' },
    { family: 'Liberation Sans', file: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf' },
    { family: 'FreeSans', file: '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf' },
    { family: 'DejaVu Sans', file: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf' },
  ],

  ai: {
    // 'local' needs no keys and no network. Others activate only if a key exists.
    provider: env('AUTOSHORTS_AI_PROVIDER', 'auto'),
    anthropicKey: env('ANTHROPIC_API_KEY', ''),
    anthropicModel: env('AUTOSHORTS_ANTHROPIC_MODEL', 'claude-sonnet-5'),
    openaiKey: env('OPENAI_API_KEY', ''),
    openaiModel: env('AUTOSHORTS_OPENAI_MODEL', 'gpt-4o-mini'),
    timeoutMs: 30000,
  },

  stt: {
    // 'auto' picks the best available: whisper binary > script alignment > none.
    provider: env('AUTOSHORTS_STT_PROVIDER', 'auto'),
    whisperBin: env('AUTOSHORTS_WHISPER_BIN', ''),
    whisperModel: env('AUTOSHORTS_WHISPER_MODEL', ''),
    language: env('AUTOSHORTS_STT_LANG', 'en'),
  },

  jobs: {
    maxConcurrent: parseInt(env('AUTOSHORTS_MAX_JOBS', '2'), 10),
    retentionMs: 1000 * 60 * 60 * 6,
  },
};

/** Resolve the first font that actually exists on this machine. */
function resolveFont() {
  for (const c of config.fontCandidates) {
    try {
      if (fs.existsSync(c.file)) return c;
    } catch (_) { /* ignore */ }
  }
  return { family: 'sans-serif', file: null };
}

config.font = resolveFont();

module.exports = config;
