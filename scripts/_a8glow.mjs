// _a8glow.mjs — one pinned breath, shot frame by frame, for the GLOW SHOULDER.
//
//   node scripts/_a8glow.mjs --tag glow [--normal] [--coarse] [--frames 8]
//                            [--w 1920] [--h 1080] [--dpr 1]
//
// Answers the two questions the author's "socks/10" did NOT answer:
//   2. does the breathing halo PUMP THE BLOOM?
//   3. what does it cost, especially on a phone-sized backing store?
//
// ── WHY THIS DOES NOT PATCH SOURCE, UNLIKE `_a4hum.mjs` ────────────────────
// `_a4hum.mjs` sweeps a HUM constant, so it must rewrite `artEdges.js` per
// shot. The glow shoulder is not one constant: it is `HUM_GLOW` PLUS the
// `packFlags` argument in `ArtTab.jsx` that stopped being a literal 0. The A/B
// is therefore a two-file checkout done by the CALLER, and this script only
// ever measures the tree as it finds it. `--tag` names the run so the two
// halves cannot overwrite each other's frames — the naming discipline
// `_a4hum.mjs` inherited from `_a3bloom.mjs`.
//
// ── THE PINNING IS COPIED VERBATIM, ON PURPOSE ─────────────────────────────
// Deterministic launch, __virtualize(), __reseed() + __artHarnessReset(), 240
// pumps, a hover away from every node, 30 more, then a 750-pump budget that is
// IDENTICAL in both modes. Same numbers as `_a4hum.mjs` and `_a3bloom.mjs`.
// Two builds measured through the same pinning are the same world at the same
// rotation, so the only thing that differs between the tagged sets is the
// glow. Deviate from the budget and that guarantee is gone.
//
// ── WHAT THE COST NUMBER HERE IS, AND WHAT IT IS NOT ───────────────────────
// `__frameCosts()` buckets by rAF CALLBACK NAME, and only the `draw` bucket is
// the sphere — counting every callback is how a previous session inflated
// 269.6fps to 875.7 and hid a stall. But that bucket times MAIN-THREAD work
// inside the callback. A glow shoulder is mostly FRAGMENT work on the GPU,
// issued asynchronously, which does NOT land in this number. Expect it to be
// nearly flat and do not read that as "free" — `visibleHalos` and the drawn
// AREA are what speak to fragment cost.
//
// ── THE GLOW PROBE READS THE BUFFER, NOT THE SOURCE ────────────────────────
// `packFlags` quantises glow to 1/8 px into the flags word at stride index 15
// (`GLOW_QUANT_SRC_OVER = 8`, clamped at 127 -> 15.875 px). Reading it back per
// frame proves the halo actually REACHED the instance buffer and how wide it
// is at that phase, so a run whose glow never moves says so instead of being
// inferred from the fact that a commit is checked out. Same discipline as
// `_a4hum.mjs`'s HUM_PROBE, which is kept here too: a0 proves the alpha hum is
// still running underneath the halo.
import { launch } from './cdp.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const TAG    = arg('--tag', 'untagged');
const NORMAL = process.argv.includes('--normal');
const COARSE = process.argv.includes('--coarse');
const FRAMES = Number(arg('--frames', 8));
const W      = Number(arg('--w', COARSE ? 390 : 1920));
const H      = Number(arg('--h', COARSE ? 844 : 1080));
const DPR    = Number(arg('--dpr', COARSE ? 3 : 1));
const URL    = arg('--url', 'http://localhost:5174/');
const MODE   = NORMAL ? 'normal' : 'imm';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Derived from the source, never hard-coded — `_a4hum.mjs`'s rule, so the rig
// stays correct when the period is re-dialled (it already moved 11000 -> 3500).
const SRC = readFileSync('F:/scale_9.4/src/terminal/art/artEdges.js', 'utf8');
const periodMatch = SRC.match(/^\s*periodMs:\s*([\d.]+),/m);
if (!periodMatch) throw new Error('could not find HUM.periodMs');
const PERIOD_MS = Number(periodMatch[1]);
const HAS_GLOW  = /HUM_GLOW/.test(SRC);
const FRAME_MS  = 1000 / 60;                       // determinism.mjs's advance-per-pump
const TOTAL_PUMPS    = Math.round(PERIOD_MS / FRAME_MS);
const FRAME_INTERVAL = Math.round(TOTAL_PUMPS / FRAMES);

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const MIN_W = COARSE ? 250 : 800;
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > ' + MIN_W + '; })()';
const GL_READY = '(() => {' +
  ' const w = document.querySelector("[data-art-composite]");' +
  ' const g = w && w.querySelector("canvas");' +
  ' const c = ' + SPHERE + ';' +
  ' return !!g && !!c && g.width >= c.clientWidth * 0.9 && g.width > ' + MIN_W + '; })()';
// TEXT FIRST, THEN aria-label. At 390px the desktop nav is replaced by the
// bottom bar, whose /chaos control is an ICON with `aria-label="Chaos"` and no
// text at all — so a text-only matcher (what `_a4hum.mjs` and `_a3bloom.mjs`
// use, because they only ever ran at 1920) finds nothing and the mobile run
// dies at the first gate. Both selectors are kept so one rig serves both
// widths and a failure means "the control moved", not "the viewport is small".
const clickChaos = '(() => {' +
  ' const bs = [...document.querySelectorAll("button")];' +
  ' const b = bs.find(e => (e.innerText || "").indexOf("/CHAOS") >= 0)' +
  '   || bs.find(e => /^chaos$/i.test((e.getAttribute("aria-label") || "").trim()));' +
  ' if (!b) return false; b.click(); return true; })()';
const clickImmersive = '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => /immersive/i.test((e.innerText || "") + " " + (e.title || "") + " " + (e.getAttribute("aria-label") || "")));' +
  ' if (!b) return false; b.click(); return true; })()';

// Backing store vs CSS box, read from the page: this is the number the DPR-1
// coarse-pointer commit moved, and the denominator any fragment-cost claim has
// to be quoted against. Also reports what the page believes about the pointer,
// so a "mobile" run that never took the coarse branch cannot pass as one.
const SURFACE = '(() => {' +
  ' const w = document.querySelector("[data-art-composite]");' +
  ' const g = w && w.querySelector("canvas");' +
  ' const c = ' + SPHERE + ';' +
  ' return JSON.stringify({' +
  '   glBacking: g ? g.width + "x" + g.height : null,' +
  '   glCss: g ? Math.round(g.getBoundingClientRect().width) + "x" + Math.round(g.getBoundingClientRect().height) : null,' +
  '   glPx: g ? g.width * g.height : null,' +
  '   sphereCss: c ? Math.round(c.getBoundingClientRect().width) + "x" + Math.round(c.getBoundingClientRect().height) : null,' +
  '   dpr: window.devicePixelRatio,' +
  '   coarse: window.matchMedia("(pointer: coarse)").matches,' +
  '   noHover: window.matchMedia("(hover: none)").matches }); })()';

const WORLD_STATE = '(() => {' +
  ' const c = ' + SPHERE + '; const q = c.getBoundingClientRect();' +
  ' const e = window.__artEdgeState ? window.__artEdgeState() : null;' +
  ' const b = window.__artBgState ? window.__artBgState() : null;' +
  ' return JSON.stringify({ box: Math.round(q.width) + "x" + Math.round(q.height),' +
  '   worldCount: e ? e.worldCount : null,' +
  '   ry: b ? +b.rot.ry.toFixed(6) : null, sphereR: b ? +b.sphereR.toFixed(2) : null }); })()';

// a0 (index 13) is the alpha hum; the flags word (index 15) carries the glow
// radius. Both are read across `worldCount` graph edges only — the travelling
// pulse discs share the buffer and are not what breathes.
const PROBE = '(() => {' +
  ' const s = window.__artEdgeState ? window.__artEdgeState() : null;' +
  ' if (!s) return JSON.stringify({ error: "no __artEdgeState" });' +
  ' const stride = s.stride, n = s.worldCount;' +
  ' let aSum = 0, aMin = 1, aMax = 0;' +
  ' let gSum = 0, gMin = 1e9, gMax = -1e9, gLit = 0;' +
  ' for (let i = 0; i < n; i++) {' +
  '   const a0 = Math.floor(s.instances[i * stride + 13] % 256) / 255;' +
  '   aSum += a0; if (a0 < aMin) aMin = a0; if (a0 > aMax) aMax = a0;' +
  '   const gByte = Math.floor(s.instances[i * stride + 15] / 65536);' +
  '   const glow = (gByte % 128) / 8;' +
  '   gSum += glow; if (glow < gMin) gMin = glow; if (glow > gMax) gMax = glow;' +
  '   if (glow > 6) gLit++;' +
  ' }' +
  ' return JSON.stringify({ n,' +
  '   meanA0: n ? +(aSum / n).toFixed(4) : null, minA0: +aMin.toFixed(4), maxA0: +aMax.toFixed(4),' +
  '   meanGlow: n ? +(gSum / n).toFixed(4) : null,' +
  '   minGlow: +gMin.toFixed(4), maxGlow: +gMax.toFixed(4),' +
  '   visibleHalos: gLit }); })()';

mkdirSync('F:/scale_9.4/lookbook/glow', { recursive: true });

console.log(TAG + '  ' + MODE + (COARSE ? '  COARSE' : '') + '  ' + W + 'x' + H + ' dpr' + DPR
  + '   HUM_GLOW in source: ' + HAS_GLOW
  + '   breath ' + PERIOD_MS + 'ms = ' + TOTAL_PUMPS + ' pumps, ' + FRAMES
  + ' frames every ' + FRAME_INTERVAL);

const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
try {
  if (COARSE) {
    // A viewport alone is not a phone. The DPR-1 commit branches on
    // `(pointer: coarse)`, so without touch emulation a 390px run would take
    // the DESKTOP path at a phone's width and measure nothing that ships.
    await page.send('Emulation.setDeviceMetricsOverride',
      { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    await page.goto(URL);
  }
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  await sleep(2500);
  if (!await page.eval(clickChaos)) throw new Error("no /CHAOS nav control (tried text and aria-label)");
  await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
  await page.waitFor(GL_READY, { label: 'GL composite sized', timeoutMs: 40000 });
  await sleep(4000);

  const surface = JSON.parse(await page.eval(SURFACE));
  console.log('   surface: GL ' + surface.glBacking + ' (' + surface.glPx + ' px) css ' + surface.glCss
    + '   dpr ' + surface.dpr + '   pointer:coarse ' + surface.coarse + '   hover:none ' + surface.noHover);
  if (COARSE && !surface.coarse) throw new Error('--coarse asked for, but the page does not match (pointer: coarse)');

  await page.eval('window.__virtualize()');
  await sleep(150);
  await page.eval('window.__reseed(); window.__artHarnessReset();');

  const away = JSON.parse(await page.eval('JSON.stringify((() => {'
    + ' const c = ' + SPHERE + '; const r = c.getBoundingClientRect();'
    + ' return { x: Math.round(r.x + 24), y: Math.round(r.y + 18) }; })())'));

  await page.pump(240);
  await page.hover(away.x, away.y);
  await sleep(25);
  await page.pump(30);

  if (MODE === 'normal') {
    await page.pump(750);
  } else {
    if (!await page.eval(clickImmersive)) throw new Error('no Immersive control found');
    await page.screenshot();
    await sleep(250);
    await page.pump(1);
    await page.pump(749);
  }

  await page.resetCosts();
  const frames = [];
  for (let i = 0; i < FRAMES; i++) {
    if (i > 0) await page.pump(FRAME_INTERVAL);
    const path = 'lookbook/glow/' + TAG + '-' + MODE + (COARSE ? '-coarse' : '') + '-f' + i + '.png';
    await page.screenshot({ path });
    frames.push({ i, path, probe: JSON.parse(await page.eval(PROBE)) });
  }

  const costs = await page.frameCosts();
  const draw  = costs.draw ?? [];
  const sorted = [...draw].sort((a, b) => a - b);
  const pct = (p) => sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(3) : null;
  const drawCost = {
    n: draw.length,
    buckets: Object.keys(costs),
    mean: draw.length ? +(draw.reduce((s, x) => s + x, 0) / draw.length).toFixed(3) : null,
    p50: pct(0.5), p90: pct(0.9), max: sorted.length ? +sorted[sorted.length - 1].toFixed(3) : null,
  };

  const world = JSON.parse(await page.eval(WORLD_STATE));
  console.log('   world: box ' + world.box + '  worldCount ' + world.worldCount
    + '  ry ' + world.ry + '  sphereR ' + world.sphereR);
  console.log('   a0   mean per frame: ' + frames.map(f => f.probe.meanA0).join(', '));
  console.log('   glow mean per frame: ' + frames.map(f => f.probe.meanGlow).join(', '));
  console.log('   halos > 6px        : ' + frames.map(f => f.probe.visibleHalos).join(', ')
    + '   of ' + world.worldCount);
  console.log('   draw cost (CPU, ms): mean ' + drawCost.mean + '  p50 ' + drawCost.p50
    + '  p90 ' + drawCost.p90 + '  max ' + drawCost.max + '   over ' + drawCost.n + ' draws'
    + '   buckets: ' + drawCost.buckets.join(','));

  const errs = page.consoleErrors().filter(e => !/CORS|ERR_FAILED|Access to fetch/.test(e));
  if (errs.length) console.log('   CONSOLE ERRORS: ' + errs.slice(0, 5).join(' | '));

  const out = 'lookbook/glow/' + TAG + '-' + MODE + (COARSE ? '-coarse' : '') + '.json';
  writeFileSync(out, JSON.stringify({
    tag: TAG, mode: MODE, coarse: COARSE, viewport: { W, H, DPR },
    hasGlowInSource: HAS_GLOW, periodMs: PERIOD_MS, frames: FRAMES, frameInterval: FRAME_INTERVAL,
    surface, world, drawCost, consoleErrors: errs,
    probes: frames.map(f => ({ i: f.i, path: f.path, ...f.probe })),
  }, null, 2));
  console.log('   -> ' + out);
} finally {
  await page.close();
}
