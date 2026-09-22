import { el, $, clear } from './utils/dom.js';
import { loadImage } from './utils/image.js';
import { toUserError, ACTIONS } from './utils/errors.js';
import { buildFilename } from './utils/download.js';
import { loadPrefs, savePrefs } from './utils/storage.js';
import { randomSeed } from './utils/rng.js';
import {
  DEFAULT_CONTROLS, DEFAULT_DURATION, DEFAULT_FPS, DEFAULT_TIER,
  QUALITY_TIERS, DURATIONS, FPS_OPTIONS, PREVIEW,
} from './config/app.config.js';
import { DEFAULT_CATEGORY } from './models/categories.js';
import { getPreset, DEFAULT_PRESET_ID } from './models/presets.js';
import { MotionEngine } from './video-engine/engine.js';
import { detectCapabilities } from './video-engine/encoder/encoder.js';
import { UploadScreen } from './components/screen-upload.js';
import { StudioScreen } from './components/screen-studio.js';
import { RenderScreen } from './components/screen-render.js';
import { ResultScreen } from './components/screen-result.js';
import { ErrorScreen } from './components/screen-error.js';
import { openModal } from './components/modal.js';
import { toast } from './components/toast.js';

/**
 * App shell: owns the state, swaps screens, and is the only place that knows
 * about the engine's lifecycle.
 */

const state = {
  screen: 'upload',
  image: null,
  presetId: DEFAULT_PRESET_ID,
  categoryId: DEFAULT_CATEGORY,
  controls: { ...DEFAULT_CONTROLS },
  duration: DEFAULT_DURATION,
  fps: DEFAULT_FPS,
  tierId: DEFAULT_TIER,
  seed: 1,
};

let engine = null;
let studio = null;
let renderScreen = null;
let resultScreen = null;
let lastResult = null;
let root = null;

/* ------------------------------ bootstrap ------------------------------ */

export function start() {
  root = $('#app');
  applyPrefs(loadPrefs());
  chooseDefaultTier();
  show('upload');

  // Warm the capability probe so the first render doesn't pay for it.
  detectCapabilities().catch(() => { /* reported properly at export time */ });
}

function applyPrefs(prefs) {
  if (!prefs) return;
  if (prefs.presetId && getPreset(prefs.presetId).id === prefs.presetId) {
    state.presetId = prefs.presetId;
    state.categoryId = getPreset(prefs.presetId).category;
  }
  if (prefs.controls) state.controls = { ...state.controls, ...prefs.controls };
  if (DURATIONS.includes(prefs.duration)) state.duration = prefs.duration;
  if (FPS_OPTIONS.includes(prefs.fps)) state.fps = prefs.fps;
  if (QUALITY_TIERS.some(t => t.id === prefs.tierId)) state.tierId = prefs.tierId;
}

/**
 * Start a weak device one tier down rather than letting it fail mid-render.
 * The user can always push it back up in Fine tuning.
 */
function chooseDefaultTier() {
  const mem = navigator.deviceMemory;          // Chrome/Android only; undefined elsewhere
  const cores = navigator.hardwareConcurrency || 4;
  if ((mem && mem <= 2) || cores <= 2) state.tierId = 'low';
  else if (mem && mem <= 4) state.tierId = 'medium';
}

function persist() {
  savePrefs({
    presetId: state.presetId,
    controls: state.controls,
    duration: state.duration,
    fps: state.fps,
    tierId: state.tierId,
  });
}

/* ------------------------------- screens ------------------------------- */

function mount(node) {
  clear(root);
  root.append(appbar(), node);
}

function appbar() {
  const back = state.screen !== 'upload'
    ? el('button', {
        class: 'iconbtn', type: 'button', 'aria-label': 'Back',
        onClick: () => (state.screen === 'studio' ? resetToUpload() : show('studio')),
      }, ['‹'])
    : el('div', { class: 'appbar__mark', 'aria-hidden': 'true' });

  return el('header', { class: 'appbar' }, [
    back,
    el('div', {}, [
      el('div', { class: 'appbar__title', text: 'Motion Studio' }),
      el('div', { class: 'appbar__sub', text: subtitleFor(state.screen) }),
    ]),
    el('div', { class: 'appbar__spacer' }),
    el('button', {
      class: 'iconbtn', type: 'button', 'aria-label': 'About',
      onClick: showAbout,
    }, ['?']),
  ]);
}

function subtitleFor(screen) {
  if (screen === 'upload') return 'Create motion';
  if (screen === 'studio') return getPreset(state.presetId).name;
  if (screen === 'render') return 'Rendering…';
  if (screen === 'result') return 'Your clip';
  return '';
}

function show(screen) {
  state.screen = screen;
  if (screen !== 'result' && resultScreen) { resultScreen.dispose(); resultScreen = null; }

  if (screen === 'upload') {
    mount(UploadScreen({ onPick: handlePick }));
  } else if (screen === 'studio') {
    mountStudio();
  }
}

function resetToUpload() {
  if (engine) { engine.dispose(); engine = null; }
  studio = null;
  state.image = null;
  show('upload');
}

/* ------------------------------- upload -------------------------------- */

async function handlePick(file) {
  try {
    toast('Reading image…', { ms: 1200 });
    const image = await loadImage(file);
    state.image = image;
    state.seed = randomSeed();
    await mountStudio(image);
  } catch (err) {
    showError(toUserError(err));
  }
}

async function mountStudio() {
  state.screen = 'studio';

  const first = !studio;
  if (first) {
    studio = StudioScreen({
      state,
      onCropChange: (crop) => (engine ? engine.setCrop(crop) : crop),
      onChange: handleControlChange,
      onGenerate: generate,
    });
  }
  mount(studio.node);

  if (!engine) {
    try {
      engine = new MotionEngine(studio.canvas);
    } catch (err) {
      showError(toUserError(err));
      return;
    }
    try {
      await engine.setImage(state.image.bitmap);
    } catch (err) {
      showError(toUserError(err));
      return;
    }
    warnIfHeavyCrop();
  }

  engine.setMotion({
    preset: getPreset(state.presetId),
    controls: state.controls,
    duration: state.duration,
    seed: state.seed,
  });
  exposeForTests();
  studio.sync(state);
  studio.setCrop(engine.crop);
  studio.setBusy(false);

  engine.renderPoster();
  engine.startPreview();
}

function warnIfHeavyCrop() {
  const { width, height } = state.image;
  const r = width / height;
  if (r > 1.45) {
    toast('Wide image — drag the preview to choose what stays in frame', { ms: 4200 });
  }
}

/* ------------------------------- controls ------------------------------ */

let restartTimer = 0;

function handleControlChange(patch, { quiet = false } = {}) {
  if (patch.presetId) {
    state.presetId = patch.presetId;
    state.categoryId = getPreset(patch.presetId).category;
  }
  if (patch.categoryId) state.categoryId = patch.categoryId;
  if (patch.duration != null) state.duration = patch.duration;
  if (patch.fps != null) state.fps = patch.fps;
  if (patch.tierId) state.tierId = patch.tierId;

  for (const key of ['strength', 'smoothness', 'cameraSpeed', 'effectIntensity']) {
    if (patch[key] != null) state.controls[key] = patch[key];
  }

  if (!engine) return;
  engine.setMotion({
    preset: getPreset(state.presetId),
    controls: state.controls,
    duration: state.duration,
  });
  studio.sync(state);

  // Restarting the preview on a preset change makes the move readable from
  // its start; dragging a slider should not keep snapping it back.
  if (!quiet) engine.restartPreview();

  clearTimeout(restartTimer);
  restartTimer = setTimeout(persist, 400);
}

/* ------------------------------- generate ------------------------------ */

async function generate() {
  if (!engine) return;
  studio.setBusy(true);

  renderScreen = RenderScreen({ onCancel: () => engine.cancelExport() });
  state.screen = 'render';
  mount(renderScreen.node);

  const caps = await detectCapabilities().catch(() => null);
  if (caps && !(caps.webcodecs && caps.h264) && caps.mediaRecorderMp4) {
    renderScreen.setNote(
      'This browser records in real time, so a ' + state.duration +
      '-second clip takes about ' + state.duration + ' seconds.');
  }

  try {
    const out = await engine.exportVideo({
      fps: state.fps,
      tierId: state.tierId,
      onProgress: p => renderScreen.update(p),
    });

    const filename = buildFilename(state.image.name, state.presetId, out.extension);
    if (out.tierId && out.tierId !== state.tierId) {
      const tier = QUALITY_TIERS.find(t => t.id === out.tierId);
      toast(`Rendered at ${tier.label} so your device could keep up`, { ms: 4200 });
    }
    lastResult = { ...out, filename };
    window.__lastResult = lastResult;
    showResult(lastResult);
    persist();
  } catch (err) {
    if (String(err && err.message) === 'Cancelled') {
      toast('Render cancelled');
      await mountStudio();
      return;
    }
    showError(toUserError(err));
  }
}

function showResult(result) {
  state.screen = 'result';
  resultScreen = ResultScreen({
    result,
    presetName: getPreset(state.presetId).name,
    baseName: state.image.name,
    onRegenerate: async () => {
      state.seed = randomSeed();
      engine.setMotion({ seed: state.seed });
      await mountStudio();
      generate();
    },
    onAdjust: () => mountStudio(),
    onNewImage: resetToUpload,
  });
  mount(resultScreen.node);
}

/* -------------------------------- errors ------------------------------- */

function showError(error) {
  if (error.cause) console.error('[motion-studio]', error.cause);
  state.screen = 'error';

  mount(ErrorScreen({
    error,
    handlers: {
      [ACTIONS.RETRY]: () => (state.image ? generate() : show('upload')),
      [ACTIONS.SETTINGS]: () => mountStudio(),
      [ACTIONS.NEW_IMAGE]: resetToUpload,
      [ACTIONS.LOWER_QUALITY]: () => {
        const i = QUALITY_TIERS.findIndex(t => t.id === state.tierId);
        state.tierId = QUALITY_TIERS[Math.min(QUALITY_TIERS.length - 1, i + 1)].id;
        toast(`Quality set to ${QUALITY_TIERS.find(t => t.id === state.tierId).label}`);
        generate();
      },
    },
  }));
}

/* ------------------------------ test hooks ----------------------------- */

/**
 * A small surface for the end-to-end test in tests/e2e.mjs, which drives the
 * real app in a real browser rather than mocking the engine. Read-only from
 * the app's point of view — nothing in the UI depends on it.
 */
function exposeForTests() {
  window.__engine = engine;
  window.__lastResult = lastResult;
  window.__state = state;
  window.__setPreset = (id) => handleControlChange({ presetId: id });
}

/* -------------------------------- about -------------------------------- */

async function showAbout() {
  const caps = await detectCapabilities().catch(() => null);
  const encoder = !caps ? 'unknown'
    : caps.webcodecs && caps.h264 ? `WebCodecs H.264 (${caps.h264})`
    : caps.mediaRecorderMp4 ? 'MediaRecorder H.264 / MP4'
    : caps.webcodecs && caps.vp9 ? 'WebCodecs VP9 / MP4'
    : caps.mediaRecorderWebm ? 'MediaRecorder VP9 / WebM'
    : 'none available';

  openModal({
    title: 'About Motion Studio',
    body: [
      el('p', { text: 'A free image-to-video motion tool that runs entirely in your browser. No upload, no account, no API key. Your image never leaves the device.' }),
      el('p', { html: `<b>Encoder on this device:</b> ${encoder}` }),
      el('p', { html: `<b>Preview:</b> ${PREVIEW.width}×${PREVIEW.height} · <b>Export:</b> up to 1080×1920` }),
      el('p', { html: 'Motion comes from a depth-displaced camera move plus GPU particles and atmosphere — not from a generative model, which is why faces and hands stay intact.' }),
    ],
  });
}
