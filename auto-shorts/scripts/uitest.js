'use strict';
/**
 * Browser test of the real interface.
 *
 * Drives the built UI in Chromium exactly as a creator would: create a Short,
 * upload media, paste a script, press AUTO EDIT, review, scrub the preview,
 * fix a caption, undo, and export. Screenshots are written for inspection.
 *
 * Run with the server already listening:
 *   node backend/server.js &
 *   node scripts/uitest.js
 */

const path = require('path');
const fs = require('fs');

const BASE = process.env.AUTOSHORTS_URL || 'http://localhost:5174';
const MEDIA = path.join(__dirname, '..', 'data', 'testmedia');
const SHOTS = path.join(__dirname, '..', 'data', 'uitest');

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
}

async function main() {
  const { chromium } = require('playwright');
  fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  // A phone viewport first: the product is aimed at mobile creators.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  console.log('\nAUTO SHORTS — browser test');
  console.log('==========================\n');

  console.log('Home screen (390x844 phone viewport)');
  console.log('------------------------------------');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.wordmark', { timeout: 15000 });

  check('home screen loads', await page.locator('.wordmark').isVisible());
  check('NEW SHORT is the primary action', await page.locator('.btn-hero').isVisible());
  await page.screenshot({ path: path.join(SHOTS, '01-home.png'), fullPage: true });

  // Nothing should overflow the viewport horizontally on a phone.
  const overflowHome = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal overflow on a phone', overflowHome <= 1, `overflow ${overflowHome}px`);

  console.log('\nNew Short');
  console.log('---------');
  await page.locator('.btn-hero').click();
  await page.waitForSelector('.newshort');
  check('new-short form appears', await page.locator('.newshort').isVisible());
  check('format is locked to 9:16', (await page.locator('.format-lock').textContent()).includes('9:16'));
  check('all six editing styles offered', await page.locator('.preset-card').count() === 6);

  await page.locator('.newshort input').first().fill('Browser Test Short');
  await page.locator('.seg-btn', { hasText: '30s' }).click();
  await page.screenshot({ path: path.join(SHOTS, '02-newshort.png'), fullPage: true });
  await page.locator('.btn-primary', { hasText: 'Create' }).click();

  await page.waitForSelector('.editor', { timeout: 10000 });
  check('opens the editor', await page.locator('.editor').isVisible());
  check('step rail is visible', await page.locator('.steps .step').count() === 4);

  console.log('\nUpload');
  console.log('------');
  await page.setInputFiles('.dropzone input[type=file]', [
    path.join(MEDIA, 'talking-head.mp4'),
    path.join(MEDIA, 'credit-card-closeup.jpg'),
    path.join(MEDIA, 'smartphone-banking.jpg'),
    path.join(MEDIA, 'money-cash-stack.jpg'),
  ]);
  await page.waitForSelector('.media-card', { timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('.media-card').length >= 4, null, { timeout: 120000 });

  check('all four files appear in the library', await page.locator('.media-card').count() >= 4);
  check('thumbnails render', await page.locator('.media-thumb img').count() >= 4);
  check('tags derived from filenames', (await page.locator('.tag').first().textContent()).length > 0);
  await page.screenshot({ path: path.join(SHOTS, '03-uploaded.png'), fullPage: true });

  console.log('\nScript');
  console.log('------');
  const script = fs.readFileSync(path.join(MEDIA, 'script.txt'), 'utf8');
  await page.locator('.script-input').first().fill(script);
  await page.locator('.btn', { hasText: 'Save script' }).click();
  await page.waitForSelector('.ok-inline', { timeout: 10000 });
  check('script saves', await page.locator('.ok-inline').isVisible());

  console.log('\nAUTO EDIT');
  console.log('---------');
  const t0 = Date.now();
  await page.locator('.btn-primary', { hasText: 'AUTO EDIT' }).first().click();
  await page.waitForSelector('.busybar', { timeout: 10000 });
  check('shows progress while working', await page.locator('.busybar').isVisible());

  await page.waitForSelector('.report li', { timeout: 180000 });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`        -> auto edit took ${elapsed}s`);

  const reportLines = await page.locator('.report li strong').allTextContents();
  console.log(reportLines.map((l) => `        ✓ ${l}`).join('\n'));

  check('AI edit panel reports what it did', reportLines.length >= 5, `${reportLines.length} lines`);
  check('report mentions silence removal', reportLines.some((l) => /silence|pause/i.test(l)));
  check('report mentions captions', reportLines.some((l) => /caption/i.test(l)));
  check('moved to the Review step automatically', await page.locator('.step.is-on').textContent() === 'Review');

  const stats = await page.locator('.stat').allTextContents();
  console.log(`        stats: ${stats.join(' | ')}`);
  check('stat row is populated', stats.length >= 6);

  await page.screenshot({ path: path.join(SHOTS, '04-autoedit.png'), fullPage: true });

  console.log('\nTimeline');
  console.log('--------');
  check('timeline renders clips', await page.locator('.clip').count() > 5,
    `${await page.locator('.clip').count()} clips`);
  check('caption clips are present', await page.locator('.clip-caption').count() > 0);
  check('zoom clips are present', await page.locator('.clip-zoom').count() > 0);
  check('waveform drawn on the audio lane', await page.locator('.waveform rect').count() > 50);

  console.log('\nPreview');
  console.log('-------');
  // Play for a moment and confirm the canvas is actually painting real frames.
  await page.locator('.btn-play').click();
  await page.waitForTimeout(2500);
  const painting = await page.evaluate(() => {
    const c = document.querySelector('.preview-canvas');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let nonBlack = 0;
    for (let i = 0; i < d.length; i += 400) {
      if (d[i] > 12 || d[i + 1] > 12 || d[i + 2] > 12) nonBlack++;
    }
    return { nonBlack, sampled: Math.floor(d.length / 400) };
  });
  check('preview canvas is painting a real frame',
    painting.nonBlack > painting.sampled * 0.05,
    `${painting.nonBlack} of ${painting.sampled} samples were non-black`);

  const timeText = await page.locator('.preview-time').textContent();
  check('playhead is advancing', !timeText.trim().startsWith('0:00.0'), `clock reads ${timeText}`);
  await page.screenshot({ path: path.join(SHOTS, '05-playing.png') });

  await page.locator('.btn-play').click();   // pause

  // Seek to the middle of a caption so the screenshot shows one.
  await page.locator('.clip-caption').nth(3).click();
  await page.waitForTimeout(400);
  check('selecting a clip opens the fix-it inspector', await page.locator('.inspector').isVisible());
  await page.screenshot({ path: path.join(SHOTS, '06-inspector.png'), fullPage: true });

  console.log('\nFix it / undo');
  console.log('-------------');
  const wordChips = await page.locator('.chip-word').count();
  check('caption words are individually editable', wordChips > 0, `${wordChips} word chips`);

  const before = await page.locator('.chip-word').first().getAttribute('class');
  await page.locator('.chip-word').first().click();
  await page.waitForTimeout(700);
  const after = await page.locator('.chip-word').first().getAttribute('class');
  check('tapping a word toggles its emphasis', before !== after, `${before} -> ${after}`);

  const undoBtn = page.locator('.topbar-right .btn').first();
  check('undo becomes available after an edit', await undoBtn.isEnabled());
  await undoBtn.click();
  await page.waitForTimeout(700);
  const undone = await page.locator('.chip-word').first().getAttribute('class');
  check('undo reverts the change', undone === before, `${undone} vs original ${before}`);

  const redoBtn = page.locator('.topbar-right .btn').nth(1);
  check('redo becomes available after undo', await redoBtn.isEnabled());
  await redoBtn.click();
  await page.waitForTimeout(700);
  check('redo re-applies the change', (await page.locator('.chip-word').first().getAttribute('class')) === after);

  console.log('\nRE-EDIT');
  console.log('-------');
  const sfxBefore = await page.locator('.clip-sfx').count();
  await page.locator('.chip', { hasText: 'Fewer effects' }).click();
  await page.locator('.btn-primary', { hasText: 'RE-EDIT' }).click();
  await page.waitForSelector('.busybar', { timeout: 10000 });
  await page.waitForSelector('.busybar', { state: 'detached', timeout: 180000 });
  await page.waitForTimeout(600);
  const sfxAfter = await page.locator('.clip-sfx').count();
  check('"fewer effects" reduces the sound design', sfxAfter <= sfxBefore, `${sfxBefore} -> ${sfxAfter}`);

  console.log('\nExport');
  console.log('------');
  await page.locator('.step', { hasText: 'Export' }).click();
  await page.waitForSelector('.btn-big');
  await page.screenshot({ path: path.join(SHOTS, '07-export.png'), fullPage: true });

  await page.locator('.btn-primary', { hasText: 'EXPORT' }).click();
  await page.waitForSelector('.busybar', { timeout: 10000 });
  await page.waitForSelector('.exports li', { timeout: 300000 });

  const exportText = await page.locator('.exports li').first().textContent();
  console.log(`        -> ${exportText.trim()}`);
  check('export completes and is listed', /1080×1920/.test(exportText), exportText);
  check('download link is offered', await page.locator('.exports a', { hasText: 'Download' }).count() > 0);
  check('subtitle sidecar is offered', await page.locator('.exports a', { hasText: '.srt' }).count() > 0);
  await page.screenshot({ path: path.join(SHOTS, '08-exported.png'), fullPage: true });

  console.log('\nPersistence');
  console.log('-----------');
  const url = page.url();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.editor', { timeout: 15000 });
  check('reload keeps you in the same project', page.url() === url);
  check('the edit survives a reload', await page.locator('.clip').count() > 5);

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.project-card');
  check('the project appears on the home screen', await page.locator('.project-card').count() >= 1);
  const cardText = await page.locator('.project-card').first().textContent();
  check('home card shows it has an edit and an export', /edit/.test(cardText) && /export/.test(cardText), cardText);

  console.log('\nDesktop layout');
  console.log('--------------');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.project-card').first().click();
  await page.waitForSelector('.editor-right');
  const twoPane = await page.evaluate(() => {
    const l = document.querySelector('.editor-left').getBoundingClientRect();
    const r = document.querySelector('.editor-right').getBoundingClientRect();
    return r.left > l.left + 100;
  });
  check('two-pane layout on desktop', twoPane);
  const overflowDesktop = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal overflow on desktop', overflowDesktop <= 1, `overflow ${overflowDesktop}px`);
  await page.screenshot({ path: path.join(SHOTS, '09-desktop.png'), fullPage: true });

  console.log('\nError handling in the UI');
  console.log('------------------------');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.btn-hero').click();
  await page.locator('.btn-primary', { hasText: 'Create' }).click();
  await page.waitForSelector('.editor');
  // A text file dressed as media must be rejected with a readable message.
  const junk = path.join(SHOTS, 'not-a-video.mp4');
  fs.writeFileSync(junk, 'definitely not a video');
  await page.setInputFiles('.dropzone input[type=file]', [junk]);
  await page.waitForSelector('.errorcard', { timeout: 60000 });

  const what = await page.locator('.errorcard-head strong').textContent();
  const why = await page.locator('.errorcard-why').textContent();
  const fix = await page.locator('.errorcard-fix').textContent();
  console.log(`        what: ${what.trim()}`);
  console.log(`        why:  ${why.trim().slice(0, 90)}`);
  console.log(`        fix:  ${fix.trim().slice(0, 90)}`);
  check('a bad file shows what happened', what.length > 5);
  check('…and why', why.length > 10);
  check('…and how to fix it', /Try this/.test(fix) && fix.length > 20);
  await page.screenshot({ path: path.join(SHOTS, '10-error.png'), fullPage: true });

  // The deliberate bad-file upload above makes the server answer 400, which the
  // browser logs as a failed resource. That one is expected; anything else is not.
  const realErrors = consoleErrors.filter((e) => (
    !/favicon/i.test(e) && !/status of 400/.test(e)
  ));
  check('no uncaught errors in the browser console', realErrors.length === 0,
    realErrors.slice(0, 3).join(' | '));

  await browser.close();

  console.log('\nSummary');
  console.log('-------');
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`  Screenshots: ${SHOTS}\n`);
  return failed === 0;
}

main()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((err) => {
    console.error('\nBROWSER TEST CRASHED');
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
  });
