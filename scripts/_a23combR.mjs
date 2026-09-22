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
// CLIPS TO THE BUNDLE. The section-0 measurement in the design spec was
// WHOLE-FRAME and therefore includes the nodes and the base edges. Those
// numbers must not be quoted against a crest; this script clips first (via
// shootAtAge's per-sphere-canvas clip, same one _a21wavefilm.mjs uses).
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
import { SPHERE, SPHERE_READY, clickText, shootAtAge } from './_prismSpawn.mjs';

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
        continue;
      }
      const res = await sampleArm(page);
      if (!res) {
        console.log(`  ${arm.name.padEnd(28)}  NO SPAWN CONFIRMED -- NOT measured`);
        gate.push(null);
        continue;
      }
      gate.push(res);
      console.log(`  ${arm.name.padEnd(28)}  ${res.maxExcursion.toFixed(1).padStart(6)}deg      `
        + `${res.minSat.toFixed(3).padStart(6)}    ${String(res.samples).padStart(4)}`);
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
      await page.eval('window.__artSetChromaMode(0)');
      process.exitCode = 1;
      return;
    }
    console.log('\n  GATE PASSED: three distinct arms confirmed before any R value is trusted.\n');

    // ── STEP 2/3: THE R TABLE ────────────────────────────────────────────
    console.log(`  R = 1 means the bundle wears ONE hue; R = 0 means it wears every hue.`);
    console.log(`  bins = 30deg hue bins holding >2% of hued pixels, out of 12.\n`);
    console.log('  arm                            age      R   sat p50  sat p90  bins  meanV');

    for (const arm of ARMS) {
      // ASSERT THE FLIP LANDED. __artSetChromaMode returns what it set
      // precisely so this is not an assumption.
      const got = await page.eval(`window.__artSetChromaMode(${arm.mode})`);
      if (!got || got.chromaMode !== arm.mode) {
        console.log(`  ${arm.name}: SWITCH REFUSED (${JSON.stringify(got)}) -- arm NOT measured`);
        continue;
      }
      for (const age of AGES) {
        // Spawn a pass and shoot it at `age`, reusing _prismSpawn.mjs's
        // proven routine (extracted from _a21wavefilm.mjs for Task 5).
        const hit = await shootAtAge(page, age);
        if (!hit) { console.log(`  ${arm.name.padEnd(28)} ${String(age).padStart(4)}ms  NO SPAWN`); continue; }
        const { data, info } = await sharp(hit.png).raw().toBuffer({ resolveWithObject: true });
        const a = analyse(data, info.channels);
        console.log(`  ${arm.name.padEnd(28)} ${String(Math.round(hit.age)).padStart(4)}ms  `
          + `${a.R.toFixed(3)}    ${a.satP50.toFixed(3)}    ${a.satP90.toFixed(3)}   `
          + `${String(a.bins).padStart(2)}/12  ${a.meanV.toFixed(3)}`);
      }
    }

    // Leave the page on the shipped arm so a later instrument does not
    // inherit an arm this one set.
    await page.eval('window.__artSetChromaMode(0)');
  } finally {
    await page.close();
  }
};
main();
