// Tiny DOM helpers + dialogs. Everything is tap-sized (min 44px targets).
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// Replace an element's children. Unlike native append(), skips null/false so
// conditional children never render as the text "null".
export function fill(el, ...children) {
  clear(el).append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

let toastTimer = null;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// Plain-language message + the raw error tucked in a collapsible block.
export function errorBox(err, title) {
  const detail = err?.detail || (err?.stack && !err.status ? String(err.stack) : '');
  return h('div', { class: 'error-box', role: 'alert' },
    h('strong', {}, title || err?.message || 'Something went wrong.'),
    title && err?.message ? h('p', {}, err.message) : null,
    detail ? h('details', {}, h('summary', {}, 'Technical details'), h('pre', {}, detail)) : null,
  );
}

// Modal dialog. Resolves with the value of the button tapped (or null).
export function dialog({ title, body, buttons = [{ label: 'OK', value: true, primary: true }], dismissable = true }) {
  return new Promise((resolve) => {
    const close = (v) => {
      overlay.remove();
      resolve(v);
    };
    const overlay = h('div', { class: 'overlay', onclick: (e) => dismissable && e.target === overlay && close(null) },
      h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        title ? h('h2', {}, title) : null,
        body instanceof Node ? body : body ? h('p', {}, body) : null,
        h('div', { class: 'dialog-buttons' },
          buttons.map((b) => h('button', { class: b.primary ? 'btn primary' : b.danger ? 'btn danger' : 'btn', onclick: () => close(b.value) }, b.label)),
        ),
      ),
    );
    document.body.append(overlay);
    overlay.querySelector('.dialog-buttons button:last-child')?.focus();
  });
}

export async function promptText(title, value = '', { label = '', placeholder = '' } = {}) {
  const input = h('input', { type: 'text', value, placeholder, 'aria-label': label || title });
  const body = h('div', {}, label ? h('label', { class: 'field-label' }, label) : null, input);
  setTimeout(() => input.focus(), 50);
  const ok = await dialog({ title, body, buttons: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, primary: true }] });
  return ok ? input.value.trim() : null;
}

// Full-screen sheet (font picker, layers, product search).
export function sheet(title, content, { onClose } = {}) {
  const close = () => {
    el.remove();
    onClose?.();
  };
  const el = h('div', { class: 'sheet-page', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, '✕'),
      h('h1', {}, title),
    ),
    h('div', { class: 'sheet-body' }, content),
  );
  document.body.append(el);
  return { el, close };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const money = (cents) => `$${(cents / 100).toFixed(2)}`;

export function safeFileName(name, ext) {
  return `${(name || 'design').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'design'}.${ext}`;
}
