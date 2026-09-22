import {
  FULLSCREEN_VS, SCENE_FS, ATMOSPHERE_FS,
  PARTICLE_VS, PARTICLE_FS, GRADE_FS,
} from './shaders.js';
import { buildInstanceSeeds, CORNERS, INSTANCE_CAPACITY } from './effects/particles.js';
import { LIMITS } from '../config/app.config.js';

/**
 * WebGL2 renderer.
 *
 * Owns the GL context, the four programs, two ping-pong framebuffers and the
 * particle buffers. It knows nothing about presets or time — the engine hands
 * it a fully resolved frame description and it draws exactly that.
 */
export class Renderer {
  constructor(canvas) {
    const opts = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,   // required to grab frames for MediaRecorder
      powerPreference: 'high-performance',
      desynchronized: false,
    };
    const gl = canvas.getContext('webgl2', opts);
    if (!gl) throw new Error('WebGL2 is not available in this browser');

    this.canvas = canvas;
    this.gl = gl;
    this.width = canvas.width;
    this.height = canvas.height;
    this.lost = false;

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });

    this.programs = {
      scene: makeProgram(gl, FULLSCREEN_VS, SCENE_FS),
      atmosphere: makeProgram(gl, FULLSCREEN_VS, ATMOSPHERE_FS),
      particles: makeProgram(gl, PARTICLE_VS, PARTICLE_FS),
      grade: makeProgram(gl, FULLSCREEN_VS, GRADE_FS),
    };
    this.uniforms = {};
    for (const [k, p] of Object.entries(this.programs)) {
      this.uniforms[k] = collectUniforms(gl, p);
    }

    this.emptyVao = gl.createVertexArray();
    this._setupParticles();
    this._setupTargets(this.width, this.height);

    this.imageTex = null;
    this.depthTex = null;
    this.imageAspect = 1;
  }

  /* --------------------------- setup --------------------------------- */

  _setupParticles() {
    const gl = this.gl;
    this.particleVao = gl.createVertexArray();
    gl.bindVertexArray(this.particleVao);

    const cornerBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, CORNERS, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const seedBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, buildInstanceSeeds(0xC0FFEE, INSTANCE_CAPACITY), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.bindVertexArray(null);
    this.particleBuffers = { cornerBuf, seedBuf };
  }

  _setupTargets(w, h) {
    const gl = this.gl;
    this._disposeTargets();
    this.targets = {
      scene: makeTarget(gl, w, h, false),
      composite: makeTarget(gl, w, h, true),  // mipmapped: the bloom source
    };
  }

  _disposeTargets() {
    const gl = this.gl;
    if (!this.targets) return;
    for (const t of Object.values(this.targets)) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    }
    this.targets = null;
  }

  resize(w, h) {
    if (w === this.width && h === this.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;
    this._setupTargets(w, h);
  }

  /* --------------------------- inputs -------------------------------- */

  setImage(source) {
    const gl = this.gl;
    if (this.imageTex) gl.deleteTexture(this.imageTex);
    this.imageTex = makeTexture(gl, source, { mipmap: true });
    this.imageAspect = source.width / source.height;
    this.imageSize = { width: source.width, height: source.height };
  }

  setDepth(source) {
    const gl = this.gl;
    if (this.depthTex) gl.deleteTexture(this.depthTex);
    this.depthTex = makeTexture(gl, source, { mipmap: false });
  }

  /* --------------------------- drawing ------------------------------- */

  /**
   * @param {object} f  fully resolved frame:
   *   { camera:{zoom,tx,ty,roll,px,py,pz}, crop:{x,y,zoom}, pivot,
   *     atmosphere, particles:[], grade }
   */
  render(f) {
    if (this.lost) throw new Error('WebGL context lost');
    const gl = this.gl;
    const w = this.width, h = this.height;

    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, w, h);

    this._drawScene(f, w, h);
    this._drawAtmosphere(f, w, h);
    this._drawParticles(f, w, h);

    // The bloom in the grade pass reads the mip chain of the composite.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this.targets.composite.tex);
    gl.generateMipmap(gl.TEXTURE_2D);

    this._drawGrade(f, w, h);
  }

  _drawScene(f, w, h) {
    const gl = this.gl;
    const u = this.uniforms.scene;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets.scene.fbo);
    gl.useProgram(this.programs.scene);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.uniform1i(u.uImage, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex);
    gl.uniform1i(u.uDepth, 1);

    const cover = this._coverScale(w, h);
    gl.uniform2f(u.uFrame, w, h);
    gl.uniform2f(u.uCover, cover.x, cover.y);
    gl.uniform2f(u.uCrop, f.crop.x, f.crop.y);
    gl.uniform1f(u.uCropZoom, f.crop.zoom);

    gl.uniform1f(u.uZoom, f.camera.zoom);
    gl.uniform2f(u.uPan, f.camera.tx, f.camera.ty);
    gl.uniform1f(u.uRoll, f.camera.roll);
    gl.uniform3f(u.uParallax, f.camera.px, f.camera.py * (w / h), f.camera.pz);
    gl.uniform1f(u.uPivot, f.pivot ?? 0.5);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _drawAtmosphere(f, w, h) {
    const gl = this.gl;
    const a = f.atmosphere;
    const u = this.uniforms.atmosphere;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets.composite.fbo);
    gl.useProgram(this.programs.atmosphere);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.targets.scene.tex);
    gl.uniform1i(u.uScene, 0);
    gl.uniform2f(u.uFrame, w, h);
    gl.uniform1f(u.uTime, a ? a.time : 0);
    gl.uniform1i(u.uLayerCount, a ? a.count : 0);
    if (a && a.count > 0) {
      gl.uniform4i(u.uTypes, ...a.types);
      gl.uniform4f(u.uAmount, ...a.amount);
      gl.uniform4f(u.uSpeed, ...a.speed);
      gl.uniform4f(u.uDepthBias, ...a.depthBias);
      gl.uniform2f(u.uDrift, a.drift[0], a.drift[1]);
    } else {
      gl.uniform4i(u.uTypes, 0, 0, 0, 0);
      gl.uniform4f(u.uAmount, 0, 0, 0, 0);
      gl.uniform4f(u.uSpeed, 0, 0, 0, 0);
      gl.uniform4f(u.uDepthBias, 0, 0, 0, 0);
      gl.uniform2f(u.uDrift, 0, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _drawParticles(f, w, h) {
    const layers = f.particles || [];
    if (!layers.length) return;

    const gl = this.gl;
    const u = this.uniforms.particles;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets.composite.fbo);
    gl.useProgram(this.programs.particles);
    gl.bindVertexArray(this.particleVao);
    gl.enable(gl.BLEND);

    for (const L of layers) {
      gl.blendFunc(gl.SRC_ALPHA, L.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(u.uTime, L.time);
      gl.uniform2f(u.uFrame, w, h);
      gl.uniform1i(u.uType, L.type);
      gl.uniform1f(u.uAmount, L.amount);
      gl.uniform1f(u.uSpeed, L.speed);
      gl.uniform1f(u.uAngle, L.angle);
      gl.uniform1f(u.uDrift, L.drift);
      gl.uniform3f(u.uTint, ...L.tint);
      gl.uniform2f(u.uCamPan, L.camPan[0], L.camPan[1]);
      gl.uniform1f(u.uCamZoom, L.camZoom);
      gl.uniform1f(u.uVisible, L.visible);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, L.count);
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);
  }

  _drawGrade(f, w, h) {
    const gl = this.gl;
    const u = this.uniforms.grade;
    const g = f.grade;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.programs.grade);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.targets.composite.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uFrame, w, h);
    gl.uniform1f(u.uTime, g.time);
    gl.uniform1f(u.uVignette, g.vignette);
    gl.uniform1f(u.uGrain, g.grain);
    gl.uniform1f(u.uBloom, g.bloom);
    gl.uniform1f(u.uContrast, g.contrast);
    gl.uniform1f(u.uWarmth, g.warmth);
    gl.uniform1f(u.uExposure, g.exposure);
    gl.uniform3f(u.uFlashTint, ...g.flashTint);
    gl.uniform1f(u.uBolt, g.bolt);
    gl.uniform1f(u.uBoltSeed, g.boltSeed);
    gl.uniform1f(u.uBoltX, g.boltX);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Cover-fit plus a safety oversample, so panning and depth displacement can
   * never pull in an area outside the image.
   */
  _coverScale(frameW, frameH) {
    const iw = this.imageSize ? this.imageSize.width : 1;
    const ih = this.imageSize ? this.imageSize.height : 1;
    const s = Math.max(frameW / iw, frameH / ih) * LIMITS.safetyScale;
    return { x: (iw * s) / frameW, y: (ih * s) / frameH };
  }

  /** Blocks until the GPU has drained. Only used by the speed probe. */
  finish() { this.gl.finish(); }

  dispose() {
    const gl = this.gl;
    this._disposeTargets();
    if (this.imageTex) gl.deleteTexture(this.imageTex);
    if (this.depthTex) gl.deleteTexture(this.depthTex);
    for (const p of Object.values(this.programs)) gl.deleteProgram(p);
    if (this.particleBuffers) {
      gl.deleteBuffer(this.particleBuffers.cornerBuf);
      gl.deleteBuffer(this.particleBuffers.seedBuf);
    }
    gl.deleteVertexArray(this.particleVao);
    gl.deleteVertexArray(this.emptyVao);
  }
}

/* ------------------------------ GL helpers ------------------------------ */

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return sh;
}

function makeProgram(gl, vsSrc, fsSrc) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(`Program link failed: ${log}`);
  }
  return p;
}

function collectUniforms(gl, program) {
  const out = {};
  const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, '');
    out[name] = gl.getUniformLocation(program, name);
  }
  return out;
}

function makeTexture(gl, source, { mipmap }) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (mipmap) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  return tex;
}

function makeTarget(gl, w, h, mipmap) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
    mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  if (mipmap) gl.generateMipmap(gl.TEXTURE_2D);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Could not allocate a ${w}×${h} render target (0x${status.toString(16)})`);
  }
  return { tex, fbo, width: w, height: h };
}
