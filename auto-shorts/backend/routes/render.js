'use strict';
/** Preview rendering, export, and delivery of the finished files. */

const express = require('express');
const fs = require('fs');
const path = require('path');
const store = require('../store');
const engine = require('../../video-engine/engine');
const jobs = require('../jobs');
const exportPresets = require('../../export/presets');
const { withProject } = require('./projects');
const { E } = require('../../utils/errors');

const router = express.Router();

/**
 * Render the preview proxy.
 *
 * The browser preview is a live canvas that interprets the EDL directly, so a
 * proxy render is not needed to review an edit. This exists for the moment
 * before export when the creator wants to see the exact encoded result — same
 * filter graph, same captions, just smaller and faster.
 */
router.post('/:projectId/preview', withProject, (req, res, next) => {
  try {
    if (!req.project.edl) throw E.noEdit();
    const projectId = req.project.id;

    const job = jobs.run('preview', async (onProgress) => {
      const project = store.load(projectId);
      return engine.renderPreview(project, onProgress);
    }, { projectId, kind: 'preview' });

    res.status(202).json({ job: jobs.get(job.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId/preview/file', withProject, (req, res, next) => {
  const file = path.join(store.paths(req.project.id).work, 'preview.mp4');
  if (!fs.existsSync(file)) {
    return next(E.notFound(
      'The preview render',
      'It has not been rendered yet, or it was invalidated by a change to the edit. Press "Render exact preview" again.'
    ));
  }
  res.sendFile(path.resolve(file));
});

router.get('/:projectId/export/presets', (req, res) => {
  res.json({ presets: exportPresets.list(), default: exportPresets.get().id });
});

router.post('/:projectId/export', withProject, (req, res, next) => {
  try {
    if (!req.project.edl) throw E.noEdit();
    const projectId = req.project.id;
    const presetId = req.body?.preset || null;

    if (presetId && !exportPresets.EXPORT_PRESETS[presetId]) {
      throw E.badInput(
        `"${presetId}" is not an export size.`,
        `Available sizes are: ${Object.keys(exportPresets.EXPORT_PRESETS).join(', ')}.`,
        'Choose 1080p or 720p on the Export screen.'
      );
    }

    const job = jobs.run('export', async (onProgress) => {
      const project = store.load(projectId);
      return engine.exportVideo(project, presetId, onProgress);
    }, { projectId, kind: 'export', preset: presetId || exportPresets.get().id });

    res.status(202).json({ job: jobs.get(job.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId/exports', withProject, (req, res) => {
  const exports = (req.project.exports || []).map((e) => ({
    ...e,
    url: `/api/projects/${req.project.id}/exports/${e.id}/file`,
    srtUrl: e.srtFile ? `/api/projects/${req.project.id}/exports/${e.id}/srt` : null,
  }));
  res.json({ exports });
});

function findExport(project, exportId) {
  const rec = (project.exports || []).find((e) => e.id === exportId);
  if (!rec) throw E.notFound('That export');
  return rec;
}

router.get('/:projectId/exports/:exportId/file', withProject, (req, res, next) => {
  try {
    const rec = findExport(req.project, req.params.exportId);
    const file = path.join(store.paths(req.project.id).exports, rec.file);
    if (!fs.existsSync(file)) {
      return next(E.notFound('That export file', 'It was deleted from the project folder after it was rendered.'));
    }
    // Inline so the browser can play it; the UI offers a separate download link.
    if (req.query.download) return res.download(file, rec.file);
    res.sendFile(path.resolve(file));
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId/exports/:exportId/srt', withProject, (req, res, next) => {
  try {
    const rec = findExport(req.project, req.params.exportId);
    if (!rec.srtFile) return next(E.notFound('A subtitle file for that export', 'This export had no captions.'));
    const file = path.join(store.paths(req.project.id).exports, rec.srtFile);
    if (!fs.existsSync(file)) return next(E.notFound('That subtitle file'));
    res.download(file, rec.srtFile);
  } catch (err) {
    next(err);
  }
});

router.delete('/:projectId/exports/:exportId', withProject, (req, res, next) => {
  try {
    const rec = findExport(req.project, req.params.exportId);
    const dir = store.paths(req.project.id).exports;
    for (const f of [rec.file, rec.srtFile]) {
      if (!f) continue;
      const p = path.join(dir, f);
      if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch (_) { /* best effort */ } }
    }
    req.project.exports = req.project.exports.filter((e) => e.id !== rec.id);
    store.save(req.project);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = { router };
