/**
 * GLSL ES 3.00 sources for the four render passes.
 *
 * Pass order per frame:
 *   1. SCENE       image sampled through the camera transform + depth displacement
 *   2. ATMOSPHERE  fog / mist / smoke / haze / god rays, weighted by depth
 *   3. PARTICLES   instanced quads, position solved in the vertex shader
 *   4. GRADE       bloom, vignette, grain, lightning, contrast/warmth → canvas
 */

export const FULLSCREEN_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // One oversized triangle: no vertex buffer, no index buffer.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* 1. SCENE                                                            */
/* ------------------------------------------------------------------ */

export const SCENE_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uImage;
uniform sampler2D uDepth;

uniform vec2  uFrame;        // frame size in px
uniform vec2  uCover;        // scale that fits the image over the frame
uniform vec2  uCrop;         // user reframing offset, in frame units
uniform float uCropZoom;     // user reframing zoom

uniform float uZoom;         // camera zoom
uniform vec2  uPan;          // camera pan, frame units
uniform float uRoll;         // camera roll, radians

uniform vec3  uParallax;     // (x, y, radial) displacement in uv units
uniform float uPivot;        // depth value treated as "the plane of focus"

/** frame uv -> image uv, before any depth displacement */
vec2 frameToImage(vec2 uv) {
  vec2 p = uv - 0.5;
  p.y *= uFrame.y / uFrame.x;            // work in square-ish space so roll is not sheared

  float s = sin(uRoll), c = cos(uRoll);
  p = mat2(c, -s, s, c) * p;

  p /= max(0.0001, uZoom * uCropZoom);

  // uPan and uCrop move the *sampling window*, so a positive pan means the
  // camera travels right and the content slides left. Both are in frame-width
  // units on both axes, which is why they are applied in square space.
  p += uPan;
  p += uCrop;

  p.y /= uFrame.y / uFrame.x;

  // Frame space has its origin at the bottom (clip space), image textures
  // have theirs at the top. Flip V on the way out; everything downstream
  // works in image space.
  vec2 imageUv = p / uCover + 0.5;
  return vec2(imageUv.x, 1.0 - imageUv.y);
}

float depthAt(vec2 imageUv) {
  return texture(uDepth, clamp(imageUv, 0.0, 1.0)).r;
}

vec2 flipY(vec2 v) { return vec2(v.x, -v.y); }

/**
 * Displacement for a given depth. Two terms:
 *   lateral — near layers slide against the camera's travel
 *   radial  — near layers expand faster than far ones on a push
 */
vec2 disp(float d, vec2 uv) {
  float dn = d - uPivot;
  vec2 v = uParallax.xy * dn;
  // Radial term is subtracted: on a push-in the near plane must *expand*,
  // which means sampling nearer the centre at the edges of the frame.
  v -= (uv - 0.5) * uParallax.z * dn * 2.0;
  return v;
}

void main() {
  vec2 base = frameToImage(vUv);

  // Two-step fixed point: sample depth, displace, re-sample depth, displace
  // again from the original point. Cheap, and it removes most of the "swim"
  // a single-step displacement leaves around depth edges.
  // disp() works in frame space, so its V is negated to move in image space.
  float d0 = depthAt(base);
  vec2 uv1 = base + flipY(disp(d0, vUv));
  float d1 = depthAt(uv1);
  vec2 uv2 = base + flipY(disp(mix(d0, d1, 0.65), vUv));

  vec3 col = texture(uImage, clamp(uv2, 0.0015, 0.9985)).rgb;
  float depth = depthAt(uv2);

  fragColor = vec4(col, depth);
}`;

/* ------------------------------------------------------------------ */
/* 2. ATMOSPHERE                                                       */
/* ------------------------------------------------------------------ */

export const ATMOSPHERE_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;    // rgb = image, a = depth
uniform float uTime;
uniform vec2  uFrame;
uniform int   uLayerCount;
uniform ivec4 uTypes;        // up to 4 layers: 0 fog 1 mist 2 smoke 3 haze 4 godrays
uniform vec4  uAmount;
uniform vec4  uSpeed;
uniform vec4  uDepthBias;
uniform vec2  uDrift;        // camera-coupled drift so the fog is not painted on

float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i + vec3(0,0,0)), n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0)), n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1)), n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1)), n111 = hash(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

float fbm(vec3 p, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= oct) break;
    s += vnoise(p) * a;
    n += a;
    p *= 2.03;
    p.z *= 1.11;
    a *= 0.5;
  }
  return s / max(n, 0.0001);
}

void main() {
  vec4 scene = texture(uScene, vUv);
  vec3 col = scene.rgb;
  float depth = scene.a;

  // Aspect-corrected coordinates so noise cells are square, not stretched.
  vec2 q = vec2(vUv.x, vUv.y * uFrame.y / uFrame.x);

  float amt[4]; amt[0]=uAmount.x; amt[1]=uAmount.y; amt[2]=uAmount.z; amt[3]=uAmount.w;
  float spd[4]; spd[0]=uSpeed.x;  spd[1]=uSpeed.y;  spd[2]=uSpeed.z;  spd[3]=uSpeed.w;
  float dbi[4]; dbi[0]=uDepthBias.x; dbi[1]=uDepthBias.y; dbi[2]=uDepthBias.z; dbi[3]=uDepthBias.w;
  int   typ[4]; typ[0]=uTypes.x; typ[1]=uTypes.y; typ[2]=uTypes.z; typ[3]=uTypes.w;

  for (int L = 0; L < 4; L++) {
    if (L >= uLayerCount) break;
    int t = typ[L];
    float amount = amt[L];
    float speed = spd[L];
    float bias = dbi[L];
    if (amount <= 0.001) continue;

    // "far" = 1 at the back of the scene. Atmosphere pools in the distance.
    float far = 1.0 - depth;
    float dw = mix(1.0, smoothstep(0.05, 0.95, far), bias);

    if (t == 3) {
      // HEAT HAZE — refracts the scene instead of adding anything to it.
      vec2 warp;
      warp.x = fbm(vec3(q * 9.0, uTime * speed * 1.6), 3) - 0.5;
      warp.y = fbm(vec3(q * 9.0 + 41.7, uTime * speed * 1.9), 3) - 0.5;
      float shimmer = amount * 0.012 * dw;
      col = texture(uScene, clamp(vUv + warp * shimmer, 0.001, 0.999)).rgb;
      continue;
    }

    if (t == 4) {
      // GOD RAYS — streaks from a high light, additive, slowly breathing.
      vec2 lightPos = vec2(0.62, 0.94);   // high in frame (frame space: y up)
      vec2 d = vUv - lightPos;
      d.y *= uFrame.y / uFrame.x;
      float ang = atan(d.y, d.x);
      float rad = length(d);
      // Many fine shafts, not a few broad wedges, and they die off well
      // before the far corner — otherwise the whole frame turns into a star.
      float rays = fbm(vec3(ang * 15.0, rad * 2.2, uTime * speed * 0.3), 3);
      rays = pow(clamp(rays, 0.0, 1.0), 3.4);
      float falloff = exp(-rad * 3.2) * smoothstep(0.0, 0.22, rad);
      float m = rays * falloff * amount * 0.85 * mix(1.0, dw, 0.5);
      col += vec3(1.0, 0.93, 0.78) * min(m, 0.5);
      continue;
    }

    vec3 p;
    vec3 tint;
    float density;

    if (t == 2) {
      // SMOKE — rising, higher contrast, grey.
      p = vec3(q * 3.1 + vec2(uDrift.x * 0.5, -uTime * speed * 0.09), uTime * speed * 0.16);
      density = fbm(p, 4);
      density = pow(smoothstep(0.32, 0.86, density), 1.25);
      tint = vec3(0.58, 0.59, 0.62);
    } else if (t == 1) {
      // MIST — fine, low, gentle.
      p = vec3(q * 5.4 + vec2(uTime * speed * 0.035, 0.0) + uDrift * 0.4, uTime * speed * 0.10);
      density = fbm(p, 3);
      density = smoothstep(0.34, 0.92, density) * mix(0.55, 1.0, smoothstep(0.85, 0.15, vUv.y));
      tint = vec3(0.80, 0.85, 0.92);
    } else {
      // FOG — broad banks drifting sideways.
      p = vec3(q * 2.0 + vec2(uTime * speed * 0.055, uTime * speed * 0.012) + uDrift * 0.6,
               uTime * speed * 0.085);
      density = fbm(p, 4);
      density = smoothstep(0.28, 0.88, density);
      tint = vec3(0.76, 0.80, 0.86);
    }

    float a = clamp(density * amount * dw, 0.0, 0.92);
    col = mix(col, tint, a);
  }

  fragColor = vec4(col, depth);
}`;

/* ------------------------------------------------------------------ */
/* 3. PARTICLES                                                        */
/* ------------------------------------------------------------------ */

export const PARTICLE_VS = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;   // -1..1 quad corner
layout(location = 1) in vec4 aSeed;     // x, y, depth band, variant

out vec2  vLocal;
out vec4  vColor;
out float vShape;   // 0 = round, 1 = streak

uniform float uTime;
uniform vec2  uFrame;
uniform int   uType;       // 0 rain 1 snow 2 dust 3 embers 4 sparks 5 debris 6 bokeh
uniform float uAmount;
uniform float uSpeed;
uniform float uAngle;
uniform float uDrift;      // extra horizontal drift
uniform vec3  uTint;
uniform vec2  uCamPan;     // camera-coupled offset
uniform float uCamZoom;
uniform float uVisible;    // fraction of instances to draw

float h(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  float aspect = uFrame.y / uFrame.x;

  // Cull the tail of the buffer instead of re-uploading when the count changes.
  if (aSeed.w > uVisible) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vLocal = aCorner; vColor = vec4(0.0); vShape = 0.0;
    return;
  }

  float band = aSeed.z;                 // 0 far .. 1 near
  vec2 pos;
  float size;        // HALF-WIDTH, as a fraction of frame width
  float stretch = 1.0;  // length / width
  float alpha;
  vec3  tint = uTint;
  float shape = 0.0;
  float rot = 0.0;

  if (uType == 0) {            // RAIN
    float sp = uSpeed * mix(0.75, 1.9, band);
    float u = fract(aSeed.y + uTime * sp * 0.65);
    pos = vec2(fract(aSeed.x + uAngle * u + uTime * uDrift * 0.02), u);
    // ~1.5-3.5px wide and 25-110px long at 1080 wide: a rain streak, not a bar.
    size = mix(0.0007, 0.0016, band);
    stretch = mix(30.0, 62.0, band);
    alpha = mix(0.20, 0.45, band) * uAmount;
    shape = 1.0;
    rot = uAngle;
  } else if (uType == 1) {     // SNOW
    float sp = uSpeed * mix(0.5, 1.5, band);
    float u = fract(aSeed.y + uTime * sp * 0.13);
    float sway = sin(uTime * (0.5 + h(aSeed.x * 91.7) * 1.1) + aSeed.x * 31.4) * 0.045 * uDrift;
    pos = vec2(fract(aSeed.x + sway + uTime * 0.004 * uDrift), u);
    size = mix(0.0016, 0.0060, band);
    alpha = mix(0.35, 0.9, band) * uAmount;
  } else if (uType == 2) {     // DUST
    float sp = uSpeed * mix(0.3, 1.0, band);
    float u = fract(aSeed.y - uTime * sp * 0.035);
    float sway = sin(uTime * (0.25 + h(aSeed.x * 12.3) * 0.5) + aSeed.y * 19.0) * 0.03;
    pos = vec2(fract(aSeed.x + sway), u);
    size = mix(0.0009, 0.0030, band);
    float tw = 0.55 + 0.45 * sin(uTime * (1.1 + h(aSeed.y * 7.7) * 2.0) + aSeed.x * 44.0);
    alpha = mix(0.18, 0.7, band) * uAmount * tw;
  } else if (uType == 3) {     // EMBERS
    float sp = uSpeed * mix(0.5, 1.3, band);
    float u = fract(aSeed.y + uTime * sp * 0.11);
    float life = 1.0 - u;                       // 1 at spawn (bottom), 0 at top
    float sway = sin(uTime * (0.9 + h(aSeed.x * 5.1) * 1.6) + aSeed.x * 27.0) * 0.05;
    pos = vec2(fract(aSeed.x + sway * (1.0 - life) * 2.0), 1.0 - u);
    size = mix(0.0016, 0.0058, band) * (0.5 + life * 0.8);
    float flick = 0.55 + 0.45 * sin(uTime * (7.0 + h(aSeed.x * 3.3) * 9.0) + aSeed.y * 55.0);
    alpha = mix(0.5, 1.0, band) * uAmount * life * flick;
    tint = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.88, 0.55), h(aSeed.x * 17.0) * life);
  } else if (uType == 4) {     // SPARKS
    float sp = uSpeed * mix(0.9, 2.2, band);
    float u = fract(aSeed.y + uTime * sp * 0.32);
    float life = 1.0 - u;

    // Launched upward inside a cone, then pulled back down by gravity.
    float spread = (h(aSeed.x * 61.0) - 0.5) * 1.7;   // radians from vertical
    float power = 0.55 + h(aSeed.x * 23.0) * 0.7;
    vec2 dir = vec2(sin(spread), -cos(spread)) * power;
    vec2 origin = vec2(aSeed.x, 0.72 + h(aSeed.x * 7.3) * 0.22);
    vec2 gravity = vec2(0.0, 0.85);
    pos = origin + dir * u + gravity * u * u;

    size = mix(0.0009, 0.0021, band);
    stretch = mix(5.0, 11.0, band);
    alpha = mix(0.4, 1.0, band) * uAmount * pow(life, 1.3);
    tint = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.96, 0.78), life);
    shape = 1.0;

    // Point the streak along the velocity. The quad's long axis is local +Y,
    // which is screen-up, while pos.y runs downward — hence the negations.
    vec2 vel = dir + 2.0 * gravity * u;
    rot = atan(-vel.x, -vel.y);
  } else if (uType == 5) {     // DEBRIS
    float sp = uSpeed * mix(1.0, 2.4, band);
    float u = fract(aSeed.y + uTime * sp * 0.22);
    float yy = fract(aSeed.x * 3.71 + sin(uTime * 0.6 + aSeed.x * 20.0) * 0.06);
    pos = vec2(u, yy + uAngle * u * 0.8);
    size = mix(0.0018, 0.0062, band);
    stretch = 3.2;
    alpha = mix(0.38, 0.92, band) * uAmount;
    shape = 1.0;
    rot = uAngle + h(aSeed.x * 9.9) * 1.2;
  } else {                     // BOKEH
    float sp = uSpeed * mix(0.2, 0.7, band);
    float u = fract(aSeed.y - uTime * sp * 0.03);
    float sway = sin(uTime * 0.3 + aSeed.x * 14.0) * 0.02;
    pos = vec2(fract(aSeed.x + sway), u);
    size = mix(0.011, 0.042, band);
    float tw = 0.6 + 0.4 * sin(uTime * 0.7 + aSeed.x * 22.0);
    alpha = mix(0.10, 0.34, band) * uAmount * tw;
  }

  // Couple to the camera: near particles ride the move more than far ones.
  float couple = mix(0.25, 1.0, band);
  pos += uCamPan * couple * 0.8;
  pos = (pos - 0.5) * mix(1.0, uCamZoom, couple * 0.35) + 0.5;

  if (uType == 4) {
    // Sparks fly outward and die; wrapping them would teleport a live spark
    // across the frame. Cull instead.
    if (pos.x < -0.15 || pos.x > 1.15 || pos.y < -0.15 || pos.y > 1.15) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vLocal = aCorner; vColor = vec4(0.0); vShape = 0.0;
      return;
    }
  } else {
    // Wrap, so camera coupling never opens a bald patch at an edge.
    pos = fract(pos + 1.0);
  }

  // Particle space is top-left (pos.y = 0 is the top of the frame, so rain
  // falls as pos.y grows); clip space is bottom-left.
  vec2 clip = vec2(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0);

  vec2 corner = aCorner;
  corner.y *= stretch;
  float cs = cos(rot), sn = sin(rot);
  corner = mat2(cs, -sn, sn, cs) * corner;

  // size is a fraction of frame WIDTH; dividing y by the aspect keeps the
  // sprite square on screen instead of stretched by the 9:16 frame.
  vec2 offset = vec2(corner.x, corner.y / aspect) * size * 2.0;
  gl_Position = vec4(clip + offset, 0.0, 1.0);

  vLocal = aCorner;
  vColor = vec4(tint, clamp(alpha, 0.0, 1.0));
  vShape = shape;
}`;

export const PARTICLE_FS = `#version 300 es
precision highp float;

in vec2  vLocal;
in vec4  vColor;
in float vShape;
out vec4 fragColor;

void main() {
  float m;
  if (vShape > 0.5) {
    // streak: soft across, tapered along
    float across = 1.0 - clamp(abs(vLocal.x), 0.0, 1.0);
    float along  = 1.0 - clamp(abs(vLocal.y), 0.0, 1.0);
    m = pow(across, 1.1) * pow(along, 0.35);
  } else {
    float r = length(vLocal);
    m = 1.0 - smoothstep(0.25, 1.0, r);
    m *= m;
  }
  if (m <= 0.002) discard;
  fragColor = vec4(vColor.rgb, vColor.a * m);
}`;

/* ------------------------------------------------------------------ */
/* 4. GRADE                                                            */
/* ------------------------------------------------------------------ */

export const GRADE_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTex;
uniform vec2  uFrame;
uniform float uTime;
uniform float uVignette;
uniform float uGrain;
uniform float uBloom;
uniform float uContrast;
uniform float uWarmth;
uniform float uExposure;     // lightning flash / firelight flicker
uniform vec3  uFlashTint;
uniform float uBolt;         // 0..1 bolt visibility
uniform float uBoltSeed;
uniform float uBoltX;

float h1(float n) { return fract(sin(n) * 43758.5453123); }

float vnoise1(float x, float seed) {
  float i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(h1(i + seed), h1(i + 1.0 + seed), f) * 2.0 - 1.0;
}

/** Noise-perturbed vertical path: a lightning channel. */
float boltPath(float y, float seed, float scale) {
  float x = 0.0;
  x += vnoise1(y * 3.0, seed) * 0.16;
  x += vnoise1(y * 7.0, seed + 13.0) * 0.07;
  x += vnoise1(y * 17.0, seed + 71.0) * 0.028;
  return x * scale;
}

float boltGlow(vec2 uv, float seed, float xOff, float topY, float botY, float w) {
  if (uv.y < topY || uv.y > botY) return 0.0;
  float t = (uv.y - topY) / max(0.001, botY - topY);
  float cx = xOff + boltPath(uv.y, seed, 1.0);
  float d = abs(uv.x - cx);
  float core = exp(-d * (900.0 / w));
  float halo = exp(-d * (70.0 / w)) * 0.35;
  float fade = smoothstep(1.0, 0.55, t);
  return (core + halo) * fade;
}

void main() {
  vec3 col = texture(uTex, vUv).rgb;

  // Bloom from the mip chain: wide, cheap, and it only blooms what is bright.
  if (uBloom > 0.001) {
    vec3 b = texture(uTex, vUv, 3.5).rgb * 0.45
           + texture(uTex, vUv, 5.5).rgb * 0.35
           + texture(uTex, vUv, 7.0).rgb * 0.20;
    vec3 bright = max(b - vec3(0.66), vec3(0.0)) / 0.34;
    col += bright * uBloom * 1.25;
  }

  // Lightning bolt, drawn before exposure so the flash lifts it too.
  if (uBolt > 0.001) {
    // Bolts descend, so measure from the top of the frame down.
    vec2 bv = vec2(vUv.x, 1.0 - vUv.y);
    float g = boltGlow(bv, uBoltSeed, uBoltX, 0.0, 0.62, 1.0);
    g += boltGlow(bv, uBoltSeed + 37.0, uBoltX + 0.06, 0.18, 0.44, 1.8) * 0.45;
    g += boltGlow(bv, uBoltSeed + 91.0, uBoltX - 0.05, 0.10, 0.38, 2.2) * 0.35;
    col += uFlashTint * g * uBolt * 1.6;
  }

  col *= uExposure;
  if (uExposure > 1.0001) {
    col = mix(col, col * uFlashTint, clamp((uExposure - 1.0) * 0.5, 0.0, 0.6));
  }

  // Warmth: a tilt, not a filter.
  col.r *= 1.0 + uWarmth * 0.12;
  col.b *= 1.0 - uWarmth * 0.12;
  col.g *= 1.0 + uWarmth * 0.02;

  // Contrast around mid grey with a soft shoulder so highlights don't clip.
  col = (col - 0.5) * (1.0 + uContrast) + 0.5;
  col = col / (1.0 + max(vec3(0.0), col - 1.0) * 0.6);

  // Vignette.
  vec2 d = vUv - 0.5;
  d.y *= uFrame.y / uFrame.x * 0.62;
  float v = 1.0 - uVignette * smoothstep(0.22, 0.78, length(d) * 1.65);
  col *= v;

  // Grain: animated, but seeded by frame time so a re-render matches.
  if (uGrain > 0.001) {
    float n = h1(dot(vUv, vec2(12.9898, 78.233)) + uTime * 7.13) - 0.5;
    col += n * uGrain * 0.16 * (1.0 - 0.6 * dot(col, vec3(0.333)));
  }

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
