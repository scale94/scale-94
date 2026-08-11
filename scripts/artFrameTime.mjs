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
// Four windows, in this order: idle, drag, immersive, idle AGAIN. The last one
// is not a duplicate — it is the drift control. This machine warms over the
// first minutes of a session by more than the difference between the states, so
// without re-measuring the opening state at the end, "immersive is cheapest"
// and "immersive was measured last" are the same observation.
//
//   node scripts/artFrameTime.mjs [--headless] [--seconds 10]

import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { launch } from './cdp.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const SECONDS  = Number(arg('--seconds', 10));
const HEADLESS = process.argv.includes('--headless');
const OUT      = arg('--out', 'baseline/art-sphere-2d');
const URL      = arg('--url', 'http://localhost:5174/');
const VIEW     = { width: 1520, height: 900, dpr: 1 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Provenance, derived rather than declared. The committed
// baseline/art-sphere-trail/frametime-headed-gpu.json recorded `"gitCommit":
// null` because it depended on BASELINE_COMMIT being exported, which makes the
// artefact indistinguishable from a control-worktree run of the same script —
// and this project measures against same-session control worktrees as a matter
// of routine. `git rev-parse` in the cwd answers for the worktree the server is
// actually serving, which is the thing that needs recording.
function gitProvenance() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  try {
    return {
      gitCommit: git('rev-parse', '--short', 'HEAD'),
      gitBranch: git('rev-parse', '--abbrev-ref', 'HEAD'),
      // -uno: this repo carries untracked baseline/ scratch dirs permanently,
      // so only tracked modifications say anything about what was measured.
      gitDirty: git('status', '--porcelain', '-uno').length > 0,
    };
  } catch {
    return { gitCommit: process.env.BASELINE_COMMIT ?? null, gitBranch: null, gitDirty: null };
  }
}

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
  url: URL, width: VIEW.width, height: VIEW.height, dpr: VIEW.dpr, headless: HEADLESS,
});

await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
await sleep(3500);
await page.eval(`(() => { const b = [...document.querySelectorAll('button')].find(e => /\\/CHAOS/i.test(e.innerText || '')); if (!b) throw new Error('no /CHAOS nav'); b.click(); })()`);
await page.waitFor(`(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 800; })()`, { label: 'sphere' });
await sleep(3000);
await page.eval(PROBE);

const GEOM = `(() => { const c = ${SPHERE}; const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height,
           vw: window.innerWidth, vh: window.innerHeight }; })()`;
const geometry = async () => {
  const g = await page.eval(GEOM);
  return { ...g, w: Math.round(g.w), h: Math.round(g.h) };
};

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
//
// ── The geometry is ASSERTED, not assumed ──────────────────────────────────
// This block used to `sleep(6000)` and record whatever it found. The control
// worktree at 6401a7b measured 1456x324 — the letterbox strip — and produced a
// perfectly plausible p50/p95/p99 for it. Nothing in the script objected; a
// human reading the number caught it. On a slower machine, or with the
// containing-block bug back, the same silence would write a frame time for the
// wrong mode into a committed JSON labelled "immersive".
//
// So: poll for the geometry instead of sleeping a guess, and refuse to record
// anything unless the sphere really did reach the viewport.
const IMMERSIVE_MIN = 0.98;   // fraction of the viewport the sphere must fill
const assertImmersive = (g, when) => {
  if (g.h >= g.vh * IMMERSIVE_MIN && g.w >= g.vw * IMMERSIVE_MIN) return;
  throw new Error(
    `immersive geometry wrong ${when}: sphere ${g.w}x${g.h} against viewport ${g.vw}x${g.vh}`
    + ` (need >= ${Math.round(g.vw * IMMERSIVE_MIN)}x${Math.round(g.vh * IMMERSIVE_MIN)}).`
    + ' The mode did not engage, or engaged into a letterboxed strip — see the'
    + ' .tab-fade-v2 containing-block bug fixed in 31bff8a. Refusing to record a'
    + ' frame time labelled "immersive".');
};

await page.hover(Math.round(rect.x + 20), Math.round(rect.y + 15));
await sleep(500);
const immersiveOn = await page.eval(`(() => { const b = [...document.querySelectorAll('button')]
  .find(e => (e.title || '').includes('Immersive mode')); if (!b) return false; b.click(); return true; })()`);
if (!immersiveOn) throw new Error('no immersive button');

// The resize lands on a real rAF tick after a React state change. How many ms
// that takes is a property of the machine, not of the build, so poll for it.
await page.waitFor(
  `(() => { const c = ${SPHERE}; if (!c) return false; const r = c.getBoundingClientRect();
    return r.height >= window.innerHeight * ${IMMERSIVE_MIN} && r.width >= window.innerWidth * ${IMMERSIVE_MIN}; })()`,
  { timeoutMs: 30000, intervalMs: 250, label: 'immersive resize' },
).catch(async (e) => { assertImmersive(await geometry(), 'after the resize wait'); throw e; });
await sleep(500);                                   // let the first resized frames settle

const immGeom = await geometry();
assertImmersive(immGeom, 'before measuring');
const immRect = { w: immGeom.w, h: immGeom.h };
await page.eval('window.__reset()');
await sleep(SECONDS * 1000);
const immersive = await page.eval('window.__samples');
assertImmersive(await geometry(), 'after measuring');   // it must still be immersive

// ── idle again: the drift control ───────────────────────────────────────────
// Immersive is measured LAST in every run, and this machine warms monotonically
// over the first ~5 minutes of a session: p99 falls 3-5 ms on identical code,
// which is larger than any difference between the three states. An always-last
// state reading lowest is exactly what warm-up alone predicts, so an ordering
// claim ("immersive is the cheapest state") cannot be made from idle/drag/
// immersive alone — the run has to carry its own estimate of how much it moved
// while it was running.
//
// So: leave immersive, re-measure the state the run OPENED with, and record the
// difference. Read `drift` before believing any cross-state ordering in this
// file; if it is the size of the effect, the ordering is warm-up, not cost.
await page.eval(`(() => { const b = [...document.querySelectorAll('button')]
  .find(e => (e.title || '').includes('Immersive mode')); if (b) b.click(); })()`);
await page.waitFor(
  `(() => { const c = ${SPHERE}; if (!c) return false;
    return c.getBoundingClientRect().height < window.innerHeight * ${IMMERSIVE_MIN}; })()`,
  { timeoutMs: 30000, intervalMs: 250, label: 'immersive exit' },
);
await sleep(1500);
await page.hover(Math.round(rect.x + 20), Math.round(rect.y + 15));
await sleep(500);
await page.eval('window.__reset()');
await sleep(SECONDS * 1000);
const idleAfter = await page.eval('window.__samples');

const idleDraw = stats(idle.draw), idleAfterDraw = stats(idleAfter.draw);
const drift = {
  note: 'idleAfter minus idle, same state, same code, ~40s apart. This is the '
      + 'floor on any cross-state comparison in this file.',
  drawCostMs: idleDraw && idleAfterDraw ? {
    p50: +(idleAfterDraw.p50 - idleDraw.p50).toFixed(2),
    p95: +(idleAfterDraw.p95 - idleDraw.p95).toFixed(2),
    p99: +(idleAfterDraw.p99 - idleDraw.p99).toFixed(2),
  } : null,
};

const result = {
  capturedAt: new Date().toISOString(),
  ...gitProvenance(),
  url: URL,
  renderer: HEADLESS ? 'headless chrome + swiftshader (SOFTWARE — not a frame budget)' : 'headed chrome, real GPU',
  seconds: SECONDS,
  viewport: { ...VIEW },
  sphereCss: { w: Math.round(rect.w), h: Math.round(rect.h) },
  immersiveCss: immRect,
  idle: { intervalMs: stats(idle.interval), drawCostMs: stats(idle.draw), allRafCostMs: stats(idle.all) },
  drag: { intervalMs: stats(drag.interval), drawCostMs: stats(drag.draw), allRafCostMs: stats(drag.all) },
  immersive: { intervalMs: stats(immersive.interval), drawCostMs: stats(immersive.draw), allRafCostMs: stats(immersive.all) },
  idleAfter: { intervalMs: stats(idleAfter.interval), drawCostMs: stats(idleAfter.draw), allRafCostMs: stats(idleAfter.all) },
  drift,
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
console.log(`\nIMMERSIVE  (sphere ${immRect.w}x${immRect.h}, viewport ${immGeom.vw}x${immGeom.vh} — asserted)`);
console.log(row('rAF interval ms', result.immersive.intervalMs));
console.log(row('draw cost ms', result.immersive.drawCostMs));
console.log(row('all rAF cost ms', result.immersive.allRafCostMs));
console.log('\nIDLE AGAIN  (drift control — same state as the first block)');
console.log(row('draw cost ms', result.idleAfter.drawCostMs));
if (drift.drawCostMs) {
  const d = drift.drawCostMs;
  const sign = v => (v > 0 ? '+' : '') + v.toFixed(2);
  console.log(`   ${'DRIFT over the run'.padEnd(22)} p50 ${sign(d.p50).padStart(7)}  p95 ${sign(d.p95).padStart(7)}  p99 ${sign(d.p99).padStart(7)}`);
  const worst = Math.max(...[result.idle, result.drag, result.immersive].map(s => s.drawCostMs?.p99 ?? 0));
  const best  = Math.min(...[result.idle, result.drag, result.immersive].map(s => s.drawCostMs?.p99 ?? 0));
  if (Math.abs(d.p99) >= (worst - best) * 0.5) {
    console.log('   ⚠ p99 drift is at least half the spread between states in this run:');
    console.log('     the ordering of idle / drag / immersive here is warm-up, not cost.');
  }
}
console.log(`\nwrote ${OUT}/frametime-${label}.json`);

await page.close();
