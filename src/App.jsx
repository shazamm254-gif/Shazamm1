import { useEffect, useState } from 'react'
import Stepper from './components/Stepper.jsx'
import Stage1Ideas from './components/Stage1Ideas.jsx'
import { api } from './api.js'

export default function App() {
  const [stage, setStage] = useState(1)
  const [unlocked, setUnlocked] = useState(1)
  const [health, setHealth] = useState(null)

  // Stage outputs — the whole project state lives here (no database).
  const [ideasResult, setIdeasResult] = useState(null)
  const [selectedIdeaIdx, setSelectedIdeaIdx] = useState(null)
  const [chosenIdea, setChosenIdea] = useState(null)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  function advanceToStage2(idea) {
    setChosenIdea(idea)
    setUnlocked((u) => Math.max(u, 2))
    setStage(2)
  }

  function exportProject() {
    const payload = {
      exportedAt: new Date().toISOString(),
      stage1: {
        niche: ideasResult?.niche || null,
        region: ideasResult?.region || null,
        topPerformers: ideasResult?.topPerformers || [],
        ideas: ideasResult?.ideas || [],
        chosenIdea,
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'algorithm-beater-project.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>The Algorithm Beater</h1>
          <p className="tagline">Proven viral ideas → analysis → script → voice → visuals.</p>
        </div>
        <button className="btn ghost" onClick={exportProject} disabled={!ideasResult}>
          Export project ↓
        </button>
      </header>

      {health && <KeyStatus keys={health.keys} />}

      <Stepper current={stage} unlocked={unlocked} onSelect={setStage} />

      <main>
        {stage === 1 && (
          <Stage1Ideas
            result={ideasResult}
            onResult={setIdeasResult}
            selected={selectedIdeaIdx}
            onSelect={setSelectedIdeaIdx}
            onAdvance={advanceToStage2}
          />
        )}

        {stage > 1 && (
          <section className="stage">
            <h2>Stage {stage}</h2>
            <p className="muted">
              Chosen idea: <strong>{chosenIdea?.idea}</strong>
            </p>
            <p className="comingsoon">
              🚧 This stage is built in the next step. Scaffold + Stage 1 are complete and ready to
              review.
            </p>
          </section>
        )}
      </main>

      <footer className="app-foot">
        <span>Local-only · keys stay server-side · no database</span>
      </footer>
    </div>
  )
}

function KeyStatus({ keys }) {
  const items = [
    ['YouTube', keys.youtube],
    ['Anthropic', keys.anthropic],
    ['ElevenLabs', keys.elevenlabs],
    ['Leonardo', keys.leonardo],
  ]
  return (
    <div className="keystatus">
      {items.map(([name, ok]) => (
        <span key={name} className={`keychip ${ok ? 'ok' : 'missing'}`}>
          {ok ? '●' : '○'} {name}
        </span>
      ))}
    </div>
  )
}
