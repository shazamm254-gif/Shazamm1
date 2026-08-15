'use strict';
/**
 * Structured errors. Every failure surfaced to the user carries three fields:
 * what happened, why it happened, and how to fix it. The UI renders all three,
 * so nothing ever fails silently or with a bare stack trace.
 */

class AppError extends Error {
  constructor({ code, what, why, fix, status = 400, cause = null, detail = null }) {
    super(what);
    this.name = 'AppError';
    this.code = code || 'ERROR';
    this.what = what;
    this.why = why || 'No further detail is available.';
    this.fix = fix || 'Try the step again. If it keeps failing, check the server log.';
    this.status = status;
    this.detail = detail;
    if (cause) this.cause = cause;
  }

  toJSON() {
    return {
      error: true,
      code: this.code,
      what: this.what,
      why: this.why,
      fix: this.fix,
      detail: this.detail || undefined,
    };
  }
}

const E = {
  notFound: (thing, hint) => new AppError({
    code: 'NOT_FOUND',
    status: 404,
    what: `${thing} could not be found.`,
    why: 'It was deleted, or the id in the request does not match anything on disk.',
    fix: hint || 'Go back to the project list and reopen the project.',
  }),

  badInput: (what, why, fix) => new AppError({
    code: 'BAD_INPUT', status: 400, what, why, fix,
  }),

  ffmpegMissing: () => new AppError({
    code: 'FFMPEG_MISSING',
    status: 500,
    what: 'Video processing is unavailable because FFmpeg could not be found.',
    why: 'The bundled ffmpeg-static binary is missing or not executable in this environment.',
    fix: 'Run "npm install" inside auto-shorts/, or set AUTOSHORTS_FFMPEG to the path of an ffmpeg binary.',
  }),

  ffmpegFailed: (stage, stderr) => new AppError({
    code: 'FFMPEG_FAILED',
    status: 500,
    what: `FFmpeg failed during "${stage}".`,
    why: 'The filter graph or one of the input files was rejected by FFmpeg. The tail of its output is included below.',
    fix: 'Check that every media file still exists and is readable. Re-run AUTO EDIT to rebuild the edit, then export again.',
    detail: String(stderr || '').split('\n').slice(-14).join('\n'),
  }),

  noVoice: () => new AppError({
    code: 'NO_VOICE_TRACK',
    status: 400,
    what: 'There is no voice track to analyze.',
    why: 'AUTO EDIT needs either a video that contains audio, or a separate voiceover/narration file.',
    fix: 'Upload a talking-head clip with sound, or upload a narration audio file, then run AUTO EDIT again.',
  }),

  noVisuals: () => new AppError({
    code: 'NO_VISUALS',
    status: 400,
    what: 'There is nothing to show on screen.',
    why: 'The project has no video clips and no images, so no picture can be built for the Short.',
    fix: 'Upload at least one video clip or one image in the Upload step, then run AUTO EDIT again.',
  }),

  sttUnavailable: (why) => new AppError({
    code: 'STT_UNAVAILABLE',
    status: 400,
    what: 'Caption generation failed because speech recognition is unavailable.',
    why: why || 'No local speech-to-text engine was found, and no script was provided to align against the audio.',
    fix: 'Paste your script in the Script box (captions will be aligned to your narration automatically), import an .srt file, or install Whisper and set AUTOSHORTS_WHISPER_BIN.',
  }),

  noEdit: () => new AppError({
    code: 'NO_EDIT',
    status: 400,
    what: 'This project has no edit yet.',
    why: 'Preview and Export both render the edit decision list, and it has not been generated.',
    fix: 'Press AUTO EDIT first, then preview or export.',
  }),

  uploadFailed: (why) => new AppError({
    code: 'UPLOAD_FAILED',
    status: 400,
    what: 'The upload did not complete.',
    why: why || 'The file was rejected before it finished transferring.',
    fix: 'Check the file size and format, then try uploading again. Supported: mp4, mov, webm, mkv, mp3, wav, m4a, aac, ogg, jpg, png, webp, gif.',
  }),

  unsupportedMedia: (name, why) => new AppError({
    code: 'UNSUPPORTED_MEDIA',
    status: 400,
    what: `"${name}" could not be read as media.`,
    why: why || 'FFprobe could not identify a video, audio, or image stream inside the file.',
    fix: 'Convert the file to MP4 (video), MP3/WAV (audio), or JPG/PNG (image) and upload it again.',
  }),
};

module.exports = { AppError, E };
