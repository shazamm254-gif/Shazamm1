// The editor screen: canvas view + touch interactions + undo/redo + autosave.
import { h, clear, fill, toast, dialog, promptText, downloadBlob, safeFileName, errorBox } from './ui.js';
import { renderDesign, layerCorners, hitTest, exportPng, renderThumbnail } from './render.js';
import { textLayer, shapeLayer, duplicateLayer, warningsFor, safeRect, exportDesignJson, isEmpty } from './model.js';
import { ensureLayerFonts, ensureFont, onFontLoaded, fontFailed, loadFontList } from './fonts.js';
import { renderPanel } from './panels.js';
import { shirtSwatches } from './colors.js';
import { db } from './db.js';

const HISTORY_MAX = 100;

export async function openEditor(root, designId, nav) {
  const record = await db.get(designId);
  if (!record) {
    fill(root, errorBox({ message: 'That design was not found on this phone.' }));
    return () => {};
  }
  const design = record.design;
  loadFontList().catch(() => {});

  let selectedId = null;
  let panelTab = null;
  let sheetOpen = true;
  const view = { scale: 0.1, ox: 0, oy: 0 };
  let guides = { v: false, h: false };
  let fontProblems = [];

  // ---- undo / redo --------------------------------------------------------
  const snap = () => JSON.stringify({ canvas: design.canvas, preview: design.preview, layers: design.layers });
  let undoStack = [snap()];
  let redoStack = [];
  function commit() {
    const s = snap();
    if (s === undoStack[undoStack.length - 1]) return;
    undoStack.push(s);
    if (undoStack.length > HISTORY_MAX) undoStack.shift();
    redoStack = [];
    save();
    syncButtons();
  }
  function restore(s) {
    const o = JSON.parse(s);
    design.canvas = o.canvas;
    design.preview = o.preview;
    design.layers = o.layers;
    if (!design.layers.some((l) => l.id === selectedId)) selectedId = null;
    afterChange();
    save();
    syncButtons();
  }
  function undo() {
    if (undoStack.length < 2) return;
    redoStack.push(undoStack.pop());
    restore(undoStack[undoStack.length - 1]);
  }
  function redo() {
    if (!redoStack.length) return;
    const s = redoStack.pop();
    undoStack.push(s);
    restore(s);
  }

  // ---- autosave -------------------------------------------------------------
  let saveTimer = null;
  let thumbTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      design.updatedAt = new Date().toISOString();
      record.updatedAt = design.updatedAt;
      try {
        await db.put(record);
        status.textContent = 'Saved';
      } catch (e) {
        status.textContent = 'Not saved!';
        toast(`Could not save: ${e.message}`);
      }
    }, 400);
    status.textContent = 'Saving…';
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(async () => {
      record.thumb = renderThumbnail(design);
      await db.put(record).catch(() => {});
    }, 1500);
  }

  // ---- DOM ------------------------------------------------------------------
  const status = h('span', { class: 'save-status' }, 'Saved');
  const undoBtn = h('button', { class: 'icon-btn', 'aria-label': 'Undo', onclick: undo }, '↶');
  const redoBtn = h('button', { class: 'icon-btn', 'aria-label': 'Redo', onclick: redo }, '↷');
  const nameBtn = h('button', { class: 'title-btn', onclick: rename }, design.name);
  const canvas = h('canvas', { class: 'stage-canvas', 'aria-label': 'Design canvas' });
  const stage = h('div', { class: 'stage' }, canvas);
  const productStrip = h('div', { class: 'product-strip' });
  const warnBtn = h('button', { class: 'chip warn hidden', onclick: showWarnings });
  const panelEl = h('div', { class: 'panel' });
  const sheetToggle = h('button', { class: 'sheet-handle', 'aria-label': 'Show or hide layer controls', onclick: () => { sheetOpen = !sheetOpen; renderSheet(); fitSoon(); } });

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'tool', onclick: addText }, h('span', { class: 'ti', 'aria-hidden': 'true' }, 'T'), 'Text'),
    h('button', { class: 'tool', onclick: addShapeMenu }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '◯'), 'Shape'),
    h('button', { class: 'tool', onclick: showLayers }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '☰'), 'Layers'),
    h('button', { class: 'tool', onclick: pickShirt }, h('span', { class: 'ti shirt-dot', 'aria-hidden': 'true' }), 'Shirt'),
    h('button', { class: 'tool', 'aria-label': 'Zoom out', onclick: () => zoomBy(1 / 1.25) }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '−'), 'Zoom'),
    h('button', { class: 'tool', 'aria-label': 'Zoom in', onclick: () => zoomBy(1.25) }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '+'), 'Zoom'),
    h('button', { class: 'tool', onclick: fit }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '⤢'), 'Fit'),
  );

  const page = h('div', { class: 'editor' },
    h('header', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back to designs', onclick: () => nav('#/') }, '←'),
      h('div', { class: 'title-wrap' }, nameBtn, status),
      undoBtn, redoBtn,
      h('button', { class: 'icon-btn', 'aria-label': 'More', onclick: moreMenu }, '⋯'),
      h('button', { class: 'btn primary small', onclick: () => nav(`#/publish/${design.id}`) }, 'Publish'),
    ),
    h('div', { class: 'strip-row' }, productStrip, warnBtn),
    stage,
    toolbar,
    sheetToggle,
    panelEl,
  );
  fill(root, page);

  function syncButtons() {
    undoBtn.disabled = undoStack.length < 2;
    redoBtn.disabled = !redoStack.length;
  }
  syncButtons();

  function renderProductStrip() {
    const c = design.canvas;
    const p = c.product;
    fill(productStrip, 
      h('span', { class: 'strip-text' },
        p ? `${p.blueprintTitle} · ${p.position} · ` : 'No product yet · ',
        h('b', {}, `${c.width}×${c.height}px`),
        c.provisional ? ' (provisional)' : ''),
      h('button', { class: 'link-btn', onclick: () => nav(`#/product/${design.id}`) }, p ? 'Change' : 'Pick product'),
    );
  }

  // ---- view / drawing ---------------------------------------------------------
  let raf = 0;
  function requestDraw() {
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function cssSize() {
    const r = stage.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }
  function fit() {
    const { w, h: ht } = cssSize();
    const pad = 20;
    view.scale = Math.min((w - pad * 2) / design.canvas.width, (ht - pad * 2) / design.canvas.height);
    view.ox = (w - design.canvas.width * view.scale) / 2;
    view.oy = (ht - design.canvas.height * view.scale) / 2;
    requestDraw();
  }
  function fitSoon() {
    requestAnimationFrame(() => fit());
  }
  function zoomBy(k, cx, cy) {
    const { w, h: ht } = cssSize();
    cx ??= w / 2;
    cy ??= ht / 2;
    const ns = Math.min(Math.max(view.scale * k, 0.01), 4);
    view.ox = cx - ((cx - view.ox) * ns) / view.scale;
    view.oy = cy - ((cy - view.oy) * ns) / view.scale;
    view.scale = ns;
    requestDraw();
  }

  function draw() {
    raf = 0;
    const dpr = window.devicePixelRatio || 1;
    const { w, h: ht } = cssSize();
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(ht * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(ht * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Shirt-color preview: background only. The export stays transparent.
    ctx.fillStyle = design.preview.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const v = { scale: view.scale * dpr, offsetX: view.ox * dpr, offsetY: view.oy * dpr };
    renderDesign(ctx, design, v);

    // Overlays (never exported): print area, safe area, center guides, selection.
    const light = isLight(design.preview.color);
    const ink = light ? 'rgba(0,0,0,' : 'rgba(255,255,255,';
    ctx.setTransform(v.scale, 0, 0, v.scale, v.offsetX, v.offsetY);
    const px = 1 / v.scale;
    const { width: W, height: H } = design.canvas;
    ctx.lineWidth = 1.5 * dpr * px;
    ctx.setLineDash([6 * dpr * px, 5 * dpr * px]);
    ctx.strokeStyle = `${ink}0.55)`;
    ctx.strokeRect(0, 0, W, H);
    const s = safeRect(design.canvas);
    ctx.strokeStyle = `${ink}0.25)`;
    ctx.strokeRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
    ctx.setLineDash([]);
    ctx.lineWidth = 1 * dpr * px;
    ctx.strokeStyle = `${ink}0.12)`;
    line(ctx, W / 2, 0, W / 2, H);
    line(ctx, 0, H / 2, W, H / 2);
    ctx.lineWidth = 2 * dpr * px;
    ctx.strokeStyle = '#ff2d95';
    if (guides.v) line(ctx, W / 2, 0, W / 2, H);
    if (guides.h) line(ctx, 0, H / 2, W, H / 2);

    const warnIds = new Set(currentWarnings.filter((x) => x.layerId).map((x) => x.layerId));
    for (const l of design.layers) {
      if (l.hidden || !warnIds.has(l.id) || l.id === selectedId) continue;
      outline(ctx, layerCorners(l), '#ff9f0a', 1.5 * dpr * px, [4 * dpr * px, 4 * dpr * px]);
    }
    const sel = selected();
    if (sel) {
      const corners = layerCorners(sel);
      outline(ctx, corners, '#2f80ff', 2 * dpr * px, []);
      const [hx, hy] = handlePos(sel);
      ctx.beginPath();
      ctx.arc(hx, hy, 14 * dpr * px, 0, Math.PI * 2);
      ctx.fillStyle = '#2f80ff';
      ctx.fill();
      ctx.lineWidth = 3 * dpr * px;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  }

  function handlePos(layer) {
    return layerCorners(layer)[2]; // bottom-right corner, rotated with the layer
  }

  // ---- warnings ---------------------------------------------------------------
  let currentWarnings = [];
  function refreshWarnings() {
    fontProblems = design.layers
      .filter((l) => l.type === 'text' && fontFailed(l.font))
      .map((l) => `Font "${l.font.family}" did not load — check your connection. It must load before export.`);
    currentWarnings = warningsFor(design, fontProblems);
    warnBtn.classList.toggle('hidden', !currentWarnings.length);
    warnBtn.textContent = `⚠ ${currentWarnings.length} warning${currentWarnings.length === 1 ? '' : 's'}`;
  }
  function showWarnings() {
    dialog({
      title: 'Print warnings',
      body: h('div', {},
        h('p', { class: 'muted' }, 'These don’t block anything — they flag what may print badly.'),
        h('ul', { class: 'warn-list' }, currentWarnings.map((w) => h('li', {}, w.text)))),
    });
  }

  // ---- layer ops -----------------------------------------------------------
  function selected() {
    return design.layers.find((l) => l.id === selectedId) || null;
  }
  function select(id, tab) {
    selectedId = id;
    if (tab) panelTab = tab;
    if (id) sheetOpen = true;
    renderSheet();
    requestDraw();
  }
  function afterChange() {
    refreshWarnings();
    renderSheet();
    requestDraw();
    document.documentElement.style.setProperty('--shirt', design.preview.color);
  }
  // Live update while a control moves; commit() records history on release.
  function change(fn) {
    const l = selected();
    if (l) fn(l);
    refreshWarnings();
    requestDraw();
    save();
  }
  function addLayer(layer, tab) {
    design.layers.push(layer);
    selectedId = layer.id;
    panelTab = tab;
    sheetOpen = true;
    if (layer.type === 'text') ensureFont(layer.font, layer.text).then(requestDraw);
    commit();
    afterChange();
  }
  function addText() {
    addLayer(textLayer(design.canvas), 'text');
  }
  async function addShapeMenu() {
    const choice = await dialog({
      title: 'Add a shape',
      body: 'Shapes frame your type — underlines, dividers, badge rings.',
      buttons: [
        { label: 'Line', value: 'line' },
        { label: 'Rectangle', value: 'rect' },
        { label: 'Circle / ring', value: 'ring' },
      ],
    });
    if (choice) addLayer(shapeLayer(design.canvas, choice), 'shape');
  }
  function removeLayer(id) {
    design.layers = design.layers.filter((l) => l.id !== id);
    if (selectedId === id) selectedId = null;
    commit();
    afterChange();
  }
  function moveLayer(id, dir) {
    const i = design.layers.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= design.layers.length) return;
    [design.layers[i], design.layers[j]] = [design.layers[j], design.layers[i]];
    commit();
    afterChange();
  }
  function duplicate(id) {
    const l = design.layers.find((x) => x.id === id);
    if (!l) return;
    const copy = duplicateLayer(l);
    design.layers.splice(design.layers.indexOf(l) + 1, 0, copy);
    selectedId = copy.id;
    commit();
    afterChange();
  }

  function showLayers() {
    const list = h('div', { class: 'layer-list' });
    const renderList = () => {
      clear(list);
      if (!design.layers.length) list.append(h('p', { class: 'muted' }, 'No layers yet. Add text to start.'));
      [...design.layers].reverse().forEach((l) => {
        const i = design.layers.indexOf(l);
        list.append(h('div', { class: `layer-row${l.id === selectedId ? ' active' : ''}` },
          h('button', { class: 'layer-name', onclick: () => { select(l.id); dlg.remove(); } },
            h('span', { class: 'layer-kind' }, l.type === 'text' ? 'T' : l.shape === 'line' ? '—' : l.shape === 'ring' ? '◯' : '▭'),
            l.type === 'text' ? (l.text.split('\n')[0] || '(empty)').slice(0, 28) : l.name),
          h('button', { class: 'icon-btn', 'aria-label': 'Move up', disabled: i === design.layers.length - 1, onclick: () => { moveLayer(l.id, 1); renderList(); } }, '▲'),
          h('button', { class: 'icon-btn', 'aria-label': 'Move down', disabled: i === 0, onclick: () => { moveLayer(l.id, -1); renderList(); } }, '▼'),
          h('button', { class: 'icon-btn', 'aria-label': l.hidden ? 'Show' : 'Hide', onclick: () => { l.hidden = !l.hidden; commit(); afterChange(); renderList(); } }, l.hidden ? '◌' : '●'),
          h('button', { class: 'icon-btn', 'aria-label': 'Duplicate', onclick: () => { duplicate(l.id); renderList(); } }, '⧉'),
          h('button', { class: 'icon-btn danger', 'aria-label': 'Delete', onclick: () => { removeLayer(l.id); renderList(); } }, '🗑'),
        ));
      });
    };
    renderList();
    const dlg = h('div', { class: 'overlay', onclick: (e) => e.target === dlg && dlg.remove() },
      h('div', { class: 'dialog' }, h('h2', {}, 'Layers (top first)'), list,
        h('div', { class: 'dialog-buttons' }, h('button', { class: 'btn primary', onclick: () => dlg.remove() }, 'Done'))));
    document.body.append(dlg);
  }

  function pickShirt() {
    const swatches = shirtSwatches(design.canvas.product?.colors);
    const body = h('div', {},
      h('p', { class: 'muted' }, 'Preview only — the exported PNG stays transparent. Colors are approximate.'),
      h('div', { class: 'swatch-grid' }, swatches.map((s) =>
        h('button', {
          class: `swatch${s.hex === design.preview.color ? ' active' : ''}`,
          style: { background: s.hex },
          'aria-label': s.name,
          onclick: () => {
            design.preview = { color: s.hex, name: s.name };
            commit();
            afterChange();
            o.remove();
          },
        }, h('span', {}, s.name)))),
    );
    const o = h('div', { class: 'overlay', onclick: (e) => e.target === o && o.remove() },
      h('div', { class: 'dialog' }, h('h2', {}, 'Shirt color'), body,
        h('div', { class: 'dialog-buttons' }, h('button', { class: 'btn', onclick: () => o.remove() }, 'Close'))));
    document.body.append(o);
  }

  async function rename() {
    const name = await promptText('Rename design', design.name);
    if (name) {
      design.name = name;
      nameBtn.textContent = name;
      save();
    }
  }

  async function moreMenu() {
    const choice = await dialog({
      title: 'Design',
      buttons: [
        { label: 'Download PNG', value: 'png' },
        { label: 'Export design file (.json)', value: 'json' },
        { label: 'Change product / print area', value: 'product' },
        { label: 'Rename', value: 'rename' },
        { label: 'Close', value: null },
      ],
    });
    if (choice === 'png') downloadPng();
    if (choice === 'json') downloadBlob(new Blob([exportDesignJson(design)], { type: 'application/json' }), safeFileName(design.name, 'json'));
    if (choice === 'product') nav(`#/product/${design.id}`);
    if (choice === 'rename') rename();
  }

  async function downloadPng() {
    if (isEmpty(design)) return toast('The canvas is empty.');
    toast('Rendering full-size PNG…');
    try {
      if (!(await ensureLayerFonts(design.layers))) throw new Error('A font did not load, so the PNG would not match the screen. Check your connection and try again.');
      const blob = await exportPng(design);
      downloadBlob(blob, safeFileName(design.name, 'png'));
      toast(`PNG saved: ${design.canvas.width}×${design.canvas.height}px, transparent`);
    } catch (e) {
      dialog({ title: 'Export failed', body: errorBox(e) });
    }
  }

  // ---- property sheet ----------------------------------------------------------
  function renderSheet() {
    sheetToggle.textContent = sheetOpen ? '▾ Hide controls' : '▴ Show controls';
    sheetToggle.classList.toggle('hidden', !selected());
    panelEl.classList.toggle('hidden', !sheetOpen || !selected());
    const l = selected();
    if (!l) return clear(panelEl);
    panelTab = renderPanel(panelEl, l, {
      tab: panelTab,
      canvas: design.canvas,
      change,
      commit,
      requestDraw,
      remove: () => removeLayer(l.id),
      duplicate: () => duplicate(l.id),
      forward: () => moveLayer(l.id, 1),
      backward: () => moveLayer(l.id, -1),
      onTab: (t) => {
        panelTab = t;
      },
      rerender: () => renderSheet(),
    });
  }

  // ---- touch / pointer interactions --------------------------------------------
  const pointers = new Map();
  let gesture = null;

  function toDesign(e) {
    const r = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    return { cx, cy, x: (cx - view.ox) / view.scale, y: (cy - view.oy) / view.scale };
  }

  canvas.addEventListener('pointerdown', (e) => {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // pointer already gone; the gesture still works without capture
    }
    const p = toDesign(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = { type: 'pinch', dist: Math.hypot(a.cx - b.cx, a.cy - b.cy), mid: { x: (a.cx + b.cx) / 2, y: (a.cy + b.cy) / 2 }, moved: true };
      return;
    }
    if (pointers.size > 2) return;
    const slop = 18 / view.scale;
    const sel = selected();
    if (sel) {
      const [hx, hy] = handlePos(sel);
      if (Math.hypot(p.x - hx, p.y - hy) < 26 / view.scale) {
        gesture = { type: 'resize', start: p, layer: sel, orig: structuredClone(sel), d0: Math.hypot(p.x - sel.x, p.y - sel.y) || 1, moved: false };
        return;
      }
    }
    const hit = [...design.layers].reverse().find((l) => !l.hidden && hitTest(l, p.x, p.y, slop));
    if (hit) {
      const wasSelected = hit.id === selectedId;
      if (!wasSelected) select(hit.id, hit.type === 'text' ? 'text' : 'shape');
      gesture = { type: 'move', start: p, layer: hit, ox: hit.x, oy: hit.y, moved: false, wasSelected };
    } else {
      gesture = { type: 'pan', start: p, vox: view.ox, voy: view.oy, moved: false };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    const p = toDesign(e);
    pointers.set(e.pointerId, p);
    if (gesture.type === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy);
      const mid = { x: (a.cx + b.cx) / 2, y: (a.cy + b.cy) / 2 };
      view.ox += mid.x - gesture.mid.x;
      view.oy += mid.y - gesture.mid.y;
      zoomBy(dist / gesture.dist, mid.x, mid.y);
      gesture.dist = dist;
      gesture.mid = mid;
      return;
    }
    const dxs = p.cx - gesture.start.cx, dys = p.cy - gesture.start.cy;
    if (!gesture.moved && Math.hypot(dxs, dys) < 6) return;
    gesture.moved = true;
    if (gesture.type === 'pan') {
      view.ox = gesture.vox + dxs;
      view.oy = gesture.voy + dys;
      requestDraw();
    } else if (gesture.type === 'move') {
      const l = gesture.layer;
      let nx = gesture.ox + dxs / view.scale;
      let ny = gesture.oy + dys / view.scale;
      // Snap the layer's center to the canvas center lines.
      const snapD = 12 / view.scale;
      const cx = design.canvas.width / 2, cy = design.canvas.height / 2;
      guides = { v: Math.abs(nx - cx) < snapD, h: Math.abs(ny - cy) < snapD };
      if (guides.v) nx = cx;
      if (guides.h) ny = cy;
      l.x = Math.round(nx * 10) / 10;
      l.y = Math.round(ny * 10) / 10;
      refreshWarnings();
      requestDraw();
    } else if (gesture.type === 'resize') {
      const l = gesture.layer, o = gesture.orig;
      const k = Math.max(0.05, Math.hypot(p.x - o.x, p.y - o.y) / gesture.d0);
      scaleLayer(l, o, k);
      refreshWarnings();
      requestDraw();
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (!gesture) return;
    if (gesture.type === 'pinch') {
      if (pointers.size === 0) gesture = null;
      else {
        const [p] = [...pointers.values()];
        gesture = { type: 'pan', start: p, vox: view.ox, voy: view.oy, moved: true };
      }
      return;
    }
    if (pointers.size) return;
    const g = gesture;
    gesture = null;
    guides = { v: false, h: false };
    if (g.type === 'pan' && !g.moved) select(null); // tap on empty space deselects
    else if (g.type === 'move' && !g.moved && g.wasSelected && g.layer.type === 'text') {
      // Second tap on selected text jumps straight to editing the words.
      select(g.layer.id, 'text');
      setTimeout(() => panelEl.querySelector('textarea')?.focus(), 50);
    }
    if (g.moved && (g.type === 'move' || g.type === 'resize')) {
      commit();
      renderSheet();
    }
    requestDraw();
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  // Mouse wheel zoom is a convenience only; every action has a touch path.
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  const ro = new ResizeObserver(() => fit());
  ro.observe(stage);
  const offFont = onFontLoaded(() => {
    refreshWarnings();
    requestDraw();
  });

  // Load every font in the design, then draw.
  ensureLayerFonts(design.layers).then(() => {
    refreshWarnings();
    requestDraw();
  });

  renderProductStrip();
  afterChange();
  fit();

  return () => {
    ro.disconnect();
    offFont();
    clearTimeout(saveTimer);
    // Flush any pending save immediately when leaving the editor.
    design.updatedAt = new Date().toISOString();
    record.updatedAt = design.updatedAt;
    record.thumb = renderThumbnail(design);
    db.put(record).catch(() => {});
  };
}

export function scaleLayer(l, o, k) {
  const r2 = (n) => Math.round(n * 100) / 100;
  if (l.type === 'text') {
    l.size = Math.max(4, r2(o.size * k));
    l.stroke.width = r2(o.stroke.width * k);
    l.shadow.dx = r2(o.shadow.dx * k);
    l.shadow.dy = r2(o.shadow.dy * k);
    l.shadow.blur = r2(o.shadow.blur * k);
  } else {
    l.w = Math.max(2, r2(o.w * k));
    l.h = Math.max(1, r2(o.h * k));
    l.r = Math.max(2, r2(o.r * k));
    l.radius = r2(o.radius * k);
    if (l.shape !== 'line') l.stroke.width = r2(o.stroke.width * k);
  }
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function outline(ctx, pts, color, width, dash) {
  ctx.save();
  ctx.setLineDash(dash);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export function isLight(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}
