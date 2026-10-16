'use strict';
/**
 * Timeline operations.
 *
 * Deliberately small. The spec is explicit that this is not Premiere: the AI
 * does the editing, and these exist so a creator can correct it in one tap —
 * split, trim, move, delete, duplicate, replace, retime. Every operation is a
 * pure function returning a new EDL, which is what makes undo/redo a plain
 * history stack rather than a diffing problem.
 */

const edlLib = require('./edl');
const { deepClone, round, clamp, id } = require('../utils');
const { E } = require('../utils/errors');

function requireClip(edl, clipId) {
  const clip = edlLib.find(edl, clipId);
  if (!clip) {
    throw E.badInput(
      'That clip is no longer on the timeline.',
      'It was deleted or replaced by a re-edit since the panel was opened.',
      'Close the inspector and pick the clip again.'
    );
  }
  return clip;
}

/** Split a clip in two at an absolute timeline position. */
function split(edl, clipId, at) {
  const out = deepClone(edl);
  const clip = requireClip(out, clipId);

  if (at <= clip.start + 0.05 || at >= clip.end - 0.05) {
    throw E.badInput(
      'The split point is too close to the edge of the clip.',
      'Splitting there would leave a fragment shorter than 0.05 seconds.',
      'Move the playhead further into the clip and split again.'
    );
  }

  const second = { ...deepClone(clip), id: id('c'), start: round(at, 3) };
  if (clip.type === 'video' || clip.type === 'broll') {
    second.sourceIn = round((clip.sourceIn || 0) + (at - clip.start), 3);
  }
  if (clip.words) {
    second.words = clip.words.filter((w) => w.start >= at);
    clip.words = clip.words.filter((w) => w.start < at);
    second.text = second.words.map((w) => w.word).join(' ');
    clip.text = clip.words.map((w) => w.word).join(' ');
  }

  clip.end = round(at, 3);
  out.timeline.push(second);
  out.duration = edlLib.computeDuration(out);
  return edlLib.sortTimeline(out);
}

/**
 * Trim one edge. `edge` is 'start' or 'end'. Video/B-roll keep their source
 * offset in sync so trimming the head does not re-time the footage.
 */
function trim(edl, clipId, edge, newTime) {
  const out = deepClone(edl);
  const clip = requireClip(out, clipId);
  const t = round(newTime, 3);

  if (edge === 'start') {
    if (t >= clip.end - 0.05) {
      throw E.badInput('That trim would remove the whole clip.', 'The new start is at or past the clip end.', 'Drag the handle back, or delete the clip instead.');
    }
    const delta = t - clip.start;
    if (clip.type === 'video' || clip.type === 'broll') clip.sourceIn = round(Math.max(0, (clip.sourceIn || 0) + delta), 3);
    if (clip.words) clip.words = clip.words.filter((w) => w.end > t);
    clip.start = t;
  } else {
    if (t <= clip.start + 0.05) {
      throw E.badInput('That trim would remove the whole clip.', 'The new end is at or before the clip start.', 'Drag the handle forward, or delete the clip instead.');
    }
    if (clip.words) clip.words = clip.words.filter((w) => w.start < t);
    clip.end = t;
  }

  if (clip.words) clip.text = clip.words.map((w) => w.word).join(' ');
  out.duration = edlLib.computeDuration(out);
  return out;
}

/** Move a clip to a new start time, keeping its length. */
function move(edl, clipId, newStart) {
  const out = deepClone(edl);
  const clip = requireClip(out, clipId);
  const len = clip.end - clip.start;
  const start = Math.max(0, round(newStart, 3));
  clip.start = start;
  clip.end = round(start + len, 3);
  out.duration = edlLib.computeDuration(out);
  return edlLib.sortTimeline(out);
}

/** Delete a clip. Removing a picture clip re-closes the gap it leaves. */
function remove(edl, clipId) {
  let out = deepClone(edl);
  const clip = requireClip(out, clipId);
  const wasPrimary = clip.type === 'video' || clip.type === 'image';

  out.timeline = out.timeline.filter((c) => c.id !== clipId);

  if (wasPrimary) {
    if (!edlLib.byType(out, 'video', 'image').length) {
      throw E.badInput(
        'That is the only picture on the timeline.',
        'Deleting it would leave the Short with nothing on screen.',
        'Add another clip or image first, or use Replace to swap this one instead.'
      );
    }
    out = edlLib.reflowVisuals(out);
  }

  out.duration = edlLib.computeDuration(out);
  return out;
}

/** Duplicate a clip, dropping the copy immediately after the original. */
function duplicate(edl, clipId) {
  const out = deepClone(edl);
  const clip = requireClip(out, clipId);
  const len = clip.end - clip.start;
  const copy = { ...deepClone(clip), id: id('c'), start: round(clip.end, 3), end: round(clip.end + len, 3) };

  if (copy.words) {
    const shift = copy.start - clip.start;
    copy.words = copy.words.map((w) => ({ ...w, start: round(w.start + shift, 3), end: round(w.end + shift, 3) }));
  }

  out.timeline.push(copy);
  out.duration = edlLib.computeDuration(out);
  return edlLib.sortTimeline(out);
}

/** Point a clip at different media — the "Replace" action on a B-roll slot. */
function replaceSource(edl, clipId, mediaId, mediaKind = 'video') {
  const out = deepClone(edl);
  const clip = requireClip(out, clipId);
  clip.source = mediaId;
  clip.mediaKind = mediaKind;
  clip.sourceIn = 0;
  clip.userChosen = true;
  if (mediaKind === 'image' && !clip.kenBurns) {
    clip.kenBurns = { zFrom: 1.0, zTo: 1.09, panX: 0, panY: 0 };
  }
  return out;
}

/** Change a clip's duration, holding its start. */
function setDuration(edl, clipId, seconds) {
  const out = deepClone(edl);
  const clip = requireClip(out, clipId);
  const d = clamp(round(seconds, 3), 0.1, 600);
  clip.end = round(clip.start + d, 3);
  out.duration = edlLib.computeDuration(out);
  return out;
}

/** Patch arbitrary clip fields — caption text, zoom scale, gain, and so on. */
function update(edl, clipId, patch) {
  const out = deepClone(edl);
  const clip = requireClip(out, clipId);
  const allowed = [
    'text', 'style', 'scale', 'gain', 'duck', 'sfxName', 'kenBurns',
    'transitionIn', 'words', 'locked', 'speed', 'attack', 'release', 'suggestions',
  ];
  for (const [k, v] of Object.entries(patch)) {
    if (allowed.includes(k)) clip[k] = v;
  }
  if (patch.text !== undefined && clip.type === 'caption') {
    // Re-time the words across the card's existing span so a hand-edited
    // caption stays in sync instead of keeping stale word timings.
    const toks = String(patch.text).split(/\s+/).filter(Boolean);
    const span = Math.max(0.2, clip.end - clip.start);
    const per = span / Math.max(1, toks.length);
    const oldEmph = new Map((clip.words || []).map((w) => [w.word.toLowerCase(), w.emphasis]));
    clip.words = toks.map((t, i) => ({
      word: t,
      rawWord: t,
      start: round(clip.start + i * per, 3),
      end: round(clip.start + (i + 1) * per * 0.92, 3),
      emphasis: oldEmph.get(t.toLowerCase()) || null,
    }));
  }
  return out;
}

/** Toggle the emphasis mark on one word inside a caption. */
function toggleEmphasis(edl, clipId, wordIndex) {
  const out = deepClone(edl);
  const clip = requireClip(out, clipId);
  if (!clip.words || !clip.words[wordIndex]) {
    throw E.badInput('That word is not part of this caption.', 'The caption was re-edited and the word index no longer matches.', 'Reopen the caption and try again.');
  }
  const w = clip.words[wordIndex];
  w.emphasis = w.emphasis === 'strong' ? null : w.emphasis === 'normal' ? 'strong' : 'normal';
  return out;
}

/** Add a clip that the AI did not create — a manual B-roll drop, an SFX hit. */
function insert(edl, clip) {
  const out = deepClone(edl);
  out.timeline.push(edlLib.makeClip(clip.type, clip));
  out.duration = edlLib.computeDuration(out);
  return edlLib.sortTimeline(out);
}

const OPS = {
  split, trim, move, remove, duplicate, replaceSource, setDuration, update, toggleEmphasis, insert,
};

/**
 * Dispatch by name — the API exposes one endpoint for every timeline edit, so
 * the frontend does not need a route per operation.
 */
function apply(edl, opName, args = {}) {
  const fn = OPS[opName];
  if (!fn) {
    throw E.badInput(
      `"${opName}" is not a timeline operation.`,
      `Supported operations are: ${Object.keys(OPS).join(', ')}.`,
      'This usually means the page is running an older build — reload it.'
    );
  }
  switch (opName) {
    case 'split': return split(edl, args.clipId, args.at);
    case 'trim': return trim(edl, args.clipId, args.edge, args.time);
    case 'move': return move(edl, args.clipId, args.start);
    case 'remove': return remove(edl, args.clipId);
    case 'duplicate': return duplicate(edl, args.clipId);
    case 'replaceSource': return replaceSource(edl, args.clipId, args.mediaId, args.mediaKind);
    case 'setDuration': return setDuration(edl, args.clipId, args.duration);
    case 'update': return update(edl, args.clipId, args.patch || {});
    case 'toggleEmphasis': return toggleEmphasis(edl, args.clipId, args.wordIndex);
    case 'insert': return insert(edl, args.clip || {});
    default: return edl;
  }
}

module.exports = { ...OPS, apply, OPS };
