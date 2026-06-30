import { Router } from 'express'
import { askClaude, ApiError } from '../lib/anthropic.js'

const router = Router()

// POST /api/script  { idea, brief }
// Returns a finished, second-marked Shorts script as plain text (editable client-side).
router.post('/', async (req, res, next) => {
  try {
    const idea = req.body?.idea
    const ideaText = typeof idea === 'string' ? idea : idea?.idea
    const brief = req.body?.brief
    if (!ideaText || !ideaText.trim()) {
      throw new ApiError(400, 'bad_request', 'Please provide an idea to script.')
    }

    const format = typeof idea === 'object' ? idea?.format || '' : ''
    const briefBlock = brief
      ? `RETENTION BRIEF (follow this):
${JSON.stringify(brief, null, 2)}`
      : '(No brief provided — infer sensible pacing.)'

    const prompt = `You are an elite YouTube Shorts scriptwriter.

Write a complete Shorts script for this concept.

IDEA: ${ideaText}
${format ? `PROVEN FORMAT: ${format}` : ''}

${briefBlock}

Hard requirements:
- A HARD HOOK in the first 2 seconds — front-load the most surprising thing.
- Second-marked timestamps on every line, e.g. [0:00], [0:03], [0:07] ... up to the target watch time in the brief.
- Build in the retention beats and curiosity loops from the brief; pay loops off before the end.
- Voice: natural, human, conversational — deadpan and dry, like a knowledgeable friend. NOT robotic, NOT clinical, NOT hype-y.
- Factual accuracy over hype. Do not invent statistics.
- End with a clean button/payoff (no "like and subscribe" filler unless it earns the moment).

Output the SCRIPT ONLY as plain text with the timestamp lines. Do not add headings,
explanations, or markdown — just the script the creator will read aloud.`

    // Scripts can run a bit longer than the default.
    const script = await askClaude(prompt, { maxTokens: 1500 })
    res.json({ script })
  } catch (err) {
    next(err)
  }
})

export default router
