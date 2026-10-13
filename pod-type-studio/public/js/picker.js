// Full-screen Google Fonts picker: search by name, filter by category, every
// name shown in its own typeface (lazy-loaded as rows scroll into view).
import { h, clear, fill, sheet, errorBox } from './ui.js';
import { loadFontList, fontList, FEATURED, previewFamily, loadPreview } from './fonts.js';

const CATEGORIES = [['all', 'All'], ['display', 'Display'], ['sans-serif', 'Sans'], ['serif', 'Serif'], ['handwriting', 'Script'], ['monospace', 'Mono']];
const PAGE = 60;

export function openFontPicker(current, onPick) {
  const search = h('input', { type: 'search', placeholder: 'Search Google Fonts', 'aria-label': 'Search fonts', autocomplete: 'off' });
  const chips = h('div', { class: 'seg wrap' });
  const listEl = h('div', { class: 'font-list' });
  const more = h('button', { class: 'btn wide hidden' }, 'Show more');
  const note = h('p', { class: 'muted small' }, 'All Google Fonts are free for commercial use.');
  let cat = 'all';
  let shown = PAGE;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const fam = e.target.dataset.family;
      io.unobserve(e.target);
      loadPreview(fam).then((ok) => {
        if (ok) e.target.style.fontFamily = `"${previewFamily(fam)}", system-ui`;
      });
    }
  }, { rootMargin: '200px' });

  function filtered() {
    const q = search.value.trim().toLowerCase();
    let fonts = fontList();
    if (cat !== 'all') fonts = fonts.filter((f) => f.category === cat);
    if (q) {
      fonts = fonts.filter((f) => f.family.toLowerCase().includes(q));
      // Names starting with the query first.
      fonts = fonts.sort((a, b) => Number(!a.family.toLowerCase().startsWith(q)) - Number(!b.family.toLowerCase().startsWith(q)));
    } else {
      const rank = new Map(FEATURED.map((n, i) => [n, i]));
      fonts = [...fonts].sort((a, b) => (rank.get(a.family) ?? 1e6) - (rank.get(b.family) ?? 1e6));
    }
    return fonts;
  }

  function paint() {
    fill(chips, ...CATEGORIES.map(([v, label]) =>
      h('button', { class: `seg-btn${v === cat ? ' active' : ''}`, onclick: () => { cat = v; shown = PAGE; paint(); } }, label)));
    const fonts = filtered();
    clear(listEl);
    for (const f of fonts.slice(0, shown)) {
      const name = h('span', { class: 'font-name', 'data-family': f.family }, f.family);
      listEl.append(h('button', {
        class: `font-row${f.family === current ? ' active' : ''}`,
        onclick: () => { s.close(); onPick(f.family); },
      }, name, h('small', { class: 'muted' }, `${f.category} · ${f.variants.size} style${f.variants.size === 1 ? '' : 's'}`)));
      io.observe(name);
    }
    if (!fonts.length) listEl.append(h('p', { class: 'muted' }, 'No fonts match that search.'));
    more.classList.toggle('hidden', fonts.length <= shown);
    more.textContent = `Show more (${fonts.length - shown} left)`;
  }

  more.addEventListener('click', () => { shown += PAGE; paint(); });
  let t = null;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { shown = PAGE; paint(); }, 150); });

  const s = sheet('Choose a font', h('div', { class: 'picker' }, search, chips, note, listEl, more), { onClose: () => io.disconnect() });
  listEl.append(h('p', { class: 'muted' }, 'Loading fonts…'));
  loadFontList().then(paint).catch((e) => fill(listEl, errorBox(e, 'Could not load the font list.')));
}
