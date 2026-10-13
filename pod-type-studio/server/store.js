// Server-side JSON storage. Everything secret (the Printify token, the passcode
// hash, session ids) lives here or in env vars — never in the browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(here, '..', 'data'));

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

function file(name) {
  return path.join(DATA_DIR, name);
}

export function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch {
    return fallback;
  }
}

// Write to a temp file then rename, so a crash mid-write never leaves a
// half-written settings file. Mode 0600: only the server's user can read it.
export function writeJson(name, value) {
  const target = file(name);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, target);
}

// ---- settings -------------------------------------------------------------

const SETTINGS = 'settings.json';

export function getSettings() {
  return readJson(SETTINGS, {});
}

export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch };
  for (const [k, v] of Object.entries(next)) if (v === undefined) delete next[k];
  writeJson(SETTINGS, next);
  return next;
}

// The token comes from the PRINTIFY_API_TOKEN env var if set, otherwise from
// the token saved through the Settings screen. Callers get the value only to
// put it in an Authorization header — it is never returned to the client.
export function getPrintifyToken() {
  const env = (process.env.PRINTIFY_API_TOKEN || '').trim();
  if (env) return env;
  return getSettings().printifyToken || '';
}

export function tokenSource() {
  if ((process.env.PRINTIFY_API_TOKEN || '').trim()) return 'env';
  return getSettings().printifyToken ? 'settings' : null;
}

// ---- history of products this app created -----------------------------------

const HISTORY = 'history.json';

export function getHistory() {
  return readJson(HISTORY, []);
}

export function addHistory(entry) {
  const list = getHistory().filter((h) => h.productId !== entry.productId);
  list.unshift(entry);
  writeJson(HISTORY, list);
  return entry;
}

export function updateHistory(productId, patch) {
  const list = getHistory();
  const item = list.find((h) => h.productId === productId);
  if (!item) return null;
  Object.assign(item, patch);
  writeJson(HISTORY, list);
  return item;
}

export function findHistory(productId) {
  return getHistory().find((h) => h.productId === productId) || null;
}
