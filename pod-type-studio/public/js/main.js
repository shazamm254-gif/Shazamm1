// Hash router. Screens: designs, new, editor, product picker, publish, draft, history, settings.
import { api, setLockedHandler } from './api.js';
import { clear, fill, errorBox } from './ui.js';
import { homeScreen, newScreen, settingsScreen, lockScreen } from './screens.js';
import { openEditor } from './editor.js';
import { productScreen } from './product.js';
import { publishScreen, draftScreen, historyScreen } from './publish.js';

const root = document.getElementById('app');
let settings = null;
let cleanup = null;
let locked = false;

const nav = (hash) => {
  if (location.hash === hash) route();
  else location.hash = hash;
};

async function reloadSettings() {
  settings = await api.get('/api/settings');
  return settings;
}

setLockedHandler(() => {
  if (locked) return;
  locked = true;
  runCleanup();
  lockScreen(root, () => {
    locked = false;
    start();
  });
});

function runCleanup() {
  if (cleanup) {
    try {
      cleanup();
    } catch {
      // ignore
    }
    cleanup = null;
  }
}

async function route() {
  if (locked) return;
  runCleanup();
  window.scrollTo(0, 0);
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  try {
    if (!settings) await reloadSettings();
    switch (parts[0]) {
      case undefined:
        return await homeScreen(root, nav);
      case 'new':
        return await newScreen(root, nav, settings);
      case 'edit':
        cleanup = await openEditor(root, parts[1], nav);
        return;
      case 'product':
        return await productScreen(root, nav, parts[1], { isNew: params.has('new'), settings, reloadSettings });
      case 'publish':
        return await publishScreen(root, nav, parts[1], { settings, reloadSettings });
      case 'draft':
        cleanup = await draftScreen(root, nav, parts[1], parts[2]);
        return;
      case 'history':
        return await historyScreen(root, nav);
      case 'settings':
        return await settingsScreen(root, nav, reloadSettings);
      default:
        nav('#/');
    }
  } catch (e) {
    if (!locked) fill(root, errorBox(e), Object.assign(document.createElement('a'), { href: '#/', className: 'btn wide', textContent: 'Back to designs' }));
  }
}

async function start() {
  try {
    const st = await api.get('/api/auth/status');
    if (!st.authed) {
      locked = true;
      return lockScreen(root, () => {
        locked = false;
        start();
      });
    }
    settings = null;
    route();
  } catch (e) {
    fill(root, errorBox(e));
  }
}

window.addEventListener('hashchange', route);
start();
