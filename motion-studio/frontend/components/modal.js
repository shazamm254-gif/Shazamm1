import { el } from '../utils/dom.js';

/** A bottom sheet. Tapping the backdrop or Back closes it. */
export function openModal({ title, body }) {
  const card = el('div', { class: 'modal__card' }, [
    el('div', { class: 'modal__title', text: title }),
    el('div', { class: 'modal__body' }, body),
    el('button', { class: 'btn btn--ghost', style: { marginTop: '14px' }, type: 'button', onClick: close }, ['Close']),
  ]);

  const backdrop = el('div', {
    class: 'modal',
    role: 'dialog',
    'aria-modal': 'true',
    onClick: (e) => { if (e.target === backdrop) close(); },
  }, [card]);

  function onKey(e) { if (e.key === 'Escape') close(); }
  function close() {
    backdrop.remove();
    window.removeEventListener('keydown', onKey);
  }

  window.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  return { close };
}
