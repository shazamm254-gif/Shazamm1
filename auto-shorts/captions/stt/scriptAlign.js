'use strict';
/**
 * Script → audio forced alignment (approximate, model-free).
 *
 * The premise: the creator already knows what they said — they pasted the
 * script. What they do not know is *when* they said each word. We already have
 * that from voice-activity detection on the real waveform, so aligning the two
 * gives word-level caption timings with no speech model, no download, and no
 * network call.
 *
 * How it works:
 *   1. Clean the script (drop HOOK:/BODY:/CTA: labels and stage directions).
 *   2. Weight every word by how long it plausibly takes to say — syllable count,
 *      plus a fixed per-word cost, plus extra for the pause punctuation implies.
 *   3. Split the word stream across the detected speech runs in proportion to
 *      each run's duration, snapping the split points to sentence and clause
 *      boundaries wherever one is close by.
 *   4. Lay the words out inside each run proportionally to their weight.
 *
 * The result tracks real speech: if the speaker paused for two seconds, the
 * captions pause there too, because the pause is a gap between speech runs.
 *
 * Limitation, stated plainly: this is proportional alignment, not acoustic
 * alignment. Word boundaries inside a continuous run are estimates. In practice
 * captions land within a couple of hundred milliseconds, which reads correctly
 * on screen; if you need exact per-word timing, install Whisper and the engine
 * will prefer it automatically.
 */

const { syllables, round, clamp } = require('../../utils');

const LABEL_RE = /^\s*(hook|body|cta|intro|outro|call to action|script|voiceover|vo|narration|scene|beat|part)\s*\d*\s*[:\-—]\s*/i;
const BRACKETED_RE = /\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g;

/** Strip production labels, stage directions and wrapping quotes. */
function cleanScript(script) {
  return String(script)
    .split(/\r?\n/)
    .map((line) => {
      let l = line.replace(LABEL_RE, '');
      l = l.replace(BRACKETED_RE, ' ');
      l = l.trim();
      // Drop wrapping quotes the spec's example script format uses.
      if ((l.startsWith('"') && l.endsWith('"')) || (l.startsWith('“') && l.endsWith('”'))) {
        l = l.slice(1, -1);
      }
      // A line that was only a label ("HOOK:") is now empty — drop it.
      return l;
    })
    .filter((l) => l.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokenize into words that keep their trailing punctuation. */
function tokenize(text) {
  const raw = text.split(/\s+/).filter(Boolean);
  return raw.map((w) => {
    const trailing = (/[.!?,;:…]+$/.exec(w) || [''])[0];
    return {
      word: w,
      clean: w.replace(/[^\p{L}\p{N}'$%\-]/gu, ''),
      endsSentence: /[.!?…]$/.test(w),
      endsClause: /[,;:]$/.test(w),
      punct: trailing,
    };
  }).filter((t) => t.word.length > 0);
}

/**
 * Speaking cost of a word, in arbitrary units. Punctuation adds the pause that
 * follows it, which is what keeps captions from drifting across a sentence end.
 */
function weightOf(tok) {
  const syl = syllables(tok.clean || tok.word);
  let w = 0.34 + syl * 0.62;                 // per-word overhead + syllable time
  if (/\d/.test(tok.word)) w += 0.55;        // numbers are spoken slowly
  if (tok.clean.length > 9) w += 0.18;       // long words drag
  if (tok.endsSentence) w += 0.85;           // sentence-final pause
  else if (tok.endsClause) w += 0.40;        // clause pause
  return w;
}

async function isAvailable({ hasScript }) {
  return hasScript
    ? { ok: true, reason: 'A script is available to align against the narration.' }
    : { ok: false, reason: 'no script was provided to align' };
}

/**
 * @param {object} opts
 * @param {string} opts.script     Raw script text as typed by the user.
 * @param {Array}  opts.speech     [{start,end}] speech runs from VAD.
 * @param {number} opts.duration   Total voice-track duration.
 */
async function transcribe({ script, speech = [], duration = 0 }) {
  const text = cleanScript(script);
  const tokens = tokenize(text);
  if (!tokens.length) {
    return { words: [], text: '', sentences: [] };
  }

  // Without VAD data, fall back to one run covering the whole track. Still
  // produces usable captions, just without pause awareness.
  let runs = (speech || []).filter((s) => s.end > s.start);
  if (!runs.length) runs = [{ start: 0, end: Math.max(duration, tokens.length * 0.36) }];

  const runTotal = runs.reduce((a, r) => a + (r.end - r.start), 0);
  const weights = tokens.map(weightOf);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // ---- 1. Assign a slice of the word stream to each speech run -------------
  const assignments = [];
  let cursor = 0;
  let weightConsumed = 0;

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const isLast = i === runs.length - 1;

    if (isLast) {
      assignments.push({ run, from: cursor, to: tokens.length });
      break;
    }

    const share = (run.end - run.start) / runTotal;
    const targetWeight = weightConsumed + share * totalWeight;

    // Walk forward until we have consumed this run's share of the weight.
    let acc = weightConsumed;
    let idx = cursor;
    while (idx < tokens.length && acc + weights[idx] <= targetWeight) {
      acc += weights[idx];
      idx++;
    }
    if (idx === cursor && cursor < tokens.length) { acc += weights[idx]; idx++; }

    // Snap the boundary to a nearby sentence end, then a clause end. A pause in
    // the audio almost always coincides with punctuation in the script, so this
    // correction removes most of the drift proportional splitting introduces.
    const window = Math.max(2, Math.round(tokens.length * 0.035));
    const snap = findBoundary(tokens, idx, window, cursor + 1, tokens.length - 1);
    if (snap !== null) {
      let a = weightConsumed;
      for (let k = cursor; k < snap; k++) a += weights[k];
      acc = a;
      idx = snap;
    }

    assignments.push({ run, from: cursor, to: idx });
    cursor = idx;
    weightConsumed = acc;
    if (cursor >= tokens.length) {
      // Words ran out before the audio did — leave the remaining runs empty.
      for (let k = i + 1; k < runs.length; k++) assignments.push({ run: runs[k], from: cursor, to: cursor });
      break;
    }
  }

  // ---- 2. Lay words out inside each run, weighted by speaking cost ---------
  const words = [];
  for (const a of assignments) {
    const n = a.to - a.from;
    if (n <= 0) continue;
    const span = Math.max(0.12, a.run.end - a.run.start);
    let localWeight = 0;
    for (let k = a.from; k < a.to; k++) localWeight += weights[k];
    if (localWeight <= 0) localWeight = n;

    let t = a.run.start;
    for (let k = a.from; k < a.to; k++) {
      const tok = tokens[k];
      const dur = (weights[k] / localWeight) * span;
      // Trailing pause weight belongs to the gap after the word, not to the
      // word itself, so the caption does not hang on screen mid-sentence.
      const pausePart = tok.endsSentence ? 0.85 : tok.endsClause ? 0.40 : 0;
      const spoken = Math.max(0.08, dur * (1 - clamp(pausePart / Math.max(weights[k], 0.01), 0, 0.55)));
      words.push({
        word: tok.word,
        clean: tok.clean,
        start: round(t, 3),
        end: round(Math.min(t + spoken, a.run.end), 3),
        endsSentence: tok.endsSentence,
        endsClause: tok.endsClause,
      });
      t += dur;
    }
  }

  // Guarantee monotonic, non-degenerate timings.
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && words[i].start < words[i - 1].end) words[i].start = words[i - 1].end;
    if (words[i].end <= words[i].start) words[i].end = round(words[i].start + 0.09, 3);
  }

  return {
    words,
    text,
    sentences: groupSentences(words),
    approximate: true,
  };
}

/** Nearest sentence boundary to `idx`, else nearest clause boundary. */
function findBoundary(tokens, idx, window, lo, hi) {
  for (const test of ['endsSentence', 'endsClause']) {
    for (let d = 0; d <= window; d++) {
      for (const cand of [idx - d, idx + d]) {
        const j = cand - 1; // boundary sits *after* token j
        if (j < lo - 1 || j >= hi) continue;
        if (tokens[j] && tokens[j][test]) return j + 1;
      }
    }
  }
  return null;
}

/** Regroup a word stream into sentences for downstream emphasis analysis. */
function groupSentences(words) {
  const out = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (w.endsSentence) {
      out.push(makeSentence(cur));
      cur = [];
    }
  }
  if (cur.length) out.push(makeSentence(cur));
  return out;
}

function makeSentence(ws) {
  return {
    text: ws.map((w) => w.word).join(' '),
    start: ws[0].start,
    end: ws[ws.length - 1].end,
    wordCount: ws.length,
  };
}

module.exports = {
  name: 'script-align',
  label: 'Script alignment (local, no model)',
  quality: 'good when a script is provided',
  isAvailable,
  transcribe,
  cleanScript,
  tokenize,
  groupSentences,
};
