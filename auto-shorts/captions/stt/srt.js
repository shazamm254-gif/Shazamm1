'use strict';
/**
 * SRT / VTT import provider.
 *
 * The documented escape hatch when no speech engine is available: bring your
 * own subtitle file. Cue text is split into words and spread across each cue's
 * time span, which is enough for the caption styler and the emphasis pass.
 */

const { parseTimecode, round, syllables } = require('../../utils');

async function isAvailable({ hasSrt }) {
  return hasSrt
    ? { ok: true, reason: 'A subtitle file has been imported.' }
    : { ok: false, reason: 'no .srt/.vtt file has been imported' };
}

/** Parse SRT or WebVTT into cues. Tolerant of both timestamp separators. */
function parseCues(text) {
  const clean = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const body = clean.replace(/^WEBVTT[^\n]*\n(NOTE[^\n]*\n)?/i, '');
  const blocks = body.split(/\n{2,}/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const timeIdx = lines.findIndex((l) => /-->/.test(l));
    if (timeIdx === -1) continue;

    const m = /([\d:,.]+)\s*-->\s*([\d:,.]+)/.exec(lines[timeIdx]);
    if (!m) continue;

    const start = parseTimecode(normalizeTc(m[1]));
    const end = parseTimecode(normalizeTc(m[2]));
    if (start === null || end === null || end <= start) continue;

    const textLines = lines.slice(timeIdx + 1)
      .map((l) => l.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean);
    if (!textLines.length) continue;

    cues.push({ start, end, text: textLines.join(' ') });
  }
  return cues.sort((a, b) => a.start - b.start);
}

/** "MM:SS.mmm" and "HH:MM:SS,mmm" both become "HH:MM:SS,mmm". */
function normalizeTc(tc) {
  let t = String(tc).trim().replace('.', ',');
  const parts = t.split(':');
  if (parts.length === 2) t = `00:${t}`;
  if (!/,/.test(t)) t += ',000';
  return t;
}

async function transcribe({ srtText }) {
  const cues = parseCues(srtText);
  const words = [];

  for (const cue of cues) {
    const toks = cue.text.split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const weights = toks.map((w) => 0.34 + syllables(w) * 0.62);
    const total = weights.reduce((a, b) => a + b, 0) || toks.length;
    const span = cue.end - cue.start;
    let t = cue.start;

    toks.forEach((w, i) => {
      const dur = (weights[i] / total) * span;
      words.push({
        word: w,
        clean: w.replace(/[^\p{L}\p{N}'$%\-]/gu, ''),
        start: round(t, 3),
        end: round(t + Math.max(0.08, dur * 0.92), 3),
        endsSentence: /[.!?…]$/.test(w),
        endsClause: /[,;:]$/.test(w),
      });
      t += dur;
    });
  }

  const { groupSentences } = require('./scriptAlign');
  return {
    words,
    text: words.map((w) => w.word).join(' '),
    sentences: groupSentences(words),
    approximate: false,
  };
}

module.exports = {
  name: 'srt',
  label: 'Imported subtitles (.srt / .vtt)',
  quality: 'exact — uses the timings in your file',
  isAvailable,
  transcribe,
  parseCues,
};
