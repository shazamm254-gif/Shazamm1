// Design document model. A design is plain JSON so it can be saved to the
// phone (IndexedDB) and exported/imported as a .json file without loss.
import { designBounds } from './render.js';

export const APP_ID = 'pod-type-studio';
export const DESIGN_VERSION = 1;

// Printify recommends 300 DPI artwork; the print-area pixels from the API are
// at that resolution. Used only to turn pixels into inches for warnings.
export const PRINT_DPI = 300;
// Text whose em size is under ~1/4 inch gets hard to read on a shirt.
export const MIN_READABLE_PX = Math.round(PRINT_DPI * 0.25);
// Keep artwork this far inside the print area edge (app guideline, not a Printify value).
export const SAFE_INSET = 0.05;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newDesign({ width, height, product = null, provisional = false, name = 'Untitled design' }) {
  const now = new Date().toISOString();
  return {
    app: APP_ID,
    version: DESIGN_VERSION,
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    canvas: { width, height, provisional, product },
    preview: { color: '#111111', name: 'Black' },
    layers: [],
  };
}

export function textLayer(canvas, props = {}) {
  return {
    id: uid(),
    type: 'text',
    name: 'Text',
    hidden: false,
    x: canvas.width / 2,
    y: canvas.height / 2,
    rotation: 0,
    opacity: 1,
    text: 'YOUR WORDS HERE',
    font: { family: 'Anton', weight: 400, italic: false },
    size: Math.round(canvas.width * 0.09),
    caps: true,
    align: 'center',
    letterSpacing: 0,
    lineHeight: 1.1,
    fill: { type: 'solid', color: '#ffffff', color2: '#ff3b30', angle: 90, split: 50 },
    stroke: { on: false, width: Math.round(canvas.width * 0.004), color: '#000000' },
    shadow: { on: false, color: '#000000', opacity: 0.6, dx: Math.round(canvas.width * 0.006), dy: Math.round(canvas.width * 0.006), blur: 0 },
    arch: { mode: 'none', curve: 35 },
    ...props,
  };
}

export function shapeLayer(canvas, shape, props = {}) {
  const w = canvas.width;
  const base = {
    id: uid(),
    type: 'shape',
    shape,
    name: shape === 'line' ? 'Line' : shape === 'ring' ? 'Circle' : 'Rectangle',
    hidden: false,
    x: canvas.width / 2,
    y: canvas.height / 2,
    rotation: 0,
    opacity: 1,
    w: Math.round(w * 0.6),
    h: shape === 'line' ? Math.round(w * 0.012) : Math.round(w * 0.3),
    r: Math.round(w * 0.3),
    radius: 0,
    cap: 'butt',
    fill: { on: shape !== 'ring' && shape !== 'rect', color: '#ffffff' },
    stroke: { on: shape !== 'line', width: Math.round(w * 0.012), color: '#ffffff' },
  };
  return { ...base, ...props };
}

export function duplicateLayer(layer) {
  const copy = structuredClone(layer);
  copy.id = uid();
  copy.x += 40;
  copy.y += 40;
  copy.name = `${layer.name} copy`;
  return copy;
}

// Rescale a design to a new print area (e.g. after switching product). Keeps
// proportions: uniform scale to fit, centered. Sizes scale; em-based tracking doesn't.
export function resizeDesign(design, width, height) {
  const { width: ow, height: oh } = design.canvas;
  const k = Math.min(width / ow, height / oh);
  const dx = (width - ow * k) / 2, dy = (height - oh * k) / 2;
  for (const l of design.layers) {
    l.x = l.x * k + dx;
    l.y = l.y * k + dy;
    if (l.type === 'text') {
      l.size = round2(l.size * k);
      l.stroke.width = round2(l.stroke.width * k);
      l.shadow.dx = round2(l.shadow.dx * k);
      l.shadow.dy = round2(l.shadow.dy * k);
      l.shadow.blur = round2(l.shadow.blur * k);
    } else {
      l.w = round2(l.w * k);
      l.h = round2(l.h * k);
      l.r = round2(l.r * k);
      l.radius = round2(l.radius * k);
      l.stroke.width = round2(l.stroke.width * k);
    }
  }
  design.canvas.width = width;
  design.canvas.height = height;
}

const round2 = (n) => Math.round(n * 100) / 100;

export function safeRect(canvas) {
  const ix = canvas.width * SAFE_INSET, iy = canvas.height * SAFE_INSET;
  return { x0: ix, y0: iy, x1: canvas.width - ix, y1: canvas.height - iy };
}

export function isEmpty(design) {
  return !design.layers.some((l) => !l.hidden && (l.type !== 'text' || l.text.trim()));
}

// Warnings never block — they just tell him what will print badly.
export function warningsFor(design, fontProblems = []) {
  const out = [];
  const safe = safeRect(design.canvas);
  for (const l of design.layers) {
    if (l.hidden) continue;
    const b = designBounds(l);
    const label = l.type === 'text' ? `"${(l.text.split('\n')[0] || '').slice(0, 24)}"` : l.name;
    if (b.x0 < 0 || b.y0 < 0 || b.x1 > design.canvas.width || b.y1 > design.canvas.height)
      out.push({ layerId: l.id, kind: 'outside', text: `${label} goes past the print area edge — that part will be cut off.` });
    else if (b.x0 < safe.x0 || b.y0 < safe.y0 || b.x1 > safe.x1 || b.y1 > safe.y1)
      out.push({ layerId: l.id, kind: 'safe', text: `${label} is outside the safe area — it may print too close to the edge.` });
    if (l.type === 'text' && l.text.trim() && l.size < MIN_READABLE_PX)
      out.push({ layerId: l.id, kind: 'small', text: `${label} is ${(l.size / PRINT_DPI).toFixed(2)}" tall at print size — likely unreadable on a shirt.` });
  }
  for (const f of fontProblems) out.push({ kind: 'font', text: f });
  if (design.canvas.provisional)
    out.push({ kind: 'size', text: 'No Printify product picked yet — the canvas size is provisional. Pick a product to lock the real print area.' });
  return out;
}

// ---- import / export --------------------------------------------------------

export function exportDesignJson(design) {
  // Designs contain only artwork data — no tokens, no server settings.
  return JSON.stringify({ ...design, exportedAt: new Date().toISOString() }, null, 2);
}

export function parseDesignJson(text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (d?.app !== APP_ID || !d.canvas || !Array.isArray(d.layers)) throw new Error('That file is not a POD Type Studio design.');
  if (d.version > DESIGN_VERSION) throw new Error('That design was saved by a newer version of the app.');
  if (!(d.canvas.width > 0 && d.canvas.height > 0)) throw new Error('The design has no canvas size.');
  for (const l of d.layers) {
    if (l.type !== 'text' && l.type !== 'shape') throw new Error(`Unknown layer type "${l.type}".`);
  }
  delete d.exportedAt;
  return d;
}
