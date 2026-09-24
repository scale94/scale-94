// accumTarget.js — the chamber's RGBA16F accumulator (spec §3).
//
// Why half-float: an RGBA8 target clamps at 255 INSIDE the blend unit, so no
// knee applied afterwards can recover the colour of overlapping ribbons (the
// /art sphere learned this the hard way). The accumulator is cleared every
// frame -- it is not a trail buffer -- so a frame stays a pure function of its
// inputs. Absent EXT_color_buffer_float, or if the attachment is incomplete,
// the chamber screen-blends straight into the canvas instead.

export function createAccumTarget(gl, w, h) {
  const screen = { mode: 'screen', fbo: null, tex: null, w, h };
  if (!gl.getExtension('EXT_color_buffer_float')) return screen;

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  if (!complete) {
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
    return screen;
  }
  return { mode: 'half-float', fbo, tex, w, h };
}

// Resize path only (the ResizeObserver) -- never per frame.
export function resizeAccumTarget(gl, A, w, h) {
  if (A.mode !== 'half-float' || (A.w === w && A.h === h)) return A;
  gl.bindTexture(gl.TEXTURE_2D, A.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  A.w = w;
  A.h = h;
  return A;
}

export function deleteAccumTarget(gl, A) {
  if (A.fbo) gl.deleteFramebuffer(A.fbo);
  if (A.tex) gl.deleteTexture(A.tex);
  A.fbo = null;
  A.tex = null;
  A.mode = 'screen';
}
