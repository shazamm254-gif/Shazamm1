// Google Fonts family list (all Google Fonts are free for commercial use under
// OFL / Apache / UFL). Loaded from Google, cached on disk for a week, with a
// bundled snapshot as the fallback so the editor still works offline.
//
// Shape sent to the browser: { source, families: [[family, category, "400,400i,700"]] }
// where each variant token is a weight, with "i" for a real italic face.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from './store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE = 'fonts-cache.json';
const WEEK = 7 * 864e5;

function fromDeveloperApi(json) {
  return (json.items || []).map((f) => [
    f.family,
    f.category,
    f.variants.map((v) => (v === 'regular' ? '400' : v === 'italic' ? '400i' : v.replace('italic', 'i'))).join(','),
  ]);
}

function fromMetadata(json) {
  return (json.familyMetadataList || [])
    .slice()
    .sort((a, b) => (a.popularity ?? 1e9) - (b.popularity ?? 1e9))
    .map((f) => [
      f.family,
      String(f.category || '').toLowerCase().replace(/\s+/g, '-'),
      Object.keys(f.fonts || {})
        .filter((k) => /^\d{3}i?$/.test(k))
        .join(','),
    ])
    .filter((f) => f[2]);
}

async function fetchLive() {
  const key = (process.env.GOOGLE_FONTS_API_KEY || '').trim();
  if (key) {
    const res = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Google Fonts API ${res.status}`);
    return { source: 'Google Fonts Developer API', families: fromDeveloperApi(await res.json()) };
  }
  const res = await fetch('https://fonts.google.com/metadata/fonts', { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`fonts.google.com ${res.status}`);
  const text = (await res.text()).replace(/^\)\]\}'\s*/, '');
  return { source: 'fonts.google.com', families: fromMetadata(JSON.parse(text)) };
}

function bundled() {
  const snap = JSON.parse(fs.readFileSync(path.join(here, 'fonts-fallback.json'), 'utf8'));
  return { source: `bundled snapshot (${snap.source})`, families: snap.families };
}

let memo = null;

export async function getFontList() {
  if (memo && Date.now() - memo.at < WEEK) return memo;
  const disk = readJson(CACHE, null);
  if (disk && Date.now() - disk.at < WEEK && disk.families?.length) return (memo = disk);

  if (process.env.FONTS_SOURCE !== 'offline') {
    try {
      const live = await fetchLive();
      if (live.families.length > 100) {
        memo = { ...live, at: Date.now() };
        writeJson(CACHE, memo);
        return memo;
      }
    } catch {
      // fall through to the stale cache or the bundled snapshot
    }
  }
  if (disk?.families?.length) return (memo = disk);
  return (memo = { ...bundled(), at: Date.now() });
}
