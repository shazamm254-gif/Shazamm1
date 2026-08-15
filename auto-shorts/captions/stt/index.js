'use strict';
/**
 * Speech-to-text provider registry.
 *
 * Captions need word-level timings. There is more than one honest way to get
 * them, and which one is available depends on the machine, so the engine picks
 * the best option present instead of hard-failing on a missing model:
 *
 *   1. `whisper`      — a real local Whisper install (openai-whisper or
 *                       whisper.cpp). Best quality; transcribes from scratch.
 *   2. `script-align` — the user's own script, force-aligned against the voice
 *                       activity actually detected in their audio. No model, no
 *                       network, and the wording is exactly what they wrote.
 *   3. `srt`          — an imported subtitle file, re-timed onto the edit.
 *
 * Adding a provider means adding a module with { name, isAvailable, transcribe }
 * and listing it here. Nothing else in the app changes.
 */

const whisper = require('./whisper');
const scriptAlign = require('./scriptAlign');
const srt = require('./srt');
const { E } = require('../../utils/errors');

const PROVIDERS = { whisper, 'script-align': scriptAlign, srt };

/** Which providers could actually run right now, and why the others cannot. */
async function status({ hasScript = false, hasSrt = false } = {}) {
  const out = [];
  for (const [name, p] of Object.entries(PROVIDERS)) {
    const avail = await p.isAvailable({ hasScript, hasSrt });
    out.push({
      name,
      label: p.label,
      available: avail.ok,
      reason: avail.reason,
      quality: p.quality,
    });
  }
  return out;
}

/**
 * Transcribe / align, returning:
 *   { provider, words: [{ word, start, end }], text, sentences: [{text,start,end}] }
 *
 * `preferred` may be 'auto' or a provider name.
 */
async function transcribe({ audioPath, script = '', srtText = '', speech = [], duration = 0, preferred = 'auto', language = 'en' }) {
  const hasScript = Boolean(script && script.trim().length > 4);
  const hasSrt = Boolean(srtText && srtText.trim().length > 4);

  const order = preferred && preferred !== 'auto'
    ? [preferred]
    : ['srt', 'whisper', 'script-align'];

  const tried = [];
  for (const name of order) {
    const p = PROVIDERS[name];
    if (!p) {
      tried.push(`${name}: unknown provider`);
      continue;
    }
    const avail = await p.isAvailable({ hasScript, hasSrt });
    if (!avail.ok) {
      tried.push(`${name}: ${avail.reason}`);
      continue;
    }
    try {
      const result = await p.transcribe({ audioPath, script, srtText, speech, duration, language });
      if (result && result.words && result.words.length) {
        return { ...result, provider: name, providerLabel: p.label };
      }
      tried.push(`${name}: produced no words`);
    } catch (err) {
      tried.push(`${name}: ${err.what || err.message}`);
    }
  }

  throw E.sttUnavailable(
    `None of the available engines produced word timings. Tried — ${tried.join('; ')}.`
  );
}

module.exports = { transcribe, status, PROVIDERS };
