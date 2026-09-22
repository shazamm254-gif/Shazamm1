/**
 * User-facing errors. A raw stack trace never reaches the screen; every
 * failure is translated into a sentence plus concrete next steps.
 */

export class AppError extends Error {
  constructor(message, { hint = '', actions = [], cause } = {}) {
    super(message);
    this.name = 'AppError';
    this.hint = hint;
    this.actions = actions;
    this.cause = cause;
  }
}

export const ACTIONS = {
  RETRY: 'retry',
  SETTINGS: 'settings',
  NEW_IMAGE: 'new-image',
  LOWER_QUALITY: 'lower-quality',
};

/** Maps anything thrown inside the engine to something a person can act on. */
export function toUserError(err) {
  if (err instanceof AppError) return err;

  const raw = String(err && err.message || err || '');

  if (/webgl/i.test(raw)) {
    return new AppError(
      "This browser couldn't start the graphics engine.",
      {
        hint: 'Try Chrome or Samsung Internet, and close a few other tabs.',
        actions: [ACTIONS.RETRY, ACTIONS.NEW_IMAGE],
        cause: err,
      });
  }
  if (/memory|allocat|out of|too large|context lost/i.test(raw)) {
    return new AppError(
      'Your device ran out of memory while rendering.',
      {
        hint: 'Lower the quality or shorten the clip, then try again.',
        actions: [ACTIONS.LOWER_QUALITY, ACTIONS.SETTINGS, ACTIONS.RETRY],
        cause: err,
      });
  }
  if (/encod|codec|muxer|VideoEncoder|MediaRecorder/i.test(raw)) {
    return new AppError(
      "Video export failed on this browser.",
      {
        hint: 'Try a lower quality, or open the app in Chrome for Android.',
        actions: [ACTIONS.LOWER_QUALITY, ACTIONS.RETRY],
        cause: err,
      });
  }
  if (/decode|image|corrupt/i.test(raw)) {
    return new AppError(
      "That image couldn't be opened.",
      {
        hint: 'Use a JPG, PNG or WEBP under 25 MB.',
        actions: [ACTIONS.NEW_IMAGE],
        cause: err,
      });
  }

  return new AppError(
    'Video generation failed.',
    {
      hint: 'Try lowering Motion Strength or using a smaller image.',
      actions: [ACTIONS.RETRY, ACTIONS.SETTINGS, ACTIONS.NEW_IMAGE],
      cause: err,
    });
}
