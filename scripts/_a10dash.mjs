// _a10dash.mjs — what the dash antialiasing and the ortho beads cost the frame.
//
// Two questions the unit tests structurally cannot answer:
//
//   1. DOES THE SHADER LINK? A fragment shader that fails to compile draws
//      NOTHING and raises no GL error. This project has shipped exactly that
//      once (the strimer material, whose verbatim GLSL rendered an empty
//      screen because a y-flip reversed the winding and FrontSide culled every
//      face). Source-level token locks prove tokens, not pixels.
//
//   2. WHAT DID IT COST THE BLOOM? Gating the ortho halo REMOVES light from
//      the gaps, and ortho is the brightest halo family on the sphere
//      (orthoGlow 10 +/- 4px with the opaque isOrtho shadow). `hot` counts
//      pixels at or above SphereComposite's 0.28 luminanceThreshold, so it is
//      the direct answer to "does this move the bloom".
//
// ── WHY THIS WAS REWRITTEN, AND WHAT THE OLD VERSION COULD NOT DO ──────────
//
// The previous version answered both questions by EDITING THIS REPO. It
// rewrote the beadGate statement in SphereEdges.js, waited for vite, relaunched
// Chrome, measured, and restored the file. One browser launch per arm.
//
// It could not resolve either effect, and it said so. Across two full runs:
//
//     run   same-build floor (ink/hot)   no-bead        hard-cut
//     2     0.08% / 0.23%                0.12% / 0.56%  0.98% / 0.37%
//     3     0.96% / 0.45%                0.80% / 0.31%  0.93% / 0.22%
//
// In run 3 THE SAME BUILD SHOT TWICE DIFFERED BY MORE THAN EITHER TREATMENT
// ARM, and the floor itself swung 0.08% -> 0.96% between runs. `deterministic:
// true` plus `__reseed` plus a fixed pump pins the world WITHIN a page; it does
// not pin it across separate browser LAUNCHES. So the honest output was a
// bound — under ~1% of frame ink, ~0.5% of hot pixels — and never a number.
// Stopping one run earlier would have shipped "the antialiasing adds 0.98%
// ink" as a finding. It was noise.
//
// Both arms are now UNIFORMS (uBeadScale, uDashAA), so this launches Chrome
// ONCE and never touches a tracked file. That removes the launch as a
// variable, which is the only variable that was ever large enough to matter.
//
// ── THE DESIGN: ABA, BECAUSE RE-ESTABLISHING THE WORLD DOES NOT WORK ───────
//
// Flipping a uniform and shooting again is not enough on its own: the sphere
// rotates and its graph evolves, so consecutive frames differ and the arm
// difference arrives contaminated by that drift.
//
// THE FIRST ATTEMPT WAS TO REMOVE THE DRIFT BY RE-ESTABLISHING THE WORLD for
// every arm — `__reseed()`, `__artHarnessReset()`, re-forge, pump a fixed
// count, shoot. MEASURED, AND IT IS WORSE, BY A LOT: the floor came out at
// 21.0% of sphere ink, against 0.08–0.96% of frame ink for the old
// four-launch rig. The tell was in the census, not the ink — `count` swung
// 103 to 134 across arms, and the arm that always ran THIRD in the cycle was
// systematically the low one. `__artHarnessReset` is not idempotent: each call
// leaves the page somewhere new, so POSITION IN THE CYCLE was deciding the
// world and the uniform was not. Do not restore that design.
//
// So the drift is not removed. It is CANCELLED, which is cheaper and exact.
//
// Every arm X is measured as a symmetric triple — shipped, X, shipped — one
// fixed pump apart. If the drift is locally linear across three frames (and
// across three it is, whatever it does across three hundred), then
// (S1 + S2) / 2 is an unbiased estimate of what `shipped` would have measured
// at X's own frame, and
//
//     delta(X) = X - (S1 + S2) / 2
//
// has the drift SUBTRACTED rather than averaged down. That is why this needs
// no Latin square and no large cycle count: the balance is inside each triple
// instead of accumulated across many of them.
//
// THE `repeat` ARM IS THE SAME TRIPLE WITH X SET TO `shipped` — three
// identical settings in a row. Its delta is therefore pure residual: sampling
// noise, plus whatever the drift does that three frames of linearity cannot
// describe. THAT is the floor, and every other arm has to clear it.
//
// ── THE LIVENESS GATE ──────────────────────────────────────────────────────
//
// A uniform switch that never reached the GPU would make every arm identical
// and this instrument would report 0.00% for everything — a green run that
// measured nothing, which is the exact failure mode this file was bitten by
// once already (its first version reported -8.26% ink for the bead while its
// own census said ZERO ortho instances were on screen).
//
// So the `no-bead` arm MUST clear the floor. If it does not, that is either a
// bead too cheap for this rig to resolve or a dead uniform; this run cannot
// tell those apart, so it says so and exits non-zero rather than printing a
// number that would read as the former.
//
//   node scripts/_a10dash.mjs [W] [H] [DPR] [CYCLES]
import { launch } from './cdp.mjs';
import { decodePng } from './_png.mjs';

// 5173, NOT the 5174 the older instruments in this folder point at. vite.config
// declares port 5173 with strictPort, so 5174 never listens and a page loaded
// from it throws unboundedly on every dynamic import.
const URL = 'http://localhost:5173/';
const W      = Number(process.argv[2] ?? 1520);
const H      = Number(process.argv[3] ?? 900);
const DPR    = Number(process.argv[4] ?? 1);
const CYCLES = Number(process.argv[5] ?? 4);

const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 700; })()';
const SPHERE_RECT = '(() => { const c = ' + SPHERE + '; const r = c.getBoundingClientRect();' +
  ' return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()';
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';

// Instance census straight out of the buffer. Proves the dashed/ortho path is
// actually populated, so a zero `ink` can be told apart from "nothing dashed
// was on screen" -- which would make the whole A/B vacuous.
const CENSUS = '(() => {' +
  ' const s = window.__artEdgeState ? window.__artEdgeState() : null;' +
  ' if (!s) return JSON.stringify({ hook: false });' +
  ' const D = s.instances, ST = s.stride;' +
  ' let dashed = 0, ortho = 0;' +
  ' for (let i = 0; i < s.count; i++) {' +
  '   const fl = D[i * ST + 15];' +
  '   if (Math.floor(fl % 256) > 0) dashed++;' +
  '   if (Math.floor(fl / 65536) >= 128) ortho++;' +
  ' }' +
  ' const hist = {};' +
  ' for (let i = 0; i < s.count; i++) {' +
  '   const fl = D[i * ST + 15];' +
  '   const w = D[i * ST + 14];' +
  '   const k = (w <= 0 ? "disc" : "seg") + ":p" + Math.floor(fl % 256)' +
  '     + ":g" + Math.floor(fl / 65536);' +
  '   hist[k] = (hist[k] || 0) + 1;' +
  ' }' +
  ' return JSON.stringify({ hook: true, count: s.count, dashed, ortho, hist,' +
  '   additive: s.additive ? s.additive.count : null,' +
  '   dropped: s.additive ? s.additive.dropped : null }); })()';

// Identical arithmetic to _a8ink.mjs, deliberately: a second ink formula that
// drifted from that one would make the two instruments silently incomparable.
const FLOOR = 0.02;
const HOT   = 0.28;          // SphereComposite's luminanceThreshold
const lum = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;

function measure(png) {
  const { data, width, height } = decodePng(png);
  let ink = 0, lit = 0, hot = 0, max = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = lum(data, (y * width + x) * 4);
      if (v > FLOOR) { lit++; ink += v; }
      if (v >= HOT) hot++;
      if (v > max) max = v;
    }
  }
  return { ink: +ink.toFixed(1), lit, hot, inkPerLit: +(lit ? ink / lit : 0).toFixed(5), max: +max.toFixed(4) };
}

// THE ARMS, as uniform settings rather than as source patches. `repeat` is
// identical to `shipped` and that is the whole point of it.
const ARMS = {
  shipped:    { beadScale: 1, dashAA: 1 },
  'no-bead':  { beadScale: 0, dashAA: 1 },
  'hard-cut': { beadScale: 1, dashAA: 0 },
  repeat:     { beadScale: 1, dashAA: 1 },
  // NOT A SHIPPED CONFIGURATION. An extreme value used only to prove the
  // uniform reaches the GPU. beadGate scales the distance dDash that the
  // gaussian integrates, so a large value drives the gap distance far past the
  // glow radius and erases the halo BETWEEN dashes outright. If 64 moves
  // nothing, the uniform is dead; if it moves a lot while 0 moves little, the
  // switch is live and the shipped bead is simply cheap -- which is the one
  // distinction the previous rig could never make.
  'bead-x64': { beadScale: 64, dashAA: 1 },
};

// PUMP per shot. Two and not one: the draw loop copies the ref onto
// eg.beadScale during a frame and syncEdgeLayer pushes it to the uniform, and
// whether that lands before or after the GL render inside the SAME frame is
// not something to assume. Two frames removes the question, and since every
// shot in every triple spends the same two, it costs the symmetry nothing.
const PUMP = 2;
const LIVENESS_CYCLES = 10;
const SETTLE = 240;
const ORTHO_N = 11;

const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
let clip = null;

/** Seed the world and forge the bridges. Called ONCE -- see the design note. */
async function establish(orthoN) {
  await page.eval('window.__reseed && window.__reseed(); window.__artHarnessReset && window.__artHarnessReset();');
  // The bridges are a PROP the reasoning engine accumulates over a live
  // session, so a fresh world has none and every arm would measure nothing.
  // The hook marks REAL edges and RETURNS the count, which is asserted rather
  // than trusted -- a hook that silently marked nothing would put us straight
  // back to reporting boot noise as a measurement.
  const marked = JSON.parse(await page.eval(
    'JSON.stringify(window.__artSetOrthogonal ? window.__artSetOrthogonal(' + orthoN + ') : null)'));
  if (!marked || !marked.marked) {
    throw new Error('__artSetOrthogonal marked nothing: ' + JSON.stringify(marked));
  }
  await page.pump(SETTLE);
  return marked.marked;
}

/** Set one arm's uniforms, assert both switches landed, advance, shoot. */
async function shoot(arm) {
  const cfg = ARMS[arm];
  // Both hooks RETURN what they set, so the switch is asserted and not assumed
  // -- the same contract __artSetOrthogonal was given after the vacuous-hook
  // lesson.
  const set = JSON.parse(await page.eval(
    'JSON.stringify({' +
    ' bead: window.__artSetBeadScale ? window.__artSetBeadScale(' + cfg.beadScale + ') : null,' +
    ' dash: window.__artSetDashAA ? window.__artSetDashAA(' + cfg.dashAA + ') : null })'));
  if (!set.bead || set.bead.beadScale !== cfg.beadScale) {
    throw new Error(arm + ': __artSetBeadScale did not take ' + cfg.beadScale + ' -- ' + JSON.stringify(set));
  }
  if (!set.dash || set.dash.dashAA !== cfg.dashAA) {
    throw new Error(arm + ': __artSetDashAA did not take ' + cfg.dashAA + ' -- ' + JSON.stringify(set));
  }
  await page.pump(PUMP);

  const census = JSON.parse(await page.eval(CENSUS));
  // REFUSE TO PRODUCE A VACUOUS NUMBER. Both arms only touch code reached by
  // DASHED instances, and the bead arm only by ORTHO ones.
  if (!census.hook) throw new Error('__artEdgeState missing -- cannot verify the population');
  if (!census.dashed) {
    console.log('flag histogram (family:dashPeriod:glowByte): ' + JSON.stringify(census.hist));
    throw new Error('NO DASHED INSTANCES on screen (count=' + census.count
      + ') -- the dash arms would measure nothing. Refusing to report.');
  }
  if (!census.ortho) throw new Error('NO ORTHO INSTANCES on screen (dashed=' + census.dashed
    + ') -- the bead arm would measure nothing. Refusing to report.');

  // Clipped to the sphere, NOT the whole viewport. The old version measured the
  // full frame, where constant UI chrome dilutes every percentage toward zero.
  // NOTE: that makes these percentages NOT comparable with the old bound, which
  // was a fraction of full-frame ink. They are a fraction of SPHERE ink.
  const png = await page.screenshot({ clip });
  const ink = measure(png);
  const errs = (page.consoleErrors() || []).filter(e =>
    /shader|glsl|compile|link|program|webgl/i.test(String(e)));
  return { arm, ...census, ...ink, shaderErrors: errs.length, firstError: errs[0] || null };
}

/** Mean and standard error. SE and not span: SE TIGHTENS with more samples,
 *  which is what a floor has to do, while a span only ever grows. The previous
 *  revision of this report used a span and its floor got worse the harder it
 *  was made to work. */
function stat(a) {
  const n = a.length;
  const m = a.reduce((t, v) => t + v, 0) / n;
  if (n < 2) return { mean: m, se: Infinity, n };
  const v = a.reduce((t, x) => t + (x - m) * (x - m), 0) / (n - 1);
  return { mean: m, se: Math.sqrt(v / n), n };
}

/** Run symmetric shipped-X-shipped triples for each named arm. */
async function triples(arms, cycles, label) {
  const out = {};
  for (let c = 0; c < cycles; c++) {
    for (const X of arms) {
      const s1 = await shoot('shipped');
      const x  = await shoot(X);
      const s2 = await shoot('shipped');
      seenCounts.add(s1.count); seenCounts.add(x.count); seenCounts.add(s2.count);
      shaderErrTotal += s1.shaderErrors + x.shaderErrors + s2.shaderErrors;
      const ref  = (s1.ink + s2.ink) / 2;
      const refh = (s1.hot + s2.hot) / 2;
      const di = x.ink - ref;
      const dh = x.hot - refh;
      (out[X] ??= []).push({
        ink: di, hot: dh, ref, refh,
        inkPct: 100 * di / ref,
        hotPct: refh ? 100 * dh / refh : 0,
      });
      console.log('  ' + label + ' ' + c + '  ' + X.padEnd(10)
        + ' S1=' + s1.ink.toFixed(1).padStart(9)
        + ' X=' + x.ink.toFixed(1).padStart(9)
        + ' S2=' + s2.ink.toFixed(1).padStart(9)
        + '   dInk=' + di.toFixed(1).padStart(8)
        + ' dHot=' + dh.toFixed(1).padStart(7));
    }
  }
  return out;
}

const deltas = {};
const seenCounts = new Set();
let shaderErrTotal = 0;
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  await sleep(2200);
  if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
  await sleep(3500);

  await page.eval('window.__virtualize && window.__virtualize()');
  await sleep(150);

  const r = JSON.parse(await page.eval('JSON.stringify(' + SPHERE_RECT + ')'));
  clip = { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 };

  // ESTABLISHED ONCE, and only once. Doing this per arm is what produced the
  // 21% floor described at the top.
  // ── PHASE 1: LIVENESS, AT AN AMPLIFIED CONFIGURATION ────────────────────
  //
  // The shipped world carries 11 ortho bridges out of ~134 edges, and at that
  // population the bead's effect turned out to sit under this rig's floor. A
  // null result there has TWO explanations -- a cheap bead, or a uniform that
  // never reaches the GPU -- and an instrument that cannot separate them is
  // the vacuous kind this file exists to avoid.
  //
  // So liveness is proved where the mechanism is LOUD: mark every edge ortho,
  // so all ~134 carry a dashed 6-14px halo, and the bead acts on twelve times
  // the population. If uBeadScale moves nothing THERE, it is dead, and no
  // measurement below is worth reading. This phase is a mechanism check and
  // NOT a measurement of anything the app ships.
  const livenessMarked = await establish(9999);
  console.log('LIVENESS PHASE: ' + livenessMarked + ' edges marked ortho (amplified, not a shipped world)');
  const live = await triples(['bead-x64', 'no-bead', 'repeat'], LIVENESS_CYCLES, 'live');
  const liveBead = stat(live['bead-x64'].map(d => d.inkPct));
  const liveRep  = stat(live.repeat.map(d => d.inkPct));
  const liveSep  = Math.abs(liveBead.mean - liveRep.mean);
  const liveErr  = 2 * Math.sqrt(liveBead.se * liveBead.se + liveRep.se * liveRep.se);
  console.log('  bead-x64 ' + liveBead.mean.toFixed(3) + '% +/- ' + (2 * liveBead.se).toFixed(3)
    + '   repeat ' + liveRep.mean.toFixed(3) + '% +/- ' + (2 * liveRep.se).toFixed(3)
    + '   separation ' + liveSep.toFixed(3) + ' vs ' + liveErr.toFixed(3));
  if (!(liveSep > liveErr)) {
    console.log('');
    console.log('!! LIVENESS FAILED. With every edge carrying a bead AND uBeadScale at');
    console.log('   64 -- which should erase the halo between dashes outright -- nothing');
    console.log('   moved beyond noise. The uniform is not reaching the GPU, or the draw');
    console.log('   loop is not publishing it. Everything below is meaningless.');
    process.exitCode = 1;
  } else {
    console.log('  LIVE: uBeadScale demonstrably changes pixels at an extreme value, so');
    console.log('  the switch works. The measurement below is about the bead COST.');
  }
  console.log('');

  // ── PHASE 2: THE MEASUREMENT, AT THE SHIPPED CONFIGURATION ──────────────
  const marked = await establish(ORTHO_N);
  console.log('MEASUREMENT PHASE: ' + marked + ' bridges forged (shipped-scale), '
    + CYCLES + ' cycles, pump ' + PUMP + '/shot');
  console.log('');
  const measured = await triples(['no-bead', 'hard-cut', 'repeat'], CYCLES, 'cycle');
  for (const k of Object.keys(measured)) deltas[k] = measured[k];
} finally {
  await page.close();
}

// ── report ──────────────────────────────────────────────────────────────────
console.log('');
console.log('edge counts across every shot: ' + [...seenCounts].sort((a, b) => a - b).join(', '));
console.log('shader errors across every shot: ' + shaderErrTotal);

const agg = {};
for (const [arm, rows] of Object.entries(deltas)) {
  agg[arm] = { ink: stat(rows.map(r => r.inkPct)), hot: stat(rows.map(r => r.hotPct)) };
}

console.log('');
console.log('drift-cancelled delta vs shipped, mean +/- 2 SE over ' + CYCLES + ' triples');
console.log('arm'.padEnd(12) + 'ink'.padStart(22) + 'hot'.padStart(22));
for (const [arm, a] of Object.entries(agg)) {
  console.log(arm.padEnd(12)
    + (a.ink.mean.toFixed(3) + '% +/- ' + (2 * a.ink.se).toFixed(3)).padStart(22)
    + (a.hot.mean.toFixed(3) + '% +/- ' + (2 * a.hot.se).toFixed(3)).padStart(22));
}

// RESOLVED means separated from the `repeat` arm by more than the two arms'
// combined uncertainty -- a two-sample comparison, not a threshold on one
// number. `repeat` carries settings identical to `shipped`, so it is the
// distribution an arm that does NOTHING draws from.
const rep = agg.repeat;
const sep = (a, b) => Math.abs(a.mean - b.mean);
const tol = (a, b) => 2 * Math.sqrt(a.se * a.se + b.se * b.se);

console.log('');
console.log('THE FLOOR is the repeat arm: ink ' + rep.ink.mean.toFixed(3)
  + '% +/- ' + (2 * rep.ink.se).toFixed(3) + ', hot ' + rep.hot.mean.toFixed(3)
  + '% +/- ' + (2 * rep.hot.se).toFixed(3) + '.');
console.log('');
for (const [arm, a] of Object.entries(agg)) {
  if (arm === 'repeat') continue;
  const inkRes = sep(a.ink, rep.ink) > tol(a.ink, rep.ink);
  const hotRes = sep(a.hot, rep.hot) > tol(a.hot, rep.hot);
  const res = inkRes || hotRes;
  console.log('  ' + arm.padEnd(10) + (res ? 'RESOLVED  ' : 'UNRESOLVED -- inside the floor  ')
    + 'ink ' + a.ink.mean.toFixed(3) + '% (sep ' + sep(a.ink, rep.ink).toFixed(3)
    + ' vs tol ' + tol(a.ink, rep.ink).toFixed(3) + ')'
    + '   hot ' + a.hot.mean.toFixed(3) + '% (sep ' + sep(a.hot, rep.hot).toFixed(3)
    + ' vs tol ' + tol(a.hot, rep.hot).toFixed(3) + ')');
}
console.log('');
console.log('Read "no-bead" as what the BEAD adds, negated, and "hard-cut" as what');
console.log('the ANTIALIASING adds. Percentages are of SPHERE ink, not full-frame');
console.log('ink -- NOT comparable with the pre-uniform bound. An UNRESOLVED arm is');
console.log('a BOUND at its tolerance, never a zero and never a small effect.');
