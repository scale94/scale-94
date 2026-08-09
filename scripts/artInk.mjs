// artInk.mjs — measure how much light a capture set actually puts on screen.
//
//   node scripts/artInk.mjs <referenceDir> <candidateDir> [--floor N] [--disc F]
//
// Always exits 0. This is a measuring instrument, not a gate: artCompare.mjs is
// the gate. Nothing here should ever fail a build, because the number it
// produces is meant to be argued with.
//
// WHY THIS EXISTS, AND WHY IT SUMS INSTEAD OF AVERAGING.
//
// The sphere's 2D canvas does not wipe between frames. It clears with
// `destination-out` and `rgba(0,0,0,m)` (ArtTab.jsx), a PARTIAL alpha erase, so
// everything drawn after it compounds: a layer redrawn at alpha `a` every frame
// settles at `a / (1 - (1-m)(1-a))`, not `a`. For small `a` that limit is `a/m`,
// i.e. the layer is on screen `1/m` times brighter than its own draw call asks
// for. `m` is per-mode — 0.72 normal, 0.32 immersive — so the standing gains are
// 1.389x and 3.125x.
//
// A layer moved to the GPU draws into a target that IS fully rewritten every
// frame. It therefore loses that gain silently: no error, no missing geometry,
// just less light. The existing gate is a 32x18 mean-luminance signature, and a
// MEAN is exactly the wrong instrument for this — a thin edge or a 0.03-alpha
// wireframe occupies a few percent of any grid cell, so averaging buries the
// loss inside the cell's dark majority. That signature scored a measured 22%
// edge-ink loss as 21/21 green.
//
// Summing does not have that failure mode: half as much light is half the
// number, wherever it sits in the frame.
//
// THREE NUMBERS, THREE DIFFERENT QUESTIONS. They are reported separately on
// purpose, because together they say WHICH kind of regression happened:
//   ink     total luminance above the noise floor — how much light in total
//   lit     how many pixels are above the floor at all — how much AREA is drawn
//   ink/lit mean brightness of the lit pixels only — how HARD each pixel is lit
// A layer that lost trail accumulation keeps `lit` roughly constant and loses
// `ink` and `ink/lit` together. A layer that failed to render loses `lit` too.
//
// READ RATIOS BETWEEN MODES, NOT ABSOLUTE ONES. The pre-migration reference
// predates the real-bloom change, so its absolute ink differs from anything
// captured since for reasons that have nothing to do with trails. What survives
// that confound is the ratio OF the ratios: if lost accumulation is the cause,
// immersive should have fallen 3.125/1.389 = 2.25x further than normal, because
// only the clear alpha differs between them.

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { decodePng } from './_png.mjs';

const args = process.argv.slice(2);
const REF = args[0];
const NEW = args[1];
const num = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
// Below this a pixel is capture noise on a black field, not content.
const FLOOR = num('--floor', 6);
// No capture manifest records a sphere radius, so the disc falls back to this
// fraction of the shorter side, per the spec.
const DISC = num('--disc', 0.42);

if (!REF || !NEW) {
  console.error('usage: node scripts/artInk.mjs <referenceDir> <candidateDir> [--floor N] [--disc F]');
  process.exit(2);
}

// `immersive-on` is the exhibit mode — the row that matters most.
const EXHIBIT = 'immersive-on';
// `immersive-off` leaves the sphere unpainted for well over 600 frames, so its
// frames carry DOM labels and nothing else. Reporting a ratio for it would be
// reporting the ratio of two blank canvases.
const BLANK = 'immersive-off';
const isNormalMode = (state) => state !== EXHIBIT && state !== BLANK;

/**
 * Ink over a decoded RGBA frame, whole-frame and inside the sphere disc.
 *
 * The disc is centred on the image because the capture is already clipped to
 * the sphere's own bounding box. It exists because the DOM label overlay sits
 * inside that box but outside the sphere, and labels are unaffected by anything
 * this measurement is about — leaving them in dilutes the reading.
 */
function inkOf({ width, height, data }) {
  const cx = (width - 1) / 2, cy = (height - 1) / 2;
  const r = DISC * Math.min(width, height);
  const r2 = r * r;

  let ink = 0, lit = 0, discInk = 0, discLit = 0;
  for (let y = 0; y < height; y++) {
    const dy = y - cy, dy2 = dy * dy;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (L <= FLOOR) continue;
      const v = L - FLOOR;
      ink += v; lit++;
      const dx = x - cx;
      if (dx * dx + dy2 <= r2) { discInk += v; discLit++; }
    }
  }
  return { width, height, ink, lit, discInk, discLit, radius: r };
}

async function measure(dir, shot) {
  return inkOf(decodePng(await readFile(`${dir}/${basename(shot.file)}`)));
}

// 0/0 is an identity, not a division. Self-comparison must read exactly 1.000
// on a blank frame too, or the instrument's own validation is a lie.
const ratio = (a, b) => (a === b ? 1 : (a === 0 ? Infinity : b / a));
const mean = (ink, lit) => (lit ? ink / lit : 0);
const f = (v, w, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—').padStart(w);

const load = async (d) => JSON.parse(await readFile(`${d}/manifest.json`, 'utf8'));
const [ref, cand] = await Promise.all([load(REF), load(NEW)]);

console.log(`/art ink — summed luminance above floor ${FLOOR}, disc = ${DISC} x min(w,h)`);
console.log(`  ref  ${REF}`);
console.log(`  new  ${NEW}\n`);

const HEAD = `${'state'.padEnd(15)}${'region'.padEnd(7)}`
  + `${'ink_ref'.padStart(12)}${'ink_new'.padStart(12)}${'ratio'.padStart(8)}`
  + `${'lit_ref'.padStart(9)}${'lit_new'.padStart(9)}`
  + `${'meanLit_ref'.padStart(13)}${'meanLit_new'.padStart(12)}   note`;

const rollup = [];      // one entry per scale: mode totals for the cross-mode read
const skipped = [];

for (const scale of Object.keys(ref.scales)) {
  const rs = ref.scales[scale], cs = cand.scales[scale];
  console.log(`── ${scale} ${'─'.repeat(Math.max(0, 100 - scale.length))}`);
  if (!cs) { console.log('  MISSING SCALE in candidate\n'); continue; }
  console.log(HEAD);

  // Rolled up over BOTH regions. The disc is the sharper instrument in normal
  // mode, where the sphere sits well inside it and the labels do not. It is the
  // BLUNTER one in immersive, where the sphere grows past the disc edge and a
  // few pixels of drift swing content across the boundary: measured run-to-run
  // on identical code, immersive disc ink moves by up to 12% while immersive
  // frame ink moves by under 2%. Read frame for immersive, disc for normal.
  const totals = {
    normal: { rF: 0, nF: 0, rD: 0, nD: 0 },
    exhibit: { rF: 0, nF: 0, rD: 0, nD: 0 },
  };

  for (const state of Object.keys(rs.shots)) {
    const rShot = rs.shots[state], cShot = cs.shots[state];
    if (!cShot) { console.log(`${state.padEnd(15)}MISSING in candidate`); continue; }
    const [a, b] = await Promise.all([measure(REF, rShot), measure(NEW, cShot)]);

    // Different capture rects are different crops of a different amount of
    // world. A summed metric over them is not a comparison, it is a coincidence
    // — so refuse to print a ratio rather than print a plausible wrong one.
    const geomOk = a.width === b.width && a.height === b.height;
    let note = '';
    if (!geomOk) {
      note = `GEOMETRY MISMATCH ${a.width}x${a.height} vs ${b.width}x${b.height} — NOT COMPARABLE`;
      skipped.push(`${scale} ${state}: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
    } else if (state === EXHIBIT) note = '<<< EXHIBIT MODE';
    else if (state === BLANK) note = '(blank — proves nothing)';

    for (const [region, ri, rl, ni, nl] of [
      ['frame', a.ink, a.lit, b.ink, b.lit],
      ['disc', a.discInk, a.discLit, b.discInk, b.discLit],
    ]) {
      console.log(
        `${(region === 'frame' ? state : '').padEnd(15)}${region.padEnd(7)}`
        + `${f(ri, 12)}${f(ni, 12)}${geomOk ? f(ratio(ri, ni), 8, 3) : '—'.padStart(8)}`
        + `${String(rl).padStart(9)}${String(nl).padStart(9)}`
        + `${f(mean(ri, rl), 13, 2)}${f(mean(ni, nl), 12, 2)}`
        + `   ${region === 'frame' ? note : ''}`,
      );
    }

    const bucket = geomOk && isNormalMode(state) ? totals.normal
      : geomOk && state === EXHIBIT ? totals.exhibit : null;
    if (bucket) {
      bucket.rF += a.ink; bucket.nF += b.ink;
      bucket.rD += a.discInk; bucket.nD += b.discInk;
    }
  }

  rollup.push({ scale, ...totals });
  console.log('');
}

// ── The reading that survives the bloom confound ────────────────────────────
// Absolute ink moved for reasons unrelated to trails, so an absolute ratio
// cannot settle the question. Only the clear alpha differs between the modes,
// so a lost-accumulation signal must be mode-asymmetric.
//
// DO NOT read the cross column against 0.444. That figure came from the plan
// that commissioned this script and is MIS-DERIVED: it assumes the migrated
// layers are 100% of frame ink. They are ~10-20% of it, so a per-layer 3.125x
// loss shows up as a 7-14% total drop — a cross ratio around 0.86-0.93, which
// is what the real captures measured and what CONFIRMED the model rather than
// refuting it. Scaling 0.444 by layer share is not possible from a composited
// screenshot, which is why this column is a smell test and not a gate.
//
// What actually settled it: per-luminance-band histograms (the loss sits in
// the faintest band and its mass REAPPEARS below the floor — dimming with mass
// conserved, not deletion) and a radial profile against each layer's known
// footprint. See .superpowers/sdd/trail-deficit.md.
const GAIN_NORMAL = 1 / 0.72;      // 1.389
const GAIN_IMMERSIVE = 1 / 0.32;   // 3.125
const EXPECTED_CROSS = GAIN_NORMAL / GAIN_IMMERSIVE;   // 0.444 — see above, NOT a gate

console.log(`mode rollup — ink summed per mode (${BLANK} excluded: blank frames)\n`);
for (const [region, kr, kn] of [['disc', 'rD', 'nD'], ['frame', 'rF', 'nF']]) {
  console.log(`${`[${region}]`.padEnd(26)}${'normal ratio'.padStart(14)}${'exhibit ratio'.padStart(15)}`
    + `${'cross (exh/norm)'.padStart(18)}   (smell test only — ${EXPECTED_CROSS.toFixed(3)} is mis-derived, see source)`);
  for (const { scale, normal, exhibit } of rollup) {
    const rn = ratio(normal[kr], normal[kn]);
    const re = exhibit[kr] ? ratio(exhibit[kr], exhibit[kn]) : NaN;
    const cross = Number.isFinite(re) && rn ? re / rn : NaN;
    console.log(`  ${scale.padEnd(24)}${f(rn, 14, 3)}${f(re, 15, 3)}${f(cross, 18, 3)}`
      + `${exhibit[kr] ? '' : '   (no comparable exhibit frame)'}`);
  }
  console.log('');
}

if (skipped.length) {
  console.log('\nrows excluded from every ratio and rollup above (capture geometry differs):');
  for (const s of skipped) console.log(`  ${s}`);
}

console.log('\nink = sum(luminance - floor) over pixels above the floor; lit = that pixel count.');
console.log('Self-comparison of a set against itself must read ratio 1.000 on every row.');
