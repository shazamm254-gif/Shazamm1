'use strict';
/**
 * Project persistence.
 *
 * A project is a folder on disk: a project.json describing the edit, plus the
 * media the creator uploaded, its derived proxies and thumbnails, and any
 * exports. Nothing lives in a database and nothing is uploaded anywhere, so a
 * project can be zipped, moved between machines, or backed up by copying a
 * directory.
 *
 * Writes go through a temp file and a rename, so an interrupted save can never
 * leave a half-written project.json behind.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const presets = require('../ai/presets');
const captionStyles = require('../captions/styles');
const { id, deepClone, round } = require('../utils');
const { E } = require('../utils/errors');

const PROJECT_FILE = 'project.json';

function ensureDirs() {
  fs.mkdirSync(config.paths.projects, { recursive: true });
  fs.mkdirSync(config.paths.tmp, { recursive: true });
  fs.mkdirSync(config.paths.sfx, { recursive: true });
}

function projectDir(projectId) {
  return path.join(config.paths.projects, projectId);
}

function paths(projectId) {
  const base = projectDir(projectId);
  return {
    base,
    file: path.join(base, PROJECT_FILE),
    media: path.join(base, 'media'),
    proxies: path.join(base, 'proxies'),
    thumbs: path.join(base, 'thumbs'),
    exports: path.join(base, 'exports'),
    work: path.join(base, 'work'),
  };
}

/** Default project shape. Everything the editor needs is declared up front. */
function defaults(name) {
  return {
    id: id('proj'),
    name: name || 'Untitled Short',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,

    settings: {
      aspect: '9:16',
      width: config.video.width,
      height: config.video.height,
      fps: config.video.fps,
      targetDuration: 60,
      preset: presets.DEFAULT_PRESET,
      mode: 'auto',                 // 'auto' | 'image_story'
      silenceRemoval: 'medium',
      captionStyle: captionStyles.DEFAULT_STYLE,
      sfxIntensity: 'medium',
      brollMode: 'auto',            // 'auto' | 'manual'
      levels: { voice: 1.0, music: 0.16, sfx: 0.5 },
      voiceMediaId: null,
      sttProvider: 'auto',
      aiProvider: 'auto',
      language: 'en',
      overrides: {},
    },

    script: '',
    srt: '',
    media: [],
    edl: null,
    analysis: null,
    report: null,
    exports: [],
    preview: null,
    lastDirectives: [],
  };
}

function create(name) {
  ensureDirs();
  const project = defaults(name);
  const p = paths(project.id);
  for (const dir of [p.base, p.media, p.proxies, p.thumbs, p.exports, p.work]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  save(project);
  return project;
}

function exists(projectId) {
  return fs.existsSync(paths(projectId).file);
}

function load(projectId) {
  const p = paths(projectId);
  if (!fs.existsSync(p.file)) throw E.notFound(`Project "${projectId}"`);

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(p.file, 'utf8'));
  } catch (err) {
    throw E.badInput(
      'The project file could not be read.',
      `${PROJECT_FILE} for this project is not valid JSON (${err.message}).`,
      'Restore it from a backup, or create a new project and re-upload your media. The original media files are untouched in the project folder.'
    );
  }

  // Re-derive absolute paths on every load: the project folder can be moved to
  // another machine and the stored paths would then be wrong.
  raw.media = (raw.media || []).map((m) => hydrateMedia(projectId, m));
  return raw;
}

/** Attach the on-disk locations and public URLs for one media record. */
function hydrateMedia(projectId, m) {
  const p = paths(projectId);
  return {
    ...m,
    absPath: path.join(p.media, m.storedName),
    proxyPath: m.proxyName ? path.join(p.proxies, m.proxyName) : null,
    thumbPath: m.thumbName ? path.join(p.thumbs, m.thumbName) : null,
    url: `/api/projects/${projectId}/media/${m.id}/file`,
    proxyUrl: m.proxyName ? `/api/projects/${projectId}/media/${m.id}/proxy` : null,
    thumbUrl: m.thumbName ? `/api/projects/${projectId}/media/${m.id}/thumb` : null,
  };
}

/** Strip the derived fields before writing, so project.json stays portable. */
function dehydrate(project) {
  const out = deepClone(project);
  out.media = (out.media || []).map((m) => {
    const { absPath, proxyPath, thumbPath, url, proxyUrl, thumbUrl, ...rest } = m;
    return rest;
  });
  return out;
}

function save(project) {
  const p = paths(project.id);
  fs.mkdirSync(p.base, { recursive: true });
  project.updatedAt = new Date().toISOString();

  const tmp = `${p.file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(dehydrate(project), null, 2), 'utf8');
  fs.renameSync(tmp, p.file);
  return project;
}

/** Every project, newest first, with just enough for the home screen. */
function list() {
  ensureDirs();
  const out = [];

  for (const entry of fs.readdirSync(config.paths.projects, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(config.paths.projects, entry.name, PROJECT_FILE);
    if (!fs.existsSync(file)) continue;

    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      const poster = (raw.media || []).find((m) => m.thumbName);
      out.push({
        id: raw.id,
        name: raw.name,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        preset: raw.settings?.preset,
        targetDuration: raw.settings?.targetDuration,
        mediaCount: (raw.media || []).length,
        hasEdit: Boolean(raw.edl && raw.edl.timeline && raw.edl.timeline.length),
        duration: raw.edl ? round(raw.edl.duration || 0, 1) : 0,
        exportCount: (raw.exports || []).length,
        posterUrl: poster ? `/api/projects/${raw.id}/media/${poster.id}/thumb` : null,
      });
    } catch (_) {
      // A corrupt project should not take down the project list.
      out.push({ id: entry.name, name: entry.name, broken: true, updatedAt: null });
    }
  }

  return out.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

function remove(projectId) {
  const p = paths(projectId);
  if (!fs.existsSync(p.base)) throw E.notFound(`Project "${projectId}"`);
  fs.rmSync(p.base, { recursive: true, force: true });
  return true;
}

function rename(projectId, name) {
  const project = load(projectId);
  project.name = String(name).slice(0, 120) || project.name;
  return save(project);
}

/** Look up one media record, or throw a readable error. */
function getMedia(project, mediaId) {
  const m = (project.media || []).find((x) => x.id === mediaId);
  if (!m) throw E.notFound(`Media "${mediaId}"`, 'It may have been deleted from the media library.');
  return m;
}

module.exports = {
  ensureDirs, paths, projectDir, defaults,
  create, load, save, list, remove, rename, exists,
  getMedia, hydrateMedia, PROJECT_FILE,
};
