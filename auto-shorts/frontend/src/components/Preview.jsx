import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  visualProgram, segmentAt, scaleAt, panAt, captionAt, byType,
  voiceSourceTime, duration as edlDuration, fmtTime,
} from '../lib/edl.js';
import { api } from '../api.js';

/**
 * Real-time 9:16 preview.
 *
 * Rather than waiting on a render to see the edit, this interprets the EDL
 * directly every animation frame: it picks the segment on screen, draws it
 * cover-cropped to 9:16 with the same zoom curve the renderer uses, paints the
 * captions from the same style definition, drives the voice track through the
 * cut plan, and schedules the sound effects through WebAudio.
 *
 * It shares its maths with the renderer (see lib/edl.js), so what plays here is
 * what the MP4 contains. The differences are honest and small: the browser
 * cannot reproduce libass's exact glyph metrics or the side-chain compressor,
 * so caption line breaks can differ by a word on rare cards and the music
 * ducking is approximated with a gain envelope.
 */
export default function Preview({ project, edl, styleDetail, currentTime, onTimeChange, onDurationChange }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const mediaRef = useRef(new Map());       // mediaId -> HTMLVideoElement | HTMLImageElement
  const voiceRef = useRef(null);
  const musicRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sfxBuffersRef = useRef(new Map());
  const rafRef = useRef(0);
  const clockRef = useRef({ playing: false, t: 0, wallStart: 0, mediaStart: 0 });
  const firedSfxRef = useRef(new Set());

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const total = useMemo(() => edlDuration(edl), [edl]);
  const segments = useMemo(() => visualProgram(edl), [edl]);
  const voiceClip = useMemo(() => byType(edl, 'voice')[0] || null, [edl]);
  const musicClip = useMemo(() => byType(edl, 'music')[0] || null, [edl]);
  const sfxClips = useMemo(() => byType(edl, 'sfx'), [edl]);
  const mediaIndex = useMemo(
    () => new Map((project?.media || []).map((m) => [m.id, m])),
    [project]
  );

  useEffect(() => { if (onDurationChange) onDurationChange(total); }, [total, onDurationChange]);

  /* ------------------------------------------------ load the media elements */

  useEffect(() => {
    let cancelled = false;
    const elements = mediaRef.current;
    const needed = new Set(segments.map((s) => s.source).filter(Boolean));

    const loads = [];
    for (const id of needed) {
      if (elements.has(id)) continue;
      const m = mediaIndex.get(id);
      if (!m) continue;

      if (m.kind === 'image') {
        const img = new Image();
        img.src = m.proxyUrl || m.url;
        elements.set(id, img);
        loads.push(new Promise((res) => {
          img.onload = res;
          img.onerror = () => res();
        }));
      } else {
        const v = document.createElement('video');
        v.src = m.proxyUrl || m.url;
        v.muted = true;                 // the voice track carries the audio
        v.playsInline = true;
        v.preload = 'auto';
        v.crossOrigin = 'anonymous';
        elements.set(id, v);
        loads.push(new Promise((res) => {
          v.onloadeddata = res;
          v.onerror = () => {
            // Say so rather than showing a silent black frame. The export is
            // unaffected — this only means the browser cannot decode the proxy.
            setLoadError(
              `This browser could not decode "${m.filename}" for preview. `
              + 'The export is unaffected; try Chrome, Firefox or Safari if you need the live preview.'
            );
            res();
          };
          setTimeout(res, 8000);        // never hang the preview on one file
        }));
      }
    }

    // Voice: hidden element driven through the cut plan.
    if (voiceClip && mediaIndex.has(voiceClip.source)) {
      const vm = mediaIndex.get(voiceClip.source);
      if (!voiceRef.current || voiceRef.current.dataset.mediaId !== vm.id) {
        const el = document.createElement(vm.kind === 'video' ? 'video' : 'audio');
        el.src = vm.proxyUrl || vm.url;
        el.preload = 'auto';
        el.dataset.mediaId = vm.id;
        el.playsInline = true;
        voiceRef.current = el;
        loads.push(new Promise((res) => {
          el.oncanplay = res;
          el.onerror = () => res();
          setTimeout(res, 8000);
        }));
      }
    } else {
      voiceRef.current = null;
    }

    if (musicClip && mediaIndex.has(musicClip.source)) {
      const mm = mediaIndex.get(musicClip.source);
      if (!musicRef.current || musicRef.current.dataset.mediaId !== mm.id) {
        const el = document.createElement('audio');
        el.src = mm.proxyUrl || mm.url;
        el.loop = true;
        el.preload = 'auto';
        el.dataset.mediaId = mm.id;
        musicRef.current = el;
      }
    } else {
      musicRef.current = null;
    }

    Promise.all(loads).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [segments, mediaIndex, voiceClip, musicClip]);

  /* ------------------------------------------------------ sound effects */

  useEffect(() => {
    const names = Array.from(new Set(sfxClips.map((s) => s.sfxName)));
    if (!names.length) return;

    let cancelled = false;
    (async () => {
      try {
        if (!audioCtxRef.current) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;                   // no WebAudio: preview stays silent on SFX
          audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current;
        for (const name of names) {
          if (sfxBuffersRef.current.has(name)) continue;
          const res = await fetch(api.sfxUrl(name));
          if (!res.ok) continue;
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          if (cancelled) return;
          sfxBuffersRef.current.set(name, buf);
        }
      } catch (_) {
        // A failed effect preload must never break playback of the picture.
      }
    })();
    return () => { cancelled = true; };
  }, [sfxClips]);

  const playSfx = useCallback((clip) => {
    const ctx = audioCtxRef.current;
    const buf = sfxBuffersRef.current.get(clip.sfxName);
    if (!ctx || !buf || muted) return;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const level = (clip.gain ?? 0.4) * ((project?.settings?.levels?.sfx ?? 0.5) / 0.5);
    gain.gain.value = Math.max(0, Math.min(1.5, level));
    src.buffer = buf;
    src.playbackRate.value = speed;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }, [muted, speed, project]);

  /* --------------------------------------------------------- the drawing */

  const draw = useCallback((t) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const seg = segmentAt(segments, t);
    if (seg) {
      const el = mediaRef.current.get(seg.source);
      if (el) {
        const sw = el.videoWidth || el.naturalWidth || 0;
        const sh = el.videoHeight || el.naturalHeight || 0;
        if (sw && sh) {
          const scale = scaleAt(edl, seg, t);
          const pan = panAt(seg, t);

          // Cover-crop to 9:16, then apply the camera scale — the same order
          // the render's scale/crop/zoompan chain uses.
          const cover = Math.max(W / sw, H / sh) * scale;
          const dw = sw * cover;
          const dh = sh * cover;
          const dx = (W - dw) / 2 + pan.x * W;
          const dy = (H - dh) / 2 + pan.y * H;

          try {
            ctx.drawImage(el, dx, dy, dw, dh);
          } catch (_) {
            // A frame that is not decodable yet: leave the previous one up.
          }
        }
      }
    }

    const caption = captionAt(edl, t);
    if (caption) drawCaption(ctx, caption, t, styleDetail, W, H);
  }, [edl, segments, styleDetail]);

  /* ------------------------------------------------------ transport */

  /** Put every media element where it belongs for time t. */
  const syncMedia = useCallback((t, isPlaying) => {
    const seg = segmentAt(segments, t);

    for (const [mediaId, el] of mediaRef.current) {
      if (!(el instanceof HTMLVideoElement)) continue;
      const isCurrent = seg && seg.source === mediaId;
      if (!isCurrent) {
        if (!el.paused) el.pause();
        continue;
      }
      const want = (seg.sourceIn || 0) + (t - seg.start);
      if (Math.abs(el.currentTime - want) > 0.22) {
        try { el.currentTime = Math.max(0, want); } catch (_) { /* seeking */ }
      }
      el.playbackRate = speed;
      if (isPlaying && el.paused) el.play().catch(() => {});
      if (!isPlaying && !el.paused) el.pause();
    }

    const voice = voiceRef.current;
    if (voice) {
      const want = voiceSourceTime(voiceClip, t);
      if (Math.abs(voice.currentTime - want) > 0.24) {
        try { voice.currentTime = Math.max(0, want); } catch (_) { /* seeking */ }
      }
      voice.playbackRate = speed;
      voice.volume = muted ? 0 : Math.min(1, project?.settings?.levels?.voice ?? 1);
      if (isPlaying && voice.paused) voice.play().catch(() => {});
      if (!isPlaying && !voice.paused) voice.pause();
    }

    const music = musicRef.current;
    if (music) {
      // Approximate the render's side-chain duck: drop the bed while a caption
      // is on screen, which is where the voice is.
      const speaking = Boolean(captionAt(edl, t));
      const base = musicClip?.gain ?? project?.settings?.levels?.music ?? 0.16;
      music.volume = muted ? 0 : Math.max(0, Math.min(1, speaking ? base * 0.45 : base));
      music.playbackRate = speed;
      if (isPlaying && music.paused) music.play().catch(() => {});
      if (!isPlaying && !music.paused) music.pause();
    }
  }, [segments, voiceClip, musicClip, speed, muted, project, edl]);

  // The animation loop. The clock is wall-time based rather than driven by a
  // media element, because the picture is stitched from many sources.
  useEffect(() => {
    const tick = () => {
      const clock = clockRef.current;

      if (clock.playing) {
        const elapsed = (performance.now() - clock.wallStart) / 1000 * speed;
        let t = clock.mediaStart + elapsed;

        if (t >= total) {
          t = total;
          clock.playing = false;
          setPlaying(false);
          syncMedia(t, false);
        }
        clock.t = t;
        if (onTimeChange) onTimeChange(t);

        for (const s of sfxClips) {
          if (!firedSfxRef.current.has(s.id) && t >= s.start && t < s.start + 0.35) {
            firedSfxRef.current.add(s.id);
            playSfx(s);
          }
        }
        syncMedia(t, true);
      }

      draw(clock.t);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, syncMedia, total, speed, sfxClips, playSfx, onTimeChange]);

  // Seeks driven from outside (timeline click, clip select).
  useEffect(() => {
    const clock = clockRef.current;
    if (Math.abs(clock.t - currentTime) < 0.02) return;
    clock.t = currentTime;
    clock.mediaStart = currentTime;
    clock.wallStart = performance.now();
    firedSfxRef.current = new Set(sfxClips.filter((s) => s.start < currentTime).map((s) => s.id));
    syncMedia(currentTime, clock.playing);
  }, [currentTime, syncMedia, sfxClips]);

  const togglePlay = useCallback(async () => {
    const clock = clockRef.current;
    if (clock.playing) {
      clock.playing = false;
      setPlaying(false);
      syncMedia(clock.t, false);
      return;
    }
    // Browsers require a user gesture before audio can start.
    if (audioCtxRef.current?.state === 'suspended') {
      try { await audioCtxRef.current.resume(); } catch (_) { /* ignore */ }
    }
    if (clock.t >= total - 0.05) {
      clock.t = 0;
      firedSfxRef.current = new Set();
      if (onTimeChange) onTimeChange(0);
    }
    clock.mediaStart = clock.t;
    clock.wallStart = performance.now();
    clock.playing = true;
    setPlaying(true);
    syncMedia(clock.t, true);
  }, [total, syncMedia, onTimeChange]);

  // Space to play/pause, arrows to nudge — as long as focus is not in a field.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onTimeChange(Math.min(total, clockRef.current.t + (e.shiftKey ? 1 : 1 / 30)));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onTimeChange(Math.max(0, clockRef.current.t - (e.shiftKey ? 1 : 1 / 30)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, total, onTimeChange]);

  useEffect(() => () => {
    for (const el of mediaRef.current.values()) {
      if (el instanceof HTMLVideoElement) { el.pause(); el.src = ''; }
    }
    voiceRef.current?.pause();
    musicRef.current?.pause();
    audioCtxRef.current?.close().catch(() => {});
  }, []);

  const goFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => setLoadError('Fullscreen was blocked by the browser.'));
  };

  const hasEdit = Boolean(edl && edl.timeline?.length);

  return (
    <div className="preview">
      <div className="preview-stage" ref={wrapRef}>
        <canvas ref={canvasRef} width={540} height={960} className="preview-canvas" />
        {!hasEdit && (
          <div className="preview-empty">
            <div className="preview-empty-inner">
              <strong>Nothing to preview yet</strong>
              <span>Upload your footage, then press AUTO EDIT.</span>
            </div>
          </div>
        )}
        {hasEdit && !ready && <div className="preview-loading">Loading media…</div>}
      </div>

      <div className="preview-scrub">
        <input
          type="range"
          min={0}
          max={Math.max(0.1, total)}
          step={0.01}
          value={Math.min(currentTime, total)}
          onChange={(e) => onTimeChange(parseFloat(e.target.value))}
          aria-label="Scrub"
        />
      </div>

      <div className="preview-controls">
        <button className="btn btn-play" onClick={togglePlay} disabled={!hasEdit} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="preview-time">
          {fmtTime(currentTime, true)} <span className="muted">/ {fmtTime(total)}</span>
        </span>
        <div className="preview-controls-right">
          <button className={`btn btn-ghost btn-sm ${muted ? 'is-on' : ''}`} onClick={() => setMuted((m) => !m)}>
            {muted ? 'Muted' : 'Sound'}
          </button>
          <select className="select select-sm" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} aria-label="Playback speed">
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={1.5}>1.5×</option>
            <option value={2}>2×</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={goFullscreen}>Full</button>
        </div>
      </div>
      {loadError && <p className="preview-note">{loadError}</p>}
    </div>
  );
}

/* -------------------------------------------------------- caption painting */

/**
 * Paint one caption card.
 *
 * Mirrors captions/ass.js: the same wrap budget, the same safe-area margin, the
 * same per-word reveal for kinetic styles, and the same emphasis treatment.
 */
function drawCaption(ctx, caption, t, styleDetail, W, H) {
  const style = styleDetail?.[caption.style] || styleDetail?.kinetic;
  if (!style) return;

  const k = H / 1920;                       // canvas is a scaled 1080x1920 frame
  const fontSize = style.fontSize * k;
  const marginH = (style.marginH || 81) * k;
  const marginV = (style.marginV || 480) * k;
  const lineHeight = fontSize * 1.16 + (style.lineSpacing || 0) * k;

  ctx.font = `${style.bold ? '700' : '400'} ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const words = caption.words || [];
  if (!words.length) return;

  // Wrap using the same character budget the ASS writer uses.
  const lines = [];
  let cur = [];
  let curLen = 0;
  for (let i = 0; i < words.length; i++) {
    const len = words[i].word.length;
    const candidate = curLen === 0 ? len : curLen + 1 + len;
    if (cur.length && candidate > style.maxCharsPerLine && lines.length < style.maxLines - 1) {
      lines.push(cur);
      cur = [i];
      curLen = len;
    } else {
      cur.push(i);
      curLen = candidate;
    }
  }
  if (cur.length) lines.push(cur);

  const blockHeight = lines.length * lineHeight;
  const baselineStart = H - marginV - blockHeight + lineHeight * 0.82;

  // Card entrance animation, matching the ASS \fad + \fsc timings.
  const age = t - caption.start;
  const remaining = caption.end - t;
  let cardAlpha = 1;
  let cardScale = 1;
  let cardOffsetY = 0;

  if (style.animation === 'pop') {
    cardScale = age < 0.12 ? 0.78 + (0.26 * age) / 0.12 : age < 0.19 ? 1.04 - (0.04 * (age - 0.12)) / 0.07 : 1;
  } else if (style.animation === 'slide') {
    cardOffsetY = age < 0.17 ? 46 * k * (1 - age / 0.17) : 0;
  }
  if (age < 0.09) cardAlpha = age / 0.09;
  if (remaining < 0.09) cardAlpha = Math.max(0, remaining / 0.09);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, cardAlpha));
  ctx.translate(W / 2, baselineStart + cardOffsetY);
  ctx.scale(cardScale, cardScale);
  ctx.translate(-W / 2, -baselineStart);

  lines.forEach((lineIdx, li) => {
    const y = baselineStart + li * lineHeight;

    const widths = lineIdx.map((i) => {
      const w = words[i];
      const emphScale = emphasisScaleFor(w, style, t);
      ctx.font = fontFor(style, fontSize, emphScale, w);
      return ctx.measureText(w.word).width;
    });
    const spaceWidth = ctx.measureText(' ').width;
    const totalWidth = widths.reduce((a, b) => a + b, 0) + spaceWidth * (lineIdx.length - 1);

    let x = (W - totalWidth) / 2;
    // Never let a long line escape the safe area.
    if (x < marginH) x = marginH;

    lineIdx.forEach((i, n) => {
      const w = words[i];
      const spoken = t >= w.start;
      const emphScale = emphasisScaleFor(w, style, t);
      ctx.font = fontFor(style, fontSize, emphScale, w);

      const dim = style.dimUnspoken && !spoken;
      const landing = spoken && t - w.start < 0.18 && style.wordByWord;
      const landScale = landing ? 0.62 + (0.44 * (t - w.start)) / 0.18 : 1;

      const colour = w.emphasis && (style.emphasis === 'color' || style.emphasis === 'scale-color')
        ? style.accent
        : style.primary;

      ctx.save();
      if (landScale !== 1) {
        const cx = x + widths[n] / 2;
        ctx.translate(cx, y);
        ctx.scale(landScale, landScale);
        ctx.translate(-cx, -y);
      }
      ctx.globalAlpha = (dim ? 0.45 : 1) * Math.max(0, Math.min(1, cardAlpha));

      if (style.boxed) {
        ctx.fillStyle = hexToRgba(style.boxColor || '#000000', 1 - (style.boxAlpha ?? 0.25));
        ctx.fillRect(x - 10 * k, y - fontSize * 0.86, widths[n] + 20 * k, fontSize * 1.18);
      } else if (style.outlineWidth) {
        ctx.lineWidth = style.outlineWidth * k * 2;
        ctx.strokeStyle = style.outline;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(w.word, x, y);
      }

      if (style.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = style.shadow * k * 2;
        ctx.shadowOffsetY = style.shadow * k;
      }
      ctx.fillStyle = colour;
      ctx.fillText(w.word, x, y);
      ctx.restore();

      x += widths[n] + spaceWidth;
    });
  });

  ctx.restore();
}

function emphasisScaleFor(word, style, t) {
  if (!word.emphasis) return 1;
  if (style.emphasis === 'color') return 1;
  const strength = word.emphasis === 'strong' ? 1 : 0.55;
  return 1 + (style.emphasisScale - 1) * strength;
}

function fontFor(style, fontSize, emphScale, word) {
  const weight = style.bold || (word.emphasis && style.emphasis === 'weight') ? '700' : '400';
  return `${weight} ${fontSize * emphScale}px "Helvetica Neue", Arial, sans-serif`;
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
