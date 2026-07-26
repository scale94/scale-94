// glHost.js — the shared WebGL setup and teardown for every fullscreen-quad
// fragment shader in the terminal.
//
// Owns: context creation, program build, the quad, uniform harvesting, DPR
// sizing, blend state, teardown. Owns no animation and no maths.
//
// `strategy` selects between the two setup sequences that exist in the
// codebase today. It bundles four differences that always co-occur: build
// order, whether shaders are deleted after attach, whether link status is
// checked, and whether a compile failure throws or warns. Phase 2 deletes
// 'legacy'. See docs/superpowers/specs/2026-07-26-shared-gl-harness-design.md.

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

function compile(gl, type, src, { strategy, label }) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  const ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS);
  if (!ok) {
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    if (strategy === 'lunar') {
      // Always fetch the log — the lunar path throws with the driver's
      // message, so the log is load-bearing regardless of DEV.
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`[${label}] ${kind} shader failed to compile:\n${log}`);
    }
    // Legacy only warns, and only in DEV — matches the original inline
    // helper exactly: getShaderInfoLog must not be called in a production
    // build (that would be a GL call the original never makes).
    if (import.meta.env?.DEV) console.error(`[${label}] shader`, gl.getShaderInfoLog(sh));
  }
  return sh;
}

function buildLegacy(gl, vs, fs, label) {
  // createProgram first, each shader compiled inline as it is attached —
  // preserves ObserverEye/MercuryTerminator call order exactly.
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs, { strategy: 'legacy', label }));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs, { strategy: 'legacy', label }));
  gl.linkProgram(prog);
  return prog;
}

function buildLunar(gl, vsSrc, fsSrc, label) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, { strategy: 'lunar', label });
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, { strategy: 'lunar', label });
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`[${label}] program failed to link:\n${log}`);
  }
  return prog;
}

export function createShaderHost(canvas, {
  version = 1,
  contextOptions = {},
  vs,
  fs,
  uniforms = [],
  pixelSize,
  setStyleSize = false,
  blend = 'straight',
  loseContextOnDispose = true,
  strategy = 'legacy',
  onInit = null,
  onDispose = null,
  label = 'glHost',
}) {
  const gl = canvas.getContext(version === 2 ? 'webgl2' : 'webgl', contextOptions);
  if (!gl) return null;

  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = Math.round(pixelSize * dpr);
  canvas.height = Math.round(pixelSize * dpr);
  if (setStyleSize) {
    canvas.style.width = `${pixelSize}px`;
    canvas.style.height = `${pixelSize}px`;
  }

  let prog;
  let vao = null;
  let buf = null;

  if (strategy === 'legacy') {
    prog = buildLegacy(gl, vs, fs, label);
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    const al = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  } else {
    prog = buildLunar(gl, vs, fs, label);
    gl.viewport(0, 0, canvas.width, canvas.height);
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  // onInit runs after quad setup and before main-program activation. Under
  // 'lunar' the host itself restores gl.viewport(...) to the canvas and
  // calls useProgram(prog) immediately after onInit returns — a render-to-
  // texture pass inside onInit must NOT include its own trailing viewport
  // restore, or it will emit a duplicate viewport call here.
  if (onInit) onInit(gl, { prog, vao, buf, canvas });

  if (strategy === 'lunar') {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
  }

  const harvestUniforms = () => {
    const U = {};
    for (const name of uniforms) U[name] = gl.getUniformLocation(prog, name);
    return U;
  };

  const applyBlend = () => {
    if (blend === 'straight') {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else if (blend === 'premultiplied') {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  };

  // The relative order of uniform harvesting and blend-state setup is
  // strategy-dependent — this is not arbitrary, it reproduces each live
  // component's frozen call order exactly (see glParity snapshot):
  //   legacy: getUniformLocation × N, then enable(BLEND)/blendFunc, then viewport
  //   lunar:  enable(BLEND)/blendFunc, then getUniformLocation × N (viewport already restored above)
  let U;
  if (strategy === 'legacy') {
    U = harvestUniforms();
    applyBlend();
    gl.viewport(0, 0, canvas.width, canvas.height);
  } else {
    applyBlend();
    U = harvestUniforms();
  }

  return {
    gl,
    prog,
    U,
    vao,
    buf,
    dispose() {
      // Component-owned objects first, while the program is still alive.
      if (onDispose) onDispose(gl);
      gl.deleteProgram(prog);
      if (buf) gl.deleteBuffer(buf);
      if (vao) gl.deleteVertexArray(vao);
      if (loseContextOnDispose) {
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    },
  };
}
