import { el, tap } from '../utils/dom.js';
import { UPLOAD } from '../config/app.config.js';
import { openModal } from './modal.js';

/**
 * Screen 1 — Create Motion.
 *
 * Three ways in, because Android's file picker behaves differently across
 * Chrome, Firefox and Samsung Internet: a plain picker (which offers Gallery,
 * Files and Drive), and a `capture` input that jumps straight to the camera.
 */
export function UploadScreen({ onPick }) {
  const picker = el('input', {
    type: 'file',
    accept: UPLOAD.accept,
    class: 'hidden',
    onChange: (e) => handle(e.target.files),
  });

  const camera = el('input', {
    type: 'file',
    accept: 'image/*',
    capture: 'environment',
    class: 'hidden',
    onChange: (e) => handle(e.target.files),
  });

  function handle(files) {
    if (files && files[0]) onPick(files[0]);
    picker.value = '';
    camera.value = '';
  }

  const zone = el('div', {
    class: 'dropzone',
    role: 'button',
    tabindex: '0',
    onClick: () => { tap(); picker.click(); },
    onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') picker.click(); },
    onDragover: (e) => { e.preventDefault(); zone.classList.add('dropzone--over'); },
    onDragleave: () => zone.classList.remove('dropzone--over'),
    onDrop: (e) => {
      e.preventDefault();
      zone.classList.remove('dropzone--over');
      handle(e.dataTransfer && e.dataTransfer.files);
    },
  }, [
    el('div', { class: 'dropzone__icon', text: '🖼', 'aria-hidden': 'true' }),
    el('div', { class: 'dropzone__title', text: 'Upload Image' }),
    el('div', { class: 'dropzone__meta', text: `JPG · PNG · WEBP · up to ${Math.round(UPLOAD.maxBytes / 1048576)} MB` }),
  ]);

  return el('section', { class: 'screen' }, [
    el('div', { class: 'upload' }, [
      el('div', { class: 'upload__hero' }, [
        el('h1', { class: 'upload__title', html: 'Turn a still into <em>motion</em>' }),
        el('p', { class: 'upload__lead', text: 'Pick an image, pick a move, get a 9:16 clip. Everything runs on your phone.' }),
      ]),

      zone,

      el('div', { class: 'upload__actions' }, [
        el('button', {
          class: 'btn btn--row', type: 'button',
          onClick: () => { tap(); picker.click(); },
        }, ['📁 Gallery']),
        el('button', {
          class: 'btn btn--row', type: 'button',
          onClick: () => { tap(); camera.click(); },
        }, ['📷 Camera']),
      ]),

      el('ul', { class: 'upload__points' }, [
        point('⚡', 'No upload, no account', 'Your image never leaves the device.'),
        point('🎞', '1080 × 1920 MP4', 'Ready for Shorts, Reels and TikTok.'),
        point('🧊', 'Real depth parallax', 'Not just a zoom on a flat photo.'),
      ]),

      el('button', {
        class: 'btn btn--ghost', type: 'button',
        onClick: () => openModal({ title: 'How it works', body: helpBody() }),
      }, ['How it works']),

      picker, camera,
    ]),
  ]);
}

function point(icon, title, text) {
  return el('li', {}, [
    el('span', { text: icon, 'aria-hidden': 'true' }),
    el('span', {}, [el('b', { text: title }), ' — ', text]),
  ]);
}

function helpBody() {
  return [
    el('p', { text: 'Motion Studio builds the video on your phone using its GPU. Nothing is uploaded and nothing costs anything.' }),
    el('ol', {}, [
      el('li', { html: '<b>Upload</b> an AI still, a render or a photo.' }),
      el('li', { html: '<b>Reframe</b> it by dragging and pinching inside the 9:16 preview.' }),
      el('li', { html: '<b>Pick a motion</b> — camera moves, parallax, weather, particles, atmosphere.' }),
      el('li', { html: '<b>Create Video</b>, then <b>Download MP4</b>. It lands in your Downloads folder.' }),
    ]),
    el('p', { html: 'The preview is live: what it shows is what renders. <b>Motion Strength</b> scales the move, <b>Smoothness</b> controls how gently it starts and stops.' }),
    el('p', { html: 'Tip: portrait or square images crop least into 9:16. Wide landscape images lose their sides — drag to choose which part stays.' }),
  ];
}
