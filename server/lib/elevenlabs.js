import { ApiError } from './anthropic.js'

const BASE = 'https://api.elevenlabs.io/v1'

function requireKey() {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) {
    throw new ApiError(400, 'invalid_key', 'Missing ELEVENLABS_API_KEY — add it to your .env file.')
  }
  return key
}

function mapStatus(status) {
  if (status === 401) return new ApiError(401, 'invalid_key', 'ElevenLabs rejected the API key (401). Check ELEVENLABS_API_KEY.')
  if (status === 403) {
    return new ApiError(
      403,
      'invalid_key',
      'ElevenLabs returned 403 (forbidden). The key is missing permissions — in your ElevenLabs profile, give the API key the "Voices: Read" and "Text to Speech" scopes (or use a key with no scope restrictions).'
    )
  }
  if (status === 429) return new ApiError(429, 'quota_exceeded', 'ElevenLabs quota / rate limit reached. Check your credit balance.')
  return null
}

/** GET /voices — returns [{ id, name, category }] for the dropdown. */
export async function listVoices() {
  const key = requireKey()
  let resp
  try {
    resp = await fetch(`${BASE}/voices`, { headers: { 'xi-api-key': key } })
  } catch (e) {
    throw new ApiError(502, 'network_error', `Could not reach ElevenLabs: ${e.message}`)
  }
  const mapped = mapStatus(resp.status)
  if (mapped) throw mapped
  if (!resp.ok) {
    throw new ApiError(resp.status, 'elevenlabs_error', `ElevenLabs error ${resp.status}`)
  }
  const data = await resp.json()
  return (data.voices || []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category || '',
  }))
}

/**
 * POST /text-to-speech/<voiceId> — returns an mp3 Buffer.
 * Uses model eleven_multilingual_v2.
 */
export async function textToSpeech(voiceId, text) {
  const key = requireKey()
  if (!voiceId) throw new ApiError(400, 'bad_request', 'Please choose a voice.')
  if (!text || !text.trim()) throw new ApiError(400, 'bad_request', 'No script text to voice.')

  let resp
  try {
    resp = await fetch(`${BASE}/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
      }),
    })
  } catch (e) {
    throw new ApiError(502, 'network_error', `Could not reach ElevenLabs: ${e.message}`)
  }

  const mapped = mapStatus(resp.status)
  if (mapped) throw mapped
  if (!resp.ok) {
    let detail = ''
    try {
      detail = JSON.stringify(await resp.json()).slice(0, 300)
    } catch {
      /* ignore */
    }
    throw new ApiError(resp.status, 'elevenlabs_error', `ElevenLabs TTS error ${resp.status}: ${detail}`)
  }

  const arrayBuf = await resp.arrayBuffer()
  return Buffer.from(arrayBuf)
}
