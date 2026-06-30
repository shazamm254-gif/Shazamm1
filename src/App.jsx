import { useEffect, useState } from 'react'
import Stepper from './components/Stepper.jsx'
import Stage1Ideas from './components/Stage1Ideas.jsx'
import Stage2Analysis from './components/Stage2Analysis.jsx'
import Stage3Script from './components/Stage3Script.jsx'
import Stage4Voice from './components/Stage4Voice.jsx'
import Stage5Visuals from './components/Stage5Visuals.jsx'
import { api } from './api.js'

export default function App() {
  const [stage, setStage] = useState(1)
  const [unlocked, setUnlocked] = useState(1)
  const [health, setHealth] = useState(null)

  // Stage outputs — the whole project state lives here (no database).
  const [ideasResult, setIdeasResult] = useState(null)
  const [selectedIdeaIdx, setSelectedIdeaIdx] = useState(null)
  const [chosenIdea, setChosenIdea] = useState(null)
  const [brief, setBrief] = useState(null)
  const [script, setScript] = useState(null)
  const [voiceId, setVoiceId] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [scenes, setScenes] = useState(null)
  const [images, setImages] = useState({}) // { sceneIndex: [url] }

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  function advanceToStage2(idea) {
    // Choosing a (possibly different) idea invalidates downstream outputs.
    setChosenIdea((prev) => {
      if (prev && prev.idea !== idea.idea) {
        setBrief(null)
        setScript(null)
      }
      return idea
    })
    setUnlocked((u) => Math.max(u, 2))
    setStage(2)
  }

  function advanceToStage3() {
    setUnlocked((u) => Math.max(u, 3))
    setStage(3)
  }

  function advanceToStage4() {
    setUnlocked((u) => Math.max(u, 4))
    setStage(4)
  }

  function advanceToStage5() {
    setUnlocked((u) => Math.max(u, 5))
    setStage(5)
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
      stage2: { brief },
      stage3: { script },
      stage4: { voiceId, hasAudio: Boolean(audioUrl) },
      stage5: {
        scenes: scenes || [],
        // Map scene index → generated image URLs (object URLs are session-only).
        images,
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

        {stage === 2 && (
          <Stage2Analysis
            idea={chosenIdea}
            brief={brief}
            onBrief={setBrief}
            onAdvance={advanceToStage3}
          />
        )}

        {stage === 3 && (
          <Stage3Script
            idea={chosenIdea}
            brief={brief}
            script={script}
            onScript={setScript}
            onAdvance={advanceToStage4}
          />
        )}

        {stage === 4 && (
          <Stage4Voice
            script={script}
            audioUrl={audioUrl}
            voiceId={voiceId}
            onAudio={setAudioUrl}
            onVoiceId={setVoiceId}
            onAdvance={advanceToStage5}
          />
        )}

        {stage === 5 && (
          <Stage5Visuals
            script={script}
            scenes={scenes}
            onScenes={setScenes}
            images={images}
            onImages={setImages}
          />
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
