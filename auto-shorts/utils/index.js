'use strict';
/** Small shared helpers used across the engine. No dependencies. */

const crypto = require('crypto');

function id(prefix = '') {
  const s = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${s}` : s;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function round(v, places = 3) {
  const m = Math.pow(10, places);
  return Math.round(v * m) / m;
}

/** Seconds -> "M:SS" for UI display. */
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Seconds -> ASS timestamp "H:MM:SS.cc" (centisecond precision). */
function assTime(sec) {
  sec = Math.max(0, sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec - Math.floor(sec)) * 100);
  const cc = cs === 100 ? 99 : cs; // never round up into the next second
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}

/** Seconds -> SRT timestamp "HH:MM:SS,mmm". */
function srtTime(sec) {
  sec = Math.max(0, sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(Math.min(ms, 999)).padStart(3, '0')}`;
}

/** Parse "HH:MM:SS,mmm" or "HH:MM:SS.mmm" to seconds. */
function parseTimecode(tc) {
  const m = /^(\d+):(\d+):(\d+)[,.](\d+)$/.exec(String(tc).trim());
  if (!m) return null;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / Math.pow(10, m[4].length);
}

/** Deterministic pseudo-random in [0,1) from a string — keeps re-edits stable. */
function hashRandom(seed) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function deepClone(o) {
  return o === undefined ? o : JSON.parse(JSON.stringify(o));
}

/** Merge b into a, recursively, without mutating either. */
function deepMerge(a, b) {
  if (b === undefined || b === null) return deepClone(a);
  if (Array.isArray(b) || typeof b !== 'object') return deepClone(b);
  const out = deepClone(a) || {};
  for (const k of Object.keys(b)) {
    out[k] = (typeof out[k] === 'object' && out[k] !== null && !Array.isArray(out[k]))
      ? deepMerge(out[k], b[k])
      : deepClone(b[k]);
  }
  return out;
}

function sum(arr, f = (x) => x) {
  return arr.reduce((acc, x) => acc + f(x), 0);
}

/** Sort + merge overlapping [start,end] ranges. */
function mergeRanges(ranges, gap = 0) {
  const sorted = ranges.slice().sort((a, b) => a.start - b.start);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + gap) {
      last.end = Math.max(last.end, r.end);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/** Invert ranges within [0, total] — used to turn speech into silence and back. */
function invertRanges(ranges, total) {
  const merged = mergeRanges(ranges);
  const out = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) out.push({ start: cursor, end: Math.min(r.start, total) });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < total) out.push({ start: cursor, end: total });
  return out.filter((r) => r.end > r.start);
}

/** Rough syllable count — drives caption pacing when we align a script to audio. */
function syllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 1;
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function escapeShellSafeName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

module.exports = {
  id, clamp, round, fmtTime, assTime, srtTime, parseTimecode,
  hashRandom, deepClone, deepMerge, sum, mergeRanges, invertRanges,
  syllables, escapeShellSafeName,
};
