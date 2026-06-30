import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import ideasRoute from './routes/ideas.js'
import analyzeRoute from './routes/analyze.js'
import scriptRoute from './routes/script.js'
import voiceRoute from './routes/voice.js'
import visualsRoute from './routes/visuals.js'
import { ApiError } from './lib/anthropic.js'

const app = express()
const PORT = process.env.PORT || 8787

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// --- Healthcheck: reports which keys are present (never the values) ----------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    keys: {
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
      leonardo: Boolean(process.env.LEONARDO_API_KEY),
    },
  })
})

// --- Stage routes ------------------------------------------------------------
app.use('/api/ideas', ideasRoute)
app.use('/api/analyze', analyzeRoute)
app.use('/api/script', scriptRoute)
app.use('/api', voiceRoute) // /api/voices, /api/tts
app.use('/api', visualsRoute) // /api/scenes, /api/image

// --- Central error handler ---------------------------------------------------
// Routes throw ApiError (or any Error); we translate to a clean JSON shape the
// frontend can render as a friendly error state.
app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.code, message: err.message })
  }
  console.error('[unexpected]', err)
  res.status(500).json({ error: 'server_error', message: err.message || 'Unexpected server error' })
})

app.listen(PORT, () => {
  console.log(`\n  The Algorithm Beater backend → http://localhost:${PORT}`)
  console.log('  Healthcheck:                  http://localhost:' + PORT + '/api/health\n')
})
