import { UPLOAD } from '../config/app.config.js';
import { AppError, ACTIONS } from './errors.js';

/**
 * Upload handling.
 *
 * The original file is never modified or re-encoded: it is kept as-is on the
 * loaded image record. Everything downstream works on a decoded bitmap that
 * is capped at UPLOAD.maxWorkingEdge, because a 6000px AI upscale would
 * otherwise blow a phone's texture budget for no visible gain at 1080×1920.
 */

export function validateFile(file) {
  if (!file) throw new AppError('No file was selected.', { actions: [ACTIONS.NEW_IMAGE] });

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const typeOk = /^image\/(jpeg|png|webp)$/i.test(file.type);
  const extOk = UPLOAD.extensions.includes(ext);

  if (!typeOk && !extOk) {
    throw new AppError('That file type is not supported.', {
      hint: 'Use a JPG, PNG or WEBP image.',
      actions: [ACTIONS.NEW_IMAGE],
    });
  }
  if (file.size > UPLOAD.maxBytes) {
    const mb = (file.size / 1048576).toFixed(1);
    throw new AppError(`That image is ${mb} MB — too large to process on a phone.`, {
      hint: `Keep it under ${Math.round(UPLOAD.maxBytes / 1048576)} MB. Screenshotting it or exporting at a smaller size usually does it.`,
      actions: [ACTIONS.NEW_IMAGE],
    });
  }
  return true;
}

/** A filename safe to hand to a download attribute. */
export function sanitizeName(name) {
  const base = String(name || 'image')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return base || 'clip';
}

/**
 * Decodes to a bitmap, honouring EXIF orientation where the browser supports
 * it, and downscales to the working cap.
 */
export async function loadImage(file) {
  validateFile(file);

  let bitmap;
  try {
    bitmap = await decode(file);
  } catch (e) {
    throw new AppError("That image couldn't be opened.", {
      hint: 'It may be corrupted, or saved in a format this browser cannot read.',
      actions: [ACTIONS.NEW_IMAGE],
      cause: e,
    });
  }

  if (bitmap.width < UPLOAD.minEdge || bitmap.height < UPLOAD.minEdge) {
    throw new AppError('That image is too small to animate.', {
      hint: `It needs to be at least ${UPLOAD.minEdge}px on each side.`,
      actions: [ACTIONS.NEW_IMAGE],
    });
  }

  const working = await toWorkingCopy(bitmap);

  return {
    file,                       // preserved, untouched
    name: sanitizeName(file.name),
    bitmap: working,
    originalWidth: bitmap.width,
    originalHeight: bitmap.height,
    width: working.width,
    height: working.height,
    orientation: describeOrientation(bitmap.width, bitmap.height),
  };
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older Android WebViews reject the options bag rather than ignoring it.
      return await createImageBitmap(file);
    }
  }
  // Last resort: an <img> element.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function toWorkingCopy(bitmap) {
  const max = Math.max(bitmap.width, bitmap.height);
  if (max <= UPLOAD.maxWorkingEdge) return bitmap;

  const scale = UPLOAD.maxWorkingEdge / max;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);

  if (typeof createImageBitmap === 'function') {
    const out = await createImageBitmap(c);
    if (bitmap.close) bitmap.close();
    return out;
  }
  return c;
}

export function describeOrientation(w, h) {
  const r = w / h;
  if (r > 1.15) return 'landscape';
  if (r < 0.87) return 'portrait';
  return 'square';
}

/**
 * How much of the image a 9:16 frame will show, and whether that means a
 * meaningful crop the user should know about.
 */
export function coverageFor(width, height, frameAspect = 9 / 16) {
  const imageAspect = width / height;
  const visible = imageAspect > frameAspect
    ? frameAspect / imageAspect     // wide image: sides get cropped
    : imageAspect / frameAspect;    // tall image: top/bottom get cropped
  return {
    visible,
    heavyCrop: visible < 0.62,
    axis: imageAspect > frameAspect ? 'sides' : 'top and bottom',
  };
}
