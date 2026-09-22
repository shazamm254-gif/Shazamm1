/**
 * End-to-end test of the whole workflow in a real browser:
 * upload → studio → preview animates → export → playable video file.
 *
 *   node tests/e2e.mjs [--preset cinematic_push_in] [--headed]
 *
 * Renders at an Android-ish viewport (412×915, DPR 2.6) so the layout is
 * exercised at the size it is designed for.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writePng } from './make-test-image.mjs';

/** Playwright may be installed locally or globally; try both before giving up. */
async function loadPlaywright() {
  const candidates = ['playwright', 'playwright-core',
                      '/opt/node22/lib/node_modules/playwright/index.mjs'];
  for (const id of candidates) {
    try { return await import(id); } catch { /* try the next one */ }
  }
  throw new Error('Playwright not found. Install it with: npm i -D playwright');
}

const { chromium } = await loadPlaywright();

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = process.env.OUT_DIR || resolve(ROOT, '.test-output');
const PORT = Number(process.env.PORT || 8781);

const args = process.argv.slice(2);
const presetArg = valueOf('--preset');
const encoderArg = valueOf('--encoder');
const headed = args.includes('--headed');

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const imagePath = resolve(OUT, 'test-image.png');
  writePng(imagePath);

  const server = spawn(process.execPath, [resolve(ROOT, 'backend/server.js')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer(`http://127.0.0.1:${PORT}/index.html`);

  const browser = await chromium.launch({
    channel: 'chromium',
    headless: !headed,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
           '--autoplay-policy=no-user-gesture-required'],
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
               '(KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    const query = encoderArg ? `?encoder=${encoderArg}` : '';
    await page.goto(`http://127.0.0.1:${PORT}/index.html${query}`, { waitUntil: 'networkidle' });
    console.log(`\n=== workflow run${encoderArg ? ` (encoder: ${encoderArg})` : ''} ===`);

    /* --------------------------- 1. upload --------------------------- */
    await page.waitForSelector('.dropzone', { timeout: 10_000 });
    await page.screenshot({ path: resolve(OUT, '01-upload.png') });
    check('upload screen renders', await page.isVisible('.dropzone'));

    await page.setInputFiles('input[type=file]', imagePath);

    /* --------------------------- 2. studio --------------------------- */
    await page.waitForSelector('.stage__frame', { timeout: 20_000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('.stage__canvas');
      return c && c.width > 0;
    }, null, { timeout: 20_000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: resolve(OUT, '02-studio.png') });

    const layout = await page.evaluate(() => {
      const frame = document.querySelector('.stage__frame').getBoundingClientRect();
      const btn = document.querySelector('.btn--primary').getBoundingClientRect();
      const doc = document.documentElement;
      return {
        frameAspect: frame.width / frame.height,
        buttonVisible: btn.top >= 0 && btn.bottom <= window.innerHeight,
        buttonHeight: btn.height,
        horizontalScroll: doc.scrollWidth - doc.clientWidth,
        presetChips: document.querySelectorAll('.chip--preset__chip, .chiprow .chip').length,
      };
    });
    check('stage is 9:16', Math.abs(layout.frameAspect - 9 / 16) < 0.02,
          `aspect ${layout.frameAspect.toFixed(4)}`);
    check('CREATE VIDEO is on screen without scrolling', layout.buttonVisible);
    check('primary button is a large touch target', layout.buttonHeight >= 52,
          `${layout.buttonHeight.toFixed(0)}px`);
    check('no horizontal page scroll', layout.horizontalScroll === 0,
          `overflow ${layout.horizontalScroll}px`);

    /* ------------------------ 3. depth + motion ---------------------- */
    const depth = await page.evaluate(() => {
      const d = window.__engine.depth;
      const n = d.data.length;
      let min = 1, max = 0, sum = 0;
      for (let i = 0; i < n; i++) { const v = d.data[i]; if (v < min) min = v; if (v > max) max = v; sum += v; }
      // Is the sharp subject region read as nearer than the flat sky?
      const at = (fx, fy) => d.data[Math.round(fy * (d.height - 1)) * d.width + Math.round(fx * (d.width - 1))];
      return {
        width: d.width, height: d.height,
        min, max, mean: sum / n,
        subject: at(0.5, 0.65),
        sky: at(0.2, 0.12),
        focus: d.focus,
        pivot: window.__engine.pivot,
        png: d.canvas.toDataURL('image/png'),
      };
    });
    writeFileSync(resolve(OUT, '03-depth.png'),
      Buffer.from(depth.png.split(',')[1], 'base64'));
    check('depth map has real range', depth.max - depth.min > 0.6,
          `${depth.min.toFixed(2)}–${depth.max.toFixed(2)}`);
    check('sharp subject reads nearer than flat sky', depth.subject > depth.sky + 0.15,
          `subject ${depth.subject.toFixed(2)} vs sky ${depth.sky.toFixed(2)}`);
    check('parallax pivot sits on the subject', depth.pivot >= 0.30 && depth.pivot <= 0.85,
          depth.pivot.toFixed(3));

    if (presetArg) {
      await page.evaluate((id) => window.__setPreset(id), presetArg);
      await page.waitForTimeout(500);
    }

    // The preview must actually move — and the frames must differ.
    const motion = await page.evaluate(async () => {
      const e = window.__engine;
      const shot = (t) => {
        e.renderAt(t);
        const gl = e.renderer.gl;
        const w = e.renderer.width, h = e.renderer.height;
        const px = new Uint8Array(w * h * 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return px;
      };
      e.stopPreview();
      const a = shot(0);
      const b = shot(e.duration * 0.5);
      const c = shot(e.duration * 0.98);

      const diff = (x, y) => {
        let sum = 0;
        for (let i = 0; i < x.length; i += 4) sum += Math.abs(x[i] - y[i]);
        return sum / (x.length / 4) / 255;
      };
      let nonBlack = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i] + a[i + 1] + a[i + 2] > 24) nonBlack++;

      e.startPreview();
      return {
        coverage: nonBlack / (a.length / 4),
        midDiff: diff(a, b),
        endDiff: diff(a, c),
      };
    });
    check('frame is drawn (not blank)', motion.coverage > 0.9,
          `${(motion.coverage * 100).toFixed(1)}% lit`);
    check('the clip actually moves', motion.midDiff > 0.004 && motion.endDiff > motion.midDiff * 0.9,
          `mid ${motion.midDiff.toFixed(4)} end ${motion.endDiff.toFixed(4)}`);

    /* --------------------------- 4. reframe -------------------------- */
    const frameBox = await page.locator('.stage__frame').boundingBox();
    await page.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + frameBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(frameBox.x + frameBox.width / 2 - 70, frameBox.y + frameBox.height / 2, { steps: 8 });
    await page.mouse.up();
    const crop = await page.evaluate(() => window.__engine.crop);
    check('dragging reframes the image', Math.abs(crop.x) > 0.01, `crop.x ${crop.x.toFixed(3)}`);
    check('reframing stays inside the image', Math.abs(crop.x) <= 0.5 && Math.abs(crop.y) <= 0.5);
    await page.click('.stage__reset');

    /* --------------------------- 5. export --------------------------- */
    const started = Date.now();
    await page.click('.btn--primary');
    await page.waitForSelector('.render__ring', { timeout: 10_000 });

    // Read progress before screenshotting: a full-page shot at this DPR takes
    // seconds on a software rasterizer and would race the render to the end.
    let midway = '';
    for (let i = 0; i < 40 && !/[1-9]\d*%/.test(midway); i++) {
      midway = (await page.textContent('.render__pct').catch(() => '')) || '';
      if (!(await page.isVisible('.render__ring').catch(() => false))) break;
      await page.waitForTimeout(100);
    }
    check('progress is reported during render', /\d+%/.test(midway), `showed ${midway}`);
    await page.screenshot({ path: resolve(OUT, '04-render.png') }).catch(() => {});

    await page.waitForSelector('.result__video', { timeout: 180_000 });
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    await page.waitForTimeout(900);
    await page.screenshot({ path: resolve(OUT, '05-result.png') });

    const info = await page.evaluate(async () => {
      const v = document.querySelector('.result__video');
      await new Promise(r => {
        if (v.readyState >= 2) return r();
        v.addEventListener('loadeddata', r, { once: true });
        setTimeout(r, 6000);
      });
      const res = await fetch(v.src);
      const buf = await res.arrayBuffer();
      const head = new Uint8Array(buf.slice(0, 16));
      return {
        bytes: buf.byteLength,
        head: Array.from(head),
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        duration: v.duration,
        meta: [...document.querySelectorAll('.result__meta span')].map(s => s.textContent),
        encoder: window.__lastResult && window.__lastResult.encoder,
        frames: window.__lastResult && window.__lastResult.frames,
        downloadLabel: document.querySelector('.result__actions .btn--primary').textContent.trim(),
        b64: (() => {
          const bytes = new Uint8Array(buf);
          let bin = '';
          for (let i = 0; i < bytes.length; i += 8192) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
          }
          return btoa(bin);
        })(),
      };
    });

    const magic = String.fromCharCode(...info.head.slice(4, 8));
    const isMp4 = magic === 'ftyp';
    const isWebm = info.head[0] === 0x1A && info.head[1] === 0x45;

    const suffix = encoderArg ? `-${encoderArg}` : '';
    writeFileSync(resolve(OUT, `clip${suffix}.${isMp4 ? 'mp4' : 'webm'}`), Buffer.from(info.b64, 'base64'));

    check('a video file was produced', info.bytes > 20_000, `${(info.bytes / 1024).toFixed(0)} KB in ${elapsed}s`);
    check('container is MP4 or WebM', isMp4 || isWebm, isMp4 ? 'MP4 (ftyp)' : isWebm ? 'WebM' : `unknown ${magic}`);
    check('video decodes in the browser', info.videoWidth > 0 && info.videoHeight > 0,
          `${info.videoWidth}×${info.videoHeight}`);
    check('output is 9:16', Math.abs(info.videoWidth / info.videoHeight - 9 / 16) < 0.01);
    const exactEncoder = /^webcodecs/.test(info.encoder || '');
    const tolerance = exactEncoder ? 0.1 : 1.0;
    check(`duration matches the request (${info.encoder})`,
          Math.abs(info.duration - 5) <= tolerance,
          `${info.duration.toFixed(3)}s, tolerance ±${tolerance}s`);
    if (exactEncoder) {
      check('every frame was rendered at the exact frame rate', info.frames === 150,
            `${info.frames} frames`);
    }
    check('download button is obvious', /DOWNLOAD/i.test(info.downloadLabel), info.downloadLabel);

    /* ------------------------ 6. repeat the loop ---------------------- */
    await page.click('text=🖼 Use another image');
    await page.waitForSelector('.dropzone', { timeout: 10_000 });
    check('can start over with another image', await page.isVisible('.dropzone'));

    check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    server.kill();
  }

  const failed = checks.filter(c => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  console.log(`Artifacts in ${OUT}`);
  if (failed.length) process.exit(1);
}

async function waitForServer(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`server never came up at ${url}`);
}

main().catch(e => { console.error(e); process.exit(1); });
