// Item 5b — THE IMMERSIVE SCALING LAW, re-measured after the inset.
//
// The author's complaint, and the measurement behind it: on the immersive
// toggle `sphereR` went 240.7 -> 376.0 (1.562x) while the node disc radius went
// 1.029x and the edge line width 0.982x. `project()` returns
// scale = FOCAL_K / (FOCAL_K + rz), which is independent of sphereR, so THE
// CAGE GROWS AND THE INK DOES NOT -- proportionally sparser and thinner, worse
// the taller the display. That is very likely behind the "sparse, oversized
// outer cage" in the first report.
//
// `dc397b2` insets the immersive container below the app header, so
// min(w, h) -- and therefore sphereR -- is smaller than it was. This asks how
// much of the divergence is left, BEFORE anyone changes a constant to chase it.
//
// All three numbers come out of one buffer, so they cannot drift apart:
// `__artEdgeState().instances`, read at `EDGE_STRIDE` with float 14 as `width`.
// The sign is the discriminator the shader itself uses -- `width <= 0` is a
// disc, and its radius is `abs(width) * 0.5`; anything positive is a line
// width. Read over the `worldCount` PREFIX only, so the conductor's
// screen-space furniture cannot enter a statistic about the graph.
//
// Medians, not means: the disc set has a hovered node and a beacon in it, and
// the edge set has the resonance edge, so a mean is reporting the outliers.
//
//   node scripts/_a2scale.mjs [W] [H] [DPR]
import { launch } from './cdp.mjs';
import { EDGE_STRIDE } from '../src/terminal/art/SphereEdges.js';

const URL = 'http://localhost:5174/';
const W   = Number(process.argv[2] ?? 1520);
const H   = Number(process.argv[3] ?? 900);
const DPR = Number(process.argv[4] ?? 1);
const WIDTH_OFF = 14;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 800; })()';
const GL_READY = '(() => {' +
  ' const w = document.querySelector("[data-art-composite]");' +
  ' const g = w && w.querySelector("canvas");' +
  ' const c = ' + SPHERE + ';' +
  ' return !!g && !!c && g.width >= c.clientWidth * 0.9 && g.width > 800; })()';
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';
const clickImmersive = '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => /immersive/i.test((e.innerText || "") + " " + (e.title || "") + " " + (e.getAttribute("aria-label") || "")));' +
  ' if (!b) return false; b.click(); return true; })()';

const READ = 'JSON.stringify((() => {' +
  ' const b = window.__artBgState ? window.__artBgState() : null;' +
  ' const e = window.__artEdgeState ? window.__artEdgeState() : null;' +
  ' const c = ' + SPHERE + '; const q = c.getBoundingClientRect();' +
  ' return { sphereR: b ? b.sphereR : null, stride: e ? e.stride : null,' +
  '          worldCount: e ? e.worldCount : null, count: e ? e.count : null,' +
  '          instances: e ? e.instances : null,' +
  '          box: [+q.width.toFixed(1), +q.height.toFixed(1)] }; })())';

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function stats(raw) {
  if (raw.stride !== EDGE_STRIDE) {
    throw new Error('stride drift: page says ' + raw.stride + ', import says ' + EDGE_STRIDE);
  }
  const n = Number.isFinite(raw.worldCount) ? raw.worldCount : raw.count;
  const lines = [], discs = [];
  for (let i = 0; i < n; i++) {
    const w = raw.instances[i * EDGE_STRIDE + WIDTH_OFF];
    if (w <= 0) discs.push(Math.abs(w) * 0.5); else lines.push(w);
  }
  return {
    sphereR: raw.sphereR,
    box: raw.box.join('x'),
    world: n,
    lineW: median(lines), lines: lines.length,
    discR: median(discs), discs: discs.length,
    lineMax: lines.length ? Math.max(...lines) : null,
    discMax: discs.length ? Math.max(...discs) : null,
  };
}

const page = await launch({ url: URL, width: W, height: H, dpr: DPR });
await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
await sleep(2500);
if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
await page.waitFor(GL_READY, { label: 'GL composite sized', timeoutMs: 40000 });
await sleep(4000);

const norm = stats(JSON.parse(await page.eval(READ)));
if (!await page.eval(clickImmersive)) throw new Error('no Immersive control found');
await sleep(4500);
const imm = stats(JSON.parse(await page.eval(READ)));
await page.close();

const r = (a, b) => (b == null || a == null || a === 0) ? null : +(b / a).toFixed(3);
const line = (label, a, b, unit) =>
  '   ' + label.padEnd(18) + String(a == null ? '-' : a.toFixed(3)).padStart(9) +
  '  ->' + String(b == null ? '-' : b.toFixed(3)).padStart(9) +
  '   x' + String(r(a, b) ?? '-').padStart(7) + (unit ? '   ' + unit : '');

console.log('\n== IMMERSIVE SCALING LAW at ' + W + 'x' + H + ' @' + DPR);
console.log('   box              ' + norm.box.padStart(9) + '  ->' + imm.box.padStart(10));
console.log('   world instances  ' + String(norm.world).padStart(9) + '  ->' + String(imm.world).padStart(10));
console.log(line('sphereR', norm.sphereR, imm.sphereR, 'the cage'));
console.log(line('node disc radius', norm.discR, imm.discR, 'median of ' + norm.discs + ' / ' + imm.discs));
console.log(line('edge line width', norm.lineW, imm.lineW, 'median of ' + norm.lines + ' / ' + imm.lines));
console.log(line('disc radius max', norm.discMax, imm.discMax, ''));
console.log(line('line width max', norm.lineMax, imm.lineMax, ''));

const cage = r(norm.sphereR, imm.sphereR);
const ink  = r(norm.discR, imm.discR);
console.log('\n   DIVERGENCE  cage x' + cage + '  against disc ink x' + ink +
            '   =  ' + (cage / ink).toFixed(3) + 'x sparser');
console.log('   was 1.562 / 1.029 = 1.518x sparser before the inset (dc397b2)');
