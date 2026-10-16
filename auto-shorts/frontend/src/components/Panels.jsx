import React, { useRef, useState } from 'react';
import { fmtTime } from '../lib/edl.js';

/* ------------------------------------------------------------ error card */

/**
 * Every failure in the app renders through here: what happened, why, and what
 * to do about it. Nothing ever fails silently or shows a bare stack trace.
 */
export function ErrorCard({ error, onDismiss, onRetry }) {
  if (!error) return null;
  return (
    <div className="errorcard" role="alert">
      <div className="errorcard-head">
        <strong>{error.what}</strong>
        {onDismiss && <button className="btn btn-ghost btn-xs" onClick={onDismiss} aria-label="Dismiss">✕</button>}
      </div>
      <p className="errorcard-why">{error.why}</p>
      <p className="errorcard-fix"><span>Try this:</span> {error.fix}</p>
      {error.detail && (
        <details className="errorcard-detail">
          <summary>Technical detail</summary>
          <pre>{error.detail}</pre>
        </details>
      )}
      {onRetry && <button className="btn btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/* --------------------------------------------------------- media library */

export function MediaLibrary({ project, onUpload, onDeleteMedia, onTagMedia, uploading, uploadProgress }) {
  const fileRef = useRef(null);
  const [role, setRole] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const media = project?.media || [];
  const groups = [
    { key: 'video', label: 'Footage', items: media.filter((m) => m.kind === 'video') },
    { key: 'image', label: 'Images', items: media.filter((m) => m.kind === 'image') },
    { key: 'audio', label: 'Voice & audio', items: media.filter((m) => m.kind === 'audio' && m.role !== 'music') },
    { key: 'music', label: 'Music', items: media.filter((m) => m.role === 'music' || m.kind === 'music') },
  ].filter((g) => g.items.length);

  const pick = (files) => {
    if (files && files.length) onUpload(Array.from(files), role || null);
  };

  return (
    <div className="panel">
      <div
        className={`dropzone ${dragOver ? 'is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept="video/*,audio/*,image/*"
          onChange={(e) => { pick(e.target.files); e.target.value = ''; }}
        />
        {uploading ? (
          <>
            <strong>Uploading… {Math.round(uploadProgress * 100)}%</strong>
            <div className="progress"><div style={{ width: `${uploadProgress * 100}%` }} /></div>
          </>
        ) : (
          <>
            <strong>Upload media</strong>
            <span>Footage, voiceover, images, music. Drop them here or tap.</span>
          </>
        )}
      </div>

      <div className="role-row">
        <span className="hint">Uploading as:</span>
        {[
          ['', 'Auto-detect'],
          ['music', 'Music'],
          ['broll-only', 'B-roll only'],
        ].map(([v, label]) => (
          <button key={v} className={`chip ${role === v ? 'is-on' : ''}`} onClick={() => setRole(v)}>{label}</button>
        ))}
      </div>

      {!media.length && <p className="muted">Nothing uploaded yet.</p>}

      {groups.map((g) => (
        <div className="media-group" key={g.key}>
          <h4>{g.label}</h4>
          <div className="media-grid">
            {g.items.map((m) => (
              <MediaCard key={m.id} media={m} onDelete={onDeleteMedia} onTag={onTagMedia} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MediaCard({ media, onDelete, onTag }) {
  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState((media.tags || []).join(', '));

  return (
    <div className="media-card">
      <div className="media-thumb">
        {media.thumbUrl
          ? <img src={media.thumbUrl} alt="" loading="lazy" />
          : <div className="media-thumb-audio">♪</div>}
        {media.duration > 0 && <span className="media-dur">{fmtTime(media.duration)}</span>}
      </div>
      <div className="media-body">
        <span className="media-name" title={media.filename}>{media.filename}</span>
        <span className="media-meta">
          {media.width ? `${media.width}×${media.height}` : media.kind}
          {media.hasAudio && media.kind === 'video' ? ' · sound' : ''}
        </span>

        {editing ? (
          <input
            className="tag-input"
            value={tags}
            autoFocus
            onChange={(e) => setTags(e.target.value)}
            onBlur={() => { onTag(media.id, tags); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
          />
        ) : (
          <button className="tags" onClick={() => setEditing(true)} title="Tags help AUTO EDIT match this to the right moment">
            {(media.tags || []).length ? media.tags.map((t) => <span className="tag" key={t}>{t}</span>) : <span className="muted">+ add tags</span>}
          </button>
        )}
        {media.derivativeError && <span className="warn-inline">Preview unavailable: {media.derivativeError}</span>}
      </div>
      <button className="btn btn-ghost btn-xs media-del" onClick={() => onDelete(media.id)} aria-label="Delete">✕</button>
    </div>
  );
}

/* ---------------------------------------------------------- script panel */

export function ScriptPanel({ project, onSave, sttStatus }) {
  const [script, setScript] = useState(project?.script || '');
  const [srt, setSrt] = useState('');
  const [showSrt, setShowSrt] = useState(false);
  const [saved, setSaved] = useState(false);

  const whisper = (sttStatus || []).find((s) => s.name === 'whisper');
  const hasWhisper = whisper?.available;

  return (
    <div className="panel">
      <p className="hint">
        {hasWhisper
          ? 'Whisper is installed, so captions are transcribed from your audio. A script here is still used to keep the wording exactly as you wrote it.'
          : 'No speech recognizer is installed, so paste your script and AUTO SHORTS will align it to your narration — the captions will read exactly as written.'}
      </p>
      <textarea
        className="script-input"
        rows={10}
        placeholder={'HOOK:\n"You\'ve probably been using ChatGPT wrong."\n\nBODY:\n"Most people ask it one question and accept the first answer..."\n\nCTA:\n"Try this instead."'}
        value={script}
        onChange={(e) => { setScript(e.target.value); setSaved(false); }}
      />
      <div className="row">
        <button
          className="btn"
          onClick={async () => { await onSave({ script }); setSaved(true); }}
        >
          Save script
        </button>
        {saved && <span className="ok-inline">Saved</span>}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSrt((s) => !s)}>
          {showSrt ? 'Hide' : 'Import .srt instead'}
        </button>
      </div>
      <p className="hint">HOOK: / BODY: / CTA: labels and quote marks are stripped automatically.</p>

      {showSrt && (
        <>
          <textarea
            className="script-input"
            rows={6}
            placeholder={'1\n00:00:00,000 --> 00:00:02,400\nYour first line here'}
            value={srt}
            onChange={(e) => setSrt(e.target.value)}
          />
          <button className="btn btn-sm" onClick={() => onSave({ srt })}>Use these subtitles</button>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------- AI edit report */

export function AIReport({ report, summary, onReEdit, reEditOptions, busy }) {
  const [chosen, setChosen] = useState([]);
  if (!report) return null;

  const toggle = (idOrDirective) => setChosen((c) => (
    c.includes(idOrDirective) ? c.filter((x) => x !== idOrDirective) : [...c, idOrDirective]
  ));

  return (
    <div className="panel">
      <h3 className="panel-title">AI EDIT</h3>
      <ul className="report">
        {report.steps.map((s, i) => (
          <li key={i}>
            <span className="tick">✓</span>
            <div>
              <strong>{s.label}</strong>
              {s.detail && <span className="report-detail">{s.detail}</span>}
            </div>
          </li>
        ))}
      </ul>

      {!!(report.warnings || []).length && (
        <div className="warnings">
          {report.warnings.map((w, i) => (
            <div className="warning" key={i}>
              <strong>{w.what}</strong>
              <p>{w.why}</p>
              <p className="errorcard-fix"><span>Try this:</span> {w.fix}</p>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="stat-row">
          <Stat n={summary.cuts} label="cuts" />
          <Stat n={summary.captions} label="captions" />
          <Stat n={summary.emphasis} label="emphasis" />
          <Stat n={summary.zooms} label="punch-ins" />
          <Stat n={summary.broll} label="b-roll" />
          <Stat n={summary.sfx} label="sfx" />
        </div>
      )}

      <h4 className="sub-title">RE-EDIT</h4>
      <p className="hint">Not quite right? Pick a direction and the AI reworks the edit — your media and script stay as they are.</p>
      <div className="chips">
        {(reEditOptions || []).map((o) => (
          <button
            key={o.id}
            className={`chip ${chosen.includes(o.id) ? 'is-on' : ''}`}
            onClick={() => toggle(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <button
        className="btn btn-primary"
        disabled={!chosen.length || busy}
        onClick={() => { onReEdit(chosen); setChosen([]); }}
      >
        {busy ? 'Re-editing…' : 'RE-EDIT'}
      </button>
      {report.provider && <p className="hint">Analysis by {report.provider}.</p>}
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div className="stat">
      <strong>{n}</strong>
      <span>{label}</span>
    </div>
  );
}

/* ------------------------------------------------------- settings panel */

export function SettingsPanel({ project, capabilities, onChange, onRegenerateCaptions, busy }) {
  const s = project?.settings || {};
  const set = (patch) => onChange({ settings: patch });

  return (
    <div className="panel">
      <Field label="Editing style">
        <select value={s.preset} onChange={(e) => set({ preset: e.target.value })}>
          {(capabilities?.presets || []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Field>
      <p className="hint">
        {(capabilities?.presets || []).find((p) => p.id === s.preset)?.tagline}
      </p>

      <Field label="Caption style">
        <select
          value={s.captionStyle}
          onChange={(e) => { set({ captionStyle: e.target.value }); onRegenerateCaptions(e.target.value); }}
        >
          {(capabilities?.captionStyles || []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </Field>

      <Field label="Silence removal">
        <div className="seg">
          {(capabilities?.silenceLevels || ['off', 'low', 'medium', 'aggressive']).map((l) => (
            <button key={l} className={`seg-btn ${s.silenceRemoval === l ? 'is-on' : ''}`} onClick={() => set({ silenceRemoval: l })}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Sound design">
        <div className="seg">
          {['low', 'medium', 'high'].map((l) => (
            <button key={l} className={`seg-btn ${s.sfxIntensity === l ? 'is-on' : ''}`} onClick={() => set({ sfxIntensity: l })}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </Field>

      <Field label="B-roll">
        <div className="seg">
          {[['auto', 'AUTO'], ['manual', 'MANUAL']].map(([v, label]) => (
            <button key={v} className={`seg-btn ${s.brollMode === v ? 'is-on' : ''}`} onClick={() => set({ brollMode: v })}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      <p className="hint">AUTO fills cutaways from your media library by matching filenames and tags. MANUAL leaves every slot for you to choose.</p>

      <Field label="Mode">
        <div className="seg">
          {[['auto', 'STANDARD'], ['image_story', 'IMAGE STORY']].map(([v, label]) => (
            <button key={v} className={`seg-btn ${s.mode === v ? 'is-on' : ''}`} onClick={() => set({ mode: v })}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      <p className="hint">IMAGE STORY sequences a folder of images to your narration with Ken Burns movement.</p>

      <h4 className="sub-title">LEVELS</h4>
      {[['voice', 'Voice', 2], ['music', 'Music', 1], ['sfx', 'SFX', 1]].map(([k, label, max]) => (
        <Field key={k} label={`${label} — ${Math.round((s.levels?.[k] ?? 0) * 100)}%`}>
          <input
            type="range" min="0" max={max} step="0.02"
            value={s.levels?.[k] ?? 0.5}
            onChange={(e) => set({ levels: { ...s.levels, [k]: parseFloat(e.target.value) } })}
          />
        </Field>
      ))}

      <Field label="Target length">
        <input
          type="number" min="5" max="600"
          value={s.targetDuration || 60}
          onChange={(e) => set({ targetDuration: parseInt(e.target.value, 10) || 60 })}
        />
      </Field>

      <button className="btn btn-sm" disabled={busy} onClick={() => onRegenerateCaptions(s.captionStyle)}>
        Regenerate captions
      </button>

      <h4 className="sub-title">ENGINES ON THIS MACHINE</h4>
      <ul className="engines">
        <li>
          <strong>Video</strong>
          <span className={capabilities?.ffmpeg?.available ? 'ok' : 'bad'}>
            {capabilities?.ffmpeg?.available ? 'FFmpeg ready' : 'FFmpeg missing'}
          </span>
        </li>
        {(capabilities?.stt || []).map((e) => (
          <li key={e.name}>
            <strong>{e.label}</strong>
            <span className={e.available ? 'ok' : 'muted'}>{e.available ? 'available' : e.reason}</span>
          </li>
        ))}
        {(capabilities?.ai || []).map((e) => (
          <li key={e.name}>
            <strong>{e.label}</strong>
            <span className={e.available ? 'ok' : 'muted'}>{e.available ? 'available' : e.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/* --------------------------------------------------------- export panel */

export function ExportPanel({ project, capabilities, onExport, onRenderPreview, exporting, exportProgress, exportLabel, exports }) {
  const [preset, setPreset] = useState('1080p');

  return (
    <div className="panel">
      <Field label="Size">
        <select value={preset} onChange={(e) => setPreset(e.target.value)}>
          {(capabilities?.exportPresets || []).map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </Field>
      <p className="hint">H.264 MP4, 30 fps, AAC audio. Rendered on this machine — nothing is uploaded.</p>

      <button className="btn btn-primary btn-big" disabled={exporting} onClick={() => onExport(preset)}>
        {exporting ? `${exportLabel || 'Exporting'}… ${Math.round(exportProgress * 100)}%` : 'EXPORT'}
      </button>
      {exporting && <div className="progress"><div style={{ width: `${exportProgress * 100}%` }} /></div>}

      <button className="btn btn-ghost btn-sm" disabled={exporting} onClick={onRenderPreview}>
        Render exact preview (540p)
      </button>
      <p className="hint">The player above already interprets the edit live. This renders the real encoder output if you want to check it before exporting.</p>

      {!!(exports || []).length && (
        <>
          <h4 className="sub-title">EXPORTS</h4>
          <ul className="exports">
            {exports.map((e) => (
              <li key={e.id}>
                <div>
                  <strong>{e.width}×{e.height}</strong>
                  <span className="muted">
                    {fmtTime(e.duration)} · {(e.sizeBytes / 1048576).toFixed(1)} MB
                    {e.renderMs ? ` · rendered in ${(e.renderMs / 1000).toFixed(0)}s` : ''}
                  </span>
                </div>
                <div className="row">
                  <a className="btn btn-sm" href={`${e.url}?download=1`} download>Download</a>
                  {e.srtUrl && <a className="btn btn-ghost btn-sm" href={e.srtUrl}>.srt</a>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
