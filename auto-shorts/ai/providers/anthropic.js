'use strict';
/**
 * Anthropic provider — optional.
 *
 * Only activates when ANTHROPIC_API_KEY is set. It refines the two judgements
 * where a language model genuinely beats a word list: which words carry the
 * sentence, and what a line is actually *about* for B-roll purposes. Cuts,
 * timings and pacing stay local and deterministic — sending those to a model
 * would add latency and cost without improving the edit.
 *
 * The transcript is the only thing sent. No media ever leaves the machine.
 */

const config = require('../../config');
const { buildPrompt, parseAnalysis } = require('./promptShared');

async function isAvailable() {
  return config.ai.anthropicKey
    ? { ok: true, reason: `Enabled — model ${config.ai.anthropicModel}.` }
    : { ok: false, reason: 'ANTHROPIC_API_KEY is not set' };
}

async function analyze(ctx, baseline) {
  const { system, user } = buildPrompt(ctx, baseline);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.ai.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.ai.anthropicModel,
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: user }],
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
  const text = (json.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return parseAnalysis(text, ctx);
}

module.exports = {
  name: 'anthropic',
  label: 'Anthropic (hosted)',
  description: 'Refines word emphasis and B-roll intent. Transcript only — media stays local.',
  isAvailable,
  analyze,
};
