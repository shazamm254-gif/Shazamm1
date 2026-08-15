'use strict';
/**
 * Caption chunks -> Advanced SubStation Alpha (.ass).
 *
 * ASS is the right target here: libass is compiled into FFmpeg, it renders
 * fast, and it supports exactly the things short-form captions need — per-word
 * colour, animated scale via \t, fades, moves, outlines and drop shadows. That
 * means the animation is produced by the renderer rather than baked into
 * thousands of overlay PNGs, and the burned-in result matches the preview.
 */

const config = require('../config');
const { assTime, srtTime, clamp } = require('../utils');
const { assColor, marginVFor, marginHFor } = require('./styles');

/** ASS special characters that must be escaped inside dialogue text. */
function escapeText(t) {
  return String(t)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, ' ');
}

/**
 * Greedy wrap returning groups of word indices — the ASS writer needs indices
 * (not joined strings) so it can attach per-word override tags.
 */
function wrapIndices(words, style) {
  const lines = [];
  let cur = [];
  let curLen = 0;
  for (let i = 0; i < words.length; i++) {
    const wLen = words[i].word.length;
    const candidate = curLen === 0 ? wLen : curLen + 1 + wLen;
    if (cur.length && candidate > style.maxCharsPerLine && lines.length < style.maxLines - 1) {
      lines.push(cur);
      cur = [i];
      curLen = wLen;
    } else {
      cur.push(i);
      curLen = candidate;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/** Emphasis level -> visual treatment, honouring the style's emphasis mode. */
function emphasisTags(word, style) {
  const level = word.emphasis;
  if (!level) return null;

  const strength = level === 'strong' ? 1 : 0.55;
  const scale = Math.round(100 + (style.emphasisScale - 1) * 100 * strength);
  const mode = style.emphasis;

  const tags = [];
  if (mode === 'color' || mode === 'scale-color') {
    tags.push(`\\c${assColor(style.accent)}`);
  }
  if (mode === 'scale-color' || mode === 'weight') {
    tags.push(`\\fscx${scale}\\fscy${scale}`);
  }
  if (mode === 'weight' && !style.bold) tags.push('\\b1');
  return tags.join('');
}

/** Reset back to the base style after an emphasised word. */
function resetTags(style) {
  const tags = [`\\c${assColor(style.primary)}`, '\\fscx100\\fscy100'];
  if (style.emphasis === 'weight' && !style.bold) tags.push('\\b0');
  return tags.join('');
}

/** Build the [V4+ Styles] block. */
function styleBlock(style, fontName, width, height) {
  const marginH = marginHFor(width);
  const marginV = marginVFor(style, height);
  const borderStyle = style.boxed ? 3 : 1;
  const outlineColour = style.boxed
    ? assColor(style.boxColor || '#000000', style.boxAlpha === undefined ? 0.25 : style.boxAlpha)
    : assColor(style.outline);
  const outlineWidth = style.boxed ? 22 : style.outlineWidth;

  const fields = [
    'Caption',                                   // Name
    fontName,                                    // Fontname
    Math.round(style.fontSize),                  // Fontsize
    assColor(style.primary),                     // PrimaryColour
    assColor(style.accent),                      // SecondaryColour
    outlineColour,                               // OutlineColour
    assColor(style.shadowColor || '#000000', 0.35), // BackColour (shadow)
    style.bold ? -1 : 0,                         // Bold
    0,                                           // Italic
    0, 0,                                        // Underline, StrikeOut
    100, 100,                                    // ScaleX, ScaleY
    style.spacing || 0,                          // Spacing
    0,                                           // Angle
    borderStyle,
    outlineWidth,
    style.shadow || 0,
    2,                                           // Alignment: bottom-centre
    marginH, marginH, marginV,
    1,                                           // Encoding
  ];
  return `Style: ${fields.join(',')}`;
}

/** Leading override tags that animate the whole card in. */
function animationTags(style, chunk, width, height) {
  const fadeIn = 90;
  const fadeOut = 90;
  switch (style.animation) {
    case 'pop':
      return `\\fad(${fadeIn},${fadeOut})\\fscx78\\fscy78\\t(0,120,\\fscx104\\fscy104)\\t(120,190,\\fscx100\\fscy100)`;
    case 'slide': {
      const x = Math.round(width / 2);
      const y = Math.round(height - marginVFor(style, height));
      return `\\fad(70,${fadeOut})\\move(${x},${y + 46},${x},${y},0,170)`;
    }
    case 'kinetic':
      return `\\fad(50,70)`;
    case 'fade':
    default:
      return `\\fad(${fadeIn},${fadeOut})`;
  }
}

/**
 * Render one chunk as one or more Dialogue lines.
 *
 * Kinetic styles emit one event per word onset: each event shows the whole card
 * with the words spoken so far at full opacity, the words still to come dimmed,
 * and the word that just landed popping in. Because every event restarts its
 * own \t timeline, the pop always fires exactly on the word.
 */
function chunkEvents(chunk, style, width, height) {
  const events = [];
  const lines = wrapIndices(chunk.words, style);
  const base = animationTags(style, chunk, width, height);

  const renderWord = (i, { spoken = true, isNew = false }) => {
    const w = chunk.words[i];
    const text = escapeText(w.word);
    const emph = emphasisTags(w, style);

    let open = '';
    let close = '';

    if (!spoken && style.dimUnspoken) {
      open += `\\alpha&H8C&`;
      close += `\\alpha&H00&`;
    }
    if (emph) {
      open += emph;
      close += resetTags(style);
    }
    if (isNew) {
      // Land the word: quick overshoot back to its resting scale.
      const rest = emph && (style.emphasis === 'scale-color' || style.emphasis === 'weight')
        ? Math.round(100 + (style.emphasisScale - 1) * 100 * (w.emphasis === 'strong' ? 1 : 0.55))
        : 100;
      open += `\\fscx${Math.round(rest * 0.62)}\\fscy${Math.round(rest * 0.62)}\\t(0,110,\\fscx${Math.round(rest * 1.06)}\\fscy${Math.round(rest * 1.06)})\\t(110,180,\\fscx${rest}\\fscy${rest})`;
    }

    if (!open) return text;
    return `{${open}}${text}${close ? `{${close}}` : ''}`;
  };

  const assemble = (renderFn) => lines
    .map((lineIdx) => lineIdx.map(renderFn).join(' '))
    .join('\\N');

  if (style.wordByWord && chunk.words.length > 1) {
    for (let i = 0; i < chunk.words.length; i++) {
      const start = i === 0 ? chunk.start : chunk.words[i].start;
      const end = i === chunk.words.length - 1 ? chunk.end : chunk.words[i + 1].start;
      if (end - start < 0.02) continue;

      const text = assemble((idx) => renderWord(idx, {
        spoken: idx <= i,
        isNew: idx === i,
      }));
      // Only the first event of the card fades in; the rest cut, or the card
      // would pulse on every word.
      const tags = i === 0 ? base : '';
      events.push({ start, end, text: tags ? `{${tags}}${text}` : text });
    }
  } else {
    const text = assemble((idx) => renderWord(idx, { spoken: true, isNew: false }));
    events.push({ start: chunk.start, end: chunk.end, text: `{${base}}${text}` });
  }

  return events;
}

/**
 * Full .ass document.
 * @param {Array}  chunks caption chunks (already emphasised)
 * @param {object} style  style descriptor
 */
function build(chunks, style, { width = config.video.width, height = config.video.height, fontName = null } = {}) {
  const font = fontName || config.font.family || 'DejaVu Sans';

  const header = [
    '[Script Info]',
    'Title: AUTO SHORTS captions',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    `PlayResX: ${config.video.width}`,
    `PlayResY: ${config.video.height}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    styleBlock(style, font, config.video.width, config.video.height),
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const events = [];
  for (const chunk of chunks) {
    for (const ev of chunkEvents(chunk, style, config.video.width, config.video.height)) {
      if (ev.end <= ev.start) continue;
      events.push(`Dialogue: 0,${assTime(ev.start)},${assTime(ev.end)},Caption,,0,0,0,,${ev.text}`);
    }
  }

  return `${header.join('\n')}\n${events.join('\n')}\n`;
}

/** Plain .srt of the same chunks — handy for uploading alongside the video. */
function buildSrt(chunks) {
  return chunks.map((c, i) => (
    `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`
  )).join('\n');
}

module.exports = { build, buildSrt, wrapIndices, escapeText };
