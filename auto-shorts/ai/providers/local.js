'use strict';
/**
 * Local analysis provider — the default.
 *
 * No API key, no network, no per-video cost. It reads the transcript and scores
 * it with deterministic linguistic heuristics: which words carry the sentence,
 * where the hook is, which lines describe something you could cut a picture to,
 * and where the natural beats fall.
 *
 * The scoring is deliberately conservative. The spec is explicit that emphasis
 * must not be sprayed at random, so a word has to clear a real threshold *and*
 * win its local neighbourhood before it is marked, and the number of marks is
 * capped relative to the length of the script.
 */

const {
  STOPWORDS, POWER_WORDS, PIVOT_WORDS, CAUSAL_WORDS,
  WORD_TO_CONCEPT, CONCEPT_SUGGESTIONS,
} = require('../lexicon');
const { round, clamp } = require('../../utils');

async function isAvailable() {
  return { ok: true, reason: 'Always available — runs entirely on this machine.' };
}

/* ------------------------------------------------------------- emphasis */

/**
 * Score one word for emphasis. Returns { score, reasons }.
 * `pos` is its index inside its sentence, `sentLen` the sentence length.
 */
function scoreWord(w, ctxInfo) {
  const { pos, sentLen, isFirstSentence, prevClean, rawWord } = ctxInfo;
  const clean = (w.clean || '').toLowerCase();
  const reasons = [];
  let score = 0;

  if (!clean || STOPWORDS.has(clean)) {
    // Stopwords are only ever emphasised when they are a sentence-opening pivot
    // ("BUT...", "NOBODY tells you...") — that is a real rhetorical beat.
    if (PIVOT_WORDS.has(clean) && pos === 0) {
      return { score: 3.2, reasons: ['sentence-opening pivot'] };
    }
    if (clean === 'this' && pos === 0) {
      return { score: 2.6, reasons: ['deictic opener'] };
    }
    return { score: 0, reasons: [] };
  }

  // Numbers and money are the most reliably emphasised tokens in short-form.
  if (/[\d]/.test(rawWord)) {
    score += /[$£€%]/.test(rawWord) ? 4.0 : 3.2;
    reasons.push('quantity');
  }

  // The creator shouting in the script is an explicit instruction.
  if (rawWord.length > 2 && rawWord === rawWord.toUpperCase() && /[A-Z]{3}/.test(rawWord)) {
    score += 3.0;
    reasons.push('capitalised in script');
  }

  if (POWER_WORDS.has(clean)) {
    score += 2.8;
    reasons.push('high-salience word');
  }

  if (PIVOT_WORDS.has(clean)) {
    score += 1.8;
    reasons.push('contrast marker');
  }

  // The word right after "because" / "which means" is the payoff.
  if (prevClean && CAUSAL_WORDS.has(prevClean)) {
    score += 1.3;
    reasons.push('follows a causal marker');
  }

  // Something visual and specific.
  if (WORD_TO_CONCEPT.has(clean)) {
    score += 1.1;
    reasons.push('concrete noun');
  }

  // Long, uncommon words tend to be the technical core of a line.
  if (clean.length >= 8) {
    score += 0.8;
    reasons.push('long content word');
  }

  // Final content word of a sentence lands the point.
  if (pos >= sentLen - 2 && sentLen > 3) {
    score += 0.9;
    reasons.push('sentence payoff position');
  }

  // The hook sentence gets a small boost — it is doing the most work.
  if (isFirstSentence) {
    score *= 1.15;
  }

  return { score, reasons };
}

/**
 * Mark emphasis words. Two constraints keep this from becoming noise:
 * a global budget proportional to script length, and a spacing rule so two
 * marks never sit next to each other.
 */
function findEmphasis(words, sentences, settings) {
  if (!words.length) return [];

  const intensity = settings.emphasisIntensity !== undefined ? settings.emphasisIntensity : 1;
  const wordToSentence = new Map();
  sentences.forEach((s, si) => {
    words.forEach((w, wi) => {
      if (w.start >= s.start - 1e-6 && w.end <= s.end + 1e-6 && !wordToSentence.has(wi)) {
        wordToSentence.set(wi, si);
      }
    });
  });

  // Position of each word within its sentence.
  const sentenceCounts = new Map();
  const positions = words.map((_, i) => {
    const si = wordToSentence.get(i) ?? 0;
    const p = sentenceCounts.get(si) || 0;
    sentenceCounts.set(si, p + 1);
    return { si, p };
  });
  const sentLens = new Map();
  for (const [si, n] of sentenceCounts) sentLens.set(si, n);

  const scored = words.map((w, i) => {
    const { si, p } = positions[i];
    const { score, reasons } = scoreWord(w, {
      pos: p,
      sentLen: sentLens.get(si) || 1,
      isFirstSentence: si === 0,
      prevClean: i > 0 ? (words[i - 1].clean || '').toLowerCase() : null,
      rawWord: w.word,
    });
    return { index: i, score, reasons, sentence: si };
  });

  // Budget: roughly one emphasis every seven words, scaled by preset intensity.
  const budget = Math.max(1, Math.round((words.length / 7) * intensity));
  const threshold = 2.4;

  const candidates = scored
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score);

  const chosen = [];
  const taken = new Set();
  const perSentence = new Map();

  for (const c of candidates) {
    if (chosen.length >= budget) break;
    // Never emphasise adjacent words — the effect cancels itself out.
    if (taken.has(c.index - 1) || taken.has(c.index + 1)) continue;
    // At most two marks in any one sentence.
    const used = perSentence.get(c.sentence) || 0;
    if (used >= 2) continue;

    chosen.push(c);
    taken.add(c.index);
    perSentence.set(c.sentence, used + 1);
  }

  const strongCut = 4.0;
  return chosen
    .sort((a, b) => a.index - b.index)
    .map((c) => ({
      index: c.index,
      level: c.score >= strongCut ? 'strong' : 'normal',
      score: round(c.score, 2),
      reason: c.reasons[0] || 'salient word',
    }));
}

/* ----------------------------------------------------------------- hook */

/**
 * The hook is the opening claim — everything up to the first sentence boundary,
 * extended if that first sentence is very short (a two-word opener is a setup,
 * not the whole hook).
 */
function findHook(words, sentences) {
  if (!sentences.length) {
    return words.length
      ? { start: words[0].start, end: words[Math.min(words.length - 1, 8)].end, text: words.slice(0, 9).map((w) => w.word).join(' '), strength: 0.5 }
      : null;
  }

  let end = 0;
  let text = '';
  let strength = 0.6;

  for (let i = 0; i < Math.min(3, sentences.length); i++) {
    end = i;
    text = sentences.slice(0, i + 1).map((s) => s.text).join(' ');
    const dur = sentences[i].end - sentences[0].start;
    const wordCount = sentences.slice(0, i + 1).reduce((a, s) => a + s.wordCount, 0);
    if (wordCount >= 6 && dur >= 1.6) break;
  }

  const hookText = text.toLowerCase();
  // A question, a negation or a direct address is a stronger opening.
  if (/\?/.test(text)) strength += 0.2;
  if (/\b(you|your)\b/.test(hookText)) strength += 0.15;
  if (/\b(never|nobody|nothing|stop|wrong|mistake)\b/.test(hookText)) strength += 0.15;

  return {
    start: round(sentences[0].start, 3),
    end: round(sentences[end].end, 3),
    text,
    strength: round(clamp(strength, 0, 1), 2),
  };
}

/* ---------------------------------------------------------------- broll */

/**
 * Find sentences that describe something showable, and turn each into a B-roll
 * slot with concrete search terms. Slots are spaced out so the edit does not
 * cut away every other line.
 */
function findBroll(words, sentences, settings, duration) {
  const density = settings.brollDensity !== undefined ? settings.brollDensity : 0.5;
  if (density <= 0 || !sentences.length) return [];

  const scored = sentences.map((s, i) => {
    const toks = s.text.toLowerCase().split(/\s+/).map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''));
    const concepts = new Map();
    let hits = 0;

    for (const t of toks) {
      const c = WORD_TO_CONCEPT.get(t);
      if (c) {
        hits++;
        concepts.set(c, (concepts.get(c) || 0) + 1);
      }
    }

    const top = Array.from(concepts.entries()).sort((a, b) => b[1] - a[1])[0];
    const dur = s.end - s.start;
    // Long enough to be worth a cutaway, and actually about something.
    const score = hits * 1.4 + (dur >= 1.8 ? 0.6 : 0) + (i > 0 ? 0.4 : -0.8);

    return {
      index: i,
      sentence: s,
      score,
      concept: top ? top[0] : null,
      hits,
      keywords: toks.filter((t) => WORD_TO_CONCEPT.has(t)).slice(0, 4),
    };
  });

  // One slot per ~9 seconds at full density.
  const budget = Math.max(0, Math.round((duration / 9) * density * 2));
  const picked = [];
  const minGap = 3.2;

  for (const cand of scored.filter((c) => c.hits > 0 && c.score >= 1.4).sort((a, b) => b.score - a.score)) {
    if (picked.length >= budget) break;
    if (picked.some((p) => Math.abs(p.sentence.start - cand.sentence.start) < minGap)) continue;
    picked.push(cand);
  }

  return picked
    .sort((a, b) => a.sentence.start - b.sentence.start)
    .map((c) => {
      const span = c.sentence.end - c.sentence.start;
      // Cut away for the middle of the line, not the whole line — the speaker's
      // face returning is what keeps the edit feeling live.
      const start = c.sentence.start + Math.min(0.25, span * 0.12);
      const end = Math.min(c.sentence.end - 0.05, start + clamp(span * 0.72, 1.1, 3.2));
      return {
        start: round(start, 3),
        end: round(Math.max(end, start + 0.9), 3),
        concept: c.concept,
        keywords: c.keywords,
        suggestions: (CONCEPT_SUGGESTIONS[c.concept] || []).slice(0, 4),
        reason: `"${c.sentence.text.slice(0, 60)}${c.sentence.text.length > 60 ? '…' : ''}" describes something you can show.`,
        confidence: round(clamp(c.score / 5, 0.2, 0.95), 2),
      };
    });
}

/* ---------------------------------------------------------------- beats */

/**
 * Structural beats — where a visual change, punch-in or sound effect would land
 * naturally. Derived from sentence starts, the hook, and emphasis positions
 * rather than from a metronome.
 */
function findBeats(words, sentences, emphasis, hook, duration) {
  const beats = [];

  if (hook) {
    beats.push({ time: round(hook.start, 3), kind: 'hook', strength: 1.0 });
    beats.push({ time: round(hook.end, 3), kind: 'reveal', strength: 0.8 });
  }

  for (const s of sentences) {
    beats.push({ time: round(s.start, 3), kind: 'sentence', strength: 0.45 });
  }

  for (const e of emphasis) {
    const w = words[e.index];
    if (!w) continue;
    beats.push({
      time: round(w.start, 3),
      kind: e.level === 'strong' ? 'accent-strong' : 'accent',
      strength: e.level === 'strong' ? 0.85 : 0.55,
    });
  }

  // A pattern interrupt roughly a third of the way in, on a sentence boundary,
  // is the classic retention save.
  if (duration > 14 && sentences.length > 3) {
    const target = duration * 0.36;
    const s = sentences.reduce((best, x) => (
      Math.abs(x.start - target) < Math.abs(best.start - target) ? x : best
    ), sentences[0]);
    beats.push({ time: round(s.start, 3), kind: 'interrupt', strength: 0.7 });
  }

  return beats
    .filter((b) => b.time >= 0 && b.time <= duration)
    .sort((a, b) => a.time - b.time);
}

/* --------------------------------------------------------------- topics */

function findTopics(words) {
  const freq = new Map();
  for (const w of words) {
    const c = (w.clean || '').toLowerCase();
    if (!c || c.length < 4 || STOPWORDS.has(c)) continue;
    freq.set(c, (freq.get(c) || 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

/* ---------------------------------------------------------------- entry */

async function analyze(ctx) {
  const { words = [], sentences = [], settings = {}, duration = 0 } = ctx;

  const hook = findHook(words, sentences);
  const emphasis = findEmphasis(words, sentences, settings);
  const broll = findBroll(words, sentences, settings, duration);
  const beats = findBeats(words, sentences, emphasis, hook, duration);
  const topics = findTopics(words);

  return { hook, emphasis, broll, beats, topics, provider: 'local' };
}

module.exports = {
  name: 'local',
  label: 'Local heuristics (offline)',
  description: 'Deterministic linguistic analysis. No key, no network, no cost.',
  isAvailable,
  analyze,
  // exported for tests and for hosted providers that want the same primitives
  findEmphasis, findHook, findBroll, findBeats, scoreWord,
};
