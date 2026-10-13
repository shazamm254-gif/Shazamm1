// Product picker: default Bella+Canvas 3001 (looked up by name at runtime) or
// a catalog search, then a print provider, then the print position. The
// canvas is resized to the real print area the API reports.
import { h, clear, fill, errorBox, toast } from './ui.js';
import { api } from './api.js';
import { db } from './db.js';
import { resizeDesign } from './model.js';

export function productOf(p) {
  return {
    blueprintId: p.blueprintId,
    blueprintTitle: p.blueprintTitle,
    printProviderId: p.printProviderId,
    providerTitle: p.providerTitle,
    position: p.position,
    colors: p.colors || [],
  };
}

export function applyProduct(design, p) {
  if (design.canvas.width !== p.width || design.canvas.height !== p.height) resizeDesign(design, p.width, p.height);
  design.canvas.product = productOf(p);
  design.canvas.provisional = false;
}

// Combine a product choice with a live variants response.
export function productFromVariants(base, v) {
  const g = v.groups?.[0];
  if (!g) return null;
  const colors = [...new Set(v.variants.map((x) => x.color).filter(Boolean))];
  return { ...productOf(base), colors, width: g.width, height: g.height };
}

export async function productScreen(root, nav, designId, { isNew, settings, reloadSettings }) {
  const record = await db.get(designId);
  if (!record) return fill(root, errorBox({ message: 'Design not found.' }));
  const design = record.design;
  const back = () => nav(`#/edit/${designId}`);
  const body = h('main', { class: 'page' });
  fill(root, 
    h('header', { class: 'topbar' }, h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: back }, '←'), h('h1', {}, 'Pick the product')),
    body,
  );

  if (!settings.printify.connected) {
    body.append(
      h('div', { class: 'card' },
        h('p', {}, 'Connect Printify in Settings to load real products and print areas.'),
        h('p', { class: 'muted small' }, `Until then this design uses a provisional ${design.canvas.width}×${design.canvas.height}px canvas. It is resized automatically when you pick a product.`),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => nav('#/settings') }, 'Go to Settings'),
          h('button', { class: 'btn', onclick: back }, isNew ? 'Design now, pick later' : 'Back to editor'))));
    return;
  }

  const current = design.canvas.product;
  const state = {
    blueprint: current ? { id: current.blueprintId, title: current.blueprintTitle } : null,
    providerId: current?.printProviderId ?? null,
    providerTitle: current?.providerTitle ?? '',
    position: current?.position || 'front',
  };

  const bpSection = h('section', { class: 'card' });
  const provSection = h('section', { class: 'card' });
  const areaSection = h('section', { class: 'card' });
  body.append(bpSection, provSection, areaSection);

  // ---- 1. blueprint ----
  async function paintBlueprint() {
    const search = h('input', { type: 'search', placeholder: 'Search the Printify catalog (e.g. hoodie, 3001, mug)', 'aria-label': 'Search products' });
    const results = h('div', { class: 'bp-list' });
    fill(bpSection, h('h2', {}, '1. Product'),
      state.blueprint ? h('p', {}, 'Selected: ', h('b', {}, state.blueprint.title)) : null,
      h('div', { class: 'default-bp' }), search, results);
    const def = bpSection.querySelector('.default-bp');
    try {
      const d = await api.get('/api/printify/default-product');
      if (d.found) {
        def.append(bpCard(d.blueprint, 'Your default tee'));
        if (!state.blueprint) choose(d.blueprint);
      } else {
        def.append(h('p', { class: 'muted' }, 'Bella+Canvas 3001 was not found in the catalog by name — search for a product below.'));
      }
    } catch (e) {
      def.append(errorBox(e));
    }
    let t = null;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = search.value.trim();
        clear(results);
        if (q.length < 2) return;
        try {
          const list = await api.get(`/api/printify/blueprints?q=${encodeURIComponent(q)}`);
          if (!list.length) results.append(h('p', { class: 'muted' }, 'No products match.'));
          list.forEach((b) => results.append(bpCard(b)));
        } catch (e) {
          results.append(errorBox(e));
        }
      }, 300);
    });
  }

  function bpCard(b, badge) {
    return h('button', { class: `bp-card${state.blueprint?.id === b.id ? ' active' : ''}`, onclick: () => choose(b) },
      b.image ? h('img', { src: b.image, alt: '', loading: 'lazy' }) : h('div', { class: 'thumb-empty' }),
      h('span', {}, badge ? h('small', { class: 'badge' }, badge) : null, h('b', {}, b.title), h('small', { class: 'muted' }, `${b.brand} ${b.model}`)));
  }

  function choose(b) {
    if (state.blueprint?.id !== b.id) {
      state.providerId = null;
      state.providerTitle = '';
    }
    state.blueprint = { id: b.id, title: b.title };
    bpSection.querySelectorAll('.bp-card').forEach((el) => el.classList.remove('active'));
    paintBlueprintSelected();
    paintProviders();
  }

  function paintBlueprintSelected() {
    const sel = bpSection.querySelector('p b');
    if (sel) sel.textContent = state.blueprint.title;
    else bpSection.querySelector('h2').after(h('p', {}, 'Selected: ', h('b', {}, state.blueprint.title)));
  }

  // ---- 2. provider ----
  async function paintProviders() {
    fill(provSection, h('h2', {}, '2. Print provider'), h('p', { class: 'muted' }, 'Loading providers…'));
    clear(areaSection);
    try {
      const list = await api.get(`/api/printify/blueprints/${state.blueprint.id}/providers`);
      const remembered = settings.lastProduct?.blueprintId === state.blueprint.id ? settings.lastProduct.printProviderId : null;
      if (!list.some((p) => p.id === state.providerId)) {
        const pick = list.find((p) => p.id === remembered) || list[0];
        state.providerId = pick?.id ?? null;
        state.providerTitle = pick?.title ?? '';
      }
      fill(provSection, h('h2', {}, '2. Print provider'),
        list.length ? null : h('p', { class: 'muted' }, 'No providers offer this product right now.'),
        h('div', { class: 'radio-list' }, list.map((p) => {
          const input = h('input', { type: 'radio', name: 'provider', value: p.id, checked: p.id === state.providerId });
          input.addEventListener('change', () => {
            state.providerId = p.id;
            state.providerTitle = p.title;
            paintArea();
          });
          return h('label', { class: 'radio-row' }, input, h('span', {}, p.title, p.location ? h('small', { class: 'muted' }, ` · ${p.location}`) : null));
        })));
      if (state.providerId) paintArea();
    } catch (e) {
      fill(provSection, h('h2', {}, '2. Print provider'), errorBox(e));
    }
  }

  // ---- 3. print area ----
  async function paintArea() {
    fill(areaSection, h('h2', {}, '3. Print area'), h('p', { class: 'muted' }, 'Loading the real print area…'));
    try {
      const url = `/api/printify/blueprints/${state.blueprint.id}/providers/${state.providerId}/variants?position=${encodeURIComponent(state.position)}`;
      let v = await api.get(url);
      if (!v.groups.length && v.positions.length) {
        state.position = v.positions.includes('front') ? 'front' : v.positions[0];
        v = await api.get(`/api/printify/blueprints/${state.blueprint.id}/providers/${state.providerId}/variants?position=${encodeURIComponent(state.position)}`);
      }
      const g = v.groups[0];
      const posSel = h('div', { class: 'seg wrap' }, v.positions.map((p) =>
        h('button', { class: `seg-btn${p === state.position ? ' active' : ''}`, onclick: () => { state.position = p; paintArea(); } }, p)));
      fill(areaSection, h('h2', {}, '3. Print area'),
        h('label', { class: 'field-label' }, 'Where it prints'), posSel,
        g ? h('p', { class: 'big' }, `${g.width} × ${g.height} px`) : h('p', {}, 'No print area at this position.'),
        g ? h('p', { class: 'muted small' }, `${(g.width / 300).toFixed(1)}″ × ${(g.height / 300).toFixed(1)}″ at 300 DPI · ${v.variants.length} variants`) : null,
        v.groups.length > 1 ? h('p', { class: 'warn-text' }, `Print area differs by size: ${v.groups.map((x) => `${x.width}×${x.height} (${x.variantIds.length})`).join(', ')}. The canvas uses the most common one; other sizes get the design scaled to fit.`) : null,
        g && (design.canvas.width !== g.width || design.canvas.height !== g.height) && design.layers.length
          ? h('p', { class: 'muted small' }, `Your design will be resized from ${design.canvas.width}×${design.canvas.height} to fit.`) : null,
        g ? h('button', { class: 'btn primary wide', onclick: () => use(v) }, 'Use this product') : null);
    } catch (e) {
      fill(areaSection, h('h2', {}, '3. Print area'), errorBox(e));
    }
  }

  async function use(v) {
    const p = productFromVariants({
      blueprintId: state.blueprint.id,
      blueprintTitle: state.blueprint.title,
      printProviderId: state.providerId,
      providerTitle: state.providerTitle,
      position: state.position,
    }, v);
    applyProduct(design, p);
    record.updatedAt = design.updatedAt = new Date().toISOString();
    await db.put(record);
    try {
      await api.patch('/api/settings', { lastProduct: { ...productOf(p), colors: undefined, width: p.width, height: p.height } });
      await reloadSettings();
    } catch {
      // not fatal: only the remembered default is lost
    }
    toast(`Canvas set to ${p.width}×${p.height}px`);
    back();
  }

  paintBlueprint();
  if (state.blueprint) paintProviders();
}
