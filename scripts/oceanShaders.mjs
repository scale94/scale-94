// Compiles and links every Ledger ocean program (sim, composite, river parcels) in real headless Chrome
// (SwiftShader). jsdom has no GL, so this is where a GLSL error surfaces.
//
//   node scripts/oceanShaders.mjs
import { launch } from './cdp.mjs';
import { SIM_VS, SIM_PROGRAMS, COMPOSITE_FS } from '../src/terminal/ledger/ocean/gpu/shaders.js';
import { PARTICLE_VS, PARTICLE_FS } from '../src/terminal/ledger/ocean/gpu/particleShaders.js';

const programs = { composite: [SIM_VS, COMPOSITE_FS], particles: [PARTICLE_VS, PARTICLE_FS] };
for (const [name, p] of Object.entries(SIM_PROGRAMS)) programs[name] = [SIM_VS, p.fs];

const page = await launch({ url: 'about:blank', width: 320, height: 240 });
let failed = false;
try {
  const result = await page.eval(`(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return { __error: 'no webgl2 context' };
    const P = ${JSON.stringify(programs)};
    const out = { __extColorBufferFloat: !!gl.getExtension('EXT_color_buffer_float') };
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return { s, ok: gl.getShaderParameter(s, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(s) };
    };
    for (const [name, [vs, fs]] of Object.entries(P)) {
      const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
      const p = gl.createProgram(); gl.attachShader(p, v.s); gl.attachShader(p, f.s); gl.linkProgram(p);
      const linked = gl.getProgramParameter(p, gl.LINK_STATUS);
      out[name] = { ok: v.ok && f.ok && linked, vs: v.log, fs: f.log, link: gl.getProgramInfoLog(p) };
    }
    return out;
  })()`);
  console.log(JSON.stringify(result, null, 2));
  failed = !!result.__error || !result.__extColorBufferFloat || Object.entries(result).some(([k, r]) => !k.startsWith('__') && !r.ok);
} finally {
  await page.close();
}
process.exit(failed ? 1 : 0);
