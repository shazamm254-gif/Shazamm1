import React, { useRef, useState, useCallback, useMemo } from 'react';
import { byType, duration as edlDuration, fmtTime } from '../lib/edl.js';

/**
 * The timeline.
 *
 * Deliberately not Premiere. The AI has already made the edit; this exists so a
 * creator can see what it did and correct one thing without learning an NLE.
 * Six lanes, tap to select, drag to move, drag an edge to trim, and a row of
 * plain-language buttons in the inspector for everything else.
 */

const TRACKS = [
  { id: 'video', label: 'VIDEO', types: ['video', 'image'], color: '#4DE1FF' },
  { id: 'broll', label: 'B-ROLL', types: ['broll'], color: '#A78BFA' },
  { id: 'caption', label: 'CAPTIONS', types: ['caption'], color: '#FFDA22' },
  { id: 'zoom', label: 'ZOOM', types: ['zoom'], color: '#34D399' },
  { id: 'voice', label: 'AUDIO', types: ['voice'], color: '#F97316' },
  { id: 'music', label: 'MUSIC', types: ['music'], color: '#60A5FA' },
  { id: 'sfx', label: 'SFX', types: ['sfx'], color: '#F472B6' },
];

export default function Timeline({
  edl, analysis, currentTime, selectedId,
  onSeek, onSelect, onOperation, zoom, onZoomChange,
}) {
  const laneRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const total = useMemo(() => Math.max(0.1, edlDuration(edl)), [edl]);

  // Pixels per second. The zoom control lets a phone user get in close enough
  // to grab a half-second caption card.
  const pps = 40 * zoom;
  const width = Math.max(320, total * pps);

  const timeFromEvent = useCallback((e) => {
    const el = laneRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left + el.scrollLeft;
    return Math.max(0, Math.min(total, x / pps));
  }, [pps, total]);

  const onLaneClick = (e) => {
    if (drag) return;
    onSeek(timeFromEvent(e));
  };

  /* ------------------------------------------------------------- dragging */

  const startDrag = (e, clip, mode) => {
    e.stopPropagation();
    e.preventDefault();
    const startTime = timeFromEvent(e);
    setDrag({
      clipId: clip.id,
      mode,
      startTime,
      origStart: clip.start,
      origEnd: clip.end,
      preview: { start: clip.start, end: clip.end },
      moved: false,
    });
    onSelect(clip.id);
  };

  const onPointerMove = (e) => {
    if (!drag) return;
    const t = timeFromEvent(e);
    const delta = t - drag.startTime;
    if (Math.abs(delta) < 0.02 && !drag.moved) return;

    let preview;
    if (drag.mode === 'move') {
      const len = drag.origEnd - drag.origStart;
      const start = Math.max(0, drag.origStart + delta);
      preview = { start, end: start + len };
    } else if (drag.mode === 'start') {
      preview = { start: Math.max(0, Math.min(drag.origEnd - 0.1, drag.origStart + delta)), end: drag.origEnd };
    } else {
      preview = { start: drag.origStart, end: Math.max(drag.origStart + 0.1, drag.origEnd + delta) };
    }
    setDrag({ ...drag, preview, moved: true });
  };

  const endDrag = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return;

    if (d.mode === 'move') {
      onOperation('move', { clipId: d.clipId, start: round(d.preview.start) });
    } else if (d.mode === 'start') {
      onOperation('trim', { clipId: d.clipId, edge: 'start', time: round(d.preview.start) });
    } else {
      onOperation('trim', { clipId: d.clipId, edge: 'end', time: round(d.preview.end) });
    }
  };

  const hasEdit = Boolean(edl && edl.timeline?.length);

  return (
    <div className="timeline">
      <div className="timeline-head">
        <span className="timeline-title">TIMELINE</span>
        <span className="timeline-meta">{fmtTime(currentTime, true)} / {fmtTime(total)}</span>
        <div className="timeline-zoom">
          <button className="btn btn-ghost btn-xs" onClick={() => onZoomChange(Math.max(0.35, zoom / 1.5))} aria-label="Zoom out">−</button>
          <button className="btn btn-ghost btn-xs" onClick={() => onZoomChange(Math.min(12, zoom * 1.5))} aria-label="Zoom in">+</button>
        </div>
      </div>

      {!hasEdit ? (
        <div className="timeline-empty">
          The timeline fills in when you press <strong>AUTO EDIT</strong>.
        </div>
      ) : (
        <div
          className="timeline-scroll"
          ref={laneRef}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <div className="timeline-inner" style={{ width }} onClick={onLaneClick}>
            <Ruler total={total} pps={pps} />

            {TRACKS.map((track) => {
              const clips = byType(edl, ...track.types);
              return (
                <div className="track" key={track.id}>
                  <div className="track-label" style={{ color: track.color }}>{track.label}</div>
                  <div className="track-lane">
                    {track.id === 'voice' && analysis?.waveform && (
                      <Waveform data={analysis.waveform} width={width} />
                    )}
                    {clips.map((clip) => {
                      const live = drag && drag.clipId === clip.id ? drag.preview : clip;
                      const left = live.start * pps;
                      const w = Math.max(3, (live.end - live.start) * pps);
                      const selected = clip.id === selectedId;
                      const unfilled = clip.type === 'broll' && !clip.source;

                      return (
                        <div
                          key={clip.id}
                          className={`clip clip-${clip.type} ${selected ? 'is-selected' : ''} ${unfilled ? 'is-unfilled' : ''}`}
                          style={{ left, width: w, borderColor: track.color, background: tint(track.color, unfilled ? 0.1 : 0.28) }}
                          onPointerDown={(e) => startDrag(e, clip, 'move')}
                          onClick={(e) => { e.stopPropagation(); onSelect(clip.id); }}
                          title={describeClip(clip)}
                        >
                          <span className="clip-label">{clipLabel(clip)}</span>
                          {w > 26 && (
                            <>
                              <span
                                className="clip-handle clip-handle-l"
                                onPointerDown={(e) => startDrag(e, clip, 'start')}
                              />
                              <span
                                className="clip-handle clip-handle-r"
                                onPointerDown={(e) => startDrag(e, clip, 'end')}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="playhead" style={{ left: currentTime * pps }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Ruler({ total, pps }) {
  // Pick a tick spacing that stays readable at any zoom level.
  const step = pps > 120 ? 0.5 : pps > 55 ? 1 : pps > 22 ? 2 : pps > 10 ? 5 : 10;
  const ticks = [];
  for (let t = 0; t <= total + 0.001; t += step) ticks.push(t);

  return (
    <div className="ruler">
      {ticks.map((t) => (
        <div className="ruler-tick" key={t} style={{ left: t * pps }}>
          <span>{fmtTime(t)}</span>
        </div>
      ))}
    </div>
  );
}

/** The voice envelope, so cuts are visibly aligned with the pauses. */
function Waveform({ data, width }) {
  const points = data.length;
  const step = width / points;
  return (
    <svg className="waveform" width={width} height={26} preserveAspectRatio="none" aria-hidden="true">
      {data.map((v, i) => (
        <rect
          key={i}
          x={i * step}
          y={13 - v * 12}
          width={Math.max(0.7, step * 0.85)}
          height={Math.max(1, v * 24)}
          fill="rgba(249,115,22,0.45)"
        />
      ))}
    </svg>
  );
}

function clipLabel(clip) {
  switch (clip.type) {
    case 'caption': return clip.text;
    case 'zoom': return `${Math.round(((clip.scale || 1) - 1) * 100 + 100)}%`;
    case 'sfx': return clip.sfxName;
    case 'broll': return clip.source ? 'B-roll' : 'Pick media';
    case 'music': return 'Music';
    case 'voice': return 'Voice';
    case 'image': return 'Image';
    default: return 'Clip';
  }
}

function describeClip(clip) {
  const span = `${clip.start.toFixed(2)}s – ${clip.end.toFixed(2)}s`;
  if (clip.type === 'broll' && !clip.source) return `Empty B-roll slot, ${span}. ${clip.reason || ''}`;
  if (clip.type === 'zoom') return `Punch-in to ${Math.round((clip.scale || 1) * 100)}%, ${span}`;
  return `${clip.type}, ${span}`;
}

function tint(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}
