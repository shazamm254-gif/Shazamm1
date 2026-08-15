'use strict';
/**
 * OpenAI provider — optional. Same contract and same scope as the Anthropic
 * provider; it exists to prove the abstraction holds for more than one vendor.
 * Only activates when OPENAI_API_KEY is set.
 */

const config = require('../../config');
const { buildPrompt, parseAnalysis } = require('./promptShared');

async function isAvailable() {
  return config.ai.openaiKey
    ? { ok: true, reason: `Enabled — model ${config.ai.openaiModel}.` }
    : { ok: false, reason: 'OPENAI_API_KEY is not set' };
}

async function analyze(ctx, baseline) {
  const { system, user } = buildPrompt(ctx, baseline);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.ai.openaiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.openaiModel,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  return parseAnalysis(text, ctx);
}

module.exports = {
  name: 'openai',
  label: 'OpenAI (hosted)',
  description: 'Refines word emphasis and B-roll intent. Transcript only — media stays local.',
  isAvailable,
  analyze,
};
