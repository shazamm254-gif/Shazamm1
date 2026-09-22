import { el } from '../utils/dom.js';

let host = null;

function ensureHost() {
  if (!host) {
    host = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  return host;
}

export function toast(message, { error = false, ms = 2600 } = {}) {
  const node = el('div', { class: `toast ${error ? 'toast--error' : ''}`, text: message });
  ensureHost().append(node);
  setTimeout(() => {
    node.style.transition = 'opacity .2s ease';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 220);
  }, ms);
}
