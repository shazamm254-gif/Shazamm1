import { el, tap } from '../utils/dom.js';

/**
 * The 9:16 preview stage.
 *
 * Owns the canvas the engine draws into, and the touch gestures that reframe
 * the image inside the crop: one finger pans, two fingers pinch to zoom.
 * Pointer Events cover mouse, touch and stylus with one code path, and
 * `touch-action: none` on the frame stops Chrome for Android from stealing
 * the drag for a page scroll.
 */
export function Stage({ onCropChange, badge = '9:16 · 1080×1920' }) {
  const canvas = el('canvas', { class: 'stage__canvas', width: 432, height: 768 });

  const hint = el('div', { class: 'stage__hint', text: 'Drag to reframe · pinch to zoom' });
  const badgeEl = el('div', { class: 'stage__badge', text: badge });

  const reset = el('button', {
    class: 'stage__reset hidden', type: 'button',
    onClick: () => { tap(); setCrop({ x: 0, y: 0, zoom: 1 }, true); },
  }, ['Reset frame']);

  const frame = el('div', { class: 'stage__frame' }, [canvas, badgeEl, hint, reset]);
  const node = el('div', { class: 'stage' }, [frame]);

  let crop = { x: 0, y: 0, zoom: 1 };
  const pointers = new Map();
  let pinchStart = null;
  let moved = false;

  function setCrop(next, fire) {
    crop = { ...crop, ...next };
    const dirty = Math.abs(crop.x) > 1e-4 || Math.abs(crop.y) > 1e-4 || crop.zoom > 1.001;
    reset.classList.toggle('hidden', !dirty);
    if (fire) {
      // The engine clamps, so adopt whatever it gives back.
      const applied = onCropChange(crop);
      if (applied) crop = { ...applied };
    }
  }

  frame.addEventListener('pointerdown', (e) => {
    frame.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: crop.zoom };
    }
  });

  frame.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const rect = frame.getBoundingClientRect();

    if (pointers.size >= 2 && pinchStart) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart.dist > 4) {
        setCrop({ zoom: pinchStart.zoom * (dist / pinchStart.dist) }, true);
      }
      moved = true;
      return;
    }

    const dx = (e.clientX - prev.x) / rect.width;
    const dy = (e.clientY - prev.y) / rect.width;  // frame-width units on both axes
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.abs(dx) + Math.abs(dy) > 0.0005) moved = true;

    // Dragging right should carry the picture right, so the sampling window
    // moves the other way.
    setCrop({ x: crop.x - dx / crop.zoom, y: crop.y - dy / crop.zoom }, true);
    if (moved) hideHint();
  });

  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (!pointers.size) moved = false;
  };
  frame.addEventListener('pointerup', end);
  frame.addEventListener('pointercancel', end);

  let hintTimer = setTimeout(hideHint, 5200);
  function hideHint() {
    clearTimeout(hintTimer);
    hint.classList.add('stage__hint--gone');
  }

  return {
    node,
    canvas,
    setBadge: (t) => { badgeEl.textContent = t; },
    setCrop: (c) => setCrop(c, false),
    getCrop: () => ({ ...crop }),
    hideHint,
  };
}
