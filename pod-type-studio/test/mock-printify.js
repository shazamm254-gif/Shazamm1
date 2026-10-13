// A strict stand-in for the Printify API, used by the tests. It validates the
// upload and create-product payloads against the shapes in Printify's API
// reference and rejects anything off-spec, so tests catch payload mistakes.
// IDs here are deliberately arbitrary: the app must find things by name.
import http from 'node:http';
import crypto from 'node:crypto';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const COLORS = ['Black', 'White', 'Navy', 'Heather Grey', 'Red'];
const SIZES = ['S', 'M', 'L', 'XL', '2XL'];
const COST = { S: 1129, M: 1129, L: 1129, XL: 1129, '2XL': 1427 };

export function startMock({ token, port = 0 }) {
  const calls = [];
  const violations = [];
  const uploads = new Map();
  const products = new Map();
  let failNextUpload = false;

  const blueprints = [
    { id: 145, title: 'Unisex Softstyle T-Shirt', brand: 'Gildan', model: '64000', images: [] },
    { id: 506, title: 'Youth Short Sleeve Tee', brand: 'Bella+Canvas', model: '3001Y', images: [] },
    { id: 777, title: 'Unisex Jersey Short Sleeve Tee', brand: 'Bella+Canvas', model: '3001', images: [] },
    { id: 778, title: 'Unisex CVC Jersey T-shirt', brand: 'Bella+Canvas', model: '3001CVC', images: [] },
    { id: 900, title: 'Unisex Heavy Blend Hooded Sweatshirt', brand: 'Gildan', model: '18500', images: [] },
  ];
  const providers = { 777: [{ id: 41, title: 'Monster Digital', location: { city: 'Rancho Dominguez', country: 'US' } }, { id: 42, title: 'SwiftPOD', location: { city: 'Los Angeles', country: 'US' } }] };

  function variantsFor(bp, pp) {
    const out = [];
    let id = bp * 100 + pp * 1000;
    for (const color of COLORS) {
      for (const size of SIZES) {
        // Provider 42 prints 2XL on a different-shaped area, to exercise grouping.
        const front = pp === 42 && size === '2XL' ? { position: 'front', width: 4200, height: 4800 } : { position: 'front', width: 4500, height: 5100 };
        out.push({ id: ++id, title: `${color} / ${size}`, options: { color, size }, placeholders: [{ position: 'back', width: 4500, height: 5100 }, front] });
      }
    }
    return out;
  }

  const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const invalid = (res, reason) => send(res, 400, { status: 'error', code: 8150, message: 'Validation failed.', errors: { reason } });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      return invalid(res, 'Body is not JSON');
    }
    calls.push({ method: req.method, path: url.pathname, body });

    if (url.pathname.startsWith('/mockups/')) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(TINY_PNG);
    }
    if (req.method === 'DELETE' || req.method === 'PUT') violations.push(`${req.method} ${url.pathname}`);
    if (!req.headers['user-agent']) return send(res, 400, { error: 'User-Agent header required' });
    if (req.headers.authorization !== `Bearer ${token}`) {
      // Echo the header back, like a careless API might — the app must redact it.
      return send(res, 401, { code: 10001, message: 'Unauthenticated', echo: req.headers.authorization });
    }

    const m = (re) => url.pathname.match(re);
    let r;
    if (req.method === 'GET' && url.pathname === '/v1/shops.json')
      return send(res, 200, [{ id: 9001, title: 'Rodney Tees', sales_channel: 'etsy' }, { id: 9002, title: 'Test Store', sales_channel: 'custom_integration' }]);
    if (req.method === 'GET' && url.pathname === '/v1/catalog/blueprints.json') return send(res, 200, blueprints);
    if (req.method === 'GET' && (r = m(/^\/v1\/catalog\/blueprints\/(\d+)\/print_providers\.json$/))) return send(res, 200, providers[r[1]] || []);
    if (req.method === 'GET' && (r = m(/^\/v1\/catalog\/blueprints\/(\d+)\/print_providers\/(\d+)\/variants\.json$/))) {
      const bp = Number(r[1]), pp = Number(r[2]);
      if (!(providers[bp] || []).some((p) => p.id === pp)) return send(res, 404, { message: 'Not found' });
      return send(res, 200, { id: pp, title: 'provider', variants: variantsFor(bp, pp) });
    }

    if (req.method === 'POST' && url.pathname === '/v1/uploads/images.json') {
      if (failNextUpload) {
        failNextUpload = false;
        return invalid(res, 'Image could not be processed');
      }
      if (typeof body?.file_name !== 'string' || !body.file_name) return invalid(res, 'file_name is required');
      if (typeof body.contents !== 'string') return invalid(res, 'contents (base64) or url is required');
      const buf = Buffer.from(body.contents, 'base64');
      if (buf.toString('latin1', 1, 4) !== 'PNG') return invalid(res, 'contents is not a PNG');
      const id = crypto.randomBytes(12).toString('hex');
      const up = { id, file_name: body.file_name, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), size: buf.length, mime_type: 'image/png', preview_url: `/mockups/${id}.png`, upload_time: new Date().toISOString() };
      uploads.set(id, up);
      return send(res, 200, up);
    }

    let s;
    if ((s = m(/^\/v1\/shops\/(\d+)\/products\.json$/)) && req.method === 'POST') {
      if (![9001, 9002].includes(Number(s[1]))) return send(res, 404, { message: 'Shop not found' });
      const p = body || {};
      if (typeof p.title !== 'string' || !p.title.trim()) return invalid(res, 'title is required');
      if (typeof p.description !== 'string') return invalid(res, 'description is required');
      if (!Number.isInteger(p.blueprint_id) || !blueprints.some((b) => b.id === p.blueprint_id)) return invalid(res, 'blueprint_id is invalid');
      if (!Number.isInteger(p.print_provider_id) || !(providers[p.blueprint_id] || []).some((x) => x.id === p.print_provider_id)) return invalid(res, 'print_provider_id is invalid');
      const catalog = variantsFor(p.blueprint_id, p.print_provider_id);
      const byId = new Map(catalog.map((v) => [v.id, v]));
      if (!Array.isArray(p.variants) || !p.variants.length) return invalid(res, 'variants is required');
      if (p.variants.length > 100) return invalid(res, 'A product can have up to 100 variants');
      for (const v of p.variants) {
        if (!byId.has(v.id)) return invalid(res, `variant ${v.id} does not exist`);
        if (!Number.isInteger(v.price) || v.price <= 0) return invalid(res, 'variants.price must be an integer in cents');
        if (typeof v.is_enabled !== 'boolean') return invalid(res, 'variants.is_enabled must be boolean');
      }
      if (!Array.isArray(p.print_areas) || !p.print_areas.length) return invalid(res, 'print_areas is required');
      const covered = new Set();
      for (const a of p.print_areas) {
        if (!Array.isArray(a.variant_ids) || !a.variant_ids.length) return invalid(res, 'print_areas.variant_ids is required');
        for (const id of a.variant_ids) {
          if (!byId.has(id)) return invalid(res, `print_areas variant ${id} does not exist`);
          covered.add(id);
        }
        if (!Array.isArray(a.placeholders) || !a.placeholders.length) return invalid(res, 'print_areas.placeholders is required');
        for (const ph of a.placeholders) {
          if (!['front', 'back'].includes(ph.position)) return invalid(res, `unknown position ${ph.position}`);
          if (!Array.isArray(ph.images) || !ph.images.length) return invalid(res, 'The print_areas.0.placeholders.0.images field is required.');
          for (const img of ph.images) {
            if (!uploads.has(img.id)) return invalid(res, `image ${img.id} not found`);
            for (const k of ['x', 'y', 'scale', 'angle']) if (typeof img[k] !== 'number') return invalid(res, `images.${k} must be a number`);
          }
        }
      }
      for (const v of p.variants) if (v.is_enabled && !covered.has(v.id)) return invalid(res, `variant ${v.id} has no print area`);
      const id = crypto.randomBytes(12).toString('hex');
      const product = {
        id,
        title: p.title,
        description: p.description,
        tags: [],
        options: [],
        variants: p.variants.map((v) => ({ id: v.id, sku: String(v.id), cost: COST[byId.get(v.id).options.size], price: v.price, title: byId.get(v.id).title, grams: 150, is_enabled: v.is_enabled, is_default: false, is_available: true, options: [] })),
        images: [], // mockups are generated a moment later
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        visible: false,
        is_locked: false,
        blueprint_id: p.blueprint_id,
        user_id: 1,
        shop_id: Number(s[1]),
        print_provider_id: p.print_provider_id,
        print_areas: p.print_areas,
        sales_channel_properties: [],
        _gets: 0,
        _published: false,
      };
      products.set(id, product);
      return send(res, 200, publicProduct(product));
    }

    let g;
    if ((g = m(/^\/v1\/shops\/(\d+)\/products\/(\w+)\.json$/)) && req.method === 'GET') {
      const p = products.get(g[2]);
      if (!p) return send(res, 404, { message: 'Not found' });
      p._gets++;
      if (p._gets >= 1 && !p.images.length) {
        const ids = p.variants.filter((v) => v.is_enabled).map((v) => v.id);
        p.images = [0, 1, 2].map((n) => ({ src: `http://127.0.0.1:${server.address().port}/mockups/${p.id}/${n}.png`, variant_ids: ids, position: n ? 'other' : 'front', is_default: n === 0 }));
      }
      if (p._published && !p.external) {
        p.external = { id: '1234567890', handle: `https://www.etsy.com/listing/1234567890/${p.id}` };
        p.visible = true;
        p.is_locked = false;
      }
      return send(res, 200, publicProduct(p));
    }

    if ((g = m(/^\/v1\/shops\/(\d+)\/products\/(\w+)\/publish\.json$/)) && req.method === 'POST') {
      const p = products.get(g[2]);
      if (!p) return send(res, 404, { message: 'Not found' });
      for (const k of ['title', 'description', 'images', 'variants', 'tags']) if (typeof body?.[k] !== 'boolean') return invalid(res, `${k} must be boolean`);
      p._published = true;
      p.is_locked = true;
      return send(res, 200, {});
    }

    return send(res, 404, { message: `No mock for ${req.method} ${url.pathname}` });
  });

  function publicProduct(p) {
    const { _gets, _published, ...rest } = p;
    return rest;
  }

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        calls,
        violations,
        products,
        uploads,
        failNextUpload: () => { failNextUpload = true; },
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

// Run standalone for manual testing: node test/mock-printify.js
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const token = process.env.MOCK_TOKEN || 'mock-token-for-local-testing-only-0000000000';
  startMock({ token, port: Number(process.env.MOCK_PORT || 8787) }).then((m) => console.log(`Mock Printify on ${m.url}`));
}
