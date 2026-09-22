import { el } from '../utils/dom.js';
import { RENDER_STAGES } from '../config/app.config.js';

/**
 * Screen 3 — rendering.
 *
 * A ring plus the stage name plus the live frame count. The brief's rule is
 * "never leave the user staring at a blank screen", so this updates on every
 * third frame and names what is actually happening.
 */
export function RenderScreen({ onCancel }) {
  const R = 58;
  const C = 2 * Math.PI * R;

  const arc = el('circle', {
    cx: 66, cy: 66, r: R, fill: 'none',
    stroke: 'url(#mgrad)', 'stroke-width': 9, 'stroke-linecap': 'round',
    'stroke-dasharray': C, 'stroke-dashoffset': C,
  });

  const ring = el('div', { class: 'render__ring' });
  ring.innerHTML = `
    <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
      <defs>
        <linearGradient id="mgrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#6c5cff"/>
          <stop offset="55%" stop-color="#a34bff"/>
          <stop offset="100%" stop-color="#ff4d9d"/>
        </linearGradient>
      </defs>
      <circle cx="66" cy="66" r="${R}" fill="none" stroke="#242936" stroke-width="9"/>
    </svg>`;
  ring.querySelector('svg').append(arc);

  const pctEl = el('div', { class: 'render__pct', text: '0%' });
  ring.append(pctEl);

  const stageEl = el('div', { class: 'render__stage', text: RENDER_STAGES[0].label });
  const detailEl = el('div', { class: 'render__detail', text: '' });
  const noteEl = el('div', { class: 'render__note', text: 'Keep this screen open. Rendering uses your phone’s GPU.' });

  const node = el('section', { class: 'screen' }, [
    el('div', { class: 'render' }, [
      ring, stageEl, detailEl, noteEl,
      el('button', { class: 'btn btn--ghost', type: 'button', onClick: onCancel }, ['Cancel']),
    ]),
  ]);

  return {
    node,
    update({ stage, progress, frame, total }) {
      const p = Math.max(0, Math.min(1, progress));
      arc.setAttribute('stroke-dashoffset', String(C * (1 - p)));
      pctEl.textContent = `${Math.round(p * 100)}%`;
      const def = RENDER_STAGES.find(s => s.id === stage);
      if (def) stageEl.textContent = def.label;
      detailEl.textContent = total ? `Frame ${frame} of ${total}` : '';
    },
    setNote(text) { noteEl.textContent = text; },
  };
}
