// Scratch — does the artwork still touch the edges of its box, through a full
// sweep of the rotation?
//
// The node-CENTRE bound is exact and rotation-invariant (1.0707 * sphereR), but
// the visible envelope is bigger than that: discs have a radius and a glow
// halo. So this measures the real thing, and it measures it ONLY inside the
// container's own rows -- the app header is rgba(0,0,0,0.9), not opaque, so the
// HUD behind it bleeds through at 10% and lands in any bbox that starts higher.
// That bleed-through is what made an earlier version of this measurement report
// artwork where there was none.
//
//   node scripts/_a1clear.mjs [W] [H] [DPR] [SAMPLES]
import { launch } from './cdp.mjs';
import { decodePng } from './_png.mjs';

const URL = 'http://localhost:5174/';
const W   = Number(process.argv[2] ?? 1920);
const H   = Number(process.argv[3] ?? 1080);
const DPR = Number(process.argv[4] ?? 1);
const N   = Number(process.argv[5] ?? 8);
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

const page = await launch({ url: URL, width: W, height: H, dpr: DPR });
await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
await sleep(2500);
if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
await page.waitFor(GL_READY, { label: 'GL composite sized', timeoutMs: 40000 });
await sleep(4000);
if (!await page.eval(clickImmersive)) throw new Error('no Immersive control found');
await sleep(4000);

const box = JSON.parse(await page.eval('JSON.stringify((() => {' +
  ' const c = ' + SPHERE + '; const q = c.getBoundingClientRect();' +
  ' const b = window.__artBgState ? window.__artBgState() : null;' +
  ' return { top: +q.y.toFixed(1), bottom: +q.bottom.toFixed(1), left: +q.x.toFixed(1),' +
  '          right: +q.right.toFixed(1), sphereR: b ? +b.sphereR.toFixed(1) : null }; })())'));

// One row inside the container, so the header's 10% bleed-through cannot enter.
const y0 = Math.ceil(box.top) + 1;
let u = null;
for (let i = 0; i < N; i++) {
  const png = await page.screenshot();
  const { data, width, height } = decodePng(png);
  const sx = width / W;
  const r0 = Math.round(y0 * sx);
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = r0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i2 = (y * width + x) * 4;
      const l = 0.2126 * data[i2] + 0.7152 * data[i2 + 1] + 0.0722 * data[i2 + 2];
      if (l < 24) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const c = v => +(v / sx).toFixed(1);
  const b = { left: c(minX), right: c(maxX), top: c(minY), bottom: c(maxY) };
  u = u ? { left: Math.min(u.left, b.left), right: Math.max(u.right, b.right),
            top: Math.min(u.top, b.top), bottom: Math.max(u.bottom, b.bottom) } : b;
  await sleep(1100);
}

const MAXK = 2.8 / Math.sqrt(2.8 * 2.8 - 1);
console.log('\nviewport ' + W + 'x' + H + ' @' + DPR + '   container y ' + box.top + ' -> ' + box.bottom +
            '   sphereR ' + box.sphereR + '   node-centre bound +-' + (box.sphereR * MAXK).toFixed(1));
console.log('swept ink over ' + N + ' samples, rows >= ' + y0 + ' only');
console.log('   x ' + u.left + ' -> ' + u.right + '   y ' + u.top + ' -> ' + u.bottom);
console.log('   CLEARANCE   top ' + (u.top - box.top).toFixed(1) +
            '   bottom ' + (box.bottom - u.bottom).toFixed(1) +
            '   left ' + (u.left - box.left).toFixed(1) +
            '   right ' + (box.right - u.right).toFixed(1));
console.log('   ' + (u.top - box.top >= 1 && box.bottom - u.bottom >= 1
  ? 'the envelope is inside its box on both vertical edges'
  : 'FLUSH — the envelope still reaches an edge'));
await page.close();
