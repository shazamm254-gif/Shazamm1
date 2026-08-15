/**
 * Client-side EDL interpretation.
 *
 * This mirrors the server's timeline/edl.js and video-engine/filtergraph.js so
 * the live preview can compute exactly what the renderer will compute: which
 * source is on screen at time t, how far the camera has pushed in, and where
 * the caption sits. Keeping the two in step is what makes the preview an honest
 * representation of the export rather than a rough approximation.
 */

export const TRACK_ORDER = ['video', 'broll', 'caption', 'zoom', 'voice', 'music', 'sfx'];

export function byType(edl, ...types) {
  const want = new Set(types.flat());
  return (edl?.timeline || [])
    .filter((c) => want.has(c.type))
    .sort((a, b) => a.start - b.start);
}

export function findClip(edl, id) {
  return (edl?.timeline || []).find((c) => c.id === id) || null;
}

export function duration(edl) {
  return (edl?.timeline || []).reduce((m, c) => Math.max(m, c.end || 0), 0);
}

/** Contiguous visual segments: picture clips with B-roll spliced over them. */
export function visualProgram(edl) {
  const primary = byType(edl, 'video', 'image');
  const broll = byType(edl, 'broll').filter((b) => b.source);
  if (!primary.length) return [];

  const segments = [];

  for (const p of primary) {
    const overlaps = broll
      .map((b) => ({ ...b, start: Math.max(b.start, p.start), end: Math.min(b.end, p.end) }))
      .filter((b) => b.end - b.start > 0.08)
      .sort((a, b) => a.start - b.start);

    let cursor = p.start;
    for (const b of overlaps) {
      if (b.start > cursor + 0.02) segments.push(slice(p, cursor, b.start));
      segments.push({
        id: b.id,
        type: 'broll',
        source: b.source,
        mediaKind: b.mediaKind || 'video',
        start: b.start,
        end: b.end,
        sourceIn: b.sourceIn || 0,
        kenBurns: b.kenBurns || null,
      });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < p.end - 0.02) segments.push(slice(p, cursor, p.end));
  }

  return segments.sort((a, b) => a.start - b.start);
}

function slice(clip, from, to) {
  const offset = from - clip.start;
  return {
    id: `${clip.id}@${from.toFixed(3)}`,
    parentId: clip.id,
    type: clip.type,
    source: clip.source,
    mediaKind: clip.type === 'image' ? 'image' : 'video',
    start: from,
    end: to,
    sourceIn: clip.type === 'image' ? 0 : (clip.sourceIn || 0) + offset,
    kenBurns: clip.kenBurns || null,
  };
}

export function segmentAt(segments, t) {
  // Binary search: the preview calls this every animation frame.
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segments[mid];
    if (t < s.start) hi = mid - 1;
    else if (t >= s.end) lo = mid + 1;
    else return s;
  }
  return t >= (segments[segments.length - 1]?.end ?? 0)
    ? segments[segments.length - 1] || null
    : segments[lo] || null;
}

/** Smoothstep — the same easing curve the render's zoom expression uses. */
function smoothstep(x) {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

/**
 * Camera scale at time t, relative to the frame.
 *
 * Matches filtergraph.js: a Ken Burns base curve for stills, plus the sum of
 * any punch-in events, each a trapezoid with smoothstepped ramps.
 */
export function scaleAt(edl, segment, t) {
  if (!segment) return 1;
  const local = t - segment.start;
  const segDur = Math.max(0.2, segment.end - segment.start);

  let base = 1;
  const kb = segment.kenBurns;
  if (kb) {
    const zFrom = kb.zFrom ?? 1;
    const zTo = kb.zTo ?? 1;
    base = Math.abs(zTo - zFrom) > 0.0005
      ? zFrom + (zTo - zFrom) * Math.max(0, Math.min(1, local / segDur))
      : zFrom;
  }

  let extra = 0;
  for (const z of byType(edl, 'zoom')) {
    if (z.end <= segment.start || z.start >= segment.end) continue;
    const zs = Math.max(0, z.start - segment.start);
    const ze = Math.min(segDur, z.end - segment.start);
    if (local < zs || local > ze) continue;

    const attack = Math.max(0.08, z.attack || 0.32);
    const release = Math.max(0.08, z.release || 0.4);
    const up = Math.max(0, Math.min(1, (local - zs) / attack));
    const down = Math.max(0, Math.min(1, (ze - local) / release));
    extra += ((z.scale || 1) - 1) * smoothstep(Math.min(up, down));
  }

  return base + extra;
}

/** Ken Burns pan offset, as a fraction of the frame, at time t. */
export function panAt(segment, t) {
  const kb = segment?.kenBurns;
  if (!kb || (!kb.panX && !kb.panY)) return { x: 0, y: 0 };
  const segDur = Math.max(0.2, segment.end - segment.start);
  const prog = Math.max(0, Math.min(1, (t - segment.start) / segDur)) - 0.5;
  return { x: (kb.panX || 0) * prog, y: (kb.panY || 0) * prog };
}

export function captionAt(edl, t) {
  return byType(edl, 'caption').find((c) => t >= c.start && t < c.end) || null;
}

/**
 * Preview time -> source time in the voice track, following the cut plan.
 * Returns null when the time falls outside every surviving range.
 */
export function voiceSourceTime(voiceClip, t) {
  const ranges = voiceClip?.keepRanges;
  if (!ranges || !ranges.length) return t;
  let acc = 0;
  for (const r of ranges) {
    const len = r.end - r.start;
    if (t < acc + len) return r.start + (t - acc);
    acc += len;
  }
  return ranges[ranges.length - 1].end;
}

/** Counts for the header and the AI Edit panel. */
export function summarize(edl) {
  const t = edl?.timeline || [];
  const n = (type) => t.filter((c) => c.type === type).length;
  const captions = t.filter((c) => c.type === 'caption');
  return {
    duration: duration(edl),
    cuts: n('video') + n('image'),
    captions: captions.length,
    emphasis: captions.reduce((a, c) => a + (c.words || []).filter((w) => w.emphasis).length, 0),
    zooms: n('zoom'),
    broll: n('broll'),
    brollFilled: t.filter((c) => c.type === 'broll' && c.source).length,
    sfx: n('sfx'),
    music: n('music'),
  };
}

export function fmtTime(sec, withMs = false) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const base = `${m}:${String(s).padStart(2, '0')}`;
  if (!withMs) return base;
  return `${base}.${String(Math.floor((sec % 1) * 10))}`;
}
