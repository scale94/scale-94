// Scratch (post-step5 task 1) — find the FIRST pumped frame at which two runs
// of the same build diverge, and what differs there.
//
// A recorder registered as a virtual rAF runs once per pumped frame, after the
// app's draw (it is queued later), so it sees each frame's result. It records:
//   e0    the first edge instance's projected endpoint — the world's position
//   rnd   Math.random() at end of frame — the RNG STREAM OFFSET. The shim
//         re-seeds at the start of every frame, so this value is a function of
//         how many draws were taken during the frame and by whom. If it moves,
//         something other than the app consumed from the stream, or the rAF
//         callbacks ran in a different order.
//   q     how many callbacks were in the frame's batch
import { launch } from './cdp.mjs';
import { writeFileSync } from 'node:fs';

const URL = 'http://localhost:5174/';
const OUT = process.argv[2] ?? 'baseline/t9trace-a.json';
// Scale is an argument now. The @1x trace showed the world bit-identical for
// all 1740 frames while the @2x capture diverged, so a probe pinned to one
// scale cannot see the fault it is being asked about.
const W = Number(process.argv[3] ?? 1520);
const H = Number(process.argv[4] ?? 900);
const DPR = Number(process.argv[5] ?? 1);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SPHERE = `[...document.querySelectorAll('canvas')]
  .filter(c => c.offsetParent && !c.closest('[data-art-composite]'))
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;
const SPHERE_READY = `(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 800; })()`;
const GL_READY = `(() => {
  const w = document.querySelector('[data-art-composite]');
  const g = w && w.querySelector('canvas');
  const c = ${SPHERE};
  return !!g && !!c && g.width >= c.clientWidth * 0.9 && g.width > 800;
})()`;
const clickByText = (p, f='i') => `(() => { const re = new RegExp(${JSON.stringify(p)}, ${JSON.stringify(f)});
  const b = [...document.querySelectorAll('button')].find(e => re.test(e.innerText || ''));
  if (!b) return false; b.click(); return true; })()`;
const clickByTitle = (frag) => `(() => {
  const b = [...document.querySelectorAll('button')].find(e => (e.title || '').includes(${JSON.stringify(frag)}));
  if (!b) return false; b.click(); return true; })()`;

const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
await sleep(2500);
if (!await page.eval(clickByText('/CHAOS'))) throw new Error('no /CHAOS nav button');
await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
await page.waitFor(GL_READY, { label: 'GL composite sized', timeoutMs: 40000 });
await sleep(4000);
await page.eval('window.__virtualize()');
await sleep(150);
await page.eval('window.__reseed(); window.__artHarnessReset();');

await page.eval(`(() => {
  window.__trace = [];
  const pick = () => ${SPHERE};
  (function loop() { requestAnimationFrame(() => {
    const e = window.__artEdgeState(), b = window.__artBgState();
    const c = pick();
    window.__trace.push([
      +e.first[0].toFixed(3), +e.first[1].toFixed(3), e.count,
      +b.rot.ry.toFixed(5), +b.sphereR.toFixed(3),
      c.width + 'x' + c.height, +Math.random().toFixed(8), window.__queued(),
    ]);
    loop();
  }); })();
})()`);

// Mirror artBaseline's immersive sequence exactly, INCLUDING the resize
// delivery. Clicking and then pumping straight away is the race this task
// removed: whether React's commit lands inside the CDP round trip decides which
// size the settle runs at. A probe that keeps the old order will keep
// reproducing the old divergence and read as if nothing was fixed.
const deliver = async () => {
  await page.screenshot();     // forces layout; costs zero frames
  await sleep(250);            // lets the observer and React commit land
  await page.pump(1);          // r3f applies the size inside a frame
};
// MIRROR artBaseline's immersive preamble exactly, including the real hover
// input and its 25ms settle. The trace used to skip both and reported the world
// bit-identical for all 1740 frames while the capture it was standing in for
// split into two worlds 3 runs in 8 — a probe that omits the one real input in
// the window cannot see a race that lives in it.
const away = await page.eval(`(() => { const c = ${SPHERE}; const r = c.getBoundingClientRect();
  return { x: Math.round(r.x + 24), y: Math.round(r.y + 18) }; })()`);

const at = [];
await page.pump(240);                      at.push(['after pump(240)', 240]);
await page.hover(away.x, away.y);
await sleep(25);
await page.pump(30);                       at.push(['hovered away + pump(30)', 270]);
await page.eval(clickByTitle('Immersive mode'));
await deliver();
await page.pump(749);                      at.push(['immersive on, delivered + pump(749)', 1019]);
// The capture spends 600 frames between the two shots; without them the
// window this probe exists to search is 600 frames shorter than the real one.
await page.pump(600);                      at.push(['immersive settle pump(600)', 1619]);
await page.eval(clickByTitle('Immersive mode'));
await deliver();
await page.pump(749);                      at.push(['immersive off, delivered + pump(749)', 2368]);

const trace = JSON.parse(await page.eval('JSON.stringify(window.__trace)'));
writeFileSync(OUT, JSON.stringify({ marks: at, trace }));
console.log(`${OUT}: ${trace.length} frames traced`);
await page.close();
