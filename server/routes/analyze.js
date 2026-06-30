import { Router } from 'express'
import { askClaude, parseJsonFromClaude, ApiError } from '../lib/anthropic.js'

const router = Router()

// POST /api/analyze  { idea }  where idea is the chosen Stage 1 idea object.
// Returns a structured retention/pacing brief that feeds Stage 3.
router.post('/', async (req, res, next) => {
  try {
    const idea = req.body?.idea
    const ideaText = typeof idea === 'string' ? idea : idea?.idea
    if (!ideaText || !ideaText.trim()) {
      throw new ApiError(400, 'bad_request', 'Please provide an idea to analyze.')
    }

    const format = typeof idea === 'object' ? idea?.format || '' : ''

    const prompt = `You are a YouTube Shorts retention analyst.

Analyze this Short concept and produce a tactical brief that a scriptwriter will follow.

IDEA: ${ideaText}
${format ? `PROVEN FORMAT IT IS BUILT ON: ${format}` : ''}

Return JSON ONLY (no markdown fences, no preamble) with exactly this shape:
{
  "pacing": "one or two sentences on the overall pacing/energy this Short needs",
  "retention_beats": ["ordered beats that keep viewers watching, each a short phrase"],
  "curiosity_loops": ["open questions/gaps to plant that get paid off later"],
  "target_watch_time_sec": 0,
  "open_loop_placement": "where in the timeline the main open loop should sit and when it resolves",
  "tone_notes": "voice/tone guidance — natural, deadpan, dry, knowledgeable-friend, not robotic"
}

Rules:
- target_watch_time_sec is an integer (Shorts are typically 15-60).
- retention_beats: 4-7 items. curiosity_loops: 2-4 items.
- Be concrete and specific to THIS idea, not generic advice.
Return the object only.`

    const text = await askClaude(prompt, { maxTokens: 1024 })
    const parsed = parseJsonFromClaude(text)
    if (Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new ApiError(502, 'parse_error', 'AI did not return a brief object.')
    }

    const brief = {
      pacing: String(parsed.pacing || ''),
      retention_beats: toStringArray(parsed.retention_beats),
      curiosity_loops: toStringArray(parsed.curiosity_loops),
      target_watch_time_sec: clampInt(parsed.target_watch_time_sec, 0, 90),
      open_loop_placement: String(parsed.open_loop_placement || ''),
      tone_notes: String(parsed.tone_notes || ''),
    }

    res.json({ brief })
  } catch (err) {
    next(err)
  }
})

function toStringArray(v) {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x)).filter(Boolean)
}

function clampInt(n, min, max) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 0
  return Math.max(min, Math.min(max, v))
}

export default router
