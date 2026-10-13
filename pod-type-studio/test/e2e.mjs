// End-to-end acceptance test on an emulated Android phone (Pixel 7, touch
// only), against the strict mock Printify API. Run: npm run test:e2e
// Needs Playwright + Chromium; network access to fonts.googleapis.com.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-printify.js';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = createRequire('/opt/node-tools/node_modules/')('playwright');
}
const { chromium, devices } = playwright;

const here = import.meta.dirname;
const out = path.join(here, '..', 'test-output');
fs.mkdirSync(out, { recursive: true });
const TOKEN = `tok_${crypto.randomBytes(32).toString('hex')}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pts-e2e-'));

const mock = await startMock({ token: TOKEN });
Object.assign(process.env, { PRINTIFY_API_BASE: mock.url, DATA_DIR: dataDir, FONTS_SOURCE: 'offline', QUIET_LOGS: '1' });
delete process.env.PRINTIFY_API_TOKEN;
delete process.env.APP_PASSCODE;
const serverLogs = [];
const origLog = console.log, origErr = console.error;
console.error = (...a) => { serverLogs.push(a.join(' ')); origErr(...a); };
const { createServer } = await import('../server.js');
const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// Behind an HTTPS proxy (CI sandboxes), send only external traffic (Google
// Fonts) through it; the app and mock run on loopback.
const args = process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost'] : [];
const browser = await chromium.launch({ args });
const context = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));

let stepNo = 0;
async function step(name, fn) {
  stepNo++;
  const t = Date.now();
  try {
    await fn();
    origLog(`ok ${stepNo} - ${name} (${Date.now() - t}ms)`);
  } catch (e) {
    await page.screenshot({ path: path.join(out, `FAIL-${stepNo}.png`) }).catch(() => {});
    origLog(`not ok ${stepNo} - ${name}\n${e.stack}`);
    await cleanup();
    process.exit(1);
  }
}
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
const tapText = (text, opts = {}) => page.getByText(text, { exact: true, ...opts }).first().tap();
const tapRole = (role, name) => page.getByRole(role, { name, exact: true }).first().tap();

async function cleanup() {
  await browser.close().catch(() => {});
  server.close();
  await mock.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}

function pngHeader(buf) {
  assert.equal(buf.toString('latin1', 1, 4), 'PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bitDepth: buf[24], colorType: buf[25] };
}

// Decode just enough of an 8-bit RGBA PNG to read alpha values (unfiltering rows).
function pngAlphaStats(buf) {
  const { width, height } = pngHeader(buf);
  const idat = [];
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    if (type === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  let prev = Buffer.alloc(stride), opaque = 0, transparent = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? line[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
      if (f === 1) line[i] = (line[i] + a) & 255;
      else if (f === 2) line[i] = (line[i] + b) & 255;
      else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 3; x < stride; x += 4) line[x] === 0 ? transparent++ : opaque++;
    prev = line;
  }
  return { opaque, transparent, cornerAlpha: null };
}

let designId;

await step('lock screen: first-run passcode setup', async () => {
  await page.goto(base);
  await page.getByLabel('Passcode').fill('phone-passcode-1');
  await tapText('Set passcode');
  await page.getByText('Your designs').waitFor();
});

await step('settings: connect Printify (token goes to the server, never shown again)', async () => {
  await tapRole('link', 'Settings');
  await page.getByLabel('Printify API token').fill(TOKEN);
  await tapText('Connect Printify');
  await page.getByText('✓ Connected').waitFor();
  assert.equal(await page.getByLabel('Printify API token').count(), 0, 'token field gone after connecting');
  assert.ok(!(await page.content()).includes(TOKEN));
  await shot('01-settings-connected');
});

await step('new design from a template; templates contain placeholder text only', async () => {
  await tapRole('link', 'Designs');
  await tapText('+ New design');
  await page.locator('.template-thumb img').nth(6).waitFor();
  await shot('02-templates');
  const texts = await page.evaluate(async () => {
    const { TEMPLATES, PLACEHOLDERS } = await import('/js/templates.js');
    const { newDesign, warningsFor } = await import('/js/model.js');
    const d = newDesign({ width: 4500, height: 5100 });
    const warnings = TEMPLATES.flatMap((t) => warningsFor({ ...d, layers: t.build(d.canvas) }).map((w) => `${t.name}: ${w.text}`));
    return { ph: PLACEHOLDERS, warnings, all: TEMPLATES.flatMap((t) => t.build(d.canvas)).filter((l) => l.type === 'text').map((l) => l.text) };
  });
  assert.deepEqual(texts.warnings, [], 'templates start without print warnings');
  assert.equal(texts.all.length > 6, true);
  for (const t of texts.all) assert.ok(texts.ph.includes(t), `template text "${t}"`);
  await tapText('Arch top + straight bottom');
});

await step('product: Bella+Canvas 3001 found by name; canvas = real print area', async () => {
  await page.getByText('Your default tee').waitFor();
  await page.getByText('4500 × 5100 px').waitFor();
  await shot('03-product');
  await tapText('Use this product');
  await page.locator('.stage-canvas').waitFor();
  designId = page.url().split('/edit/')[1];
  await page.locator('.product-strip b', { hasText: '4500×5100px' }).waitFor();
});

await step('editor: add text and type a phrase (touch only)', async () => {
  await tapRole('button', 'Text');
  const ta = page.getByLabel('Your words');
  await ta.fill('TEST PHRASE ONE');
  await page.waitForTimeout(300);
});

await step('fonts: Anton has no bold/italic, so those are not offered', async () => {
  await tapRole('tab', 'Font');
  const weights = await page.locator('.panel .seg-btn').allTextContents();
  assert.deepEqual(weights, ['400']);
  assert.equal(await page.getByLabel('Italic').isDisabled(), true);
});

await step('fonts: search the Google Fonts picker, names render in their own face', async () => {
  await page.locator('.font-btn').tap();
  await page.getByLabel('Search fonts').fill('bebas');
  const row = page.locator('.font-row', { hasText: 'Bebas Neue' }).first();
  await row.waitFor();
  await page.waitForFunction(() => document.querySelector('.font-name')?.style.fontFamily.includes('pv Bebas Neue'), null, { timeout: 15000 });
  await shot('04-font-picker');
  await row.tap();
  await page.locator('.font-current', { hasText: 'Bebas Neue' }).waitFor();
});

await step('arch it, outline + drop shadow', async () => {
  await tapRole('tab', 'Arch');
  await tapText('Arch up ⌒');
  for (let i = 0; i < 5; i++) await page.getByLabel('Increase Curve').tap();
  await tapRole('tab', 'Style');
  await page.getByText('Outline', { exact: true }).tap();
  await page.getByText('Drop shadow', { exact: true }).tap();
  for (let i = 0; i < 8; i++) await page.getByLabel('Increase Shadow softness').tap();
  await page.getByLabel('Color #f5b52a', { exact: true }).tap();
  await shot('04b-style-panel');
});

await step('touch drag moves the layer and snaps to the center line', async () => {
  const box = await page.locator('.stage-canvas').boundingBox();
  const before = await page.evaluate(async (id) => {
    const { db } = await import('/js/db.js');
    const r = await db.get(id);
    const l = r.design.layers.at(-1);
    return { x: l.x, y: l.y };
  }, designId);
  // Synthesize a one-finger drag with touch pointer events on the selected layer.
  await page.evaluate(async ({ box }) => {
    const c = document.querySelector('.stage-canvas');
    const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true }));
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    fire('pointerdown', cx, cy);
    for (let i = 1; i <= 10; i++) fire('pointermove', cx + i * 3, cy + 40 + i * 2);
    for (let i = 10; i >= 0; i--) fire('pointermove', cx + i * 0.2 + 1, cy + 40);
    fire('pointerup', cx + 1, cy + 40);
  }, { box });
  await page.waitForTimeout(800);
  const after = await page.evaluate(async (id) => {
    const { db } = await import('/js/db.js');
    const r = await db.get(id);
    const l = r.design.layers.at(-1);
    return { x: l.x, y: l.y, w: r.design.canvas.width };
  }, designId);
  assert.notEqual(after.y, before.y, 'layer moved');
  assert.equal(after.x, after.w / 2, 'snapped to vertical center');
});

await step('preview on a black shirt', async () => {
  await tapRole('button', 'Shirt');
  await page.getByLabel('Black', { exact: true }).tap();
  await page.waitForTimeout(300);
  const bg = await page.evaluate(async (id) => (await (await import('/js/db.js')).db.get(id)).design.preview.color, designId);
  assert.equal(bg, '#111111');
  await page.getByText('▾ Hide controls').tap();
  await page.waitForTimeout(300);
  await shot('05-editor-black-shirt');
  await page.getByText('▴ Show controls').tap();
});

let pngPath;
await step('export: PNG is exactly the print-area size, transparent background', async () => {
  await page.getByLabel('More').tap();
  const [dl] = await Promise.all([page.waitForEvent('download'), tapText('Download PNG')]);
  pngPath = path.join(out, 'export.png');
  await dl.saveAs(pngPath);
  const buf = fs.readFileSync(pngPath);
  const hdr = pngHeader(buf);
  assert.deepEqual([hdr.width, hdr.height, hdr.colorType], [4500, 5100, 6]);
  const stats = pngAlphaStats(buf);
  assert.ok(stats.transparent > stats.opaque, 'mostly transparent background');
  assert.ok(stats.opaque > 10000, 'artwork pixels present');
});

await step('export matches screen rendering (arch/outline/shadow are scale-exact)', async () => {
  const b64 = fs.readFileSync(pngPath).toString('base64');
  const diff = await page.evaluate(async ({ id, b64 }) => {
    const { db } = await import('/js/db.js');
    const { renderDesign } = await import('/js/render.js');
    const d = (await db.get(id)).design;
    const s = 0.12;
    const w = Math.round(d.canvas.width * s), h = Math.round(d.canvas.height * s);
    const mk = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#336699';
      x.fillRect(0, 0, w, h);
      return x;
    };
    // A: the exported full-size PNG, scaled down.
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const a = mk();
    a.imageSmoothingQuality = 'high';
    a.drawImage(img, 0, 0, w, h);
    // B: the same renderer the editor screen uses, drawn directly at the small scale.
    const b = mk();
    renderDesign(b, d, { scale: s, offsetX: 0, offsetY: 0 });
    const pa = a.getImageData(0, 0, w, h).data, pb = b.getImageData(0, 0, w, h).data;
    let sum = 0, big = 0;
    for (let i = 0; i < pa.length; i += 4) {
      const dd = (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2])) / 3;
      sum += dd;
      if (dd > 64) big++;
    }
    return { mean: sum / (pa.length / 4), bigFrac: big / (pa.length / 4), hasShadow: d.layers.some((l) => l.shadow?.on && l.arch.mode === 'top' && l.stroke.on) };
  }, { id: designId, b64 });
  origLog(`   mean channel diff ${diff.mean.toFixed(2)}/255, pixels off by >64: ${(diff.bigFrac * 100).toFixed(2)}%`);
  assert.ok(diff.hasShadow, 'design has arch + outline + shadow');
  assert.ok(diff.mean < 3, `export differs from screen render (mean ${diff.mean})`);
  assert.ok(diff.bigFrac < 0.01);
});

await step('publish flow: shop, usual colors preselected, title required', async () => {
  await tapRole('button', 'Publish');
  await page.getByText('15 variants selected').waitFor();
  assert.ok(await page.getByText('Add a product title.').isVisible());
  assert.equal(await page.getByText('Create DRAFT in Printify').isDisabled(), true);
  assert.equal(await page.getByLabel('Retail price in dollars').inputValue(), '24.99');
  await page.getByLabel('Product title').fill('E2E Test Tee');
  await shot('06-publish-form');
});

await step('push to Printify: upload + DRAFT product + real mockups shown', async () => {
  await tapText('Create DRAFT in Printify');
  await page.waitForURL(/#\/draft\//, { timeout: 60000 });
  await page.locator('.gallery img').first().waitFor({ timeout: 20000 });
  await page.getByText('Draft', { exact: true }).waitFor();
  await page.locator('.price-table').waitFor();
  await shot('07-draft-mockups');
  const created = [...mock.products.values()].at(-1);
  assert.equal(created.title, 'E2E Test Tee');
  assert.equal(created.variants.length, 15);
  const upload = [...mock.uploads.values()].at(-1);
  assert.deepEqual([upload.width, upload.height], [4500, 5100]);
});

await step('publish needs an explicit confirm; then the live link shows', async () => {
  await tapText('Publish…');
  await page.getByText('Publish this product live?').waitFor();
  await tapText('Cancel');
  assert.equal(mock.calls.filter((c) => c.path.endsWith('/publish.json')).length, 0, 'cancel does nothing');
  await tapText('Publish…');
  await page.locator('.dialog').getByText('Publish', { exact: true }).tap();
  const live = page.getByText('Open live listing ↗');
  await live.waitFor({ timeout: 30000 });
  assert.match(await live.getAttribute('href'), /^https:\/\/www\.etsy\.com\/listing\//);
  await shot('08-published');
});

await step('history lists the pushed product as published', async () => {
  await tapRole('link', 'Pushed');
  await page.locator('.history-item', { hasText: 'E2E Test Tee' }).waitFor();
  await page.locator('.history-item .status.published').waitFor();
  await shot('09-history');
});

await step('reload keeps saved designs', async () => {
  await page.reload();
  await tapRole('link', 'Designs');
  await page.locator('.design-card').first().waitFor();
  assert.equal(await page.locator('.design-card').count(), 1);
  await shot('10-designs');
});

await step('design JSON export/import round-trips every layer and effect', async () => {
  await page.locator('.card-menu').first().tap();
  const [dl] = await Promise.all([page.waitForEvent('download'), tapText('Export .json')]);
  const jsonPath = path.join(out, 'design.json');
  await dl.saveAs(jsonPath);
  const exported = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.ok(!JSON.stringify(exported).includes(TOKEN));
  await page.locator('input[type=file]').setInputFiles(jsonPath);
  await page.waitForFunction(() => document.querySelectorAll('.design-card').length === 2);
  const same = await page.evaluate(async () => {
    const { db } = await import('/js/db.js');
    const [a, b] = await db.list();
    return JSON.stringify(a.design.layers) === JSON.stringify(b.design.layers) && JSON.stringify(a.design.canvas) === JSON.stringify(b.design.canvas) && a.id !== b.id;
  });
  assert.equal(same, true);
  const effects = exported.layers.find((l) => l.text === 'TEST PHRASE ONE');
  assert.equal(effects.arch.mode, 'top');
  assert.equal(effects.stroke.on, true);
  assert.equal(effects.shadow.on, true);
  assert.equal(effects.font.family, 'Bebas Neue');
});

await step('token appears nowhere on the client', async () => {
  const dump = await page.evaluate(async () => {
    const { db } = await import('/js/db.js');
    return JSON.stringify({ ls: { ...localStorage }, designs: await db.list(), html: document.documentElement.outerHTML, cookie: document.cookie });
  });
  assert.ok(!dump.includes(TOKEN));
  for (const f of ['main', 'api', 'db', 'editor', 'fonts', 'model', 'panels', 'picker', 'product', 'publish', 'render', 'screens', 'templates', 'ui', 'colors']) {
    const res = await page.request.get(`${base}/js/${f}.js`);
    assert.ok(!(await res.text()).includes(TOKEN));
  }
  for (const line of serverLogs) assert.ok(!line.includes(TOKEN));
  const css = fs.readFileSync(path.join(here, '..', 'public', 'app.css'), 'utf8');
  assert.ok(!/:hover/.test(css), 'no hover-only styling');
});

await step('no page errors and no forbidden Printify calls', async () => {
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(mock.violations, []);
});

origLog(`\nAll ${stepNo} e2e steps passed. Screenshots in test-output/`);
await cleanup();
