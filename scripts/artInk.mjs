// artInk.mjs — measure how much light a capture set actually puts on screen.
//
//   node scripts/artInk.mjs <referenceDir> <candidateDir> [--floor N] [--disc F]
//                                                         [--null a,b,c] [--no-null]
//
// EVERY RATIO IS PRINTED AGAINST ITS OWN SAME-BUILD FLOOR. Read that column
// before the ratio beside it; the reason is in "THE SAME-BUILD INK FLOOR" below
// and it is the difference between a finding and two steps of chasing noise.
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
// ── THE SAME-BUILD INK FLOOR, and why this instrument was misleading without
//    one for six steps ──────────────────────────────────────────────────────
//
// `artNull` certifies a capture set by worst-pair LUMINANCE CORRELATION. This
// instrument measures SUMMED INK. Those are two different questions, and a
// certificate for the first has never said anything about the second — so every
// ratio printed here was being read against an unmeasured noise floor. A set
// carrying `repro 0.98 PASS` was taken to mean its ink repeats. It does not
// follow, and it is not true.
//
// MEASURED, item-4 audit, from three sets of ONE build (`s7cond2-a/b/c`) — what
// this instrument prints when both sides are the SAME BUILD and every row should
// therefore read 1.000:
//
//     laptop@1x   immersive-on    0.972        laptop@2x   every state   1.000
//     laptop@1x   mid-drag        0.988        projector   idle          1.030
//
// The clearest one: projector `idle`, same build, same WORLD HASH across all
// three sets, null 0.9796 PASS — and 45,534 lit pixels against 31,385. A faint
// full-field wash present in one set of three, worth +3% of frame ink and
// invisible to a luminance correlation.
//
// The "particle ink excess" the branch carried from step 6 to step 7 is +1.3% to
// +2.5%. At two of the three scales that sits INSIDE this floor. At laptop@2x,
// where the floor really is 1.000, it is a genuine signal. The instrument could
// not tell those two cases apart and neither could anyone reading it.
//
// So the floor is computed per (scale, state, region) and printed beside the
// ratio it governs, and the `read` column says `noise` or `SIGNAL` rather than
// leaving the comparison to whoever quotes the number later.
//
// WHERE THE REPLICATES COME FROM. `artNull --write` already stamps the set list
// it certified against into the manifest as `repro.dirs`, so the evidence is
// on disk and no new capture is needed: this reads the candidate's own list,
// and the reference's, and takes the WORSE of the two floors. That also means
// sweeping a set's replicate directories silently costs it its floor — the row
// then reads `no floor`, which is "nobody measured", never "it is fine".
//
// The floor is the worst |ratio - 1| over every same-build PAIR, taken in both
// directions so it is symmetric. Three sets is three pairs. One pair is not
// evidence when the fault is intermittent — the same arithmetic artNull's
// MIN_SETS documents — so the set count is printed and never assumed.
//
// `--null a,b,c` overrides with an explicit list (comma-separated, never
// variadic: a bare variadic flag swallowing the directory after it is exactly
// the defect artNull's parseArgs had to fix). `--no-null` turns the column off.
//
// READ RATIOS BETWEEN MODES, NOT ABSOLUTE ONES. The pre-migration reference
// predates the real-bloom change, so its absolute ink differs from anything
// captured since for reasons that have nothing to do with trails. What survives
// that confound is the ratio OF the ratios: if lost accumulation is the cause,
// immersive should have fallen 3.125/1.389 = 2.25x further than normal, because
// only the clear alpha differs between them.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
// An explicit same-build set list, comma-separated. See "THE SAME-BUILD INK
// FLOOR": a comma-separated value cannot swallow the token after it, which a
// variadic flag can and did in artNull.
const NULL_ARG = (() => {
  const i = args.indexOf('--null');
  if (i < 0) return null;
  return String(args[i + 1] ?? '').split(',').map(s => s.trim()).filter(Boolean);
})();
const NO_NULL = args.includes('--no-null');

if (!REF || !NEW) {
  console.error('usage: node scripts/artInk.mjs <referenceDir> <candidateDir> [--floor N] [--disc F]'
    + ' [--null a,b,c] [--no-null]');
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

// Memoised by PATH. The floor re-reads sets the main comparison already read —
// `s7cond2-a` is both the candidate and one of its own replicates — and a
// 5.4 Mpx decode is not free. Keyed by the path actually read, so two callers
// can never disagree about what they measured.
const inkMemo = new Map();
async function measure(dir, shot) {
  const path = `${dir}/${basename(shot.file)}`;
  if (!inkMemo.has(path)) inkMemo.set(path, inkOf(decodePng(await readFile(path))));
  return inkMemo.get(path);
}

// 0/0 is an identity, not a division. Self-comparison must read exactly 1.000
// on a blank frame too, or the instrument's own validation is a lie.
const ratio = (a, b) => (a === b ? 1 : (a === 0 ? Infinity : b / a));
const mean = (ink, lit) => (lit ? ink / lit : 0);
const f = (v, w, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—').padStart(w);
/**
 * A floor, printed so it cannot be misread.
 *   —        nobody measured it
 *   ±0.000   the replicates are IDENTICAL in this cell — a real, hard floor
 *   <0.001   non-zero but under the print precision; NOT the same claim as 0
 *   ?        the replicates drew different WORLDS here, so part of this spread
 *            is a spread of graphs rather than of the build's own noise
 */
const bars = (v, mixedWorlds) => {
  if (v == null) return '—'.padStart(9);
  const s = v === 0 ? '±0.000' : v < 0.0005 ? '<0.001' : `±${v.toFixed(3)}`;
  return (s + (mixedWorlds ? '?' : '')).padStart(9);
};

const load = async (d) => JSON.parse(await readFile(`${d}/manifest.json`, 'utf8'));
const [ref, cand] = await Promise.all([load(REF), load(NEW)]);

// PROVENANCE. This instrument always exits 0 and always will — the number it
// produces is meant to be argued with, not to fail a build. But "not a gate"
// must not become "the way around the gate": `artCompare` now refuses to score
// a row from a capture set that has not been shown to repeat itself, and a set
// that cannot be quoted there cannot be quoted here either. So each side says
// whether it carries a same-build null, right above the numbers, where nobody
// lifting a ratio out of this output can miss it.
//
// See scripts/artNull.mjs. A set predating certification reads "no null" — that
// is "nobody measured", not "it is fine".
const provenance = (m) => {
  const r = m.repro;
  if (!r) return 'NO NULL — not certified, nothing below is admissible';
  const base = `null ${r.worst?.toFixed?.(4) ?? '?'} over ${r.sets} sets`;
  if (r.partial) return `${base}, PARTIAL — uncertified: ${(r.failing ?? []).join(', ')}`;
  return base;
};

// ── The same-build floor ────────────────────────────────────────────────────
// Replicates come from `repro.dirs`, which artNull already stamped, so the
// evidence is on disk and nothing needs re-capturing. A listed directory that
// is gone (swept) is dropped, and the count printed is the count that was
// actually READ — never the count the manifest claims.
const replicatesOf = (m) => {
  const d = m.repro?.dirs;
  return Array.isArray(d) ? d.filter(x => existsSync(`${x}/manifest.json`)) : [];
};
const nullSides = NO_NULL ? []
  : NULL_ARG ? [{ label: 'explicit --null', dirs: NULL_ARG.filter(x => existsSync(`${x}/manifest.json`)) }]
  : [
    { label: 'ref', dirs: replicatesOf(ref) },
    { label: 'new', dirs: replicatesOf(cand) },
  ].filter(s => s.dirs.length >= 2);

const nullManifests = new Map();
for (const side of nullSides) {
  for (const d of side.dirs) {
    if (!nullManifests.has(d)) nullManifests.set(d, await load(d));
  }
}

/**
 * The worst |ratio - 1| this cell shows between two captures of ONE build.
 *
 * Both directions of every pair, so the floor is symmetric: a-vs-b reading
 * 0.972 and b-vs-a reading 1.0288 must not give two different answers about the
 * same disagreement. Pairs whose frames are different sizes are skipped rather
 * than correlated, for the reason artNull refuses them — two buffer sizes are
 * not a picture difference.
 */
async function floorOf(dirs, scale, state) {
  const vals = [];
  const worlds = new Set();
  for (const d of dirs) {
    const shot = nullManifests.get(d)?.scales?.[scale]?.shots?.[state];
    if (!shot) continue;
    vals.push(await measure(d, shot));
    // "Same build" is INFERRED from a directory list, and this instrument
    // should not infer. The world hash is the check that costs nothing: if the
    // replicates drew different graphs, their ink spread is partly a spread of
    // WORLDS, and a floor built on it is wider than the build's own noise. It
    // is reported rather than refused — `immersive-off` is exactly that cell,
    // and dropping its floor would leave the widest row in the set unbounded.
    if (shot.view?.world?.hash) worlds.add(shot.view.world.hash);
  }
  if (vals.length < 2) return null;
  let frame = 0, disc = 0, pairs = 0;
  for (let i = 0; i < vals.length; i++) {
    for (let j = i + 1; j < vals.length; j++) {
      const A = vals[i], B = vals[j];
      if (A.width !== B.width || A.height !== B.height) continue;
      pairs++;
      frame = Math.max(frame, Math.abs(ratio(A.ink, B.ink) - 1), Math.abs(ratio(B.ink, A.ink) - 1));
      disc = Math.max(disc, Math.abs(ratio(A.discInk, B.discInk) - 1), Math.abs(ratio(B.discInk, A.discInk) - 1));
    }
  }
  return pairs ? { frame, disc, sets: vals.length, pairs, mixedWorlds: worlds.size > 1 } : null;
}

/** The worse of the two sides. A ratio has to clear BOTH builds' own noise. */
async function cellFloor(scale, state) {
  let best = null;
  for (const side of nullSides) {
    const r = await floorOf(side.dirs, scale, state);
    if (!r) continue;
    if (!best || Math.max(r.frame, r.disc) > Math.max(best.frame, best.disc)) {
      best = { ...r, side: side.label };
    }
  }
  return best;
}

console.log(`/art ink — summed luminance above floor ${FLOOR}, disc = ${DISC} x min(w,h)`);
console.log(`  ref  ${REF}   [${provenance(ref)}]`);
console.log(`  new  ${NEW}   [${provenance(cand)}]`);
if (NO_NULL) {
  console.log('  ink floor  OFF (--no-null). Every ratio below is unbounded — you are reading');
  console.log('             a number with no idea what the same build scores against itself.');
} else if (!nullSides.length) {
  console.log('  ink floor  NONE — neither side lists 2+ surviving replicate sets in repro.dirs,');
  console.log('             so the same-build ink spread is UNMEASURED. That is "nobody asked",');
  console.log('             not "it is small".  Pass --null a,b,c to name them explicitly.');
} else {
  for (const s of nullSides) console.log(`  ink floor  from ${s.label}: ${s.dirs.join(' ')}`);
}
console.log('');
if (!ref.repro || !cand.repro) {
  console.log('  One or both sets carry NO same-build null. Certify them before quoting');
  console.log('  any ratio below:  node scripts/artNull.mjs <a> <b> <c> --write <a>\n');
}

const HEAD = `${'state'.padEnd(15)}${'region'.padEnd(7)}`
  + `${'ink_ref'.padStart(12)}${'ink_new'.padStart(12)}${'ratio'.padStart(8)}`
  + `${'floor'.padStart(9)}${'read'.padStart(9)}`
  + `${'lit_ref'.padStart(9)}${'lit_new'.padStart(9)}`
  + `${'meanLit_ref'.padStart(13)}${'meanLit_new'.padStart(12)}   note`;
const RULE = 115;

// How many rows cleared their own floor, and how many did not. Printed at the
// end because "20 of 42 rows are inside the noise" is the sentence that should
// have been on the step 6 report and was not.
const tally = { signal: 0, noise: 0, nofloor: 0 };

const rollup = [];      // one entry per scale: mode totals for the cross-mode read
const skipped = [];

for (const scale of Object.keys(ref.scales)) {
  const rs = ref.scales[scale], cs = cand.scales[scale];
  console.log(`── ${scale} ${'─'.repeat(Math.max(0, RULE - scale.length))}`);
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

    // The floor for THIS cell, from the replicate sets. Computed once and read
    // per region, because frame and disc have different spreads — the disc is
    // the blunter one in immersive and its floor says so out loud.
    const fl = geomOk ? await cellFloor(scale, state) : null;

    for (const [region, ri, rl, ni, nl] of [
      ['frame', a.ink, a.lit, b.ink, b.lit],
      ['disc', a.discInk, a.discLit, b.discInk, b.discLit],
    ]) {
      const r = geomOk ? ratio(ri, ni) : NaN;
      const bar = fl ? fl[region] : null;
      // A row only reads SIGNAL when it moved further than the SAME BUILD moves
      // in that cell. Anything else is `noise` — not "small", not "probably
      // fine": indistinguishable, by this instrument, from re-running the same
      // code twice.
      let read = '—';
      if (geomOk && bar != null && Number.isFinite(r)) {
        const over = Math.abs(r - 1) > bar;
        read = over ? 'SIGNAL' : 'noise';
        tally[over ? 'signal' : 'noise']++;
      } else if (geomOk) {
        read = 'no floor';
        tally.nofloor++;
      }
      console.log(
        `${(region === 'frame' ? state : '').padEnd(15)}${region.padEnd(7)}`
        + `${f(ri, 12)}${f(ni, 12)}${geomOk ? f(r, 8, 3) : '—'.padStart(8)}`
        + `${bars(bar, fl?.mixedWorlds)}${read.padStart(9)}`
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

/**
 * The same-build floor on a MODE ROLLUP — the number people actually quote.
 *
 * Summed per mode per replicate, then worst pairwise disagreement, exactly as
 * the per-cell floor does. This one matters most: "normal-mode whole-frame ink
 * runs +1.3% to +2.5%" is a rollup figure, and it has never been printed next
 * to what the same build scores against itself.
 */
async function modeFloor(scale, region, pick) {
  let worst = null;
  for (const side of nullSides) {
    const sums = [];
    for (const d of side.dirs) {
      const shots = nullManifests.get(d)?.scales?.[scale]?.shots;
      if (!shots) continue;
      let acc = 0, n = 0;
      for (const [state, shot] of Object.entries(shots)) {
        if (!pick(state)) continue;
        const v = await measure(d, shot);
        acc += region === 'frame' ? v.ink : v.discInk; n++;
      }
      if (n) sums.push(acc);
    }
    if (sums.length < 2) continue;
    let w = 0;
    for (let i = 0; i < sums.length; i++) {
      for (let j = i + 1; j < sums.length; j++) {
        w = Math.max(w, Math.abs(ratio(sums[i], sums[j]) - 1), Math.abs(ratio(sums[j], sums[i]) - 1));
      }
    }
    if (worst == null || w > worst) worst = w;
  }
  return worst;
}

console.log(`mode rollup — ink summed per mode (${BLANK} excluded: blank frames)`);
// THE ROLLUP IS SUM-WEIGHTED, and that is not obvious from the number.
// MEASURED, item-4 audit, laptop@1x against the certified reference:
// `fired-cascade` is 41% of the normal-mode sum on its own and reads 1.037,
// while the other four normal states read 0.994-1.007. The rollup's 1.013 is
// essentially the cascade's 1.037 diluted by four quiet states — so "normal
// mode is +1.3%" reads as "everywhere" and means "mostly one state". Read the
// per-state rows above before quoting a rollup.
console.log('  sum-weighted: one heavy state (fired-cascade) can carry a whole row. '
  + 'Read the per-state rows first.\n');
for (const [region, kr, kn] of [['disc', 'rD', 'nD'], ['frame', 'rF', 'nF']]) {
  console.log(`${`[${region}]`.padEnd(26)}${'normal ratio'.padStart(14)}${'floor'.padStart(9)}`
    + `${'exhibit ratio'.padStart(15)}${'floor'.padStart(9)}`
    + `${'cross (exh/norm)'.padStart(18)}   (smell test only — ${EXPECTED_CROSS.toFixed(3)} is mis-derived, see source)`);
  for (const { scale, normal, exhibit } of rollup) {
    const rn = ratio(normal[kr], normal[kn]);
    const re = exhibit[kr] ? ratio(exhibit[kr], exhibit[kn]) : NaN;
    const cross = Number.isFinite(re) && rn ? re / rn : NaN;
    const fn = await modeFloor(scale, region, isNormalMode);
    const fe = await modeFloor(scale, region, (s) => s === EXHIBIT);
    console.log(`  ${scale.padEnd(24)}${f(rn, 14, 3)}${bars(fn)}${f(re, 15, 3)}${bars(fe)}${f(cross, 18, 3)}`
      + `${exhibit[kr] ? '' : '   (no comparable exhibit frame)'}`);
  }
  console.log('');
}

if (skipped.length) {
  console.log('\nrows excluded from every ratio and rollup above (capture geometry differs):');
  for (const s of skipped) console.log(`  ${s}`);
}

const graded = tally.signal + tally.noise;
if (graded) {
  console.log(`\nagainst the same-build floor: ${tally.signal} SIGNAL, ${tally.noise} noise`
    + `, of ${graded} graded rows${tally.nofloor ? ` (+${tally.nofloor} with no floor)` : ''}.`);
  console.log('A `noise` row is not a small difference. It is one this instrument cannot');
  console.log('distinguish from running the same build twice, and it must not be quoted as');
  console.log('a finding — see "THE SAME-BUILD INK FLOOR" in this file.');
} else if (tally.nofloor) {
  console.log(`\nNo same-build floor for any of ${tally.nofloor} rows. Nothing above is a finding yet.`);
}

console.log('\nink = sum(luminance - floor) over pixels above the floor; lit = that pixel count.');
console.log('Self-comparison of a set against itself must read ratio 1.000 on every row.');
console.log('floor = worst |ratio-1| between two captures of ONE build in that cell.');
console.log('  ±0.000 = the replicates are identical here (a real floor);  <0.001 = small but');
console.log('  not zero;  — = unmeasured;  ? = the replicates drew different worlds in this');
console.log('  cell, so part of that spread is a spread of graphs, not of the build\'s noise.');
