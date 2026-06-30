import { useState } from 'react'
import { api } from '../api.js'
import { Spinner, ErrorBox } from './common.jsx'

function scoreColor(score) {
  if (score >= 80) return '#34d399' // green
  if (score >= 60) return '#fbbf24' // amber
  if (score >= 40) return '#fb923c' // orange
  return '#f87171' // red
}

export default function Stage1Ideas({ result, onResult, selected, onSelect, onAdvance }) {
  const [niche, setNiche] = useState('')
  const [region, setRegion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function run(e) {
    e.preventDefault()
    if (!niche.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.ideas(niche.trim(), region.trim() || undefined)
      onResult(data)
      onSelect(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="stage">
      <h2>Stage 1 — Proven Idea Engine</h2>
      <p className="muted">
        Pulls the top recent Shorts in your niche, scores them by virality, and asks Claude to turn
        the proven formats into fresh ideas.
      </p>

      <form className="row" onSubmit={run}>
        <input
          className="input grow"
          placeholder="Niche (e.g. space facts, personal finance, gym myths)"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
        />
        <input
          className="input small"
          placeholder="Region (optional, e.g. US)"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        />
        <button className="btn primary" disabled={loading || !niche.trim()}>
          {loading ? 'Mining…' : 'Find proven ideas'}
        </button>
      </form>

      {loading && <Spinner label="Searching YouTube and scoring formats…" />}
      <ErrorBox error={error} />

      {result?.ideas?.length > 0 && (
        <>
          <div className="cards">
            {result.ideas.map((it, i) => {
              const isSel = selected === i
              return (
                <button
                  key={i}
                  className={`card ${isSel ? 'card-selected' : ''}`}
                  onClick={() => onSelect(i)}
                >
                  <div className="card-head">
                    <span className="format-tag">{it.format}</span>
                    <span className="score" style={{ color: scoreColor(it.score) }}>
                      {it.score}
                    </span>
                  </div>
                  <div className="idea-text">{it.idea}</div>
                  <div className="bar">
                    <span
                      className="bar-fill"
                      style={{ width: `${it.score}%`, background: scoreColor(it.score) }}
                    />
                  </div>
                  <div className="why">{it.why}</div>
                  <div className="subscores">
                    <span>hook {it.breakdown.hook}</span>
                    <span>curiosity {it.breakdown.curiosity}</span>
                    <span>proven {it.breakdown.proven}</span>
                    <span>saturation {it.breakdown.saturation_risk}</span>
                  </div>
                </button>
              )
            })}
          </div>

          <details className="topperf">
            <summary>Top performers used as evidence ({result.topPerformers.length})</summary>
            <ul>
              {result.topPerformers.map((v) => (
                <li key={v.videoId}>
                  <a href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer">
                    {v.title}
                  </a>{' '}
                  — {v.viewsPerDay.toLocaleString()} views/day · {v.views.toLocaleString()} total
                </li>
              ))}
            </ul>
          </details>

          <div className="stage-actions">
            <button
              className="btn primary"
              disabled={selected == null}
              onClick={() => onAdvance(result.ideas[selected])}
            >
              Use this idea → Stage 2
            </button>
            {selected == null && <span className="muted">Select an idea card to continue.</span>}
          </div>
        </>
      )}
    </section>
  )
}
