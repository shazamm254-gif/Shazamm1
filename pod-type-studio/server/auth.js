// App passcode + session cookie. The backend holds the Printify token, so the
// backend itself must be locked: without this, anyone who found the URL could
// create (and publish) products in Rodney's shop.
import crypto from 'node:crypto';
import { getSettings, updateSettings, readJson, writeJson } from './store.js';

const COOKIE = 'pts_session';
const SESSION_DAYS = 30;
const SESSIONS = 'sessions.json';

function hashPasscode(passcode, salt) {
  return crypto.scryptSync(String(passcode), salt, 32).toString('hex');
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function passcodeSource() {
  if ((process.env.APP_PASSCODE || '').trim()) return 'env';
  return getSettings().passcodeHash ? 'settings' : null;
}

export function checkPasscode(passcode) {
  const env = (process.env.APP_PASSCODE || '').trim();
  if (env) {
    const a = Buffer.from(sha256(String(passcode)));
    const b = Buffer.from(sha256(env));
    return crypto.timingSafeEqual(a, b);
  }
  const s = getSettings();
  if (!s.passcodeHash || !s.passcodeSalt) return false;
  const a = Buffer.from(hashPasscode(passcode, s.passcodeSalt), 'hex');
  const b = Buffer.from(s.passcodeHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function setPasscode(passcode) {
  const salt = crypto.randomBytes(16).toString('hex');
  updateSettings({ passcodeSalt: salt, passcodeHash: hashPasscode(passcode, salt) });
}

// Sessions are stored hashed, so the sessions file alone can't be replayed.
function loadSessions() {
  const now = Date.now();
  const all = readJson(SESSIONS, {});
  for (const [k, exp] of Object.entries(all)) if (exp < now) delete all[k];
  return all;
}

export function createSession() {
  const id = crypto.randomBytes(32).toString('hex');
  const all = loadSessions();
  all[sha256(id)] = Date.now() + SESSION_DAYS * 864e5;
  writeJson(SESSIONS, all);
  return id;
}

export function destroySession(req) {
  const id = readCookie(req);
  if (!id) return;
  const all = loadSessions();
  delete all[sha256(id)];
  writeJson(SESSIONS, all);
}

export function isAuthed(req) {
  const id = readCookie(req);
  if (!id) return false;
  const exp = loadSessions()[sha256(id)];
  return Boolean(exp && exp > Date.now());
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

export function sessionCookie(id, req) {
  const secure = isHttps(req) ? '; Secure' : '';
  return `${COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export function clearCookie(req) {
  const secure = isHttps(req) ? '; Secure' : '';
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

function isHttps(req) {
  return req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
}

// First-run passcode setup is only allowed from the phone itself (loopback).
// On a public host, set APP_PASSCODE instead — otherwise whoever opened the URL
// first would get to pick the passcode.
export function isLoopback(req) {
  if (req.headers['x-forwarded-for']) return false;
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

// Simple brute-force brake: 10 wrong passcodes per 10 minutes per address.
const attempts = new Map();
export function loginAllowed(req) {
  const key = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((t) => now - t < 10 * 60e3);
  attempts.set(key, recent);
  return recent.length < 10;
}
export function recordFailedLogin(req) {
  const key = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
  attempts.set(key, [...(attempts.get(key) || []), Date.now()]);
}
