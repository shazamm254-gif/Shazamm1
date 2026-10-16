'use strict';
/**
 * Capability reporting.
 *
 * The UI reads this on boot so it can tell the creator exactly which engines
 * are live on their machine — which speech-to-text is available, which AI
 * provider is in use, whether FFmpeg was found — instead of failing later with
 * a surprise. It is also the first thing to check when something misbehaves.
 */

const express = require('express');
const config = require('../../config');
const ff = require('../../video-engine/ffmpeg');
const stt = require('../../captions/stt');
const ai = require('../../ai');
const presets = require('../../ai/presets');
const captionStyles = require('../../captions/styles');
const exportPresets = require('../../export/presets');
const sfxLib = require('../../audio/sfx');
const { SILENCE_LEVELS } = require('../../audio/analyze');
const { DIRECTIVE_LIST } = require('../../ai/autoEdit');
const edlLib = require('../../timeline/edl');
const jobs = require('../jobs');

const router = express.Router();

/**
 * Serve a synthesized sound effect. The live preview schedules these through
 * WebAudio so what you hear while scrubbing is the same file the renderer mixes
 * into the export.
 */
router.get('/sfx/:name', (req, res, next) => {
  const path = require('path');
  const fs = require('fs');
  const name = String(req.params.name).replace(/[^a-z0-9_-]/gi, '');
  const file = path.join(config.paths.sfx, `${name}.wav`);

  if (!sfxLib.SFX_LIBRARY[name] || !fs.existsSync(file)) {
    return next(require('../../utils/errors').E.notFound(
      `The sound effect "${name}"`,
      'The effect palette is synthesized on first boot; restart the server to regenerate it.'
    ));
  }
  res.type('audio/wav');
  res.sendFile(path.resolve(file));
});

router.get('/health', (req, res) => {
  res.json({
    ok: ff.available(),
    ffmpeg: ff.available(),
    jobs: jobs.stats(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

/** Everything the frontend needs to render its option lists, in one call. */
router.get('/capabilities', async (req, res, next) => {
  try {
    const [sttStatus, aiStatus] = await Promise.all([
      stt.status({ hasScript: true, hasSrt: false }),
      ai.AIProvider.status(),
    ]);

    res.json({
      ffmpeg: {
        available: ff.available(),
        path: ff.FFMPEG,
        note: ff.available()
          ? 'Bundled static build — all rendering happens on this machine.'
          : 'Not found. Run "npm install" inside auto-shorts/, or set AUTOSHORTS_FFMPEG.',
      },
      font: config.font,
      stt: sttStatus,
      ai: aiStatus,
      presets: presets.list(),
      captionStyles: captionStyles.list(),
      captionStyleDetail: captionStyles.toPreviewPayload(),
      exportPresets: exportPresets.list(),
      silenceLevels: Object.keys(SILENCE_LEVELS),
      sfx: sfxLib.listSfx(config.paths.sfx),
      reEditOptions: DIRECTIVE_LIST,
      tracks: edlLib.TRACKS,
      video: {
        width: config.video.width,
        height: config.video.height,
        fps: config.video.fps,
        aspect: config.video.aspect,
      },
      safeZones: captionStyles.SAFE,
      limits: {
        maxUploadBytes: config.upload.maxFileSize,
        maxFiles: config.upload.maxFiles,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = { router };
