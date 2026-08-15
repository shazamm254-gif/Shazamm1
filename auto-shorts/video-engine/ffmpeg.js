'use strict';
/**
 * Thin, promise-based FFmpeg / FFprobe wrapper.
 *
 * Everything runs as a local child process — no media ever leaves the machine.
 * Progress is parsed out of ffmpeg's -progress stream so long renders can
 * report a real percentage instead of a spinner.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { E } = require('../utils/errors');

function resolveBinary(envVar, staticModule, subpath) {
  const fromEnv = process.env[envVar];
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  try {
    const mod = require(staticModule);
    const p = subpath ? mod[subpath] : mod;
    if (p && fs.existsSync(p)) return p;
  } catch (_) { /* module not installed */ }
  return null;
}

const FFMPEG = resolveBinary('AUTOSHORTS_FFMPEG', 'ffmpeg-static');
const FFPROBE = resolveBinary('AUTOSHORTS_FFPROBE', 'ffprobe-static', 'path');

function available() {
  return Boolean(FFMPEG && FFPROBE);
}

function requireBinaries() {
  if (!available()) throw E.ffmpegMissing();
}

/**
 * Run ffmpeg. Returns { stderr } on success, throws AppError on failure.
 * onProgress receives a 0..1 fraction when totalDuration is known.
 */
function run(args, { stage = 'processing', onProgress = null, totalDuration = 0, cwd = null, timeoutMs = 0 } = {}) {
  requireBinaries();
  return new Promise((resolve, reject) => {
    const fullArgs = ['-hide_banner', '-nostdin', '-loglevel', 'error'];
    if (onProgress) fullArgs.push('-progress', 'pipe:1', '-nostats');
    fullArgs.push(...args);

    const child = spawn(FFMPEG, fullArgs, { cwd: cwd || process.cwd() });
    let stderr = '';
    let stdout = '';
    let killed = false;
    let timer = null;

    if (timeoutMs > 0) {
      timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, timeoutMs);
    }

    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 200000) stderr = stderr.slice(-100000);
    });

    child.stdout.on('data', (d) => {
      stdout += d.toString();
      if (!onProgress) return;
      const lines = stdout.split('\n');
      stdout = lines.pop() || '';
      for (const line of lines) {
        const m = /^out_time_ms=(\d+)/.exec(line.trim());
        if (m && totalDuration > 0) {
          const seconds = parseInt(m[1], 10) / 1e6;
          onProgress(Math.max(0, Math.min(0.999, seconds / totalDuration)));
        }
      }
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(E.ffmpegFailed(stage, err.message));
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (killed) return reject(E.ffmpegFailed(stage, 'The operation timed out and was stopped.'));
      if (code !== 0) return reject(E.ffmpegFailed(stage, stderr));
      if (onProgress) onProgress(1);
      resolve({ stderr });
    });
  });
}

/** Run ffmpeg purely to read its stderr (silencedetect, astats, volumedetect). */
function runForStderr(args, { stage = 'analysis', timeoutMs = 0 } = {}) {
  requireBinaries();
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ['-hide_banner', '-nostdin', ...args]);
    let stderr = '';
    let timer = null;
    if (timeoutMs > 0) timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => { if (timer) clearTimeout(timer); reject(E.ffmpegFailed(stage, err.message)); });
    child.on('close', () => { if (timer) clearTimeout(timer); resolve(stderr); });
  });
}

/** Run ffmpeg and collect raw stdout as a Buffer (used for PCM extraction). */
function runForBuffer(args, { stage = 'decode', timeoutMs = 0 } = {}) {
  requireBinaries();
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ['-hide_banner', '-nostdin', '-loglevel', 'error', ...args]);
    const chunks = [];
    let stderr = '';
    let timer = null;
    if (timeoutMs > 0) timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => { if (timer) clearTimeout(timer); reject(E.ffmpegFailed(stage, err.message)); });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code !== 0) return reject(E.ffmpegFailed(stage, stderr));
      resolve(Buffer.concat(chunks));
    });
  });
}

/** ffprobe -> parsed JSON. */
function probe(file) {
  requireBinaries();
  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file];
    const child = spawn(FFPROBE, args);
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => reject(E.unsupportedMedia(path.basename(file), e.message)));
    child.on('close', (code) => {
      if (code !== 0) return reject(E.unsupportedMedia(path.basename(file), err.trim() || 'ffprobe exited non-zero.'));
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        reject(E.unsupportedMedia(path.basename(file), 'ffprobe returned output that could not be parsed.'));
      }
    });
  });
}

/**
 * Escape a path for use inside a filtergraph value (ass=..., movie=..., etc).
 * Colons, backslashes, quotes and commas all need protection.
 */
function escapeFilterPath(p) {
  return String(p)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/** Escape a value used inside a filter option that we wrap in single quotes. */
function escapeFilterValue(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

module.exports = {
  FFMPEG, FFPROBE, available, requireBinaries,
  run, runForStderr, runForBuffer, probe,
  escapeFilterPath, escapeFilterValue,
};
