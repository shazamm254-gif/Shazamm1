import { Mp4Muxer } from './mp4-muxer.js';

/**
 * Video export, with a capability-detected chain.
 *
 * On an Android phone the first option almost always wins: Chrome exposes
 * the device's hardware H.264 encoder through WebCodecs, so a 6-second
 * 1080×1920 clip encodes faster than real time and the muxer in this folder
 * wraps it into an MP4. The rest of the chain exists for browsers that don't
 * expose it, and for desktop containers that have no H.264 encoder at all.
 *
 * All encoders share one interface:
 *   await encoder.addFrame(canvas, frameIndex)
 *   const { blob, extension, mimeType } = await encoder.finish()
 */

const H264_CANDIDATES = [
  'avc1.42E02A',   // baseline, level 4.2  — widest hardware support
  'avc1.4D402A',   // main
  'avc1.640029',   // high, level 4.1
  'avc1.42001F',
];

const VP9_CANDIDATES = ['vp09.00.41.08', 'vp09.00.10.08'];

/**
 * Force a specific encoder with `?encoder=` in the URL. Useful when a
 * device's H.264 encoder is present but broken, and it is how the test suite
 * exercises the WebCodecs path on machines with no H.264 encoder at all.
 *
 *   ?encoder=webcodecs-avc1 | webcodecs-vp9 | mediarecorder-mp4 | mediarecorder-webm
 */
export function encoderOverride() {
  try {
    const v = new URL(location.href).searchParams.get('encoder');
    return ['webcodecs-avc1', 'webcodecs-vp9', 'mediarecorder-mp4', 'mediarecorder-webm']
      .includes(v) ? v : null;
  } catch {
    return null;
  }
}

/** What this browser can actually do. Cheap, cached per page load. */
let capabilityCache = null;

export async function detectCapabilities() {
  if (capabilityCache) return capabilityCache;

  const caps = {
    webcodecs: typeof VideoEncoder !== 'undefined',
    h264: null,
    vp9: null,
    mediaRecorderMp4: false,
    mediaRecorderWebm: false,
  };

  if (typeof MediaRecorder !== 'undefined') {
    caps.mediaRecorderMp4 =
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E') ||
      MediaRecorder.isTypeSupported('video/mp4');
    caps.mediaRecorderWebm =
      MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ||
      MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ||
      MediaRecorder.isTypeSupported('video/webm');
  }

  if (caps.webcodecs) {
    // Probe at a real export size: some devices support avc1 at 720p only.
    caps.h264 = await firstSupported(H264_CANDIDATES, 1080, 1920);
    if (!caps.h264) caps.h264 = await firstSupported(H264_CANDIDATES, 720, 1280);
    caps.vp9 = await firstSupported(VP9_CANDIDATES, 1080, 1920);
  }

  capabilityCache = caps;
  return caps;
}

async function firstSupported(codecs, width, height) {
  for (const codec of codecs) {
    try {
      const res = await VideoEncoder.isConfigSupported({
        codec, width, height, bitrate: 8_000_000, framerate: 30,
      });
      if (res && res.supported) return res.config.codec || codec;
    } catch { /* unsupported codec strings throw; keep looking */ }
  }
  return null;
}

/**
 * Which encoder will be used, without building it. The engine needs this
 * before it starts, because a realtime encoder changes how the export loop
 * runs and whether the resolution is worth stepping down.
 */
export async function planEncoder() {
  const caps = await detectCapabilities();
  const forced = encoderOverride();
  if (forced && isAvailable(forced, caps)) {
    return {
      kind: forced,
      realtime: forced.startsWith('mediarecorder'),
      container: forced === 'mediarecorder-webm' ? 'webm' : 'mp4',
    };
  }
  if (caps.webcodecs && caps.h264) return { kind: 'webcodecs-avc1', realtime: false, container: 'mp4' };
  if (caps.mediaRecorderMp4) return { kind: 'mediarecorder-mp4', realtime: true, container: 'mp4' };
  if (caps.webcodecs && caps.vp9) return { kind: 'webcodecs-vp09', realtime: false, container: 'mp4' };
  if (caps.mediaRecorderWebm) return { kind: 'mediarecorder-webm', realtime: true, container: 'webm' };
  return { kind: 'none', realtime: false, container: null };
}

/**
 * Picks and builds the best available encoder.
 * @returns {Promise<{kind:string, label:string, extension:string, addFrame:Function, finish:Function, cancel:Function, realtime:boolean}>}
 */
function isAvailable(kind, caps) {
  if (kind === 'webcodecs-avc1') return !!(caps.webcodecs && caps.h264);
  if (kind === 'webcodecs-vp9') return !!(caps.webcodecs && caps.vp9);
  if (kind === 'mediarecorder-mp4') return caps.mediaRecorderMp4;
  if (kind === 'mediarecorder-webm') return caps.mediaRecorderWebm;
  return false;
}

export async function createEncoder({ width, height, fps, bitrate, canvas, durationSec = 5 }) {
  const caps = await detectCapabilities();

  const forced = encoderOverride();
  if (forced && isAvailable(forced, caps)) {
    if (forced === 'webcodecs-avc1') {
      return createWebCodecsEncoder({ width, height, fps, bitrate, codec: caps.h264, container: 'avc1' });
    }
    if (forced === 'webcodecs-vp9') {
      return createWebCodecsEncoder({ width, height, fps, bitrate, codec: caps.vp9, container: 'vp09' });
    }
    if (forced === 'mediarecorder-mp4') {
      return createMediaRecorderEncoder({ canvas, fps, bitrate, durationSec, mime: pickMp4Mime(), extension: 'mp4' });
    }
    return createMediaRecorderEncoder({ canvas, fps, bitrate, durationSec, mime: pickWebmMime(), extension: 'webm' });
  }

  if (caps.webcodecs && caps.h264) {
    return createWebCodecsEncoder({
      width, height, fps, bitrate,
      codec: caps.h264, container: 'avc1',
    });
  }
  if (caps.mediaRecorderMp4) {
    return createMediaRecorderEncoder({ canvas, fps, bitrate, durationSec, mime: pickMp4Mime(), extension: 'mp4' });
  }
  if (caps.webcodecs && caps.vp9) {
    return createWebCodecsEncoder({
      width, height, fps, bitrate,
      codec: caps.vp9, container: 'vp09',
    });
  }
  if (caps.mediaRecorderWebm) {
    return createMediaRecorderEncoder({ canvas, fps, bitrate, durationSec, mime: pickWebmMime(), extension: 'webm' });
  }
  throw new Error('This browser cannot encode video. Try Chrome for Android.');
}

function pickMp4Mime() {
  for (const m of ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/mp4';
}

function pickWebmMime() {
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm';
}

/* ------------------------------------------------------------------ */
/* WebCodecs: deterministic, constant frame rate, faster than realtime */
/* ------------------------------------------------------------------ */

function createWebCodecsEncoder({ width, height, fps, bitrate, codec, container }) {
  const frameDurationUs = Math.round(1_000_000 / fps);
  const muxer = new Mp4Muxer({ width, height, codec: container, codecString: codec });

  let failure = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (meta && meta.decoderConfig && meta.decoderConfig.description) {
        muxer.setDescription(meta.decoderConfig.description);
      }
      muxer.addChunk(chunk);
    },
    error: (e) => { failure = e; },
  });

  const config = {
    codec, width, height, bitrate,
    framerate: fps,
    latencyMode: 'quality',
    bitrateMode: 'variable',
  };
  // Ask for length-prefixed NAL units so the avcC record arrives in the
  // metadata instead of being buried in the bitstream as Annex-B.
  if (container === 'avc1') config.avc = { format: 'avc' };

  encoder.configure(config);

  // A keyframe every ~2s keeps seeking snappy on a phone without wasting bits.
  const keyEvery = Math.max(1, Math.round(fps * 2));

  return {
    kind: `webcodecs-${container}`,
    label: container === 'avc1' ? 'H.264 / MP4' : 'VP9 / MP4',
    extension: 'mp4',
    mimeType: 'video/mp4',
    realtime: false,

    async addFrame(canvas, index) {
      if (failure) throw failure;
      const frame = new VideoFrame(canvas, {
        timestamp: index * frameDurationUs,
        duration: frameDurationUs,
      });
      encoder.encode(frame, { keyFrame: index % keyEvery === 0 });
      frame.close();
      // Don't let the queue grow without bound on a slow device.
      if (encoder.encodeQueueSize > 8) {
        await new Promise(r => {
          const tick = () => (encoder.encodeQueueSize <= 4 ? r() : setTimeout(tick, 4));
          tick();
        });
      }
    },

    async finish() {
      if (failure) throw failure;
      await encoder.flush();
      encoder.close();
      if (failure) throw failure;
      const blob = muxer.finalize({ defaultFrameDurationUs: frameDurationUs });
      return { blob, extension: 'mp4', mimeType: 'video/mp4' };
    },

    cancel() {
      try { if (encoder.state !== 'closed') encoder.close(); } catch { /* already gone */ }
    },
  };
}

/* ------------------------------------------------------------------ */
/* MediaRecorder: paced to real time, used when WebCodecs can't encode */
/* ------------------------------------------------------------------ */

function createMediaRecorderEncoder({ canvas, fps, bitrate, durationSec, mime, extension }) {
  // captureStream(0) means "only the frames I explicitly request", which lets
  // the render loop stay in charge of timing.
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const chunks = [];

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: bitrate,
  });
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = (e) => reject(e.error || new Error('MediaRecorder failed'));
  });

  recorder.start();
  const started = performance.now();
  const frameMs = 1000 / fps;

  let framesRequested = 0;
  let lastFrameAt = started;

  /**
   * How long to wait for the encoder to catch up before stopping. A device
   * capturing at the requested rate needs a couple of frame intervals; one
   * that is running behind needs proportionally longer, capped so a broken
   * encoder can't hang the app.
   */
  function drainMs() {
    const elapsed = Math.max(1, lastFrameAt - started);
    const achievedFps = (framesRequested * 1000) / elapsed;
    const behind = Math.max(1, fps / Math.max(0.5, achievedFps));
    // Capped hard: the render loop shortens its capture window by exactly
    // this much, so an unbounded estimate would eat the clip.
    const ceiling = Math.min(1200, durationSec * 1000 * 0.25);
    return Math.min(ceiling, Math.max(160, frameMs * 2 * behind));
  }

  return {
    kind: `mediarecorder-${extension}`,
    label: extension === 'mp4' ? 'H.264 / MP4' : 'VP9 / WebM',
    extension,
    mimeType: mime.split(';')[0],
    realtime: true,

    /**
     * Seconds the recording will keep running after the last frame is
     * handed over. The last frame is held on screen for that whole time, so
     * the render loop has to finish this much *early* to land on the
     * requested clip length.
     */
    tailSeconds() { return drainMs() / 1000; },

    async addFrame(_canvas, index) {
      // MediaRecorder stamps frames by the wall clock, so the frame is
      // captured first and the pacing happens afterwards. If the renderer
      // has fallen behind real time there is nothing to wait for — the
      // caller's time-driven loop will simply emit fewer frames, which
      // costs smoothness but keeps the clip the right length.
      if (typeof track.requestFrame === 'function') track.requestFrame();
      else if (typeof stream.requestFrame === 'function') stream.requestFrame();
      framesRequested++;
      lastFrameAt = performance.now();

      const nextDue = started + (index + 1) * frameMs;
      const wait = nextDue - performance.now();
      if (wait > 1) await new Promise(r => setTimeout(r, wait));
    },

    async finish() {
      // MediaRecorder throws away anything still queued when it is stopped,
      // so on a device whose encoder runs behind the capture the tail of the
      // clip would simply vanish. Give it time to drain, scaled by how far
      // behind it appears to be.
      await new Promise(r => setTimeout(r, drainMs()));
      recorder.stop();
      await stopped;
      track.stop();
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      if (!blob.size) throw new Error('The recorder produced an empty file');
      return { blob, extension, mimeType: mime.split(';')[0] };
    },

    cancel() {
      try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* fine */ }
      try { track.stop(); } catch { /* fine */ }
    },
  };
}
