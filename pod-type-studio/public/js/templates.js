// Six editable starting layouts. Text is PLACEHOLDER ONLY — he writes his own
// words. (A test fails if any template text is not one of these placeholders.)
import { textLayer as baseText, shapeLayer, SAFE_INSET } from './model.js';
import { layoutText } from './render.js';

export const PLACEHOLDERS = ['YOUR WORDS HERE', 'YOUR WORDS', 'YOUR WORD', 'YOUR', 'WORDS', 'HERE'];

// Fonts every template needs, so they can be loaded before measuring.
export const TEMPLATE_FONTS = [
  { family: 'Anton', weight: 400, italic: false },
  { family: 'Oswald', weight: 700, italic: false },
  { family: 'Montserrat', weight: 500, italic: false },
  { family: 'Montserrat', weight: 700, italic: false },
  { family: 'Alfa Slab One', weight: 400, italic: false },
  { family: 'Bebas Neue', weight: 400, italic: false },
];

const font = (family, weight = 400) => ({ family, weight, italic: false });

// Every template text layer is shrunk if needed so it starts inside the safe
// area — templates should never open with print warnings.
function textLayer(c, props) {
  const l = baseText(c, props);
  const max = c.width * (1 - 2 * SAFE_INSET) * 0.94;
  const b = layoutText(l).bbox;
  const w = b.x1 - b.x0 + (l.stroke.on ? 2 * l.stroke.width : 0);
  if (w > max) l.size = Math.floor((l.size * max) / w);
  return l;
}

// Set an arched layer's curve so its baseline sits on a circle of radius r,
// then move it so that circle is centered on (cx, cy).
function archOnCircle(layer, mode, r, cx, cy) {
  const straight = layoutText({ ...layer, arch: { mode: 'none', curve: 0 } });
  const sweepDeg = (straight.lines[0].width / r) * (180 / Math.PI);
  layer.arch = { mode, curve: Math.max(1, Math.min(100, (sweepDeg / 330) * 100)) };
  const lay = layoutText(layer);
  layer.x = cx - lay.arc.cx;
  layer.y = cy - lay.arc.cy;
  return layer;
}

// Stack layers vertically (by their real ink height) around the canvas center.
function stack(canvas, layers, gap) {
  const heights = layers.map((l) => {
    const b = layoutText(l).bbox;
    return b.y1 - b.y0;
  });
  const total = heights.reduce((a, b) => a + b, 0) + gap * (layers.length - 1);
  let y = canvas.height * 0.42 - total / 2;
  layers.forEach((l, i) => {
    l.y = y + heights[i] / 2;
    y += heights[i] + gap;
  });
  return layers;
}

export const TEMPLATES = [
  {
    id: 'stacked',
    name: 'Stacked statement',
    build(c) {
      const W = c.width;
      return stack(c, [
        textLayer(c, { name: 'Line 1', text: 'YOUR', font: font('Anton'), size: W * 0.22 }),
        textLayer(c, { name: 'Line 2', text: 'WORDS', font: font('Anton'), size: W * 0.16 }),
        textLayer(c, { name: 'Line 3', text: 'HERE', font: font('Anton'), size: W * 0.11 }),
      ], W * 0.03);
    },
  },
  {
    id: 'arch-top',
    name: 'Arch top + straight bottom',
    build(c) {
      const W = c.width;
      const arch = textLayer(c, { name: 'Arch', text: 'YOUR WORDS HERE', font: font('Alfa Slab One'), size: W * 0.085, letterSpacing: 40, arch: { mode: 'top', curve: 30 } });
      const lay = layoutText(arch);
      arch.y = c.height * 0.3;
      const bottom = textLayer(c, { name: 'Bottom', text: 'YOUR WORDS', font: font('Alfa Slab One'), size: W * 0.12 });
      const bb = layoutText(bottom).bbox;
      bottom.y = arch.y + lay.bbox.y1 + W * 0.04 - bb.y0;
      return [arch, bottom];
    },
  },
  {
    id: 'varsity',
    name: 'Varsity block',
    build(c) {
      const W = c.width;
      const word = textLayer(c, {
        name: 'Varsity word', text: 'YOUR WORDS', font: font('Oswald', 700), size: W * 0.17, letterSpacing: 20,
        stroke: { on: true, width: W * 0.006, color: '#c8102e' },
      });
      word.y = c.height * 0.38;
      const b = layoutText(word).bbox;
      const bar = shapeLayer(c, 'line', { name: 'Underline bar', w: (b.x1 - b.x0) * 0.95, h: W * 0.022, y: word.y + b.y1 + W * 0.05 });
      const small = textLayer(c, { name: 'Small line', text: 'YOUR WORDS HERE', font: font('Oswald', 700), size: W * 0.05, letterSpacing: 300 });
      const sb = layoutText(small).bbox;
      small.y = bar.y + bar.h / 2 + W * 0.045 - sb.y0;
      return [word, bar, small];
    },
  },
  {
    id: 'minimal',
    name: 'Minimal one-liner',
    build(c) {
      const t = textLayer(c, { name: 'One-liner', text: 'YOUR WORDS HERE', font: font('Montserrat', 500), size: c.width * 0.04, letterSpacing: 250 });
      t.y = c.height * 0.3;
      return [t];
    },
  },
  {
    id: 'badge',
    name: 'Circle badge',
    build(c) {
      const W = c.width;
      const cx = c.width / 2, cy = c.height * 0.42;
      const R = W * 0.36, ringW = W * 0.018, gap = W * 0.03;
      const ring = shapeLayer(c, 'ring', { name: 'Ring', r: R, x: cx, y: cy, stroke: { on: true, width: ringW, color: '#ffffff' }, fill: { on: false, color: '#ffffff' } });
      const inner = R - ringW - gap;
      const top = textLayer(c, { name: 'Top arch', text: 'YOUR WORDS HERE', font: font('Bebas Neue'), size: W * 0.075, letterSpacing: 80 });
      const capH = layoutText(top).lines[0].asc;
      archOnCircle(top, 'top', inner - capH, cx, cy);
      const bottom = textLayer(c, { name: 'Bottom arch', text: 'YOUR WORDS', font: font('Bebas Neue'), size: W * 0.06, letterSpacing: 80 });
      archOnCircle(bottom, 'bottom', inner, cx, cy);
      const center = textLayer(c, { name: 'Center word', text: 'YOUR WORD', font: font('Anton'), size: W * 0.09, x: cx, y: cy });
      return [ring, top, bottom, center];
    },
  },
  {
    id: 'split',
    name: 'Two-line split',
    build(c) {
      const W = c.width;
      return stack(c, [
        textLayer(c, { name: 'Big word', text: 'YOUR WORD', font: font('Anton'), size: W * 0.2 }),
        textLayer(c, { name: 'Small words', text: 'YOUR WORDS HERE', font: font('Montserrat', 700), size: W * 0.05, letterSpacing: 300 }),
      ], W * 0.035);
    },
  },
];
