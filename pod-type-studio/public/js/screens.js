// Home (saved designs), new design (templates), settings, and the lock screen.
import { h, clear, fill, toast, dialog, promptText, downloadBlob, safeFileName, errorBox } from './ui.js';
import { api } from './api.js';
import { db } from './db.js';
import { newDesign, uid, exportDesignJson, parseDesignJson } from './model.js';
import { TEMPLATES, TEMPLATE_FONTS } from './templates.js';
import { ensureFont, ensureLayerFonts, loadFontList } from './fonts.js';
import { renderThumbnail } from './render.js';
import { productFromVariants, productOf } from './product.js';

// Used only until a Printify product is picked; clearly labeled "provisional".
const PROVISIONAL = { width: 4500, height: 5100 };

export function bottomNav(active) {
  const item = (href, label, icon) =>
    h('a', { href, class: `nav-item${active === href ? ' active' : ''}` }, h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, icon), label);
  return h('nav', { class: 'bottom-nav' }, item('#/', 'Designs', '✎'), item('#/history', 'Pushed', '⇪'), item('#/settings', 'Settings', '⚙'));
}

// ---- lock screen -------------------------------------------------------------------

export async function lockScreen(root, onUnlocked) {
  const st = await api.get('/api/auth/status');
  const input = h('input', { type: 'password', autocomplete: st.passcodeSet ? 'current-password' : 'new-password', placeholder: 'Passcode', 'aria-label': 'Passcode' });
  const msg = h('div');
  const submit = async () => {
    clear(msg);
    try {
      await api.post(st.passcodeSet ? '/api/auth/login' : '/api/auth/setup', { passcode: input.value });
      onUnlocked();
    } catch (e) {
      msg.append(errorBox(e));
    }
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
  fill(root, h('div', { class: 'lock' },
    h('h1', {}, 'POD Type Studio'),
    st.passcodeSet
      ? h('p', {}, 'Enter your passcode to unlock.')
      : st.canSetup
        ? h('p', {}, 'First time here: choose a passcode (6+ characters). It locks the app so nobody else can use your Printify connection.')
        : h('p', {}, 'This server has no passcode yet. Set the APP_PASSCODE environment variable on your host, then reload.'),
    st.passcodeSet || st.canSetup ? [input, h('button', { class: 'btn primary wide', onclick: submit }, st.passcodeSet ? 'Unlock' : 'Set passcode')] : null,
    msg));
}

// ---- home: saved designs -----------------------------------------------------------

export async function homeScreen(root, nav) {
  const grid = h('div', { class: 'design-grid' });
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const d = parseDesignJson(await file.text());
      // Imports get a fresh id so they never overwrite an existing design.
      d.id = uid();
      d.updatedAt = new Date().toISOString();
      await ensureLayerFonts(d.layers).catch(() => {});
      await db.put({ id: d.id, design: d, thumb: renderThumbnail(d), updatedAt: d.updatedAt });
      toast(`Imported "${d.name}"`);
      paint();
    } catch (e) {
      dialog({ title: 'Import failed', body: errorBox(e) });
    }
    fileInput.value = '';
  });

  fill(root, 
    h('header', { class: 'topbar' }, h('h1', {}, 'Your designs')),
    h('main', { class: 'page' },
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => nav('#/new') }, '+ New design'),
        h('button', { class: 'btn', onclick: () => fileInput.click() }, 'Import .json'),
        fileInput),
      grid),
    bottomNav('#/'),
  );

  async function paint() {
    const items = await db.list();
    clear(grid);
    if (!items.length) grid.append(h('p', { class: 'muted empty' }, 'No designs yet. Tap “New design” and pick a starting layout.'));
    for (const r of items) {
      grid.append(h('div', { class: 'design-card' },
        h('button', { class: 'design-open', onclick: () => nav(`#/edit/${r.id}`) },
          r.thumb ? h('img', { src: r.thumb, alt: '' }) : h('div', { class: 'thumb-empty' }),
          h('span', { class: 'design-name' }, r.design.name),
          h('small', { class: 'muted' }, new Date(r.updatedAt).toLocaleString())),
        h('button', { class: 'icon-btn card-menu', 'aria-label': `Options for ${r.design.name}`, onclick: () => cardMenu(r) }, '⋯')));
    }
  }

  async function cardMenu(r) {
    const choice = await dialog({
      title: r.design.name,
      buttons: [
        { label: 'Open', value: 'open' },
        { label: 'Duplicate', value: 'dup' },
        { label: 'Rename', value: 'rename' },
        { label: 'Export .json', value: 'json' },
        { label: 'Delete', value: 'delete', danger: true },
      ],
    });
    if (choice === 'open') nav(`#/edit/${r.id}`);
    if (choice === 'dup') {
      const d = structuredClone(r.design);
      d.id = uid();
      d.name = `${r.design.name} copy`;
      d.createdAt = d.updatedAt = new Date().toISOString();
      await db.put({ id: d.id, design: d, thumb: r.thumb, updatedAt: d.updatedAt });
      paint();
    }
    if (choice === 'rename') {
      const name = await promptText('Rename design', r.design.name);
      if (name) {
        r.design.name = name;
        await db.put(r);
        paint();
      }
    }
    if (choice === 'json') downloadBlob(new Blob([exportDesignJson(r.design)], { type: 'application/json' }), safeFileName(r.design.name, 'json'));
    if (choice === 'delete') {
      const ok = await dialog({
        title: 'Delete this design?',
        body: `"${r.design.name}" will be removed from this phone. Products already pushed to Printify are not affected.`,
        buttons: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, danger: true }],
      });
      if (ok) {
        await db.remove(r.id);
        paint();
      }
    }
  }
  paint();
}

// ---- new design: pick a starting layout ---------------------------------------------------

export async function newScreen(root, nav, settings) {
  const lp = settings?.lastProduct;
  const size = lp?.width ? { width: lp.width, height: lp.height } : PROVISIONAL;
  const grid = h('div', { class: 'template-grid' });
  const status = h('div');
  fill(root, 
    h('header', { class: 'topbar' }, h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => nav('#/') }, '←'), h('h1', {}, 'Start a design')),
    h('main', { class: 'page' },
      h('p', { class: 'muted' }, lp
        ? `Canvas: ${lp.blueprintTitle} · ${lp.position} print area · ${lp.width}×${lp.height}px. You can change the product in the editor.`
        : 'No product picked yet — you will choose one next so the canvas matches the real print area.'),
      h('p', { class: 'muted small' }, 'Templates are layouts with placeholder text. Replace it with your own words.'),
      status,
      grid),
  );

  const choices = [{ id: 'blank', name: 'Blank canvas', build: () => [] }, ...TEMPLATES];
  for (const t of choices) {
    const img = h('div', { class: 'template-thumb' });
    grid.append(h('button', { class: 'template-card', onclick: () => create(t) }, img, h('span', {}, t.name)));
    t._img = img;
  }
  loadFontList().catch(() => {});
  // Draw template previews once their fonts are in.
  Promise.all(TEMPLATE_FONTS.map((f) => ensureFont(f, 'YOURWDSHE'))).then(() => {
    for (const t of choices) {
      const d = newDesign(size);
      d.layers = t.build(d.canvas);
      t._img.append(h('img', { src: renderThumbnail(d, 240), alt: '' }));
    }
  });

  async function create(t) {
    fill(status, h('p', { class: 'muted' }, 'Setting up…'));
    try {
      let canvasInfo = { ...size, provisional: !lp, product: lp ? productOf(lp) : null };
      // Re-check the print area live, in case Printify changed it since last time.
      if (lp && settings.printify.connected) {
        try {
          const v = await api.get(`/api/printify/blueprints/${lp.blueprintId}/providers/${lp.printProviderId}/variants?position=${encodeURIComponent(lp.position)}`);
          const p = productFromVariants(lp, v);
          if (p) canvasInfo = { width: p.width, height: p.height, provisional: false, product: productOf(p) };
        } catch {
          // offline: keep the remembered size; publish re-checks it anyway
        }
      }
      const d = newDesign({ width: canvasInfo.width, height: canvasInfo.height, product: canvasInfo.product, provisional: canvasInfo.provisional, name: t.id === 'blank' ? 'Untitled design' : t.name });
      await Promise.all(TEMPLATE_FONTS.map((f) => ensureFont(f, 'YOURWDSHE')));
      d.layers = t.build(d.canvas);
      await db.put({ id: d.id, design: d, thumb: renderThumbnail(d), updatedAt: d.updatedAt });
      nav(lp ? `#/edit/${d.id}` : `#/product/${d.id}?new=1`);
    } catch (e) {
      fill(status, errorBox(e));
    }
  }
}

// ---- settings --------------------------------------------------------------------

export async function settingsScreen(root, nav, reloadSettings) {
  let s = await api.get('/api/settings');
  const body = h('main', { class: 'page' });
  fill(root, h('header', { class: 'topbar' }, h('h1', {}, 'Settings')), body, bottomNav('#/settings'));

  function paint() {
    const tokenInput = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Paste your Printify API token', 'aria-label': 'Printify API token' });
    const tokenMsg = h('div');
    const connect = async () => {
      fill(tokenMsg, h('p', { class: 'muted' }, 'Checking the token with Printify…'));
      try {
        const res = await api.post('/api/settings/token', { token: tokenInput.value });
        tokenInput.value = ''; // never keep the token in the page
        s = res;
        await reloadSettings();
        toast(`Connected — ${res.shopCount} shop${res.shopCount === 1 ? '' : 's'} found`);
        paint();
      } catch (e) {
        tokenInput.value = '';
        fill(tokenMsg, errorBox(e));
      }
    };
    const disconnect = async () => {
      const ok = await dialog({ title: 'Disconnect Printify?', body: 'The saved token is deleted from the server. Your designs stay.', buttons: [{ label: 'Cancel', value: false }, { label: 'Disconnect', value: true, danger: true }] });
      if (!ok) return;
      try {
        s = await api.del('/api/settings/token');
        await reloadSettings();
        paint();
      } catch (e) {
        fill(tokenMsg, errorBox(e));
      }
    };

    const price = h('input', { type: 'number', inputmode: 'decimal', step: '0.01', min: '0.5', value: (s.prefs.priceCents / 100).toFixed(2), 'aria-label': 'Default price' });
    const colors = h('input', { type: 'text', value: s.prefs.soldColors.join(', '), 'aria-label': 'Colors you sell' });
    const desc = h('textarea', { rows: 5, 'aria-label': 'Default description' });
    desc.value = s.prefs.description;
    const prefsMsg = h('div');
    const savePrefs = async () => {
      clear(prefsMsg);
      try {
        s = await api.patch('/api/settings', {
          prefs: {
            priceCents: Math.round(Number(price.value) * 100),
            soldColors: colors.value.split(',').map((x) => x.trim()).filter(Boolean),
            description: desc.value,
          },
        });
        await reloadSettings();
        toast('Defaults saved');
      } catch (e) {
        prefsMsg.append(errorBox(e));
      }
    };

    fill(body, 
      h('section', { class: 'card' },
        h('h2', {}, 'Printify connection'),
        s.printify.connected
          ? [
            h('p', { class: 'ok' }, '✓ Connected', s.printify.source === 'env' ? ' (token set on the server)' : ' (token saved on the server)'),
            h('p', { class: 'muted small' }, 'The token is never shown again and never sent to this browser.'),
            s.printify.source === 'settings' ? h('div', { class: 'row' },
              h('button', { class: 'btn', onclick: () => { s.printify.connected = false; paint(); } }, 'Replace token'),
              h('button', { class: 'btn danger', onclick: disconnect }, 'Disconnect')) : null,
          ]
          : [
            h('p', {}, 'Printify → your profile → Connections → generate a Personal Access Token. Give it these scopes: shops.read, catalog.read, products.read, products.write, uploads.read, uploads.write.'),
            tokenInput,
            h('button', { class: 'btn primary wide', onclick: connect }, 'Connect Printify'),
          ],
        tokenMsg),
      h('section', { class: 'card' },
        h('h2', {}, 'Publish defaults'),
        h('label', { class: 'field-label' }, 'Default retail price (USD)'), price,
        h('label', { class: 'field-label' }, 'Colors you sell (comma separated, matched by name)'), colors,
        h('label', { class: 'field-label' }, 'Default description ({title} is replaced with the product title)'), desc,
        h('button', { class: 'btn primary wide', onclick: savePrefs }, 'Save defaults'),
        prefsMsg),
      h('section', { class: 'card' },
        h('h2', {}, 'App'),
        h('p', { class: 'muted small' }, 'Designs are saved on this phone. Export a .json from a design’s menu to back it up.'),
        h('button', { class: 'btn', onclick: async () => { await api.post('/api/auth/logout'); location.reload(); } }, 'Lock app')),
    );
  }
  paint();
}
