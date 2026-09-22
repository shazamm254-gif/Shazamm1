/**
 * Heuristic monocular depth.
 *
 * A real depth network (MiDaS, Depth Anything) is 25–100 MB of weights plus
 * an ONNX runtime — a painful first load on mobile data, to produce a map
 * that this tool then blurs heavily anyway, because the parallax budget is
 * capped at a few percent of frame width. So the MVP estimates depth from
 * four classic monocular cues, on a 256px working copy, in ~15 ms:
 *
 *   defocus        sharp = near, soft = far   (Sobel energy, then blurred)
 *   aerial         desaturated + lifted blacks = far
 *   ground plane   the bottom of a frame is usually nearer than the top
 *   centre prior   AI stills put the subject mid-frame
 *
 * `estimateDepth` returns a DepthMap with a canvas the renderer uploads as a
 * texture. Swapping in a real network later means implementing the same
 * function signature and nothing else.
 */

const WORK_EDGE = 256;

export async function estimateDepth(source, { edge = WORK_EDGE } = {}) {
  const sw = source.width, sh = source.height;
  const scale = edge / Math.max(sw, sh);
  const w = Math.max(16, Math.round(sw * scale));
  const h = Math.max(16, Math.round(sh * scale));

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;

  const n = w * h;
  const lum = new Float32Array(n);
  const sat = new Float32Array(n);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = px[p] / 255, g = px[p + 1] / 255, b = px[p + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sat[i] = mx <= 0 ? 0 : (mx - mn) / mx;
  }

  // --- cue 1: defocus / detail energy -----------------------------------
  const edgeE = sobel(lum, w, h);
  // Two scales: fine detail says "in focus", coarse says "has structure".
  const fine = boxBlur(edgeE, w, h, 2);
  const coarse = boxBlur(edgeE, w, h, 9);
  const detail = new Float32Array(n);
  for (let i = 0; i < n; i++) detail[i] = fine[i] * 0.55 + coarse[i] * 0.45;
  normalizePercentile(detail, 0.04, 0.96);

  // --- cue 2: aerial perspective ----------------------------------------
  // Distant material loses saturation and local contrast, and its blacks lift.
  const satS = boxBlur(sat, w, h, 7);
  const localContrast = boxBlur(absDiff(lum, boxBlur(lum, w, h, 7), n), w, h, 5);
  normalizePercentile(satS, 0.04, 0.96);
  normalizePercentile(localContrast, 0.04, 0.96);
  const lumS = boxBlur(lum, w, h, 9);

  const near = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const fy = y / (h - 1);
    // ground-plane prior, softened so a portrait's head doesn't go "far"
    const ground = 0.30 + 0.70 * smoothstep(0.15, 1.0, fy);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const fx = x / (w - 1);
      const dx = (fx - 0.5) * 2, dy = (fy - 0.5) * 2;
      const radial = 1 - clamp01(Math.hypot(dx * 0.9, dy * 0.75));
      const centre = smoothstep(0.0, 1.0, radial);

      const aerialNear = clamp01(satS[i] * 0.55 + localContrast[i] * 0.45)
                       * (1 - 0.35 * clamp01((lumS[i] - 0.55) / 0.45));

      near[i] = 0.40 * detail[i]
              + 0.22 * aerialNear
              + 0.21 * ground
              + 0.17 * centre;
    }
  }

  normalizePercentile(near, 0.02, 0.98);

  // Heavy smoothing is what stops the displacement from tearing edges.
  let out = boxBlur(near, w, h, 4);
  out = boxBlur(out, w, h, 6);
  out = boxBlur(out, w, h, 3);

  // Pack into an RGBA canvas for upload. R = depth, G = detail (used by the
  // atmosphere pass to keep fog off sharp subjects).
  const outImg = ctx.createImageData(w, h);
  const od = outImg.data;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const d = Math.round(clamp01(out[i]) * 255);
    od[p] = d;
    od[p + 1] = Math.round(clamp01(detail[i]) * 255);
    od[p + 2] = d;
    od[p + 3] = 255;
  }
  ctx.putImageData(outImg, 0, 0);

  return {
    canvas: c,
    width: w,
    height: h,
    data: out,
    detail,
    focus: focusPoint(out, w, h),
  };
}

/**
 * Where the subject probably is, as normalised coords. Used to bias the
 * automatic 9:16 crop so a centred face doesn't get cut in half.
 */
function focusPoint(nearMap, w, h) {
  let sx = 0, sy = 0, sw_ = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = nearMap[y * w + x];
      const weight = Math.pow(clamp01(v), 3); // only the nearest region votes
      sx += (x / (w - 1)) * weight;
      sy += (y / (h - 1)) * weight;
      sw_ += weight;
    }
  }
  if (sw_ < 1e-6) return { x: 0.5, y: 0.5 };
  // Pull back toward centre: the cue is a hint, not a detector.
  return {
    x: 0.5 + (sx / sw_ - 0.5) * 0.55,
    y: 0.5 + (sy / sw_ - 0.5) * 0.45,
  };
}

/* ---------------------------- small helpers ---------------------------- */

function sobel(src, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = src[i - w - 1], b = src[i - w], c = src[i - w + 1];
      const d = src[i - 1],                     f = src[i + 1];
      const g = src[i + w - 1], hh = src[i + w], k = src[i + w + 1];
      const gx = (c + 2 * f + k) - (a + 2 * d + g);
      const gy = (g + 2 * hh + k) - (a + 2 * b + c);
      out[i] = Math.hypot(gx, gy);
    }
  }
  // replicate border
  for (let x = 0; x < w; x++) { out[x] = out[w + x]; out[(h - 1) * w + x] = out[(h - 2) * w + x]; }
  for (let y = 0; y < h; y++) { out[y * w] = out[y * w + 1]; out[y * w + w - 1] = out[y * w + w - 2]; }
  return out;
}

/** Separable box blur with clamped edges. */
function boxBlur(src, w, h, r) {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const norm = 1 / (2 * r + 1);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + clampI(i, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * norm;
      acc += src[row + clampI(x + r + 1, 0, w - 1)] - src[row + clampI(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[clampI(i, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm;
      acc += tmp[clampI(y + r + 1, 0, h - 1) * w + x] - tmp[clampI(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}

function absDiff(a, b, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.abs(a[i] - b[i]);
  return out;
}

/**
 * Stretch to [0,1] using percentiles rather than min/max, so one blown
 * highlight or one dead pixel can't flatten the whole map.
 */
function normalizePercentile(arr, lowP, highP) {
  const n = arr.length;
  const BINS = 512;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) { if (arr[i] < min) min = arr[i]; if (arr[i] > max) max = arr[i]; }
  if (!(max > min)) { arr.fill(0.5); return; }

  const hist = new Int32Array(BINS);
  const s = (BINS - 1) / (max - min);
  for (let i = 0; i < n; i++) hist[(arr[i] - min) * s | 0]++;

  const loTarget = n * lowP, hiTarget = n * highP;
  let acc = 0, lo = min, hi = max;
  for (let b = 0; b < BINS; b++) {
    acc += hist[b];
    if (acc >= loTarget) { lo = min + b / s; break; }
  }
  acc = 0;
  for (let b = BINS - 1; b >= 0; b--) {
    acc += hist[b];
    if (acc >= n - hiTarget) { hi = min + b / s; break; }
  }
  const range = Math.max(1e-6, hi - lo);
  for (let i = 0; i < n; i++) arr[i] = clamp01((arr[i] - lo) / range);
}

function clampI(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
