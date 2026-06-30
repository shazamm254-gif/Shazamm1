import { ApiError } from './anthropic.js'

const BASE = 'https://cloud.leonardo.ai/api/rest/v1'

function requireKey() {
  const key = process.env.LEONARDO_API_KEY
  if (!key) {
    throw new ApiError(400, 'invalid_key', 'Missing LEONARDO_API_KEY — add it to your .env file.')
  }
  return key
}

function authHeaders(key) {
  return {
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
    accept: 'application/json',
  }
}

function mapStatus(status) {
  if (status === 401 || status === 403) {
    return new ApiError(status, 'invalid_key', `Leonardo rejected the API key (${status}). Check LEONARDO_API_KEY.`)
  }
  if (status === 429) return new ApiError(429, 'quota_exceeded', 'Leonardo quota / rate limit reached. Check your credit balance.')
  return null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Generate images for a prompt and poll until they're ready.
 * Returns an array of image URLs.
 */
export async function generateImages(prompt, { numImages = 1, width = 768, height = 1344 } = {}) {
  const key = requireKey()
  if (!prompt || !prompt.trim()) throw new ApiError(400, 'bad_request', 'Empty image prompt.')

  // 1. Kick off the generation.
  let startResp
  try {
    startResp = await fetch(`${BASE}/generations`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify({
        prompt,
        num_images: Math.max(1, Math.min(numImages, 4)),
        width, // 9:16-ish portrait suits Shorts
        height,
      }),
    })
  } catch (e) {
    throw new ApiError(502, 'network_error', `Could not reach Leonardo: ${e.message}`)
  }

  const mapped = mapStatus(startResp.status)
  if (mapped) throw mapped
  if (!startResp.ok) {
    let detail = ''
    try {
      detail = JSON.stringify(await startResp.json()).slice(0, 300)
    } catch {
      /* ignore */
    }
    throw new ApiError(startResp.status, 'leonardo_error', `Leonardo error ${startResp.status}: ${detail}`)
  }

  const startData = await startResp.json()
  const generationId = startData?.sdGenerationJob?.generationId
  if (!generationId) {
    throw new ApiError(502, 'leonardo_error', 'Leonardo did not return a generation id.')
  }

  // 2. Poll until COMPLETE (or time out).
  const maxAttempts = 30 // ~60s at 2s intervals
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(2000)
    let pollResp
    try {
      pollResp = await fetch(`${BASE}/generations/${generationId}`, {
        headers: authHeaders(key),
      })
    } catch (e) {
      throw new ApiError(502, 'network_error', `Could not reach Leonardo: ${e.message}`)
    }
    const pMapped = mapStatus(pollResp.status)
    if (pMapped) throw pMapped
    if (!pollResp.ok) continue

    const data = await pollResp.json()
    const gen = data?.generations_by_pk
    const status = gen?.status
    if (status === 'COMPLETE') {
      const urls = (gen.generated_images || []).map((img) => img.url).filter(Boolean)
      if (!urls.length) throw new ApiError(502, 'leonardo_error', 'Generation completed but returned no images.')
      return urls
    }
    if (status === 'FAILED') {
      throw new ApiError(502, 'leonardo_error', 'Leonardo reported the generation FAILED.')
    }
    // else PENDING — keep polling
  }

  throw new ApiError(504, 'leonardo_error', 'Timed out waiting for Leonardo to finish. Try again.')
}
