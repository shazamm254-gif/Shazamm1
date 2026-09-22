/**
 * Generates a synthetic "AI still" for the end-to-end test: a soft gradient
 * sky, a hazy far ridge, and a sharp high-contrast subject in the lower
 * middle. That layering is what the depth estimator is supposed to separate,
 * so a flat test image would not prove anything.
 *
 * Writes a real PNG with node's zlib — no image library needed.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

let W = 1024, H = 1024;

function render() {
  // W/H are set by writePng so the same scene can be generated at any aspect.
  const px = Buffer.alloc(W * H * 3);
  const set = (x, y, r, g, b) => {
    const i = (y * W + x) * 3;
    px[i] = clamp(r); px[i + 1] = clamp(g); px[i + 2] = clamp(b);
  };

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // sky: smooth vertical gradient, very low detail -> should read as far
      let r = 40 + 120 * (1 - v) + 18 * Math.sin(u * 3.1);
      let g = 52 + 96 * (1 - v);
      let b = 96 + 110 * (1 - v);

      // hazy ridge: low contrast, desaturated -> far
      const ridge = 0.52 + 0.05 * Math.sin(u * 9.0) + 0.03 * Math.sin(u * 23.0);
      if (v > ridge) {
        const k = Math.min(1, (v - ridge) * 5);
        r = mix(r, 108, k * 0.55); g = mix(g, 116, k * 0.55); b = mix(b, 128, k * 0.55);
      }

      // ground: warmer, more texture -> nearer
      const ground = 0.72;
      if (v > ground) {
        const t = (v - ground) / (1 - ground);
        const grit = 26 * hash2(x * 0.7, y * 0.7) * t;
        r = mix(r, 92 + grit, 0.85); g = mix(g, 74 + grit, 0.85); b = mix(b, 58 + grit, 0.85);
      }

      set(x, y, r, g, b);
    }
  }

  // subject: a sharp, high-frequency monolith in the lower centre
  for (let y = 430; y < 900; y++) {
    const t = (y - 430) / 470;
    const halfW = 96 - 26 * t;
    for (let x = Math.round(512 - halfW); x < Math.round(512 + halfW); x++) {
      const edge = Math.abs(x - 512) / halfW;
      const stripes = 40 * Math.sin(y * 0.55) * (1 - edge);
      const facet = x < 512 ? 32 : -14;
      const base = 62 + facet + stripes + 34 * hash2(x * 2.1, y * 2.1);
      set(x, y, base * 1.08, base * 0.95, base * 0.88);
    }
  }

  // a bright rim light on the subject: gives the bloom pass something to do
  for (let y = 430; y < 900; y++) {
    const t = (y - 430) / 470;
    const halfW = 96 - 26 * t;
    for (let d = 0; d < 4; d++) {
      const x = Math.round(512 - halfW) + d;
      if (x >= 0 && x < W) set(x, y, 245, 228, 190);
    }
  }

  return px;
}

function mix(a, b, t) { return a + (b - a) * t; }
function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
function hash2(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/* ------------------------------ PNG writing ----------------------------- */

function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function writePng(path, width = 1024, height = 1024) {
  W = width; H = height;
  const px = render();
  // Each scanline gets a filter byte; 0 = None.
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    px.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 2;    // colour type: truecolour
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  writeFileSync(path, png);
  return { path, width: W, height: H, bytes: png.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || 'test-image.png';
  const w = Number(process.argv[3] || 1024);
  const h = Number(process.argv[4] || 1024);
  console.log(JSON.stringify(writePng(out, w, h)));
}
