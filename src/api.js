// Thin client wrapper. The frontend ONLY talks to our backend (/api/*).
// Every helper returns parsed JSON or throws an Error whose .code is the
// backend's machine-readable error code (invalid_key, quota_exceeded, ...).

async function post(path, body) {
  const resp = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  return handle(resp)
}

async function get(path) {
  return handle(await fetch(path))
}

async function handle(resp) {
  let data
  try {
    data = await resp.json()
  } catch {
    throw withCode(new Error(`Server returned ${resp.status}`), 'server_error')
  }
  if (!resp.ok) {
    const err = new Error(data.message || data.error || `Request failed (${resp.status})`)
    return Promise.reject(withCode(err, data.error || 'server_error'))
  }
  return data
}

function withCode(err, code) {
  err.code = code
  return err
}

// Special case: TTS returns binary audio. Resolve to an object URL the
// <audio> player and download link can use; reject with a coded Error on failure.
async function tts(voiceId, text) {
  const resp = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ voiceId, text }),
  })
  if (!resp.ok) {
    let data = {}
    try {
      data = await resp.json()
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(data.message || `TTS failed (${resp.status})`)
    return Promise.reject(withCode(err, data.error || 'server_error'))
  }
  const blob = await resp.blob()
  return URL.createObjectURL(blob)
}

export const api = {
  health: () => get('/api/health'),
  ideas: (niche, region) => post('/api/ideas', { niche, region }),
  analyze: (idea) => post('/api/analyze', { idea }),
  script: (idea, brief) => post('/api/script', { idea, brief }),
  voices: () => get('/api/voices'),
  tts,
  scenes: (script) => post('/api/scenes', { script }),
  image: (prompt) => post('/api/image', { prompt }),
}
