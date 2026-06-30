// Shared helpers for talking to the Anthropic Messages API, plus a small typed
// error class so routes can signal clean, frontend-friendly failures.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code // machine-readable: 'invalid_key' | 'quota_exceeded' | 'empty_results' | ...
  }
}

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

// OpenRouter is an OpenAI-compatible gateway. If OPENROUTER_API_KEY is set we
// route every "Claude" call through it instead of Anthropic directly — handy
// when you have no Anthropic credits (OpenRouter has free models). Pick the
// model with OPENROUTER_MODEL; the default is a capable free model.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_DEFAULT_MODEL = 'deepseek/deepseek-chat-v3-0324:free'

/** Which AI provider is active, based on which key is present. */
export function aiProvider() {
  return process.env.OPENROUTER_API_KEY ? 'openrouter' : 'anthropic'
}

/**
 * Call the LLM with a single user message and return the concatenated text.
 * Routes through OpenRouter when its key is set, else Anthropic directly.
 * Wrapped errors become ApiError so the central handler can render them.
 */
export async function askClaude(prompt, opts = {}) {
  return aiProvider() === 'openrouter'
    ? callOpenRouter(prompt, opts)
    : callAnthropic(prompt, opts)
}

async function callAnthropic(prompt, { maxTokens = 1024, system } = {}) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new ApiError(400, 'invalid_key', 'Missing ANTHROPIC_API_KEY — add it to your .env file (or set OPENROUTER_API_KEY).')
  }

  let resp
  try {
    resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (e) {
    throw new ApiError(502, 'network_error', `Could not reach Anthropic: ${e.message}`)
  }

  if (resp.status === 401) {
    throw new ApiError(401, 'invalid_key', 'Anthropic rejected the API key (401). Check ANTHROPIC_API_KEY.')
  }
  if (resp.status === 429) {
    throw new ApiError(429, 'quota_exceeded', 'Anthropic rate limit / quota exceeded. Try again shortly.')
  }
  if (!resp.ok) {
    const detail = await safeText(resp)
    // A valid key with an empty wallet returns 400 with this message — surface
    // it as a distinct, actionable billing error rather than a generic failure.
    if (/credit balance is too low|too low to access/i.test(detail)) {
      throw new ApiError(402, 'billing', 'Your Anthropic credit balance is too low. Add credits at console.anthropic.com → Plans & Billing.')
    }
    throw new ApiError(resp.status, 'anthropic_error', `Anthropic error ${resp.status}: ${detail}`)
  }

  const data = await resp.json()
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()

  if (!text) {
    throw new ApiError(502, 'anthropic_error', 'Anthropic returned an empty response.')
  }
  return text
}

async function callOpenRouter(prompt, { maxTokens = 1024, system } = {}) {
  const key = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL

  let resp
  try {
    resp = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        // Optional attribution headers OpenRouter recommends.
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'The Algorithm Beater',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
      }),
    })
  } catch (e) {
    throw new ApiError(502, 'network_error', `Could not reach OpenRouter: ${e.message}`)
  }

  if (resp.status === 401) {
    throw new ApiError(401, 'invalid_key', 'OpenRouter rejected the API key (401). Check OPENROUTER_API_KEY.')
  }
  if (resp.status === 402) {
    throw new ApiError(402, 'billing', 'OpenRouter says this request needs credits. Pick a free model (OPENROUTER_MODEL ending in ":free") or add credits.')
  }
  if (resp.status === 429) {
    throw new ApiError(429, 'quota_exceeded', `OpenRouter rate limit reached for "${model}". Wait a bit or try another free model.`)
  }
  if (resp.status === 404) {
    throw new ApiError(404, 'anthropic_error', `OpenRouter model "${model}" not found. Set OPENROUTER_MODEL to a valid id.`)
  }
  if (!resp.ok) {
    const detail = await safeText(resp)
    throw new ApiError(resp.status, 'anthropic_error', `OpenRouter error ${resp.status}: ${detail}`)
  }

  const data = await resp.json()
  const text = (data.choices?.[0]?.message?.content || '').trim()
  if (!text) {
    throw new ApiError(502, 'anthropic_error', `OpenRouter model "${model}" returned an empty response.`)
  }
  return text
}

/**
 * Strip ```json … ``` fences (and any preamble) and JSON.parse.
 * Throws ApiError('parse_error') if the model didn't return valid JSON.
 */
export function parseJsonFromClaude(text) {
  let cleaned = text.trim()

  // Remove a leading ```json or ``` fence and trailing ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // If there's still preamble, grab the first {...} or [...] block.
  if (cleaned[0] !== '{' && cleaned[0] !== '[') {
    const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
    if (match) cleaned = match[1]
  }

  try {
    return JSON.parse(cleaned)
  } catch (e) {
    throw new ApiError(502, 'parse_error', 'Could not parse the AI response as JSON.')
  }
}

async function safeText(resp) {
  try {
    return (await resp.text()).slice(0, 300)
  } catch {
    return '(no body)'
  }
}
