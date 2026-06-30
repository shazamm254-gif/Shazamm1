import { useState } from 'react'
import { api } from '../api.js'
import { Spinner, ErrorBox } from './common.jsx'

export default function Stage3Script({ idea, brief, script, onScript, onAdvance }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.script(idea, brief)
      onScript(data.script)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(script || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <section className="stage">
      <h2>Stage 3 — Viral Script Generator</h2>
      <p className="muted">
        A second-marked Shorts script with a hard 2-second hook, retention loops from the brief, and
        a natural, deadpan voice. Edit it before voicing in Stage 4.
      </p>

      <div className="chosen-idea">
        <span className="format-tag">{idea?.format}</span>
        <strong>{idea?.idea}</strong>
      </div>

      <div className="row">
        <button className="btn primary" onClick={run} disabled={loading}>
          {loading ? 'Writing…' : script ? 'Regenerate script' : 'Write script'}
        </button>
        {script && (
          <button className="btn" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        )}
      </div>

      {loading && <Spinner label="Writing the script…" />}
      <ErrorBox error={error} />

      {script != null && (
        <>
          <textarea
            className="script-area"
            value={script}
            onChange={(e) => onScript(e.target.value)}
            spellCheck
            rows={18}
            placeholder="Your script will appear here — fully editable."
          />
          <div className="stage-actions">
            <button className="btn primary" onClick={onAdvance} disabled={!script.trim()}>
              Use this script → Stage 4
            </button>
            <span className="muted">Tweak the text above; your edits are saved automatically.</span>
          </div>
        </>
      )}
    </section>
  )
}
