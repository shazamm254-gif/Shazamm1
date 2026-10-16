'use strict';
/** Project lifecycle: create, list, open, rename, settings, script, delete. */

const express = require('express');
const store = require('../store');
const engine = require('../../video-engine/engine');
const presets = require('../../ai/presets');
const captionStyles = require('../../captions/styles');
const { E } = require('../../utils/errors');
const { deepMerge } = require('../../utils');

const router = express.Router();

/** Attach the project to the request, or 404 with a readable message. */
function withProject(req, res, next) {
  try {
    req.project = store.load(req.params.projectId);
    next();
  } catch (err) {
    next(err);
  }
}

router.get('/', (req, res) => {
  res.json({ projects: store.list() });
});

router.post('/', (req, res, next) => {
  try {
    const { name, targetDuration, preset, mode, aspect } = req.body || {};

    if (preset && !presets.PRESETS[preset]) {
      throw E.badInput(
        `"${preset}" is not an editing style.`,
        `Available styles are: ${Object.keys(presets.PRESETS).join(', ')}.`,
        'Pick a style from the list on the New Short screen.'
      );
    }

    const project = engine.createProject(name || 'Untitled Short', {
      targetDuration: Math.max(5, Math.min(600, Number(targetDuration) || 60)),
      preset: preset || presets.DEFAULT_PRESET,
      mode: mode === 'image_story' ? 'image_story' : 'auto',
      aspect: aspect || '9:16',
    });

    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId', withProject, (req, res) => {
  res.json({ project: req.project });
});

router.patch('/:projectId', withProject, (req, res, next) => {
  try {
    const project = req.project;
    const { name, settings, script, srt } = req.body || {};

    if (name !== undefined) project.name = String(name).slice(0, 120);
    if (script !== undefined) project.script = String(script).slice(0, 100000);
    if (srt !== undefined) project.srt = String(srt).slice(0, 500000);

    if (settings) {
      if (settings.preset && !presets.PRESETS[settings.preset]) {
        throw E.badInput(
          `"${settings.preset}" is not an editing style.`,
          `Available styles are: ${Object.keys(presets.PRESETS).join(', ')}.`,
          'Pick one of the listed styles.'
        );
      }
      if (settings.captionStyle && !captionStyles.STYLES[settings.captionStyle]) {
        throw E.badInput(
          `"${settings.captionStyle}" is not a caption style.`,
          `Available caption styles are: ${Object.keys(captionStyles.STYLES).join(', ')}.`,
          'Pick one of the listed caption styles.'
        );
      }
      // Changing the editing style discards dial overrides from a previous
      // re-edit; keeping them would silently contradict the new style.
      if (settings.preset && settings.preset !== project.settings.preset) {
        project.settings.overrides = {};
        project.lastDirectives = [];
      }
      project.settings = deepMerge(project.settings, settings);
    }

    store.save(project);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

router.delete('/:projectId', (req, res, next) => {
  try {
    store.remove(req.params.projectId);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

/** Duplicate the *edit*, not the media — useful for trying a second style. */
router.post('/:projectId/duplicate', withProject, (req, res, next) => {
  try {
    const src = req.project;
    const copy = engine.createProject(`${src.name} (copy)`, src.settings);
    copy.script = src.script;
    copy.srt = src.srt;
    store.save(copy);
    res.status(201).json({
      project: copy,
      note: 'Settings and script were copied. Upload media into the new project, or re-import it, then press AUTO EDIT.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, withProject };
