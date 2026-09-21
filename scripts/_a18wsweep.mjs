// _a18wsweep.mjs — how wide must the prism's pulse be before the tessellation
// can carry it?
//
// THE PROBLEM, STATED EXACTLY. `writePolyline` stores ONE alpha per POINT and
// packs each segment as (a[i], mean, a[i+1]); the three-stop gradient then
// interpolates linearly, so the alpha actually drawn along a chord is the
// PIECEWISE-LINEAR interpolant through the sample points. A travelling pulse
// sampled that way has a reconstructed peak that rises and falls as its crest
// slides between samples — it is brightest when the crest lands ON a point and
// dimmest when it lands halfway between two. That oscillation is the beading /
// staircasing this sweep exists to bound, and it is the same failure
// PACKET_FRACTION was measured against in artStrimer.
//
// THE METRIC: RIPPLE. Over one transit, take the reconstructed peak at each
// instant and report (max - min). A ripple of 0.05 means the crest's own
// brightness flickers by 5% purely as an artefact of where the samples fall.
//
// ── THIS MEASURES THE REAL TESSELLATION, NOT A UNIFORM GRID ───────────────
//
// `tessellateQuad` splits at uniform PARAMETER, and equal parameter steps are
// NOT equal arc lengths on a bowed curve — artEdges.js records that the
// prism's near-cusp chords "vary several times over between their fastest and
// slowest segment". A sweep against a uniform grid would therefore be
// OPTIMISTIC, and optimistic is the wrong direction for a guard. So this
// builds real chords through `prismControl` at the shipped PRISM_CP_PULL,
// tessellates them with the shipped `quadSegments`, and takes each point's
// arc-length fraction exactly as ArtTab's `chord()` does.
//
//   node scripts/_a18wsweep.mjs
import {
  prismControl, prismOffset, prismWaveAmp,
  PRISM_WAVE_W, PRISM_WAVE_SEG_FULL, PRISM_WAVE_SEG_NONE, PRISM_SPECTRAL_FINE,
} from '../src/terminal/art/artEdges.js';
import { tessellateQuad, quadSegments } from '../src/terminal/art/artCurve.js';

const W_CANDIDATES = [0.14, 0.18, 0.22, 0.25, 0.30, 0.35];
const RIPPLE_OK = 0.05;      // the bar: 5% flicker on the crest
const DUR = 120;             // ms; the metric is scale-free in t/DUR

const pts = new Float32Array(512);
const ctrl = new Float32Array(2);

/**
 * Build one real prism chord and return its points' arc-length fractions,
 * exactly as ArtTab's `chord()` computes them.
 *
 * cx/cy is the projected sphere centre, which is what prismControl bows
 * toward — so `span` sweeping the endpoint away from it walks the whole range
 * from a near-cusp chord to a long diameter, which is the range that actually
 * appears on screen.
 */
function chordUs(span, k, forceN = 0) {
  const cx = 760, cy = 450;
  const ax = cx - span, ay = cy - span * 0.35;
  const bx = cx + span * 0.8, by = cy + span * 0.55;
  prismControl(ctrl, ax, ay, bx, by, cx, cy, prismOffset(k));
  const m = tessellateQuad(pts, ax, ay, ctrl[0], ctrl[1], bx, by,
    forceN || quadSegments(ax, ay, ctrl[0], ctrl[1], bx, by));
  let total = 0;
  for (let i = 0; i + 1 < m; i++) {
    total += Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
  }
  const us = [];
  let s = 0;
  for (let i = 0; i < m; i++) {
    if (i > 0) s += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    us.push(total > 1e-6 ? s / total : 0);
  }
  return { us, n: m - 1, total };
}

/**
 * Ripple of the reconstructed crest over one transit.
 *
 * The reconstruction is piecewise linear THROUGH the samples, and the maximum
 * of a piecewise-linear interpolant is always attained at a sample — so the
 * reconstructed peak is simply the largest sampled amplitude. No interpolation
 * needs simulating; that identity is the whole shortcut.
 *
 * Only the window where the crest is well inside the chord is scored. Near
 * either end the pulse is genuinely clipped by the endpoint and a lower peak
 * there is correct behaviour, not an artefact.
 */
function ripple(us, w) {
  const saved = globalThis.__W_OVERRIDE;
  let lo = Infinity, hi = -Infinity;
  for (let step = 0; step <= 600; step++) {
    const frac = 0.25 + (step / 600) * 0.5;       // crest at u in [0.25, 0.75]
    const t = frac * DUR;
    let peak = 0;
    for (const u of us) {
      const a = ampAt(u, t, w);
      if (a > peak) peak = a;
    }
    if (peak < lo) lo = peak;
    if (peak > hi) hi = peak;
  }
  globalThis.__W_OVERRIDE = saved;
  return hi - lo;
}

/**
 * The shipped profile, evaluated at an ARBITRARY half-width.
 *
 * prismWaveAmp closes over the module's own PRISM_WAVE_W, which is the
 * constant under test — so a sweep cannot go through it. This reproduces the
 * raised cosine at width `w` and is checked against the real function at the
 * shipped width below, so the two cannot silently differ.
 */
function ampAt(u, t, w) {
  const x = u - t / DUR;             // k = 0, so the phase offset is 0
  const ax = x < 0 ? -x : x;
  if (ax >= w) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * x / w));
}

// ── The check that keeps this instrument honest ───────────────────────────
// If ampAt drifted from the shipped profile, every number below would be
// measuring a function that is not in the renderer.
{
  let worst = 0;
  for (let i = 0; i <= 200; i++) {
    const u = i / 200;
    for (const t of [0, 30, 60, 90]) {
      const mine = ampAt(u, t, PRISM_WAVE_W);
      const real = prismWaveAmp(u, 0, t, DUR);
      worst = Math.max(worst, Math.abs(mine - real));
    }
  }
  if (worst > 1e-12) {
    throw new Error(`ampAt does not reproduce prismWaveAmp (worst ${worst}); the sweep would be fiction`);
  }
  console.log(`profile check: ampAt matches prismWaveAmp to ${worst.toExponential(1)} at the shipped W\n`);
}

// ── What n do real chords actually tessellate to? ─────────────────────────
console.log('REAL CHORDS — segment counts actually produced');
console.log('  span(px)   n (k=0)   n (k=3)   n (k=6)   arc len');
const spans = [20, 40, 70, 110, 160, 220, 300, 400, 520];
const seen = new Set();
for (const span of spans) {
  const row = [0, 3, 6].map(k => chordUs(span, k));
  row.forEach(r => seen.add(r.n));
  console.log(`  ${String(span).padStart(6)}   ${String(row[0].n).padStart(7)}   `
    + `${String(row[1].n).padStart(7)}   ${String(row[2].n).padStart(7)}   `
    + `${row[0].total.toFixed(0).padStart(6)}px`);
}

// ── The sweep ─────────────────────────────────────────────────────────────
console.log('\nRIPPLE (max-min reconstructed crest over one transit), by half-width W');
console.log('  lower is better; the bar is ' + RIPPLE_OK.toFixed(2));
const ns = [...seen].sort((a, b) => a - b);
process.stdout.write('\n     n  ');
for (const w of W_CANDIDATES) process.stdout.write(`   W=${w.toFixed(2)}`);
process.stdout.write('\n');
const table = new Map();
for (const span of spans) {
  const { us, n } = chordUs(span, 0);
  if (table.has(n)) continue;
  const row = W_CANDIDATES.map(w => ripple(us, w));
  table.set(n, row);
}
for (const n of [...table.keys()].sort((a, b) => a - b)) {
  process.stdout.write(`  ${String(n).padStart(4)}  `);
  for (const r of table.get(n)) {
    const s = (r * 100).toFixed(1) + '%';
    process.stdout.write(`  ${(r <= RIPPLE_OK ? ' ' + s : '*' + s).padStart(7)}`);
  }
  process.stdout.write('\n');
}
console.log('\n  * = above the bar');

// ── The recommendation ────────────────────────────────────────────────────
console.log('\nSMALLEST n THAT MEETS THE BAR, per W');
for (let wi = 0; wi < W_CANDIDATES.length; wi++) {
  const w = W_CANDIDATES[wi];
  let best = null;
  for (const n of [...table.keys()].sort((a, b) => a - b)) {
    if (table.get(n)[wi] <= RIPPLE_OK) { best = n; break; }
  }
  console.log(`  W = ${w.toFixed(2)}  ->  ` + (best === null
    ? 'NEVER meets the bar on any real chord'
    : `n >= ${best}`));
}

console.log(`\nSHIPPED RIGHT NOW: W = ${PRISM_WAVE_W}, `
  + `fade full at n >= ${PRISM_WAVE_SEG_FULL}, off at n <= ${PRISM_WAVE_SEG_NONE}`);
console.log(`Spectral lines per bundle: ${PRISM_SPECTRAL_FINE}`);

// ── FORCED TESSELLATION ───────────────────────────────────────────────────
//
// _a19budget measured the additive pool at 6.6% full at the provable worst
// case (4 concurrent effects, PRISM_MAX_EFFECTS) with ZERO dropped -- 15.1x
// headroom. The prism's instance count is almost exactly linear in n, so
// raising the tessellation is affordable in a way the "~74000 instances"
// remark in ArtTab.jsx suggests it is not. (That figure counts inner-loop
// ITERATIONS, not instances; the measured peak is 5408.)
//
// So the question stops being "can the CPU path carry a pulse at all" and
// becomes "at what n, and how wide". WORST CASE ACROSS GEOMETRIES is what is
// reported: the sweep above shows a short near-cusp chord is far worse than a
// long gentle one at the same n, because tessellateQuad splits at uniform
// PARAMETER and those segments differ several-fold in arc length. A guard set
// from the average would fail on exactly the chords that need it.
const FORCED = [12, 16, 20, 24, 32, 40, 48];
console.log('\n\nFORCED TESSELLATION — worst ripple over all spans and spectral lines');
process.stdout.write('\n     n  ');
for (const w of W_CANDIDATES) process.stdout.write(`   W=${w.toFixed(2)}`);
process.stdout.write('\n');
const best = new Map();
for (const n of FORCED) {
  process.stdout.write(`  ${String(n).padStart(4)}  `);
  for (let wi = 0; wi < W_CANDIDATES.length; wi++) {
    const w = W_CANDIDATES[wi];
    let worst = 0;
    for (const span of spans) {
      for (const k of [0, 3, 6]) {
        worst = Math.max(worst, ripple(chordUs(span, k, n).us, w));
      }
    }
    if (worst <= RIPPLE_OK && !best.has(w)) best.set(w, n);
    const s = (worst * 100).toFixed(1) + '%';
    process.stdout.write(`  ${(worst <= RIPPLE_OK ? ' ' + s : '*' + s).padStart(7)}`);
  }
  process.stdout.write('\n');
}
console.log('\n  * = above the ' + RIPPLE_OK.toFixed(2) + ' bar, on the WORST chord tested');
console.log('\nCHEAPEST n THAT MEETS THE BAR ON EVERY CHORD');
for (const w of W_CANDIDATES) {
  const n = best.get(w);
  console.log(`  W = ${w.toFixed(2)}  ->  ` + (n === undefined
    ? `never, up to n = ${FORCED[FORCED.length - 1]}`
    : `n = ${n}   (${(n / 9).toFixed(1)}x today's typical 9, vs 15.1x headroom)`));
}
