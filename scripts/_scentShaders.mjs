// Compiles and links every /SCENT chamber program in real headless Chrome
// (SwiftShader). jsdom has no GL, so this is the only place a GLSL typo shows
// up before the browser. Programs whose module does not exist yet are skipped.
//
//   node scripts/_scentShaders.mjs
import { launch } from './cdp.mjs';

const SOURCES = [
  ['field', ['../src/terminal/collider/fieldShader.js'], (m) => [m.FIELD_VS, m.FIELD_FS]],
  ['streak', ['../src/terminal/collider/streakShader.js', '../src/terminal/collider/ribbonShader.js'],
    (m, r) => [m.STREAK_VS, r.RIBBON_FS]],
  ['cage', ['../src/terminal/collider/cageShader.js', '../src/terminal/collider/ribbonShader.js'],
    (m, r) => [m.CAGE_VS, r.RIBBON_FS]],
  ['composite', ['../src/terminal/collider/compositeShader.js'], (m) => [m.COMPOSITE_VS, m.COMPOSITE_FS]],
];

const programs = {};
const skipped = [];
for (const [name, paths, pick] of SOURCES) {
  try {
    const mods = [];
    for (const p of paths) mods.push(await import(new URL(p, import.meta.url)));
    programs[name] = pick(...mods);
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') skipped.push(name);
    else throw e;
  }
}

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
  if (skipped.length) console.log('skipped (module not written yet):', skipped.join(', '));
  failed = !!result.__error || Object.entries(result).some(([k, r]) => !k.startsWith('__') && !r.ok);
} finally {
  await page.close();
}
process.exit(failed ? 1 : 0);
