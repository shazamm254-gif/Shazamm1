#!/usr/bin/env node
/**
 * Optional static host for the frontend.
 *
 * The app itself needs no backend: it renders and encodes in the browser.
 * This exists so you can serve it over your LAN and open it on a phone, or
 * drop it on any free Node host. It holds no secrets and touches no user
 * data — it only serves files out of ../frontend.
 *
 *   node backend/server.js            # http://localhost:8080
 *   PORT=3000 node backend/server.js
 *
 * Note on HTTPS: WebCodecs and the clipboard need a secure context.
 * http://localhost counts as one; http://192.168.x.x does not, so over a LAN
 * the app falls back to the MediaRecorder encoder. Any HTTPS host (GitHub
 * Pages, Netlify, Cloudflare Pages) gets the full hardware H.264 path.
 */

import { createServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..', 'frontend');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method Not Allowed');
    }

    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    // Contain every request inside ROOT: normalize, then verify the resolved
    // path is still under the root before touching the filesystem.
    const target = resolve(join(ROOT, normalize(pathname)));
    if (target !== ROOT && !target.startsWith(ROOT + sep)) {
      return send(res, 403, 'Forbidden');
    }

    const stat = await fs.stat(target).catch(() => null);
    if (!stat || !stat.isFile()) return send(res, 404, 'Not Found');

    res.writeHead(200, {
      'Content-Type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      // The app is all static modules; don't let a stale cache strand a user.
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(target).pipe(res);
  } catch (err) {
    send(res, 500, 'Internal Server Error');
    console.error(err);
  }
});

function send(res, code, message) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

server.listen(PORT, HOST, () => {
  console.log(`Motion Studio  →  http://localhost:${PORT}`);
  console.log(`Serving ${ROOT}`);
});
