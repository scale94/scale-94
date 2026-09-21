// _a22chroma.mjs — is the COLOUR advecting, and what does it cost in light?
//
// The wave's brightness was already proven to travel (_a20wavetrace). This
// answers the other half: the author's report that "the colour remains
// completely static along the chord ... pinned to the wire like a light
// shining through stained glass". Two independent questions, deliberately in
// one script because the second is the safety argument for the first.
//
// ── 1. THE BOUND, WHICH NEEDS NO BROWSER ──────────────────────────────────
//
// The alpha wave is provably ink-NEGATIVE, so it cannot reach the composer's
// 0.28 luminanceThreshold and the bloom dial is untouched by construction.
// COLOUR CARRIES NO SUCH PROOF: a yellow and a blue at the same HSL lightness
// are not the same brightness, so even a pure hue rotation moves luminance.
// This computes the WORST CASE exactly rather than arguing it -- the largest
// Rec.709 luminance ratio between any resting hue and the tint it can be
// rotated to, over every hue on the wheel and both passes' lightness.
//
// It is a bound on the CREST only. The tint's weight is amp * env * segFade,
// so a point reaches the figure below only where the pulse peaks, on a chord
// that is mid-pass, and every other point on every other chord is nearer 1.
//
// ── 2. THE ADVECTION, WHICH NEEDS THE GPU-BOUND BUFFER ────────────────────
//
// Reads the additive buffer's c0 stop per segment and decodes its hue. A run
// whose hue spread is 0 is a chord whose colour is pinned to the wire -- which
// is what EVERY prism run read before this change, because writePolyline wrote
// one rgb into all three gradient stops and degenerated the gradient.
//
//   node scripts/_a22chroma.mjs [W] [H] [DPR] [PORT]
import { launch } from './cdp.mjs';
import {
  PRISM_SAT, PRISM_GLOW_LIT, PRISM_CORE_LIT,
  PRISM_HUE_LEAD, PRISM_HUE_SKEW, PRISM_HUE_STEP,
} from '../src/terminal/art/artEdges.js';

const W    = Number(process.argv[2] ?? 1520);
const H    = Number(process.argv[3] ?? 900);
const DPR  = Number(process.argv[4] ?? 1);
const PORT = Number(process.argv[5] ?? 5173);
const URL  = `http://localhost:${PORT}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Part 1: the luminance bound ───────────────────────────────────────────

/** The CSS Color 4 reference conversion, the same one writeHsl uses. */
function hsl2rgb(hue, sat, lit) {
  const h = ((hue % 360) + 360) % 360, s = sat / 100, l = lit / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/** Rec.709 relative luminance, on the sRGB values the buffer actually holds.
 *  NOT linearised: the blend the shader does and the sum the composer's
 *  bright-pass sees both act on these, so linearising here would answer a
 *  question nobody is asking. */
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function bound() {
  console.log('── 1. What the tint can do to luminance, at the crest ──\n');
  console.log(`  rotation range   +${PRISM_HUE_LEAD - PRISM_HUE_SKEW}deg `
    + `.. +${PRISM_HUE_LEAD + PRISM_HUE_SKEW}deg   (one spectral step is ${PRISM_HUE_STEP}deg)`);
  // THE TWO DIRECTIONS ARE NOT THE SAME QUESTION. Dimming is ink-negative and
  // cannot reach the composer's bright-pass; only BRIGHTENING can. Reporting a
  // single max(r, 1/r) would let a large safe excursion hide the small unsafe
  // one, which is the shape of instrument defect this project keeps paying
  // for, so they are separated.
  console.log('\n  pass    lit    max BRIGHTER   at hue    max dimmer   at hue');
  let worstUp = 1;
  for (const [name, lit] of [['glow', PRISM_GLOW_LIT], ['core', PRISM_CORE_LIT]]) {
    let up = 1, upH = 0, down = 1, downH = 0;
    for (let h = 0; h < 360; h += 0.5) {
      const base = lum(hsl2rgb(h, PRISM_SAT, lit));
      if (!(base > 1e-9)) continue;
      for (const off of [PRISM_HUE_LEAD - PRISM_HUE_SKEW, PRISM_HUE_LEAD, PRISM_HUE_LEAD + PRISM_HUE_SKEW]) {
        const r = lum(hsl2rgb(h + off, PRISM_SAT, lit)) / base;
        if (r > up) { up = r; upH = h; }
        if (1 / r > down) { down = 1 / r; downH = h; }
      }
    }
    worstUp = Math.max(worstUp, up);
    console.log(`  ${name.padEnd(6)} ${String(lit).padStart(4)}   `
      + `${up.toFixed(3)}x        ${upH.toFixed(0).padStart(4)}    `
      + `${down.toFixed(3)}x       ${downH.toFixed(0).padStart(4)}`);
  }
  console.log(`\n  THE NUMBER THAT MATTERS IS THE BRIGHTENING: ${worstUp.toFixed(3)}x, and only`);
  console.log('  ON THE CREST -- the tint is weighted by amp * env * segFade, so every');
  console.log('  other point on the chord, and every chord not mid-pass, sits nearer');
  console.log('  1.000x. Dimming is ink-negative and cannot reach the bright-pass.');
  return worstUp;
}

// ── Part 2: the buffer ────────────────────────────────────────────────────

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_READY = `(() => { const c = ${SPHERE}; return !!c && c.width > 0; })()`;
const SPHERE_RECT = `(() => { const r = ${SPHERE}.getBoundingClientRect();` +
  ' return { x: r.x, y: r.y, w: r.width, h: r.height }; })()';

// THE YOUNGEST EFFECT, NOT effects[0]. effects[0] is the OLDEST, and reading
// it is why the first version of this loop never confirmed a spawn: the click
// did land, the read came back showing the PREVIOUS effect still running at
// 400ms, the age test rejected it as "not mine", and ten attempts in a row
// were thrown away while the sphere was firing perfectly well each time.
const LIVE = '(() => { const s = window.__artGeomState();' +
  ' return JSON.stringify({ n: s.effects.length,' +
  ' life: s.effects.length ? Math.min(...s.effects.map(e => e.life)) : -1 }); })()';

const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';

// ── PICKING A NODE THAT WILL ACTUALLY FIRE ────────────────────────────────
//
// NEITHER SINGLE HEURISTIC SURVIVES CONTACT, and both were tried here first.
// "The largest disc" tracks whatever is LIT -- the layer inflates a disc when
// its node fires and the sphere fires ambient effects of its own -- so it
// wanders the whole sphere and lands on the far side, where the click is
// ignored: five attempts in a row spawned nothing. "Nearest the projected
// centre" is ambiguous by construction, because a sphere projects its near
// pole and its far pole onto the same point.
//
// So this stops guessing and MEASURES instead. Under CDP, ordering by
// distance from the projected centre lands a spawn on most attempts and
// ordering by radius landed none in ten; inside the desktop browser pane the
// opposite held. Rather than pick a winner, the caller CLICKS A DIFFERENT
// DISC on each attempt and CONFIRMS THE SPAWN before any number is believed.
// The first version of this instrument printed "NO CHORD CARRIES A COLOUR
// RAMP" off eight frames of an idle sphere -- `effects` was 0 the whole time
// and nothing looked at it.
const TARGETS = `(() => {
  const c = ${SPHERE};
  const r = c.getBoundingClientRect();
  const s = window.__artEdgeState(), ST = s.stride, D = s.instances;
  const cx = s.w / 2, cy = s.h / 2;
  const out = [];
  for (let i = 0; i < s.count; i++) {
    const o = i * ST, w = D[o + 14];
    if (w >= 0) continue;
    out.push({ d: Math.hypot(D[o] - cx, D[o + 1] - cy),
      x: r.x + D[o] * (r.width / s.w), y: r.y + D[o + 1] * (r.height / s.h) });
  }
  out.sort((a, b) => a.d - b.d);
  return JSON.stringify({ ok: out.length > 0, discs: out.slice(0, 12) });
})()`;

// Per RUN (one polyline), the c0 stop of every segment. Runs are delimited by
// phase === 0 exactly as _a20wavetrace delimits them, and are NOT filtered:
// dropping any run renumbers every later one.
const RUNS = `(() => {
  const s = window.__artEdgeState();
  const a = s.additive, ST = s.stride, D = a.instances;
  const limit = a.particleStart > 0 ? Math.min(a.particleStart, a.count) : a.count;
  const runs = []; let cur = null;
  for (let i = 0; i < limit; i++) {
    const o = i * ST, ph = D[o + 16];
    if (ph === 0) { cur = { w: D[o + 14], cols: [] }; runs.push(cur); }
    if (cur) cur.cols.push([D[o + 4], D[o + 5], D[o + 6]]);
  }
  return JSON.stringify({ count: runs.length, runs });
})()`;

/** Hue from an rgb triple, degrees. The inverse of the ramp's own conversion
 *  for anything fully saturated, which every prism colour is. */
function rgbHue([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 1e-9) return 0;
  let h;
  if (mx === r)      h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else               h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** The largest signed hue excursion in a run, against the run's own MEDIAN.
 *  The median and not the mean, and not the first segment: most of a chord is
 *  untinted even mid-pass, so the median IS the resting colour, and a mean
 *  would be dragged by the tint it is supposed to measure. */
function runExcursion(cols) {
  const hues = cols.map(rgbHue);
  const sorted = hues.slice().sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1];
  let worst = 0;
  for (const h of hues) {
    let d = h - med;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    if (Math.abs(d) > Math.abs(worst)) worst = d;
  }
  return { med, worst, n: cols.length };
}

const worstRatio = bound();

console.log('\n── 2. Is the colour in the GPU-bound buffer, and does it move? ──\n');
const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: false });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere canvas' });
  await page.eval(SPHERE_RECT);
  await sleep(1500);

  // CONFIRM THE SPAWN. A click that lands beside a 14-20px disc is ignored in
  // silence, and every number below would then describe an idle sphere.
  let born = -1;
  for (let attempt = 0; attempt < 10 && born < 0; attempt++) {
    const t = JSON.parse(await page.eval(TARGETS));
    if (!t.ok) { await sleep(300); continue; }
    const d = t.discs[attempt % t.discs.length];
    await page.click(d.x, d.y);
    // A spawn takes a render to reach geomEffectsRef, and reading before it
    // lands looks exactly like a click that missed.
    await sleep(60);
    const g = JSON.parse(await page.eval(LIVE));
    if (g.n > 0 && g.life * (1000 / 60) < 300) born = g.life * (1000 / 60);
    else await sleep(g.n > 0 ? 4200 : 400);
  }
  if (born < 0) throw new Error('no effect spawned after 10 clicks -- nothing to measure');
  console.log(`   (effect confirmed alive at ${born.toFixed(0)}ms)\n`);

  console.log('   t(ms)   runs   tinted   widest excursion   median hue of that run');
  const rows = [];
  for (let i = 0; i < 10; i++) {
    const g = JSON.parse(await page.eval(LIVE));
    const r = JSON.parse(await page.eval(RUNS));
    if (!r.count || g.n === 0) { await sleep(40); continue; }
    let tinted = 0, widest = { worst: 0, med: 0 };
    for (const run of r.runs) {
      if (run.cols.length < 4) continue;
      const e = runExcursion(run.cols);
      if (Math.abs(e.worst) > 0.5) tinted++;
      if (Math.abs(e.worst) > Math.abs(widest.worst)) widest = e;
    }
    rows.push({ tinted, widest: widest.worst });
    console.log(`   ${String(i * 55).padStart(5)}   ${String(r.count).padStart(4)}   `
      + `${String(tinted).padStart(6)}   ${widest.worst.toFixed(1).padStart(14)}deg   `
      + `${widest.med.toFixed(0).padStart(10)}deg`);
    await sleep(40);
  }

  const everTinted = Math.max(...rows.map(r => r.tinted));
  const widest = Math.max(...rows.map(r => Math.abs(r.widest)));
  console.log('');
  if (everTinted === 0) {
    console.log('VERDICT: NO CHORD CARRIES A COLOUR RAMP. Every run is one flat hue --');
    console.log('  the gradient stops are still being written from a single rgb and the');
    console.log('  colour is pinned to the wire exactly as it was.');
  } else {
    console.log(`VERDICT: THE COLOUR IS RAMPED ALONG THE CHORD in the GPU-bound buffer.`);
    console.log(`  peak ${everTinted} runs tinted at once, widest excursion ${widest.toFixed(1)}deg`);
    console.log(`  against a design maximum of ${PRISM_HUE_LEAD + PRISM_HUE_SKEW}deg and a`);
    console.log(`  spectral spacing of ${PRISM_HUE_STEP}deg -- so no crest can wear its`);
    console.log('  neighbour strand\'s resting colour.');
    console.log(`  Worst-case luminance cost at those crests: ${worstRatio.toFixed(3)}x (part 1).`);
  }
} finally {
  await page.close();
}
