'use strict';
/**
 * EDL -> FFmpeg filter graph.
 *
 * This is where the edit becomes pixels. It compiles the whole timeline into a
 * single FFmpeg invocation: every visual segment is framed to 9:16, given its
 * punch-in or Ken Burns move and its transition, then concatenated; the voice is
 * cut to the surviving ranges; music is side-chained to duck under the
 * narration; sound effects are delayed into place; captions are burned in from a
 * generated .ass file. One pass, no intermediate files, no generational loss.
 *
 * ---------------------------------------------------------------------------
 * Two implementation notes that are easy to get wrong:
 *
 * 1. An FFmpeg input stream can only be consumed by one filter chain. Since a
 *    talking-head clip is cut into many segments that all read the same file,
 *    each segment declares its own `-ss/-t` input rather than trying to reuse
 *    one. That is also faster: `-ss` before `-i` seeks instead of decoding and
 *    discarding the whole file per segment.
 *
 * 2. Zoom. Each source is scaled to `zoomHeadroom` times the output size (1.3x)
 *    and cropped to that, then `zoompan` samples a 1/z window out of it. At
 *    z = 1.3 the window is exactly the output size, so an unzoomed segment is a
 *    straight copy; a 1.14 punch-in samples a smaller window that is still
 *    larger than the output. Punch-ins therefore never upscale, which is the
 *    difference between a push that looks intentional and one that looks soft.
 */

const path = require('path');
const config = require('../config');
const edlLib = require('../timeline/edl');
const ff = require('./ffmpeg');
const { round, clamp } = require('../utils');

/** Smoothstep ramp for one zoom event, as an FFmpeg expression in T. */
function zoomEventExpr(z, amp, T) {
  const a = round(z.start, 3);
  const b = round(z.end, 3);
  const attack = Math.max(0.08, z.attack || 0.32);
  const release = Math.max(0.08, z.release || 0.4);

  const up = `clip((${T}-${a})/${attack}\\,0\\,1)`;
  const down = `clip((${b}-${T})/${release}\\,0\\,1)`;
  const raw = `min(${up}\\,${down})`;
  // s*s*(3-2s): eases in and back out instead of sliding linearly.
  return `${round(amp, 4)}*(pow(${raw}\\,2)*(3-2*${raw}))`;
}

/** zoompan `z` expression for a segment. */
function buildZoomExpr(zooms, kenBurns, headroom, fps, segDuration) {
  const T = `(on/${fps})`;
  const terms = [];

  for (const z of zooms || []) {
    const amp = Math.max(0, (z.scale || 1) - 1);
    if (amp <= 0.001) continue;
    terms.push(zoomEventExpr(z, amp, T));
  }

  let base = '1';
  if (kenBurns) {
    const zFrom = kenBurns.zFrom || 1;
    const zTo = kenBurns.zTo || 1;
    if (Math.abs(zTo - zFrom) > 0.0005) {
      const prog = `clip(${T}/${round(Math.max(0.2, segDuration), 3)}\\,0\\,1)`;
      base = `(${round(zFrom, 4)}+${round(zTo - zFrom, 4)}*${prog})`;
    } else if (Math.abs(zFrom - 1) > 0.0005) {
      base = String(round(zFrom, 4));
    }
  }

  const sum = terms.length ? `${base}+${terms.join('+')}` : base;
  return `${round(headroom, 4)}*(${sum})`;
}

/** zoompan x/y expressions, including Ken Burns pan. */
function buildPanExprs(kenBurns, segDuration, fps) {
  const centreX = 'iw/2-(iw/zoom/2)';
  const centreY = 'ih/2-(ih/zoom/2)';
  if (!kenBurns || (!kenBurns.panX && !kenBurns.panY)) {
    return { x: centreX, y: centreY };
  }
  const T = `(on/${fps})`;
  const prog = `clip(${T}/${round(Math.max(0.2, segDuration), 3)}\\,0\\,1)`;
  const px = round(kenBurns.panX || 0, 4);
  const py = round(kenBurns.panY || 0, 4);
  // zoompan clamps x/y to the valid range itself, so the pan can never expose
  // an edge of the frame.
  return {
    x: `${centreX}+(${px})*iw*(${prog}-0.5)`,
    y: `${centreY}+(${py})*ih*(${prog}-0.5)`,
  };
}

/** Transition treatment to apply at the head of each segment boundary. */
function transitionAt(edl, time) {
  const t = edlLib.byType(edl, 'transition')
    .find((x) => Math.abs(x.start + 0.06 - time) < 0.25 || (time >= x.start && time <= x.end));
  return t ? (t.kind || 'fade') : null;
}

/**
 * Build the complete ffmpeg argument list for a render.
 *
 * @param {object} opts
 * @param {object} opts.edl
 * @param {Map}    opts.media    mediaId -> record with absPath
 * @param {string} opts.assPath  caption file to burn in, or null
 * @param {string} opts.outPath
 * @param {object} opts.target   { width, height, fps, crf, preset, audioBitrate }
 * @param {string} opts.sfxDir
 * @param {object} opts.levels   { voice, music, sfx }
 */
function build({ edl, media, assPath, outPath, target, sfxDir, levels = {} }) {
  const W = target.width;
  const H = target.height;
  const FPS = target.fps || config.video.fps;
  const headroom = config.video.zoomHeadroom;
  const SW = Math.round((W * headroom) / 2) * 2;
  const SH = Math.round((H * headroom) / 2) * 2;

  const duration = edlLib.computeDuration(edl);
  const segments = edlLib.visualProgram(edl).filter((s) => s.end - s.start > 0.02);
  if (!segments.length) throw new Error('The edit has no picture segments to render.');

  const inputs = [];
  const addInput = (args) => {
    inputs.push(args);
    return inputs.length - 1;
  };

  const filters = [];
  const videoLabels = [];

  /* ------------------------------------------------------------- picture */

  segments.forEach((seg, i) => {
    const m = media.get(seg.source);
    if (!m) throw new Error(`Segment ${i + 1} points at media "${seg.source}", which is not in the project.`);

    const segDur = round(seg.end - seg.start, 3);
    const isImage = (seg.mediaKind || m.kind) === 'image';
    const label = `v${i}`;

    // One input per segment: an input stream cannot feed two filter chains.
    const idx = isImage
      ? addInput(['-loop', '1', '-t', String(round(segDur + 0.2, 3)), '-i', m.absPath])
      : addInput(['-ss', String(round(seg.sourceIn || 0, 3)), '-t', String(round(segDur + 0.05, 3)), '-i', m.absPath]);

    const chain = ['setpts=PTS-STARTPTS'];
    chain.push(`fps=${FPS}`);
    chain.push('format=yuv420p');
    // Cover the 9:16 frame without distortion, then centre-crop.
    chain.push(`scale=${SW}:${SH}:force_original_aspect_ratio=increase:flags=bicubic`);
    chain.push(`crop=${SW}:${SH}`);
    chain.push('setsar=1');

    const zooms = edlLib.zoomsForSegment(edl, seg.start, seg.end);
    const kb = seg.kenBurns;
    const moves = zooms.length > 0
      || (kb && (Math.abs((kb.zTo || 1) - (kb.zFrom || 1)) > 0.0005 || kb.panX || kb.panY || Math.abs((kb.zFrom || 1) - 1) > 0.0005));

    if (moves) {
      const z = buildZoomExpr(zooms, kb, headroom, FPS, segDur);
      const { x, y } = buildPanExprs(kb, segDur, FPS);
      chain.push(`zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${W}x${H}:fps=${FPS}`);
    } else {
      // No movement: a straight downscale is sharper and far cheaper.
      chain.push(`scale=${W}:${H}:flags=bicubic`);
    }

    // Exact length, so concat timings stay frame-accurate.
    chain.push(`trim=duration=${segDur}`, 'setpts=PTS-STARTPTS');

    const trans = i > 0 ? transitionAt(edl, seg.start) : null;
    if (trans === 'fade') chain.push('fade=t=in:st=0:d=0.18');
    else if (trans === 'flash') chain.push('fade=t=in:st=0:d=0.10:color=white');

    filters.push(`[${idx}:v]${chain.join(',')}[${label}]`);
    videoLabels.push(label);
  });

  let videoOut;
  if (videoLabels.length === 1) {
    videoOut = videoLabels[0];
  } else {
    filters.push(`${videoLabels.map((l) => `[${l}]`).join('')}concat=n=${videoLabels.length}:v=1:a=0[vcat]`);
    videoOut = 'vcat';
  }

  if (assPath) {
    filters.push(`[${videoOut}]ass='${ff.escapeFilterPath(assPath)}'[vout]`);
    videoOut = 'vout';
  }

  /* --------------------------------------------------------------- audio */

  const audioLabels = [];
  const AFMT = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';

  // -- voice ---------------------------------------------------------------
  const voiceClip = edlLib.byType(edl, 'voice')[0];
  let hasVoice = false;

  if (voiceClip && media.has(voiceClip.source)) {
    const vm = media.get(voiceClip.source);
    if (vm.hasAudio !== false) {
      const ranges = (voiceClip.keepRanges && voiceClip.keepRanges.length)
        ? voiceClip.keepRanges
        : [{ start: 0, end: duration }];

      const parts = [];
      ranges.forEach((r, k) => {
        const len = round(r.end - r.start, 3);
        if (len <= 0.01) return;
        const idx = addInput(['-ss', String(round(r.start, 3)), '-t', String(len), '-i', vm.absPath]);
        const lbl = `a${k}`;
        filters.push(`[${idx}:a]${AFMT},asetpts=PTS-STARTPTS,atrim=duration=${len},asetpts=PTS-STARTPTS[${lbl}]`);
        parts.push(lbl);
      });

      if (parts.length) {
        if (parts.length === 1) {
          filters.push(`[${parts[0]}]anull[voicecat]`);
        } else {
          filters.push(`${parts.map((l) => `[${l}]`).join('')}concat=n=${parts.length}:v=0:a=1[voicecat]`);
        }

        const vGain = levels.voice !== undefined ? levels.voice : (voiceClip.gain ?? 1);
        // apad + atrim pins the bed to exactly the timeline length, so a source
        // that is a few frames short cannot truncate the mix.
        filters.push(
          `[voicecat]volume=${round(clamp(vGain, 0, 3), 3)},apad,atrim=0:${round(duration, 3)},asetpts=PTS-STARTPTS[voice]`
        );
        audioLabels.push('voice');
        hasVoice = true;
      }
    }
  }

  // -- music, side-chained to the voice -------------------------------------
  const musicClip = edlLib.byType(edl, 'music')[0];
  if (musicClip && media.has(musicClip.source)) {
    const mm = media.get(musicClip.source);
    const idx = addInput(['-stream_loop', '-1', '-t', String(round(duration + 1, 3)), '-i', mm.absPath]);
    const gain = levels.music !== undefined ? levels.music : (musicClip.gain ?? 0.16);
    const fadeOutAt = round(Math.max(0.1, duration - 1.5), 3);

    filters.push(
      `[${idx}:a]${AFMT},asetpts=PTS-STARTPTS,apad,atrim=0:${round(duration, 3)},asetpts=PTS-STARTPTS,` +
      `volume=${round(clamp(gain, 0, 2), 3)},` +
      `afade=t=in:st=0:d=1.2,afade=t=out:st=${fadeOutAt}:d=1.5[musicraw]`
    );

    if (musicClip.duck && hasVoice) {
      // The voice is split: one copy feeds the mix, one drives the detector.
      filters.push('[voice]asplit=2[voicemix][voicekey]');
      filters.push('[musicraw][voicekey]sidechaincompress=threshold=0.02:ratio=12:attack=15:release=340:makeup=1[musicducked]');
      audioLabels[audioLabels.indexOf('voice')] = 'voicemix';
      audioLabels.push('musicducked');
    } else {
      audioLabels.push('musicraw');
    }
  }

  // -- sound effects ---------------------------------------------------------
  const sfxClips = edlLib.byType(edl, 'sfx');
  const sfxLabels = [];

  sfxClips.forEach((s, k) => {
    const file = path.join(sfxDir, `${s.sfxName}.wav`);
    const idx = addInput(['-i', file]);
    const delayMs = Math.max(0, Math.round(s.start * 1000));
    const userScale = levels.sfx !== undefined ? levels.sfx / 0.5 : 1;
    const g = round(clamp((s.gain ?? 0.4) * userScale, 0, 1.5), 3);
    const lbl = `s${k}`;
    filters.push(
      `[${idx}:a]${AFMT},volume=${g},adelay=${delayMs}|${delayMs},` +
      `apad,atrim=0:${round(duration, 3)},asetpts=PTS-STARTPTS[${lbl}]`
    );
    sfxLabels.push(lbl);
  });

  if (sfxLabels.length === 1) {
    audioLabels.push(sfxLabels[0]);
  } else if (sfxLabels.length > 1) {
    filters.push(`${sfxLabels.map((l) => `[${l}]`).join('')}amix=inputs=${sfxLabels.length}:duration=longest:normalize=0[sfxmix]`);
    audioLabels.push('sfxmix');
  }

  // -- final mix --------------------------------------------------------------
  let audioOut = null;
  if (audioLabels.length === 1) {
    filters.push(`[${audioLabels[0]}]alimiter=limit=0.97:level=disabled,aresample=48000[aout]`);
    audioOut = 'aout';
  } else if (audioLabels.length > 1) {
    filters.push(
      `${audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:duration=first:normalize=0,` +
      `alimiter=limit=0.97:level=disabled,aresample=48000[aout]`
    );
    audioOut = 'aout';
  }

  /* ------------------------------------------------------------- assembly */

  const args = [];
  for (const input of inputs) args.push(...input);

  args.push('-filter_complex', filters.join(';'));
  args.push('-map', `[${videoOut}]`);
  if (audioOut) args.push('-map', `[${audioOut}]`);

  args.push(
    '-c:v', 'libx264',
    '-preset', target.preset || 'medium',
    '-crf', String(target.crf || 20),
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-level', '4.1',
    '-r', String(FPS),
    '-g', String(FPS * 2),
    '-movflags', '+faststart',
    '-t', String(round(duration, 3))
  );

  if (audioOut) {
    args.push('-c:a', 'aac', '-b:a', target.audioBitrate || '192k', '-ar', '48000', '-ac', '2');
  } else {
    args.push('-an');
  }

  args.push('-y', outPath);

  return {
    args,
    duration,
    segmentCount: segments.length,
    inputCount: inputs.length,
    hasAudio: Boolean(audioOut),
  };
}

module.exports = { build, buildZoomExpr, buildPanExprs, transitionAt };
