// artFrameTime.mjs — wall-clock frame budget for the /art sphere, on real GPU.
//
// Companion to artBaseline.mjs, which answers "does it still look the same".
// This answers "is it still fast enough", and it deliberately does NOT use the
// determinism shim: virtual frames have no wall clock.
//
// Runs HEADED by default, because that is the only way to get a truthful
// number. Headless SwiftShader renders Canvas2D in software and drives rAF
// unthrottled at ~350fps, so both its frame interval and its per-frame cost
// describe a machine nobody is exhibiting on. Pass --headless to compare the
// two renderers; do not mistake the headless figure for a frame budget.
//
// Two measurements, because they answer different questions:
//   interval  — ms between rAF callbacks. Capped by vsync, so on a healthy
//               60Hz machine this pins to ~16.7 and only reveals dropped
//               frames. This is what the user experiences.
//   drawCost  — ms of main-thread work inside the draw callback. Not capped by
//               anything, so it shows headroom: 6ms of work in a 16.7ms budget
//               is fine, 15ms is one GC away from stutter. This is the number
//               steps 2-6 have to move.
//
//   node scripts/artFrameTime.mjs [--headless] [--seconds 10]

import { mkdir, writeFile } from 'node:fs/promises';
import { launch } from './cdp.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const SECONDS  = Number(arg('--seconds', 10));
const HEADLESS = process.argv.includes('--headless');
const OUT      = arg('--out', 'baseline/art-sphere-2d');
const URL      = arg('--url', 'http://localhost:5174/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = `[...document.querySelectorAll('canvas')].filter(c => c.offsetParent)
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;

// Wrap rAF to record both the gap between frames and the cost of each callback.
const PROBE = `(() => {
  window.__samples = { interval: [], draw: [], all: [] };
  let last = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => orig((t) => {
    const now = performance.now();
    if (last) window.__samples.interval.push(now - last);
    last = now;
    const t0 = performance.now();
    cb(t);
    const dt = performance.now() - t0;
    window.__samples.all.push(dt);
    if (cb.name === 'draw') window.__samples.draw.push(dt);
  });
  window.__reset = () => { window.__samples = { interval: [], draw: [], all: [] }; last = 0; };
})()`;

function stats(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const q = p => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return {
    n: s.length,
    mean: +(s.reduce((t, v) => t + v, 0) / s.length).toFixed(2),
    p50: +q(0.5).toFixed(2), p90: +q(0.9).toFixed(2),
    p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2),
    max: +s[s.length - 1].toFixed(2),
  };
}

const page = await launch({
  url: URL, width: 1520, height: 900, dpr: 1, headless: HEADLESS,
});

await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
await sleep(3500);
await page.eval(`(() => { const b = [...document.querySelectorAll('button')].find(e => /\\/CHAOS/i.test(e.innerText || '')); if (!b) throw new Error('no /CHAOS nav'); b.click(); })()`);
await page.waitFor(`(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 800; })()`, { label: 'sphere' });
await sleep(3000);
await page.eval(PROBE);

const rect = await page.eval(`(() => { const c = ${SPHERE}; const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
const cx = Math.round(rect.x + rect.w / 2), cy = Math.round(rect.y + rect.h / 2);

// ── idle ────────────────────────────────────────────────────────────────────
await page.hover(Math.round(rect.x + 20), Math.round(rect.y + 15));
await sleep(500);
await page.eval('window.__reset()');
await sleep(SECONDS * 1000);
const idle = await page.eval('window.__samples');

// ── drag: held down, moved continuously for the whole window ────────────────
await page.mouse('mousePressed', cx + 200, cy, { button: 'left', clickCount: 1 });
await page.eval('window.__reset()');
const t0 = Date.now();
let i = 0;
while (Date.now() - t0 < SECONDS * 1000) {
  const a = (i++ / 25) * Math.PI * 2;
  await page.mouse('mouseMoved', Math.round(cx + Math.cos(a) * 200), Math.round(cy + Math.sin(a) * 90), { button: 'left' });
  await sleep(16);
}
const drag = await page.eval('window.__samples');
await page.mouse('mouseReleased', cx, cy, { button: 'left', clickCount: 1 });

// ── immersive ───────────────────────────────────────────────────────────────
// The exhibit mode, and until now the one this instrument could not see. It is
// not a cosmetic difference: immersive goes full-viewport, and since the
// containing-block fix it really does — 1520x900 rather than the 1446x580 the
// two states above measure, which is 1.6x the pixels through every full-screen
// pass, and ~3.3x what it was while the letterbox bug was in force.
//
// There is no earlier immersive figure to compare against, deliberately: every
// one that could have existed was captured in the letterbox strip. The 16.7 ms
// budget is absolute, so the number stands on its own.
await page.hover(Math.round(rect.x + 20), Math.round(rect.y + 15));
await sleep(500);
const immersiveOn = await page.eval(`(() => { const b = [...document.querySelectorAll('button')]
  .find(e => (e.title || '').includes('Immersive mode')); if (!b) return false; b.click(); return true; })()`);
if (!immersiveOn) throw new Error('no immersive button');
await sleep(6000);                                  // rAF-driven resize, real time
const immRect = await page.eval(`(() => { const c = ${SPHERE}; const r = c.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) }; })()`);
await page.eval('window.__reset()');
await sleep(SECONDS * 1000);
const immersive = await page.eval('window.__samples');

const result = {
  capturedAt: new Date().toISOString(),
  gitCommit: process.env.BASELINE_COMMIT ?? null,
  renderer: HEADLESS ? 'headless chrome + swiftshader (SOFTWARE — not a frame budget)' : 'headed chrome, real GPU',
  seconds: SECONDS,
  viewport: { width: 1520, height: 900, dpr: 1 },
  sphereCss: { w: Math.round(rect.w), h: Math.round(rect.h) },
  immersiveCss: immRect,
  idle: { intervalMs: stats(idle.interval), drawCostMs: stats(idle.draw), allRafCostMs: stats(idle.all) },
  drag: { intervalMs: stats(drag.interval), drawCostMs: stats(drag.draw), allRafCostMs: stats(drag.all) },
  immersive: { intervalMs: stats(immersive.interval), drawCostMs: stats(immersive.draw), allRafCostMs: stats(immersive.all) },
};

const label = HEADLESS ? 'headless-swiftshader' : 'headed-gpu';
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/frametime-${label}.json`, JSON.stringify(result, null, 2));

const row = (name, s) => `   ${name.padEnd(22)} p50 ${String(s?.p50).padStart(7)}  p95 ${String(s?.p95).padStart(7)}  p99 ${String(s?.p99).padStart(7)}  max ${String(s?.max).padStart(8)}  n=${s?.n}`;
console.log(`\n${result.renderer}  ·  ${SECONDS}s per state  ·  sphere ${result.sphereCss.w}x${result.sphereCss.h}`);
console.log('\nIDLE');
console.log(row('rAF interval ms', result.idle.intervalMs));
console.log(row('draw cost ms', result.idle.drawCostMs));
console.log(row('all rAF cost ms', result.idle.allRafCostMs));
console.log('\nDRAG');
console.log(row('rAF interval ms', result.drag.intervalMs));
console.log(row('draw cost ms', result.drag.drawCostMs));
console.log(row('all rAF cost ms', result.drag.allRafCostMs));
console.log(`\nIMMERSIVE  (sphere ${immRect.w}x${immRect.h})`);
console.log(row('rAF interval ms', result.immersive.intervalMs));
console.log(row('draw cost ms', result.immersive.drawCostMs));
console.log(row('all rAF cost ms', result.immersive.allRafCostMs));
console.log(`\nwrote ${OUT}/frametime-${label}.json`);

await page.close();
