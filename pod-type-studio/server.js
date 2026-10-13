// POD Type Studio — single deployable server: serves the phone-first editor and
// is the ONLY thing that ever talks to Printify. Zero npm dependencies; needs
// Node 18+ (works in Termux on Android).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './server/store.js';
import * as auth from './server/auth.js';
import { printify, PrintifyError, externalOf, clearCache } from './server/printify.js';
import { getFontList } from './server/fonts.js';
import {
  findDefaultBlueprint,
  searchBlueprints,
  blueprintSummary,
  normalizeVariants,
  printAreaGroups,
  buildProductPayload,
  pngInfo,
  productSummary,
} from './server/product.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, 'public');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const PRODUCT_URL_TEMPLATE = process.env.PRINTIFY_PRODUCT_URL_TEMPLATE || 'https://printify.com/app/editor/{productId}';
const EXTRA_IMG_ORIGIN = process.env.PRINTIFY_API_BASE ? ` ${new URL(process.env.PRINTIFY_API_BASE).origin}` : '';

const DEFAULT_PREFS = {
  priceCents: 2499,
  soldColors: ['Black', 'White', 'Navy'],
  description:
    '{title}\n\nAn original typographic design, printed on demand when you order.\n\n(Edit this default text in the publish screen.)',
  position: 'front',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: https://images.printify.com https://*.printify.com${EXTRA_IMG_ORIGIN}`,
  "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, message, raw) {
    super(message);
    this.status = status;
    this.raw = raw;
  }
}

function send(res, status, body, headers = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(json);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'That upload is too large.');
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'The request was not valid JSON.');
  }
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, { error: 'Not found' });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function prefs() {
  return { ...DEFAULT_PREFS, ...(store.getSettings().prefs || {}) };
}

function publicSettings() {
  const s = store.getSettings();
  return {
    printify: { connected: Boolean(store.getPrintifyToken()), source: store.tokenSource() },
    lastShopId: s.lastShopId ?? null,
    lastProduct: s.lastProduct ?? null,
    prefs: prefs(),
    fontsKey: Boolean(process.env.GOOGLE_FONTS_API_KEY),
  };
}

// ---- routes -----------------------------------------------------------------

const routes = [];
const route = (method, pattern, handler, opts = {}) => routes.push({ method, pattern, handler, opts });

route('GET', /^\/api\/auth\/status$/, async (req) => ({
  authed: auth.isAuthed(req),
  passcodeSet: Boolean(auth.passcodeSource()),
  canSetup: !auth.passcodeSource() && auth.isLoopback(req),
}), { public: true });

route('POST', /^\/api\/auth\/setup$/, async (req, res, _m, body) => {
  if (auth.passcodeSource()) throw new HttpError(409, 'A passcode is already set.');
  if (!auth.isLoopback(req))
    throw new HttpError(403, 'First-time setup only works on the phone running the server. On a hosted server, set the APP_PASSCODE environment variable.');
  const code = String(body.passcode || '');
  if (code.length < 6) throw new HttpError(400, 'Use at least 6 characters for the passcode.');
  auth.setPasscode(code);
  res.setHeader('Set-Cookie', auth.sessionCookie(auth.createSession(), req));
  return { ok: true };
}, { public: true });

route('POST', /^\/api\/auth\/login$/, async (req, res, _m, body) => {
  if (!auth.loginAllowed(req)) throw new HttpError(429, 'Too many wrong passcodes. Wait 10 minutes.');
  if (!auth.passcodeSource()) throw new HttpError(409, 'No passcode set yet.');
  if (!auth.checkPasscode(body.passcode || '')) {
    auth.recordFailedLogin(req);
    throw new HttpError(401, 'Wrong passcode.');
  }
  res.setHeader('Set-Cookie', auth.sessionCookie(auth.createSession(), req));
  return { ok: true };
}, { public: true });

route('POST', /^\/api\/auth\/logout$/, async (req, res) => {
  auth.destroySession(req);
  res.setHeader('Set-Cookie', auth.clearCookie(req));
  return { ok: true };
}, { public: true });

route('GET', /^\/api\/settings$/, async () => publicSettings());

route('POST', /^\/api\/settings\/token$/, async (_req, _res, _m, body) => {
  if (store.tokenSource() === 'env') throw new HttpError(409, 'The token is set by the server environment (PRINTIFY_API_TOKEN). Change it there.');
  const token = String(body.token || '').trim();
  if (token.length < 20) throw new HttpError(400, 'That does not look like a Printify API token.');
  const shops = await printify.verifyToken(token); // throws a plain-language error if Printify rejects it
  store.updateSettings({ printifyToken: token });
  clearCache();
  return { ...publicSettings(), shopCount: Array.isArray(shops) ? shops.length : 0 };
});

route('DELETE', /^\/api\/settings\/token$/, async () => {
  if (store.tokenSource() === 'env') throw new HttpError(409, 'The token is set by the server environment; remove PRINTIFY_API_TOKEN there.');
  store.updateSettings({ printifyToken: undefined });
  clearCache();
  return publicSettings();
});

route('PATCH', /^\/api\/settings$/, async (_req, _res, _m, body) => {
  const patch = {};
  if ('lastShopId' in body) patch.lastShopId = body.lastShopId;
  if ('lastProduct' in body) patch.lastProduct = body.lastProduct;
  if (body.prefs && typeof body.prefs === 'object') {
    const p = {};
    if (Number.isInteger(body.prefs.priceCents) && body.prefs.priceCents > 0) p.priceCents = body.prefs.priceCents;
    if (Array.isArray(body.prefs.soldColors)) p.soldColors = body.prefs.soldColors.map(String).slice(0, 60);
    if (typeof body.prefs.description === 'string') p.description = body.prefs.description.slice(0, 5000);
    patch.prefs = { ...(store.getSettings().prefs || {}), ...p };
  }
  store.updateSettings(patch);
  return publicSettings();
});

route('GET', /^\/api\/fonts$/, async () => {
  const list = await getFontList();
  return { source: list.source, families: list.families };
});

route('GET', /^\/api\/printify\/shops$/, async () => {
  const shops = await printify.listShops();
  return (shops || []).map((s) => ({ id: s.id, title: s.title, salesChannel: s.sales_channel }));
});

route('GET', /^\/api\/printify\/blueprints$/, async (req) => {
  const q = new URL(req.url, 'http://x').searchParams.get('q') || '';
  return searchBlueprints(await printify.listBlueprints(), q);
});

route('GET', /^\/api\/printify\/default-product$/, async () => {
  const bp = findDefaultBlueprint(await printify.listBlueprints());
  return bp ? { found: true, blueprint: blueprintSummary(bp) } : { found: false };
});

route('GET', /^\/api\/printify\/blueprints\/(\d+)\/providers$/, async (_req, _res, m) => {
  const list = await printify.listProviders(m[1]);
  return (list || []).map((p) => ({ id: p.id, title: p.title, location: p.location ? [p.location.city, p.location.country].filter(Boolean).join(', ') : '' }));
});

route('GET', /^\/api\/printify\/blueprints\/(\d+)\/providers\/(\d+)\/variants$/, async (req, _res, m) => {
  const position = new URL(req.url, 'http://x').searchParams.get('position') || 'front';
  const variants = normalizeVariants(await printify.getVariants(m[1], m[2]));
  const positions = [...new Set(variants.flatMap((v) => v.placeholders.map((p) => p.position)))];
  return { variants, positions, groups: printAreaGroups(variants, position) };
});

route('POST', /^\/api\/printify\/products$/, async (_req, _res, _m, body) => {
  const title = String(body.title || '').trim();
  if (!title) throw new HttpError(400, 'Add a product title before pushing.');
  const shopId = Number(body.shopId);
  const blueprintId = Number(body.blueprintId);
  const providerId = Number(body.printProviderId);
  const position = String(body.position || 'front');
  const priceCents = Number(body.priceCents);
  if (!shopId || !blueprintId || !providerId) throw new HttpError(400, 'Pick a shop and a product first.');
  if (!Number.isInteger(priceCents) || priceCents <= 0) throw new HttpError(400, 'Enter a price above $0.');
  const selectedIds = Array.isArray(body.variantIds) ? body.variantIds.map(Number).filter(Boolean) : [];
  if (!selectedIds.length) throw new HttpError(400, 'Pick at least one color and size.');

  const b64 = String(body.pngBase64 || '').replace(/^data:image\/png;base64,/, '');
  const png = Buffer.from(b64, 'base64');
  const info = pngInfo(png);
  if (!info) throw new HttpError(400, 'The design export is not a valid PNG. Export again.');

  // Re-read the catalog server-side: the browser never decides IDs or sizes.
  const variants = normalizeVariants(await printify.getVariants(blueprintId, providerId));
  const known = new Set(variants.map((v) => v.id));
  const unknown = selectedIds.filter((id) => !known.has(id));
  if (unknown.length) throw new HttpError(400, `Some selected variants are no longer offered by this provider (${unknown.join(', ')}). Reload colors and sizes.`);
  const groups = printAreaGroups(variants.filter((v) => selectedIds.includes(v.id)), position);
  if (!groups.length) throw new HttpError(400, `The selected variants have no "${position}" print area.`);
  const main = groups[0];
  if (info.width !== main.width || info.height !== main.height)
    throw new HttpError(400, `The PNG is ${info.width}×${info.height}px but the print area is ${main.width}×${main.height}px. Re-open the design so the canvas resizes, then export again.`);

  const fileName = `${title.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'design'}.png`;
  const upload = await printify.uploadImage(fileName, b64);
  if (!upload?.id) throw new HttpError(502, 'Printify rejected the upload — try again.', JSON.stringify(upload));

  const payload = buildProductPayload({
    title,
    description: String(body.description || ''),
    blueprintId,
    printProviderId: providerId,
    priceCents,
    variants,
    selectedIds,
    position,
    imageId: upload.id,
    image: info,
  });
  const product = await printify.createProduct(shopId, payload);
  if (!product?.id) throw new HttpError(502, 'Printify did not return the new product.', JSON.stringify(product));

  const summary = productSummary(product, shopId, PRODUCT_URL_TEMPLATE);
  store.addHistory({
    productId: product.id,
    shopId,
    shopTitle: String(body.shopTitle || ''),
    title,
    status: 'draft',
    createdAt: new Date().toISOString(),
    designId: String(body.designId || ''),
    blueprintTitle: String(body.blueprintTitle || ''),
    priceCents,
    variantCount: selectedIds.length,
    mockup: summary.images.find((i) => i.isDefault)?.src || summary.images[0]?.src || null,
    printifyUrl: summary.printifyUrl,
    liveUrl: null,
  });
  store.updateSettings({ lastShopId: shopId }); // remember his last shop
  return { product: summary, upload: { id: upload.id, width: info.width, height: info.height } };
});

function ownProduct(shopId, productId) {
  const h = store.findHistory(productId);
  if (!h || Number(h.shopId) !== Number(shopId))
    throw new HttpError(403, 'This app only works with products it created itself.');
  return h;
}

route('GET', /^\/api\/printify\/products\/(\d+)\/([\w-]+)$/, async (_req, _res, m) => {
  const h = ownProduct(m[1], m[2]);
  const p = await printify.getProduct(m[1], m[2]);
  const summary = productSummary(p, Number(m[1]), PRODUCT_URL_TEMPLATE);
  const ext = externalOf(p);
  const liveUrl = ext?.handle && /^https?:\/\//.test(ext.handle) ? ext.handle : null;
  const status = ext ? 'published' : h.status === 'publishing' ? 'publishing' : 'draft';
  const mockup = summary.images.find((i) => i.isDefault)?.src || summary.images[0]?.src || h.mockup;
  store.updateHistory(m[2], { status, liveUrl, external: ext, mockup });
  return { product: summary, status, external: ext, liveUrl };
});

route('POST', /^\/api\/printify\/products\/(\d+)\/([\w-]+)\/publish$/, async (_req, _res, m, body) => {
  if (body.confirm !== true) throw new HttpError(400, 'Publishing needs an explicit confirmation.');
  const h = ownProduct(m[1], m[2]);
  if (h.status === 'published') throw new HttpError(409, 'This product is already published.');
  await printify.publishProduct(m[1], m[2]);
  store.updateHistory(m[2], { status: 'publishing', publishedAt: new Date().toISOString() });
  return { ok: true, status: 'publishing' };
});

route('GET', /^\/api\/history$/, async () => store.getHistory());

// ---- server -------------------------------------------------------------------

export function createServer() {
  return http.createServer(async (req, res) => {
    const started = Date.now();
    const { pathname } = new URL(req.url, 'http://x');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    // Log method, path and status only — never headers, bodies or query strings.
    res.on('finish', () => {
      if (process.env.QUIET_LOGS !== '1') console.log(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - started}ms`);
    });

    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
      return serveStatic(req, res, pathname);
    }

    const r = routes.find((x) => x.method === req.method && x.pattern.test(pathname));
    if (!r) return send(res, 404, { error: 'Not found' });
    try {
      if (!r.opts.public && !auth.isAuthed(req)) throw new HttpError(401, 'Please unlock the app with your passcode.');
      // Same-origin JSON only: blocks cross-site form posts against the API.
      if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'pod-type-studio')
        throw new HttpError(403, 'Request blocked.');
      const limit = pathname === '/api/printify/products' ? 60 * 1024 * 1024 : 256 * 1024;
      const body = req.method === 'GET' ? {} : await readBody(req, limit);
      const result = await r.handler(req, res, pathname.match(r.pattern), body);
      send(res, 200, result);
    } catch (err) {
      if (err instanceof PrintifyError) {
        // Always 502 so the browser never mistakes a Printify 401 for "app locked".
        return send(res, 502, { error: err.message, printifyStatus: err.status, detail: err.raw, source: 'printify' });
      }
      if (err instanceof HttpError) return send(res, err.status, { error: err.message, detail: err.raw });
      console.error(`Unhandled error on ${req.method} ${pathname}: ${err && err.name}`);
      return send(res, 500, { error: 'Something went wrong on the server.', detail: String(err && err.message) });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, HOST, () => {
    console.log(`POD Type Studio running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`Printify: ${store.tokenSource() ? `connected (${store.tokenSource()})` : 'not connected — add the token in Settings'}`);
  });
}
