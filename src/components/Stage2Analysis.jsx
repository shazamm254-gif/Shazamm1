import { useState } from 'react'
import { api } from '../api.js'
import { Spinner, ErrorBox } from './common.jsx'

export default function Stage2Analysis({ idea, brief, onBrief, onAdvance }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.analyze(idea)
      onBrief(data.brief)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="stage">
      <h2>Stage 2 — Idea Analysis</h2>
      <p className="muted">
        A retention/pacing brief for the chosen idea. This gates — and feeds — the script in Stage 3.
      </p>

      <div className="chosen-idea">
        <span className="format-tag">{idea?.format}</span>
        <strong>{idea?.idea}</strong>
      </div>

      <div className="row">
        <button className="btn primary" onClick={run} disabled={loading}>
          {loading ? 'Analyzing…' : brief ? 'Re-analyze' : 'Analyze idea'}
        </button>
      </div>

      {loading && <Spinner label="Building the retention brief…" />}
      <ErrorBox error={error} />

      {brief && (
        <>
          <div className="brief">
            <Field label="Pacing">{brief.pacing}</Field>
            <Field label="Target watch time">{brief.target_watch_time_sec}s</Field>
            <Field label="Open-loop placement">{brief.open_loop_placement}</Field>
            <Field label="Tone notes">{brief.tone_notes}</Field>

            <div className="brief-block">
              <span className="brief-label">Retention beats</span>
              <ol>
                {brief.retention_beats.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ol>
            </div>

            <div className="brief-block">
              <span className="brief-label">Curiosity loops</span>
              <ul>
                {brief.curiosity_loops.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="stage-actions">
            <button className="btn primary" onClick={onAdvance}>
              Looks good → Stage 3
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div className="brief-field">
      <span className="brief-label">{label}</span>
      <span>{children}</span>
    </div>
  )
}
