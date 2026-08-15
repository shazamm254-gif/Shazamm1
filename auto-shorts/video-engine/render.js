'use strict';
/**
 * Rendering.
 *
 * Two outputs, one code path: a low-resolution proxy for the render-accurate
 * preview, and the full-resolution export. Both compile the same EDL through
 * the same filter graph, so what the creator approves in preview is what lands
 * in the MP4 — only the target geometry and encoder settings differ.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const ff = require('./ffmpeg');
const filtergraph = require('./filtergraph');
const edlLib = require('../timeline/edl');
const assLib = require('../captions/ass');
const captionStyles = require('../captions/styles');
const exportPresets = require('../export/presets');
const { E, AppError } = require('../utils/errors');
const { round } = require('../utils');

/** Caption clips -> .ass file on disk. Returns null when there are none. */
function writeCaptionFile(edl, outDir, tag = 'captions') {
  const captions = edlLib.byType(edl, 'caption').filter((c) => c.text && c.words && c.words.length);
  if (!captions.length) return null;

  // Captions can carry per-clip style overrides; group so each style renders
  // with its own [V4+ Styles] entry rather than being flattened to the first.
  const styleId = captions[0].style || captionStyles.DEFAULT_STYLE;
  const style = captionStyles.getStyle(styleId);

  const chunks = captions.map((c) => ({
    text: c.text,
    start: c.start,
    end: c.end,
    words: c.words,
  }));

  const body = assLib.build(chunks, style);
  const file = path.join(outDir, `${tag}.ass`);
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

/** Companion .srt, so the creator can upload captions separately if they want. */
function writeSrtFile(edl, outDir, tag = 'captions') {
  const captions = edlLib.byType(edl, 'caption').filter((c) => c.text);
  if (!captions.length) return null;
  const file = path.join(outDir, `${tag}.srt`);
  fs.writeFileSync(file, assLib.buildSrt(captions), 'utf8');
  return file;
}

/**
 * Core render. Everything else in this module is a thin wrapper around it.
 *
 * @param {object}   opts
 * @param {object}   opts.project
 * @param {object}   opts.edl
 * @param {object}   opts.target        geometry + encoder settings
 * @param {string}   opts.outPath
 * @param {string}   opts.workDir       where the .ass is written
 * @param {boolean}  opts.burnCaptions
 * @param {Function} opts.onProgress    (fraction, label)
 */
async function render({ project, edl, target, outPath, workDir, burnCaptions = true, onProgress = () => {} }) {
  ff.requireBinaries();

  const media = new Map((project.media || []).map((m) => [m.id, m]));

  // Validate before touching FFmpeg so problems read as sentences, not as a
  // filter-graph parse error.
  const check = edlLib.validate(edl, media);
  if (!check.ok) {
    throw new AppError({
      code: 'INVALID_EDIT',
      status: 400,
      what: 'The edit could not be rendered because the timeline is inconsistent.',
      why: check.problems.slice(0, 4).join(' '),
      fix: 'Press AUTO EDIT to rebuild the timeline, or undo your last timeline change.',
      detail: check.problems.join('\n'),
    });
  }

  // Every referenced file must still be on disk.
  for (const m of media.values()) {
    if (m.absPath && !fs.existsSync(m.absPath)) {
      throw new AppError({
        code: 'MEDIA_MISSING',
        status: 400,
        what: `The media file "${m.filename}" is missing.`,
        why: 'It was removed from the project folder after it was uploaded.',
        fix: 'Upload the file again, or delete it from the media library and re-run AUTO EDIT.',
      });
    }
  }

  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const assPath = burnCaptions ? writeCaptionFile(edl, workDir, path.basename(outPath, path.extname(outPath))) : null;

  let graph;
  try {
    graph = filtergraph.build({
      edl,
      media,
      assPath,
      outPath,
      target,
      sfxDir: config.paths.sfx,
      levels: project.settings?.levels || {},
    });
  } catch (err) {
    throw new AppError({
      code: 'GRAPH_BUILD_FAILED',
      status: 400,
      what: 'The edit could not be turned into a render plan.',
      why: err.message,
      fix: 'Press AUTO EDIT to rebuild the timeline from your media, then try again.',
    });
  }

  const started = Date.now();
  await ff.run(graph.args, {
    stage: `render (${target.width}x${target.height})`,
    totalDuration: graph.duration,
    onProgress: (f) => onProgress(f, `Rendering ${target.width}x${target.height}`),
  });

  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1000) {
    throw new AppError({
      code: 'EMPTY_OUTPUT',
      status: 500,
      what: 'The render finished but produced an unusable file.',
      why: 'FFmpeg exited cleanly yet wrote little or no data, which usually means every input segment was empty.',
      fix: 'Check that your clips are longer than the cuts on the timeline, then re-run AUTO EDIT.',
    });
  }

  return {
    path: outPath,
    sizeBytes: fs.statSync(outPath).size,
    duration: graph.duration,
    width: target.width,
    height: target.height,
    fps: target.fps,
    segments: graph.segmentCount,
    inputs: graph.inputCount,
    hasAudio: graph.hasAudio,
    captionsBurned: Boolean(assPath),
    renderMs: Date.now() - started,
  };
}

/**
 * Preview proxy — 540x960, faster encoder settings. Small enough to render in
 * seconds and to scrub smoothly on a phone, and it is the same graph the export
 * uses, so it is an accurate representation rather than an approximation.
 */
async function renderPreview({ project, edl, outPath, workDir, onProgress }) {
  return render({
    project, edl, outPath, workDir, onProgress,
    target: exportPresets.PREVIEW_TARGET,
    burnCaptions: true,
  });
}

/** Full-quality export. */
async function exportVideo({ project, edl, presetId, outPath, workDir, onProgress }) {
  const target = exportPresets.get(presetId);
  const result = await render({
    project, edl, outPath, workDir, onProgress,
    target,
    burnCaptions: true,
  });
  const srt = writeSrtFile(edl, path.dirname(outPath), path.basename(outPath, '.mp4'));
  return { ...result, preset: target.id, srtPath: srt };
}

/**
 * Single still from the edit, used for the poster frame and for the timeline
 * scrubber's thumbnails.
 */
async function renderStill({ project, edl, atSecond, outPath, workDir }) {
  const tmpVideo = path.join(workDir, `still-${Date.now()}.mp4`);
  fs.mkdirSync(workDir, { recursive: true });

  // Rendering a one-frame window is far cheaper than rendering the whole edit.
  const clipped = clipEdl(edl, Math.max(0, atSecond - 0.05), atSecond + 0.35);
  await render({
    project, edl: clipped, outPath: tmpVideo, workDir,
    target: { ...exportPresets.PREVIEW_TARGET, crf: 24 },
    burnCaptions: true,
  });
  await ff.run(['-i', tmpVideo, '-frames:v', '1', '-q:v', '3', '-y', outPath], { stage: 'still frame' });
  try { fs.unlinkSync(tmpVideo); } catch (_) { /* best effort */ }
  return outPath;
}

/** Narrow an EDL to a time window, rebasing everything to zero. */
function clipEdl(edl, from, to) {
  const out = { ...edl, timeline: [] };
  for (const c of edl.timeline) {
    if (c.end <= from || c.start >= to) continue;
    const start = Math.max(c.start, from);
    const end = Math.min(c.end, to);
    if (end - start < 0.01) continue;

    const clip = { ...c, start: round(start - from, 3), end: round(end - from, 3) };
    if (['video', 'broll'].includes(c.type)) {
      clip.sourceIn = round((c.sourceIn || 0) + (start - c.start), 3);
    }
    if (c.type === 'voice' && c.keepRanges) {
      // Keep only the portion of the voice that this window covers.
      let acc = 0;
      const kept = [];
      for (const r of c.keepRanges) {
        const len = r.end - r.start;
        const s = Math.max(from, acc);
        const e = Math.min(to, acc + len);
        if (e > s) kept.push({ start: round(r.start + (s - acc), 3), end: round(r.start + (e - acc), 3) });
        acc += len;
      }
      clip.keepRanges = kept;
    }
    if (c.words) {
      clip.words = c.words
        .filter((w) => w.end > from && w.start < to)
        .map((w) => ({ ...w, start: round(Math.max(w.start, from) - from, 3), end: round(Math.min(w.end, to) - from, 3) }));
    }
    out.timeline.push(clip);
  }
  out.duration = edlLib.computeDuration(out);
  return out;
}

module.exports = { render, renderPreview, exportVideo, renderStill, writeCaptionFile, writeSrtFile, clipEdl };
