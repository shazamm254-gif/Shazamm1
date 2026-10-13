// Printify flow: shop -> colors/sizes -> title/description/price -> export ->
// push as DRAFT -> mockups -> one deliberate, confirmed publish -> history.
import { h, clear, fill, toast, dialog, errorBox, downloadBlob, safeFileName, money } from './ui.js';
import { api } from './api.js';
import { db } from './db.js';
import { exportPng, renderThumbnail } from './render.js';
import { isEmpty, warningsFor } from './model.js';
import { ensureLayerFonts } from './fonts.js';
import { colorHex } from './colors.js';
import { applyProduct, productFromVariants } from './product.js';
import { bottomNav } from './screens.js';

const MAX_VARIANTS = 100; // Printify's per-product variant limit

export async function publishScreen(root, nav, designId, { settings, reloadSettings }) {
  const record = await db.get(designId);
  if (!record) return fill(root, errorBox({ message: 'Design not found.' }));
  const design = record.design;
  const body = h('main', { class: 'page' });
  fill(root, 
    h('header', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back to editor', onclick: () => nav(`#/edit/${designId}`) }, '←'),
      h('h1', {}, 'Push to Printify')),
    body,
  );

  const pngBtn = () => h('button', { class: 'btn wide', onclick: downloadPng }, '⬇ Download PNG (manual upload fallback)');
  async function downloadPng() {
    if (isEmpty(design)) return toast('The canvas is empty.');
    toast('Rendering full-size PNG…');
    try {
      if (!(await ensureLayerFonts(design.layers))) throw new Error('A font did not load, so the PNG would not match the screen. Check your connection.');
      downloadBlob(await exportPng(design), safeFileName(design.name, 'png'));
    } catch (e) {
      dialog({ title: 'Export failed', body: errorBox(e) });
    }
  }

  if (!settings.printify.connected) {
    body.append(h('section', { class: 'card' },
      h('p', {}, 'Printify is not connected yet.'),
      h('button', { class: 'btn primary wide', onclick: () => nav('#/settings') }, 'Connect in Settings'),
      pngBtn()));
    return;
  }
  const product = design.canvas.product;
  if (!product || design.canvas.provisional) {
    body.append(h('section', { class: 'card' },
      h('p', {}, 'Pick the product first, so the artwork matches its real print area.'),
      h('button', { class: 'btn primary wide', onclick: () => nav(`#/product/${designId}`) }, 'Pick product'),
      pngBtn()));
    return;
  }

  const state = {
    shops: [],
    shopId: settings.lastShopId,
    variants: [],
    selected: new Set(),
    title: '',
    description: settings.prefs.description,
    price: (settings.prefs.priceCents / 100).toFixed(2),
  };

  const shopSec = h('section', { class: 'card' }, h('h2', {}, '1. Shop'), h('p', { class: 'muted' }, 'Loading your shops…'));
  const areaSec = h('section', { class: 'card hidden' });
  const varSec = h('section', { class: 'card' }, h('h2', {}, '2. Colors & sizes'), h('p', { class: 'muted' }, 'Loading colors and sizes…'));
  const detSec = h('section', { class: 'card' });
  const artSec = h('section', { class: 'card' });
  const actSec = h('section', { class: 'card sticky-actions' });
  body.append(shopSec, areaSec, varSec, detSec, artSec, actSec);

  // ---- shop ----
  api.get('/api/printify/shops').then((shops) => {
    state.shops = shops;
    if (!shops.some((s) => s.id === state.shopId)) state.shopId = shops[0]?.id ?? null;
    const sel = h('select', { 'aria-label': 'Shop' }, shops.map((s) => h('option', { value: s.id, selected: s.id === state.shopId }, `${s.title} (${s.salesChannel})`)));
    sel.addEventListener('change', () => {
      state.shopId = Number(sel.value);
      api.patch('/api/settings', { lastShopId: state.shopId }).catch(() => {});
      paintActions();
    });
    fill(shopSec, h('h2', {}, '1. Shop'), shops.length ? sel : h('p', {}, 'No shops found in your Printify account.'));
    paintActions();
  }).catch((e) => fill(shopSec, h('h2', {}, '1. Shop'), errorBox(e)));

  // ---- variants (live from the API) ----
  async function loadVariants() {
    try {
      const v = await api.get(`/api/printify/blueprints/${product.blueprintId}/providers/${product.printProviderId}/variants?position=${encodeURIComponent(product.position)}`);
      state.variants = v.variants;
      const live = productFromVariants(product, v);
      if (live && (live.width !== design.canvas.width || live.height !== design.canvas.height)) {
        areaSec.classList.remove('hidden');
        fill(areaSec, h('h2', {}, 'Print area changed'),
          h('p', {}, `Printify now reports ${live.width}×${live.height}px for this product, but the design is ${design.canvas.width}×${design.canvas.height}px.`),
          h('button', { class: 'btn primary wide', onclick: async () => {
            applyProduct(design, live);
            record.updatedAt = design.updatedAt = new Date().toISOString();
            record.thumb = renderThumbnail(design);
            await db.put(record);
            toast('Design resized — check it in the editor');
            areaSec.classList.add('hidden');
            paintArt();
            paintActions();
          } }, 'Resize design to match'));
      }
      const sold = new Set(settings.prefs.soldColors.map((c) => c.toLowerCase()));
      for (const x of v.variants) if (x.color && sold.has(x.color.toLowerCase()) && x.available !== false) state.selected.add(x.id);
      paintVariants();
      paintDetails();
    } catch (e) {
      fill(varSec, h('h2', {}, '2. Colors & sizes'), errorBox(e));
    }
  }

  function paintVariants() {
    const byColor = new Map();
    for (const v of state.variants) {
      const c = v.color || 'Default';
      if (!byColor.has(c)) byColor.set(c, []);
      byColor.get(c).push(v);
    }
    const count = h('p', { class: 'count' });
    const updateCount = () => {
      const n = state.selected.size;
      count.textContent = `${n} variant${n === 1 ? '' : 's'} selected`;
      count.classList.toggle('warn-text', n > MAX_VARIANTS);
      if (n > MAX_VARIANTS) count.textContent += ` — Printify allows up to ${MAX_VARIANTS} per product; untick some.`;
      paintDetails();
      paintActions();
    };
    const sold = new Set(settings.prefs.soldColors.map((c) => c.toLowerCase()));
    const anySold = state.variants.some((v) => v.color && sold.has(v.color.toLowerCase()));
    const list = h('div', { class: 'color-list' });
    for (const [color, vs] of byColor) {
      const all = h('input', { type: 'checkbox', 'aria-label': `All ${color}` });
      const syncAll = () => {
        const on = vs.filter((v) => state.selected.has(v.id)).length;
        all.checked = on === vs.length;
        all.indeterminate = on > 0 && on < vs.length;
      };
      const sizes = h('div', { class: 'size-chips' }, vs.map((v) => {
        const chip = h('button', { class: `chip${state.selected.has(v.id) ? ' on' : ''}${v.available === false ? ' out' : ''}`, 'aria-pressed': String(state.selected.has(v.id)) }, v.size || v.title);
        chip.addEventListener('click', () => {
          state.selected.has(v.id) ? state.selected.delete(v.id) : state.selected.add(v.id);
          chip.classList.toggle('on', state.selected.has(v.id));
          chip.setAttribute('aria-pressed', String(state.selected.has(v.id)));
          syncAll();
          updateCount();
        });
        return chip;
      }));
      all.addEventListener('change', () => {
        vs.forEach((v) => (all.checked ? state.selected.add(v.id) : state.selected.delete(v.id)));
        sizes.querySelectorAll('.chip').forEach((c, i) => {
          c.classList.toggle('on', state.selected.has(vs[i].id));
          c.setAttribute('aria-pressed', String(state.selected.has(vs[i].id)));
        });
        syncAll();
        updateCount();
      });
      syncAll();
      list.append(h('div', { class: 'color-row-item' },
        h('label', { class: 'color-head' }, all, h('span', { class: 'dot', style: { background: colorHex(color) } }), h('span', {}, color)),
        sizes));
    }
    fill(varSec, h('h2', {}, '2. Colors & sizes'),
      anySold ? null : h('p', { class: 'warn-text' }, 'None of your usual colors are offered for this product — tick the ones you want.'),
      count,
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: async () => {
          const colors = [...new Set(state.variants.filter((v) => state.selected.has(v.id)).map((v) => v.color).filter(Boolean))];
          try {
            await api.patch('/api/settings', { prefs: { soldColors: colors } });
            await reloadSettings();
            toast('Saved as your usual colors');
          } catch (e) {
            dialog({ title: 'Could not save', body: errorBox(e) });
          }
        } }, 'Save ticked colors as my usual'),
        h('button', { class: 'btn small', onclick: () => { state.selected.clear(); paintVariants(); } }, 'Clear all')),
      list);
    updateCount();
  }

  // ---- details: title / description / price (+ margin only from real cost data) ----
  let detailsBuilt = false;
  const titleIn = h('input', { type: 'text', maxlength: 140, placeholder: 'Product title (required)', 'aria-label': 'Product title' });
  const descIn = h('textarea', { rows: 6, 'aria-label': 'Description' });
  const priceIn = h('input', { type: 'number', inputmode: 'decimal', step: '0.01', min: '0.5', 'aria-label': 'Retail price in dollars' });
  const marginEl = h('div', { class: 'margin' });
  titleIn.addEventListener('input', () => { state.title = titleIn.value; paintActions(); });
  descIn.addEventListener('input', () => { state.description = descIn.value; });
  priceIn.addEventListener('input', () => { state.price = priceIn.value; paintMargin(); paintActions(); });

  function paintDetails() {
    if (!detailsBuilt) {
      detailsBuilt = true;
      titleIn.value = state.title;
      descIn.value = state.description;
      priceIn.value = state.price;
      fill(detSec, h('h2', {}, '3. Title, description, price'),
        h('label', { class: 'field-label' }, 'Title *'), titleIn,
        h('label', { class: 'field-label' }, 'Description ({title} becomes your title)'), descIn,
        h('label', { class: 'field-label' }, 'Retail price (USD, every selected variant)'), priceIn,
        marginEl);
    }
    paintMargin();
  }

  function paintMargin() {
    const cents = Math.round(Number(state.price) * 100);
    const costs = state.variants.filter((v) => state.selected.has(v.id) && typeof v.cost === 'number').map((v) => v.cost);
    clear(marginEl);
    if (!costs.length) {
      marginEl.append(h('p', { class: 'muted small' }, 'Printify’s catalog doesn’t include production cost here. You’ll see the real cost and margin per variant on the draft screen.'));
      return;
    }
    const lo = Math.min(...costs), hi = Math.max(...costs);
    marginEl.append(h('p', {}, `Cost ${money(lo)}${hi !== lo ? `–${money(hi)}` : ''} · est. margin ${money(cents - hi)}${hi !== lo ? `–${money(cents - lo)}` : ''}`),
      h('p', { class: 'muted small' }, 'Before shipping and marketplace fees.'));
  }

  // ---- artwork ----
  function paintArt() {
    const warns = warningsFor(design).filter((w) => w.kind !== 'size');
    fill(artSec, h('h2', {}, '4. Artwork'),
      h('div', { class: 'art-preview checker' }, h('img', { src: renderThumbnail(design, 600, { transparent: true }), alt: 'Artwork preview' })),
      h('p', {}, `Exports at exactly ${design.canvas.width}×${design.canvas.height}px (${product.blueprintTitle}, ${product.position}), transparent background.`),
      warns.length ? h('details', { class: 'warn-details' }, h('summary', {}, `⚠ ${warns.length} print warning${warns.length === 1 ? '' : 's'} (not blocking)`), h('ul', {}, warns.map((w) => h('li', {}, w.text)))) : null,
      pngBtn());
  }

  // ---- actions ----
  const progress = h('ol', { class: 'progress' });
  const resultEl = h('div');
  function blockers() {
    const out = [];
    if (isEmpty(design)) out.push('The canvas is empty — add some words first.');
    if (!state.title.trim()) out.push('Add a product title.');
    if (!state.shopId) out.push('Pick a shop.');
    if (!state.selected.size) out.push('Tick at least one color/size.');
    if (!(Number(state.price) > 0)) out.push('Enter a price.');
    return out;
  }
  function paintActions() {
    const b = blockers();
    fill(actSec, 
      b.length ? h('ul', { class: 'blockers' }, b.map((x) => h('li', {}, x))) : null,
      h('button', { class: 'btn primary wide', disabled: Boolean(b.length), onclick: push }, 'Create DRAFT in Printify'),
      h('p', { class: 'muted small' }, 'This creates a draft only. Nothing goes live until you confirm Publish on the next screen.'),
      progress, resultEl);
  }

  async function push() {
    if (blockers().length) return;
    const btn = actSec.querySelector('button.primary');
    btn.disabled = true;
    clear(resultEl);
    clear(progress);
    const step = (text) => {
      progress.querySelectorAll('li').forEach((li) => li.classList.add('done'));
      progress.append(h('li', {}, text));
    };
    try {
      step('Loading fonts…');
      if (!(await ensureLayerFonts(design.layers))) throw new Error('A font did not load, so the export would not match the screen. Check your connection and try again.');
      step(`Rendering ${design.canvas.width}×${design.canvas.height}px PNG…`);
      const blob = await exportPng(design);
      if (blob.size > 5 * 1024 * 1024) step(`PNG is ${(blob.size / 1048576).toFixed(1)} MB — large uploads can take a while…`);
      const pngBase64 = await blobToBase64(blob);
      step('Uploading to Printify and creating the draft…');
      const shop = state.shops.find((s) => s.id === state.shopId);
      const title = state.title.trim();
      const res = await api.post('/api/printify/products', {
        shopId: state.shopId,
        shopTitle: shop?.title || '',
        blueprintId: product.blueprintId,
        blueprintTitle: product.blueprintTitle,
        printProviderId: product.printProviderId,
        position: product.position,
        variantIds: [...state.selected],
        title,
        description: state.description.replaceAll('{title}', title),
        priceCents: Math.round(Number(state.price) * 100),
        pngBase64,
        designId: design.id,
      });
      step('Draft created ✓');
      progress.querySelectorAll('li').forEach((li) => li.classList.add('done'));
      nav(`#/draft/${state.shopId}/${res.product.id}`);
    } catch (e) {
      const upload = /upload/i.test(e.message);
      resultEl.append(errorBox(e, upload ? 'Printify rejected the upload — try again.' : 'The draft was not created.'));
      btn.disabled = false;
    }
  }

  paintDetails();
  paintArt();
  paintActions();
  loadVariants();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Could not read the exported PNG.'));
    r.readAsDataURL(blob);
  });
}

// ---- draft / product status screen ----------------------------------------------------

export async function draftScreen(root, nav, shopId, productId) {
  const body = h('main', { class: 'page' });
  fill(root, 
    h('header', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => nav('#/history') }, '←'),
      h('h1', {}, 'Your product')),
    body, bottomNav('#/history'));

  let alive = true;
  let polls = 0;
  let timer = null;
  const stop = () => {
    alive = false;
    clearTimeout(timer);
  };

  async function load() {
    try {
      const res = await api.get(`/api/printify/products/${shopId}/${productId}`);
      if (!alive) return;
      paint(res);
      const waitingMockups = !res.product.images.length && polls < 20;
      const waitingLive = res.status === 'publishing' && polls < 40;
      if (waitingMockups || waitingLive) {
        polls++;
        timer = setTimeout(load, waitingLive ? 4000 : 3000);
      }
    } catch (e) {
      if (alive) fill(body, errorBox(e), h('button', { class: 'btn wide', onclick: load }, 'Try again'));
    }
  }

  function paint({ product: p, status, liveUrl }) {
    const badge = { draft: 'Draft', publishing: 'Publishing…', published: 'Published' }[status] || status;
    const gallery = p.images.length
      ? h('div', { class: 'gallery' }, sortImages(p.images).slice(0, 12).map((i) => h('img', { src: i.src, alt: `Mockup ${i.position}`, loading: 'lazy' })))
      : h('div', { class: 'gallery-empty' }, h('p', {}, 'Printify is generating mockups…'), h('div', { class: 'spinner' }));

    const costs = p.variants.filter((v) => typeof v.cost === 'number');
    const pricing = costs.length
      ? h('div', {},
        h('h2', {}, 'Cost & margin'),
        h('p', { class: 'muted small' }, 'Cost is what Printify charges you per item (from the API). Margin is before shipping and marketplace fees.'),
        h('table', { class: 'price-table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Variant'), h('th', {}, 'Price'), h('th', {}, 'Cost'), h('th', {}, 'Margin'))),
          h('tbody', {}, costs.map((v) => h('tr', {}, h('td', {}, v.title), h('td', {}, money(v.price)), h('td', {}, money(v.cost)), h('td', { class: v.price - v.cost < 0 ? 'neg' : '' }, money(v.price - v.cost)))))))
      : h('p', { class: 'muted small' }, 'Printify did not report per-variant cost for this product, so no margin is shown.');

    const publishBtn = status === 'draft'
      ? h('button', { class: 'btn primary wide', onclick: () => confirmPublish(p) }, 'Publish…')
      : null;

    fill(body, 
      h('section', { class: 'card' },
        h('div', { class: 'row space' }, h('h2', {}, p.title), h('span', { class: `status ${status}` }, badge)),
        gallery,
        publishBtn,
        status === 'publishing' && !liveUrl ? h('p', { class: 'muted small' }, 'Printify accepted the publish request. Waiting for your sales channel to confirm — the live link appears here when it does.') : null,
        liveUrl ? h('a', { class: 'btn primary wide', href: liveUrl, target: '_blank', rel: 'noopener' }, 'Open live listing ↗') : null,
        h('a', { class: 'btn wide', href: p.printifyUrl, target: '_blank', rel: 'noopener' }, 'Open in Printify ↗'),
        h('button', { class: 'btn wide', onclick: () => { polls = 0; load(); } }, '↻ Refresh')),
      h('section', { class: 'card' }, pricing),
    );
  }

  async function confirmPublish(p) {
    const ok = await dialog({
      title: 'Publish this product live?',
      body: `“${p.title}” will be sent to your store’s sales channel, where customers can buy it.`,
      buttons: [{ label: 'Cancel', value: false }, { label: 'Publish', value: true, primary: true }],
    });
    if (!ok) return;
    try {
      await api.post(`/api/printify/products/${shopId}/${productId}/publish`, { confirm: true });
      toast('Publish request sent');
      polls = 0;
      load();
    } catch (e) {
      dialog({ title: 'Publish failed', body: errorBox(e) });
    }
  }

  body.append(h('p', { class: 'muted' }, 'Loading…'));
  load();
  return stop;
}

function sortImages(images) {
  return [...images].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

// ---- history ---------------------------------------------------------------------------

export async function historyScreen(root, nav) {
  const body = h('main', { class: 'page' });
  fill(root, h('header', { class: 'topbar' }, h('h1', {}, 'Pushed to Printify')), body, bottomNav('#/history'));
  try {
    const list = await api.get('/api/history');
    if (!list.length) body.append(h('p', { class: 'muted empty' }, 'Nothing pushed yet. Open a design and tap Publish.'));
    for (const item of list) {
      body.append(h('div', { class: 'history-item' },
        item.mockup ? h('img', { src: item.mockup, alt: '', loading: 'lazy' }) : h('div', { class: 'thumb-empty' }),
        h('div', { class: 'history-info' },
          h('b', {}, item.title),
          h('span', { class: `status ${item.status}` }, item.status),
          h('small', { class: 'muted' }, `${item.shopTitle || 'Shop'} · ${new Date(item.createdAt).toLocaleDateString()} · ${money(item.priceCents)}`),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: () => nav(`#/draft/${item.shopId}/${item.productId}`) }, 'Details'),
            h('a', { class: 'btn small', href: item.printifyUrl, target: '_blank', rel: 'noopener' }, 'Printify ↗'),
            item.liveUrl ? h('a', { class: 'btn small primary', href: item.liveUrl, target: '_blank', rel: 'noopener' }, 'Live ↗') : null))));
    }
  } catch (e) {
    body.append(errorBox(e));
  }
}
