import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Spinner, ErrorBox, ConfirmGenerate } from './common.jsx'

export default function Stage4Voice({ script, audioUrl, voiceId, onAudio, onVoiceId, onAdvance }) {
  const [voices, setVoices] = useState(null)
  const [voicesError, setVoicesError] = useState(null)
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(false)

  // Load the voice list once when the stage opens.
  useEffect(() => {
    let cancelled = false
    setLoadingVoices(true)
    setVoicesError(null)
    api
      .voices()
      .then((data) => {
        if (cancelled) return
        setVoices(data.voices)
        if (!voiceId && data.voices[0]) onVoiceId(data.voices[0].id)
      })
      .catch((err) => !cancelled && setVoicesError(err))
      .finally(() => !cancelled && setLoadingVoices(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generate() {
    setConfirm(false)
    setGenerating(true)
    setError(null)
    try {
      const url = await api.tts(voiceId, script)
      onAudio(url)
    } catch (err) {
      setError(err)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="stage">
      <h2>Stage 4 — Voiceover</h2>
      <p className="muted">
        Pick a voice and generate an ElevenLabs voiceover of your final script.
      </p>

      {loadingVoices && <Spinner label="Loading voices…" />}
      <ErrorBox error={voicesError} />

      {voices && (
        <div className="row">
          <label className="field">
            <span className="brief-label">Voice</span>
            <select
              className="input"
              value={voiceId || ''}
              onChange={(e) => onVoiceId(e.target.value)}
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.category ? ` (${v.category})` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn primary"
            disabled={generating || !voiceId || !script?.trim()}
            onClick={() => setConfirm(true)}
          >
            {generating ? 'Generating…' : 'Generate voiceover (uses credits)'}
          </button>
        </div>
      )}

      {generating && <Spinner label="Synthesizing audio…" />}
      <ErrorBox error={error} />

      {audioUrl && (
        <div className="audio-block">
          <audio controls src={audioUrl} className="audio-player" />
          <a className="btn" href={audioUrl} download="voiceover.mp3">
            Download mp3 ↓
          </a>
        </div>
      )}

      <div className="stage-actions">
        <button className="btn primary" onClick={onAdvance}>
          {audioUrl ? 'Continue → Stage 5' : 'Skip to Stage 5'}
        </button>
      </div>

      <ConfirmGenerate
        open={confirm}
        title="Generate voiceover?"
        body="This sends your script to ElevenLabs and draws paid credits from your account."
        confirmLabel="Generate (uses credits)"
        onConfirm={generate}
        onCancel={() => setConfirm(false)}
      />
    </section>
  )
}
