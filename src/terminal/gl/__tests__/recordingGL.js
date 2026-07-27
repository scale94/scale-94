// recordingGL.js — a stub WebGL context that records every call.
//
// Handles are tagged so the log is readable and, more importantly, so a
// swapped or dropped uniform is visible. An untagged {} serialises the same
// for every uniform, which would hide the exact class of bug these snapshots
// exist to catch.

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const CONSTANTS = {
  VERTEX_SHADER: 0x8b31, FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81, LINK_STATUS: 0x8b82,
  ARRAY_BUFFER: 0x8892, STATIC_DRAW: 0x88e4, FLOAT: 0x1406,
  TRIANGLE_STRIP: 0x0005, COLOR_BUFFER_BIT: 0x4000,
  BLEND: 0x0be2, DEPTH_TEST: 0x0b71,
  SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303, ONE: 1,
  TEXTURE_2D: 0x0de1, TEXTURE0: 0x84c0, RGBA: 0x1908, RGBA8: 0x8058,
  UNSIGNED_BYTE: 0x1401, LINEAR: 0x2601, REPEAT: 0x2901,
  CLAMP_TO_EDGE: 0x812f,
  TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
  TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
  FRAMEBUFFER: 0x8d40, COLOR_ATTACHMENT0: 0x8ce0,
};

const V1_METHODS = [
  'createShader', 'shaderSource', 'compileShader', 'getShaderParameter',
  'getShaderInfoLog', 'deleteShader',
  'createProgram', 'attachShader', 'linkProgram', 'getProgramParameter',
  'getProgramInfoLog', 'deleteProgram', 'useProgram',
  'createBuffer', 'bindBuffer', 'bufferData', 'deleteBuffer',
  'getAttribLocation', 'enableVertexAttribArray', 'vertexAttribPointer',
  'getUniformLocation',
  'uniform1f', 'uniform1i', 'uniform2f', 'uniform2fv', 'uniform3fv',
  'enable', 'disable', 'blendFunc', 'viewport',
  'clearColor', 'clear', 'drawArrays',
  'createTexture', 'bindTexture', 'texImage2D', 'texParameteri',
  'activeTexture', 'deleteTexture',
  'createFramebuffer', 'bindFramebuffer', 'framebufferTexture2D',
  'deleteFramebuffer',
  'getExtension',
];

const V2_ONLY = ['createVertexArray', 'bindVertexArray', 'deleteVertexArray', 'texStorage2D'];

export function createRecordingGL({ version = 2 } = {}) {
  const log = [];
  let seq = 0;
  const attribIndices = new Map();
  const gl = { ...CONSTANTS, __log: log, __version: version };

  const tag = (kind) => ({ __tag: `${kind}:${seq++}` });

  const norm = (v) => {
    if (v === null || v === undefined) return v;
    if (typeof v === 'object') {
      if (v.__tag) return v.__tag;
      if (ArrayBuffer.isView(v)) return Array.from(v);
      return '<obj>';
    }
    return v;
  };

  const methods = version === 2 ? [...V1_METHODS, ...V2_ONLY] : V1_METHODS;
  for (const name of methods) {
    gl[name] = (...args) => { log.push([name, ...args.map(norm)]); };
  }

  // Overrides: anything that must return a usable value.
  gl.createShader   = (type) => { log.push(['createShader', type]); return tag('shader'); };
  gl.createProgram  = () => { log.push(['createProgram']); return tag('program'); };
  gl.createBuffer   = () => { log.push(['createBuffer']); return tag('buffer'); };
  gl.createTexture  = () => { log.push(['createTexture']); return tag('texture'); };
  gl.createFramebuffer = () => { log.push(['createFramebuffer']); return tag('fbo'); };
  gl.getAttribLocation = (p, n) => {
    log.push(['getAttribLocation', norm(p), n]);
    if (!attribIndices.has(n)) attribIndices.set(n, attribIndices.size);
    return attribIndices.get(n);
  };
  gl.getUniformLocation = (p, n) => {
    log.push(['getUniformLocation', norm(p), n]);
    return { __tag: `uniform:${norm(p)}:${n}` };
  };
  gl.getShaderParameter  = (s, p) => { log.push(['getShaderParameter', norm(s), p]); return true; };
  gl.getProgramParameter = (p, k) => { log.push(['getProgramParameter', norm(p), k]); return true; };
  gl.getShaderInfoLog  = (s) => { log.push(['getShaderInfoLog', norm(s)]); return ''; };
  gl.getProgramInfoLog = (p) => { log.push(['getProgramInfoLog', norm(p)]); return ''; };
  gl.shaderSource = (s, src) => {
    log.push(['shaderSource', norm(s), `src:${src.length}:${fnv1a(src)}`]);
  };
  gl.getExtension = (name) => {
    log.push(['getExtension', name]);
    return name === 'WEBGL_lose_context'
      ? { loseContext: () => log.push(['loseContext']) }
      : null;
  };
  if (version === 2) {
    gl.createVertexArray = () => { log.push(['createVertexArray']); return tag('vao'); };
  }

  return gl;
}

export function installRecordingGL({ version = 2 } = {}) {
  const gl = createRecordingGL({ version });
  const original = HTMLCanvasElement.prototype.getContext;
  const wanted = version === 2 ? 'webgl2' : 'webgl';
  HTMLCanvasElement.prototype.getContext = function (type) {
    return type === wanted ? gl : null;
  };
  return {
    gl,
    log: gl.__log,
    restore() { HTMLCanvasElement.prototype.getContext = original; },
  };
}
