// eyeParity.mjs — real-GPU pixel-parity gate for the ObserverEye shader.
//
// Compiles the frozen v1 fragment shader (scripts/fixtures/observerEyeFS.v1.glsl)
// and the current FS (src/terminal/components/observerEyeShader.js) on two
// 128x128 WebGL canvases, drives both with the same uniforms for every state row,
// and compares readPixels. Any uniform the current FS has that v1 lacks is set to 0.
//
//   node scripts/eyeParity.mjs     exit 0 = parity, 1 = per-row report
//
// Fail rule: a pixel "differs" if any channel is off by > 2/255; a row fails if
// more than 0.1% of its pixels differ, OR if any single channel anywhere is off
// by more than 16/255 (a few wrong pixels can still be a visible defect).
import { readFileSync } from 'node:fs';
import { launch } from './cdp.mjs';
import { VS, FS } from '../src/terminal/components/observerEyeShader.js';

const V1_FS = readFileSync(new URL('./fixtures/observerEyeFS.v1.glsl', import.meta.url), 'utf8');
const V1_UNIFORMS = ['u_t', 'u_focus', 'u_irid', 'u_speed', 'u_pulse', 'c0', 'c1', 'c2', 'u_gaze'];

// Copied from STATES in ObserverEye.jsx (this script must not import the .jsx).
const STATES = {
  resting:   { irid: 1, cols: [[210,220,232],[150,170,185],[120,200,220]], speed: 0.05, focus: 0.00, gaze: [0, 0] },
  leaning:   { irid: 0, cols: [[56,189,248],[6,182,212],[170,235,255]],    speed: 0.11, focus: 0.34, gaze: [0.12, -0.08] },
  armed:     { irid: 0, cols: [[255,215,0],[217,70,239],[255,150,60]],     speed: 0.14, focus: 0.58, gaze: [0, 0] },
  compiling: { irid: 0, cols: [[167,139,250],[122,184,0],[205,180,255]],   speed: 0.20, focus: 0.86, gaze: [0, 0] },
  complete:  { irid: 0, cols: [[20,184,166],[185,240,228],[70,205,185]],   speed: 0.07, focus: 0.22, gaze: [0, 0] },
};
// Copied from ObserverEye.jsx deriveCols.
function deriveCols(t) {
  return [
    [t[0], t[1], t[2]],
    [Math.round(t[0] * 0.5), Math.round(t[1] * 0.5), Math.round(t[2] * 0.62)],
    [Math.round((t[0] + 230) / 2), Math.round((t[1] + 240) / 2), Math.round((t[2] + 255) / 2)],
  ];
}

const nrm = c => c.map(x => x / 255);
const rows = [];
const variants = [
  ['resting', STATES.resting],
  ['leaning(tinted)', { ...STATES.leaning, cols: deriveCols([56, 189, 248]), gaze: [0.12, -0.08] }],
  ['armed', STATES.armed],
  ['compiling', STATES.compiling],
  ['complete', STATES.complete],
];
for (const [name, s] of variants) for (const t of [0, 7.3, 41.9]) for (const pulse of [0, 1]) {
  rows.push({
    label: `${name} t=${t} pulse=${pulse}`,
    u: {
      u_t: t, u_focus: s.focus, u_irid: s.irid, u_speed: s.speed, u_pulse: pulse,
      c0: nrm(s.cols[0]), c1: nrm(s.cols[1]), c2: nrm(s.cols[2]), u_gaze: s.gaze,
    },
  });
}

const PAGE = `<!doctype html><body style="margin:0"><script>
const SIZE = 128;
const VS = ${JSON.stringify(VS)};
const V1 = ${JSON.stringify(V1_FS)};
const CUR = ${JSON.stringify(FS)};
const V1U = ${JSON.stringify(V1_UNIFORMS)};
function mk(fs) {
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('no webgl');
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  gl.useProgram(p);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);   // 'straight'
  gl.viewport(0, 0, SIZE, SIZE);
  const U = {}, extra = [];
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, '');
    U[name] = gl.getUniformLocation(p, info.name);
    if (!V1U.includes(name)) extra.push({ name, type: info.type });
  }
  return { gl, U, extra };
}
function draw(h, u) {
  const { gl, U } = h;
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  for (const k of Object.keys(u)) {
    const v = u[k], loc = U[k];
    if (loc == null) continue;
    if (!Array.isArray(v)) gl.uniform1f(loc, v);
    else if (v.length === 2) gl.uniform2fv(loc, new Float32Array(v));
    else gl.uniform3fv(loc, new Float32Array(v));
  }
  for (const x of h.extra) {   // new uniforms: zero
    const loc = U[x.name];
    if (x.type === gl.FLOAT) gl.uniform1f(loc, 0);
    else if (x.type === gl.FLOAT_VEC2) gl.uniform2fv(loc, new Float32Array(2));
    else if (x.type === gl.FLOAT_VEC3) gl.uniform3fv(loc, new Float32Array(3));
    else if (x.type === gl.FLOAT_VEC4) gl.uniform4fv(loc, new Float32Array(4));
    else gl.uniform1i(loc, 0);
  }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  const px = new Uint8Array(SIZE * SIZE * 4);
  gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}
let A, B;
window.run = (rows) => {
  A = A || mk(V1); B = B || mk(CUR);
  return rows.map(r => {
    const a = draw(A, r.u), b = draw(B, r.u);
    let bad = 0, maxd = 0, lit = 0;
    for (let i = 0; i < a.length; i += 4) {
      let d = 0;
      for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
      if (d > 2) bad++;
      if (d > maxd) maxd = d;
      if (a[i + 3] > 0) lit++;
    }
    return { label: r.label, bad, maxd, lit, total: SIZE * SIZE };
  });
};
window.ready = true;
</script>`;

const page = await launch({ width: 400, height: 300 });
let failed = 0;
try {
  await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(PAGE));
  await page.waitFor('window.ready === true', { timeoutMs: 10000 });
  const res = await page.eval(`window.run(${JSON.stringify(rows)})`);
  for (const r of res) {
    const frac = r.bad / r.total;
    const ok = frac <= 0.001 && r.maxd <= 16;
    if (!ok) { failed++; console.log(`FAIL ${r.label}: ${r.bad}/${r.total} px differ (${(frac * 100).toFixed(2)}%), max channel delta ${r.maxd}/255`); }
    else if (r.lit < r.total * 0.2) { failed++; console.log(`FAIL ${r.label}: vacuous, only ${r.lit} lit pixels`); }
  }
  console.log(`eye parity: ${res.length - failed}/${res.length} rows identical`);
} catch (e) {
  console.error('eye parity: ERROR', e.message);
  failed = -1;
} finally {
  await page.close();
}
process.exit(failed === 0 ? 0 : 1);
