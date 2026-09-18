// Scratch — a plain look at immersive, because a statistic over this window has
// now misled twice (the nav strip once, and the sticky-header/HUD reveal once).
// No masking, no threshold, no hiding: the picture as the page paints it.
//
//   node scripts/_a1shot.mjs out.png [W] [H] [DPR] [--normal]
import { launch } from './cdp.mjs';

const URL = 'http://localhost:5174/';
const OUT = process.argv[2] ?? 'lookbook/_a1-immersive.png';
const W   = Number(process.argv[3] ?? 1920);
const H   = Number(process.argv[4] ?? 1080);
const DPR = Number(process.argv[5] ?? 1);
const NORMAL = process.argv.includes('--normal');
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

if (!NORMAL) {
  if (!await page.eval(clickImmersive)) throw new Error('no Immersive control found');
  await sleep(4000);
}

const geom = await page.eval('JSON.stringify((() => {' +
  ' const c = ' + SPHERE + ';' +
  ' const q = c.getBoundingClientRect();' +
  ' const b = window.__artBgState ? window.__artBgState() : null;' +
  ' return { canvas: [+q.y.toFixed(1), +q.bottom.toFixed(1), +q.width.toFixed(1), +q.height.toFixed(1)],' +
  '          sphereR: b ? +b.sphereR.toFixed(1) : null }; })())');
await page.screenshot({ path: OUT });
console.log('wrote ' + OUT + '   ' + geom);
await page.close();
