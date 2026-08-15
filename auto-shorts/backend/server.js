'use strict';
/**
 * AUTO SHORTS server.
 *
 * A local-first Node process: it serves the editor UI, holds the projects, and
 * drives FFmpeg. Nothing is uploaded anywhere. Start it, open the page, and
 * everything from import to export happens on this machine.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const config = require('./config-shim');
const store = require('./store');
const jobs = require('./jobs');
const ff = require('../video-engine/ffmpeg');
const sfxLib = require('../audio/sfx');
const { AppError } = require('../utils/errors');

const projectsRoutes = require('./routes/projects');
const mediaRoutes = require('./routes/media');
const editRoutes = require('./routes/edit');
const renderRoutes = require('./routes/render');
const systemRoutes = require('./routes/system');

const app = express();

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// The editor and the API are same-origin in normal use; this only matters when
// running the Vite dev server on a different port.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ------------------------------------------------------------------ API */

app.use('/api', systemRoutes.router);
app.use('/api/projects', projectsRoutes.router);
app.use('/api/projects', mediaRoutes.router);
app.use('/api/projects', editRoutes.router);
app.use('/api/projects', renderRoutes.router);

/* ------------------------------------------------------------------- UI */

const dist = config.paths.frontendDist;
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  // Client-side routing: any non-API path serves the app shell.
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>AUTO SHORTS — build the UI</title>
<style>
  body{background:#0b0c10;color:#e8e9ed;font:16px/1.6 system-ui,-apple-system,sans-serif;padding:40px;max-width:640px;margin:0 auto}
  code{background:#181a22;padding:2px 7px;border-radius:5px;color:#4de1ff}
  pre{background:#181a22;padding:16px;border-radius:10px;overflow-x:auto}
  h1{letter-spacing:-.02em}
</style></head><body>
<h1>AUTO SHORTS</h1>
<p>The API is running, but the editor interface has not been built yet.</p>
<pre>cd auto-shorts
npm --prefix frontend install
npm run build</pre>
<p>Then reload this page. For live reloading while developing the UI, run
<code>npm run frontend</code> in a second terminal and open the Vite URL it prints.</p>
<p>The API is available now at <code>/api/capabilities</code>.</p>
</body></html>`);
  });
}

/* -------------------------------------------------------- error handling */

// 404 for unknown API routes, as JSON rather than Express's HTML page.
app.use('/api', (req, res) => {
  res.status(404).json({
    error: true,
    code: 'NO_SUCH_ENDPOINT',
    what: `There is no API endpoint at ${req.method} ${req.originalUrl}.`,
    why: 'The page may be running an older build of the interface than the server.',
    fix: 'Reload the page. If that does not help, rebuild the frontend with "npm run build".',
  });
});

// Every error reaches the client as what / why / fix.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.status).json(err.toJSON());
  }
  // A browser asking for a byte range of a file that is not there yet.
  if (err && (err.status === 416 || err.statusCode === 416 || err.name === 'RangeNotSatisfiableError')) {
    return res.status(416).json({
      error: true,
      code: 'RANGE_NOT_SATISFIABLE',
      what: 'That media file could not be streamed.',
      why: 'The browser asked for part of a file that is empty or still being written.',
      fix: 'Wait for the upload to finish processing, or re-upload the file.',
    });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      error: true,
      code: 'BODY_TOO_LARGE',
      what: 'That request was too large to accept.',
      why: 'JSON bodies are limited to 12 MB; media goes through the upload endpoint instead.',
      fix: 'Upload media files with the Upload button rather than pasting them in.',
    });
  }

  console.error('[unhandled]', err);
  res.status(500).json({
    error: true,
    code: 'INTERNAL',
    what: 'The server hit an unexpected problem.',
    why: err && err.message ? err.message : 'No further detail is available.',
    fix: 'Try again. The full stack trace is in the terminal running the server.',
  });
});

/* -------------------------------------------------------------- start-up */

function start() {
  store.ensureDirs();

  // Synthesize the sound-effect palette on first boot.
  const written = sfxLib.generateAll(config.paths.sfx);
  if (written.length) {
    console.log(`  synthesized ${written.length} sound effects -> assets/sfx/`);
  }

  if (!ff.available()) {
    console.warn('\n  WARNING: FFmpeg was not found.');
    console.warn('  Media import, preview and export will all fail until it is available.');
    console.warn('  Fix: run "npm install" in auto-shorts/, or set AUTOSHORTS_FFMPEG to an ffmpeg binary.\n');
  }

  const server = app.listen(config.port, config.host, () => {
    const shown = config.host === '0.0.0.0' ? 'localhost' : config.host;
    console.log('');
    console.log('  AUTO SHORTS');
    console.log(`  editor    http://${shown}:${config.port}`);
    console.log(`  projects  ${config.paths.projects}`);
    console.log(`  ffmpeg    ${ff.FFMPEG || 'NOT FOUND'}`);
    console.log(`  font      ${config.font.family}${config.font.file ? '' : '  (no font file found — captions may not render)'}`);
    console.log('');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${config.port} is already in use.`);
      console.error(`  Something else is running there — stop it, or start with: PORT=5175 npm start\n`);
      process.exit(1);
    }
    throw err;
  });

  return server;
}

if (require.main === module) start();

module.exports = { app, start };
