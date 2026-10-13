// Thin Printify REST client. Endpoints and payloads follow Printify's official
// API reference (https://developers.printify.com/). The token is read from the
// store at call time, put in the Authorization header, and nowhere else.
import { getPrintifyToken } from './store.js';

const API_BASE = (process.env.PRINTIFY_API_BASE || 'https://api.printify.com').replace(/\/$/, '');
const USER_AGENT = 'POD-Type-Studio/1.0';

export class PrintifyError extends Error {
  constructor(message, { status = 0, raw = '' } = {}) {
    super(message);
    this.status = status;
    this.raw = raw;
  }
}

// Never let the token leak through an error body or message echoed back to us.
export function redact(text, extraToken = '') {
  let s = typeof text === 'string' ? text : JSON.stringify(text ?? '', null, 2);
  for (const token of [getPrintifyToken(), extraToken]) {
    if (token && token.length >= 8) s = s.split(token).join('[redacted]');
  }
  return s.replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, 'Bearer [redacted]');
}

function plainMessage(status, action) {
  if (status === 401 || status === 403) return 'Printify did not accept the API token. Re-enter it in Settings.';
  if (status === 404) return `Printify could not find that item while ${action}.`;
  if (status === 429) return 'Printify is rate-limiting requests. Wait a minute and try again.';
  if (status >= 500) return `Printify had a server problem while ${action} — try again in a moment.`;
  return `Printify rejected the request while ${action} — try again. The details below say why.`;
}

async function call(method, path, { body, action, retries = method === 'GET' ? 2 : 0, token = getPrintifyToken() } = {}) {
  if (!token) throw new PrintifyError('Printify is not connected yet. Add your API token in Settings.', { status: 401 });

  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json;charset=utf-8',
          'User-Agent': USER_AGENT,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (err) {
      if (attempt < retries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new PrintifyError(`Could not reach Printify while ${action}. Check your connection and try again.`, {
        raw: redact(String(err && err.message), token),
      });
    }

    const text = await res.text();
    if (res.ok) {
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        throw new PrintifyError(`Printify sent an unreadable response while ${action}.`, { status: res.status, raw: redact(text.slice(0, 4000), token) });
      }
    }
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
      await sleep(Math.min(wait, 10_000));
      continue;
    }
    throw new PrintifyError(plainMessage(res.status, action), {
      status: res.status,
      raw: redact(`HTTP ${res.status} ${method} ${path}\n${text.slice(0, 8000)}`, token),
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Catalog data changes rarely; cache it to stay well under Printify's rate limits.
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}
export function clearCache() {
  cache.clear();
}

const HOUR = 3600e3;

export const printify = {
  listShops: () => call('GET', '/v1/shops.json', { action: 'listing shops' }),

  // Used once when a new token is entered, before it is saved.
  verifyToken: (token) => call('GET', '/v1/shops.json', { action: 'checking the token', token, retries: 0 }),

  listBlueprints: () =>
    cached('blueprints', 24 * HOUR, () => call('GET', '/v1/catalog/blueprints.json', { action: 'loading the catalog' })),

  getBlueprint: (id) =>
    cached(`bp:${id}`, 24 * HOUR, () => call('GET', `/v1/catalog/blueprints/${id}.json`, { action: 'loading a product' })),

  listProviders: (blueprintId) =>
    cached(`pp:${blueprintId}`, 6 * HOUR, () =>
      call('GET', `/v1/catalog/blueprints/${blueprintId}/print_providers.json`, { action: 'loading print providers' })),

  getVariants: (blueprintId, providerId) =>
    cached(`var:${blueprintId}:${providerId}`, 6 * HOUR, () =>
      call('GET', `/v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`, {
        action: 'loading colors and sizes',
      })),

  uploadImage: (fileName, base64) =>
    call('POST', '/v1/uploads/images.json', {
      body: { file_name: fileName, contents: base64 },
      action: 'uploading the design',
    }),

  createProduct: (shopId, product) =>
    call('POST', `/v1/shops/${shopId}/products.json`, { body: product, action: 'creating the draft product' }),

  getProduct: (shopId, productId) =>
    call('GET', `/v1/shops/${shopId}/products/${productId}.json`, { action: 'loading the product' }),

  publishProduct: (shopId, productId) =>
    call('POST', `/v1/shops/${shopId}/products/${productId}/publish.json`, {
      body: { title: true, description: true, images: true, variants: true, tags: true, keyFeatures: true, shipping_template: true },
      action: 'publishing the product',
    }),
};

// Printify returns `external` as an object ({id, handle}) on most shops; be
// tolerant of an array too. `handle` is the live listing URL when the sales
// channel provides one.
export function externalOf(product) {
  const ext = Array.isArray(product?.external) ? product.external[0] : product?.external;
  if (!ext || (!ext.id && !ext.handle)) return null;
  return { id: ext.id || null, handle: ext.handle || null };
}
