import { el } from '../utils/dom.js';
import { ACTIONS } from '../utils/errors.js';

const LABELS = {
  [ACTIONS.RETRY]: '🔄  Try again',
  [ACTIONS.SETTINGS]: '⚙  Change settings',
  [ACTIONS.NEW_IMAGE]: '🖼  Upload another image',
  [ACTIONS.LOWER_QUALITY]: '📉  Lower the quality and retry',
};

/** Failure screen. Plain language, concrete next steps, never a stack trace. */
export function ErrorScreen({ error, handlers }) {
  const actions = (error.actions && error.actions.length ? error.actions : [ACTIONS.RETRY])
    .filter(a => handlers[a])
    .map((a, i) => el('button', {
      class: `btn ${i === 0 ? 'btn--primary' : ''}`,
      type: 'button',
      onClick: handlers[a],
    }, [LABELS[a] || a]));

  return el('section', { class: 'screen' }, [
    el('div', { class: 'errorpane' }, [
      el('div', { class: 'errorpane__icon', text: '😕', 'aria-hidden': 'true' }),
      el('div', { class: 'errorpane__title', text: error.message }),
      error.hint ? el('div', { class: 'errorpane__hint', text: error.hint }) : null,
      el('div', { class: 'errorpane__actions' }, actions),
    ].filter(Boolean)),
  ]);
}
