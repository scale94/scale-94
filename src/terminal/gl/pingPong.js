// pingPong.js — float render targets for GPU simulations on the shared GL
// harness. RGBA32F everywhere; sampled with texelFetch, so NEAREST filtering
// keeps textures complete without mipmaps or OES_texture_float_linear.

export function probeFloatTargets(gl) {
  if (!gl || typeof gl.createVertexArray !== 'function') return false;
  return !!gl.getExtension('EXT_color_buffer_float');
}

export function createFloatTexture(gl, w, h, data = null) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function uploadFloatTexture(gl, tex, w, h, data) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
}

export function disposeTarget(gl, target) {
  if (!target) return;
  gl.deleteFramebuffer(target.fbo);
  gl.deleteTexture(target.tex);
}

export function createFloatTarget(gl, w, h, data = null) {
  const tex = createFloatTexture(gl, w, h, data);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) {
    disposeTarget(gl, { tex, fbo });
    return null;
  }
  return { tex, fbo, w, h };
}

export function createPingPong(gl, w, h, data = null) {
  const a = createFloatTarget(gl, w, h, data);
  const b = createFloatTarget(gl, w, h, data);
  if (!a || !b) {
    disposeTarget(gl, a);
    disposeTarget(gl, b);
    return null;
  }
  let read = a;
  let write = b;
  return {
    get read() { return read; },
    get write() { return write; },
    swap() {
      const t = read;
      read = write;
      write = t;
    },
    dispose() {
      disposeTarget(gl, a);
      disposeTarget(gl, b);
    },
  };
}

export function readTarget(gl, target) {
  const out = new Float32Array(target.w * target.h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  gl.readPixels(0, 0, target.w, target.h, gl.RGBA, gl.FLOAT, out);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return out;
}

// One texel, for a cursor probe. Same float readback rules as readTarget
// (RGBA/FLOAT needs EXT_color_buffer_float, which probeFloatTargets required).
export function readTexel(gl, target, x, y, out = new Float32Array(4)) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.FLOAT, out);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return out;
}
