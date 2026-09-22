import { el, tap } from '../utils/dom.js';

/**
 * Small, reusable touch controls. Everything here is at least 42px tall and
 * works on tap alone — no hover state carries meaning.
 */

export function chipRow({ items, value, onChange, className = '' }) {
  const row = el('div', { class: `chiprow ${className}`, role: 'tablist' });
  const buttons = new Map();

  for (const item of items) {
    const btn = el('button', {
      class: `chip ${className ? className + '__chip' : ''}`,
      type: 'button',
      role: 'tab',
      'aria-pressed': String(item.id === value),
      onClick: () => { tap(); select(item.id, true); },
    }, [
      item.emoji ? el('span', { text: item.emoji, 'aria-hidden': 'true' }) : null,
      el('span', { text: item.label }),
    ]);
    buttons.set(item.id, btn);
    row.append(btn);
  }

  function select(id, fire) {
    for (const [key, btn] of buttons) {
      btn.setAttribute('aria-pressed', String(key === id));
    }
    const active = buttons.get(id);
    if (active) {
      active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
    if (fire) onChange(id);
  }

  return { node: row, select: (id) => select(id, false) };
}

export function segmented({ options, value, onChange, label }) {
  const buttons = new Map();
  const node = el('div', { class: 'segmented', role: 'group', 'aria-label': label || '' });

  for (const opt of options) {
    const btn = el('button', {
      class: 'segmented__opt',
      type: 'button',
      'aria-pressed': String(opt.id === value),
      onClick: () => { tap(); set(opt.id, true); },
    }, [opt.label]);
    buttons.set(opt.id, btn);
    node.append(btn);
  }

  function set(id, fire) {
    for (const [key, btn] of buttons) btn.setAttribute('aria-pressed', String(key === id));
    if (fire) onChange(id);
  }

  return { node, set: (id) => set(id, false) };
}

export function slider({ label, value, min = 0, max = 100, step = 1, format, onInput }) {
  const out = el('span', { class: 'slider__value', text: format ? format(value) : String(value) });
  const input = el('input', {
    type: 'range', min, max, step, value,
    'aria-label': label,
    onInput: (e) => {
      const v = Number(e.target.value);
      out.textContent = format ? format(v) : String(v);
      onInput(v);
    },
  });

  const node = el('div', { class: 'slider' }, [
    el('div', { class: 'slider__head' }, [el('span', { text: label }), out]),
    input,
  ]);

  return {
    node,
    set(v) {
      input.value = String(v);
      out.textContent = format ? format(v) : String(v);
    },
  };
}

export function disclosure({ label, children, open = false }) {
  const caret = el('span', { text: open ? '▲' : '▼', 'aria-hidden': 'true' });
  const body = el('div', { class: `disclosure__body ${open ? '' : 'hidden'}` }, children);
  const btn = el('button', {
    class: 'disclosure__btn',
    type: 'button',
    'aria-expanded': String(open),
    onClick: () => {
      open = !open;
      body.classList.toggle('hidden', !open);
      caret.textContent = open ? '▲' : '▼';
      btn.setAttribute('aria-expanded', String(open));
      tap();
    },
  }, [el('span', { text: label }), caret]);

  return el('div', { class: 'disclosure' }, [btn, body]);
}

export function sectionLabel(text) {
  return el('div', { class: 'section__label', text });
}
