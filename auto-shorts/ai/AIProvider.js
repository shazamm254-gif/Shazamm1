'use strict';
/**
 * AIProvider — the seam between the editing engine and whatever intelligence
 * is behind it.
 *
 * The engine never calls a vendor SDK. It calls `analyze()` on whichever
 * provider is registered, and every provider returns the same shape. The
 * default provider is `local`: pure heuristics, no key, no network, no cost. A
 * hosted model can be plugged in on top without the pipeline changing, and if a
 * hosted call fails the engine silently falls back to local rather than
 * breaking the edit.
 *
 * A provider implements:
 *   name          string
 *   label         string
 *   isAvailable() -> { ok, reason }
 *   analyze(ctx)  -> Analysis
 *
 * ctx = {
 *   words:      [{ word, clean, start, end, endsSentence, endsClause }]
 *   sentences:  [{ text, start, end, wordCount }]
 *   text:       string
 *   settings:   project settings (preset, pacing, sound design, ...)
 *   mediaTags:  [{ id, name, tags[] }]  media available for B-roll matching
 *   duration:   number
 * }
 *
 * Analysis = {
 *   hook:      { start, end, text, strength }        the opening claim
 *   emphasis:  [{ index, level: 'normal'|'strong', reason }]   index into words
 *   broll:     [{ start, end, keywords[], reason, confidence }]
 *   beats:     [{ time, kind, strength }]            moments worth marking
 *   topics:    [string]
 *   provider:  string
 * }
 */

const config = require('../config');

const registry = new Map();

function register(provider) {
  registry.set(provider.name, provider);
  return provider;
}

function get(name) {
  return registry.get(name) || null;
}

function list() {
  return Array.from(registry.values()).map((p) => ({
    name: p.name,
    label: p.label,
    description: p.description || '',
  }));
}

/** Provider availability, for the settings panel. */
async function status() {
  const out = [];
  for (const p of registry.values()) {
    let avail;
    try {
      avail = await p.isAvailable();
    } catch (err) {
      avail = { ok: false, reason: err.message };
    }
    out.push({ name: p.name, label: p.label, available: avail.ok, reason: avail.reason });
  }
  return out;
}

/**
 * Resolve the provider to use.
 * 'auto' prefers a configured hosted provider, then falls back to local.
 */
async function resolve(preferred = null) {
  const want = preferred || config.ai.provider || 'auto';

  if (want !== 'auto') {
    const p = get(want);
    if (p) {
      const a = await p.isAvailable();
      if (a.ok) return p;
    }
    return get('local');
  }

  for (const name of ['anthropic', 'openai', 'local']) {
    const p = get(name);
    if (!p) continue;
    const a = await p.isAvailable();
    if (a.ok) return p;
  }
  return get('local');
}

/**
 * Run analysis with a guaranteed result. A hosted provider that throws, times
 * out, or returns malformed JSON degrades to the local provider — an edit is
 * always produced.
 */
async function analyze(ctx, preferred = null) {
  const provider = await resolve(preferred);
  const local = get('local');

  if (!provider || provider.name === 'local') {
    const result = await local.analyze(ctx);
    return { ...result, provider: 'local', providerLabel: local.label, fellBack: false };
  }

  // Always compute the local analysis: it is the floor the hosted result is
  // merged onto, so a partial hosted response still yields a complete edit.
  const baseline = await local.analyze(ctx);
  try {
    const hosted = await provider.analyze(ctx, baseline);
    return {
      ...baseline,
      ...hosted,
      emphasis: hosted.emphasis && hosted.emphasis.length ? hosted.emphasis : baseline.emphasis,
      broll: hosted.broll && hosted.broll.length ? hosted.broll : baseline.broll,
      beats: hosted.beats && hosted.beats.length ? hosted.beats : baseline.beats,
      hook: hosted.hook || baseline.hook,
      provider: provider.name,
      providerLabel: provider.label,
      fellBack: false,
    };
  } catch (err) {
    return {
      ...baseline,
      provider: 'local',
      providerLabel: local.label,
      fellBack: true,
      fallbackReason: `${provider.label} failed (${err.message}); used local analysis instead.`,
    };
  }
}

module.exports = { register, get, list, status, resolve, analyze, registry };
