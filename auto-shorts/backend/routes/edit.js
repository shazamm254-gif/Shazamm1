'use strict';
/** AUTO EDIT, RE-EDIT, timeline operations, and caption regeneration. */

const express = require('express');
const store = require('../store');
const engine = require('../../video-engine/engine');
const jobs = require('../jobs');
const edlLib = require('../../timeline/edl');
const { DIRECTIVE_LIST } = require('../../ai/autoEdit');
const { withProject } = require('./projects');
const { E } = require('../../utils/errors');

const router = express.Router();

/** AUTO EDIT — queued, because analysis plus transcription takes a few seconds. */
router.post('/:projectId/auto-edit', withProject, (req, res, next) => {
  try {
    const projectId = req.project.id;
    const directives = Array.isArray(req.body?.directives) ? req.body.directives : [];

    const job = jobs.run('auto-edit', async (onProgress) => {
      // Reload inside the job: settings may have changed while it was queued.
      const project = store.load(projectId);
      const result = await engine.createEditDecisionList(project, { directives, onProgress });
      return {
        edl: result.edl,
        report: result.report,
        analysis: result.analysis,
        summary: edlLib.summarize(result.edl),
      };
    }, { projectId, kind: 'auto-edit' });

    res.status(202).json({ job: jobs.get(job.id) });
  } catch (err) {
    next(err);
  }
});

/** RE-EDIT — same content, different dials. */
router.post('/:projectId/re-edit', withProject, (req, res, next) => {
  try {
    const projectId = req.project.id;
    const directives = Array.isArray(req.body?.directives) ? req.body.directives : [];
    const valid = new Set(DIRECTIVE_LIST.map((d) => d.id));
    const unknown = directives.filter((d) => !valid.has(d));

    if (unknown.length) {
      throw E.badInput(
        `"${unknown[0]}" is not a re-edit option.`,
        `Available options are: ${DIRECTIVE_LIST.map((d) => d.id).join(', ')}.`,
        'Pick an option from the RE-EDIT panel.'
      );
    }
    if (!req.project.edl) throw E.noEdit();

    const job = jobs.run('re-edit', async (onProgress) => {
      const project = store.load(projectId);
      const result = await engine.reEdit(project, directives);
      return {
        edl: result.edl,
        report: result.report,
        analysis: result.analysis,
        summary: edlLib.summarize(result.edl),
      };
    }, { projectId, kind: 're-edit', directives });

    res.status(202).json({ job: jobs.get(job.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId/edl', withProject, (req, res, next) => {
  try {
    if (!req.project.edl) throw E.noEdit();
    res.json({
      edl: req.project.edl,
      summary: edlLib.summarize(req.project.edl),
      tracks: edlLib.TRACKS,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * One endpoint for every timeline edit — split, trim, move, delete, duplicate,
 * replace, retime, patch, toggle emphasis, insert. Undo/redo lives in the
 * client as a stack of these results, which is why each returns a whole EDL.
 */
router.post('/:projectId/timeline/:op', withProject, (req, res, next) => {
  try {
    const edl = engine.applyTimelineOp(req.project, req.params.op, req.body || {});
    res.json({ edl, summary: edlLib.summarize(edl) });
  } catch (err) {
    next(err);
  }
});

/** Replace the whole EDL — how the client applies an undo or a redo. */
router.put('/:projectId/edl', withProject, (req, res, next) => {
  try {
    const incoming = req.body?.edl;
    if (!incoming || !Array.isArray(incoming.timeline)) {
      throw E.badInput(
        'That edit could not be restored.',
        'The request did not contain a timeline array.',
        'Reload the page; the last saved edit is still on disk.'
      );
    }

    const mediaIdx = new Map((req.project.media || []).map((m) => [m.id, m]));
    const check = edlLib.validate(incoming, mediaIdx);
    if (!check.ok) {
      throw E.badInput(
        'That edit could not be restored because it is inconsistent.',
        check.problems.slice(0, 3).join(' '),
        'Press AUTO EDIT to rebuild the timeline from your media.'
      );
    }

    incoming.duration = edlLib.computeDuration(incoming);
    req.project.edl = incoming;
    req.project.preview = null;
    store.save(req.project);

    res.json({ edl: incoming, summary: edlLib.summarize(incoming) });
  } catch (err) {
    next(err);
  }
});

/** Regenerate captions only, leaving cuts, zooms and sound design alone. */
router.post('/:projectId/captions/regenerate', withProject, (req, res, next) => {
  try {
    const projectId = req.project.id;
    const styleId = req.body?.style || null;

    const job = jobs.run('captions', async () => {
      const project = store.load(projectId);
      const { chunks, provider, approximate } = await engine.generateCaptions(project, { styleId });

      if (!project.edl) throw E.noEdit();

      const style = styleId || project.settings.captionStyle;
      project.edl.timeline = project.edl.timeline.filter((c) => c.type !== 'caption');
      for (const c of chunks) {
        project.edl.timeline.push(edlLib.makeClip('caption', {
          text: c.text, rawText: c.rawText, start: c.start, end: c.end,
          style, words: c.words, lines: c.lines,
        }));
      }
      project.edl = edlLib.sortTimeline(project.edl);
      project.preview = null;
      if (styleId) project.settings.captionStyle = styleId;
      store.save(project);

      return {
        edl: project.edl,
        count: chunks.length,
        provider,
        approximate,
        summary: edlLib.summarize(project.edl),
      };
    }, { projectId, kind: 'captions' });

    res.status(202).json({ job: jobs.get(job.id) });
  } catch (err) {
    next(err);
  }
});

/** Import an .srt so captions work with no speech engine and no script. */
router.post('/:projectId/captions/import', withProject, (req, res, next) => {
  try {
    const text = String(req.body?.srt || '');
    if (text.trim().length < 8) {
      throw E.badInput(
        'That subtitle file is empty.',
        'No cues could be read from the text that was sent.',
        'Open your .srt in a text editor, copy all of it, and paste it in again.'
      );
    }

    const { parseCues } = require('../../captions/stt/srt');
    const cues = parseCues(text);
    if (!cues.length) {
      throw E.badInput(
        'No subtitles could be read from that file.',
        'The text did not contain any "00:00:00,000 --> 00:00:02,000" timing lines.',
        'Make sure you pasted an .srt or .vtt file rather than a plain transcript.'
      );
    }

    req.project.srt = text;
    store.save(req.project);
    res.json({ cues: cues.length, note: 'Subtitles imported. Press AUTO EDIT (or Regenerate captions) to use them.' });
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId/jobs', withProject, (req, res) => {
  res.json({ jobs: jobs.forProject(req.project.id) });
});

router.get('/jobs/:jobId', (req, res, next) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return next(E.notFound('That job', 'Finished jobs are kept for a few hours and then discarded.'));
  res.json({ job });
});

module.exports = { router };
