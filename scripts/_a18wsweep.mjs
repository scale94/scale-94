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
  PRISM_WAVE_W, PRISM_WAVE_SEG_FULL, PRISM_WAVE_SEG_NONE, PRISM_SPECTRAL_FINE,
} from '../src/terminal/art/artEdges.js';
import { rippleChordUs as chordUs, prismRipple as ripple } from '../src/terminal/art/artPrismRipple.js';

const W_CANDIDATES = [0.09, 0.108, 0.135, 0.18, 0.22, 0.30];
const RIPPLE_OK = 0.05;      // the bar: 5% flicker on the crest

// ── What n do real chords actually tessellate to? ─────────────────────────
console.log('REAL CHORDS — segment counts actually produced');
console.log('  span(px)   n (k=0)   n (k=3)   n (k=6)');
const spans = [20, 40, 70, 110, 160, 220, 300, 400, 520];
const seen = new Set();
for (const span of spans) {
  const row = [0, 3, 6].map(k => chordUs(span, k).length - 1);
  row.forEach(n => seen.add(n));
  console.log(`  ${String(span).padStart(6)}   ${String(row[0]).padStart(7)}   `
    + `${String(row[1]).padStart(7)}   ${String(row[2]).padStart(7)}`);
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
  const us = chordUs(span, 0);
  const n = us.length - 1;
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
const FORCED = [24, 32, 40, 48, 56, 64, 72, 80, 96, 112];
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
        worst = Math.max(worst, ripple(chordUs(span, k, n), w));
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
