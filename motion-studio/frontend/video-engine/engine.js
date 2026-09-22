import { Renderer } from './renderer.js';
import { estimateDepth } from './depth.js';
import { createMotionPath } from './camera.js';
import { resolveParticleLayers } from './effects/particles.js';
import { resolveAtmosphere } from './effects/atmosphere.js';
import { buildLightningSchedule } from './effects/lightning.js';
import { resolveGrade } from './effects/grade.js';
import { createEncoder, planEncoder } from './encoder/encoder.js';
import { PREVIEW, QUALITY_TIERS } from '../config/app.config.js';

/**
 * The engine ties everything together: it owns the renderer, the depth map
 * and the solved motion path, drives the live preview, and runs the export
 * loop.
 *
 * Preview and export share one canvas. During export the canvas's backing
 * store is resized to the full output resolution and the user watches the
 * real frames go by — which is a better progress indicator than a bar.
 */
export class MotionEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);

    this.image = null;
    this.depth = null;
    this.pivot = 0.5;

    this.preset = null;
    this.controls = null;
    this.crop = { x: 0, y: 0, zoom: 1 };
    this.duration = 5;
    this.seed = 1;

    this.path = null;
    this.lightning = null;

    this._raf = 0;
    this._previewStart = 0;
    this.exporting = false;
    this._abort = false;
  }

  /* ----------------------------- inputs ---------------------------- */

  async setImage(bitmap, { onStage } = {}) {
    this.image = bitmap;
    this.renderer.setImage(bitmap);

    onStage && onStage('depth');
    this.depth = await estimateDepth(bitmap);
    this.renderer.setDepth(this.depth.canvas);

    // Anchor the parallax on whatever the subject probably is, so the
    // subject stays put and the rest of the frame moves around it.
    this.pivot = clamp(sampleDepth(this.depth, this.depth.focus), 0.30, 0.85);
    return this.depth;
  }

  setMotion({ preset, controls, duration, seed }) {
    if (preset) this.preset = preset;
    if (controls) this.controls = { ...controls };
    if (duration != null) this.duration = duration;
    if (seed != null) this.seed = seed;
    this._solve();
  }

  /**
   * How far the user may push the reframing before the sampler would run off
   * the edge of the image. Derived from the actual cover scale, so a square
   * image gets more sideways slack than a tall one.
   */
  cropBounds() {
    const cover = this.renderer._coverScale(9, 16);
    const reserve = 0.12;   // headroom for camera pan + depth displacement
    const z = this.crop.zoom || 1;
    return {
      x: Math.max(0, cover.x * 0.5 - 0.5 / z - reserve),
      y: Math.max(0, cover.y * 0.5 - 0.5 / z - reserve),
    };
  }

  setCrop(crop) {
    const zoom = clamp(crop.zoom ?? this.crop.zoom, 1, 3);
    this.crop = { ...this.crop, zoom };
    const b = this.cropBounds();
    this.crop = {
      x: clamp(crop.x ?? this.crop.x, -b.x, b.x),
      y: clamp(crop.y ?? this.crop.y, -b.y, b.y),
      zoom,
    };
    return this.crop;
  }

  _solve() {
    if (!this.preset || !this.controls) return;
    // The path solver needs the preset's *effective* duration, because
    // handheld noise is a function of seconds, not of normalised time.
    const preset = { ...this.preset, duration: this.duration };
    this.path = createMotionPath(preset, this.controls, this.seed);
    this.lightning = buildLightningSchedule(this.preset.lightning, this.duration, this.seed);
  }

  /* ----------------------------- frames ---------------------------- */

  /** Everything the renderer needs to draw one moment of the clip. */
  frameAt(timeSec) {
    const t01 = this.duration > 0 ? clamp(timeSec / this.duration, 0, 1) : 0;
    const camera = this.path.at(t01);
    return {
      camera,
      crop: this.crop,
      pivot: this.pivot,
      atmosphere: resolveAtmosphere(this.preset, this.controls, camera, timeSec),
      particles: resolveParticleLayers(this.preset, this.controls, camera, timeSec),
      grade: resolveGrade(this.preset, this.controls, timeSec, this.lightning, this.seed),
    };
  }

  renderAt(timeSec) {
    if (!this.path || !this.image) return;
    this.renderer.render(this.frameAt(timeSec));
  }

  /* ---------------------------- preview ---------------------------- */

  startPreview() {
    if (this._raf || this.exporting) return;
    this.renderer.resize(PREVIEW.width, PREVIEW.height);
    this._previewStart = performance.now();

    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      if (this.exporting) return;
      const t = ((performance.now() - this._previewStart) / 1000) % this.duration;
      try {
        this.renderAt(t);
      } catch {
        this.stopPreview();   // a lost context should not spin the CPU
      }
    };
    this._raf = requestAnimationFrame(loop);
  }

  stopPreview() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  restartPreview() {
    this._previewStart = performance.now();
  }

  /** Draws a single still at t=0 — used before the preview loop starts. */
  renderPoster() {
    this.renderer.resize(PREVIEW.width, PREVIEW.height);
    this.renderAt(0);
  }

  /* ----------------------------- export ---------------------------- */

  /**
   * Renders the clip and returns a video Blob.
   * @param {object} o
   * @param {number} o.fps
   * @param {string} o.tierId
   * @param {(p:{stage:string, progress:number, frame:number, total:number})=>void} o.onProgress
   */
  async exportVideo({ fps, tierId, onProgress = () => {} }) {
    if (!this.path || !this.image) throw new Error('Nothing to render yet');

    let tier = QUALITY_TIERS.find(t => t.id === tierId) || QUALITY_TIERS[0];
    const total = Math.max(2, Math.round(this.duration * fps));

    this.exporting = true;
    this._abort = false;
    this.stopPreview();

    let encoder = null;
    let encoderKind = 'unknown';
    const previousSize = { w: this.renderer.width, h: this.renderer.height };

    try {
      onProgress({ stage: 'prepare', progress: 0, frame: 0, total });
      this.renderer.resize(tier.width, tier.height);

      // Draw frame 0 before the encoder exists: this forces shader
      // compilation and texture upload to happen outside the timed loop,
      // which matters for the realtime MediaRecorder path.
      this.renderAt(0);

      // A realtime encoder records against the wall clock, so a device that
      // cannot render at the requested frame rate would produce a choppy
      // clip. Measure first and drop a tier rather than ship the stutter.
      // The frame-counted path has no such problem — it just takes longer.
      const plan = await planEncoder();
      if (plan.realtime) {
        tier = this._fitTierToDevice(tier, fps);
        this.renderer.resize(tier.width, tier.height);
        this.renderAt(0);
      }

      onProgress({ stage: 'motion', progress: 0.02, frame: 0, total });

      encoder = await createEncoder({
        width: tier.width,
        height: tier.height,
        fps,
        bitrate: tier.bitrate,
        canvas: this.canvas,
        durationSec: this.duration,
      });
      encoderKind = encoder.kind;

      const frames = encoder.realtime
        ? await this._runRealtimeLoop(encoder, fps, total, onProgress)
        : await this._runExactLoop(encoder, fps, total, onProgress);

      onProgress({ stage: 'finalize', progress: 0.94, frame: total, total });
      const result = await encoder.finish();
      encoder = null;
      onProgress({ stage: 'finalize', progress: 1, frame: total, total });

      return {
        ...result,
        width: tier.width,
        height: tier.height,
        fps,
        duration: this.duration,
        frames,
        encoder: encoderKind,
        tierId: tier.id,
        /** True when the device could not render at the requested frame rate. */
        degraded: frames < total * 0.85,
      };
    } finally {
      if (encoder) encoder.cancel();
      this.exporting = false;
      try { this.renderer.resize(previousSize.w, previousSize.h); } catch { /* disposed */ }
    }
  }

  /**
   * Times a few real frames and steps the resolution down until the device
   * can keep up with the frame budget (or it runs out of tiers).
   */
  _fitTierToDevice(tier, fps) {
    const budgetMs = 1000 / fps;
    for (let step = 0; step < QUALITY_TIERS.length - 1; step++) {
      const ms = this._timeFrames(3);
      if (ms <= budgetMs * 1.35) break;
      const i = QUALITY_TIERS.indexOf(tier);
      if (i < 0 || i >= QUALITY_TIERS.length - 1) break;
      tier = QUALITY_TIERS[i + 1];
      this.renderer.resize(tier.width, tier.height);
    }
    return tier;
  }

  /** Average milliseconds per rendered frame, GPU included. */
  _timeFrames(count) {
    this.renderAt(0);
    this.renderer.finish();          // drain anything already queued
    const t0 = performance.now();
    for (let i = 0; i < count; i++) this.renderAt((i + 1) / 30);
    this.renderer.finish();
    return (performance.now() - t0) / count;
  }

  /**
   * Exact loop, for encoders that accept explicit timestamps (WebCodecs).
   * Every frame lands on its constant-frame-rate slot, whatever the device's
   * rendering speed — a slow phone takes longer, it does not produce a
   * different video.
   */
  async _runExactLoop(encoder, fps, total, onProgress) {
    for (let i = 0; i < total; i++) {
      if (this._abort) throw new Error('Cancelled');
      this.renderAt(i / fps);
      await encoder.addFrame(this.canvas, i);

      if (i % 3 === 0 || i === total - 1) {
        onProgress({ stage: 'encode', progress: 0.05 + 0.85 * ((i + 1) / total), frame: i + 1, total });
        await nextTick();   // let the UI repaint, or the progress bar never moves
      }
    }
    return total;
  }

  /**
   * Wall-clock loop, for MediaRecorder.
   *
   * MediaRecorder timestamps whatever it is handed with the real clock, so
   * the *wall clock* has to drive the animation, not a frame counter. If the
   * renderer can only manage 12 fps, the result is a correct 5-second clip at
   * 12 fps rather than a smooth clip that runs for 68 seconds — which is what
   * a frame-counted loop produces on a slow device.
   */
  async _runRealtimeLoop(encoder, fps, total, onProgress) {
    const startWall = performance.now();
    let i = 0;

    // The recording keeps running while the encoder drains, and the final
    // frame is held for all of it. So capture into a shorter window and
    // stretch clip time across it: the motion still completes, and the held
    // frame fills the clip out to exactly the requested length.
    const tail = () => (encoder.tailSeconds ? encoder.tailSeconds() : 0.2);
    let window = Math.max(0.5, this.duration - tail());

    while (true) {
      if (this._abort) throw new Error('Cancelled');
      const elapsed = (performance.now() - startWall) / 1000;

      // Re-estimate only for the first few frames, then hold it. A window
      // that keeps shrinking as the measured rate drops feeds back on
      // itself and eats the clip.
      if (i < 4) window = Math.max(0.5, this.duration - tail());
      if (elapsed >= window) break;

      this.renderAt(Math.min(this.duration, elapsed * (this.duration / window)));
      await encoder.addFrame(this.canvas, i);
      i++;

      if (i % 3 === 0) {
        onProgress({
          stage: 'encode',
          progress: 0.05 + 0.85 * Math.min(1, elapsed / window),
          frame: i,
          total,
        });
        await nextTick();
      }
    }

    // The frame that gets held: the last one of the move.
    this.renderAt(this.duration);
    await encoder.addFrame(this.canvas, i);
    return i + 1;
  }

  cancelExport() { this._abort = true; }

  dispose() {
    this.stopPreview();
    this.renderer.dispose();
  }
}

function sampleDepth(depth, pt) {
  const x = Math.min(depth.width - 1, Math.max(0, Math.round(pt.x * (depth.width - 1))));
  const y = Math.min(depth.height - 1, Math.max(0, Math.round(pt.y * (depth.height - 1))));
  return depth.data[y * depth.width + x];
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function nextTick() { return new Promise(r => setTimeout(r, 0)); }
