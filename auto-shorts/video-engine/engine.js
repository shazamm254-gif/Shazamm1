'use strict';
/**
 * The video engine's public API.
 *
 * This is the reusable abstraction the rest of the application is written
 * against — the HTTP layer is a thin shell over these calls, and a CLI or a
 * desktop shell could drive the same functions without an HTTP server at all.
 *
 *   createProject()          importMedia()          analyzeAudio()
 *   detectSilence()          generateCaptions()     createEditDecisionList()
 *   applyCuts()              applyZooms()           placeBroll()
 *   generateSFXTimeline()    renderPreview()        exportVideo()
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const store = require('../backend/store');
const probe = require('./probe');
const renderer = require('./render');
const analyze = require('../audio/analyze');
const stt = require('../captions/stt');
const chunker = require('../captions/chunker');
const captionStyles = require('../captions/styles');
const edlLib = require('../timeline/edl');
const ops = require('../timeline/ops');
const { TimeMap } = require('../timeline/timemap');
const ai = require('../ai');
const exportPresets = require('../export/presets');
const sfxLib = require('../audio/sfx');
const { E } = require('../utils/errors');
const { id, round, escapeShellSafeName } = require('../utils');

/* ---------------------------------------------------------------- project */

function createProject(name, settings = {}) {
  const project = store.create(name);
  project.settings = { ...project.settings, ...settings };
  return store.save(project);
}

function loadProject(projectId) {
  return store.load(projectId);
}

function saveProject(project) {
  return store.save(project);
}

/* ------------------------------------------------------------------ media */

/**
 * Bring a file into the project: identify it, measure it, and build the cheap
 * derivatives (thumbnail, proxy) that keep the editor responsive.
 *
 * @param {object} project
 * @param {object} file    { path, originalname, mimetype, size }
 * @param {object} opts    { role: 'music' | 'voice' | 'broll-only' | null, tags: [] }
 */
async function importMedia(project, file, opts = {}) {
  const p = store.paths(project.id);
  fs.mkdirSync(p.media, { recursive: true });
  fs.mkdirSync(p.proxies, { recursive: true });
  fs.mkdirSync(p.thumbs, { recursive: true });

  const mediaId = id('m');
  const ext = path.extname(file.originalname || file.path) || '';
  const storedName = `${mediaId}${ext.toLowerCase()}`;
  const dest = path.join(p.media, storedName);

  // Move the upload into the project folder (rename across devices can fail).
  try {
    fs.renameSync(file.path, dest);
  } catch (_) {
    fs.copyFileSync(file.path, dest);
    try { fs.unlinkSync(file.path); } catch (__) { /* best effort */ }
  }

  let info;
  try {
    info = await probe.inspect(dest, opts.role);
  } catch (err) {
    // A file we cannot read should not be left behind in the project.
    try { fs.unlinkSync(dest); } catch (_) { /* best effort */ }
    throw err;
  }

  const record = {
    id: mediaId,
    filename: file.originalname || storedName,
    storedName,
    mime: file.mimetype || '',
    role: opts.role || null,
    tags: opts.tags || deriveTags(file.originalname || storedName),
    addedAt: new Date().toISOString(),
    ...info,
  };

  // Derivatives are best-effort: a missing thumbnail must never fail an upload.
  // Each one is verified to have actually produced bytes — FFmpeg can exit with
  // an empty file, and a zero-byte proxy would break playback far downstream
  // from the cause. If it did not work, the field is left unset and everything
  // falls back to the original file.
  const derive = async (field, name, make) => {
    const dir = field === 'thumbName' ? p.thumbs : p.proxies;
    const out = path.join(dir, name);
    try {
      await make(out);
      if (fs.existsSync(out) && fs.statSync(out).size > 512) {
        record[field] = name;
        return;
      }
      throw new Error('the file it produced was empty');
    } catch (err) {
      record.derivativeError = err.what || err.message;
      try { if (fs.existsSync(out)) fs.unlinkSync(out); } catch (_) { /* best effort */ }
    }
  };

  if (info.kind === 'video') {
    await derive('thumbName', `${mediaId}.jpg`, (out) => probe.makeThumbnail(dest, out, {
      atSecond: Math.min(1, (info.duration || 0) * 0.25),
    }));
    await derive('proxyName', `${mediaId}.webm`, (out) => probe.makeProxy(dest, out, { height: 480 }));
  } else if (info.kind === 'image') {
    await derive('thumbName', `${mediaId}.jpg`, (out) => probe.makeThumbnail(dest, out));
    await derive('proxyName', `${mediaId}.jpg`, (out) => probe.makeWebImage(dest, out));
  } else {
    await derive('proxyName', `${mediaId}.webm`, (out) => probe.makeAudioProxy(dest, out));
  }

  // Keep the hydrated record in memory: the rest of the pipeline reads
  // absPath directly, and store.save() strips the derived fields on the way
  // back to disk so project.json stays portable.
  const hydrated = store.hydrateMedia(project.id, record);
  project.media.push(hydrated);
  store.save(project);
  return hydrated;
}

/** Filename -> searchable tags, so auto B-roll matching has something to work with. */
function deriveTags(filename) {
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t))
    .slice(0, 8);
}

function removeMedia(project, mediaId) {
  const m = store.getMedia(project, mediaId);
  const p = store.paths(project.id);

  for (const f of [
    path.join(p.media, m.storedName),
    m.proxyName ? path.join(p.proxies, m.proxyName) : null,
    m.thumbName ? path.join(p.thumbs, m.thumbName) : null,
  ]) {
    if (f && fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (_) { /* best effort */ }
    }
  }

  project.media = project.media.filter((x) => x.id !== mediaId);

  // Any clip pointing at the deleted media becomes an unfilled B-roll slot
  // rather than a dangling reference that would break the render.
  if (project.edl) {
    project.edl.timeline = project.edl.timeline
      .map((c) => (c.source === mediaId
        ? (c.type === 'broll' ? { ...c, source: null, mediaKind: null } : null)
        : c))
      .filter(Boolean);
  }

  return store.save(project);
}

/* --------------------------------------------------------------- analysis */

/** Full voice-track analysis. */
async function analyzeAudio(project, mediaId = null, silenceLevel = null) {
  const m = mediaId
    ? store.getMedia(project, mediaId)
    : (project.media || []).find((x) => x.kind === 'audio' || (x.kind === 'video' && x.hasAudio));
  if (!m) throw E.noVoice();

  return analyze.analyzeVoice(m.absPath, {
    silenceLevel: silenceLevel || project.settings?.silenceRemoval || 'medium',
  });
}

/** Silence ranges and the cut plan, without the rest of the analysis. */
async function detectSilence(project, mediaId = null, level = null) {
  const a = await analyzeAudio(project, mediaId, level);
  return { silences: a.silences, plan: a.plan, threshold: a.threshold, duration: a.duration };
}

/**
 * Captions on their own, for the "regenerate captions" action — the rest of the
 * edit is left untouched.
 */
async function generateCaptions(project, { styleId = null, preferred = 'auto' } = {}) {
  const voice = (project.media || []).find(
    (m) => m.id === project.analysis?.voiceMediaId
  ) || (project.media || []).find((m) => m.kind === 'audio' || (m.kind === 'video' && m.hasAudio));
  if (!voice) throw E.noVoice();

  const a = await analyze.analyzeVoice(voice.absPath, {
    silenceLevel: project.settings?.silenceRemoval || 'medium',
  });

  const transcript = await stt.transcribe({
    audioPath: voice.absPath,
    script: project.script || '',
    srtText: project.srt || '',
    speech: a.speech,
    duration: a.duration,
    preferred,
    language: project.settings?.language || 'en',
  });

  const timeMap = new TimeMap(a.plan.keepRanges);
  const style = captionStyles.getStyle(styleId || project.settings?.captionStyle);
  const settings = ai.presets.resolveSettings(project);

  const analysis = await ai.AIProvider.analyze({
    words: transcript.words,
    sentences: transcript.sentences,
    text: transcript.text,
    settings,
    duration: a.duration,
    mediaTags: [],
  }, project.settings?.aiProvider);

  const emphasisByIndex = new Map(analysis.emphasis.map((e) => [e.index, e]));
  const editWords = [];
  transcript.words.forEach((w, i) => {
    const mapped = timeMap.rangeToEdit(w.start, w.end);
    if (!mapped) return;
    editWords.push({
      ...w, start: mapped.start, end: mapped.end,
      emphasis: emphasisByIndex.has(i) ? emphasisByIndex.get(i).level : null,
    });
  });

  return {
    chunks: chunker.chunk(editWords, style, { pace: settings.captionPace }),
    provider: transcript.providerLabel,
    approximate: transcript.approximate,
  };
}

/* --------------------------------------------------------------- the edit */

/** Run AUTO EDIT and store the result on the project. */
async function createEditDecisionList(project, opts = {}) {
  const result = await ai.autoEdit(project, opts);
  project.edl = result.edl;
  project.analysis = result.analysis;
  project.report = result.report;
  project.settings = { ...project.settings, overrides: extractOverrides(result.settings, project) };
  project.lastDirectives = opts.directives || [];
  project.preview = null;      // the cached preview no longer matches the edit
  store.save(project);
  return result;
}

/** Keep re-edit dial changes so a later re-run starts from where we left off. */
function extractOverrides(resolved, project) {
  const base = ai.presets.get(project.settings?.preset).settings || {};
  const out = {};
  for (const [k, v] of Object.entries(resolved)) {
    if (k === 'preset') continue;
    if (JSON.stringify(base[k]) !== JSON.stringify(v)) out[k] = v;
  }
  return out;
}

/** RE-EDIT: same content, different dials. */
async function reEdit(project, directives = []) {
  const merged = Array.from(new Set([...(project.lastDirectives || []), ...directives])).slice(-4);
  return createEditDecisionList(project, { directives: merged });
}

/** Apply one timeline operation and persist. */
function applyTimelineOp(project, opName, args) {
  if (!project.edl) throw E.noEdit();
  project.edl = ops.apply(project.edl, opName, args);
  project.preview = null;
  store.save(project);
  return project.edl;
}

/* -------- the granular pipeline steps, exposed for reuse and for tests ---- */

/** Cut a source into clips at the surviving ranges. */
function applyCuts(edl, keepRanges, mediaId) {
  const map = new TimeMap(keepRanges);
  const others = edl.timeline.filter((c) => !['video', 'image'].includes(c.type));
  const visuals = map.offsets.map((r) => edlLib.makeClip('video', {
    source: mediaId,
    start: round(r.editStart, 3),
    end: round(r.editEnd, 3),
    sourceIn: round(r.start, 3),
    mediaKind: 'video',
  }));
  const out = { ...edl, timeline: [...visuals, ...others] };
  out.duration = edlLib.computeDuration(out);
  return edlLib.sortTimeline(out);
}

/** Replace the zoom track. */
function applyZooms(edl, zooms) {
  const kept = edl.timeline.filter((c) => c.type !== 'zoom');
  const added = zooms.map((z) => edlLib.makeClip('zoom', {
    start: round(z.start, 3),
    end: round(z.end, 3),
    scale: z.scale || 1.08,
    attack: z.attack || 0.32,
    release: z.release || 0.4,
    reason: z.reason || 'manual',
  }));
  return edlLib.sortTimeline({ ...edl, timeline: [...kept, ...added] });
}

/** Fill a B-roll slot from the media library. */
function placeBroll(edl, clipId, mediaId, mediaKind) {
  return ops.replaceSource(edl, clipId, mediaId, mediaKind);
}

/** Replace the SFX track. */
function generateSFXTimeline(edl, hits) {
  const kept = edl.timeline.filter((c) => c.type !== 'sfx');
  const added = hits.map((h) => {
    const meta = sfxLib.SFX_LIBRARY[h.sfxName] || { duration: 0.4 };
    return edlLib.makeClip('sfx', {
      start: round(h.start, 3),
      end: round(h.start + meta.duration, 3),
      sfxName: h.sfxName,
      gain: h.gain ?? 0.4,
      reason: h.reason || 'manual',
    });
  });
  return edlLib.sortTimeline({ ...edl, timeline: [...kept, ...added] });
}

/* --------------------------------------------------------------- delivery */

/** Render the low-resolution preview proxy. */
async function renderPreview(project, onProgress) {
  if (!project.edl) throw E.noEdit();
  const p = store.paths(project.id);
  const outPath = path.join(p.work, 'preview.mp4');

  const result = await renderer.renderPreview({
    project, edl: project.edl, outPath, workDir: p.work, onProgress,
  });

  project.preview = {
    ...result,
    url: `/api/projects/${project.id}/preview/file?v=${Date.now()}`,
    renderedAt: new Date().toISOString(),
    edlDuration: project.edl.duration,
  };
  store.save(project);
  return project.preview;
}

/** Full-resolution export. */
async function exportVideo(project, presetId = null, onProgress) {
  if (!project.edl) throw E.noEdit();
  const p = store.paths(project.id);
  fs.mkdirSync(p.exports, { recursive: true });

  const target = exportPresets.get(presetId || config.export.defaultPreset);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = `${escapeShellSafeName(project.name)}-${target.id}-${stamp}`;
  const outPath = path.join(p.exports, `${base}.mp4`);

  const result = await renderer.exportVideo({
    project, edl: project.edl, presetId: target.id, outPath, workDir: p.work, onProgress,
  });

  const record = {
    id: id('exp'),
    file: path.basename(outPath),
    preset: target.id,
    width: result.width,
    height: result.height,
    fps: result.fps,
    duration: result.duration,
    sizeBytes: result.sizeBytes,
    renderMs: result.renderMs,
    hasAudio: result.hasAudio,
    captionsBurned: result.captionsBurned,
    srtFile: result.srtPath ? path.basename(result.srtPath) : null,
    createdAt: new Date().toISOString(),
  };

  project.exports.unshift(record);
  store.save(project);

  return {
    ...record,
    url: `/api/projects/${project.id}/exports/${record.id}/file`,
    srtUrl: record.srtFile ? `/api/projects/${project.id}/exports/${record.id}/srt` : null,
  };
}

module.exports = {
  createProject, loadProject, saveProject,
  importMedia, removeMedia,
  analyzeAudio, detectSilence, generateCaptions,
  createEditDecisionList, reEdit, applyTimelineOp,
  applyCuts, applyZooms, placeBroll, generateSFXTimeline,
  renderPreview, exportVideo,
  deriveTags,
};
