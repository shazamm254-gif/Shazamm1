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

export const api = {
  health: () => get('/api/health'),
  ideas: (niche, region) => post('/api/ideas', { niche, region }),
  analyze: (idea) => post('/api/analyze', { idea }),
  script: (idea, brief) => post('/api/script', { idea, brief }),
}
