import React, { useState, useEffect } from 'react';
import { fmtTime } from '../lib/edl.js';

/**
 * The "Fix it" panel.
 *
 * Every element the AI generated can be corrected here, in the words a creator
 * would use — Remove, Replace, Shorter, Longer, Undo this cut — rather than in
 * editing terminology. Nothing here requires knowing what a punch-in is.
 */
export default function Inspector({ clip, project, currentTime, onOperation, onClose, onSeek }) {
  const [text, setText] = useState('');

  useEffect(() => {
    setText(clip?.text || '');
  }, [clip?.id, clip?.text]);

  if (!clip) {
    return (
      <div className="inspector inspector-empty">
        <p className="muted">Tap anything on the timeline to fix it.</p>
      </div>
    );
  }

  const len = clip.end - clip.start;
  const media = (project?.media || []).find((m) => m.id === clip.source);

  const nudge = (deltaEnd) => onOperation('setDuration', {
    clipId: clip.id,
    duration: Math.max(0.15, len + deltaEnd),
  });

  return (
    <div className="inspector">
      <div className="inspector-head">
        <div>
          <span className={`badge badge-${clip.type}`}>{typeLabel(clip.type)}</span>
          <button className="linkish" onClick={() => onSeek(clip.start)}>
            {fmtTime(clip.start, true)} – {fmtTime(clip.end, true)}
          </button>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {clip.type === 'caption' && (
        <>
          <label className="field">
            <span>Caption text</span>
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => {
                if (text.trim() && text !== clip.text) {
                  onOperation('update', { clipId: clip.id, patch: { text: text.trim() } });
                }
              }}
            />
          </label>
          <p className="hint">Tap a word to emphasise it. Tap again for a stronger accent.</p>
          <div className="word-chips">
            {(clip.words || []).map((w, i) => (
              <button
                key={i}
                className={`chip chip-word ${w.emphasis ? `is-${w.emphasis}` : ''}`}
                onClick={() => onOperation('toggleEmphasis', { clipId: clip.id, wordIndex: i })}
              >
                {w.word}
              </button>
            ))}
          </div>
        </>
      )}

      {clip.type === 'zoom' && (
        <>
          <p className="inspector-desc">
            The camera pushes in to <strong>{Math.round((clip.scale || 1) * 100)}%</strong>
            {clip.reason ? ` on the ${clip.reason}.` : '.'}
          </p>
          <label className="field">
            <span>How much</span>
            <input
              type="range" min="1.02" max="1.2" step="0.01"
              value={clip.scale || 1.08}
              onChange={(e) => onOperation('update', { clipId: clip.id, patch: { scale: parseFloat(e.target.value) } })}
            />
          </label>
        </>
      )}

      {clip.type === 'broll' && (
        <>
          <p className="inspector-desc">{clip.reason || 'A cutaway would help here.'}</p>
          {!clip.source && !!(clip.suggestions || []).length && (
            <>
              <p className="hint">Suggested shots for this moment:</p>
              <ul className="suggestions">
                {clip.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </>
          )}
          <label className="field">
            <span>{clip.source ? 'Replace with' : 'Fill from your media'}</span>
            <select
              value={clip.source || ''}
              onChange={(e) => {
                const m = (project.media || []).find((x) => x.id === e.target.value);
                if (m) onOperation('replaceSource', { clipId: clip.id, mediaId: m.id, mediaKind: m.kind });
              }}
            >
              <option value="">Choose a file…</option>
              {(project?.media || [])
                .filter((m) => m.kind === 'video' || m.kind === 'image')
                .map((m) => <option key={m.id} value={m.id}>{m.filename}</option>)}
            </select>
          </label>
          {media && <p className="hint">Currently showing <strong>{media.filename}</strong>.</p>}
        </>
      )}

      {clip.type === 'sfx' && (
        <>
          <p className="inspector-desc">
            A <strong>{clip.sfxName}</strong> effect{clip.reason ? ` on the ${clip.reason}` : ''}.
          </p>
          <label className="field">
            <span>Loudness</span>
            <input
              type="range" min="0.05" max="1" step="0.05"
              value={clip.gain ?? 0.4}
              onChange={(e) => onOperation('update', { clipId: clip.id, patch: { gain: parseFloat(e.target.value) } })}
            />
          </label>
        </>
      )}

      {(clip.type === 'video' || clip.type === 'image') && (
        <p className="inspector-desc">
          {media ? media.filename : 'Missing media'}
          {clip.type === 'video' && ` — from ${fmtTime(clip.sourceIn || 0, true)} in the original.`}
          {clip.kenBurns && ' Slow Ken Burns move applied.'}
        </p>
      )}

      {clip.type === 'music' && (
        <label className="field">
          <span>Music level</span>
          <input
            type="range" min="0" max="0.6" step="0.02"
            value={clip.gain ?? 0.16}
            onChange={(e) => onOperation('update', { clipId: clip.id, patch: { gain: parseFloat(e.target.value) } })}
          />
        </label>
      )}

      <div className="inspector-actions">
        <button className="btn btn-sm" onClick={() => nudge(-0.25)}>Shorter</button>
        <button className="btn btn-sm" onClick={() => nudge(0.25)}>Longer</button>
        {['video', 'image', 'broll'].includes(clip.type) && (
          <button
            className="btn btn-sm"
            disabled={currentTime <= clip.start + 0.06 || currentTime >= clip.end - 0.06}
            onClick={() => onOperation('split', { clipId: clip.id, at: currentTime })}
          >
            Split here
          </button>
        )}
        <button className="btn btn-sm" onClick={() => onOperation('duplicate', { clipId: clip.id })}>Duplicate</button>
        <button className="btn btn-sm btn-danger" onClick={() => { onOperation('remove', { clipId: clip.id }); onClose(); }}>
          {removeLabel(clip.type)}
        </button>
      </div>
    </div>
  );
}

function typeLabel(type) {
  return {
    video: 'Clip', image: 'Image', broll: 'B-roll', caption: 'Caption',
    zoom: 'Punch-in', voice: 'Voice', music: 'Music', sfx: 'Sound effect',
    transition: 'Transition',
  }[type] || type;
}

function removeLabel(type) {
  return {
    zoom: 'Remove punch-in',
    caption: 'Delete caption',
    sfx: 'Remove effect',
    broll: 'Remove cutaway',
    music: 'Remove music',
  }[type] || 'Delete';
}
