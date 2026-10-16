'use strict';
/** Media library: upload, list, tag, serve, delete. */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../../config');
const store = require('../store');
const engine = require('../../video-engine/engine');
const { withProject } = require('./projects');
const { E, AppError } = require('../../utils/errors');

const router = express.Router();

const upload = multer({
  dest: config.paths.tmp,
  limits: { fileSize: config.upload.maxFileSize, files: config.upload.maxFiles },
});

/** Turn multer's terse errors into the what/why/fix shape. */
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError({
        code: 'FILE_TOO_LARGE',
        status: 413,
        what: 'That file is too large to upload.',
        why: `The limit is ${Math.round(config.upload.maxFileSize / (1024 * 1024))} MB per file.`,
        fix: 'Trim the clip before uploading, or raise AUTOSHORTS_MAX_UPLOAD and restart the server.',
      }));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new AppError({
        code: 'TOO_MANY_FILES',
        status: 413,
        what: 'Too many files in one upload.',
        why: `The limit is ${config.upload.maxFiles} files at a time.`,
        fix: 'Upload them in smaller batches.',
      }));
    }
    return next(E.uploadFailed(err.message));
  }
  return next(err);
}

router.post(
  '/:projectId/media',
  withProject,
  upload.array('files', config.upload.maxFiles),
  handleUploadErrors,
  async (req, res, next) => {
    try {
      const files = req.files || [];
      if (!files.length) {
        throw E.uploadFailed('No files were attached to the request.');
      }

      const role = req.body.role || null;
      const added = [];
      const failed = [];

      // One bad file should not lose the whole batch.
      for (const file of files) {
        try {
          added.push(await engine.importMedia(req.project, file, { role }));
        } catch (err) {
          failed.push({
            filename: file.originalname,
            what: err.what || 'The file could not be imported.',
            why: err.why || err.message,
            fix: err.fix || 'Convert it to MP4, MP3 or JPG and try again.',
          });
          try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) { /* best effort */ }
        }
      }

      if (!added.length && failed.length) {
        return res.status(400).json({
          error: true,
          code: 'ALL_UPLOADS_FAILED',
          what: 'None of those files could be imported.',
          why: failed.map((f) => `${f.filename}: ${f.why}`).join(' '),
          fix: 'Convert them to MP4 (video), MP3/WAV (audio) or JPG/PNG (image) and try again.',
          failed,
        });
      }

      res.status(201).json({ media: added, failed, project: store.load(req.project.id) });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:projectId/media', withProject, (req, res) => {
  res.json({ media: req.project.media });
});

/** Tags feed automatic B-roll matching, so they are editable. */
router.patch('/:projectId/media/:mediaId', withProject, (req, res, next) => {
  try {
    const m = store.getMedia(req.project, req.params.mediaId);
    const { tags, role } = req.body || {};

    if (tags !== undefined) {
      m.tags = (Array.isArray(tags) ? tags : String(tags).split(','))
        .map((t) => String(t).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12);
    }
    if (role !== undefined) m.role = role || null;

    store.save(req.project);
    res.json({ media: store.hydrateMedia(req.project.id, m) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:projectId/media/:mediaId', withProject, (req, res, next) => {
  try {
    engine.removeMedia(req.project, req.params.mediaId);
    res.json({ deleted: true, project: store.load(req.project.id) });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------------------------------- file delivery */

function usable(filePath) {
  try {
    return Boolean(filePath) && fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  } catch (_) {
    return false;
  }
}

function sendFile(res, filePath, next, { download = null } = {}) {
  if (!usable(filePath)) {
    return next(E.notFound('That file', 'It may not have finished processing, or it was deleted from the project folder.'));
  }
  if (download) return res.download(filePath, download);
  return res.sendFile(path.resolve(filePath));
}

router.get('/:projectId/media/:mediaId/file', withProject, (req, res, next) => {
  try {
    const m = store.getMedia(req.project, req.params.mediaId);
    sendFile(res, m.absPath, next);
  } catch (err) { next(err); }
});

/**
 * The proxy is what the editor streams — small, fast, and always web-safe.
 * If it could not be built (or came out empty), fall back to the original so
 * the preview still has something to play.
 */
router.get('/:projectId/media/:mediaId/proxy', withProject, (req, res, next) => {
  try {
    const m = store.getMedia(req.project, req.params.mediaId);
    sendFile(res, usable(m.proxyPath) ? m.proxyPath : m.absPath, next);
  } catch (err) { next(err); }
});

router.get('/:projectId/media/:mediaId/thumb', withProject, (req, res, next) => {
  try {
    const m = store.getMedia(req.project, req.params.mediaId);
    sendFile(res, m.thumbPath, next);
  } catch (err) { next(err); }
});

module.exports = { router };
