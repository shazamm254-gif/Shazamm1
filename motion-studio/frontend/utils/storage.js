/**
 * Remembers the last settings so the second clip is faster to make than the
 * first. Wrapped because private-mode Android browsers throw on access.
 */

const KEY = 'motion-studio:prefs:v1';

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage disabled — the app works fine without it */
  }
}
