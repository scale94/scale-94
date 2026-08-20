// artNull.mjs — the same-build null. Certifies that a capture set is REPRODUCIBLE.
//
//   node scripts/artNull.mjs <dir> <dir> [<dir> ...] [--floor N] [--min-sets N]
//   node scripts/artNull.mjs <dir> <dir> <dir> --write <dir>
//
// WHY THIS EXISTS, and why it is a gate rather than a probe.
//
// For four tasks this branch quoted parity numbers off a harness that could not
// repeat itself. `immersive-off` correlated 0.047 between two runs of ONE build
// — the score two genuinely UNRELATED pictures get — while every clock the
// harness recorded agreed to four decimal places. Four separate causes, all the
// same shape: something outside the pump budget deciding what the world looks
// like. A gate that only pins the clock cannot see any of them, and `artCompare`
// only ever pinned the clock. See `.superpowers/sdd/post-step5-task1-report.md`.
//
// So: before a capture set may be quoted as a measurement, it has to be shown
// that the same build captured twice produces the same picture. That is what
// this computes, and `artCompare` now refuses to print `ok` for a cell whose set
// does not carry the result.
//
// WHAT IS MEASURED. Luminance correlation at FULL resolution, worst
// off-diagonal pair, per (scale, state) cell. Not the 32x18 signature
// `artCompare` thresholds on: that is a mean over ~1500 pixels a cell, and a
// completely different world can land inside its tolerance — measured, one did.
// The ink here is sparse and structured, so the same world at the same rotation
// correlates ~1.0 while anything else falls off a cliff: the measured
// off-diagonal floor for unrelated states of the same build is 0.03-0.14.
//
// HOW MANY SETS, and why the answer is not two.
//
// Two sets is one pair, and one pair is not evidence when the fault is
// intermittent. Three of the four causes above were each found AFTER a clean
// 21/21 single-pair null had already been recorded and written up. If a run is
// bad with probability p, independently, a single pair only diverges when
// exactly one of the two is bad — 2p(1-p), which is 0.44 at p=1/3, i.e. a coin
// flip. N sets diverge unless all N land in the same class: 1 - p^N - (1-p)^N,
// which at p=1/3 is 0.67 for three sets and 0.86 for five.
//
// Hence MIN_SETS is 3, and a REFERENCE baseline — the thing every later step is
// measured against, captured once and then quoted for weeks — should use five.
// The report prints the detection power for whatever it was given, so the number
// is never silently forgotten.
//
// --write <dir> stamps the result into that directory's manifest as `repro`,
// per shot and once at the top level. Deliberately a few floats and no extra
// PNGs: a reference set stays one picture per cell on disk, but carries its own
// reproducibility evidence forever, and `artCompare` reads it months later
// without re-capturing anything.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePng } from './_png.mjs';

export const NULL_FLOOR = 0.95;
export const MIN_SETS = 3;

// Full-resolution luminance plane. Rec.709, matching `artInk` and the scratch
// probes this promotes, so their recorded numbers stay comparable.
export function luminance(buf) {
  const { width, height, data } = decodePng(buf);
  const out = new Float64Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4)
    out[i] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
  return { width, height, out };
}

export function correlate(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    sa += da * da; sb += db * db; sab += da * db;
  }
  const denom = Math.sqrt(sa * sb);
  // A flat frame has no variance and so no correlation to report. Score it 0
  // rather than returning NaN: an all-one-colour capture is a BROKEN capture,
  // and a NaN would read downstream as "missing", which is the one thing this
  // gate must never let a bad cell look like.
  return denom === 0 ? 0 : sab / denom;
}

// Detection power for an intermittent fault that fires with probability p: the
// chance that N sets do not all land in the same class.
export const detectionPower = (n, p = 1 / 3) => 1 - p ** n - (1 - p) ** n;

// Worst off-diagonal correlation among N planes of one cell, and the pair that
// produced it. A size mismatch is reported rather than correlated — two
// different buffer sizes are not a picture difference and must not be scored
// as one.
export function worstPair(planes) {
  let worst = Infinity, where = null;
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const a = planes[i], b = planes[j];
      if (a.width !== b.width || a.height !== b.height) {
        return {
          worst: null, where: [a.name, b.name],
          size: `${a.width}x${a.height} vs ${b.width}x${b.height}`,
        };
      }
      const r = correlate(a.out, b.out);
      if (r < worst) { worst = r; where = [a.name, b.name]; }
    }
  }
  return { worst, where };
}

// Resolve a shot's PNG against the directory being read rather than the path
// recorded in the manifest, so a set stays readable after it is moved or
// renamed — the same rule `artCompare` uses.
export const shotFile = (dir, scale, state, shot) =>
  shot?.file ? `${dir}/${basename(shot.file)}` : `${dir}/${scale}__${state}.png`;

// THE WORLD HASH, and why the picture correlation is not enough on its own.
//
// `view.world.hash` is an FNV hash over the edge layer's whole written instance
// range — the actual projected geometry of the frame. Two runs that agree on it
// drew the same world; two that do not, did not, whatever their pixels say.
//
// It is NOT here because it caught something the correlation missed. It was
// added on that belief and the belief was wrong: in the run that prompted it
// (post-step-5 task 3, four same-build sets) the divergent `immersive-on` world
// also scored 0.5822 on pixels, so the correlation saw it perfectly well. That
// is recorded rather than quietly dropped, because a mechanism assumed and not
// checked is how this branch loses weeks.
//
// It earns its place for three duller reasons. It is an EQUALITY, so it has no
// floor to argue about and cannot be tuned into agreement. It counts DISTINCT
// worlds — "3 of 4 runs disagree" is a different diagnosis from "one outlier",
// and the correlation's worst-pair scalar cannot tell them apart. And it is
// recorded per state, so it says at WHICH state the runs first parted, which is
// the question that turns a hunt into a location.
//
// A cell is reproducible only if the pictures agree AND the worlds agree.
// A set captured before this field existed records no hash; that is reported as
// unknown rather than as agreement, because "the instrument cannot see it" and
// "the instrument checked and it matched" are the two things this branch has
// most often confused.
export function worldAgreement(shots) {
  const hashes = shots.map((s) => s?.view?.world?.hash ?? null);
  if (hashes.some((h) => h === null)) return { known: false, agree: null, hashes };
  const distinct = [...new Set(hashes)];
  return { known: true, agree: distinct.length === 1, hashes, distinct: distinct.length };
}

// Parse the CLI. Kept pure so the argument shape is testable: a bare token is a
// directory unless it is the value of the flag before it.
export function parseArgs(argv) {
  const flag = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : dflt;
  };
  return {
    floor: Number(flag('--floor', NULL_FLOOR)),
    minSets: Number(flag('--min-sets', MIN_SETS)),
    write: flag('--write', null),
    dirs: argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')),
  };
}

async function main(argv) {
  const { floor: FLOOR, minSets: MIN, write: WRITE, dirs: DIRS } = parseArgs(argv);

  if (DIRS.length < 2) {
    console.error('usage: node scripts/artNull.mjs <dir> <dir> [<dir> ...] [--floor N] [--min-sets N] [--write <dir>]');
    console.error(`\nTwo dirs will be measured but cannot certify: the gate needs ${MIN_SETS},`);
    console.error('and a reference baseline should use five. See the header for why.');
    return 2;
  }

  const manifests = [];
  for (const d of DIRS) {
    if (!existsSync(`${d}/manifest.json`)) {
      console.error(`no manifest in ${d} — is that a capture set?`);
      return 2;
    }
    manifests.push({ dir: d, m: JSON.parse(await readFile(`${d}/manifest.json`, 'utf8')) });
  }

  const base = manifests[0].m;
  const results = {};
  let cells = 0, below = 0, missing = 0;
  const rows = [];

  for (const scale of Object.keys(base.scales)) {
    rows.push(` ${scale}`);
    results[scale] = {};
    for (const state of Object.keys(base.scales[scale].shots)) {
      // Decode one cell across every set, score it, drop it. A five-set run at
      // @2x is 5.4 Mpx a frame; holding 21 cells of planes at once is gigabytes.
      const planes = [];
      for (const { dir, m } of manifests) {
        const f = shotFile(dir, scale, state, m.scales?.[scale]?.shots?.[state]);
        if (!existsSync(f)) continue;
        planes.push({ name: dir, ...luminance(await readFile(f)) });
      }
      if (planes.length < 2) {
        rows.push(`   ${state.padEnd(16)} (only ${planes.length} set(s) hold this cell — cannot null)`);
        missing++;
        continue;
      }
      cells++;
      const { worst, where, size } = worstPair(planes);
      if (size) {
        rows.push(`   FAIL ${state.padEnd(16)} SIZE MISMATCH ${size}   ${where.join(' vs ')}`);
        below++;
        results[scale][state] = { sets: planes.length, worst: null, note: `size mismatch ${size}` };
        continue;
      }
      const world = worldAgreement(manifests.map(({ m }) => m.scales?.[scale]?.shots?.[state]));
      const picturesOk = worst >= FLOOR;
      const ok = picturesOk && world.agree !== false;
      if (!ok) below++;
      results[scale][state] = {
        sets: planes.length, worst: Number(worst.toFixed(4)), floor: FLOOR, pass: ok,
        world: world.known ? (world.agree ? 'agree' : `${world.distinct} distinct`) : 'unknown',
      };
      const worldNote = world.known
        ? (world.agree ? '' : `   WORLD: ${world.distinct} distinct hashes — the runs drew different worlds`)
        : '   (world hash unknown — set predates the readback)';
      rows.push(
        `   ${ok ? 'ok  ' : 'FAIL'} ${state.padEnd(16)} worst=${worst.toFixed(4)}`
        + `  over ${planes.length} sets / ${(planes.length * (planes.length - 1)) / 2} pairs`
        + (picturesOk ? '' : `   <-- ${where.join(' vs ')}`)
        + worldNote,
      );
    }
  }

  const sets = manifests.length;
  const power = detectionPower(sets);
  console.log(`same-build null — ${sets} capture sets: ${DIRS.join(', ')}`);
  console.log('(luminance correlation at full resolution, worst pair per cell)\n');
  console.log(rows.join('\n'));
  console.log(`\n${cells - below}/${cells} cells reproducible at floor ${FLOOR}`
    + (missing ? `   (${missing} cell(s) skipped — not present in enough sets)` : ''));
  console.log(`${sets} sets detect a 1-in-3 intermittent fault ${(power * 100).toFixed(0)}% of the time`
    + (sets < MIN
      ? `  — BELOW the ${MIN}-set minimum, this run CANNOT certify`
      : sets < 5 ? '  — use five for a reference baseline' : ''));

  if (below) {
    console.log(`\n${below} cell(s) below the floor. This build's capture is NOT reproducible,`);
    console.log('and no parity number measured on it is admissible. Find the cause before');
    console.log('quoting anything: scripts/_t9trace.mjs + _t9tracediff.mjs print the first');
    console.log('frame at which two runs diverge, per field. Do not theorise first.');
  }

  if (WRITE) {
    if (sets < MIN) {
      console.error(`\nrefusing to --write a certificate off ${sets} sets; the minimum is ${MIN}.`);
      return 1;
    }
    if (below) {
      console.error('\nrefusing to --write a certificate for a set that is not reproducible.');
      return 1;
    }
    if (!DIRS.includes(WRITE)) {
      console.error(`\n--write ${WRITE} is not one of the sets that were compared.`);
      return 2;
    }
    const target = manifests.find((x) => x.dir === WRITE).m;
    let stamped = 0, worstAll = 1;
    for (const scale of Object.keys(results)) {
      for (const [state, r] of Object.entries(results[scale])) {
        const shot = target.scales?.[scale]?.shots?.[state];
        if (!shot) continue;
        shot.repro = r;
        if (r.worst != null && r.worst < worstAll) worstAll = r.worst;
        stamped++;
      }
    }
    target.repro = {
      sets, dirs: DIRS, floor: FLOOR, cells: stamped,
      worst: Number(worstAll.toFixed(4)),
      detectionPower: Number(power.toFixed(3)),
      measuredAt: new Date().toISOString(),
      tool: 'scripts/artNull.mjs',
    };
    await writeFile(`${WRITE}/manifest.json`, JSON.stringify(target, null, 2));
    console.log(`\ncertified ${stamped} cells into ${WRITE}/manifest.json  (worst ${worstAll.toFixed(4)}, ${sets} sets)`);
  }

  return below ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(await main(process.argv.slice(2)));
}
