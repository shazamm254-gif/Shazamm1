// The bottom property sheet for the selected layer. Every control is a big
// touch target: sliders get −/+ buttons for fine steps, no hover anywhere.
import { h, clear, fill } from './ui.js';
import { weightsOf, hasItalic, nearestWeight, ensureFont, familyInfo, previewFamily, loadPreview } from './fonts.js';
import { openFontPicker } from './picker.js';

const PRESET_COLORS = ['#ffffff', '#111111', '#c8102e', '#f5b52a', '#1d4f91', '#128a4a', '#ff6fa8', '#f26b21', '#7a4cc2', '#9aa0a6'];

export function renderPanel(root, layer, ed) {
  const tabs = layer.type === 'text'
    ? [['text', 'Text'], ['font', 'Font'], ['style', 'Style'], ['arch', 'Arch'], ['arrange', 'Arrange']]
    : [['shape', 'Shape'], ['arrange', 'Arrange']];
  let tab = tabs.some(([t]) => t === ed.tab) ? ed.tab : tabs[0][0];

  const body = h('div', { class: 'panel-body' });
  const tabBar = h('div', { class: 'tabs', role: 'tablist' });
  const paint = () => {
    fill(tabBar, ...tabs.map(([t, label]) =>
      h('button', { class: `tab${t === tab ? ' active' : ''}`, role: 'tab', 'aria-selected': String(t === tab), onclick: () => { tab = t; ed.onTab(t); paint(); } }, label)));
    clear(body);
    const builders = { text: textTab, font: fontTab, style: styleTab, arch: archTab, arrange: arrangeTab, shape: shapeTab };
    builders[tab](body, layer, ed);
  };
  fill(root, tabBar, body);
  paint();
  return tab;
}

// ---- controls -------------------------------------------------------------------

function range({ label, value, min, max, step = 1, unit = '', fmt, onInput, onCommit }) {
  const show = (v) => (fmt ? fmt(v) : `${Math.round(v * 100) / 100}${unit}`);
  const out = h('span', { class: 'range-val' }, show(value));
  const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
  const set = (v, commit) => {
    v = Math.min(max, Math.max(min, Math.round(v / step) * step));
    input.value = v;
    out.textContent = show(v);
    onInput(v);
    if (commit) onCommit();
  };
  input.addEventListener('input', () => set(Number(input.value), false));
  input.addEventListener('change', () => onCommit());
  const nudge = (d) => set(Number(input.value) + d * step, true);
  return h('div', { class: 'ctl' },
    h('div', { class: 'ctl-head' }, h('label', {}, label), out),
    h('div', { class: 'range-row' },
      h('button', { class: 'step', 'aria-label': `Decrease ${label}`, onclick: () => nudge(-1) }, '−'),
      input,
      h('button', { class: 'step', 'aria-label': `Increase ${label}`, onclick: () => nudge(1) }, '+')));
}

function color({ label, value, onInput, onCommit }) {
  const picker = h('input', { type: 'color', value, 'aria-label': label });
  const swatches = PRESET_COLORS.map((c) => h('button', {
    class: `mini-swatch${c === value ? ' active' : ''}`, style: { background: c }, 'aria-label': `${label} ${c}`,
    onclick: () => { picker.value = c; mark(c); onInput(c); onCommit(); },
  }));
  const mark = (v) => swatches.forEach((b, i) => b.classList.toggle('active', PRESET_COLORS[i] === v));
  picker.addEventListener('input', () => { mark(picker.value); onInput(picker.value); });
  picker.addEventListener('change', () => onCommit());
  return h('div', { class: 'ctl' },
    h('div', { class: 'ctl-head' }, h('label', {}, label)),
    h('div', { class: 'color-row' }, picker, swatches));
}

function segmented(label, options, value, onChange) {
  return h('div', { class: 'ctl' },
    label ? h('div', { class: 'ctl-head' }, h('label', {}, label)) : null,
    h('div', { class: 'seg', role: 'group', 'aria-label': label || 'options' },
      options.map(([v, text]) => h('button', { class: `seg-btn${v === value ? ' active' : ''}`, 'aria-pressed': String(v === value), onclick: () => onChange(v) }, text))));
}

function toggle(label, checked, onChange, { disabled = false, note = '' } = {}) {
  const input = h('input', { type: 'checkbox', checked, disabled });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: `toggle${disabled ? ' disabled' : ''}` }, input, h('span', {}, label), note ? h('small', {}, note) : null);
}

// Live-update helper: mutate on input, record undo history on release.
const live = (ed, fn) => (v) => ed.change((l) => fn(l, v));

// ---- text tabs --------------------------------------------------------------------

function textTab(root, l, ed) {
  const ta = h('textarea', { rows: 2, 'aria-label': 'Your words', placeholder: 'Type your words', autocapitalize: 'characters' });
  ta.value = l.text;
  let t = null;
  ta.addEventListener('input', () => {
    ed.change((x) => { x.text = ta.value; });
    ensureFont(l.font, l.text).then(ed.requestDraw);
    clearTimeout(t);
    t = setTimeout(ed.commit, 600);
  });
  ta.addEventListener('blur', () => ed.commit());
  const W = ed.canvas.width;
  root.append(
    h('div', { class: 'ctl' }, h('div', { class: 'ctl-head' }, h('label', {}, 'Words (new line = new line)')), ta),
    h('div', { class: 'ctl-row' },
      toggle('ALL CAPS', l.caps, (v) => { ed.change((x) => { x.caps = v; }); ed.commit(); }),
      segmented('', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], l.align, (v) => { ed.change((x) => { x.align = v; }); ed.commit(); ed.rerender(); })),
    range({ label: 'Size', value: l.size, min: 10, max: Math.round(W * 0.6), step: 1, unit: 'px', fmt: (v) => `${Math.round(v)}px · ${(v / 300).toFixed(2)}″`, onInput: live(ed, (x, v) => { x.size = v; }), onCommit: ed.commit }),
    range({ label: 'Letter spacing', value: l.letterSpacing, min: -100, max: 1000, step: 5, fmt: (v) => `${v / 10}%`, onInput: live(ed, (x, v) => { x.letterSpacing = v; }), onCommit: ed.commit }),
    range({ label: 'Line height', value: l.lineHeight, min: 0.6, max: 2.5, step: 0.05, unit: '×', onInput: live(ed, (x, v) => { x.lineHeight = v; }), onCommit: ed.commit }),
  );
}

function fontTab(root, l, ed) {
  const fam = l.font.family;
  const label = h('span', { class: 'font-current', style: { fontFamily: `"${previewFamily(fam)}", system-ui` } }, fam);
  loadPreview(fam);
  const weights = weightsOf(fam);
  const italicOk = hasItalic(fam, l.font.weight);
  const setFont = (next) => {
    ed.change((x) => { x.font = next; });
    ensureFont(next, l.text).then(() => ed.requestDraw());
    ed.commit();
    ed.rerender();
  };
  root.append(
    h('button', { class: 'font-btn', onclick: () => openFontPicker(fam, (family) => {
      const weight = nearestWeight(family, l.font.weight);
      setFont({ family, weight, italic: l.font.italic && hasItalic(family, weight) });
    }) }, label, h('span', { class: 'muted' }, ' Change ›')),
    h('div', { class: 'ctl' },
      h('div', { class: 'ctl-head' }, h('label', {}, 'Weight'), h('small', { class: 'muted' }, familyInfo(fam) ? 'only weights this font really ships' : '')),
      h('div', { class: 'seg wrap' }, weights.map((w) => h('button', {
        class: `seg-btn${w === l.font.weight ? ' active' : ''}`,
        onclick: () => setFont({ family: fam, weight: w, italic: l.font.italic && hasItalic(fam, w) }),
      }, String(w))))),
    toggle('Italic', l.font.italic, (v) => setFont({ ...l.font, italic: v }), {
      disabled: !italicOk && !l.font.italic,
      note: italicOk ? '' : 'This font has no real italic at this weight',
    }),
  );
}

function styleTab(root, l, ed) {
  const W = ed.canvas.width;
  const f = l.fill;
  root.append(
    segmented('Fill', [['solid', 'Solid'], ['gradient', 'Gradient'], ['split', 'Two-color split']], f.type, (v) => { ed.change((x) => { x.fill.type = v; }); ed.commit(); ed.rerender(); }),
    color({ label: f.type === 'solid' ? 'Color' : 'Color 1', value: f.color, onInput: live(ed, (x, v) => { x.fill.color = v; }), onCommit: ed.commit }),
  );
  if (f.type !== 'solid') {
    root.append(
      color({ label: 'Color 2', value: f.color2, onInput: live(ed, (x, v) => { x.fill.color2 = v; }), onCommit: ed.commit }),
      range({ label: 'Direction', value: f.angle, min: 0, max: 360, step: 5, unit: '°', onInput: live(ed, (x, v) => { x.fill.angle = v; }), onCommit: ed.commit }),
    );
    if (f.type === 'split')
      root.append(range({ label: 'Split point', value: f.split, min: 0, max: 100, step: 1, unit: '%', onInput: live(ed, (x, v) => { x.fill.split = v; }), onCommit: ed.commit }));
  }
  root.append(h('hr'), toggle('Outline', l.stroke.on, (v) => { ed.change((x) => { x.stroke.on = v; }); ed.commit(); ed.rerender(); }));
  if (l.stroke.on) {
    root.append(
      range({ label: 'Outline width', value: l.stroke.width, min: 1, max: Math.round(W * 0.03), step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.stroke.width = v; }), onCommit: ed.commit }),
      color({ label: 'Outline color', value: l.stroke.color, onInput: live(ed, (x, v) => { x.stroke.color = v; }), onCommit: ed.commit }),
    );
  }
  root.append(h('hr'), toggle('Drop shadow', l.shadow.on, (v) => { ed.change((x) => { x.shadow.on = v; }); ed.commit(); ed.rerender(); }));
  if (l.shadow.on) {
    const lim = Math.round(W * 0.05);
    root.append(
      color({ label: 'Shadow color', value: l.shadow.color, onInput: live(ed, (x, v) => { x.shadow.color = v; }), onCommit: ed.commit }),
      range({ label: 'Shadow opacity', value: l.shadow.opacity, min: 0.05, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, onInput: live(ed, (x, v) => { x.shadow.opacity = v; }), onCommit: ed.commit }),
      range({ label: 'Shadow right/left', value: l.shadow.dx, min: -lim, max: lim, step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.shadow.dx = v; }), onCommit: ed.commit }),
      range({ label: 'Shadow down/up', value: l.shadow.dy, min: -lim, max: lim, step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.shadow.dy = v; }), onCommit: ed.commit }),
      range({ label: 'Shadow softness', value: l.shadow.blur, min: 0, max: Math.round(W * 0.03), step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.shadow.blur = v; }), onCommit: ed.commit }),
    );
  }
}

function archTab(root, l, ed) {
  root.append(
    segmented('Arch', [['none', 'Straight'], ['top', 'Arch up ⌒'], ['bottom', 'Arch down ⌣']], l.arch.mode, (v) => { ed.change((x) => { x.arch.mode = v; }); ed.commit(); ed.rerender(); }),
  );
  if (l.arch.mode !== 'none') {
    root.append(range({ label: 'Curve', value: l.arch.curve, min: 1, max: 100, step: 1, unit: '%', onInput: live(ed, (x, v) => { x.arch.curve = v; }), onCommit: ed.commit }));
  }
  root.append(h('p', { class: 'muted small' }, 'Arch down is for the bottom of a circle badge: letters stay readable left-to-right.'));
}

// ---- shape + arrange --------------------------------------------------------------

function shapeTab(root, l, ed) {
  const W = ed.canvas.width;
  if (l.shape === 'line') {
    root.append(
      range({ label: 'Length', value: l.w, min: 10, max: W, step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.w = v; }), onCommit: ed.commit }),
      range({ label: 'Thickness', value: l.h, min: 1, max: Math.round(W * 0.1), step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.h = v; }), onCommit: ed.commit }),
      segmented('Ends', [['butt', 'Square'], ['round', 'Round']], l.cap, (v) => { ed.change((x) => { x.cap = v; }); ed.commit(); ed.rerender(); }),
      color({ label: 'Color', value: l.fill.color, onInput: live(ed, (x, v) => { x.fill.color = v; }), onCommit: ed.commit }),
    );
    return;
  }
  if (l.shape === 'ring') {
    root.append(range({ label: 'Size (radius)', value: l.r, min: 10, max: Math.round(W * 0.7), step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.r = v; }), onCommit: ed.commit }));
  } else {
    root.append(
      range({ label: 'Width', value: l.w, min: 10, max: W, step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.w = v; }), onCommit: ed.commit }),
      range({ label: 'Height', value: l.h, min: 10, max: Math.round(ed.canvas.height), step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.h = v; }), onCommit: ed.commit }),
      range({ label: 'Corner rounding', value: l.radius, min: 0, max: Math.round(W * 0.2), step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.radius = v; }), onCommit: ed.commit }),
    );
  }
  root.append(
    toggle(l.shape === 'ring' ? 'Ring (outline)' : 'Outline', l.stroke.on, (v) => { ed.change((x) => { x.stroke.on = v; }); ed.commit(); ed.rerender(); }),
  );
  if (l.stroke.on) {
    root.append(
      range({ label: 'Thickness', value: l.stroke.width, min: 1, max: Math.round(W * 0.08), step: 1, unit: 'px', onInput: live(ed, (x, v) => { x.stroke.width = v; }), onCommit: ed.commit }),
      color({ label: 'Outline color', value: l.stroke.color, onInput: live(ed, (x, v) => { x.stroke.color = v; }), onCommit: ed.commit }),
    );
  }
  root.append(toggle('Solid fill', l.fill.on, (v) => { ed.change((x) => { x.fill.on = v; }); ed.commit(); ed.rerender(); }));
  if (l.fill.on) root.append(color({ label: 'Fill color', value: l.fill.color, onInput: live(ed, (x, v) => { x.fill.color = v; }), onCommit: ed.commit }));
}

function arrangeTab(root, l, ed) {
  const { width: W, height: H } = ed.canvas;
  root.append(
    range({ label: 'Rotation', value: l.rotation, min: -180, max: 180, step: 1, unit: '°', onInput: live(ed, (x, v) => { x.rotation = v; }), onCommit: ed.commit }),
    range({ label: 'Opacity', value: l.opacity, min: 0.05, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, onInput: live(ed, (x, v) => { x.opacity = v; }), onCommit: ed.commit }),
    h('div', { class: 'btn-grid' },
      h('button', { class: 'btn', onclick: () => { ed.change((x) => { x.x = W / 2; }); ed.commit(); } }, '↔ Center across'),
      h('button', { class: 'btn', onclick: () => { ed.change((x) => { x.y = H / 2; }); ed.commit(); } }, '↕ Center down'),
      h('button', { class: 'btn', onclick: () => { ed.change((x) => { x.rotation = 0; }); ed.commit(); ed.rerender(); } }, '⟲ Straighten'),
      h('button', { class: 'btn', onclick: ed.forward }, '▲ Bring forward'),
      h('button', { class: 'btn', onclick: ed.backward }, '▼ Send back'),
      h('button', { class: 'btn', onclick: ed.duplicate }, '⧉ Duplicate'),
      h('button', { class: 'btn danger', onclick: ed.remove }, '🗑 Delete layer')),
  );
}
