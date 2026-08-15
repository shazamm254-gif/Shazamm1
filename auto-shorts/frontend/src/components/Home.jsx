import React, { useState } from 'react';
import { fmtTime } from '../lib/edl.js';
import { ErrorCard } from './Panels.jsx';

/**
 * The home screen answers one question: what do I do next?
 *
 * A single primary action — NEW SHORT — and a list of what is already in
 * progress. Nothing else competes for attention.
 */
export default function Home({ projects, capabilities, onCreate, onOpen, onDelete, error, onDismissError }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="home">
      <header className="home-head">
        <h1 className="wordmark">AUTO<span>SHORTS</span></h1>
        <p className="tagline">Drop in your content. Press AUTO EDIT. Export a finished Short.</p>
      </header>

      <ErrorCard error={error} onDismiss={onDismissError} />

      {!capabilities?.ffmpeg?.available && (
        <ErrorCard error={{
          what: 'Video processing is not available.',
          why: capabilities?.ffmpeg?.note || 'FFmpeg could not be found.',
          fix: 'Run "npm install" inside the auto-shorts folder, then restart the server.',
        }} />
      )}

      {creating ? (
        <NewShort capabilities={capabilities} onCancel={() => setCreating(false)} onCreate={onCreate} />
      ) : (
        <button className="btn btn-primary btn-hero" onClick={() => setCreating(true)}>
          + NEW SHORT
        </button>
      )}

      <section className="project-list">
        <h2>Your Shorts</h2>
        {!projects.length && <p className="muted">No projects yet. Start one above.</p>}
        <div className="project-grid">
          {projects.map((p) => (
            <div className="project-card" key={p.id} onClick={() => onOpen(p.id)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onOpen(p.id); }}>
              <div className="project-poster">
                {p.posterUrl ? <img src={p.posterUrl} alt="" loading="lazy" /> : <span className="poster-empty">9:16</span>}
              </div>
              <div className="project-info">
                <strong>{p.name}</strong>
                <span className="muted">
                  {p.mediaCount} file{p.mediaCount === 1 ? '' : 's'}
                  {p.hasEdit ? ` · ${fmtTime(p.duration)} edit` : ' · not edited yet'}
                  {p.exportCount ? ` · ${p.exportCount} export${p.exportCount === 1 ? '' : 's'}` : ''}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-xs project-del"
                onClick={(e) => { e.stopPropagation(); onDelete(p.id, p.name); }}
                aria-label={`Delete ${p.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="home-foot">
        <span>Local-first. Your media never leaves this machine.</span>
        {capabilities?.ai && (
          <span>
            Analysis: {(capabilities.ai.find((a) => a.available) || {}).label || 'local heuristics'}
          </span>
        )}
      </footer>
    </div>
  );
}

function NewShort({ capabilities, onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [targetDuration, setTargetDuration] = useState(60);
  const [preset, setPreset] = useState('high_retention');
  const [mode, setMode] = useState('auto');

  const presets = capabilities?.presets || [];
  const chosen = presets.find((p) => p.id === preset);

  return (
    <div className="newshort panel">
      <h2>New Short</h2>

      <label className="field">
        <span>Name</span>
        <input
          value={name}
          placeholder="Untitled Short"
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </label>

      <label className="field">
        <span>Format</span>
        <div className="format-lock">9:16 vertical · 1080 × 1920</div>
      </label>

      <label className="field">
        <span>Target length</span>
        <div className="seg">
          {[15, 30, 60, 90].map((d) => (
            <button key={d} className={`seg-btn ${targetDuration === d ? 'is-on' : ''}`} onClick={() => setTargetDuration(d)}>
              {d}s
            </button>
          ))}
        </div>
      </label>

      <label className="field">
        <span>Editing style</span>
        <div className="preset-grid">
          {presets.map((p) => (
            <button
              key={p.id}
              className={`preset-card ${preset === p.id ? 'is-on' : ''}`}
              onClick={() => setPreset(p.id)}
            >
              <strong>{p.label}</strong>
              <span>{p.tagline}</span>
            </button>
          ))}
        </div>
      </label>
      {chosen && <p className="hint">{chosen.description}</p>}

      <label className="field">
        <span>Mode</span>
        <div className="seg">
          <button className={`seg-btn ${mode === 'auto' ? 'is-on' : ''}`} onClick={() => setMode('auto')}>STANDARD</button>
          <button className={`seg-btn ${mode === 'image_story' ? 'is-on' : ''}`} onClick={() => setMode('image_story')}>IMAGE STORY</button>
        </div>
      </label>
      <p className="hint">
        {mode === 'image_story'
          ? 'Upload narration plus a folder of images — they get sequenced, moved and cut to your voice automatically.'
          : 'Upload footage or a voiceover. Cuts, captions, punch-ins and sound design are generated for you.'}
      </p>

      <div className="row">
        <button className="btn btn-primary" onClick={() => onCreate({ name: name || 'Untitled Short', targetDuration, preset, mode })}>
          Create
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
