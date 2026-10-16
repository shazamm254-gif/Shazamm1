'use strict';
/**
 * Synthesize test media for the self-test.
 *
 * The important piece is the narration: it has to behave like speech for the
 * voice-activity detector to be exercised honestly. So rather than a flat tone,
 * this generates syllable-rate amplitude bursts through a formant-ish filter,
 * grouped into words and sentences with real pauses between them — including
 * one long dead-air gap the silence remover should find.
 *
 * Run: node scripts/make-testmedia.js [outDir]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ff = require('../video-engine/ffmpeg');
const { toWav } = require('../audio/sfx');

const SR = 48000;

function makeNoise(seed = 4242) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

function makeBandpass() {
  let lp1 = 0; let lp2 = 0;
  return (x, centre, q = 0.6) => {
    const a1 = 1 - Math.exp((-2 * Math.PI * (centre * (1 + q))) / SR);
    const a2 = 1 - Math.exp((-2 * Math.PI * (centre * (1 - q * 0.7))) / SR);
    lp1 += a1 * (x - lp1);
    lp2 += a2 * (x - lp2);
    return lp1 - lp2;
  };
}

/**
 * @param {Array} sentences  [{ words: n, pauseAfter: seconds }]
 * Returns { samples, duration, plan } where plan lists the intended word spans
 * so the test can check the detector against ground truth.
 */
function synthesizeNarration(sentences, { startSilence = 0.6 } = {}) {
  const noise = makeNoise(9182);
  const bp1 = makeBandpass();
  const bp2 = makeBandpass();

  const events = [];   // { start, end } per word
  let t = startSilence;

  for (const s of sentences) {
    for (let w = 0; w < s.words; w++) {
      const syl = 1 + (w % 3);
      const dur = 0.16 + syl * 0.13;
      events.push({ start: t, end: t + dur, syllables: syl });
      t += dur + 0.06;         // short inter-word gap
    }
    t += s.pauseAfter;
  }

  const total = t + 0.5;
  const n = Math.floor(SR * total);
  const out = new Float32Array(n);

  for (const ev of events) {
    const s0 = Math.floor(ev.start * SR);
    const s1 = Math.floor(ev.end * SR);
    const len = s1 - s0;
    // Two moving formants give the signal a vowel-like spectrum.
    const f1 = 420 + Math.random() * 220;
    const f2 = 1300 + Math.random() * 700;

    for (let i = 0; i < len; i++) {
      const x = i / len;
      // Syllable-rate amplitude modulation inside the word.
      const syl = 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * x * ev.syllables));
      // Envelope so words start and end cleanly.
      const env = Math.min(1, x / 0.06) * Math.min(1, (1 - x) / 0.12);
      const src = noise();
      const v = bp1(src, f1, 0.5) * 0.9 + bp2(src, f2, 0.35) * 0.45;
      out[s0 + i] += v * syl * env * 0.62;
    }
  }

  // Low room tone, so the adaptive noise floor has something real to find.
  const rn = makeNoise(555);
  for (let i = 0; i < n; i++) out[i] += rn() * 0.0016;

  return { samples: out, duration: total, words: events };
}

/** Simple sustained chord pad, for the music-ducking path. */
function synthesizeMusic(duration = 30) {
  const n = Math.floor(SR * duration);
  const out = new Float32Array(n);
  const chords = [
    [110, 164.81, 220],
    [98, 146.83, 196],
    [123.47, 185, 246.94],
    [87.31, 130.81, 174.61],
  ];
  const barLen = 4;

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const chord = chords[Math.floor(t / barLen) % chords.length];
    const barPos = (t % barLen) / barLen;
    const env = 0.55 + 0.45 * Math.exp(-2.2 * barPos);
    let v = 0;
    for (const f of chord) {
      v += Math.sin(2 * Math.PI * f * t) * 0.28;
      v += Math.sin(2 * Math.PI * f * 2 * t) * 0.07;
    }
    // Soft pulse so it reads as music rather than a drone.
    const pulse = 0.85 + 0.15 * Math.sin(2 * Math.PI * 2 * t);
    out[i] = Math.tanh(v * env * pulse * 0.7) * 0.5;
  }
  return { samples: out, duration };
}

function writeWav(file, samples, gain = 0.9) {
  fs.writeFileSync(file, toWav(samples, { gain, spread: 0.4 }));
}

/**
 * Distinct-looking stills. This FFmpeg build has no `drawtext` (which is
 * exactly why captions are rendered through libass), so each image is built
 * from a two-colour gradient plus boxes instead of a text label.
 */
async function makeImage(file, { bg, fg, seed }) {
  await ff.run([
    '-f', 'lavfi',
    '-i', `gradients=s=1280x1600:c0=${bg}:c1=${fg}:x0=${200 + seed * 90}:y0=${300 + seed * 120}:d=1:n=2`,
    '-vf', [
      `drawbox=x=70:y=70:w=1140:h=1460:color=${fg}@0.55:t=10`,
      `drawbox=x=${180 + seed * 60}:y=${420 + seed * 70}:w=${420 + seed * 40}:h=${420 + seed * 40}:color=${bg}@0.75:t=fill`,
      `drawgrid=w=160:h=160:t=2:color=${fg}@0.12`,
    ].join(','),
    '-frames:v', '1', '-q:v', '3', '-y', file,
  ], { stage: 'test image' });
}

async function main() {
  const outDir = process.argv[2] || path.join(__dirname, '..', 'data', 'testmedia');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`generating test media in ${outDir}`);

  // ---- narration -----------------------------------------------------------
  // Sentence shape matches the sample script below: a hook, three body lines,
  // and a CTA. One deliberately long pause in the middle is dead air.
  const { samples, duration, words } = synthesizeNarration([
    { words: 7, pauseAfter: 0.75 },   // hook
    { words: 9, pauseAfter: 0.45 },
    { words: 8, pauseAfter: 2.40 },   // <- dead air, should be cut
    { words: 10, pauseAfter: 0.50 },
    { words: 6, pauseAfter: 0.35 },   // cta
  ]);

  const narrationPath = path.join(outDir, 'narration.wav');
  writeWav(narrationPath, samples);
  console.log(`  narration.wav  ${duration.toFixed(2)}s, ${words.length} words`);

  // ---- talking-head video (same audio, moving picture) ---------------------
  const talkingPath = path.join(outDir, 'talking-head.mp4');
  await ff.run([
    '-f', 'lavfi', '-i', `testsrc2=size=1280x720:rate=30:duration=${duration.toFixed(2)}`,
    '-i', narrationPath,
    '-vf', 'hue=s=0.4,eq=brightness=-0.05',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-y', talkingPath,
  ], { stage: 'test video' });
  console.log(`  talking-head.mp4  landscape 1280x720 (tests the 9:16 reframe)`);

  // ---- vertical clip, to prove both orientations reframe correctly ---------
  const verticalPath = path.join(outDir, 'vertical-clip.mp4');
  await ff.run([
    '-f', 'lavfi', '-i', 'smptebars=size=608x1080:rate=30:duration=6',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-an', '-y', verticalPath,
  ], { stage: 'test vertical clip' });
  console.log('  vertical-clip.mp4  608x1080');

  // ---- stills, named so automatic B-roll matching has something to match ---
  const images = [
    { name: 'credit-card-closeup.jpg', bg: '0x101820', fg: '0x4DE1FF', seed: 0 },
    { name: 'smartphone-banking.jpg', bg: '0x1a1020', fg: '0xFFDA22', seed: 1 },
    { name: 'money-cash-stack.jpg', bg: '0x0f1a12', fg: '0x34D399', seed: 2 },
    { name: 'hacker-cybercrime.jpg', bg: '0x200f14', fg: '0xFF3B30', seed: 3 },
  ];
  for (const img of images) {
    await makeImage(path.join(outDir, img.name), img);
  }
  console.log(`  ${images.length} stills (named for B-roll keyword matching)`);

  // ---- music ---------------------------------------------------------------
  const music = synthesizeMusic(Math.max(30, duration + 6));
  const musicPath = path.join(outDir, 'music-bed.wav');
  writeWav(musicPath, music.samples, 0.7);
  console.log(`  music-bed.wav  ${music.duration.toFixed(1)}s`);

  // ---- the matching script -------------------------------------------------
  const script = `HOOK:
"Credit card scams are getting smarter."

BODY:
"Most people think they would spot a fake payment page instantly."
"They will not, because the new ones copy your bank perfectly."
"One family lost $40,000 to a single text message last year."

CTA:
"Check the sender before you tap."
`;
  fs.writeFileSync(path.join(outDir, 'script.txt'), script);
  console.log('  script.txt');

  const manifest = {
    narration: narrationPath,
    talkingHead: talkingPath,
    vertical: verticalPath,
    images: images.map((i) => path.join(outDir, i.name)),
    music: musicPath,
    script,
    duration,
    wordCount: words.length,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (require.main === module) {
  main().then(() => console.log('done')).catch((err) => {
    console.error('FAILED:', err.what || err.message, err.detail || '');
    process.exit(1);
  });
}

module.exports = { main, synthesizeNarration, synthesizeMusic };
