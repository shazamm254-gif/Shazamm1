'use strict';
/**
 * Caption style definitions.
 *
 * One definition drives both outputs, which is what keeps the browser preview
 * honest: the ASS generator reads it to build the burned-in subtitles, and the
 * frontend canvas renderer reads the same numbers over the API to draw the
 * preview. If a style changes, both change together.
 *
 * Geometry is expressed against the 1080x1920 canvas and scaled at render time,
 * so a 720p export looks identical to a 1080p one.
 */

/**
 * Safe zones for vertical short-form. The bottom strip is where TikTok,
 * Reels and Shorts stack their own UI (caption text, handle, action rail), and
 * the top strip collects the platform chrome. Captions never enter either.
 */
const SAFE = {
  top: 0.14,        // fraction of height reserved at the top
  bottom: 0.19,     // fraction of height reserved at the bottom
  side: 0.075,      // fraction of width reserved on each side
};

/** #RRGGBB -> ASS &HAABBGGRR (alpha 00 = opaque). */
function assColor(hex, alpha = 0) {
  const h = String(hex).replace('#', '').trim();
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

const STYLES = {
  clean: {
    id: 'clean',
    label: 'Clean',
    description: 'Large bold white text. Nothing moves except a soft pop on each new line.',
    fontSize: 92,
    lineSpacing: 8,
    bold: true,
    uppercase: true,
    primary: '#FFFFFF',
    accent: '#FFFFFF',
    outline: '#0A0A0A',
    outlineWidth: 6,
    shadow: 3,
    shadowColor: '#000000',
    boxed: false,
    position: 0.70,          // vertical centre of the caption block, 0=top 1=bottom
    maxCharsPerLine: 20,
    maxLines: 2,
    maxWordsPerChunk: 6,
    animation: 'pop',        // whole chunk scales in
    emphasis: 'weight',      // emphasised words get size only
    emphasisScale: 1.12,
    wordByWord: false,
  },

  highlight: {
    id: 'highlight',
    label: 'Highlight',
    description: 'White text with an accent colour on the words that carry the sentence.',
    fontSize: 90,
    lineSpacing: 8,
    bold: true,
    uppercase: true,
    primary: '#FFFFFF',
    accent: '#FFDA22',
    outline: '#0A0A0A',
    outlineWidth: 6,
    shadow: 3,
    shadowColor: '#000000',
    boxed: false,
    position: 0.70,
    maxCharsPerLine: 20,
    maxLines: 2,
    maxWordsPerChunk: 6,
    animation: 'fade',
    emphasis: 'color',
    emphasisScale: 1.14,
    wordByWord: false,
  },

  kinetic: {
    id: 'kinetic',
    label: 'Kinetic Retention',
    description: 'Words land as they are spoken, with the emphasis words scaling and taking the accent colour. The default.',
    fontSize: 96,
    lineSpacing: 10,
    bold: true,
    uppercase: true,
    primary: '#FFFFFF',
    accent: '#4DE1FF',
    outline: '#08090C',
    outlineWidth: 7,
    shadow: 4,
    shadowColor: '#000000',
    boxed: false,
    position: 0.68,
    maxCharsPerLine: 18,
    maxLines: 2,
    maxWordsPerChunk: 5,
    animation: 'kinetic',    // per-word reveal driven by word timings
    emphasis: 'scale-color',
    emphasisScale: 1.22,
    wordByWord: true,
    dimUnspoken: true,       // words not yet spoken sit dimmed rather than absent
  },

  minimal: {
    id: 'minimal',
    label: 'Minimal',
    description: 'Small, elegant, low on the frame. Gets out of the way of the footage.',
    fontSize: 56,
    lineSpacing: 6,
    bold: false,
    uppercase: false,
    primary: '#F5F5F5',
    accent: '#F5F5F5',
    outline: '#000000',
    outlineWidth: 3,
    shadow: 2,
    shadowColor: '#000000',
    boxed: false,
    position: 0.80,
    maxCharsPerLine: 32,
    maxLines: 2,
    maxWordsPerChunk: 9,
    animation: 'fade',
    emphasis: 'weight',
    emphasisScale: 1.06,
    wordByWord: false,
  },

  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Restrained, wide-tracked type with a warm accent. Built for dark and documentary content.',
    fontSize: 68,
    lineSpacing: 8,
    bold: true,
    uppercase: true,
    primary: '#EDE7DC',
    accent: '#E4A853',
    outline: '#000000',
    outlineWidth: 4,
    shadow: 4,
    shadowColor: '#000000',
    boxed: false,
    spacing: 3,              // letter tracking
    position: 0.76,
    maxCharsPerLine: 24,
    maxLines: 2,
    maxWordsPerChunk: 7,
    animation: 'fade',
    emphasis: 'color',
    emphasisScale: 1.08,
    wordByWord: false,
  },

  news: {
    id: 'news',
    label: 'News',
    description: 'Boxed headline captions with a hard accent bar. Reads fast, scans faster.',
    fontSize: 82,
    lineSpacing: 6,
    bold: true,
    uppercase: true,
    primary: '#FFFFFF',
    accent: '#FF3B30',
    outline: '#000000',
    outlineWidth: 0,
    shadow: 0,
    shadowColor: '#000000',
    boxed: true,             // opaque box behind the text instead of an outline
    boxColor: '#0B0B0F',
    boxAlpha: 0.22,
    position: 0.66,
    maxCharsPerLine: 20,
    maxLines: 2,
    maxWordsPerChunk: 6,
    animation: 'slide',
    emphasis: 'color',
    emphasisScale: 1.10,
    wordByWord: false,
  },
};

const DEFAULT_STYLE = 'kinetic';

/**
 * Average glyph advance as a fraction of the font size.
 *
 * The chunker breaks lines by character count, but characters are not the unit
 * that overflows — pixels are. A 96px bold uppercase line of 18 characters is
 * wider than the safe area, and libass would then wrap it a second time,
 * pushing a two-line card onto three lines and out of position. Estimating the
 * advance lets the declared character budget be capped at what actually fits.
 *
 * The constants are for the DejaVu/Liberation-class sans faces this ships with.
 * They are deliberately a little conservative: breaking a line one word early
 * is invisible, breaking it one word late is not.
 */
function charWidthRatio(style) {
  let ratio = style.bold ? 0.615 : 0.545;
  if (style.uppercase) ratio *= 1.075;
  if (style.spacing) ratio += style.spacing / style.fontSize;
  return ratio;
}

/** Characters that fit on one line inside the safe area, at this font size. */
function fitCharsPerLine(style, width = 1080) {
  const usable = width - 2 * marginHFor(width);
  return Math.max(8, Math.floor(usable / (style.fontSize * charWidthRatio(style))));
}

function getStyle(idOrName) {
  const base = STYLES[idOrName] || STYLES[DEFAULT_STYLE];
  // Never let the declared budget exceed what the frame can actually hold.
  return { ...base, maxCharsPerLine: Math.min(base.maxCharsPerLine, fitCharsPerLine(base)) };
}

/** Vertical margin from the bottom of the frame, in canvas pixels. */
function marginVFor(style, height = 1920) {
  const centre = height * style.position;
  const fromBottom = height - centre;
  const minBottom = height * SAFE.bottom;
  return Math.round(Math.max(minBottom, fromBottom));
}

/** Horizontal margin in canvas pixels. */
function marginHFor(width = 1080) {
  return Math.round(width * SAFE.side);
}

/** Everything the frontend needs to draw a matching preview. */
function toPreviewPayload() {
  const out = {};
  for (const k of Object.keys(STYLES)) {
    const s = getStyle(k);
    out[k] = {
      ...s,
      safe: SAFE,
      marginV: marginVFor(s),
      marginH: marginHFor(),
      charWidthRatio: charWidthRatio(s),
    };
  }
  return out;
}

function list() {
  return Object.values(STYLES).map((s) => ({
    id: s.id, label: s.label, description: s.description, accent: s.accent,
  }));
}

module.exports = {
  STYLES, SAFE, DEFAULT_STYLE, getStyle, assColor,
  marginVFor, marginHFor, toPreviewPayload, list,
  charWidthRatio, fitCharsPerLine,
};
