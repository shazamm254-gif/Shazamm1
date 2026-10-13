// Google Fonts: the family list (from the backend, cached on the phone) and
// on-demand loading of the exact weight/style a layer uses.
import { api } from './api.js';
import { clearLayoutCache } from './render.js';

const LIST_KEY = 'pts.fonts.v1';
const LIST_TTL = 7 * 864e5;
const CSS2 = 'https://fonts.googleapis.com/css2';

let list = null; // [{family, category, variants:Set("400","400i",...)}]
const byName = new Map();
const loaded = new Map(); // key -> Promise<boolean>
const failed = new Set();
const listeners = new Set();

// Popular, print-friendly families shown first in the picker.
export const FEATURED = [
  'Anton', 'Bebas Neue', 'Oswald', 'Archivo Black', 'Alfa Slab One', 'Montserrat', 'Bungee', 'Abril Fatface',
  'Playfair Display', 'Lobster', 'Pacifico', 'Permanent Marker', 'Graduate', 'Black Ops One', 'Rubik Mono One',
  'Staatliches', 'League Spartan', 'Poppins', 'Righteous', 'Shrikhand', 'Yellowtail', 'Monoton', 'Bowlby One SC',
  'Big Shoulders Display', 'Teko', 'Fjalla One', 'Russo One', 'Ultra', 'Rye', 'Caveat Brush',
];

export function onFontLoaded(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setList(families) {
  list = families.map(([family, category, variants]) => ({ family, category, variants: new Set(variants.split(',')) }));
  byName.clear();
  for (const f of list) byName.set(f.family, f);
}

export async function loadFontList() {
  if (list) return list;
  try {
    const cached = JSON.parse(localStorage.getItem(LIST_KEY) || 'null');
    if (cached && Date.now() - cached.at < LIST_TTL) {
      setList(cached.families);
      return list;
    }
  } catch {
    // storage unavailable; fetch below
  }
  const res = await api.get('/api/fonts');
  setList(res.families);
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify({ at: Date.now(), families: res.families }));
  } catch {
    // quota / private mode — fine, it is re-fetched next time
  }
  return list;
}

export function fontList() {
  return list || [];
}

export function familyInfo(family) {
  return byName.get(family) || null;
}

// Real weights this family ships (no synthesized bold).
export function weightsOf(family) {
  const f = byName.get(family);
  if (!f) return [400];
  return [...new Set([...f.variants].map((v) => parseInt(v, 10)))].sort((a, b) => a - b);
}

// True only when a real italic face exists at this weight (no fake italic).
export function hasItalic(family, weight) {
  const f = byName.get(family);
  return Boolean(f && f.variants.has(`${weight}i`));
}

export function hasStyle(family, weight, italic) {
  const f = byName.get(family);
  if (!f) return !italic && weight === 400; // list not loaded yet: only assume regular
  return f.variants.has(`${weight}${italic ? 'i' : ''}`);
}

// Pick the closest real weight when switching family.
export function nearestWeight(family, weight) {
  const ws = weightsOf(family);
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0]);
}

const keyOf = (f) => `${f.family}|${f.weight}|${f.italic ? 1 : 0}`;

export function cssUrl(f) {
  const fam = encodeURIComponent(f.family).replace(/%20/g, '+');
  return `${CSS2}?family=${fam}:ital,wght@${f.italic ? 1 : 0},${f.weight}&display=block`;
}

// Load exactly this face. Resolves true when the canvas can draw with it.
export function ensureFont(f, sample = 'AaBbCc 0123') {
  const key = keyOf(f);
  if (!loaded.has(key)) {
    const p = (async () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl(f);
      const ready = new Promise((res, rej) => {
        link.onload = res;
        link.onerror = () => rej(new Error('stylesheet failed'));
      });
      document.head.appendChild(link);
      await ready;
      const spec = `${f.italic ? 'italic ' : ''}${f.weight} 64px "${f.family}"`;
      await document.fonts.load(spec, sample);
      const ok = document.fonts.check(spec, sample);
      if (!ok) throw new Error('font not available');
      failed.delete(key);
      clearLayoutCache();
      listeners.forEach((fn) => fn(f));
      return true;
    })().catch(() => {
      failed.add(key);
      loaded.delete(key); // allow a retry later
      return false;
    });
    loaded.set(key, p);
  }
  return loaded.get(key);
}

// Make sure every glyph a layer uses is loaded (Google serves unicode-range
// subsets, so the text itself has to be requested).
export async function ensureLayerFonts(layers) {
  const results = await Promise.all(
    layers
      .filter((l) => l.type === 'text')
      .map(async (l) => {
        const ok = await ensureFont(l.font, l.caps ? l.text.toUpperCase() : l.text);
        if (!ok) return false;
        const spec = `${l.font.italic ? 'italic ' : ''}${l.font.weight} 64px "${l.font.family}"`;
        const text = (l.caps ? l.text.toUpperCase() : l.text).replace(/\s+/g, '') || 'A';
        await document.fonts.load(spec, text);
        clearLayoutCache();
        return document.fonts.check(spec, text);
      }),
  );
  return results.every(Boolean);
}

export function fontFailed(f) {
  return failed.has(keyOf(f));
}

// ---- picker previews ----------------------------------------------------------
// Each name is drawn in its own typeface using a tiny glyph subset, registered
// under an ALIAS family so it can never stand in for the real font on canvas.
const previewDone = new Map();
export function previewFamily(family) {
  return `pv ${family}`;
}
export function loadPreview(family) {
  if (previewDone.has(family)) return previewDone.get(family);
  const p = (async () => {
    const url = `${CSS2}?family=${encodeURIComponent(family).replace(/%20/g, '+')}&text=${encodeURIComponent(family)}`;
    const css = await (await fetch(url)).text();
    const m = css.match(/url\((https:[^)]+)\)/);
    if (!m) return false;
    const face = new FontFace(previewFamily(family), `url(${m[1]})`);
    await face.load();
    document.fonts.add(face);
    return true;
  })().catch(() => false);
  previewDone.set(family, p);
  return p;
}
