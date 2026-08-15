'use strict';
/**
 * AUTO EDIT — the centrepiece.
 *
 * One button turns raw uploads into a finished edit decision list. The pipeline:
 *
 *   1. pick the voice track
 *   2. analyse it   (VAD, silence, energy — real DSP over real samples)
 *   3. plan the cuts (silence removal, at the chosen strictness)
 *   4. transcribe   (Whisper if installed, otherwise align the pasted script)
 *   5. map every discovered timestamp from source time into edit time
 *   6. ask the AIProvider what matters — hook, emphasis, B-roll intent, beats
 *   7. build the picture: cut talking-head footage, or sequence stills
 *   8. write captions, punch-ins, B-roll slots, sound design and music
 *   9. hand back an EDL plus a plain-English report of what it did
 *
 * Nothing here touches pixels. The renderer does that, from the EDL, later.
 */

const path = require('path');
const analyze = require('../audio/analyze');
const stt = require('../captions/stt');
const chunker = require('../captions/chunker');
const captionStyles = require('../captions/styles');
const AIProvider = require('./AIProvider');
const presets = require('./presets');
const edlLib = require('../timeline/edl');
const { TimeMap } = require('../timeline/timemap');
const { SFX_LIBRARY } = require('../audio/sfx');
const { WORD_TO_CONCEPT } = require('./lexicon');
const { E } = require('../utils/errors');
const { round, clamp, id, hashRandom, syllables } = require('../utils');

/* --------------------------------------------------------- media helpers */

function mediaById(project) {
  return new Map((project.media || []).map((m) => [m.id, m]));
}

/** The clip whose audio is the narration. */
function pickVoiceMedia(project) {
  const media = project.media || [];
  if (project.settings?.voiceMediaId) {
    const explicit = media.find((m) => m.id === project.settings.voiceMediaId);
    if (explicit) return explicit;
  }
  // A dedicated voiceover/narration upload beats audio embedded in a clip.
  const voice = media.find((m) => m.kind === 'audio' && m.role !== 'music' && m.role !== 'sfx');
  if (voice) return voice;
  const talkingHead = media.find((m) => m.kind === 'video' && m.hasAudio);
  if (talkingHead) return talkingHead;
  return null;
}

function visualMedia(project) {
  return (project.media || []).filter((m) => (m.kind === 'video' || m.kind === 'image') && m.role !== 'broll-only');
}

function musicMedia(project) {
  return (project.media || []).find((m) => m.role === 'music' || m.kind === 'music') || null;
}

/* ------------------------------------------------------- B-roll matching */

/** The searchable text for a media item: its filename plus its tags. */
function haystackFor(m) {
  return [
    path.basename(m.filename || '', path.extname(m.filename || '')),
    ...(m.tags || []),
  ].join(' ').toLowerCase().replace(/[_\-.]+/g, ' ');
}

/** The visual concepts a media item appears to be about. */
function conceptsFor(m) {
  const out = new Set();
  for (const tok of haystackFor(m).split(/\s+/)) {
    const c = WORD_TO_CONCEPT.get(tok);
    if (c) out.add(c);
  }
  return out;
}

/**
 * Score how well a media item matches a B-roll slot.
 *
 * Filenames and tags are all we have offline, and creators do name their B-roll
 * after what is in it. But a literal word match is too brittle on its own: a
 * line about a "payment" should be able to reach a file called
 * money-cash-stack.jpg. So matching happens on two levels — the exact word, and
 * the visual concept the word belongs to.
 */
function matchMedia(candidates, keywords, usedIds, slotConcept = null) {
  if ((!keywords || !keywords.length) && !slotConcept) return null;

  const wanted = new Set();
  for (const k of keywords || []) {
    const c = WORD_TO_CONCEPT.get(String(k).toLowerCase());
    if (c) wanted.add(c);
  }
  if (slotConcept) wanted.add(slotConcept);

  let best = null;

  for (const m of candidates) {
    const haystack = haystackFor(m);
    let score = 0;

    for (const k of keywords || []) {
      const kw = String(k).toLowerCase();
      if (!kw || kw.length < 3) continue;
      if (haystack.includes(kw)) score += 3;                      // named outright
      else if (kw.length > 4 && haystack.includes(kw.slice(0, Math.max(4, kw.length - 2)))) score += 1;
    }

    // Same subject matter, different word for it.
    const media = conceptsFor(m);
    for (const c of wanted) if (media.has(c)) score += 2;

    if (usedIds.has(m.id)) score -= 1.5;   // spread cutaways across the library
    if (score > 0 && (!best || score > best.score)) best = { media: m, score };
  }

  return best && best.score >= 2 ? best.media : null;
}

/* ------------------------------------------------------------ SFX policy */

const SFX_INTENSITY = {
  low: { perMinute: 4, minGap: 4.0, gain: 0.34, kinds: ['transition', 'impact'] },
  medium: { perMinute: 9, minGap: 2.2, gain: 0.46, kinds: ['whoosh', 'impact', 'hit', 'transition', 'click'] },
  high: { perMinute: 16, minGap: 1.2, gain: 0.55, kinds: ['whoosh', 'impact', 'hit', 'transition', 'click', 'glitch', 'rise', 'pop'] },
};

/** Choose an effect for a beat, respecting the preset's palette. */
function sfxForBeat(beat, palette) {
  const prefer = {
    hook: ['hit', 'impact', 'sub'],
    reveal: ['impact', 'sub', 'hit'],
    interrupt: ['glitch', 'whoosh', 'transition'],
    'accent-strong': ['impact', 'hit', 'click'],
    accent: ['click', 'pop', 'whoosh'],
    sentence: ['transition', 'whoosh'],
    scene: ['whoosh', 'transition'],
  }[beat.kind] || ['transition'];

  for (const p of prefer) {
    if (palette.includes(p) && SFX_LIBRARY[p]) return p;
  }
  return palette.find((p) => SFX_LIBRARY[p]) || 'transition';
}

/* ---------------------------------------------------------------- report */

class Report {
  constructor() { this.steps = []; this.warnings = []; }
  add(label, detail = '') { this.steps.push({ label, detail }); }
  warn(what, why, fix) { this.warnings.push({ what, why, fix }); }
}

/* ------------------------------------------------------------------ main */

/**
 * @param {object} project  the saved project
 * @param {object} opts     { onProgress, directives }  directives come from RE-EDIT
 * @returns {{ edl, analysis, report, settings }}
 */
async function autoEdit(project, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const report = new Report();
  const settings = presets.resolveSettings(project);
  const mediaIdx = mediaById(project);

  // Re-edit directives nudge the dials before anything is computed.
  applyDirectives(settings, opts.directives || []);

  const visuals = visualMedia(project);
  if (!visuals.length) throw E.noVisuals();

  const voiceMedia = pickVoiceMedia(project);
  if (!voiceMedia) throw E.noVoice();

  /* -- 1. analyse the voice ------------------------------------------- */
  onProgress(0.05, 'Analysing the voice track');
  const voiceAnalysis = await analyze.analyzeVoice(voiceMedia.absPath, {
    silenceLevel: settings.silenceRemoval,
  });

  if (!voiceAnalysis.duration) {
    throw E.badInput(
      'The voice track contains no audio.',
      `"${voiceMedia.filename}" decoded to an empty waveform.`,
      'Check the file plays elsewhere, or upload a different narration file.'
    );
  }

  const timeMap = new TimeMap(voiceAnalysis.plan.keepRanges.length
    ? voiceAnalysis.plan.keepRanges
    : [{ start: 0, end: voiceAnalysis.duration }]);

  const editDuration = timeMap.editDuration;

  if (voiceAnalysis.plan.removedSeconds > 0.05) {
    report.add(
      `Removed ${voiceAnalysis.plan.removedSeconds.toFixed(1)} seconds of silence`,
      `${voiceAnalysis.plan.removed.length} ${voiceAnalysis.plan.removed.length === 1 ? 'gap' : 'gaps'} cut at the ${settings.silenceRemoval.toUpperCase()} setting. Natural pauses under the threshold were kept.`
    );
  } else if (settings.silenceRemoval === 'off') {
    report.add('Kept every pause', 'Silence removal is switched off.');
  } else {
    report.add('No silence worth cutting', 'The delivery was already tight at this setting.');
  }

  /* -- 2. transcribe --------------------------------------------------- */
  onProgress(0.22, 'Reading the speech');
  let transcript = { words: [], sentences: [], text: '', provider: 'none' };
  let captionsFailed = null;

  try {
    transcript = await stt.transcribe({
      audioPath: voiceMedia.absPath,
      script: project.script || '',
      srtText: project.srt || '',
      speech: voiceAnalysis.speech,
      duration: voiceAnalysis.duration,
      preferred: project.settings?.sttProvider || 'auto',
      language: project.settings?.language || 'en',
    });
    report.add(
      `Transcribed with ${transcript.providerLabel}`,
      transcript.approximate
        ? 'Your script was aligned to the speech detected in the audio, so the wording is exactly what you wrote.'
        : `${transcript.words.length} words with timings from the recognizer.`
    );
  } catch (err) {
    // Captions are optional; the rest of the edit still happens.
    captionsFailed = err;
    report.warn(
      err.what || 'Captions could not be generated.',
      err.why || 'No speech-to-text engine was available.',
      err.fix || 'Paste your script, or import an .srt file, then re-run AUTO EDIT.'
    );
  }

  /* -- 3. AI analysis --------------------------------------------------- */
  onProgress(0.38, 'Working out what matters');
  let ai = { hook: null, emphasis: [], broll: [], beats: [], topics: [], provider: 'local' };

  if (transcript.words.length) {
    ai = await AIProvider.analyze({
      words: transcript.words,
      sentences: transcript.sentences,
      text: transcript.text,
      settings,
      duration: voiceAnalysis.duration,
      mediaTags: (project.media || []).map((m) => ({ id: m.id, name: m.filename, tags: m.tags || [] })),
    }, project.settings?.aiProvider);

    if (ai.fellBack) report.warn('Hosted AI analysis was skipped.', ai.fallbackReason, 'The local analysis was used instead — the edit is complete.');
  }

  /* -- 4. build the picture --------------------------------------------- */
  onProgress(0.52, 'Building the picture');
  const timeline = [];
  const voiceIsSeparate = voiceMedia.kind === 'audio';
  const stills = visuals.filter((m) => m.kind === 'image');
  const clips = visuals.filter((m) => m.kind === 'video');

  // IMAGE STORY mode: narration plus a folder of stills. Also the right choice
  // whenever the voice is a separate file and there is no footage to cut.
  const imageStory = project.settings?.mode === 'image_story'
    || (voiceIsSeparate && stills.length > 0 && clips.length === 0);

  let visualClips;
  if (imageStory) {
    visualClips = buildImageStory({
      media: [...stills, ...clips],
      sentences: transcript.sentences,
      timeMap,
      editDuration,
      settings,
      report,
    });
  } else if (voiceIsSeparate && clips.length) {
    visualClips = buildSequencedFootage({ clips, editDuration, settings, report });
  } else {
    visualClips = buildTalkingHead({
      media: voiceMedia.kind === 'video' ? voiceMedia : clips[0],
      timeMap,
      report,
    });
  }
  timeline.push(...visualClips);

  /* -- 5. voice + music -------------------------------------------------- */
  timeline.push(edlLib.makeClip('voice', {
    source: voiceMedia.id,
    start: 0,
    end: editDuration,
    gain: project.settings?.levels?.voice ?? 1.0,
    keepRanges: timeMap.ranges,
    embedded: voiceMedia.kind === 'video',
  }));

  const music = musicMedia(project);
  if (music) {
    const level = project.settings?.levels?.music ?? settings.musicLevel;
    timeline.push(edlLib.makeClip('music', {
      source: music.id,
      start: 0,
      end: editDuration,
      gain: level,
      duck: true,
      duckAmount: 0.62,
    }));
    report.add(
      'Placed background music under the voice',
      `Set to ${Math.round(level * 100)}% and side-chained to the narration, so it drops while you speak and lifts in the gaps.`
    );
  }

  /* -- 6. captions ------------------------------------------------------- */
  onProgress(0.68, 'Writing captions');
  const styleId = settings.captionStyle || captionStyles.DEFAULT_STYLE;
  const style = captionStyles.getStyle(styleId);
  let captionChunks = [];

  if (transcript.words.length) {
    // Attach emphasis to the word stream, then move everything into edit time.
    const emphasisByIndex = new Map(ai.emphasis.map((e) => [e.index, e]));
    const editWords = [];

    transcript.words.forEach((w, i) => {
      const mapped = timeMap.rangeToEdit(w.start, w.end);
      if (!mapped) return;    // this word sat inside a removed range
      editWords.push({
        ...w,
        start: mapped.start,
        end: mapped.end,
        emphasis: emphasisByIndex.has(i) ? emphasisByIndex.get(i).level : null,
      });
    });

    captionChunks = chunker.chunk(editWords, style, { pace: settings.captionPace });

    for (const c of captionChunks) {
      timeline.push(edlLib.makeClip('caption', {
        text: c.text,
        rawText: c.rawText,
        start: c.start,
        end: c.end,
        style: styleId,
        words: c.words,
        lines: c.lines,
      }));
    }

    const emphCount = captionChunks.reduce((a, c) => a + c.words.filter((w) => w.emphasis).length, 0);
    report.add(
      `Created ${captionChunks.length} caption ${captionChunks.length === 1 ? 'card' : 'cards'}`,
      `Style: ${style.label}. Broken at sentence ends and at the pauses in your delivery, and kept inside the mobile safe area.`
    );
    if (emphCount) {
      report.add(
        `Emphasised ${emphCount} ${emphCount === 1 ? 'word' : 'words'}`,
        `Chosen for meaning — numbers, reversals and the words that land each sentence. Analysis by ${ai.providerLabel || 'local heuristics'}.`
      );
    }
  }

  /* -- 7. punch-ins ------------------------------------------------------ */
  onProgress(0.78, 'Adding camera movement');
  const zooms = buildZooms({ ai, timeMap, editDuration, settings, visualClips, imageStory });
  timeline.push(...zooms);
  if (zooms.length) {
    report.add(
      `Added ${zooms.length} punch-${zooms.length === 1 ? 'in' : 'ins'}`,
      'Placed on the emphasis moments and the hook, easing in and back out so the camera feels intentional rather than restless.'
    );
  }

  /* -- 8. B-roll --------------------------------------------------------- */
  const brollClips = buildBroll({
    ai, timeMap, project, settings, editDuration,
    excludeIds: new Set([voiceMedia.id, ...visualClips.map((v) => v.source)]),
    report,
  });
  timeline.push(...brollClips);

  /* -- 9. sound design --------------------------------------------------- */
  onProgress(0.88, 'Placing sound design');
  const sfxClips = buildSfx({ ai, timeMap, settings, editDuration, visualClips, project });
  timeline.push(...sfxClips);
  if (sfxClips.length) {
    report.add(
      `Placed ${sfxClips.length} sound ${sfxClips.length === 1 ? 'effect' : 'effects'}`,
      `Intensity ${String(settings.sfxIntensity).toUpperCase()}. Synthesized locally — impacts on reveals, whooshes on visual changes, nothing on top of a caption that did not need it.`
    );
  }

  /* -- 10. transitions ---------------------------------------------------- */
  if (settings.transition && settings.transition !== 'none' && settings.transition !== 'hard') {
    let n = 0;
    for (let i = 1; i < visualClips.length; i++) {
      timeline.push(edlLib.makeClip('transition', {
        start: round(visualClips[i].start - 0.06, 3),
        end: round(visualClips[i].start + 0.14, 3),
        kind: settings.transition,
      }));
      n++;
    }
    if (n) report.add(`Added ${n} ${settings.transition} ${n === 1 ? 'transition' : 'transitions'}`, 'On the visual changes only — cuts inside a single shot stay hard.');
  }

  /* -- 11. assemble ------------------------------------------------------- */
  const edl = {
    ...edlLib.createEmpty(),
    duration: editDuration,
    timeline,
  };
  const sorted = edlLib.sortTimeline(edl);

  // Pacing note against the creator's target length.
  const target = project.settings?.targetDuration || 60;
  const over = editDuration - target;
  if (over > target * 0.15) {
    report.add(
      `Runs ${editDuration.toFixed(1)}s against your ${target}s target`,
      `That is ${over.toFixed(1)}s long. RE-EDIT → "Faster pacing" will cut tighter, or trim a section on the timeline.`
    );
  } else {
    report.add(
      `Paced to ${editDuration.toFixed(1)}s`,
      `Within your ${target}s target.`
    );
  }

  onProgress(1, 'Done');

  return {
    edl: sorted,
    settings,
    analysis: {
      voiceMediaId: voiceMedia.id,
      sourceDuration: voiceAnalysis.duration,
      editDuration,
      speech: voiceAnalysis.speech,
      silences: voiceAnalysis.silences,
      waveform: voiceAnalysis.waveform,
      threshold: voiceAnalysis.threshold,
      removed: voiceAnalysis.plan.removed,
      removedSeconds: voiceAnalysis.plan.removedSeconds,
      keepRanges: timeMap.ranges,
      transcript: {
        provider: transcript.provider,
        providerLabel: transcript.providerLabel,
        approximate: Boolean(transcript.approximate),
        wordCount: transcript.words.length,
        text: transcript.text,
        words: transcript.words,
      },
      ai: {
        provider: ai.provider,
        providerLabel: ai.providerLabel,
        hook: ai.hook,
        topics: ai.topics,
        emphasisCount: ai.emphasis.length,
        brollSuggested: ai.broll.length,
      },
      mode: imageStory ? 'image_story' : (voiceIsSeparate ? 'sequenced' : 'talking_head'),
      captionsFailed: captionsFailed ? captionsFailed.toJSON() : null,
    },
    report: {
      steps: report.steps,
      warnings: report.warnings,
      generatedAt: new Date().toISOString(),
      provider: ai.providerLabel || 'Local heuristics',
    },
  };
}

/* ------------------------------------------------------- picture builders */

/**
 * Talking head: one clip, cut wherever silence was removed. Each surviving
 * source range becomes one video clip, laid end to end.
 */
function buildTalkingHead({ media, timeMap, report }) {
  const clips = timeMap.offsets.map((r) => edlLib.makeClip('video', {
    source: media.id,
    start: round(r.editStart, 3),
    end: round(r.editEnd, 3),
    sourceIn: round(r.start, 3),
    mediaKind: 'video',
  }));

  report.add(
    `Cut the footage into ${clips.length} ${clips.length === 1 ? 'segment' : 'segments'}`,
    clips.length > 1
      ? 'The cuts sit exactly where the dead air was, so the delivery tightens without changing a word.'
      : 'No cuts were needed — the take was already continuous.'
  );
  return clips;
}

/**
 * IMAGE STORY: a folder of stills plus narration.
 *
 * Images are cut on sentence boundaries rather than on a fixed interval, so the
 * picture changes when the story does. Each still gets a Ken Burns move whose
 * direction alternates and whose strength comes from the preset.
 */
function buildImageStory({ media, sentences, timeMap, editDuration, settings, report }) {
  if (!media.length) throw E.noVisuals();

  const targetDur = settings.imageDuration || 3.0;

  // Prefer sentence boundaries in edit time as the cut points.
  const boundaries = [0];
  if (sentences && sentences.length) {
    for (const s of sentences) {
      const t = timeMap.toEdit(s.end);
      if (t > boundaries[boundaries.length - 1] + 0.9 && t < editDuration - 0.5) boundaries.push(round(t, 3));
    }
  }
  boundaries.push(editDuration);

  // Merge boundaries that would make a shot far shorter than the target, and
  // split any that would leave one on screen for too long.
  const cuts = [0];
  for (let i = 1; i < boundaries.length; i++) {
    const last = cuts[cuts.length - 1];
    const span = boundaries[i] - last;
    if (span < targetDur * 0.6 && i < boundaries.length - 1) continue;
    if (span > targetDur * 1.9) {
      const pieces = Math.round(span / targetDur);
      for (let p = 1; p < pieces; p++) cuts.push(round(last + (span * p) / pieces, 3));
    }
    cuts.push(round(boundaries[i], 3));
  }

  const clips = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const m = media[i % media.length];
    const amount = settings.kenBurns || 0.09;
    // Alternate the move so consecutive stills do not drift the same way.
    const dir = i % 2 === 0 ? 1 : -1;
    const jitter = hashRandom(`${m.id}:${i}`);
    const zoomIn = jitter > 0.42;

    clips.push(edlLib.makeClip(m.kind === 'image' ? 'image' : 'video', {
      source: m.id,
      start: cuts[i],
      end: cuts[i + 1],
      sourceIn: 0,
      mediaKind: m.kind,
      kenBurns: m.kind === 'image' ? {
        zFrom: round(zoomIn ? 1.0 : 1 + amount, 4),
        zTo: round(zoomIn ? 1 + amount : 1.0, 4),
        panX: round(dir * amount * 0.45 * (0.4 + jitter * 0.6), 4),
        panY: round(-dir * amount * 0.22 * jitter, 4),
      } : null,
    }));
  }

  const stillCount = new Set(clips.filter((c) => c.type === 'image').map((c) => c.source)).size;
  report.add(
    `Sequenced ${clips.length} shots from ${media.length} ${media.length === 1 ? 'file' : 'files'}`,
    `Image Story mode. Cuts land on sentence endings, and each still gets a slow Ken Burns move${stillCount ? '' : ''} so nothing sits static.`
  );
  return clips;
}

/** Separate narration over a set of video clips: lay them end to end, looping. */
function buildSequencedFootage({ clips, editDuration, settings, report }) {
  const out = [];
  let cursor = 0;
  let i = 0;

  while (cursor < editDuration - 0.05 && i < 200) {
    const m = clips[i % clips.length];
    const avail = Math.max(0.6, m.duration || 3);
    const take = Math.min(avail, editDuration - cursor, Math.max(2.2, settings.imageDuration * 1.4));
    out.push(edlLib.makeClip('video', {
      source: m.id,
      start: round(cursor, 3),
      end: round(cursor + take, 3),
      sourceIn: 0,
      mediaKind: 'video',
    }));
    cursor += take;
    i++;
  }

  report.add(
    `Laid ${out.length} shots under the narration`,
    'Your footage was sequenced to cover the voiceover, cutting before any clip runs out.'
  );
  return out;
}

/* ---------------------------------------------------------- zoom builder */

/**
 * Punch-ins. Placed on emphasis beats and the hook, never closer together than
 * the preset's hold time, and never on top of a Ken Burns still (the move is
 * already there).
 */
function buildZooms({ ai, timeMap, editDuration, settings, visualClips, imageStory }) {
  if (imageStory || !settings.zoomDensity) return [];

  const budget = Math.max(0, Math.round((editDuration / 10) * settings.zoomDensity * 2.2));
  if (!budget) return [];

  const candidates = (ai.beats || [])
    .filter((b) => ['accent-strong', 'accent', 'reveal', 'hook', 'interrupt'].includes(b.kind))
    .map((b) => ({ ...b, editTime: timeMap.toEdit(b.time) }))
    .filter((b) => b.editTime > 0.2 && b.editTime < editDuration - 0.8)
    .sort((a, b) => b.strength - a.strength);

  const hold = settings.zoomHold || 1.6;
  const picked = [];

  for (const c of candidates) {
    if (picked.length >= budget) break;
    if (picked.some((p) => Math.abs(p.editTime - c.editTime) < hold + 0.6)) continue;
    picked.push(c);
  }

  return picked
    .sort((a, b) => a.editTime - b.editTime)
    .map((b) => {
      const strong = b.strength >= 0.8;
      const scale = strong ? settings.zoomScales.strong : settings.zoomScales.normal;
      const start = round(Math.max(0, b.editTime - 0.12), 3);
      const end = round(Math.min(editDuration, start + hold), 3);
      return edlLib.makeClip('zoom', {
        start,
        end,
        scale: round(scale, 4),
        attack: strong ? 0.22 : 0.34,
        release: 0.45,
        reason: b.kind === 'hook' ? 'hook' : strong ? 'strong emphasis' : 'emphasis',
      });
    })
    .filter((z) => z.end - z.start > 0.3);
}

/* --------------------------------------------------------- broll builder */

/**
 * B-roll slots. In AUTO mode we try to fill each slot from the project's own
 * media library by matching the suggested keywords against filenames and tags.
 * Unmatched slots stay on the timeline as empty suggestions with a Replace
 * button — a real slot with real timing, not a placeholder.
 */
function buildBroll({ ai, timeMap, project, settings, editDuration, excludeIds, report }) {
  const suggestions = ai.broll || [];
  if (!suggestions.length) return [];

  const mode = project.settings?.brollMode || 'auto';
  const library = (project.media || []).filter(
    (m) => (m.kind === 'video' || m.kind === 'image') && !excludeIds.has(m.id)
  );

  const used = new Set();
  const clips = [];

  // The hook has to land on the speaker. Cutting away in the first couple of
  // seconds throws away the one moment that decides whether anyone stays.
  const HOOK_PROTECT = 1.8;

  for (const s of suggestions) {
    const mapped = timeMap.rangeToEdit(s.start, s.end);
    if (!mapped || mapped.end - mapped.start < 0.7) continue;
    if (mapped.end > editDuration - 0.2) continue;
    if (mapped.start < HOOK_PROTECT) {
      // Push it past the hook if there is still enough line left to be worth it.
      if (mapped.end - HOOK_PROTECT < 0.9) continue;
      mapped.start = HOOK_PROTECT;
    }
    if (clips.some((c) => mapped.start < c.end + 0.4 && mapped.end > c.start - 0.4)) continue;

    const match = mode === 'auto' ? matchMedia(library, s.keywords, used, s.concept) : null;
    if (match) used.add(match.id);

    clips.push(edlLib.makeClip('broll', {
      start: mapped.start,
      end: mapped.end,
      source: match ? match.id : null,
      mediaKind: match ? match.kind : null,
      sourceIn: 0,
      keywords: s.keywords,
      suggestions: s.suggestions,
      reason: s.reason,
      confidence: s.confidence,
      kenBurns: match && match.kind === 'image'
        ? { zFrom: 1.0, zTo: round(1 + (settings.kenBurns || 0.08), 4), panX: 0, panY: 0 }
        : null,
    }));
  }

  if (clips.length) {
    const filled = clips.filter((c) => c.source).length;
    report.add(
      `Found ${clips.length} B-roll ${clips.length === 1 ? 'opportunity' : 'opportunities'}`,
      filled
        ? `${filled} filled automatically from your media library; ${clips.length - filled} left as suggestions with a Replace button.`
        : `None matched your library by name, so each slot lists what to drop in. Tap Replace on any slot to fill it.`
    );
  }
  return clips;
}

/* ----------------------------------------------------------- sfx builder */

/**
 * Sound design. Restraint is the whole point: a per-minute budget, a minimum
 * gap, no effect on top of another, and nothing in the last half second.
 */
function buildSfx({ ai, timeMap, settings, editDuration, visualClips, project }) {
  const intensity = SFX_INTENSITY[settings.sfxIntensity] || SFX_INTENSITY.medium;
  if (!intensity || settings.sfxIntensity === 'off') return [];

  const palette = settings.sfxPalette || intensity.kinds;
  const budget = Math.max(1, Math.round((editDuration / 60) * intensity.perMinute));
  const userGain = project.settings?.levels?.sfx;
  const gain = userGain !== undefined && userGain !== null ? userGain * 0.9 : intensity.gain;

  const candidates = [];

  // Beats from the language analysis.
  for (const b of ai.beats || []) {
    const t = timeMap.toEdit(b.time);
    if (t < 0.05 || t > editDuration - 0.4) continue;
    if (b.kind === 'sentence' && settings.sfxIntensity !== 'high') continue;
    candidates.push({ time: t, strength: b.strength, kind: b.kind });
  }

  // Visual changes deserve a movement cue.
  for (let i = 1; i < visualClips.length; i++) {
    candidates.push({ time: visualClips[i].start, strength: 0.6, kind: 'scene' });
  }

  candidates.sort((a, b) => b.strength - a.strength);

  const picked = [];
  for (const c of candidates) {
    if (picked.length >= budget) break;
    if (picked.some((p) => Math.abs(p.time - c.time) < intensity.minGap)) continue;
    picked.push(c);
  }

  return picked
    .sort((a, b) => a.time - b.time)
    .map((c) => {
      const name = sfxForBeat(c, palette);
      const meta = SFX_LIBRARY[name];
      // A whoosh leads the change it accompanies; an impact lands on it.
      const lead = ['whoosh', 'transition', 'rise'].includes(name) ? meta.duration * 0.55 : 0.02;
      const start = round(clamp(c.time - lead, 0, editDuration - 0.15), 3);
      return edlLib.makeClip('sfx', {
        start,
        end: round(Math.min(start + meta.duration, editDuration), 3),
        sfxName: name,
        gain: round(clamp(gain * (0.7 + c.strength * 0.5) * meta.weight * 1.6, 0.05, 0.9), 3),
        reason: c.kind,
      });
    });
}

/* -------------------------------------------------------------- re-edit */

const DIRECTIVES = {
  more_energetic: (s) => {
    s.captionPace = clamp(s.captionPace * 1.15, 0.6, 1.6);
    s.zoomDensity = clamp(s.zoomDensity * 1.6, 0, 1.4);
    s.emphasisIntensity = clamp(s.emphasisIntensity * 1.25, 0.2, 2);
    s.sfxIntensity = s.sfxIntensity === 'low' ? 'medium' : 'high';
    s.silenceRemoval = s.silenceRemoval === 'off' ? 'medium' : s.silenceRemoval === 'low' ? 'medium' : 'aggressive';
  },
  more_cinematic: (s) => {
    s.captionStyle = 'cinematic';
    s.captionPace = clamp(s.captionPace * 0.85, 0.6, 1.6);
    s.zoomDensity = clamp(s.zoomDensity * 0.6, 0, 1.4);
    s.zoomHold = (s.zoomHold || 1.6) * 1.6;
    s.kenBurns = clamp((s.kenBurns || 0.09) * 1.4, 0.03, 0.25);
    s.transition = 'fade';
    s.sfxPalette = ['sub', 'impact', 'rise', 'transition'];
    s.imageDuration = (s.imageDuration || 3) * 1.25;
  },
  faster_pacing: (s) => {
    s.silenceRemoval = s.silenceRemoval === 'aggressive' ? 'aggressive' : s.silenceRemoval === 'medium' ? 'aggressive' : 'medium';
    s.captionPace = clamp(s.captionPace * 1.2, 0.6, 1.6);
    s.imageDuration = Math.max(1.4, (s.imageDuration || 3) * 0.72);
  },
  slower_pacing: (s) => {
    s.silenceRemoval = s.silenceRemoval === 'aggressive' ? 'medium' : s.silenceRemoval === 'medium' ? 'low' : 'off';
    s.captionPace = clamp(s.captionPace * 0.82, 0.6, 1.6);
    s.imageDuration = (s.imageDuration || 3) * 1.35;
  },
  more_visual_changes: (s) => {
    s.brollDensity = clamp(s.brollDensity * 1.7, 0, 2);
    s.imageDuration = Math.max(1.4, (s.imageDuration || 3) * 0.75);
    s.zoomDensity = clamp(s.zoomDensity * 1.3, 0, 1.4);
  },
  fewer_effects: (s) => {
    s.sfxIntensity = s.sfxIntensity === 'high' ? 'medium' : 'low';
    s.zoomDensity = clamp(s.zoomDensity * 0.45, 0, 1.4);
    s.transition = 'none';
    s.emphasisIntensity = clamp(s.emphasisIntensity * 0.7, 0.2, 2);
  },
  more_captions: (s) => {
    s.captionPace = clamp(s.captionPace * 1.3, 0.6, 1.6);
    s.emphasisIntensity = clamp(s.emphasisIntensity * 1.15, 0.2, 2);
  },
  cleaner: (s) => {
    s.captionStyle = 'clean';
    s.sfxIntensity = 'low';
    s.zoomDensity = clamp(s.zoomDensity * 0.5, 0, 1.4);
    s.emphasisIntensity = clamp(s.emphasisIntensity * 0.6, 0.2, 2);
    s.transition = 'none';
    s.brollDensity = clamp(s.brollDensity * 0.7, 0, 2);
  },
};

const DIRECTIVE_LIST = [
  { id: 'more_energetic', label: 'More energetic' },
  { id: 'more_cinematic', label: 'More cinematic' },
  { id: 'faster_pacing', label: 'Faster pacing' },
  { id: 'slower_pacing', label: 'Slower pacing' },
  { id: 'more_visual_changes', label: 'More visual changes' },
  { id: 'fewer_effects', label: 'Fewer effects' },
  { id: 'more_captions', label: 'More captions' },
  { id: 'cleaner', label: 'Cleaner' },
];

function applyDirectives(settings, directives) {
  for (const d of directives) {
    const fn = DIRECTIVES[d];
    if (fn) fn(settings);
  }
  return settings;
}

module.exports = { autoEdit, DIRECTIVE_LIST, DIRECTIVES, applyDirectives, SFX_INTENSITY };
