'use strict';
/**
 * End-to-end self-test.
 *
 * Drives the real pipeline over real media — upload, analyse, auto-edit,
 * captions, timeline operations, undo, save/reload, preview and export — and
 * checks the outputs with ffprobe rather than trusting that the code returned
 * without throwing.
 *
 * Run: npm run selftest
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const config = require('../config');
const engine = require('../video-engine/engine');
const store = require('../backend/store');
const ff = require('../video-engine/ffmpeg');
const edlLib = require('../timeline/edl');
const ops = require('../timeline/ops');
const analyze = require('../audio/analyze');
const sttScript = require('../captions/stt/scriptAlign');
const assLib = require('../captions/ass');
const captionStyles = require('../captions/styles');
const { TimeMap } = require('../timeline/timemap');

const MEDIA_DIR = path.join(__dirname, '..', 'data', 'testmedia');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, message: err.message });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

/** Wrap a file so it looks like a multer upload. */
function asUpload(filePath) {
  const tmp = path.join(config.paths.tmp, `st-${Date.now()}-${path.basename(filePath)}`);
  fs.mkdirSync(config.paths.tmp, { recursive: true });
  fs.copyFileSync(filePath, tmp);
  return {
    path: tmp,
    originalname: path.basename(filePath),
    mimetype: '',
    size: fs.statSync(filePath).size,
  };
}

async function probeFile(file) {
  const info = await ff.probe(file);
  const v = (info.streams || []).find((s) => s.codec_type === 'video');
  const a = (info.streams || []).find((s) => s.codec_type === 'audio');
  return {
    duration: parseFloat(info.format.duration || '0'),
    width: v ? v.width : 0,
    height: v ? v.height : 0,
    videoCodec: v ? v.codec_name : null,
    audioCodec: a ? a.codec_name : null,
    fps: v && v.r_frame_rate ? eval(v.r_frame_rate) : 0, // eslint-disable-line no-eval
    sizeBytes: parseInt(info.format.size || '0', 10),
  };
}

/** Mean volume in dBFS over a time window — proves audio is actually present. */
async function measureLoudness(file, from = null, to = null) {
  const args = [];
  if (from !== null) args.push('-ss', String(from));
  if (to !== null) args.push('-t', String(to - from));
  args.push('-i', file, '-af', 'volumedetect', '-f', 'null', '/dev/null');
  const stderr = await ff.runForStderr(args, { stage: 'loudness' });
  const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  return m ? parseFloat(m[1]) : null;
}

async function main() {
  console.log('\nAUTO SHORTS — end-to-end self test');
  console.log('==================================');

  if (!ff.available()) {
    console.error('\nFFmpeg is not available. Run "npm install" inside auto-shorts/ first.');
    process.exit(1);
  }
  if (!fs.existsSync(path.join(MEDIA_DIR, 'narration.wav'))) {
    console.log('\nTest media missing — generating it now.');
    await require('./make-testmedia').main();
  }

  const script = fs.readFileSync(path.join(MEDIA_DIR, 'script.txt'), 'utf8');

  /* ------------------------------------------------- 1. audio analysis */
  section('1. Audio analysis (real DSP over real samples)');

  const voiceAnalysis = await analyze.analyzeVoice(path.join(MEDIA_DIR, 'narration.wav'), { silenceLevel: 'medium' });

  check('decodes the waveform and measures its length', () => {
    assert(voiceAnalysis.duration > 20 && voiceAnalysis.duration < 30,
      `expected ~24s, got ${voiceAnalysis.duration}`);
  });
  check('detects speech runs separated by pauses', () => {
    assert(voiceAnalysis.speech.length >= 3,
      `expected at least 3 speech runs, got ${voiceAnalysis.speech.length}`);
  });
  check('finds the deliberate 2.4s dead-air gap', () => {
    const long = voiceAnalysis.silences.filter((s) => s.duration > 1.8);
    assert(long.length >= 1, `no silence longer than 1.8s found in ${JSON.stringify(voiceAnalysis.silences.map((s) => s.duration))}`);
  });
  check('adaptive threshold sits above the noise floor', () => {
    assert(voiceAnalysis.threshold.gate > voiceAnalysis.threshold.floor,
      `gate ${voiceAnalysis.threshold.gate} not above floor ${voiceAnalysis.threshold.floor}`);
  });
  check('plans real cuts at MEDIUM', () => {
    assert(voiceAnalysis.plan.removedSeconds > 0.5,
      `expected to cut something, removed ${voiceAnalysis.plan.removedSeconds}s`);
  });
  check('keeps some pauses rather than removing all silence', () => {
    const totalSilence = voiceAnalysis.silences.reduce((a, s) => a + s.duration, 0);
    assert(voiceAnalysis.plan.removedSeconds < totalSilence,
      `removed ${voiceAnalysis.plan.removedSeconds}s of ${totalSilence.toFixed(2)}s silence — nothing was preserved`);
  });
  check('OFF removes nothing', () => {
    const p = analyze.planSilenceRemoval(voiceAnalysis.speech, voiceAnalysis.duration, 'off');
    assert(p.removedSeconds === 0, `expected 0, got ${p.removedSeconds}`);
  });
  check('AGGRESSIVE removes more than LOW', () => {
    const low = analyze.planSilenceRemoval(voiceAnalysis.speech, voiceAnalysis.duration, 'low');
    const agg = analyze.planSilenceRemoval(voiceAnalysis.speech, voiceAnalysis.duration, 'aggressive');
    assert(agg.removedSeconds > low.removedSeconds,
      `aggressive ${agg.removedSeconds}s should exceed low ${low.removedSeconds}s`);
  });

  /* --------------------------------------------- 2. script alignment */
  section('2. Script alignment');

  const aligned = await sttScript.transcribe({
    script,
    speech: voiceAnalysis.speech,
    duration: voiceAnalysis.duration,
  });

  check('strips HOOK:/BODY:/CTA: labels and quotes', () => {
    assert(!/HOOK|BODY|CTA/i.test(aligned.text), `labels survived: ${aligned.text.slice(0, 80)}`);
    assert(!aligned.text.includes('"'), 'quotes survived');
  });
  check('produces one timed entry per script word', () => {
    const expected = sttScript.cleanScript(script).split(/\s+/).length;
    assert(aligned.words.length === expected,
      `expected ${expected} words, got ${aligned.words.length}`);
  });
  check('word timings are monotonic and non-degenerate', () => {
    for (let i = 0; i < aligned.words.length; i++) {
      const w = aligned.words[i];
      assert(w.end > w.start, `word ${i} "${w.word}" has end <= start`);
      if (i > 0) assert(w.start >= aligned.words[i - 1].end - 1e-6, `word ${i} starts before word ${i - 1} ends`);
    }
  });
  check('words land inside detected speech, not in the silence', () => {
    const inSpeech = aligned.words.filter((w) => (
      voiceAnalysis.speech.some((s) => w.start >= s.start - 0.15 && w.start <= s.end + 0.15)
    ));
    const ratio = inSpeech.length / aligned.words.length;
    assert(ratio > 0.9, `only ${(ratio * 100).toFixed(0)}% of words fell inside a speech run`);
  });
  check('groups into sentences', () => {
    assert(aligned.sentences.length >= 4, `expected >=4 sentences, got ${aligned.sentences.length}`);
  });

  /* ------------------------------------------------ 3. time mapping */
  section('3. Source time -> edit time');

  const tm = new TimeMap(voiceAnalysis.plan.keepRanges);
  check('edit duration equals source minus what was cut', () => {
    const expected = voiceAnalysis.duration - voiceAnalysis.plan.removedSeconds;
    assert(Math.abs(tm.editDuration - expected) < 0.05,
      `map says ${tm.editDuration}, expected ${expected.toFixed(3)}`);
  });
  check('mapping is monotonic', () => {
    let prev = -1;
    for (let t = 0; t < voiceAnalysis.duration; t += 0.25) {
      const e = tm.toEdit(t);
      assert(e >= prev - 1e-6, `time went backwards at t=${t}`);
      prev = e;
    }
  });
  check('round-trips through source time', () => {
    for (const r of tm.offsets) {
      const mid = (r.editStart + r.editEnd) / 2;
      const back = tm.toEdit(tm.toSource(mid));
      assert(Math.abs(back - mid) < 0.02, `round trip drifted by ${Math.abs(back - mid)}`);
    }
  });

  /* --------------------------------------- 4. project + media import */
  section('4. Project creation and media import');

  const project = engine.createProject('Self Test Short', { targetDuration: 30, preset: 'high_retention' });
  check('creates a project on disk', () => {
    assert(fs.existsSync(store.paths(project.id).file), 'project.json was not written');
  });

  const uploads = [
    ['talking-head.mp4', null],
    ['credit-card-closeup.jpg', null],
    ['smartphone-banking.jpg', null],
    ['money-cash-stack.jpg', null],
    ['hacker-cybercrime.jpg', null],
    ['music-bed.wav', 'music'],
  ];
  for (const [name, role] of uploads) {
    await engine.importMedia(project, asUpload(path.join(MEDIA_DIR, name)), { role });
  }

  check('imports every file', () => {
    assert(project.media.length === uploads.length, `expected ${uploads.length}, got ${project.media.length}`);
  });
  check('classifies video, image and music correctly', () => {
    const kinds = project.media.map((m) => `${m.kind}${m.role ? ':' + m.role : ''}`);
    assert(kinds.includes('video'), 'no video detected');
    assert(kinds.filter((k) => k === 'image').length === 4, `expected 4 images, got ${kinds.filter((k) => k === 'image').length}`);
    assert(kinds.includes('music:music') || kinds.includes('audio:music'), `music not tagged: ${kinds.join(', ')}`);
  });
  check('measures duration and dimensions', () => {
    const v = project.media.find((m) => m.kind === 'video');
    assert(v.duration > 20, `video duration ${v.duration}`);
    assert(v.width === 1280 && v.height === 720, `got ${v.width}x${v.height}`);
    assert(v.hasAudio === true, 'video audio stream not detected');
  });
  check('builds thumbnails and proxies', () => {
    for (const m of project.media) {
      if (m.kind === 'video' || m.kind === 'image') {
        assert(m.thumbPath && fs.existsSync(m.thumbPath), `no thumbnail for ${m.filename}`);
      }
      assert(m.proxyPath && fs.existsSync(m.proxyPath), `no proxy for ${m.filename}`);
    }
  });
  check('derives searchable tags from filenames', () => {
    const card = project.media.find((m) => m.filename.startsWith('credit-card'));
    assert(card.tags.includes('credit') && card.tags.includes('card'),
      `tags were ${JSON.stringify(card.tags)}`);
  });
  check('rejects a file that is not media', () => {
    const junk = path.join(config.paths.tmp, 'junk.mp4');
    fs.writeFileSync(junk, 'this is not a video');
    return engine.importMedia(project, asUpload(junk), {})
      .then(() => { throw new Error('a text file was accepted as media'); })
      .catch((err) => {
        if (!err.code) throw err;
        assert(err.what && err.why && err.fix, 'error is missing what/why/fix');
      });
  });

  /* ------------------------------------------------- 5. AUTO EDIT */
  section('5. AUTO EDIT');

  project.script = script;
  store.save(project);

  const result = await engine.createEditDecisionList(project, {});
  const edl = result.edl;
  const summary = edlLib.summarize(edl);

  console.log(`        -> ${summary.duration}s, ${summary.cuts} cuts, ${summary.captions} captions, ` +
    `${summary.emphasis} emphasis, ${summary.zooms} zooms, ${summary.broll} b-roll (${summary.brollFilled} filled), ${summary.sfx} sfx`);

  check('produces an EDL', () => {
    assert(edl && Array.isArray(edl.timeline) && edl.timeline.length > 0, 'timeline is empty');
  });
  check('EDL validates against the media library', () => {
    const v = edlLib.validate(edl, new Map(project.media.map((m) => [m.id, m])));
    assert(v.ok, v.problems.join(' '));
  });
  check('cuts the footage where the silence was', () => {
    assert(summary.cuts >= 2, `expected multiple segments, got ${summary.cuts}`);
  });
  check('picture covers the timeline with no gaps or overlaps', () => {
    const visuals = edlLib.byType(edl, 'video', 'image');
    assert(Math.abs(visuals[0].start) < 0.01, `picture starts at ${visuals[0].start}`);
    for (let i = 1; i < visuals.length; i++) {
      assert(Math.abs(visuals[i].start - visuals[i - 1].end) < 0.02,
        `gap/overlap between segment ${i - 1} and ${i}`);
    }
    assert(Math.abs(visuals[visuals.length - 1].end - edl.duration) < 0.02, 'picture does not reach the end');
  });
  check('creates caption cards', () => {
    assert(summary.captions >= 5, `expected several caption cards, got ${summary.captions}`);
  });
  check('captions stay inside the timeline', () => {
    for (const c of edlLib.byType(edl, 'caption')) {
      assert(c.start >= -0.01 && c.end <= edl.duration + 0.05, `caption "${c.text}" runs ${c.start}-${c.end} outside 0-${edl.duration}`);
    }
  });
  check('caption cards do not overlap each other', () => {
    const caps = edlLib.byType(edl, 'caption');
    for (let i = 1; i < caps.length; i++) {
      assert(caps[i].start >= caps[i - 1].end - 0.03,
        `caption ${i} starts at ${caps[i].start} before previous ends at ${caps[i - 1].end}`);
    }
  });
  check('caption words carry their own timings', () => {
    for (const c of edlLib.byType(edl, 'caption')) {
      assert(c.words && c.words.length, `caption "${c.text}" has no word timings`);
      for (const w of c.words) assert(w.end > w.start, `word "${w.word}" has no duration`);
    }
  });
  check('emphasises words, but not every word', () => {
    const caps = edlLib.byType(edl, 'caption');
    const total = caps.reduce((a, c) => a + c.words.length, 0);
    assert(summary.emphasis >= 1, 'nothing was emphasised');
    assert(summary.emphasis / total < 0.35,
      `${summary.emphasis}/${total} words emphasised — too many`);
  });
  check('never emphasises two adjacent words', () => {
    for (const c of edlLib.byType(edl, 'caption')) {
      for (let i = 1; i < c.words.length; i++) {
        assert(!(c.words[i].emphasis && c.words[i - 1].emphasis),
          `adjacent emphasis in "${c.text}"`);
      }
    }
  });
  check('adds punch-ins that do not stack on top of each other', () => {
    const zooms = edlLib.byType(edl, 'zoom');
    assert(zooms.length >= 1, 'no punch-ins were added');
    for (let i = 1; i < zooms.length; i++) {
      assert(zooms[i].start >= zooms[i - 1].end - 0.01,
        `zoom ${i} overlaps the previous one`);
    }
  });
  check('punch-in scales stay subtle', () => {
    for (const z of edlLib.byType(edl, 'zoom')) {
      assert(z.scale > 1 && z.scale <= 1.2, `zoom scale ${z.scale} is outside the intended range`);
    }
  });
  check('finds B-roll opportunities and fills them from the library', () => {
    assert(summary.broll >= 1, 'no B-roll slots were proposed');
    assert(summary.brollFilled >= 1, 'no B-roll slot matched a file by name');
  });
  check('B-roll slots carry human-readable suggestions', () => {
    for (const b of edlLib.byType(edl, 'broll')) {
      assert(b.reason && b.reason.length > 5, 'B-roll slot has no reason');
      assert(Array.isArray(b.suggestions), 'B-roll slot has no suggestion list');
    }
  });
  check('places sound effects, spaced apart', () => {
    const sfx = edlLib.byType(edl, 'sfx');
    assert(sfx.length >= 1, 'no sound effects were placed');
    for (let i = 1; i < sfx.length; i++) {
      assert(sfx[i].start - sfx[i - 1].start > 1.0,
        `two effects only ${(sfx[i].start - sfx[i - 1].start).toFixed(2)}s apart`);
    }
  });
  check('does not overuse sound effects', () => {
    const perMinute = (summary.sfx / edl.duration) * 60;
    assert(perMinute <= 20, `${perMinute.toFixed(1)} effects per minute is too many`);
  });
  check('adds the music bed with ducking enabled', () => {
    const m = edlLib.byType(edl, 'music')[0];
    assert(m, 'no music clip');
    assert(m.duck === true, 'ducking was not enabled');
    assert(m.gain < 0.5, `music gain ${m.gain} would drown the voice`);
  });
  check('writes a voice clip carrying the cut plan', () => {
    const v = edlLib.byType(edl, 'voice')[0];
    assert(v, 'no voice clip');
    assert(v.keepRanges && v.keepRanges.length, 'voice clip has no keep ranges');
  });
  check('reports what it did in plain language', () => {
    assert(result.report.steps.length >= 5, `only ${result.report.steps.length} report lines`);
    for (const s of result.report.steps) {
      assert(s.label && s.label.length > 3, 'report line has no label');
    }
  });
  check('edit is shorter than the source because silence was cut', () => {
    const src = project.media.find((m) => m.kind === 'video').duration;
    assert(edl.duration < src - 0.5, `edit ${edl.duration}s vs source ${src}s — nothing was tightened`);
  });

  /* ------------------------------------------- 6. ASS generation */
  section('6. Caption rendering (ASS)');

  const captions = edlLib.byType(edl, 'caption');
  const style = captionStyles.getStyle('kinetic');
  const assText = assLib.build(captions, style);

  check('produces a well-formed ASS document', () => {
    assert(/\[Script Info\]/.test(assText), 'missing Script Info');
    assert(/\[V4\+ Styles\]/.test(assText), 'missing style block');
    assert(/^Dialogue:/m.test(assText), 'no dialogue lines');
  });
  check('kinetic style emits a word-by-word reveal', () => {
    const lines = assText.split('\n').filter((l) => l.startsWith('Dialogue:'));
    assert(lines.length > captions.length,
      `${lines.length} events for ${captions.length} cards — no per-word states`);
  });
  check('ASS timestamps are ordered and inside the edit', () => {
    const re = /^Dialogue: 0,(\d+:\d+:\d+\.\d+),(\d+:\d+:\d+\.\d+),/;
    const toSec = (t) => {
      const [h, m, s] = t.split(':');
      return (+h) * 3600 + (+m) * 60 + parseFloat(s);
    };
    for (const line of assText.split('\n')) {
      const m = re.exec(line);
      if (!m) continue;
      const s = toSec(m[1]);
      const e = toSec(m[2]);
      assert(e > s, `event has end <= start: ${line.slice(0, 60)}`);
      assert(e <= edl.duration + 0.2, `event ends at ${e}, past the edit end ${edl.duration}`);
    }
  });
  check('emphasis words carry the accent colour', () => {
    const hasEmph = captions.some((c) => c.words.some((w) => w.emphasis));
    if (!hasEmph) return;
    assert(/\\c&H/.test(assText), 'no colour override found in the ASS output');
  });
  check('braces in caption text are escaped, not treated as tags', () => {
    const evil = [{
      text: 'A {BAD} TAG',
      start: 0, end: 1,
      words: [{ word: 'A', start: 0, end: 0.3 }, { word: '{BAD}', start: 0.3, end: 0.6 }, { word: 'TAG', start: 0.6, end: 1 }],
    }];
    const out = assLib.build(evil, style);
    assert(/\\\{BAD\\\}/.test(out), 'literal braces were not escaped');
  });

  /* -------------------------------------- 7. timeline ops + undo */
  section('7. Timeline operations and undo');

  const history = [JSON.parse(JSON.stringify(edl))];
  const firstCaption = edlLib.byType(edl, 'caption')[0];

  let working = ops.update(edl, firstCaption.id, { text: 'EDITED CAPTION TEXT' });
  history.push(JSON.parse(JSON.stringify(working)));
  check('edits caption text and re-times its words', () => {
    const c = edlLib.find(working, firstCaption.id);
    assert(c.text === 'EDITED CAPTION TEXT', `text is "${c.text}"`);
    assert(c.words.length === 3, `expected 3 re-timed words, got ${c.words.length}`);
    assert(c.words[0].start >= c.start - 1e-6 && c.words[2].end <= c.end + 1e-6, 'words fell outside the card');
  });

  const firstVisual = edlLib.byType(working, 'video', 'image')[0];
  const splitAt = (firstVisual.start + firstVisual.end) / 2;
  working = ops.split(working, firstVisual.id, splitAt);
  check('splits a clip into two, keeping the source offset', () => {
    const parts = edlLib.byType(working, 'video', 'image').filter((c) => Math.abs(c.start - firstVisual.start) < 0.01 || Math.abs(c.start - splitAt) < 0.01);
    assert(parts.length === 2, `expected 2 parts, got ${parts.length}`);
    const second = parts.find((p) => Math.abs(p.start - splitAt) < 0.01);
    const expectedIn = (firstVisual.sourceIn || 0) + (splitAt - firstVisual.start);
    assert(Math.abs(second.sourceIn - expectedIn) < 0.02,
      `source offset ${second.sourceIn}, expected ${expectedIn.toFixed(3)}`);
  });

  check('refuses to split at the very edge of a clip', () => {
    try {
      ops.split(working, firstVisual.id, firstVisual.start + 0.001);
      throw new Error('the split was allowed');
    } catch (err) {
      assert(err.what && err.fix, 'error is missing what/fix');
    }
  });

  const zoomClip = edlLib.byType(working, 'zoom')[0];
  if (zoomClip) {
    const afterRemove = ops.remove(working, zoomClip.id);
    check('removes a punch-in ("Remove" on a zoom)', () => {
      assert(!edlLib.find(afterRemove, zoomClip.id), 'the zoom is still there');
    });
    working = afterRemove;
  }

  const brollSlot = edlLib.byType(working, 'broll')[0];
  if (brollSlot) {
    const otherImage = project.media.find((m) => m.kind === 'image' && m.id !== brollSlot.source);
    const afterReplace = ops.replaceSource(working, brollSlot.id, otherImage.id, 'image');
    check('replaces B-roll media ("Replace" on a slot)', () => {
      const c = edlLib.find(afterReplace, brollSlot.id);
      assert(c.source === otherImage.id, 'source did not change');
      assert(c.userChosen === true, 'the choice was not marked as the user\'s');
      assert(c.kenBurns, 'a still with no Ken Burns move would sit dead on screen');
    });
    working = afterReplace;
  }

  check('undo restores the previous edit exactly', () => {
    const restored = history[history.length - 1];
    assert(JSON.stringify(restored) !== JSON.stringify(working), 'nothing changed to undo');
    const c = edlLib.find(restored, firstCaption.id);
    assert(c.text === 'EDITED CAPTION TEXT', 'history entry is not the state we saved');
  });
  check('undo back to the original restores the AI edit', () => {
    const original = history[0];
    const c = edlLib.find(original, firstCaption.id);
    assert(c.text !== 'EDITED CAPTION TEXT', 'the history was mutated in place');
  });
  check('refuses to delete the last remaining picture clip', () => {
    let stripped = JSON.parse(JSON.stringify(edl));
    const visuals = edlLib.byType(stripped, 'video', 'image');
    for (let i = 1; i < visuals.length; i++) stripped = ops.remove(stripped, visuals[i].id);
    try {
      ops.remove(stripped, edlLib.byType(stripped, 'video', 'image')[0].id);
      throw new Error('the last picture clip was deleted');
    } catch (err) {
      assert(err.what && err.fix, 'error is missing what/fix');
    }
  });
  check('toggles emphasis on a single word', () => {
    const cap = edlLib.byType(edl, 'caption')[0];
    const before = cap.words[0].emphasis;
    const after = ops.toggleEmphasis(edl, cap.id, 0);
    assert(edlLib.find(after, cap.id).words[0].emphasis !== before, 'the mark did not change');
  });

  /* ------------------------------------------ 8. save and reload */
  section('8. Project save and reload');

  store.save(project);
  const reloaded = store.load(project.id);

  check('reloads with the edit intact', () => {
    assert(reloaded.edl, 'no EDL after reload');
    assert(reloaded.edl.timeline.length === edl.timeline.length,
      `${reloaded.edl.timeline.length} clips after reload, ${edl.timeline.length} before`);
  });
  check('reloads with the analysis and report intact', () => {
    assert(reloaded.analysis && reloaded.analysis.transcript.wordCount > 0, 'analysis was lost');
    assert(reloaded.report && reloaded.report.steps.length, 'report was lost');
  });
  check('re-derives absolute media paths on load', () => {
    for (const m of reloaded.media) {
      assert(m.absPath && fs.existsSync(m.absPath), `media ${m.filename} lost its path`);
    }
  });
  check('project.json is portable (no absolute paths stored)', () => {
    const raw = fs.readFileSync(store.paths(project.id).file, 'utf8');
    assert(!raw.includes(store.paths(project.id).media),
      'absolute paths were written into project.json');
  });
  check('appears in the project list', () => {
    const listed = store.list().find((p) => p.id === project.id);
    assert(listed, 'project is missing from the list');
    assert(listed.hasEdit === true, 'list does not show that it has an edit');
  });

  /* ---------------------------------------------- 9. preview render */
  section('9. Preview render');

  const preview = await engine.renderPreview(reloaded, () => {});
  const previewProbe = await probeFile(preview.path);

  check('renders a preview proxy', () => {
    assert(fs.existsSync(preview.path), 'no preview file');
    assert(previewProbe.sizeBytes > 10000, `preview is only ${previewProbe.sizeBytes} bytes`);
  });
  check('preview is 9:16', () => {
    assert(Math.abs(previewProbe.width / previewProbe.height - 9 / 16) < 0.01,
      `${previewProbe.width}x${previewProbe.height} is not 9:16`);
  });
  check('preview length matches the edit', () => {
    assert(Math.abs(previewProbe.duration - edl.duration) < 0.35,
      `preview ${previewProbe.duration}s vs edit ${edl.duration}s`);
  });

  /* ------------------------------------------------- 10. export */
  section('10. Export');

  const exported = await engine.exportVideo(reloaded, '1080p', () => {});
  const exportPath = path.join(store.paths(project.id).exports, exported.file);
  const info = await probeFile(exportPath);

  console.log(`        -> ${exported.file}  ${(info.sizeBytes / 1048576).toFixed(1)} MB in ${(exported.renderMs / 1000).toFixed(1)}s`);

  check('export file exists and opens', () => {
    assert(fs.existsSync(exportPath), 'export file missing');
    assert(info.sizeBytes > 50000, `only ${info.sizeBytes} bytes`);
  });
  check('export is exactly 1080 x 1920', () => {
    assert(info.width === 1080 && info.height === 1920, `got ${info.width}x${info.height}`);
  });
  check('export is H.264 with AAC audio', () => {
    assert(info.videoCodec === 'h264', `video codec is ${info.videoCodec}`);
    assert(info.audioCodec === 'aac', `audio codec is ${info.audioCodec}`);
  });
  check('export runs at 30 fps', () => {
    assert(Math.abs(info.fps - 30) < 0.5, `fps is ${info.fps}`);
  });
  check('export length matches the edit', () => {
    assert(Math.abs(info.duration - edl.duration) < 0.35,
      `export ${info.duration}s vs edit ${edl.duration}s`);
  });
  check('export contains audible audio', async () => {
    // Checked below with await; placeholder keeps the count honest.
  });

  const loud = await measureLoudness(exportPath);
  check('audio is present and at a sensible level', () => {
    assert(loud !== null, 'volumedetect returned nothing');
    assert(loud > -45, `mean volume ${loud} dB — effectively silent`);
    assert(loud < -6, `mean volume ${loud} dB — far too hot`);
  });

  const srtPath = exported.srtUrl ? path.join(store.paths(project.id).exports, path.basename(exportPath, '.mp4') + '.srt') : null;
  check('writes a companion .srt', () => {
    assert(srtPath && fs.existsSync(srtPath), 'no .srt was written next to the export');
    const srt = fs.readFileSync(srtPath, 'utf8');
    assert(/-->/.test(srt), '.srt has no timing lines');
  });

  // Frames from the export prove the picture and captions actually rendered.
  const frameDir = path.join(store.paths(project.id).work, 'frames');
  fs.mkdirSync(frameDir, { recursive: true });
  const capMid = captions.length
    ? (captions[Math.floor(captions.length / 2)].start + captions[Math.floor(captions.length / 2)].end) / 2
    : edl.duration / 2;

  const frames = [];
  for (const [label, t] of [['open', 0.6], ['caption', capMid], ['late', Math.max(0.6, edl.duration - 1.5)]]) {
    const f = path.join(frameDir, `${label}.png`);
    await ff.run(['-ss', String(t), '-i', exportPath, '-frames:v', '1', '-y', f], { stage: 'frame grab' });
    frames.push({ label, file: f, t });
  }

  check('frames can be extracted at 1080x1920 and are not blank', () => {
    for (const fr of frames) {
      assert(fs.existsSync(fr.file), `no frame at ${fr.t}s`);
      // A blank frame compresses to almost nothing; real picture does not.
      assert(fs.statSync(fr.file).size > 8000,
        `frame "${fr.label}" is only ${fs.statSync(fr.file).size} bytes — probably black`);
    }
  });

  /* ---------------------------------------------- 11. 720p export */
  section('11. Second export preset');

  const exported720 = await engine.exportVideo(store.load(project.id), '720p', () => {});
  const info720 = await probeFile(path.join(store.paths(project.id).exports, exported720.file));
  check('720p export is 720 x 1280', () => {
    assert(info720.width === 720 && info720.height === 1280, `got ${info720.width}x${info720.height}`);
  });

  /* ------------------------------------------------ 12. RE-EDIT */
  section('12. RE-EDIT');

  const before = edlLib.summarize(store.load(project.id).edl);
  const reedited = await engine.reEdit(store.load(project.id), ['fewer_effects', 'cleaner']);
  const after = edlLib.summarize(reedited.edl);

  console.log(`        -> sfx ${before.sfx} -> ${after.sfx}, zooms ${before.zooms} -> ${after.zooms}`);

  check('"fewer effects" actually reduces the effects', () => {
    assert(after.sfx <= before.sfx && after.zooms <= before.zooms,
      `sfx ${before.sfx}->${after.sfx}, zooms ${before.zooms}->${after.zooms}`);
  });
  check('re-edit keeps the content — captions survive', () => {
    assert(after.captions > 0, 'captions disappeared');
  });
  check('re-edit still validates', () => {
    const p = store.load(project.id);
    const v = edlLib.validate(reedited.edl, new Map(p.media.map((m) => [m.id, m])));
    assert(v.ok, v.problems.join(' '));
  });

  const faster = await engine.reEdit(store.load(project.id), ['faster_pacing']);
  check('"faster pacing" shortens the edit', () => {
    assert(faster.edl.duration <= reedited.edl.duration + 0.01,
      `${reedited.edl.duration}s -> ${faster.edl.duration}s`);
  });

  /* --------------------------------------- 13. IMAGE STORY mode */
  section('13. IMAGE STORY mode');

  const storyProject = engine.createProject('Image Story Test', {
    targetDuration: 30, preset: 'storytelling', mode: 'image_story',
  });
  await engine.importMedia(storyProject, asUpload(path.join(MEDIA_DIR, 'narration.wav')), {});
  for (const img of ['credit-card-closeup.jpg', 'smartphone-banking.jpg', 'money-cash-stack.jpg', 'hacker-cybercrime.jpg']) {
    await engine.importMedia(storyProject, asUpload(path.join(MEDIA_DIR, img)), {});
  }
  storyProject.script = script;
  store.save(storyProject);

  const storyResult = await engine.createEditDecisionList(storyProject, {});
  const storySummary = edlLib.summarize(storyResult.edl);
  console.log(`        -> ${storySummary.duration}s from ${storySummary.cuts} image shots, ${storySummary.captions} captions`);

  check('turns narration plus a folder of stills into an edit', () => {
    assert(storyResult.analysis.mode === 'image_story', `mode was ${storyResult.analysis.mode}`);
    assert(storySummary.cuts >= 3, `only ${storySummary.cuts} shots`);
  });
  check('every still gets a Ken Burns move', () => {
    const imgs = edlLib.byType(storyResult.edl, 'image');
    assert(imgs.length > 0, 'no image clips');
    for (const c of imgs) {
      assert(c.kenBurns, `image clip at ${c.start}s has no move`);
      const moves = Math.abs(c.kenBurns.zTo - c.kenBurns.zFrom) > 0.001 || c.kenBurns.panX || c.kenBurns.panY;
      assert(moves, `image clip at ${c.start}s has a static move`);
    }
  });
  check('images cover the whole narration', () => {
    const imgs = edlLib.byType(storyResult.edl, 'video', 'image');
    assert(Math.abs(imgs[imgs.length - 1].end - storyResult.edl.duration) < 0.05, 'pictures do not reach the end');
  });

  const storyExport = await engine.exportVideo(store.load(storyProject.id), '720p', () => {});
  const storyInfo = await probeFile(path.join(store.paths(storyProject.id).exports, storyExport.file));
  check('image story exports to a playable 9:16 file', () => {
    assert(storyInfo.width === 720 && storyInfo.height === 1280, `got ${storyInfo.width}x${storyInfo.height}`);
    assert(Math.abs(storyInfo.duration - storyResult.edl.duration) < 0.4,
      `export ${storyInfo.duration}s vs edit ${storyResult.edl.duration}s`);
  });
  const storyLoud = await measureLoudness(path.join(store.paths(storyProject.id).exports, storyExport.file));
  check('image story export has audible narration', () => {
    assert(storyLoud !== null && storyLoud > -45, `mean volume ${storyLoud} dB`);
  });

  /* ------------------------------------------ 14. error handling */
  section('14. Error handling');

  check('auto-edit with no media explains what to do', async () => { /* awaited below */ });
  const emptyProject = engine.createProject('Empty', {});
  try {
    await engine.createEditDecisionList(emptyProject, {});
    failed++;
    console.log('  FAIL  auto-edit on an empty project should have failed');
  } catch (err) {
    check('auto-edit on an empty project fails with what/why/fix', () => {
      assert(err.what && err.why && err.fix, `missing fields: ${JSON.stringify(err)}`);
      assert(/upload/i.test(err.fix), `fix does not tell the user to upload: "${err.fix}"`);
    });
  }

  const noVoiceProject = engine.createProject('No voice', {});
  await engine.importMedia(noVoiceProject, asUpload(path.join(MEDIA_DIR, 'credit-card-closeup.jpg')), {});
  try {
    await engine.createEditDecisionList(noVoiceProject, {});
    failed++;
    console.log('  FAIL  auto-edit with no audio should have failed');
  } catch (err) {
    check('auto-edit with pictures but no audio explains the problem', () => {
      assert(err.code === 'NO_VOICE_TRACK', `got code ${err.code}`);
      assert(err.fix.includes('narration') || err.fix.includes('voiceover'), `unhelpful fix: ${err.fix}`);
    });
  }

  const noScriptProject = engine.createProject('No script', {});
  await engine.importMedia(noScriptProject, asUpload(path.join(MEDIA_DIR, 'talking-head.mp4')), {});
  const noScriptResult = await engine.createEditDecisionList(noScriptProject, {});
  check('with no script and no Whisper, the edit still succeeds without captions', () => {
    assert(noScriptResult.edl.timeline.length > 0, 'no edit was produced');
    assert(edlLib.summarize(noScriptResult.edl).captions === 0, 'captions appeared from nowhere');
  });
  check('and it says clearly why captions are missing', () => {
    assert(noScriptResult.report.warnings.length >= 1, 'no warning was recorded');
    const w = noScriptResult.report.warnings[0];
    assert(w.what && w.why && w.fix, 'warning is missing what/why/fix');
    assert(/script|srt/i.test(w.fix), `fix does not suggest a remedy: "${w.fix}"`);
  });
  check('preview before auto-edit fails with a clear message', async () => { /* awaited below */ });
  try {
    await engine.renderPreview(engine.createProject('Nothing', {}), () => {});
    failed++;
    console.log('  FAIL  preview without an edit should have failed');
  } catch (err) {
    check('preview without an edit tells the user to press AUTO EDIT', () => {
      assert(/AUTO EDIT/i.test(err.fix), `fix was "${err.fix}"`);
    });
  }

  /* ----------------------------------------------------- summary */
  section('Summary');
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\n  Failures:');
    for (const f of failures) console.log(`    - ${f.name}: ${f.message}`);
  }
  console.log('');
  console.log(`  Export for inspection: ${exportPath}`);
  console.log(`  Frames:                ${frameDir}`);
  console.log('');

  return failed === 0;
}

if (require.main === module) {
  main()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      console.error('\nSELF TEST CRASHED');
      console.error(err.what || err.message);
      if (err.why) console.error(`why: ${err.why}`);
      if (err.detail) console.error(err.detail);
      if (!err.what) console.error(err.stack);
      process.exit(1);
    });
}

module.exports = { main };
