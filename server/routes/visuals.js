import { Router } from 'express'
import { askClaude, parseJsonFromClaude, ApiError } from '../lib/anthropic.js'
import { generateImages } from '../lib/leonardo.js'

const router = Router()

// POST /api/scenes  { script } → [{ scene, prompt }]
// Claude breaks the final script into shot-by-shot scenes with image prompts.
router.post('/scenes', async (req, res, next) => {
  try {
    const script = (req.body?.script || '').trim()
    if (!script) {
      throw new ApiError(400, 'bad_request', 'Please provide a script to break into scenes.')
    }

    const prompt = `You are a Shorts art director. Break this script into shot-by-shot scenes.

SCRIPT:
${script}

For each scene, write ONE optimized text-to-image prompt that matches that beat of the script.
Prompts should be vivid and specific (subject, setting, lighting, mood, camera, style) and suited
to a vertical 9:16 Short. Keep prompts under ~60 words. Do not include text/words-in-image requests.

Return JSON ONLY (no markdown fences, no preamble) as an array of:
{ "scene": "what happens in this beat, one short phrase", "prompt": "the image prompt" }

Aim for 4-8 scenes. Return the array only.`

    const text = await askClaude(prompt, { maxTokens: 1500 })
    const parsed = parseJsonFromClaude(text)
    if (!Array.isArray(parsed)) {
      throw new ApiError(502, 'parse_error', 'AI did not return a list of scenes.')
    }
    const scenes = parsed
      .map((s) => ({ scene: String(s.scene || ''), prompt: String(s.prompt || '') }))
      .filter((s) => s.prompt)

    if (!scenes.length) throw new ApiError(502, 'parse_error', 'No usable scenes were produced.')
    res.json({ scenes })
  } catch (err) {
    next(err)
  }
})

// POST /api/image  { prompt } → { images: [url] }
// Paid: the frontend confirms and lets the user pick which scenes to render.
router.post('/image', async (req, res, next) => {
  try {
    const prompt = (req.body?.prompt || '').trim()
    if (!prompt) throw new ApiError(400, 'bad_request', 'Empty image prompt.')
    const images = await generateImages(prompt, { numImages: 1 })
    res.json({ images })
  } catch (err) {
    next(err)
  }
})

export default router
