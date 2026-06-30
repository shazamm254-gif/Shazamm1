import { Router } from 'express'
import { searchShorts, fetchVideoStats, rankByVirality } from '../lib/youtube.js'
import { askClaude, parseJsonFromClaude, ApiError } from '../lib/anthropic.js'

const router = Router()

// POST /api/ideas  { niche, region? }
// 1. YouTube search.list → ids   2. videos.list → stats
// 3. rank by virality, keep top 10   4. Claude turns proven formats into fresh ideas
router.post('/', async (req, res, next) => {
  try {
    const niche = (req.body?.niche || '').trim()
    const region = (req.body?.region || '').trim() || undefined
    if (!niche) {
      throw new ApiError(400, 'bad_request', 'Please provide a niche.')
    }

    const ids = await searchShorts(niche, { region })
    if (!ids.length) {
      throw new ApiError(404, 'empty_results', `No recent Shorts found for "${niche}". Try a broader niche.`)
    }

    const items = await fetchVideoStats(ids)
    const top = rankByVirality(items, 10)
    if (!top.length) {
      throw new ApiError(404, 'empty_results', 'Found videos but no usable statistics. Try another niche.')
    }

    const ideas = await generateIdeas(niche, top)

    res.json({ niche, region: region || null, topPerformers: top, ideas })
  } catch (err) {
    next(err)
  }
})

async function generateIdeas(niche, top) {
  const dataset = top.map((v, i) => ({
    rank: i + 1,
    title: v.title,
    views: v.views,
    viewsPerDay: v.viewsPerDay,
    likeToView: v.likeToView,
    commentToView: v.commentToView,
    daysSince: v.daysSince,
  }))

  const prompt = `You are a YouTube Shorts strategist for the niche "${niche}".

Here are the 10 top-performing recent Shorts (sorted by views-per-day), with engagement signals:
${JSON.stringify(dataset, null, 2)}

Your job, in two steps:
1. For each top performer, infer the REPEATABLE FORMAT/STRUCTURE that made it work (the hook pattern, the curiosity mechanism, the payoff shape) — NOT just its topic.
2. Using those proven structures, invent 5 to 8 FRESH idea objects for this niche. Each idea must reuse a proven structure but with new, non-duplicative subject matter.

Return JSON ONLY (no markdown fences, no preamble) as an array. Each item:
{
  "idea": "the fresh Short concept, one sentence",
  "format": "the proven repeatable structure it is built on",
  "score": 0,
  "breakdown": { "hook": 0, "curiosity": 0, "proven": 0, "saturation_risk": 0 },
  "why": "one line on why this will perform"
}

Scoring rules:
- "score" is 0-100 overall potential.
- Each breakdown sub-score is 0-100.
- "proven" reflects how strongly the real data above backs the chosen format.
- "saturation_risk" is HIGHER when the idea is closer to oversaturated/overdone (higher = riskier).
Return the array only.`

  const text = await askClaude(prompt, { maxTokens: 1500 })
  const parsed = parseJsonFromClaude(text)
  if (!Array.isArray(parsed)) {
    throw new ApiError(502, 'parse_error', 'AI did not return a list of ideas.')
  }
  // Normalize so the frontend can trust the shape.
  return parsed.map((it) => ({
    idea: String(it.idea || ''),
    format: String(it.format || ''),
    score: clampNum(it.score),
    breakdown: {
      hook: clampNum(it.breakdown?.hook),
      curiosity: clampNum(it.breakdown?.curiosity),
      proven: clampNum(it.breakdown?.proven),
      saturation_risk: clampNum(it.breakdown?.saturation_risk),
    },
    why: String(it.why || ''),
  }))
}

function clampNum(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

export default router
