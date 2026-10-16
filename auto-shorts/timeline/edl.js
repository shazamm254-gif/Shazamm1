'use strict';
/**
 * The Edit Decision List.
 *
 * This is the contract the whole application is built around. The AI writes an
 * EDL; the timeline UI edits an EDL; the preview player interprets an EDL; the
 * renderer compiles an EDL into an FFmpeg filter graph. Nothing touches pixels
 * directly, which is why a "fix it" in the UI and a re-edit from the AI are the
 * same kind of operation, and why the browser preview can be trusted to match
 * the export.
 *
 * The timeline is one flat array of typed clips, exactly as the spec describes:
 *
 *   { "type": "video",   "source": "<mediaId>", "start": 0, "end": 4.2, "sourceIn": 1.0 }
 *   { "type": "caption", "text": "THIS IS WHY", "start": 1.2, "end": 2.1, "style": "kinetic" }
 *   { "type": "zoom",    "start": 2, "end": 3, "scale": 1.08 }
 *
 * Clip types
 *   video      primary picture from a video file
 *   image      primary picture from a still (carries Ken Burns data)
 *   broll      full-frame cutaway that replaces the primary picture for its span
 *   caption    one caption card, with per-word timings and emphasis marks
 *   zoom       a punch-in over a time range
 *   voice      the narration bed
 *   music      background music, with ducking
 *   sfx        one sound effect hit
 *   transition a cut treatment at a boundary
 */

const { id, round, clamp, deepClone } = require('../utils');

const CLIP_TYPES = ['video', 'image', 'broll', 'caption', 'zoom', 'voice', 'music', 'sfx', 'transition'];

/** Track ordering for the timeline UI. */
const TRACKS = [
  { id: 'video', label: 'VIDEO', types: ['video', 'image'], color: '#4DE1FF' },
  { id: 'broll', label: 'B-ROLL', types: ['broll'], color: '#A78BFA' },
  { id: 'caption', label: 'CAPTIONS', types: ['caption'], color: '#FFDA22' },
  { id: 'zoom', label: 'ZOOM', types: ['zoom'], color: '#34D399' },
  { id: 'voice', label: 'AUDIO', types: ['voice'], color: '#F97316' },
  { id: 'music', label: 'MUSIC', types: ['music'], color: '#60A5FA' },
  { id: 'sfx', label: 'SFX', types: ['sfx'], color: '#F472B6' },
];

function createEmpty() {
  return { version: 1, duration: 0, timeline: [], createdAt: new Date().toISOString() };
}

function makeClip(type, props = {}) {
  return {
    id: id('c'),
    type,
    start: 0,
    end: 0,
    locked: false,
    ...props,
  };
}

/** All clips of the given type(s), ordered by start time. */
function byType(edl, ...types) {
  const want = new Set(types.flat());
  return (edl.timeline || [])
    .filter((c) => want.has(c.type))
    .sort((a, b) => a.start - b.start);
}

function find(edl, clipId) {
  return (edl.timeline || []).find((c) => c.id === clipId) || null;
}

/** Longest end time across every clip. */
function computeDuration(edl) {
  return round((edl.timeline || []).reduce((m, c) => Math.max(m, c.end || 0), 0), 3);
}

/**
 * The primary visual program: video and image clips in order, with any B-roll
 * cutaway spliced over the top. This is what the renderer walks, and what the
 * preview player uses to decide which source is on screen at time t.
 *
 * Returns a contiguous, non-overlapping list of visual segments.
 */
function visualProgram(edl) {
  const primary = byType(edl, 'video', 'image');
  const broll = byType(edl, 'broll').filter((b) => b.source);
  if (!primary.length) return [];

  const segments = [];

  for (const p of primary) {
    // Cutaways that land inside this primary clip, clipped to its bounds.
    const overlaps = broll
      .map((b) => ({
        ...b,
        start: Math.max(b.start, p.start),
        end: Math.min(b.end, p.end),
      }))
      .filter((b) => b.end - b.start > 0.08)
      .sort((a, b) => a.start - b.start);

    let cursor = p.start;
    for (const b of overlaps) {
      if (b.start > cursor + 0.02) {
        segments.push(sliceOf(p, cursor, b.start));
      }
      segments.push({
        id: b.id,
        type: 'broll',
        source: b.source,
        mediaKind: b.mediaKind || 'video',
        start: round(b.start, 3),
        end: round(b.end, 3),
        sourceIn: b.sourceIn || 0,
        kenBurns: b.kenBurns || null,
        transitionIn: b.transitionIn || null,
      });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < p.end - 0.02) segments.push(sliceOf(p, cursor, p.end));
  }

  return segments.sort((a, b) => a.start - b.start);
}

/** Sub-range of a primary clip, keeping its source offset consistent. */
function sliceOf(clip, from, to) {
  const offset = from - clip.start;
  return {
    id: `${clip.id}@${round(from, 3)}`,
    parentId: clip.id,
    type: clip.type,
    source: clip.source,
    mediaKind: clip.type === 'image' ? 'image' : 'video',
    start: round(from, 3),
    end: round(to, 3),
    // Stills have no source timebase; video clips advance through theirs.
    sourceIn: clip.type === 'image' ? 0 : round((clip.sourceIn || 0) + offset, 3),
    kenBurns: clip.kenBurns || null,
    transitionIn: clip.transitionIn || null,
    speed: clip.speed || 1,
  };
}

/** Zoom events overlapping a segment, rebased to segment-local time. */
function zoomsForSegment(edl, segStart, segEnd) {
  return byType(edl, 'zoom')
    .filter((z) => z.end > segStart && z.start < segEnd)
    .map((z) => ({
      start: round(Math.max(0, z.start - segStart), 3),
      end: round(Math.min(segEnd - segStart, z.end - segStart), 3),
      scale: z.scale || 1.08,
      attack: z.attack || 0.32,
      release: z.release || 0.4,
    }))
    .filter((z) => z.end > z.start);
}

/* ------------------------------------------------------------ validation */

/**
 * Structural check. Returns { ok, problems[] }. Called before every render so
 * a malformed edit produces a readable message instead of an FFmpeg crash.
 */
function validate(edl, mediaIndex = new Map()) {
  const problems = [];
  const timeline = edl.timeline || [];

  if (!timeline.length) problems.push('The timeline is empty.');

  for (const c of timeline) {
    if (!CLIP_TYPES.includes(c.type)) {
      problems.push(`Clip ${c.id} has unknown type "${c.type}".`);
      continue;
    }
    if (!(c.end > c.start)) {
      problems.push(`Clip ${c.id} (${c.type}) ends at or before it starts.`);
    }
    // A B-roll clip with no source is an unfilled suggestion, not a fault —
    // the renderer skips it and the UI offers a Replace button. Every other
    // media-backed clip type must resolve to something on disk.
    if (['video', 'image', 'voice', 'music'].includes(c.type) && !c.source) {
      problems.push(`${c.type} clip ${c.id} has no source media.`);
    }
    if (c.source && mediaIndex.size && !mediaIndex.has(c.source)) {
      problems.push(`${c.type} clip ${c.id} points at media "${c.source}" which is no longer in the project.`);
    }
    if (c.type === 'caption' && !c.text) {
      problems.push(`Caption ${c.id} has no text.`);
    }
    if (c.type === 'sfx' && !c.sfxName) {
      problems.push(`SFX clip ${c.id} has no effect name.`);
    }
  }

  const visuals = byType(edl, 'video', 'image');
  if (!visuals.length) problems.push('There is no picture on the timeline — add a video clip or an image.');

  // Primary visuals must not overlap; that would be ambiguous to render.
  for (let i = 1; i < visuals.length; i++) {
    if (visuals[i].start < visuals[i - 1].end - 0.02) {
      problems.push(`Picture clips overlap between ${round(visuals[i].start, 2)}s and ${round(visuals[i - 1].end, 2)}s.`);
    }
  }

  return { ok: problems.length === 0, problems };
}

/* ------------------------------------------------------------- utilities */

/** Re-close gaps in the primary visual track after a delete or trim. */
function reflowVisuals(edl) {
  const out = deepClone(edl);
  const visuals = byType(out, 'video', 'image');
  let cursor = 0;
  const shifts = [];

  for (const v of visuals) {
    const len = v.end - v.start;
    if (Math.abs(v.start - cursor) > 0.001) {
      shifts.push({ from: v.start, delta: cursor - v.start, end: v.end });
    }
    v.start = round(cursor, 3);
    v.end = round(cursor + len, 3);
    cursor = v.end;
  }

  // Move dependent clips along with the picture they were attached to.
  for (const shift of shifts) {
    for (const c of out.timeline) {
      if (['video', 'image'].includes(c.type)) continue;
      if (c.start >= shift.from - 0.001 && c.end <= shift.end + 0.001) {
        c.start = round(c.start + shift.delta, 3);
        c.end = round(c.end + shift.delta, 3);
      }
    }
  }

  out.duration = computeDuration(out);
  return out;
}

function sortTimeline(edl) {
  const out = deepClone(edl);
  const order = new Map(CLIP_TYPES.map((t, i) => [t, i]));
  out.timeline.sort((a, b) => (a.start - b.start) || ((order.get(a.type) || 0) - (order.get(b.type) || 0)));
  return out;
}

/** Summary counts for the AI Edit panel and the UI header. */
function summarize(edl) {
  const t = edl.timeline || [];
  const count = (type) => t.filter((c) => c.type === type).length;
  const captions = t.filter((c) => c.type === 'caption');
  const emphasisCount = captions.reduce(
    (a, c) => a + (c.words || []).filter((w) => w.emphasis).length, 0
  );
  return {
    duration: computeDuration(edl),
    cuts: count('video') + count('image'),
    captions: captions.length,
    emphasis: emphasisCount,
    zooms: count('zoom'),
    broll: count('broll'),
    brollFilled: t.filter((c) => c.type === 'broll' && c.source).length,
    sfx: count('sfx'),
    music: count('music'),
  };
}

module.exports = {
  CLIP_TYPES, TRACKS,
  createEmpty, makeClip, byType, find, computeDuration,
  visualProgram, zoomsForSegment, validate, reflowVisuals, sortTimeline, summarize,
};
