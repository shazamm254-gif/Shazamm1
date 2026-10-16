'use strict';
/**
 * Local Whisper provider.
 *
 * Detects, in order: an explicit AUTOSHORTS_WHISPER_BIN, openai-whisper's
 * `whisper` CLI, whisper.cpp (`whisper-cli` / `whisper` / `main`), and the
 * Python `faster_whisper` package. If none is installed the provider reports
 * itself unavailable and the engine falls back to script alignment — it never
 * pretends to have transcribed anything.
 *
 * Nothing here downloads a model automatically; that is the user's decision,
 * and it is documented in the README.
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../../config');
const { round } = require('../../utils');

let cachedDetection = null;

function which(bin) {
  const r = spawnSync('sh', ['-c', `command -v ${bin} 2>/dev/null`], { encoding: 'utf8' });
  const p = (r.stdout || '').trim();
  return p && fs.existsSync(p) ? p : null;
}

function pythonHasModule(mod) {
  for (const py of ['python3', 'python']) {
    const bin = which(py);
    if (!bin) continue;
    const r = spawnSync(bin, ['-c', `import ${mod}`], { encoding: 'utf8', timeout: 15000 });
    if (r.status === 0) return bin;
  }
  return null;
}

/** Identify which flavour of Whisper (if any) is installed. Cached per process. */
function detect() {
  if (cachedDetection) return cachedDetection;

  const explicit = config.stt.whisperBin;
  if (explicit && fs.existsSync(explicit)) {
    const flavour = /whisper-cli|main$/.test(explicit) ? 'whisper.cpp' : 'openai-whisper';
    cachedDetection = { kind: flavour, bin: explicit };
    return cachedDetection;
  }

  const openai = which('whisper');
  if (openai) {
    // openai-whisper's CLI answers --help with "--model"; whisper.cpp does not.
    const r = spawnSync(openai, ['--help'], { encoding: 'utf8', timeout: 20000 });
    const help = `${r.stdout || ''}${r.stderr || ''}`;
    if (/--word_timestamps/.test(help)) {
      cachedDetection = { kind: 'openai-whisper', bin: openai };
      return cachedDetection;
    }
    if (/-oj|--output-json/.test(help)) {
      cachedDetection = { kind: 'whisper.cpp', bin: openai };
      return cachedDetection;
    }
  }

  for (const cand of ['whisper-cli', 'main']) {
    const b = which(cand);
    if (b) {
      const r = spawnSync(b, ['--help'], { encoding: 'utf8', timeout: 20000 });
      const help = `${r.stdout || ''}${r.stderr || ''}`;
      if (/whisper/i.test(help)) {
        cachedDetection = { kind: 'whisper.cpp', bin: b };
        return cachedDetection;
      }
    }
  }

  const py = pythonHasModule('faster_whisper');
  if (py) {
    cachedDetection = { kind: 'faster-whisper', bin: py };
    return cachedDetection;
  }

  cachedDetection = { kind: null, bin: null };
  return cachedDetection;
}

async function isAvailable() {
  const d = detect();
  if (!d.kind) {
    return {
      ok: false,
      reason: 'no local Whisper install found (checked whisper, whisper-cli, main, faster_whisper)',
    };
  }
  if (d.kind === 'whisper.cpp' && !config.stt.whisperModel) {
    return { ok: false, reason: 'whisper.cpp is installed but AUTOSHORTS_WHISPER_MODEL is not set to a .bin model path' };
  }
  return { ok: true, reason: `${d.kind} detected at ${d.bin}` };
}

function runProcess(bin, args, { cwd, timeoutMs = 1000 * 60 * 20 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`${path.basename(bin)} exited ${code}: ${stderr.slice(-600)}`));
      resolve({ stdout, stderr });
    });
  });
}

async function transcribe({ audioPath, language = 'en' }) {
  const d = detect();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-whisper-'));

  try {
    if (d.kind === 'openai-whisper') {
      await runProcess(d.bin, [
        audioPath,
        '--model', config.stt.whisperModel || 'base',
        '--language', language,
        '--word_timestamps', 'True',
        '--output_format', 'json',
        '--output_dir', workDir,
        '--verbose', 'False',
      ]);
      const jsonFile = fs.readdirSync(workDir).find((f) => f.endsWith('.json'));
      if (!jsonFile) throw new Error('whisper produced no JSON output');
      return parseOpenAiWhisper(JSON.parse(fs.readFileSync(path.join(workDir, jsonFile), 'utf8')));
    }

    if (d.kind === 'whisper.cpp') {
      const outBase = path.join(workDir, 'out');
      await runProcess(d.bin, [
        '-m', config.stt.whisperModel,
        '-f', audioPath,
        '-l', language,
        '-oj', '-ml', '1',          // -ml 1 gives one token per segment => word timings
        '-of', outBase,
      ]);
      const jf = `${outBase}.json`;
      if (!fs.existsSync(jf)) throw new Error('whisper.cpp produced no JSON output');
      return parseWhisperCpp(JSON.parse(fs.readFileSync(jf, 'utf8')));
    }

    if (d.kind === 'faster-whisper') {
      const script = `
import json, sys
from faster_whisper import WhisperModel
model = WhisperModel(${JSON.stringify(config.stt.whisperModel || 'base')}, device="cpu", compute_type="int8")
segments, _ = model.transcribe(sys.argv[1], language=${JSON.stringify(language)}, word_timestamps=True)
out = []
for s in segments:
    for w in (s.words or []):
        out.append({"word": w.word.strip(), "start": float(w.start), "end": float(w.end)})
print(json.dumps({"words": out}))
`;
      const sf = path.join(workDir, 'fw.py');
      fs.writeFileSync(sf, script);
      const { stdout } = await runProcess(d.bin, [sf, audioPath]);
      const line = stdout.trim().split('\n').filter(Boolean).pop();
      return normalize(JSON.parse(line).words);
    }

    throw new Error('no Whisper flavour available');
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }
}

function parseOpenAiWhisper(json) {
  const words = [];
  for (const seg of json.segments || []) {
    for (const w of seg.words || []) {
      words.push({ word: String(w.word).trim(), start: w.start, end: w.end });
    }
  }
  // Some builds omit per-word data; fall back to segment granularity.
  if (!words.length) {
    for (const seg of json.segments || []) {
      words.push({ word: String(seg.text).trim(), start: seg.start, end: seg.end });
    }
  }
  return normalize(words);
}

function parseWhisperCpp(json) {
  const words = [];
  for (const seg of json.transcription || []) {
    const t = (seg.text || '').trim();
    if (!t) continue;
    const off = seg.offsets || {};
    words.push({ word: t, start: (off.from || 0) / 1000, end: (off.to || 0) / 1000 });
  }
  return normalize(words);
}

/** Common post-processing: clean, order, and derive sentences. */
function normalize(rawWords) {
  const words = (rawWords || [])
    .map((w) => ({
      word: String(w.word || '').trim(),
      clean: String(w.word || '').replace(/[^\p{L}\p{N}'$%\-]/gu, ''),
      start: round(Number(w.start) || 0, 3),
      end: round(Number(w.end) || 0, 3),
      endsSentence: /[.!?…]$/.test(String(w.word || '').trim()),
      endsClause: /[,;:]$/.test(String(w.word || '').trim()),
    }))
    .filter((w) => w.word.length > 0)
    .sort((a, b) => a.start - b.start);

  for (let i = 0; i < words.length; i++) {
    if (i > 0 && words[i].start < words[i - 1].end) words[i].start = words[i - 1].end;
    if (words[i].end <= words[i].start) words[i].end = round(words[i].start + 0.1, 3);
  }

  const { groupSentences } = require('./scriptAlign');
  return {
    words,
    text: words.map((w) => w.word).join(' '),
    sentences: groupSentences(words),
    approximate: false,
  };
}

module.exports = {
  name: 'whisper',
  label: 'Whisper (local speech recognition)',
  quality: 'best — true word-level timings',
  isAvailable,
  transcribe,
  detect,
};
