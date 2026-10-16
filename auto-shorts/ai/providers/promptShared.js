'use strict';
/**
 * Prompt construction and response parsing shared by the hosted providers.
 *
 * The model is asked for judgement only — which word indices matter and what
 * each B-roll slot should show. It is never asked for timings; those come from
 * the audio analysis, which is measured rather than guessed. Anything the model
 * returns that does not validate is dropped, and the local baseline stands in.
 */

const { clamp, round } = require('../../utils');

const SYSTEM = `You are the analysis stage of an automated short-form video editor.

You receive a numbered transcript of a creator's narration. You return JSON that
tells the editor which words to emphasise on screen and where a cutaway visual
would help.

Rules:
- Emphasise only words that carry the meaning of their sentence: the number, the
  reversal, the named thing, the payoff. Never emphasise filler or function words.
- Aim for roughly one emphasised word every seven words. Fewer is better than more.
- Never emphasise two adjacent words.
- "strong" is reserved for the single most important word in a sentence, and only
  for a minority of your picks.
- A B-roll slot is only worth proposing when the line names something concrete
  that a viewer could see. Abstract statements do not get B-roll.
- B-roll search terms should read like what a creator would type to find footage.

Return only JSON. No prose, no code fences.`;

const SCHEMA = `{
  "hook": { "endWordIndex": <int>, "strength": <0..1> },
  "emphasis": [ { "index": <int>, "level": "normal" | "strong", "reason": "<short>" } ],
  "broll": [ { "startWordIndex": <int>, "endWordIndex": <int>, "searchTerms": ["<term>", ...], "reason": "<short>" } ]
}`;

function buildPrompt(ctx, baseline) {
  const words = ctx.words || [];
  // Cap the transcript so a long podcast import cannot blow up the request.
  const capped = words.slice(0, 900);

  const numbered = capped
    .map((w, i) => `${i}:${w.word}`)
    .join(' ');

  const mediaLine = (ctx.mediaTags || []).length
    ? `\n\nThe creator's media library contains: ${ctx.mediaTags.map((m) => m.name).slice(0, 40).join(', ')}. Prefer search terms that match these where it is honest to do so.`
    : '';

  const user = `Transcript, as index:word pairs.

${numbered}

Total words: ${capped.length}. Video length: ${round(ctx.duration || 0, 1)}s.
Editing preset: ${ctx.settings?.preset || 'high_retention'}.

Return JSON in exactly this shape:
${SCHEMA}

Indices must refer to the numbered transcript above and stay within 0..${Math.max(0, capped.length - 1)}.${mediaLine}`;

  return { system: SYSTEM, user };
}

/** Pull the first JSON object out of a model response, tolerating fences. */
function extractJson(text) {
  const t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch (_) { /* fall through to a brace scan */ }

  const start = t.indexOf('{');
  if (start === -1) throw new Error('response contained no JSON object');
  let depth = 0;
  for (let i = start; i < t.length; i++) {
    if (t[i] === '{') depth++;
    else if (t[i] === '}') {
      depth--;
      if (depth === 0) return JSON.parse(t.slice(start, i + 1));
    }
  }
  throw new Error('response contained an unterminated JSON object');
}

/**
 * Validate the model's response against the real word list and convert word
 * indices back into timings. Anything out of range or malformed is discarded.
 */
function parseAnalysis(text, ctx) {
  const words = ctx.words || [];
  const raw = extractJson(text);
  const maxIdx = words.length - 1;
  const out = {};

  if (Array.isArray(raw.emphasis)) {
    const seen = new Set();
    out.emphasis = raw.emphasis
      .map((e) => ({
        index: Number(e.index),
        level: e.level === 'strong' ? 'strong' : 'normal',
        reason: String(e.reason || 'model judgement').slice(0, 80),
      }))
      .filter((e) => Number.isInteger(e.index) && e.index >= 0 && e.index <= maxIdx)
      .filter((e) => {
        // Enforce the no-adjacent rule regardless of what the model returned.
        if (seen.has(e.index) || seen.has(e.index - 1) || seen.has(e.index + 1)) return false;
        seen.add(e.index);
        return true;
      })
      .sort((a, b) => a.index - b.index);
  }

  if (Array.isArray(raw.broll)) {
    out.broll = raw.broll
      .map((b) => {
        const s = Number(b.startWordIndex);
        const e = Number(b.endWordIndex);
        if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e > maxIdx || e <= s) return null;
        const terms = Array.isArray(b.searchTerms)
          ? b.searchTerms.map((t) => String(t).slice(0, 60)).slice(0, 5)
          : [];
        return {
          start: round(words[s].start, 3),
          end: round(words[e].end, 3),
          keywords: terms.map((t) => t.split(/\s+/)[0].toLowerCase()),
          suggestions: terms,
          reason: String(b.reason || 'model suggestion').slice(0, 120),
          confidence: 0.7,
          concept: null,
        };
      })
      .filter(Boolean)
      .filter((b) => b.end - b.start >= 0.6)
      .sort((a, b) => a.start - b.start);
  }

  if (raw.hook && Number.isInteger(Number(raw.hook.endWordIndex))) {
    const e = clamp(Number(raw.hook.endWordIndex), 0, maxIdx);
    if (words.length) {
      out.hook = {
        start: round(words[0].start, 3),
        end: round(words[e].end, 3),
        text: words.slice(0, e + 1).map((w) => w.word).join(' '),
        strength: round(clamp(Number(raw.hook.strength) || 0.7, 0, 1), 2),
      };
    }
  }

  return out;
}

module.exports = { buildPrompt, parseAnalysis, extractJson, SYSTEM };
