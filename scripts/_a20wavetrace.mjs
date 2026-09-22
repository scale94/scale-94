// _a20wavetrace.mjs — is the wavefront actually travelling, in the buffer the
// GPU reads?
//
// Every other check so far has been on the pure functions (artPrismWave.test
// .js) or on the sampling arithmetic (_a18wsweep.mjs). Neither touches the
// draw loop, and the draw loop is where the wave is composed with the depth
// cue, the root taper and the envelope, and where the tessellation is forced.
// A wave that is perfect in artEdges.js and wired up backwards in ArtTab.jsx
// would pass all 27 tests.
//
// So this reads the ADDITIVE INSTANCE BUFFER itself and watches the crest
// move along a real chord.
//
// ── HOW A CHORD IS RECOVERED FROM THE BUFFER ──────────────────────────────
//
// `writePolyline` is called once per chord with phase0 = 0 and accumulates arc
// length into float 16 as it walks. So a run of instances belonging to one
// chord is exactly a maximal stretch whose phase starts at 0 and increases --
// the reset to 0 IS the delimiter, by construction rather than by a tolerance.
//
// Alpha comes back out of float 13, which packAlphas encodes as three bytes
// (start, mid, end). The START stop is read, because that is the value the
// ramp actually has at this instance's own arc position; the mid is a
// reconstruction and the end belongs to the next instance.
//
//   node scripts/_a20wavetrace.mjs [W] [H] [DPR] [PORT]
import { launch } from './cdp.mjs';
// THE FLOOR IS IMPORTED, NOT TYPED. This script printed a hard-coded 0.450
// while PRISM_WAVE_DEPTH was ruled down to 0.40 -- an instrument quoting a
// design number the design no longer holds is exactly the class of defect
// this session's traps list is full of.
import { PRISM_WAVE_DEPTH } from '../src/terminal/art/artEdges.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const W    = Number(process.argv[2] ?? 1520);
const H    = Number(process.argv[3] ?? 900);
const DPR  = Number(process.argv[4] ?? 1);
const PORT = Number(process.argv[5] ?? 5173);
const ARM  = process.argv[6] === undefined ? null : Number(process.argv[6]);
const URL  = `http://localhost:${PORT}/`;
const OUT  = 'lookbook/prismwave';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_RECT = '(() => { const c = ' + SPHERE + '; const r = c.getBoundingClientRect();'
  + ' return { x: r.x, y: r.y, w: r.width, h: r.height }; })()';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 700; })()';
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';

const DISCS = `(() => {
  const s = window.__artEdgeState(); const ST = s.stride, D = s.instances, out = [];
  for (let i = 0; i < s.count; i++) {
    const o = i * ST, w = D[o + 14];
    if (w < 0) out.push([D[o], D[o + 1], -w]);
  }
  return JSON.stringify({ w: s.w, h: s.h, discs: out });
})()`;

// Longest polyline run in the additive stream, as (phase, alpha) pairs.
// Particle streaks are excluded by index: they are written after
// `particleStart` and share the layer but not the geometry.
// Per-run SUMMARIES, not one hand-picked run.
//
// TWO DEFECTS THIS REPLACES, both of which produced numbers that looked fine:
//
// 1. IT PICKED "THE LONGEST RUN" EVERY FRAME. Once the draw loop forces
//    PRISM_WAVE_SEGMENTS, HUNDREDS of runs are exactly that long and which one
//    comes out longest is arbitrary -- so consecutive samples described
//    DIFFERENT CHORDS and the resulting crest sequence was not a trajectory at
//    all. Runs are emitted in a deterministic order (pair loop x spectral
//    line), so an INDEX is a stable identity and "longest" is not.
// 2. IT MEASURED THE ROOT TAPER, NOT THE WAVE. prismRootTaper drives alpha to
//    0 at both ends of the wide pass, so min/max over the whole run reported a
//    trough of exactly 0 on every frame -- including frames with no wave at
//    all. The interior window below excludes both tapered ends.
const RUNS = `(() => {
  const s = window.__artEdgeState();
  const a = s.additive, ST = s.stride, D = a.instances;
  const limit = a.particleStart > 0 ? Math.min(a.particleStart, a.count) : a.count;
  const runs = []; let cur = null;
  for (let i = 0; i < limit; i++) {
    const o = i * ST, ph = D[o + 16], p = D[o + 13];
    const a0 = Math.floor(p % 256) / 255;
    if (ph === 0) { cur = []; runs.push(cur); }
    if (cur) cur.push([ph, a0, D[o], D[o + 1], D[o + 14]]);
  }
  // NOT FILTERED, and that is deliberate. An earlier version dropped short
  // runs and then addressed lines by position -- but dropping ANY run shifts
  // every index after it, so "run 2k+1" named a different stroke than
  // intended and the whole shear table was misaddressed. Runs keep their
  // original index; the caller decodes which line a run belongs to from its
  // WIDTH, which does not depend on ordering at all.
  const out = runs.map((pts, idx) => {
    const n = pts.length, maxPh = pts[n - 1][0] || 1;
    const wid = pts[0][4];
    // The CORE pass is untapered (prismRootTaper touches only the wide pass),
    // so its crest is read over the WHOLE run. The wide pass is windowed to
    // the interior, because its alpha is driven to 0 at both ends by the taper
    // and an unwindowed min would report the taper instead of the wave.
    const core = wid < 2;
    let hiA = -1, hiPh = 0, loA = 2, seen = 0;
    for (const [ph, al] of pts) {
      const f = ph / maxPh;
      if (!core && (f < 0.2 || f > 0.8)) continue;
      seen++;
      if (al > hiA) { hiA = al; hiPh = ph; }
      if (al < loA) loA = al;
    }
    return {
      idx, n, seen, core, w: +wid.toFixed(3), crest: hiPh / maxPh, lo: loA, hi: hiA,
      x: Math.round(pts[0][2]), y: Math.round(pts[0][3]),
    };
  });
  return JSON.stringify({ total: a.count, limit, count: out.length, runs: out });
})()`;

const GEOM = '(() => JSON.stringify(window.__artGeomState()))()';

const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: false });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere canvas' });
  await sleep(1500);

  let armSet = null;
  if (ARM !== null) {
    armSet = JSON.parse(await page.eval(`JSON.stringify(window.__artSetPacketArm(${ARM}))`));
    if (!armSet || armSet.packetArm !== ARM) throw new Error(`__artSetPacketArm(${ARM}) did not land: ${JSON.stringify(armSet)}`);
    console.log(`packet arm ${ARM}: w=${armSet.w} step=${armSet.step} forced n=${armSet.segments}`);
  }
  const FORCED_N = armSet ? armSet.segments : 40;

  const idle = JSON.parse(await page.eval(DISCS));
  const rect = await page.eval(SPHERE_RECT);
  const t = idle.discs.slice().sort((a, b) => b[2] - a[2])[0];
  await page.click(rect.x + t[0] * (rect.w / idle.w), rect.y + t[1] * (rect.h / idle.h));

  // ── SAMPLE THE SHEAR IMMEDIATELY, WHILE THE FIRST PULSE IS STILL IN FLIGHT.
  //
  // The train is three pulses at ~103ms each plus a 260ms tail -- under 600ms
  // in total -- and a single RUNS eval costs a sizeable fraction of that,
  // because __artEdgeState materialises the whole additive buffer before this
  // expression reduces it. An earlier version took the shear frame at the END
  // of the trajectory loop, ~900ms after the click, and read every crest at
  // u ~ 1.0: the train was long over and it was measuring the depth cue's own
  // ramp, not the wave. These samples are taken back to back, right here.
  const early = [];
  for (let i = 0; i < 6; i++) {
    const g = JSON.parse(await page.eval(GEOM));
    const r = JSON.parse(await page.eval(RUNS));
    const life = g.effects.length ? Math.max(...g.effects.map(e => e.life)) : -1;
    early.push({ ageMs: life >= 0 ? life * (1000 / 60) : -1, runs: r.runs });
  }

  // TRACK ONE RUN BY INDEX. Chosen on the first frame that has a full-length
  // run and held fixed after that, so every row below describes the SAME
  // chord and the same spectral line. The run count is asserted on every
  // sample: if it moves, an effect spawned or died and the index no longer
  // names what it named, so the trajectory is abandoned rather than reported.
  let track = -1, runCount = -1, broke = false;
  console.log('\n  t(ms)   segs   crest@   trough    crest     ratio   verdict');
  const rows = [];
  for (let i = 0; i < 16; i++) {
    await sleep(55);
    const g = JSON.parse(await page.eval(GEOM));
    const r = JSON.parse(await page.eval(RUNS));
    if (!r.count) continue;
    const life = g.effects.length ? g.effects[0].life : -1;
    const ageMs = life >= 0 ? life * (1000 / 60) : -1;

    if (track < 0) {
      let best = -1;
      for (let j = 0; j < r.runs.length; j++) {
        if (r.runs[j].n >= FORCED_N && (best < 0 || r.runs[j].n > r.runs[best].n)) best = j;
      }
      if (best < 0) continue;
      track = best; runCount = r.count;
    }
    if (r.count !== runCount) { broke = true; break; }
    const run = r.runs[track];
    if (!run) { broke = true; break; }

    const ratio = run.hi > 1e-9 ? run.lo / run.hi : 1;
    rows.push({ ageMs, segs: run.n, crest: run.crest, lo: run.lo, hi: run.hi, ratio });
    console.log(`  ${ageMs.toFixed(0).padStart(5)}   ${String(run.n).padStart(4)}   `
      + `${run.crest.toFixed(3).padStart(6)}   ${run.lo.toFixed(3).padStart(6)}  ${run.hi.toFixed(3).padStart(6)}  `
      + `${ratio.toFixed(3).padStart(6)}   ${ratio < 0.9 ? 'MODULATED' : 'flat'}`);
  }
  if (broke) console.log('\n  (trajectory abandoned: the run population changed mid-trace)');

  // ── The two things this instrument exists to decide ──────────────────────
  const modulated = rows.filter(r => r.ratio < 0.9);
  const forced = rows.filter(r => r.segs >= FORCED_N);
  const seenN = [...new Set(rows.map(r => r.segs))].sort((a, b) => a - b);
  console.log(`\n  frames sampled            ${rows.length}`);
  console.log(`  frames showing modulation  ${modulated.length}`);
  console.log(`  frames at forced n >= ${FORCED_N}   ${forced.length}`);
  console.log(`  run lengths seen           ${seenN.join(', ')}   (arm expects ${FORCED_N})`);

  if (!modulated.length) {
    console.log('\nVERDICT: NO MODULATION SEEN. The wave is not reaching the buffer — '
      + 'the alpha along every chord is as flat as it was before this feature existed.');
  } else {
    const first = modulated[0], last = modulated[modulated.length - 1];
    const moved = last.crest - first.crest;
    console.log(`  crest travelled            ${first.crest.toFixed(3)} -> ${last.crest.toFixed(3)}`
      + `  (${moved >= 0 ? '+' : ''}${moved.toFixed(3)} of the chord)`);
    console.log(`  deepest trough/crest       ${Math.min(...modulated.map(r => r.ratio)).toFixed(3)}`
      + `   (design floor is 1 - PRISM_WAVE_DEPTH = ${(1 - PRISM_WAVE_DEPTH).toFixed(3)},`
      + ` and it is only reached at ARRIVAL now -- the swell scales it)`);
    console.log('\nVERDICT: ' + (Math.abs(moved) > 0.05
      ? 'THE CREST IS TRAVELLING along the chord in the GPU-bound buffer.'
      : 'modulation is present but the crest is NOT moving — check the t/T term.'));
  }

  // ── THE DIAGONAL, IN ONE FRAME ──────────────────────────────────────────
  //
  // This is the decisive check, and it needs no trajectory at all.
  //
  // Chasing one chord across frames is the wrong instrument for a THREE-PULSE
  // train: at any instant the brightest crest may belong to pulse 0, 1 or 2,
  // so the crest position sawtooths rather than advancing, and "did it move"
  // is not a well-posed question over a window longer than one transit. The
  // shear across spectral lines, by contrast, is visible in a SINGLE frame and
  // is the feature's actual signature.
  //
  // Solving `u - t/T + phi_k*(1-u) = 0` gives the crest of line k at
  //
  //     u_k = (t/T - phi_k) / (1 - phi_k)
  //
  // which decreases monotonically in k. That IS the diagonal the author asked
  // for, and it collapses to a single point at u = 1 because phi_k is damped
  // by (1-u) -- the arrival convergence, measurable rather than asserted.
  //
  // Runs are emitted pair-by-pair, and within a pair k ascends with a glow
  // pass then a core pass each, so run 2k+1 of a pair is line k's CORE. The
  // core is read because it is the untapered pass: prismRootTaper touches only
  // the wide one, so nothing has to be windowed out.
  // DECODED BY STROKE WIDTH, not by position. prismGlowWidth(k) is
  // 5 - 0.4k, so the wide pass's own width names its spectral line; the core
  // that follows it is the untapered twin of the same chord. Nothing here
  // depends on how many runs came before, which is what the previous version
  // got wrong.
  const readShear = (rs) => {
    const crests = [];
    for (let i = 0; i + 1 < rs.length && crests.length < 7; i++) {
      const g = rs[i], c = rs[i + 1];
      if (g.core || !c.core) continue;            // want a (wide, core) couple
      if (g.n < FORCED_N || c.n < FORCED_N) continue;
      const k = Math.round((5 - g.w) / 0.4);
      if (k < 0 || k > 6) continue;
      if (crests.length && k !== crests[crests.length - 1].k + 1) { crests.length = 0; }
      crests.push({ k, u: c.crest, hi: c.hi });
    }
    return crests;
  };

  console.log('\n  THE DIAGONAL — crest position per spectral line, per frame');
  console.log('    age(ms)      k=0     k=1     k=2     k=3     k=4     k=5     k=6    spread  mono');
  let bestShear = null;
  for (const f of early) {
    const cr = readShear(f.runs);
    if (cr.length < 5) continue;
    const spread = Math.max(...cr.map(c => c.u)) - Math.min(...cr.map(c => c.u));
    let mono = 0;
    for (let i = 1; i < cr.length; i++) if (cr[i].u <= cr[i - 1].u + 1e-9) mono++;
    const cells = Array.from({ length: 7 }, (_, k) => {
      const c = cr.find(x => x.k === k);
      return (c ? c.u.toFixed(3) : '  -  ').padStart(6);
    }).join('  ');
    console.log(`    ${f.ageMs.toFixed(0).padStart(6)}    ${cells}   ${spread.toFixed(3)}  ${mono}/${cr.length - 1}`);
    if (!bestShear || mono > bestShear.mono || (mono === bestShear.mono && spread > bestShear.spread)) {
      bestShear = { mono, spread, n: cr.length - 1, ageMs: f.ageMs };
    }
  }
  if (!bestShear) {
    console.log('    (no frame had five full-length runs to read)');
  } else {
    console.log(`\n    best frame: ${bestShear.mono}/${bestShear.n} monotonic steps, `
      + `shear ${bestShear.spread.toFixed(3)} of the chord, at ${bestShear.ageMs.toFixed(0)}ms`);
    console.log('    ' + (bestShear.spread > 0.05 && bestShear.mono >= bestShear.n - 1
      ? 'THE STRANDS ARE SHEARED INTO A DIAGONAL, as designed.'
      : 'NO CLEAN DIAGONAL in any sampled frame — read the table before concluding.'));
  }

  mkdirSync(OUT, { recursive: true });
  for (const [tag, ms] of [['a-launch', 0], ['b-mid', 90], ['c-arrive', 90], ['d-sustained', 900]]) {
    if (ms) await sleep(ms);
    const png = await page.screenshot();
    writeFileSync(`${OUT}/${tag}.png`, png);
  }
  writeFileSync(`${OUT}/trace.json`, JSON.stringify(rows, null, 2));
  console.log(`\nframes + trace written to ${OUT}/`);
} finally {
  await page.close();
}
