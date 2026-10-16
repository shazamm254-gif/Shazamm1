'use strict';
/**
 * Turns an arbitrary uploaded file into a normalized media descriptor the rest
 * of the app can reason about, and builds the cheap derivatives (thumbnail +
 * low-resolution proxy) that keep the editor responsive.
 */

const fs = require('fs');
const path = require('path');
const ff = require('./ffmpeg');
const { E } = require('../utils/errors');
const { round } = require('../utils');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff', '.gif', '.avif']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.wma']);

/**
 * Classify + measure a media file.
 * kindHint lets the UI say "this upload is music" or "this is the voiceover".
 */
async function inspect(filePath, kindHint = null) {
  const ext = path.extname(filePath).toLowerCase();
  const info = await ff.probe(filePath);
  const streams = info.streams || [];
  const format = info.format || {};

  const videoStream = streams.find((s) => s.codec_type === 'video');
  const audioStream = streams.find((s) => s.codec_type === 'audio');

  // A single-frame "video" stream (mjpeg/png/webp) is really a still image.
  const isStillCodec = videoStream && ['mjpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'].includes(videoStream.codec_name);
  const frameCount = videoStream ? parseInt(videoStream.nb_frames || '0', 10) : 0;
  const animatedGif = videoStream && videoStream.codec_name === 'gif' && frameCount > 1;

  let kind;
  if (!videoStream && audioStream) {
    kind = kindHint === 'music' || kindHint === 'sfx' ? kindHint : 'audio';
  } else if (videoStream && (IMAGE_EXT.has(ext) || isStillCodec) && !animatedGif) {
    kind = 'image';
  } else if (videoStream) {
    kind = 'video';
  } else {
    throw E.unsupportedMedia(path.basename(filePath), 'The file contains neither a video nor an audio stream.');
  }

  // Images report no meaningful duration; give them a nominal one.
  let duration = parseFloat(format.duration || (videoStream && videoStream.duration) || (audioStream && audioStream.duration) || '0');
  if (!isFinite(duration) || duration <= 0) duration = kind === 'image' ? 0 : 0;

  let fps = 0;
  if (videoStream && videoStream.r_frame_rate) {
    const [n, d] = videoStream.r_frame_rate.split('/').map(Number);
    if (d) fps = n / d;
  }

  // Rotation metadata matters: a phone-shot vertical clip is often stored
  // landscape with a 90 degree side-data rotation.
  let rotation = 0;
  if (videoStream) {
    const sd = (videoStream.side_data_list || []).find((x) => x.rotation !== undefined);
    if (sd) rotation = Math.abs(parseInt(sd.rotation, 10)) % 180;
    else if (videoStream.tags && videoStream.tags.rotate) rotation = Math.abs(parseInt(videoStream.tags.rotate, 10)) % 180;
  }

  let width = videoStream ? (videoStream.width || 0) : 0;
  let height = videoStream ? (videoStream.height || 0) : 0;
  if (rotation === 90) { const t = width; width = height; height = t; }

  return {
    kind,
    duration: round(duration, 3),
    width,
    height,
    fps: round(fps, 3),
    hasAudio: Boolean(audioStream),
    audioChannels: audioStream ? (audioStream.channels || 0) : 0,
    audioSampleRate: audioStream ? parseInt(audioStream.sample_rate || '0', 10) : 0,
    videoCodec: videoStream ? videoStream.codec_name : null,
    audioCodec: audioStream ? audioStream.codec_name : null,
    sizeBytes: parseInt(format.size || '0', 10) || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0),
    animated: Boolean(animatedGif),
  };
}

/**
 * "Fit inside a box, keep the aspect ratio, keep both sides even."
 *
 * Note the explicit width and height: `-2` cannot be combined with
 * force_original_aspect_ratio — FFmpeg rejects the filter and writes a
 * zero-byte file — so the box is given in full and force_divisible_by handles
 * the even-dimension requirement that yuv420p imposes.
 */
function fitBox(w, h) {
  return `scale=w=${w}:h=${h}:force_original_aspect_ratio=decrease:force_divisible_by=2`;
}

/** Small JPEG poster used by the media library and timeline. */
async function makeThumbnail(srcPath, outPath, { atSecond = null, width = 320 } = {}) {
  const args = [];
  if (atSecond !== null && atSecond > 0) args.push('-ss', String(atSecond));
  args.push('-i', srcPath, '-frames:v', '1',
    '-vf', fitBox(width, width * 4),
    '-q:v', '4', '-y', outPath);
  await ff.run(args, { stage: 'thumbnail' });
  return outPath;
}

/**
 * Low-resolution proxy for the editor.
 *
 * VP8 + Opus in WebM rather than H.264 + AAC. Exports are H.264 MP4 as the
 * platforms require, but the *proxy* only ever has to satisfy a browser, and
 * H.264/AAC are patent-encumbered: open-source Chromium builds ship without
 * them, so an MP4 proxy plays as a black rectangle there. VP8 and Opus are
 * royalty-free and decode in every current browser, so the preview works
 * everywhere. Encoding at "realtime/cpu-used 8" runs several times faster than
 * playback, which keeps the cost invisible during upload.
 */
async function makeProxy(srcPath, outPath, { height = 480, fps = 30 } = {}) {
  const args = [
    '-i', srcPath,
    '-vf', `${fitBox(Math.round((height * 16) / 9), height)},fps=${fps}`,
    '-c:v', 'libvpx', '-b:v', '900k', '-deadline', 'realtime', '-cpu-used', '8',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'libopus', '-b:a', '96k', '-ac', '2',
    '-y', outPath,
  ];
  await ff.run(args, { stage: 'proxy' });
  return outPath;
}

/** Audio-only proxy so the preview player has something light to fetch. */
async function makeAudioProxy(srcPath, outPath) {
  await ff.run([
    '-i', srcPath, '-vn',
    '-c:a', 'libopus', '-b:a', '96k', '-ac', '2',
    '-y', outPath,
  ], { stage: 'audio proxy' });
  return outPath;
}

/** Web-safe still (browsers cannot decode tiff/avif reliably). */
async function makeWebImage(srcPath, outPath, { width = 1080 } = {}) {
  await ff.run([
    '-i', srcPath, '-frames:v', '1',
    '-vf', fitBox(width, width * 4),
    '-q:v', '3', '-y', outPath,
  ], { stage: 'image conversion' });
  return outPath;
}

module.exports = {
  inspect, makeThumbnail, makeProxy, makeAudioProxy, makeWebImage,
  fitBox, IMAGE_EXT, AUDIO_EXT,
};
