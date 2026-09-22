import { el, tap } from '../utils/dom.js';
import { canShareFiles, makeFile, downloadBlob, shareFile, formatSize } from '../utils/download.js';
import { toast } from './toast.js';

/**
 * Screen 4 — preview and download.
 *
 * Download is the loudest thing on the screen, per the brief. Share is
 * offered next to it because on Android it hands the file straight to
 * TikTok/Instagram without a trip through the gallery.
 */
export function ResultScreen({ result, presetName, baseName, onRegenerate, onAdjust, onNewImage }) {
  const url = URL.createObjectURL(result.blob);

  const video = el('video', {
    class: 'result__video',
    src: url,
    controls: true,
    loop: true,
    autoplay: true,
    muted: true,
    playsinline: true,
    'webkit-playsinline': true,
    preload: 'auto',
  });
  video.muted = true;               // attribute alone is not enough on some builds
  video.play().catch(() => { /* autoplay blocked: the controls still work */ });

  const isMp4 = result.extension === 'mp4';

  const downloadBtn = el('button', {
    class: 'btn btn--primary', type: 'button',
    onClick: async () => {
      tap(14);
      downloadBlob(result.blob, result.filename);
      toast('Saved to your Downloads folder');
    },
  }, [`⬇  DOWNLOAD ${result.extension.toUpperCase()}`]);

  const actions = [
    downloadBtn,
    el('div', { class: 'result__row' }, [
      el('button', { class: 'btn btn--row', type: 'button', onClick: () => { tap(); onAdjust(); } }, ['⚙ Adjust']),
      el('button', { class: 'btn btn--row', type: 'button', onClick: () => { tap(); onRegenerate(); } }, ['🔄 Regenerate']),
    ]),
    el('button', { class: 'btn btn--ghost', type: 'button', onClick: () => { tap(); onNewImage(); } }, ['🖼 Use another image']),
  ];

  // Share, when the platform can share a file of this type.
  const file = makeFile(result.blob, result.filename, result.mimeType);
  if (file && canShareFiles(file)) {
    actions.splice(1, 0, el('button', {
      class: 'btn', type: 'button',
      onClick: async () => {
        tap();
        try {
          await shareFile(file, presetName);
        } catch (e) {
          if (e && e.name !== 'AbortError') toast('Sharing was not available', { error: true });
        }
      },
    }, ['📤  Share to an app']));
  }

  const warnings = [];

  if (!isMp4) {
    warnings.push(
      'This browser could not encode H.264, so the clip is a WebM. YouTube accepts it as-is; ' +
      'for TikTok or Instagram, open the app in Chrome for Android to get an MP4.');
  }

  // Be straight about a choppy result rather than quietly shipping it.
  if (result.degraded) {
    const achieved = Math.max(1, Math.round(result.frames / result.duration));
    warnings.push(
      `Your device rendered about ${achieved} fps instead of ${result.fps}, so this clip ` +
      `is choppier than it should be. Lower the Quality in Fine tuning and try again.`);
  }

  const warn = warnings.length
    ? el('div', { class: 'result__warn' }, [warnings.join(' ')])
    : null;

  const node = el('section', { class: 'screen result' }, [
    el('div', { class: 'result__stage' }, [video]),
    el('div', { class: 'result__meta' }, [
      el('span', { text: `${result.width}×${result.height}` }),
      el('span', { text: `${result.duration}s` }),
      el('span', { text: `${result.fps} fps` }),
      el('span', { text: formatSize(result.blob.size) }),
      el('span', { text: presetName }),
    ]),
    el('div', { class: 'result__actions' }, [warn, ...actions].filter(Boolean)),
  ]);

  return {
    node,
    dispose() {
      try { video.pause(); } catch { /* already gone */ }
      URL.revokeObjectURL(url);
    },
  };
}
