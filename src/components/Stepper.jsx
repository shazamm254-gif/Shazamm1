const STAGES = [
  { n: 1, label: 'Proven Ideas' },
  { n: 2, label: 'Analysis' },
  { n: 3, label: 'Script' },
  { n: 4, label: 'Voiceover' },
  { n: 5, label: 'Visuals' },
]

// `current` = active stage number. `unlocked` = highest stage the user may open.
export default function Stepper({ current, unlocked, onSelect }) {
  return (
    <nav className="stepper" aria-label="Pipeline stages">
      {STAGES.map((s) => {
        const isDone = s.n < current
        const isActive = s.n === current
        const isLocked = s.n > unlocked
        const cls = ['step', isActive && 'active', isDone && 'done', isLocked && 'locked']
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={s.n}
            className={cls}
            disabled={isLocked}
            onClick={() => !isLocked && onSelect(s.n)}
          >
            <span className="step-num">{isDone ? '✓' : isLocked ? '🔒' : s.n}</span>
            <span className="step-label">{s.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
