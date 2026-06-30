import { useState } from 'react'
import { api } from '../api.js'
import { Spinner, ErrorBox, ConfirmGenerate } from './common.jsx'

export default function Stage5Visuals({ script, scenes, onScenes, images, onImages }) {
  const [loadingScenes, setLoadingScenes] = useState(false)
  const [scenesError, setScenesError] = useState(null)
  const [picked, setPicked] = useState(() => new Set())
  const [confirm, setConfirm] = useState(false)
  const [genError, setGenError] = useState(null)
  const [busyIdx, setBusyIdx] = useState(null) // which scene is currently rendering

  async function loadScenes() {
    setLoadingScenes(true)
    setScenesError(null)
    try {
      const data = await api.scenes(script)
      onScenes(data.scenes)
      setPicked(new Set(data.scenes.map((_, i) => i))) // default: all selected
    } catch (err) {
      setScenesError(err)
    } finally {
      setLoadingScenes(false)
    }
  }

  function toggle(i) {
    setPicked((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function renderPicked() {
    setConfirm(false)
    setGenError(null)
    // Render selected scenes sequentially so we don't hammer the API.
    for (let i = 0; i < scenes.length; i++) {
      if (!picked.has(i)) continue
      setBusyIdx(i)
      try {
        const data = await api.image(scenes[i].prompt)
        onImages((prev) => ({ ...prev, [i]: data.images }))
      } catch (err) {
        setGenError(err)
        break
      }
    }
    setBusyIdx(null)
  }

  return (
    <section className="stage">
      <h2>Stage 5 — Visual Prompts + Generation</h2>
      <p className="muted">
        Claude breaks your script into shots with matched image prompts. Pick the scenes to render
        with Leonardo — image generation draws paid credits.
      </p>

      <div className="row">
        <button className="btn primary" onClick={loadScenes} disabled={loadingScenes || !script?.trim()}>
          {loadingScenes ? 'Building shot list…' : scenes ? 'Rebuild shot list' : 'Build shot list'}
        </button>
        {scenes && (
          <button
            className="btn primary"
            disabled={busyIdx != null || picked.size === 0}
            onClick={() => setConfirm(true)}
          >
            {busyIdx != null ? 'Rendering…' : `Render ${picked.size} scene(s) (uses credits)`}
          </button>
        )}
      </div>

      {loadingScenes && <Spinner label="Writing image prompts…" />}
      <ErrorBox error={scenesError} />
      <ErrorBox error={genError} />

      {scenes && (
        <div className="scenes">
          {scenes.map((s, i) => (
            <div key={i} className={`scene ${picked.has(i) ? 'scene-picked' : ''}`}>
              <label className="scene-head">
                <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} />
                <span className="scene-title">
                  {i + 1}. {s.scene}
                </span>
              </label>
              <p className="scene-prompt">{s.prompt}</p>

              {busyIdx === i && <Spinner label="Rendering…" />}

              {images[i]?.length > 0 && (
                <div className="image-grid">
                  {images[i].map((url, j) => (
                    <figure key={j} className="image-cell">
                      <img src={url} alt={`Scene ${i + 1}`} loading="lazy" />
                      <a className="btn small-btn" href={url} download={`scene-${i + 1}-${j + 1}.jpg`}>
                        Download ↓
                      </a>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmGenerate
        open={confirm}
        title={`Render ${picked.size} scene(s)?`}
        body="This sends each selected prompt to Leonardo and draws paid credits from your account."
        confirmLabel="Render (uses credits)"
        onConfirm={renderPicked}
        onCancel={() => setConfirm(false)}
      />
    </section>
  )
}
