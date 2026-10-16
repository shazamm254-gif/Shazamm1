'use strict';
/**
 * Word stream -> caption chunks.
 *
 * A caption chunk is one "card" on screen. Getting this right is most of what
 * makes captions readable on a phone: too many words and the viewer reads
 * instead of watching, too few and the screen flickers.
 *
 * Rules applied, in priority order:
 *   - never run past a sentence end
 *   - break where the speaker actually paused
 *   - respect the style's character and word budget
 *   - never leave a chunk on screen for less than ~0.5s or more than ~4s
 *   - never orphan a single short word onto its own card
 */

const { round, clamp } = require('../utils');

const MIN_CHUNK_DURATION = 0.45;
const MAX_CHUNK_DURATION = 4.0;
const PAUSE_BREAK = 0.32;          // a gap this long is a natural card break

/**
 * @param {Array} words  [{ word, start, end, endsSentence, endsClause, emphasis }]
 * @param {object} style caption style descriptor
 * @param {object} opts  { pace: 0.7..1.4 } — lower packs more words per card
 */
function chunk(words, style, opts = {}) {
  const pace = clamp(opts.pace || 1, 0.6, 1.6);
  const maxWords = Math.max(2, Math.round(style.maxWordsPerChunk * (2 - pace)));
  const maxChars = Math.max(10, Math.round(style.maxCharsPerLine * style.maxLines * (2 - pace) * 0.92));

  const chunks = [];
  let cur = [];

  const flush = () => {
    if (!cur.length) return;
    chunks.push(buildChunk(cur, style));
    cur = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    cur.push(w);

    const next = words[i + 1];
    const charCount = cur.reduce((a, x) => a + x.word.length + 1, 0) - 1;
    const span = w.end - cur[0].start;
    const gapToNext = next ? next.start - w.end : Infinity;

    let shouldBreak = false;
    let reason = '';

    if (!next) {
      shouldBreak = true; reason = 'end';
    } else if (w.endsSentence) {
      shouldBreak = true; reason = 'sentence';
    } else if (gapToNext >= PAUSE_BREAK) {
      shouldBreak = true; reason = 'pause';
    } else if (cur.length >= maxWords) {
      shouldBreak = true; reason = 'word-budget';
    } else if (charCount >= maxChars) {
      shouldBreak = true; reason = 'char-budget';
    } else if (span >= MAX_CHUNK_DURATION) {
      shouldBreak = true; reason = 'duration';
    } else if (w.endsClause && cur.length >= Math.max(2, maxWords - 2)) {
      shouldBreak = true; reason = 'clause';
    }

    if (shouldBreak) {
      // Avoid orphaning one short trailing word onto the next card.
      if (next && !w.endsSentence && cur.length >= 2) {
        const isLastWord = i === words.length - 2;
        if (isLastWord && next.word.length <= 4 && reason !== 'pause') {
          cur.push(next);
          i++;
        }
      }
      flush();
    }
  }
  flush();

  return mergeTooShort(chunks, style);
}

function buildChunk(words, style) {
  const text = words.map((w) => w.word).join(' ');
  const start = words[0].start;
  const end = words[words.length - 1].end;
  return {
    text: style.uppercase ? text.toUpperCase() : text,
    rawText: text,
    start: round(start, 3),
    end: round(Math.max(end, start + 0.25), 3),
    words: words.map((w) => ({
      word: style.uppercase ? w.word.toUpperCase() : w.word,
      rawWord: w.word,
      start: round(w.start, 3),
      end: round(w.end, 3),
      emphasis: w.emphasis || null,
    })),
    lines: layoutLines(words.map((w) => (style.uppercase ? w.word.toUpperCase() : w.word)), style),
  };
}

/**
 * Greedy line breaking inside the chunk so libass never has to guess, and so
 * the browser preview can wrap identically.
 */
function layoutLines(tokens, style) {
  const lines = [];
  let line = [];
  for (const t of tokens) {
    const candidate = [...line, t].join(' ');
    if (line.length && candidate.length > style.maxCharsPerLine && lines.length < style.maxLines - 1) {
      lines.push(line.join(' '));
      line = [t];
    } else {
      line.push(t);
    }
  }
  if (line.length) lines.push(line.join(' '));
  return lines;
}

/** Fold away cards that would flash on screen for a fraction of a second. */
function mergeTooShort(chunks, style) {
  const out = [];
  for (const c of chunks) {
    const prev = out[out.length - 1];
    const dur = c.end - c.start;
    const canMerge = prev
      && dur < MIN_CHUNK_DURATION
      && (c.start - prev.end) < PAUSE_BREAK
      && (prev.words.length + c.words.length) <= style.maxWordsPerChunk + 2
      && (prev.end - prev.start) + dur <= MAX_CHUNK_DURATION;

    if (canMerge) {
      const words = [...prev.words, ...c.words];
      const merged = buildChunk(
        words.map((w) => ({ ...w, word: w.rawWord })),
        style
      );
      merged.words = words;
      out[out.length - 1] = merged;
    } else {
      out.push(c);
    }
  }

  // Extend any remaining short card up to the minimum, without colliding with
  // the next one.
  for (let i = 0; i < out.length; i++) {
    const dur = out[i].end - out[i].start;
    if (dur < MIN_CHUNK_DURATION) {
      const nextStart = out[i + 1] ? out[i + 1].start : Infinity;
      out[i].end = round(Math.min(out[i].start + MIN_CHUNK_DURATION, nextStart - 0.02), 3);
      if (out[i].end <= out[i].start) out[i].end = round(out[i].start + 0.2, 3);
    }
  }

  return out;
}

module.exports = { chunk, layoutLines, MIN_CHUNK_DURATION, MAX_CHUNK_DURATION, PAUSE_BREAK };
