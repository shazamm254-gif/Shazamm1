import { Router } from 'express'
import { listVoices, textToSpeech } from '../lib/elevenlabs.js'

const router = Router()

// GET /api/voices — id+name list for the dropdown.
router.get('/voices', async (req, res, next) => {
  try {
    const voices = await listVoices()
    res.json({ voices })
  } catch (err) {
    next(err)
  }
})

// POST /api/tts  { voiceId, text } → audio/mpeg (mp3) stream.
// Paid: the frontend confirms before calling this.
router.post('/tts', async (req, res, next) => {
  try {
    const { voiceId, text } = req.body || {}
    const audio = await textToSpeech(voiceId, text)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Disposition', 'attachment; filename="voiceover.mp3"')
    res.send(audio)
  } catch (err) {
    next(err)
  }
})

export default router
