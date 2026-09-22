// _a23combR.mjs — does the crest have a reference hue to be different from?
//
// THE METRIC THE PROJECT DID NOT HAVE. The shipped chromatic front is
// invisible because the bundle puts 288deg of the hue wheel on screen 2.8px
// apart: 11-12 of 12 hue bins occupied every frame, circular concentration R
// as low as 0.03. A hue excursion is only readable against a field that is not
// already wearing every hue, so the number that matters is not the excursion
// in degrees -- it is R.
//
//   R = |mean unit vector over hue| :  1 = the bundle wears ONE hue
//                                      0 = the bundle wears every hue
//
// Arm U should drive R at the crest from ~0.03 toward 1. Arm A should drive
// delivered saturation down while the value holds.
//
// CLIPS TO THE BUNDLE'S OWN REGION, not the whole sphere canvas. The
// section-0 measurement in the design spec was WHOLE-FRAME and therefore
// includes the nodes, the base edges, the filaments and the chimera fringes
// -- a large population of pixels window.__artSetChromaMode is structurally
// incapable of moving. Those numbers must not be quoted against a crest.
// shootAtAge is called with `{ bundleClip: true }`, which computes a padded
// bounding box from the live effect's own prism geometry each shot -- see
// _prismSpawn.mjs's BUNDLE_BBOX. (An earlier version of this file clipped to
// the whole sphere canvas instead; task-5 review finding 1.)
//
// STEP 2b IS A BLOCKING GATE. Task 4 wired window.__artSetChromaMode but
// never flipped it in a browser -- the only end-to-end run before this one
// exercised mode 0, the default. Before any R value below is trusted, this
// script reads window.__artEdgeState()'s additive buffer directly, per arm,
// and prints the OBSERVED hue excursion and minimum saturation. If any two
// arms come back numerically identical, that is a broken switch, not a null
// result, and the script stops before printing the R table.
//
//   node scripts/_a23combR.mjs [W] [H] [DPR] [PORT]
import sharp from 'sharp';
import { launch } from './cdp.mjs';
import { SPHERE, SPHERE_READY, clickText, shootAtAge, PRISM_BBOX_PAD_PX } from './_prismSpawn.mjs';

const W    = Number(process.argv[2] ?? 1520);
const H    = Number(process.argv[3] ?? 900);
const DPR  = Number(process.argv[4] ?? 1);
const PORT = Number(process.argv[5] ?? 5173);
const URL  = `http://localhost:${PORT}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ARMS = [
  { mode: 0, name: 'shipped  (rotate in place)' },
  { mode: 1, name: 'U unison (gather to one hue)' },
  { mode: 2, name: 'A achrom (bleach the crest)' },
];
// Ages chosen to straddle the crescendo: prismWaveEnv swells over one transit
// (56-128ms) and releases over PRISM_WAVE_TAIL_MS = 360ms.
const AGES = [55, 80, 105, 140, 200];

// Step 3's gate is now SIGNAL-TO-NOISE, not absolute-band or ±tolerance
// reproducibility. Both of those were wrong in opposite directions: the
// absolute band was measured at a different clip entirely, and demanding
// bit-for-bit repeatability from a real-clock rAF effect is a stronger
// requirement than any ranking actually needs. What a ranking needs is that
// the noise be small AGAINST THE SEPARATION IT IS TRYING TO RESOLVE -- an
// SNR question, not a tolerance question.
//
// So: every (arm, age) cell is sampled SAMPLES_PER_CELL times (fresh spawn
// each time) and reported as its MEDIAN, with the min-to-max spread carried
// through as that cell's error bar. Separately, the shipped arm is run
// through two more independent single-sample passes across all five ages --
// not to gate on ±tolerance, but to measure the instrument's own noise floor
// (the largest and mean |diff| between the two passes). The gate passes
// when that noise floor is under 1/(SNR_GATE_DIVISOR) of the smallest
// arm-to-arm separation actually present in the median table: only then does
// a difference between arms mean more than measurement noise. If the arms
// are closer together than that, the arms are indistinguishable ON THIS
// METRIC -- a real finding, printed plainly, not a blocked run.
const SAMPLES_PER_CELL = 3;
const SNR_GATE_DIVISOR = 3;

// Same order-of-magnitude wait _a21wavefilm.mjs uses between ages ("let the
// effect die entirely before the next"), applied here between ARMS instead.
// A pass's authored life runs up to 300 frames (maxLife, capped) -- ~5s at a
// correct clock -- and geomEffectsRef can hold more than one effect at once
// (the sphere fires ambient effects of its own, and this script's own click
// retries can land a second one on top of that). window.__artSetChromaMode
// is GLOBAL and read fresh every frame; it does not tag an effect with the
// arm that was live when it spawned. So a still-alive straggler from the
// PREVIOUS arm would not just render under the wrong arm -- it would sit
// inside the exact buffer range shootAtAge's bundle clip and RUNS both walk,
// corrupting the box and the colour read with two bundles at once. Task-5
// review finding 4.
const ARM_DECAY_MS = 4200;

// ── Step 2b's buffer readers, copied VERBATIM from scripts/_a22chroma.mjs
// (its Part 2, lines ~99-165). Each encodes a trap already paid for there:
// LIVE reads the YOUNGEST effect (effects[0] is the OLDEST, and reading it
// throws away good clicks); TARGETS orders discs by distance from the
// projected centre and expects the caller to try several and CONFIRM the
// spawn before believing any number; RUNS reads the additive buffer's c0
// stop per segment, delimited by phase === 0 exactly as the wavetrace
// instrument delimits a run, and is NOT filtered -- dropping any run would
// renumber every later one. SPHERE/SPHERE_READY/clickText are imported from
// _prismSpawn.mjs rather than re-copied: they are byte-identical to
// _a22chroma.mjs's own copies (same selector, same substring-match button
// finder), so importing is the DRY form of "verbatim reuse", not a rewrite.
const SPHERE_RECT = `(() => { const r = ${SPHERE}.getBoundingClientRect();` +
  ' return { x: r.x, y: r.y, w: r.width, h: r.height }; })()';

const LIVE = '(() => { const s = window.__artGeomState();' +
  ' return JSON.stringify({ n: s.effects.length,' +
  ' life: s.effects.length ? Math.min(...s.effects.map(e => e.life)) : -1 }); })()';

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

/** Hue (degrees) and saturation from an rgb triple already in the buffer's
 *  own 0-1 range (writeHsl writes floats, not bytes -- no /255 here). */
function hueSatOf([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const sat = mx > 1e-9 ? d / mx : 0;
  if (d < 1e-9) return { hue: null, sat };
  let h;
  if (mx === r)      h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else               h = (r - g) / d + 4;
  h *= 60;
  return { hue: h < 0 ? h + 360 : h, sat };
}

/** The largest signed hue excursion in a run against the run's own MEDIAN
 *  hue, plus the minimum saturation the run carries. Median and not mean,
 *  same reasoning as _a22chroma.mjs's runExcursion: most of a chord is
 *  untinted even mid-pass, so the median IS the resting colour and a mean
 *  would be dragged by the tint it is supposed to measure. */
function runHueSat(cols) {
  const px = cols.map(hueSatOf);
  const hues = px.map(p => p.hue).filter(h => h !== null);
  const sats = px.map(p => p.sat);
  let worst = 0;
  if (hues.length) {
    const sorted = hues.slice().sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1];
    for (const h of hues) {
      let d = h - med;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      if (Math.abs(d) > Math.abs(worst)) worst = d;
    }
  }
  return { worst, minSat: sats.length ? Math.min(...sats) : NaN };
}

/** Confirm a spawn (trying several discs, per _a22chroma.mjs's TARGETS
 *  comment: neither "largest disc" nor "nearest centre" alone survives
 *  contact), then sample the additive buffer for ~400ms and report the
 *  WORST (largest-magnitude) hue excursion and the LOWEST saturation seen
 *  across every run long enough to judge (>= 4 points). */
async function sampleArm(page) {
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
  if (born < 0) return null;

  let maxExcursion = 0, minSat = Infinity, samples = 0;
  for (let i = 0; i < 10; i++) {
    const g = JSON.parse(await page.eval(LIVE));
    const r = JSON.parse(await page.eval(RUNS));
    if (!r.count || g.n === 0) { await sleep(40); continue; }
    for (const run of r.runs) {
      if (run.cols.length < 4) continue;
      const a = runHueSat(run.cols);
      if (Math.abs(a.worst) > Math.abs(maxExcursion)) maxExcursion = a.worst;
      if (Number.isFinite(a.minSat) && a.minSat < minSat) minSat = a.minSat;
      samples++;
    }
    await sleep(40);
  }
  return { born, maxExcursion, minSat: Number.isFinite(minSat) ? minSat : NaN, samples };
}

// ── Step 3's frame analysis: HSV hue + saturation of one PIXEL (PNG bytes,
// 0-255), as given in the task brief. Deliberately a SEPARATE function from
// hueSatOf above: this one reads a screenshot's bytes, that one reads the
// GPU-bound buffer's floats, and the two must not be conflated.
function hueSat(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (mx < 0.35) return null;              // background and film-grain floor
  const sat = d / mx;
  if (sat < 0.25) return { hue: null, sat, val: mx };
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return { hue: h, sat, val: mx };
}

/** R, the circular concentration, plus the saturation percentiles. */
function analyse(buf, channels) {
  const sats = [], bins = new Array(12).fill(0);
  let sx = 0, sy = 0, hued = 0, vsum = 0, n = 0;
  for (let i = 0; i < buf.length; i += channels) {
    const px = hueSat(buf[i] / 255, buf[i + 1] / 255, buf[i + 2] / 255);
    if (!px) continue;
    sats.push(px.sat); vsum += px.val; n++;
    if (px.hue === null) continue;
    const a = px.hue * Math.PI / 180;
    sx += Math.cos(a); sy += Math.sin(a); hued++;
    bins[Math.floor(px.hue / 30)]++;
  }
  sats.sort((a, b) => a - b);
  const q = (p) => sats.length ? sats[Math.min(sats.length - 1, Math.floor(sats.length * p))] : NaN;
  return {
    n, hued,
    R: hued ? Math.hypot(sx, sy) / hued : NaN,
    satP50: q(0.5), satP90: q(0.9),
    meanV: n ? vsum / n : NaN,
    bins: bins.filter(c => hued && c / hued > 0.02).length,
  };
}

/** Run one arm's R-table rows (all AGES), ONE sample per age, printing each
 *  as it lands and returning the R values measured. No longer the primary
 *  ranking read -- now used only for the two independent shipped-arm passes
 *  that establish the instrument's noise floor (see SAMPLES_PER_CELL /
 *  SNR_GATE_DIVISOR above). These are raw single-sample readings, not a
 *  ranking claim; they are never printed as a bare "R=" figure, only as a
 *  pass-vs-pass |diff| feeding the noise-floor number. */
async function measureArmRTable(page, arm) {
  // ASSERT THE FLIP LANDED. __artSetChromaMode returns what it set precisely
  // so this is not an assumption.
  const got = await page.eval(`window.__artSetChromaMode(${arm.mode})`);
  if (!got || got.chromaMode !== arm.mode) {
    console.log(`  ${arm.name}: SWITCH REFUSED (${JSON.stringify(got)}) -- arm NOT measured`);
    return [];
  }
  const rs = [];
  for (const age of AGES) {
    // Spawn a pass and shoot it at `age`, reusing _prismSpawn.mjs's proven
    // routine (extracted from _a21wavefilm.mjs for Task 5). bundleClip: true
    // is the task-5 review's finding 1 fix -- clip to the bundle's own
    // geometry, not the whole sphere canvas (which also carries filaments,
    // chimera fringes, base edges and node discs the arm cannot move).
    const hit = await shootAtAge(page, age, { bundleClip: true });
    if (!hit) {
      console.log(`  ${arm.name.padEnd(28)} ${String(age).padStart(4)}ms  NO SPAWN`);
      // Pushed as NaN, not skipped: the reproducibility gate compares two
      // passes AGE-FOR-AGE by array index, so a dropped entry would silently
      // misalign every age after it rather than just being absent at its own.
      rs.push(NaN);
      continue;
    }
    const { data, info } = await sharp(hit.png).raw().toBuffer({ resolveWithObject: true });
    const a = analyse(data, info.channels);
    console.log(`  ${arm.name.padEnd(28)} ${String(Math.round(hit.age)).padStart(4)}ms  `
      + `${a.R.toFixed(3)}    ${a.satP50.toFixed(3)}    ${a.satP90.toFixed(3)}   `
      + `${String(a.bins).padStart(2)}/12  ${a.meanV.toFixed(3)}`);
    rs.push(a.R);
  }
  return rs;
}

/** Run one arm's R-table rows (all AGES), SAMPLES_PER_CELL independent
 *  spawns per age, each a fresh click+shot at the bundle clip. Returns the
 *  MEDIAN R per age and the min-to-max SPREAD as that cell's error bar --
 *  this is the primary ranking read the three-arm comparison is built from.
 *  Every individual sample is printed too, so the median is never presented
 *  without the raw numbers it came from. */
async function measureArmRTableMedian3(page, arm) {
  const got = await page.eval(`window.__artSetChromaMode(${arm.mode})`);
  if (!got || got.chromaMode !== arm.mode) {
    console.log(`  ${arm.name}: SWITCH REFUSED (${JSON.stringify(got)}) -- arm NOT measured`);
    return AGES.map(() => ({ median: NaN, spread: NaN, min: NaN, max: NaN, n: 0 }));
  }
  const rows = [];
  for (const age of AGES) {
    const samples = [];
    for (let s = 0; s < SAMPLES_PER_CELL; s++) {
      const hit = await shootAtAge(page, age, { bundleClip: true });
      if (!hit) { console.log(`  ${arm.name.padEnd(28)} ${String(age).padStart(4)}ms  sample ${s + 1}/${SAMPLES_PER_CELL}  NO SPAWN`); continue; }
      const { data, info } = await sharp(hit.png).raw().toBuffer({ resolveWithObject: true });
      const a = analyse(data, info.channels);
      samples.push(a.R);
    }
    if (!samples.length) {
      console.log(`  ${arm.name.padEnd(28)} ${String(age).padStart(4)}ms  NO SAMPLES -- cell is NaN`);
      rows.push({ median: NaN, spread: NaN, min: NaN, max: NaN, n: 0 });
      continue;
    }
    const sorted = samples.slice().sort((x, y) => x - y);
    const mid = sorted.length >> 1;
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const min = sorted[0], max = sorted[sorted.length - 1];
    const spread = max - min;
    console.log(`  ${arm.name.padEnd(28)} ${String(age).padStart(4)}ms  samples [${samples.map(v => v.toFixed(3)).join(', ')}]  `
      + `median ${median.toFixed(3)} +/-${(spread / 2).toFixed(3)} (range ${min.toFixed(3)}-${max.toFixed(3)})`);
    rows.push({ median, spread, min, max, n: samples.length });
  }
  return rows;
}

const main = async () => {
  const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: false });
  try {
    await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
    if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
    await page.waitFor(SPHERE_READY, { label: 'sphere canvas' });
    await page.eval(SPHERE_RECT);
    await sleep(1500);

    // ── STEP 2b: BLOCKING GATE ──────────────────────────────────────────
    console.log('\n  STEP 2b -- BLOCKING GATE: nothing has ever flipped this switch in a');
    console.log('  browser. Prove the three arms write DIFFERENT buffer contents before');
    console.log('  a single R value is trusted.\n');
    console.log('  arm                            hue excursion   min sat   samples');
    const gate = [];
    for (const arm of ARMS) {
      const got = await page.eval(`window.__artSetChromaMode(${arm.mode})`);
      if (!got || got.chromaMode !== arm.mode) {
        console.log(`  ${arm.name.padEnd(28)}  SWITCH REFUSED (${JSON.stringify(got)}) -- NOT measured`);
        gate.push(null);
        await sleep(ARM_DECAY_MS);
        continue;
      }
      const res = await sampleArm(page);
      if (!res) {
        console.log(`  ${arm.name.padEnd(28)}  NO SPAWN CONFIRMED -- NOT measured`);
        gate.push(null);
        await sleep(ARM_DECAY_MS);
        continue;
      }
      gate.push(res);
      console.log(`  ${arm.name.padEnd(28)}  ${res.maxExcursion.toFixed(1).padStart(6)}deg      `
        + `${res.minSat.toFixed(3).padStart(6)}    ${String(res.samples).padStart(4)}`);
      // Finding 4: let this arm's pass die before the next arm's mode switch
      // and click, so it cannot still be live -- and sharing the additive
      // buffer's [0, particleStart) range -- when the next arm samples it.
      await sleep(ARM_DECAY_MS);
    }

    let broken = false;
    for (let i = 0; i < gate.length; i++) {
      for (let j = i + 1; j < gate.length; j++) {
        const a = gate[i], b = gate[j];
        if (!a || !b) continue;
        if (a.maxExcursion === b.maxExcursion && a.minSat === b.minSat) {
          console.log(`\n  GATE FAILED: arm ${i} (${ARMS[i].name}) and arm ${j} (${ARMS[j].name}) `
            + 'produced IDENTICAL numbers -- the switch is not moving the buffer.');
          broken = true;
        }
      }
    }
    if (broken || gate.some(g => g === null)) {
      console.log('\n  STOPPING: the gate did not clear. Every R value below would be');
      console.log('  measuring one arm three times, so none is printed.');
      process.exitCode = 1;
      return;
    }
    console.log('\n  GATE PASSED: three distinct arms confirmed before any R value is trusted.\n');

    // ── STEP 3a: THE THREE-ARM MEDIAN TABLE, matched ages ─────────────────
    //
    // Each (arm, age) cell is SAMPLES_PER_CELL independent spawns; the cell
    // is reported as the MEDIAN with the min-to-max spread as its error bar.
    // This is the primary ranking read.
    console.log(`  R = 1 means the bundle wears ONE hue; R = 0 means it wears every hue.`);
    console.log(`  bins = 30deg hue bins holding >2% of hued pixels, out of 12.`);
    console.log(`  bundle clip padding: ${PRISM_BBOX_PAD_PX}px (see _prismSpawn.mjs).`);
    console.log(`  each cell below is the MEDIAN of ${SAMPLES_PER_CELL} independent spawns.\n`);

    console.log('  -- shipped (rotate in place) --');
    const shippedRows = await measureArmRTableMedian3(page, ARMS[0]);
    await sleep(ARM_DECAY_MS);
    console.log('\n  -- arm U (unison) --');
    const uRows = await measureArmRTableMedian3(page, ARMS[1]);
    await sleep(ARM_DECAY_MS);
    console.log('\n  -- arm A (achromatic) --');
    const aRows = await measureArmRTableMedian3(page, ARMS[2]);
    await sleep(ARM_DECAY_MS);

    // ── STEP 3b: THE NOISE FLOOR -- two independent single-sample passes,
    // shipped arm only, NOT gated on, reported only to size the noise this
    // instrument carries at this sampling depth. ─────────────────────────
    console.log('\n  -- noise-floor PASS 1 (shipped arm, single sample per age) --');
    const noisePass1 = await measureArmRTable(page, ARMS[0]);
    await sleep(ARM_DECAY_MS);
    console.log('\n  -- noise-floor PASS 2 (shipped arm, single sample per age) --');
    const noisePass2 = await measureArmRTable(page, ARMS[0]);
    await sleep(ARM_DECAY_MS);

    const fmtCell = row => (row && Number.isFinite(row.median))
      ? `${row.median.toFixed(3)} +/-${(row.spread / 2).toFixed(3)}`.padStart(14)
      : '           n/a';

    console.log('\n  THREE-ARM R COMPARISON, matched age (median +/- half the min-to-max spread, '
      + `n=${SAMPLES_PER_CELL} per cell). Never a bare R -- every figure below carries its error bar.`);
    console.log('  age      shipped R           U (unison) R        A (achrom) R');
    for (let i = 0; i < AGES.length; i++) {
      console.log(`  ${String(AGES[i]).padStart(4)}ms   ${fmtCell(shippedRows[i])}      `
        + `${fmtCell(uRows[i])}      ${fmtCell(aRows[i])}`);
    }

    // ── NOISE FLOOR ─────────────────────────────────────────────────────
    console.log('\n  NOISE FLOOR -- two independent single-sample passes, shipped arm, NOT gated:');
    console.log('  age      pass1 R   pass2 R   |diff|');
    const noiseDiffs = [];
    for (let i = 0; i < AGES.length; i++) {
      const r1 = noisePass1[i], r2 = noisePass2[i];
      const missing = !Number.isFinite(r1) || !Number.isFinite(r2);
      const diff = missing ? NaN : Math.abs(r1 - r2);
      if (!missing) noiseDiffs.push(diff);
      console.log(`  ${String(AGES[i]).padStart(4)}ms  ${Number.isFinite(r1) ? r1.toFixed(3) : '  n/a'}     `
        + `${Number.isFinite(r2) ? r2.toFixed(3) : '  n/a'}     `
        + `${missing ? '  n/a' : diff.toFixed(3)}`);
    }
    const noiseFloorMax = noiseDiffs.length ? Math.max(...noiseDiffs) : NaN;
    const noiseFloorMean = noiseDiffs.length
      ? noiseDiffs.reduce((s, x) => s + x, 0) / noiseDiffs.length : NaN;
    console.log(`  noise floor (max |diff| across ages, used for the gate -- conservative): `
      + `${Number.isFinite(noiseFloorMax) ? noiseFloorMax.toFixed(3) : 'n/a'}`);
    console.log(`  noise floor (mean |diff| across ages, reported only):                    `
      + `${Number.isFinite(noiseFloorMean) ? noiseFloorMean.toFixed(3) : 'n/a'}`);

    // ── SMALLEST ARM-TO-ARM SEPARATION IN THE TABLE ────────────────────
    let minSep = Infinity, minSepAt = null;
    const pairs = [[0, 1, 'shipped', 'U'], [0, 2, 'shipped', 'A'], [1, 2, 'U', 'A']];
    const rowsByArm = [shippedRows, uRows, aRows];
    for (let i = 0; i < AGES.length; i++) {
      for (const [x, y, nx, ny] of pairs) {
        const vx = rowsByArm[x][i]?.median, vy = rowsByArm[y][i]?.median;
        if (!Number.isFinite(vx) || !Number.isFinite(vy)) continue;
        const sep = Math.abs(vx - vy);
        if (sep < minSep) { minSep = sep; minSepAt = { age: AGES[i], nx, ny }; }
      }
    }
    const haveSep = Number.isFinite(minSep) && minSep !== Infinity;
    const threshold = haveSep ? minSep / SNR_GATE_DIVISOR : NaN;
    const gatePass = haveSep && Number.isFinite(noiseFloorMax) && noiseFloorMax < threshold;

    console.log(`\n  SMALLEST ARM-TO-ARM SEPARATION IN THE TABLE: `
      + `${haveSep ? minSep.toFixed(3) : 'n/a'}`
      + (minSepAt ? ` (at ${minSepAt.age}ms, ${minSepAt.nx} vs ${minSepAt.ny})` : ''));
    console.log(`  SNR GATE: noise floor must be < separation / ${SNR_GATE_DIVISOR} `
      + `(< ${haveSep ? threshold.toFixed(3) : 'n/a'}) for a ranking to mean anything.`);
    if (gatePass) {
      console.log(`  GATE PASSED: noise floor ${noiseFloorMax.toFixed(3)} < ${threshold.toFixed(3)}. `
        + 'The ranking below is trustworthy at this sampling depth.');
    } else {
      console.log(`  GATE FAILED: noise floor `
        + `${Number.isFinite(noiseFloorMax) ? noiseFloorMax.toFixed(3) : 'n/a'} is NOT < `
        + `${haveSep ? threshold.toFixed(3) : 'n/a'}. The arms are INDISTINGUISHABLE ON THIS `
        + 'METRIC at this sampling depth -- this is a real finding, not a failed run.');
    }

    // ── BUFFER-LEVEL (Step 2b) vs PIXEL-LEVEL (R), per arm, side by side ──
    const meanFinite = rows => {
      const finite = rows.map(r => r?.median).filter(Number.isFinite);
      return finite.length ? finite.reduce((s, x) => s + x, 0) / finite.length : NaN;
    };
    const meanSpread = rows => {
      const finite = rows.map(r => r?.spread).filter(Number.isFinite);
      return finite.length ? finite.reduce((s, x) => s + x, 0) / finite.length : NaN;
    };
    const armMeanRs = [meanFinite(shippedRows), meanFinite(uRows), meanFinite(aRows)];
    const armMeanSpreads = [meanSpread(shippedRows), meanSpread(uRows), meanSpread(aRows)];
    const fmtMean = (m, s) => Number.isFinite(m) ? `${m.toFixed(3)} +/-${(s / 2).toFixed(3)}` : '    n/a';
    console.log('\n  BUFFER-LEVEL (Step 2b additive-buffer read) vs PIXEL-LEVEL (mean R this run):');
    console.log('  arm                            hue excursion   min sat     mean R (+/- mean cell spread/2)');
    for (let i = 0; i < ARMS.length; i++) {
      const g = gate[i];
      console.log(`  ${ARMS[i].name.padEnd(28)}  ${g ? (g.maxExcursion.toFixed(1) + 'deg').padStart(9) : '      n/a'}      `
        + `${g ? g.minSat.toFixed(3).padStart(6) : '   n/a'}    ${fmtMean(armMeanRs[i], armMeanSpreads[i])}`);
    }

    // ── PLAIN-WORDS VERDICT ON ARM U'S CENTRAL PREDICTION ─────────────────
    const shippedMean = armMeanRs[0], uMean = armMeanRs[1];
    console.log('\n  VERDICT -- did arm U drive R up?');
    if (!gatePass) {
      console.log('  The SNR gate did NOT pass, so any apparent movement below cannot be told');
      console.log('  apart from measurement noise. Numbers are reported anyway, but no ranking');
      console.log('  claim is being made from them this run.');
    }
    if (Number.isFinite(shippedMean) && Number.isFinite(uMean)) {
      const delta = uMean - shippedMean;
      console.log(`  mean shipped R = ${shippedMean.toFixed(3)}, mean U R = ${uMean.toFixed(3)}, `
        + `delta = ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}.`);
    } else {
      console.log('  One or both arm means are unavailable (missing spawns) -- no delta computed.');
    }
  } finally {
    // Finding 3: the restore now runs on EVERY path out of the try block --
    // the two blocking-gate returns above included, and any exception a bad
    // bundle clip or a failed eval throws (see _prismSpawn.mjs's BUNDLE_BBOX)
    // -- not only the normal-completion path. Guarded so a restore failure
    // cannot mask whatever the original exception was.
    try {
      await page.eval('window.__artSetChromaMode(0)');
    } catch (e) {
      console.error(`  (restore warning) failed to reset chroma mode: ${e.message}`);
    }
    await page.close();
  }
};
main().catch((err) => {
  console.error(`\n  FATAL: ${err.message}`);
  process.exitCode = 1;
});
