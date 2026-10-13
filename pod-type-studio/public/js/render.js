// The ONE renderer. The editor and the PNG export both call renderDesign();
// only the scale/offset differ. Every effect is real canvas drawing, so what
// is on screen is what gets printed.
//
// Coordinates: layers live in "design px" — real print-area pixels. A view
// maps design px -> device px with (scale, offsetX, offsetY).

const layoutCache = new Map();
let measureCtx = null;

function mctx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

export function fontString(font, size) {
  return `${font.italic ? 'italic ' : ''}${font.weight} ${size}px "${font.family}"`;
}

export function displayText(layer) {
  return layer.caps ? layer.text.toUpperCase() : layer.text;
}

// Call after a web font finishes loading so cached measurements are redone.
export function clearLayoutCache() {
  layoutCache.clear();
}

// ---- text layout ------------------------------------------------------------

// Returns glyph placements in the layer's local space (origin = bbox center,
// before rotation), plus the bbox. Pure function of the text-related props.
export function layoutText(layer) {
  const key = JSON.stringify([layer.text, layer.caps, layer.font, layer.size, layer.align, layer.letterSpacing, layer.lineHeight, layer.arch]);
  const hit = layoutCache.get(key);
  if (hit) return hit;

  const ctx = mctx();
  ctx.font = fontString(layer.font, layer.size);
  ctx.fontKerning = 'normal';
  const spacing = (layer.letterSpacing / 1000) * layer.size;
  const lineStep = layer.lineHeight * layer.size;
  const lines = displayText(layer).split('\n');

  const measured = lines.map((line) => {
    const chars = [...line];
    const xs = [];
    let prefix = '';
    for (let i = 0; i < chars.length; i++) {
      // Kerned position of char i = width of everything before it.
      xs.push(ctx.measureText(prefix).width + i * spacing);
      prefix += chars[i];
    }
    const full = ctx.measureText(line);
    const width = chars.length ? full.width + (chars.length - 1) * spacing : 0;
    const glyphs = chars.map((ch, i) => {
      const next = i + 1 < chars.length ? xs[i + 1] - spacing : full.width + (chars.length - 1) * spacing;
      const m = ctx.measureText(ch);
      return {
        ch,
        x: xs[i],
        adv: next - xs[i],
        asc: m.actualBoundingBoxAscent,
        desc: m.actualBoundingBoxDescent,
        left: m.actualBoundingBoxLeft,
        right: m.actualBoundingBoxRight,
      };
    });
    return { text: line, chars, width, glyphs, asc: full.actualBoundingBoxAscent, desc: full.actualBoundingBoxDescent };
  });

  const curve = layer.arch && layer.arch.mode !== 'none' ? layer.arch.curve : 0;
  const placed = []; // {ch, x, y, rot} with baseline-left origin per glyph
  const blockW = Math.max(0, ...measured.map((l) => l.width));
  let arc = null; // circle center + baseline radius of the first line, when arched

  if (!curve) {
    measured.forEach((line, k) => {
      const shift = layer.align === 'left' ? 0 : layer.align === 'right' ? blockW - line.width : (blockW - line.width) / 2;
      const y = k * lineStep;
      line.glyphs.forEach((g) => placed.push({ ...g, x: g.x + shift, y, rot: 0, whole: line }));
    });
  } else {
    // Arch: glyphs ride a circle. The sweep grows with `curve` (0..100 maps
    // to 0..330 degrees) and the radius keeps the arc length = text width.
    const firstW = Math.max(1, measured[0].width || blockW || 1);
    const sweep = (Math.min(100, Math.max(1, curve)) / 100) * (330 * Math.PI) / 180;
    const R = firstW / sweep;
    const top = layer.arch.mode === 'top';
    arc = { cx: 0, cy: top ? R : -R, r: R };
    measured.forEach((line, k) => {
      const Rk = top ? Math.max(1, R - k * lineStep) : R + k * lineStep;
      line.glyphs.forEach((g) => {
        const center = g.x + g.adv / 2 - line.width / 2; // arc length from the apex
        const phi = center / Rk;
        // Top arch (rainbow): circle center below. Bottom arch (smile): above,
        // letters upright with their tops toward the center (badge style).
        const cx = Rk * Math.sin(phi);
        const cy = top ? R - Rk * Math.cos(phi) : Rk * Math.cos(phi) - R;
        placed.push({ ...g, cx, cy, rot: top ? phi : -phi, arched: true });
      });
    });
  }

  // Bounding box from each glyph's real ink box, rotated where arched.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x, y) => {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  };
  for (const g of placed) {
    if (!g.ch.trim()) continue;
    if (g.arched) {
      const cos = Math.cos(g.rot), sin = Math.sin(g.rot);
      const ox = -g.adv / 2;
      for (const [px, py] of [[ox - g.left, -g.asc], [ox + g.right, -g.asc], [ox - g.left, g.desc], [ox + g.right, g.desc]]) {
        grow(g.cx + px * cos - py * sin, g.cy + px * sin + py * cos);
      }
    } else {
      grow(g.x - g.left, g.y - g.asc);
      grow(g.x + g.right, g.y + g.desc);
    }
  }
  if (!isFinite(x0)) {
    // Empty / whitespace-only text: a small box so it can still be selected.
    x0 = 0; y0 = -layer.size * 0.7; x1 = Math.max(blockW, layer.size * 0.5); y1 = 0;
  }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  for (const g of placed) {
    if (g.arched) { g.cx -= mx; g.cy -= my; } else { g.x -= mx; g.y -= my; }
  }
  const out = {
    glyphs: placed,
    lines: measured,
    spacing,
    bbox: { x0: x0 - mx, y0: y0 - my, x1: x1 - mx, y1: y1 - my },
    arc: arc && { cx: arc.cx - mx, cy: arc.cy - my, r: arc.r },
    width: blockW,
  };
  if (layoutCache.size > 400) layoutCache.clear();
  layoutCache.set(key, out);
  return out;
}

// ---- local bounding boxes -------------------------------------------------------

// Ink bounds in local (unrotated) layer space, including outline width.
export function localBounds(layer) {
  if (layer.type === 'text') {
    const { bbox } = layoutText(layer);
    const pad = layer.stroke?.on ? layer.stroke.width : 0;
    return { x0: bbox.x0 - pad, y0: bbox.y0 - pad, x1: bbox.x1 + pad, y1: bbox.y1 + pad };
  }
  if (layer.shape === 'line') {
    const half = layer.h / 2;
    return { x0: -layer.w / 2 - (layer.cap === 'round' ? half : 0), y0: -half, x1: layer.w / 2 + (layer.cap === 'round' ? half : 0), y1: half };
  }
  if (layer.shape === 'ring') return { x0: -layer.r, y0: -layer.r, x1: layer.r, y1: layer.r };
  return { x0: -layer.w / 2, y0: -layer.h / 2, x1: layer.w / 2, y1: layer.h / 2 };
}

// Corners of the layer in design space (after rotation + position).
export function layerCorners(layer) {
  const b = localBounds(layer);
  const a = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => [layer.x + x * cos - y * sin, layer.y + x * sin + y * cos]);
}

// Design-space bounds including the drop shadow (used for safe-area checks).
export function designBounds(layer) {
  const pts = layerCorners(layer);
  if (layer.type === 'text' && layer.shadow?.on) {
    const { dx, dy, blur } = layer.shadow;
    for (const [x, y] of layerCorners(layer)) {
      pts.push([x + dx - blur, y + dy - blur], [x + dx + blur, y + dy + blur]);
    }
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export function hitTest(layer, x, y, slop = 0) {
  const a = (-layer.rotation * Math.PI) / 180;
  const dx = x - layer.x, dy = y - layer.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  const b = localBounds(layer);
  return lx >= b.x0 - slop && lx <= b.x1 + slop && ly >= b.y0 - slop && ly <= b.y1 + slop;
}

// ---- painting -------------------------------------------------------------------

function fillStyleFor(ctx, layer, override) {
  if (override) return override;
  const f = layer.fill;
  if (f.type === 'solid') return f.color;
  const b = localBounds(layer);
  const a = (f.angle * Math.PI) / 180;
  const hw = (b.x1 - b.x0) / 2, hh = (b.y1 - b.y0) / 2;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const L = Math.abs(hw * Math.cos(a)) + Math.abs(hh * Math.sin(a)) || 1;
  const g = ctx.createLinearGradient(cx - L * Math.cos(a), cy - L * Math.sin(a), cx + L * Math.cos(a), cy + L * Math.sin(a));
  if (f.type === 'gradient') {
    g.addColorStop(0, f.color);
    g.addColorStop(1, f.color2);
  } else {
    // Two-color split: hard stop at `split` percent along the angle.
    const p = Math.min(1, Math.max(0, f.split / 100));
    g.addColorStop(0, f.color);
    g.addColorStop(p, f.color);
    g.addColorStop(p, f.color2);
    g.addColorStop(1, f.color2);
  }
  return g;
}

function eachGlyph(ctx, lay, fn) {
  for (const g of lay.glyphs) {
    if (!g.ch.trim()) continue;
    if (g.arched) {
      ctx.save();
      ctx.translate(g.cx, g.cy);
      ctx.rotate(g.rot);
      fn(g.ch, -g.adv / 2, 0);
      ctx.restore();
    } else {
      fn(g.ch, g.x, g.y);
    }
  }
}

function paintText(ctx, layer, override) {
  const lay = layoutText(layer);
  ctx.font = fontString(layer.font, layer.size);
  ctx.fontKerning = 'normal';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const draw = (op) => {
    const wholeLines = !layer.arch || layer.arch.mode === 'none' ? lay.spacing === 0 : false;
    if (wholeLines) {
      // No tracking and no arch: draw each line in one call to keep kerning/ligatures.
      const seen = new Set();
      for (const g of lay.glyphs) {
        if (seen.has(g.whole)) continue;
        seen.add(g.whole);
        op(g.whole.text, g.x, g.y);
      }
    } else {
      eachGlyph(ctx, lay, op);
    }
  };
  if (layer.stroke?.on && layer.stroke.width > 0) {
    // Outline is drawn first at double width so it sits outside the letters
    // instead of eating into them.
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = layer.stroke.width * 2;
    ctx.strokeStyle = override || layer.stroke.color;
    draw((t, x, y) => ctx.strokeText(t, x, y));
  }
  ctx.fillStyle = fillStyleFor(ctx, layer, override);
  draw((t, x, y) => ctx.fillText(t, x, y));
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintShape(ctx, layer, override) {
  if (layer.shape === 'line') {
    ctx.beginPath();
    ctx.moveTo(-layer.w / 2, 0);
    ctx.lineTo(layer.w / 2, 0);
    ctx.lineWidth = layer.h;
    ctx.lineCap = layer.cap === 'round' ? 'round' : 'butt';
    ctx.strokeStyle = override || layer.fill.color;
    ctx.stroke();
    return;
  }
  if (layer.shape === 'ring') {
    if (layer.fill.on) {
      ctx.beginPath();
      ctx.arc(0, 0, layer.r, 0, Math.PI * 2);
      ctx.fillStyle = override || layer.fill.color;
      ctx.fill();
    }
    if (layer.stroke.on && layer.stroke.width > 0) {
      const sw = Math.min(layer.stroke.width, layer.r);
      ctx.beginPath();
      ctx.arc(0, 0, layer.r - sw / 2, 0, Math.PI * 2); // outer edge stays at r
      ctx.lineWidth = sw;
      ctx.strokeStyle = override || layer.stroke.color;
      ctx.stroke();
    }
    return;
  }
  const { w, h } = layer;
  if (layer.fill.on) {
    roundRectPath(ctx, -w / 2, -h / 2, w, h, layer.radius || 0);
    ctx.fillStyle = override || layer.fill.color;
    ctx.fill();
  }
  if (layer.stroke.on && layer.stroke.width > 0) {
    const sw = Math.min(layer.stroke.width, w / 2, h / 2);
    roundRectPath(ctx, -w / 2 + sw / 2, -h / 2 + sw / 2, w - sw, h - sw, Math.max(0, (layer.radius || 0) - sw / 2));
    ctx.lineWidth = sw;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = override || layer.stroke.color;
    ctx.stroke();
  }
}

function paintLayer(ctx, layer) {
  if (layer.type === 'text') paintText(ctx, layer);
  else paintShape(ctx, layer);
}

function applyLayerTransform(ctx, view, layer) {
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
}

function deviceRect(view, layer, clip) {
  const pts = layerCorners(layer).map(([x, y]) => [x * view.scale + view.offsetX, y * view.scale + view.offsetY]);
  const pad = 4;
  let x0 = Math.floor(Math.min(...pts.map((p) => p[0])) - pad);
  let y0 = Math.floor(Math.min(...pts.map((p) => p[1])) - pad);
  let x1 = Math.ceil(Math.max(...pts.map((p) => p[0])) + pad);
  let y1 = Math.ceil(Math.max(...pts.map((p) => p[1])) + pad);
  x0 = Math.max(x0, clip.x0); y0 = Math.max(y0, clip.y0);
  x1 = Math.min(x1, clip.x1); y1 = Math.min(y1, clip.y1);
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Draw one layer. A layer with a shadow or partial opacity is first painted
// into its own buffer so outline + fill composite as one shape; the buffer is
// then drawn with the canvas shadow (device px = design px * scale, so the
// shadow scales exactly like everything else).
function drawLayer(ctx, view, layer, clip) {
  const shadow = layer.type === 'text' && layer.shadow?.on ? layer.shadow : null;
  const opacity = layer.opacity ?? 1;
  if (!shadow && opacity >= 1) {
    ctx.save();
    applyLayerTransform(ctx, view, layer);
    paintLayer(ctx, layer);
    ctx.restore();
    return;
  }
  // Grow the clip so a shadow cast from off-screen ink still shows.
  const r = deviceRect(view, layer, shadow ? {
    x0: clip.x0 - Math.abs(shadow.dx * view.scale) - shadow.blur * view.scale * 2,
    y0: clip.y0 - Math.abs(shadow.dy * view.scale) - shadow.blur * view.scale * 2,
    x1: clip.x1 + Math.abs(shadow.dx * view.scale) + shadow.blur * view.scale * 2,
    y1: clip.y1 + Math.abs(shadow.dy * view.scale) + shadow.blur * view.scale * 2,
  } : clip);
  if (r.w <= 0 || r.h <= 0) return;
  const buf = makeCanvas(r.w, r.h);
  const b = buf.getContext('2d');
  applyLayerTransform(b, { scale: view.scale, offsetX: view.offsetX - r.x0, offsetY: view.offsetY - r.y0 }, layer);
  paintLayer(b, layer);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = opacity;
  if (shadow) {
    ctx.shadowColor = hexToRgba(shadow.color, shadow.opacity);
    ctx.shadowOffsetX = shadow.dx * view.scale;
    ctx.shadowOffsetY = shadow.dy * view.scale;
    ctx.shadowBlur = shadow.blur * view.scale;
  }
  ctx.drawImage(buf, r.x0, r.y0);
  ctx.restore();
}

export function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Render the artwork only (no background, no guides). The caller clears the
// canvas first; export leaves it transparent.
export function renderDesign(ctx, design, view, clip) {
  const c = clip || { x0: 0, y0: 0, x1: ctx.canvas.width, y1: ctx.canvas.height };
  // Clip to the print area: anything outside it is not printed.
  ctx.save();
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
  ctx.beginPath();
  ctx.rect(0, 0, design.canvas.width, design.canvas.height);
  ctx.clip();
  for (const layer of design.layers) {
    if (layer.hidden) continue;
    drawLayer(ctx, view, layer, c);
  }
  ctx.restore();
}

// Full-size, transparent PNG at the exact print-area pixel size.
export async function exportPng(design) {
  const { width, height } = design.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This phone could not create a canvas that large.');
  renderDesign(ctx, design, { scale: 1, offsetX: 0, offsetY: 0 });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  canvas.width = canvas.height = 0; // free the memory right away on phones
  if (!blob) throw new Error('The PNG export failed — the phone may be low on memory. Close other tabs and try again.');
  return blob;
}

export function renderThumbnail(design, maxSide = 360, { transparent = false } = {}) {
  const { width, height } = design.canvas;
  const s = maxSide / Math.max(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * s);
  canvas.height = Math.round(height * s);
  const ctx = canvas.getContext('2d');
  if (!transparent) {
    ctx.fillStyle = design.preview?.color || '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  renderDesign(ctx, design, { scale: s, offsetX: 0, offsetY: 0 });
  return transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.8);
}
