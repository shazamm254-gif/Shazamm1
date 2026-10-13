// Integration tests: the real server against the strict mock Printify API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { startMock } from './mock-printify.js';

const TOKEN = `tok_${crypto.randomBytes(32).toString('hex')}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pts-test-'));
let mock, server, base;
let cookie = '';
const logs = [];

// Real PNG of the requested size (transparent), built with zlib.
export function makePng(width, height) {
  const row = Buffer.alloc(1 + width * 4);
  const raw = Buffer.alloc(row.length * height);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(td) : crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function call(method, url, body, { auth = true, headers = {} } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'pod-type-studio', ...(auth && cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  assert.ok(!text.includes(TOKEN), `token leaked in response to ${method} ${url}`);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // static file
  }
  return { status: res.status, json, text, headers: res.headers };
}

before(async () => {
  mock = await startMock({ token: TOKEN });
  process.env.PRINTIFY_API_BASE = mock.url;
  process.env.DATA_DIR = dataDir;
  process.env.FONTS_SOURCE = 'offline';
  delete process.env.PRINTIFY_API_TOKEN;
  delete process.env.APP_PASSCODE;
  for (const k of ['log', 'error', 'warn']) {
    const orig = console[k];
    console[k] = (...a) => {
      logs.push(a.join(' '));
      if (process.env.SHOW_LOGS) orig(...a);
    };
  }
  const { createServer } = await import('../server.js');
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  await mock?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('API is locked until a passcode is set and entered', async () => {
  let r = await call('GET', '/api/auth/status');
  assert.deepEqual(r.json, { authed: false, passcodeSet: false, canSetup: true });
  r = await call('GET', '/api/settings');
  assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/setup', { passcode: '123' });
  assert.equal(r.status, 400);
  // Setup from a non-loopback client (behind a proxy) is refused.
  r = await call('POST', '/api/auth/setup', { passcode: 'longenough' }, { headers: { 'X-Forwarded-For': '203.0.113.9' } });
  assert.equal(r.status, 403);
  r = await call('POST', '/api/auth/setup', { passcode: 'correct horse' });
  assert.equal(r.status, 200);
  const set = r.headers.get('set-cookie');
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Strict/);
  r = await call('POST', '/api/auth/login', { passcode: 'wrong!!' });
  assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/login', { passcode: 'correct horse' });
  assert.equal(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
  r = await call('GET', '/api/settings');
  assert.equal(r.status, 200);
  assert.equal(r.json.printify.connected, false);
});

test('state-changing requests need the same-origin header', async () => {
  const r = await call('PATCH', '/api/settings', { lastShopId: 1 }, { headers: { 'X-Requested-With': 'evil' } });
  assert.equal(r.status, 403);
});

test('a bad token is rejected and its value redacted from the error', async () => {
  const bad = `bad_${crypto.randomBytes(24).toString('hex')}`;
  const r = await call('POST', '/api/settings/token', { token: bad });
  assert.equal(r.status, 502);
  assert.equal(r.json.source, 'printify');
  assert.match(r.json.error, /did not accept the API token/);
  assert.ok(!r.text.includes(bad), 'candidate token echoed back');
  assert.match(r.json.detail, /\[redacted\]/);
});

test('token is verified, saved server-side only, and never returned', async () => {
  const r = await call('POST', '/api/settings/token', { token: TOKEN });
  assert.equal(r.status, 200);
  assert.equal(r.json.printify.connected, true);
  assert.equal(r.json.shopCount, 2);
  const file = path.join(dataDir, 'settings.json');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  const s = await call('GET', '/api/settings');
  assert.deepEqual(Object.keys(s.json.printify).sort(), ['connected', 'source']);
});

test('shops list', async () => {
  const r = await call('GET', '/api/printify/shops');
  assert.deepEqual(r.json[0], { id: 9001, title: 'Rodney Tees', salesChannel: 'etsy' });
});

test('default Bella+Canvas 3001 is found by name, not ID', async () => {
  const r = await call('GET', '/api/printify/default-product');
  assert.equal(r.json.found, true);
  assert.equal(r.json.blueprint.id, 777);
  assert.equal(r.json.blueprint.model, '3001');
});

test('catalog search', async () => {
  const r = await call('GET', '/api/printify/blueprints?q=hooded');
  assert.equal(r.json.length, 1);
  assert.equal(r.json[0].brand, 'Gildan');
});

test('variants come with the real print area, no invented cost', async () => {
  const r = await call('GET', '/api/printify/blueprints/777/providers/41/variants?position=front');
  assert.equal(r.json.variants.length, 25);
  assert.deepEqual(r.json.groups.map((g) => [g.width, g.height]), [[4500, 5100]]);
  assert.ok(r.json.variants.every((v) => !('cost' in v)), 'catalog sends no cost, so none may appear');
  const r2 = await call('GET', '/api/printify/blueprints/777/providers/42/variants?position=front');
  assert.deepEqual(r2.json.groups.map((g) => [g.width, g.height, g.variantIds.length]), [[4500, 5100, 20], [4200, 4800, 5]]);
});

let created;
const baseProduct = () => ({
  shopId: 9001, shopTitle: 'Rodney Tees', blueprintId: 777, blueprintTitle: 'Unisex Jersey Short Sleeve Tee', printProviderId: 41,
  position: 'front', title: 'Test Tee', description: 'Desc', priceCents: 2499,
});

test('push is blocked without a title, with a wrong-size PNG, or a bad PNG', async () => {
  const variants = (await call('GET', '/api/printify/blueprints/777/providers/41/variants')).json.variants;
  const ids = variants.slice(0, 3).map((v) => v.id);
  let r = await call('POST', '/api/printify/products', { ...baseProduct(), title: '  ', variantIds: ids, pngBase64: makePng(4500, 5100).toString('base64') });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /title/);
  r = await call('POST', '/api/printify/products', { ...baseProduct(), variantIds: ids, pngBase64: makePng(450, 510).toString('base64') });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /4500×5100/);
  r = await call('POST', '/api/printify/products', { ...baseProduct(), variantIds: ids, pngBase64: Buffer.from('not a png').toString('base64') });
  assert.equal(r.status, 400);
  assert.equal(mock.uploads.size, 0, 'nothing uploaded for invalid pushes');
});

test('a rejected upload surfaces a plain message plus raw detail', async () => {
  const variants = (await call('GET', '/api/printify/blueprints/777/providers/41/variants')).json.variants;
  mock.failNextUpload();
  const r = await call('POST', '/api/printify/products', { ...baseProduct(), variantIds: [variants[0].id], pngBase64: makePng(4500, 5100).toString('base64') });
  assert.equal(r.status, 502);
  assert.match(r.json.error, /uploading the design — try again/);
  assert.match(r.json.detail, /Image could not be processed/);
});

test('upload + create draft product with a spec-valid payload', async () => {
  const variants = (await call('GET', '/api/printify/blueprints/777/providers/42/variants')).json.variants;
  // Black + White, all sizes (2XL has a different print area on this provider).
  const ids = variants.filter((v) => ['Black', 'White'].includes(v.color)).map((v) => v.id);
  const r = await call('POST', '/api/printify/products', { ...baseProduct(), printProviderId: 42, variantIds: ids, pngBase64: makePng(4500, 5100).toString('base64'), description: 'Hello {title}' });
  assert.equal(r.status, 200, r.text);
  created = r.json.product;
  assert.equal(created.title, 'Test Tee');
  assert.equal(created.variants.length, 10);
  assert.ok(created.variants.every((v) => v.price === 2499 && typeof v.cost === 'number'));

  const sent = mock.calls.filter((c) => c.method === 'POST' && /products\.json$/.test(c.path)).pop().body;
  assert.equal(sent.blueprint_id, 777);
  assert.equal(sent.print_provider_id, 42);
  assert.equal(sent.print_areas.length, 2, 'one print area per print-area size');
  const [main, odd] = sent.print_areas;
  assert.equal(main.variant_ids.length, 8);
  assert.deepEqual(main.placeholders[0].images[0], { id: r.json.upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 });
  // 4200x4800 area is taller relative to width than 4500x5100? No: 4800/4200=1.143 > 5100/4500=1.133, so full width fits.
  assert.equal(odd.placeholders[0].images[0].scale, 1);
  const up = mock.calls.find((c) => c.path === '/v1/uploads/images.json' && c.body?.contents?.length > 100);
  assert.equal(up.body.file_name, 'Test-Tee.png');
});

test('history records the draft', async () => {
  const r = await call('GET', '/api/history');
  assert.equal(r.json[0].productId, created.id);
  assert.equal(r.json[0].status, 'draft');
});

test('product status returns mockups once generated', async () => {
  const r = await call('GET', `/api/printify/products/9001/${created.id}`);
  assert.equal(r.json.status, 'draft');
  assert.equal(r.json.product.images.length, 3);
  assert.equal(r.json.liveUrl, null);
});

test('publish needs explicit confirmation and only works on products this app created', async () => {
  let r = await call('POST', `/api/printify/products/9001/${created.id}/publish`, {});
  assert.equal(r.status, 400);
  r = await call('POST', '/api/printify/products/9001/someoneelsesproduct/publish', { confirm: true });
  assert.equal(r.status, 403);
  r = await call('GET', '/api/printify/products/9001/someoneelsesproduct');
  assert.equal(r.status, 403);
  r = await call('POST', `/api/printify/products/9002/${created.id}/publish`, { confirm: true });
  assert.equal(r.status, 403, 'wrong shop');
  r = await call('POST', `/api/printify/products/9001/${created.id}/publish`, { confirm: true });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'publishing');
  const pub = mock.calls.filter((c) => /publish\.json$/.test(c.path)).pop();
  assert.equal(pub.body.title, true);
  r = await call('GET', `/api/printify/products/9001/${created.id}`);
  assert.equal(r.json.status, 'published');
  assert.match(r.json.liveUrl, /^https:\/\/www\.etsy\.com\/listing\//);
  r = await call('POST', `/api/printify/products/9001/${created.id}/publish`, { confirm: true });
  assert.equal(r.status, 409, 'cannot publish twice');
  r = await call('GET', '/api/history');
  assert.equal(r.json[0].status, 'published');
});

test('the app never deletes or modifies existing Printify products', () => {
  assert.deepEqual(mock.violations, []);
  const methods = new Set(mock.calls.map((c) => `${c.method} ${c.path.replace(/\/[0-9a-f]{24}/g, '/:id').replace(/\/\d+/g, '/:n')}`));
  for (const m of methods) assert.match(m, /^(GET|POST) /);
  const posts = [...methods].filter((m) => m.startsWith('POST'));
  assert.deepEqual(posts.sort(), ['POST /v1/shops/:n/products.json', 'POST /v1/shops/:n/products/:id/publish.json', 'POST /v1/uploads/images.json'].sort());
});

test('static files are served with security headers; no traversal', async () => {
  const r = await call('GET', '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  const t = await fetch(`${base}/..%2fserver.js`);
  assert.equal(t.status, 404);
});

test('the token appears nowhere: logs, data files (except settings), client code', () => {
  assert.ok(logs.length > 0);
  for (const line of logs) assert.ok(!line.includes(TOKEN), `token in log: ${line}`);
  for (const f of fs.readdirSync(dataDir)) {
    if (f === 'settings.json') continue;
    assert.ok(!fs.readFileSync(path.join(dataDir, f), 'utf8').includes(TOKEN), `token in ${f}`);
  }
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(path.join(import.meta.dirname, '..', 'public'))) {
    const text = fs.readFileSync(f, 'utf8');
    assert.ok(!text.includes(TOKEN));
    assert.ok(!/PRINTIFY_API_TOKEN|api\.printify\.com/.test(text), `${f} references Printify directly`);
  }
});

test('fonts endpoint falls back to the bundled Google Fonts snapshot', async () => {
  const r = await call('GET', '/api/fonts');
  assert.ok(r.json.families.length > 1500);
  const anton = r.json.families.find((f) => f[0] === 'Anton');
  assert.equal(anton[2], '400');
});
