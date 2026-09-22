/**
 * Visual check: renders a grid of presets × time into one PNG.
 *
 * Automated checks can tell you the clip moved; they cannot tell you it looks
 * right. This makes that judgement cheap.
 *
 *   node tests/contact-sheet.mjs [preset,preset,...]
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, '.test-output');
const PORT = Number(process.env.PORT || 8797);

const PRESETS = (process.argv[2] || [
  'cinematic_push_in', 'parallax_orbit', 'heavy_rain', 'lightning_storm',
  'fire_embers', 'snowfall', 'rolling_fog', 'floating_dust', 'god_rays',
].join(',')).split(',');

mkdirSync(OUT, { recursive: true });
const imagePath = resolve(OUT, 'test-image.png');
writePng(imagePath);

const server = spawn(process.execPath, [resolve(ROOT, 'backend/server.js')], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: 'ignore',
});
await new Promise(r => setTimeout(r, 1200));

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await (await browser.newContext({
  viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true,
})).newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e)));

await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForSelector('.dropzone');
await page.setInputFiles('input[type=file]', imagePath);
await page.waitForSelector('.stage__frame');
await page.waitForTimeout(600);

const dataUrl = await page.evaluate(async (presets) => {
  const e = window.__engine;
  e.stopPreview();

  const CW = 270, CH = 480, PAD = 10, LABEL = 22;
  const times = [0, 0.25, 0.5, 0.75, 1];

  const sheet = document.createElement('canvas');
  sheet.width = PAD + times.length * (CW + PAD);
  sheet.height = PAD + presets.length * (CH + PAD + LABEL);
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#0a0b0f';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textBaseline = 'top';

  e.renderer.resize(CW * 2, CH * 2);

  for (let r = 0; r < presets.length; r++) {
    window.__setPreset(presets[r]);
    e.stopPreview();
    e.renderer.resize(CW * 2, CH * 2);
    const y = PAD + r * (CH + PAD + LABEL);

    ctx.fillStyle = '#9aa2b4';
    ctx.fillText(`${presets[r]}  ·  ${e.duration}s`, PAD, y);

    for (let c = 0; c < times.length; c++) {
      e.renderAt(times[c] * e.duration);
      ctx.drawImage(e.renderer.canvas, PAD + c * (CW + PAD), y + LABEL, CW, CH);
    }
  }
  return sheet.toDataURL('image/png');
}, PRESETS);

const out = resolve(OUT, 'contact-sheet.png');
writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log(`wrote ${out}`);

await browser.close();
server.kill();
