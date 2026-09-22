// mobileFps.mjs — mobile / coarse-pointer frame rate for the CHAOS sphere,
// idle vs. a prism effect firing.
//
// Written for a ONE-TIME measurement (see the task ledger note this script's
// commit references): converged prism chords, the translucent node lens, a
// terminal taper on every base edge glow, and stretched-segment particles
// with a per-particle attraction term all landed on this branch and none of
// it had ever been measured at a coarse-pointer viewport.
//
// ── THE TRAP THIS SCRIPT IS BUILT AROUND ────────────────────────────────────
// Counting every requestAnimationFrame callback once inflated a measured
// 269.6fps to 875.7fps AND hid a stall (see MEMORY: project_art_particle_
// cadence_clock). The sphere's own draw loop is `const draw = () => {
// rafRef.current = requestAnimationFrame(draw); ... }` at
// src/terminal/views/ArtTab.jsx:907-909 — a named function via JS's const-
// arrow-name inference, registered directly with requestAnimationFrame. This
// script wraps requestAnimationFrame ONCE and buckets every callback by
// `cb.name`, but only ever computes fps from the `draw` bucket. The `other`
// bucket (everything NOT named `draw` — r3f's own internal loop for the GL
// composite lands there) is kept and reported specifically so a reviewer can
// see the inflation this script refused, not just take its word for it.
//
// ── WHY HEADED, REAL GPU ─────────────────────────────────────────────────────
// Same reasoning as artFrameTime.mjs: headless Chrome renders through
// SwiftShader (software) and drives rAF unthrottled, producing a number that
// describes a machine nobody exhibits on. Headed is the default here too;
// --headless exists only for A/B against the headed figure, never as the
// answer to "what will mobile see".
//
// ── WHY NO MAIN ARM BY DEFAULT ───────────────────────────────────────────────
// The dev server on :5174 serves the WORKING TREE, i.e. whatever branch is
// checked out there right now — this script never touches that checkout. To
// see main's code the app has to be SERVED from a main checkout, which means
// a second dev/preview server. This script does not start one; see the task
// report for why (a `main` worktree already existed, owned by another
// session, and standing up a second server was ruled a bigger risk than an
// unbaselined HEAD number).
//
// Usage:
//   node scripts/mobileFps.mjs [--seconds 8] [--headless] [--url http://localhost:5174/]

import { mkdir, writeFile } from 'node:fs/promises';
import { gitProvenance } from './_git.mjs';
import { launch } from './cdp.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const SECONDS  = Number(arg('--seconds', 8));
const HEADLESS = process.argv.includes('--headless');
const URL      = arg('--url', 'http://localhost:5174/');
const OUT      = arg('--out', '.superpowers/sdd');
const ARM      = arg('--packet-arm', null) === null ? null : Number(arg('--packet-arm', null));

// A phone viewport, not a tablet — narrow enough that the layout's own
// `hidden md:flex` breakpoint hides the desktop geometry terminal (ArtTab.jsx
// ~4183: "hidden on touch/mobile (tap nodes directly instead)"), which is
// exactly the path a real phone takes.
const VIEW = { width: 390, height: 844, dpr: 3 };

const sleep = ms => new Promise(r => setTimeout(r, ms));

function provenance() {
  const p = gitProvenance();
  for (const w of p.warnings) console.error(`  !! ${w}`);
  return { gitCommit: p.gitCommitShort, gitBranch: p.gitBranch, gitDirty: p.gitDirty };
}

const SPHERE = `[...document.querySelectorAll('canvas')].filter(c => c.offsetParent)
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;

// ── The draw-only rAF probe ──────────────────────────────────────────────────
// Installed once, after the mobile-emulation reload, before any measurement
// window. Buckets EVERY rAF callback by name; only `draw` feeds fps.
const PROBE = `(() => {
  window.__mf = { drawInterval: [], drawCost: [], otherCost: [], names: {}, totalRAF: 0 };
  let lastDraw = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => orig((t) => {
    window.__mf.totalRAF++;
    const nm = cb.name || '(anonymous)';
    window.__mf.names[nm] = (window.__mf.names[nm] || 0) + 1;
    const t0 = performance.now();
    cb(t);
    const dt = performance.now() - t0;
    if (cb.name === 'draw') {
      const now = performance.now();
      if (lastDraw) window.__mf.drawInterval.push(now - lastDraw);
      lastDraw = now;
      window.__mf.drawCost.push(dt);
    } else {
      window.__mf.otherCost.push(dt);
    }
  });
  window.__mfReset = () => { window.__mf = { drawInterval: [], drawCost: [], otherCost: [], names: {}, totalRAF: 0 }; lastDraw = 0; };
})()`;

function stats(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const q = p => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return {
    n: s.length,
    mean: +(s.reduce((t, v) => t + v, 0) / s.length).toFixed(3),
    p50: +q(0.5).toFixed(3), p90: +q(0.9).toFixed(3), p95: +q(0.95).toFixed(3),
    max: +s[s.length - 1].toFixed(3),
  };
}
// fps from the mean draw-to-draw interval — the number that answers "what
// frame rate did the sphere actually run at".
const fpsFromInterval = (intervalStats) => intervalStats ? +(1000 / intervalStats.mean).toFixed(1) : null;

async function measureWindow(page, seconds, duringLoop) {
  await page.eval('window.__mfReset()');
  const t0 = Date.now();
  if (duringLoop) {
    await duringLoop(t0, seconds * 1000);
  } else {
    await sleep(seconds * 1000);
  }
  const elapsedS = (Date.now() - t0) / 1000;
  const raw = await page.eval('JSON.stringify(window.__mf)').then(JSON.parse);
  const intervalStats = stats(raw.drawInterval);
  return {
    elapsedS: +elapsedS.toFixed(2),
    drawCount: raw.drawCost.length,
    fpsFromMean: fpsFromInterval(intervalStats),
    fpsFromCount: +(raw.drawCost.length / elapsedS).toFixed(1),
    drawIntervalMs: intervalStats,
    drawCostMs: stats(raw.drawCost),
    totalRAF: raw.totalRAF,
    names: raw.names,
  };
}

console.log(`mobileFps: ${URL}  viewport ${VIEW.width}x${VIEW.height} dpr ${VIEW.dpr}  ${HEADLESS ? 'HEADLESS (swiftshader — not a frame budget)' : 'HEADED (real GPU)'}  ${SECONDS}s/window`);

const page = await launch({
  url: URL, width: VIEW.width, height: VIEW.height, dpr: VIEW.dpr, headless: HEADLESS,
});

// ── Force the coarse-pointer / mobile path, then RELOAD ─────────────────────
// Device gates (matchMedia('(pointer: coarse)'), the DPR_CAP_COARSE clamp in
// artComposite.js) are read at load time / module init, not reactively, so
// the override has to land before the page (re)boots.
await page.send('Emulation.setDeviceMetricsOverride', {
  width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.dpr, mobile: true,
});
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await page.eval('location.reload()');
await page.waitFor('document.readyState === "complete"', { timeoutMs: 30000 });
await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });

const deviceCheck = await page.eval(`JSON.stringify({
  pointerCoarse: matchMedia('(pointer: coarse)').matches,
  hoverNone: matchMedia('(hover: none)').matches,
  dpr: window.devicePixelRatio,
  innerW: window.innerWidth, innerH: window.innerHeight,
})`).then(JSON.parse);
console.log('device gates after reload:', deviceCheck);
if (!deviceCheck.pointerCoarse) {
  throw new Error('matchMedia(pointer: coarse) is false after mobile emulation — the app will NOT take the coarse-pointer branch. Aborting rather than measuring the wrong path.');
}

await sleep(2500);
const navOk = await page.eval(`(() => { const b = [...document.querySelectorAll('button')].find(e => /\\/CHAOS/i.test(e.innerText || '')); if (!b) return false; b.click(); return true; })()`);
if (!navOk) throw new Error('no /CHAOS nav button found');

await page.waitFor(`(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 150 && c.getBoundingClientRect().height > 150; })()`, { label: 'sphere sized', timeoutMs: 30000 });

let armSet = null;
if (ARM !== null) {
  armSet = JSON.parse(await page.eval(`JSON.stringify(window.__artSetPacketArm(${ARM}))`));
  if (!armSet || armSet.packetArm !== ARM) throw new Error(`__artSetPacketArm(${ARM}) did not land: ${JSON.stringify(armSet)}`);
  console.log(`packet arm ${ARM}: w=${armSet.w} step=${armSet.step} forced n=${armSet.segments}`);
}

// GL composite backing-store check — mirrors artFrameTime.mjs's GL_READY but
// without the desktop >800px assumption.
await page.waitFor(`(() => {
  const w = document.querySelector('[data-art-composite]');
  const g = w && w.querySelector('canvas');
  const c = ${SPHERE};
  return !!g && !!c && g.width >= c.getBoundingClientRect().width * 0.9 * ${VIEW.dpr} * 0.5;
})()`, { label: 'GL composite sized', timeoutMs: 30000 }).catch((e) => {
  console.error('  !! GL composite size check did not settle (continuing anyway):', e.message);
});

const compositeDprCheck = await page.eval(`(() => {
  const w = document.querySelector('[data-art-composite]');
  const g = w && w.querySelector('canvas');
  const c = ${SPHERE};
  const cr = c.getBoundingClientRect();
  return JSON.stringify({ glW: g ? g.width : null, cssW: Math.round(cr.width), devicePixelRatio: window.devicePixelRatio });
})()`).then(JSON.parse);
console.log('composite backing store:', compositeDprCheck, '— coarse DPR cap should hold glW ~= cssW (DPR_CAP_COARSE=1), not cssW*3');

// ── Discard boot animation + let auto-rotate settle into steady state ───────
await sleep(6000);

await page.eval(PROBE);

const rect = await page.eval(`(() => { const c = ${SPHERE}; const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
const R = Math.min(rect.w, rect.h) / 2;

// ── IDLE window ───────────────────────────────────────────────────────────
await page.hover(Math.round(rect.x + 8), Math.round(rect.y + 8));   // away from any node
await sleep(400);
const idle = await measureWindow(page, SECONDS);
console.log(`idle: ${idle.fpsFromMean}fps (mean interval)  ${idle.fpsFromCount}fps (count/elapsed)  n=${idle.drawCount}  other-rAF names: ${JSON.stringify(idle.names)}`);

// ── Find node hit points via a spiral sweep, verified by the aria-live
// status region (ArtTab.jsx ~4304-4308: `role="status"` always renders,
// `hidden md:flex` does NOT apply to it, so it works identically on the
// mobile layout). Forgiving hitbox is 3x visual radius + 10px
// (ArtTab.jsx nodeAt, ~3166-3182), so a coarse spiral should land quickly. ──
const STATUS_HAS_NODE = `(document.querySelector('[role="status"]')?.textContent || '').includes('Selected node:')`;
const candidates = [];
const RINGS = [0, 0.18, 0.34, 0.5, 0.66, 0.8];
const ANGLES = 10;
for (const f of RINGS) {
  for (let a = 0; a < ANGLES; a++) {
    const theta = (a / ANGLES) * Math.PI * 2 + f * 0.7;
    candidates.push({ x: cx + Math.cos(theta) * f * R, y: cy + Math.sin(theta) * f * R });
  }
}

const hits = [];
for (const p of candidates) {
  if (hits.length >= 4) break;
  await page.click(Math.round(p.x), Math.round(p.y));
  await sleep(180);
  const got = await page.eval(STATUS_HAS_NODE);
  if (got) hits.push(p);
}
console.log(`node-hit sweep: ${hits.length} hit point(s) found out of ${candidates.length} candidates tried up to that point`);

let prism = null;
let prismClickStats = null;
if (hits.length === 0) {
  console.error('  !! no node hit found in the sweep — cannot drive the prism state. Skipping the prism arm.');
} else {
  await sleep(400);
  const prismClicks = { attempted: 0, confirmed: 0 };
  prism = await measureWindow(page, SECONDS, async (t0, ms) => {
    let i = 0;
    while (Date.now() - t0 < ms) {
      const p = hits[i % hits.length]; i++;
      await page.click(Math.round(p.x), Math.round(p.y));
      prismClicks.attempted++;
      await sleep(220);
    }
  });
  // One more confirmation pass after the window, cheap and outside the timed loop.
  const stillHas = await page.eval(STATUS_HAS_NODE);
  prismClickStats = { ...prismClicks, statusConfirmedAtEnd: stillHas };
  console.log(`prism: ${prism.fpsFromMean}fps (mean interval)  ${prism.fpsFromCount}fps (count/elapsed)  n=${prism.drawCount}  clicks attempted=${prismClicks.attempted}`);
}

const gp = provenance();
const result = {
  capturedAt: new Date().toISOString(),
  ...gp,
  url: URL,
  packetArm: ARM === null ? null : { requested: ARM, ...armSet },
  renderer: HEADLESS ? 'headless chrome + swiftshader (SOFTWARE — not a frame budget)' : 'headed chrome, real GPU',
  seconds: SECONDS,
  viewport: VIEW,
  deviceGates: deviceCheck,
  compositeBackingStore: compositeDprCheck,
  sphereCss: { w: Math.round(rect.w), h: Math.round(rect.h) },
  frameCounterKey: "cb.name === 'draw'  (const draw = () => { rafRef.current = requestAnimationFrame(draw); ... } — ArtTab.jsx:907-909, JS const-arrow name inference)",
  idle,
  nodeHitSweep: { candidatesTried: candidates.length, hitsFound: hits.length, hitPoints: hits.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })) },
  prism,
  prismClickStats,
  mainArm: {
    measured: false,
    reason: "dev server on :5174 serves the WORKING TREE (this branch); measuring main requires main to be SERVED, which means a second dev/preview server. A `main` worktree already existed at .claude/worktrees/vigilant-shaw-b8bf39 (not created by this script, owned by another session) with no server running against it. Starting one was ruled a bigger risk than reporting an unbaselined HEAD number, per the task's own instruction to skip rather than disturb the shared server or the working tree.",
  },
};

await mkdir(OUT, { recursive: true });
const jsonPath = `${OUT}/mobile-fps-${HEADLESS ? 'headless' : 'headed'}${ARM === null ? '' : `-arm${ARM}`}.json`;
await writeFile(jsonPath, JSON.stringify(result, null, 2));
console.log(`\nwrote ${jsonPath}`);

await page.close();
