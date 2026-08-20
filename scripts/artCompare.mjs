// artCompare.mjs — compare two /art capture sets.
//
//   node scripts/artCompare.mjs <referenceDir> <candidateDir> [--threshold N] [--ungated]
//
// Why a tolerance and not a hash. The original harness gated on byte-identical
// canvas hashes and that worked while the sphere was pure Canvas2D driven from a
// frozen clock. It stopped working once the GL layer had to be captured too: the
// clock cannot be virtualised from page load (React will not commit concurrent
// work, so r3f never mounts), so the app must boot under real timing, and its
// simulation — Hopfield field, morphogenesis, edge state, awakening, conductor —
// then carries real-time history into the captured window. Resetting the sphere
// removes most of it; resetting every hook is a large, fragile surface.
//
// Measured instead: with the sphere reset at handover, two independent runs
// agree to a mean absolute difference of 0.000-0.025 / 255 on most states, 0.25
// where a cascade is mid-flight, and at worst 1.6 on immersive. So the noise
// floor is under 2, and the gate is a threshold on that signature — coarse
// enough to ignore individual particles, far too fine to miss a layer that
// failed to render, shifted, or changed brightness, which moves whole grid cells
// by tens of units.

// WHAT IS COMPARED, and why it changed at step 3.
//
// The signature stored in the manifest is computed in-page from the 2D canvas's
// getImageData, summing R, G and B with NO alpha term. That was the whole
// picture while the 2D canvas was opaque. Step 3 makes the clear a
// `destination-out` alpha erase so the GL backdrop shows through, and from then
// on a faded pixel keeps full-brightness straight RGB and only loses alpha —
// the canvas signature reads invisible trails as if they were lit, and it never
// sees the GL layers at all.
//
// So the gate now reads the composited SCREENSHOT that both capture sets
// already write to disk. No re-capture is needed to compare against an older
// baseline: its PNGs are committed alongside its manifest.

// THE REPRODUCIBILITY GATE, added after post-step-5 task 1.
//
// Everything above pins the CLOCK, and for four tasks that was mistaken for
// pinning the WORLD. It is not the same thing. `immersive-off` correlated 0.047
// between two runs of ONE build — the score two unrelated pictures get — while
// every clock this harness recorded agreed to four decimal places. Four causes,
// all the same shape: something outside the pump budget deciding what the world
// looks like. This comparator reported those states `ok` throughout, because a
// mean over a 32x18 cell is far too coarse to notice that the world changed, and
// four separate reports quoted the result as a measurement.
//
// So a row is no longer allowed to say `ok` on the threshold alone. Both sets
// must carry a `repro` certificate — the same-build null, written by
// `scripts/artNull.mjs` from three or more captures of that build. Without one,
// the row reads UNGATED and the run fails, because a number measured on a
// capture that cannot repeat itself is not a measurement and must not be
// quotable as one.
//
// Certifying is deliberately NOT part of a comparison. Requiring replicates on
// both sides of every invocation would cost six full captures per iteration, so
// it would be routed around, and a gate that gets routed around protects
// nothing. Instead a build is certified once — `artNull … --write <dir>` stamps
// a few floats into that set's manifest — and every later comparison reads it
// for free.
//
// `--ungated` exists for iterating on the harness itself. It prints a banner on
// every row and refuses to describe the result as a measurement.

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { decodePng, signatureFromRgba } from './_png.mjs';
import { MIN_SETS } from './artNull.mjs';

const args = process.argv.slice(2);
const REF = args[0];
const CAND = args[1];
const ti = args.indexOf('--threshold');
const THRESHOLD = ti >= 0 ? Number(args[ti + 1]) : 4.0;
const UNGATED = args.includes('--ungated');

if (!REF || !CAND) {
  console.error('usage: node scripts/artCompare.mjs <referenceDir> <candidateDir> [--threshold N] [--ungated]');
  process.exit(2);
}

const load = async (d) => JSON.parse(await readFile(`${d}/manifest.json`, 'utf8'));
const [ref, cand] = await Promise.all([load(REF), load(CAND)]);

function diff(a, b) {
  if (!a || !b || a.length !== b.length) return { mean: Infinity, max: Infinity };
  let sum = 0, max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > max) max = d;
  }
  return { mean: sum / a.length, max };
}

// Signature of a capture's screenshot. Resolves the PNG against the directory
// being compared rather than trusting the path recorded in the manifest, so a
// baseline stays comparable after it is moved or renamed.
async function shotSignature(dir, shot) {
  const file = `${dir}/${basename(shot.file)}`;
  const { width, height, data } = decodePng(await readFile(file));
  return signatureFromRgba(data, width, height);
}

// Read one cell's same-build null out of a manifest, and say in one word why it
// cannot be trusted if it cannot. `null` back means "no certificate at all",
// which is a different failure from "certified and failing" and is reported as
// such: the first is a job nobody did, the second is a build that is broken.
function certificate(shot) {
  const r = shot?.repro;
  if (!r) return { ok: false, why: 'none', text: '  no-null' };
  if (r.worst == null) return { ok: false, why: 'broken', text: `  null=${r.note ?? 'unmeasurable'}` };
  const text = `  null=${r.worst.toFixed(4)}/${r.sets}sets`;
  if (r.sets < MIN_SETS) return { ok: false, why: 'thin', text };
  if (r.pass === false) return { ok: false, why: 'below', text };
  return { ok: true, why: null, text };
}

// `laptop-1520x900@1x` and `laptop-1520x900@2x` both used to print as `laptop`.
// Two different scales under one label in the gate's own report is a
// mis-quotation waiting to happen; keep the dpr, drop only the dimensions.
const shortScale = (s) => s.replace(/-\d+x\d+/, '');

// Two failure kinds, counted apart. Collapsing them is how a run in which every
// state was well inside the threshold could print `0/21 within threshold`, which
// is a false statement about the pictures and exactly the sort of number this
// gate exists to stop being quoted.
let overThreshold = 0, ungatedRows = 0, missingRows = 0, checked = 0;
const rows = [];

for (const scale of Object.keys(ref.scales)) {
  const rs = ref.scales[scale], cs = cand.scales[scale];
  if (!cs) { console.log(`MISSING SCALE  ${scale}`); missingRows++; continue; }
  for (const state of Object.keys(rs.shots)) {
    const r = rs.shots[state], c = cs.shots[state];
    if (!c) { rows.push(`MISSING  ${scale} ${state}`); missingRows++; continue; }
    checked++;
    const [rSig, cSig] = await Promise.all([shotSignature(REF, r), shotSignature(CAND, c)]);
    const d = diff(rSig, cSig);
    const identical = r.shotHash === c.shotHash;
    const within = d.mean <= THRESHOLD;

    const cr = certificate(r), cc = certificate(c);
    const gated = cr.ok && cc.ok;
    if (!gated) ungatedRows++;

    // The verdict. A row may only read `ok` when the difference is inside the
    // threshold AND both sides are known to reproduce. `ok?` is the --ungated
    // form and is never a measurement.
    let verdict;
    if (!within) verdict = 'FAIL';
    else if (gated) verdict = 'ok  ';
    else if (UNGATED) verdict = 'ok? ';
    else verdict = 'UNGTD';
    if (!within) overThreshold++;

    // Only spell out a reason the null column does not already carry: `no-null`
    // says `none` on its own, but `thin` and `below` look like a healthy number.
    const spell = (c, side) => (c.ok || c.why === 'none' || c.why === 'broken' ? '' : `${side} ${c.why}`);
    const notes = [spell(cr, 'ref'), spell(cc, 'cand')].filter(Boolean);
    const nullNote = notes.length ? `   [${notes.join(', ')}]` : '';

    rows.push(
      `${verdict.padEnd(5)} ${shortScale(scale).padEnd(13)}${state.padEnd(16)}`
      + `mean=${d.mean.toFixed(3).padStart(8)}  max=${d.max.toFixed(1).padStart(6)}`
      + `${cr.text.padEnd(20)}${cc.text.padEnd(20)}`
      + `${identical ? '(byte-identical)' : ''}${nullNote}`,
    );
  }
}

console.log(`reference ${REF}   candidate ${CAND}`);
console.log(`columns: mean/max of the 32x18 signature diff, then the same-build null of each side\n`);
console.log(rows.join('\n'));
// Three numbers, because they answer three different questions and for four
// tasks this line answered only the first while being read as all three.
// `--ungated` moves the EXIT CODE and nothing else. It must never be able to
// change this count: an escape hatch that can print "21/21 ADMISSIBLE" is the
// same defect as the one being fixed, wearing a flag.
const admissible = checked - overThreshold - ungatedRows;
console.log(`\n${checked - overThreshold}/${checked} states within threshold ${THRESHOLD} (mean abs difference, 0-255 scale)`);
console.log(`${checked - ungatedRows}/${checked} states are reproducible — both sides carry a same-build null`);
console.log(`${admissible}/${checked} states are ADMISSIBLE — inside the threshold AND known to repeat`);

if (ungatedRows) {
  console.log(`\n${ungatedRows}/${checked} rows have NO usable same-build null.`);
  console.log('Certify each build once and this becomes free:');
  console.log('  node scripts/artBaseline.mjs --out baseline/<name>-a       (and -b, -c, …)');
  console.log(`  node scripts/artNull.mjs baseline/<name>-a baseline/<name>-b baseline/<name>-c --write baseline/<name>-a`);
  console.log(`A capture that cannot repeat itself cannot be quoted. See scripts/artNull.mjs.`);
}
if (UNGATED) {
  console.log('\n--ungated: rows marked ok? passed the threshold and NOTHING ELSE.');
  console.log('Do not quote a number from this run in a report or a commit message.');
}
if (overThreshold) {
  console.log(`\n${overThreshold} over threshold — look at the PNGs before believing any explanation of why.`);
}
if (missingRows) console.log(`${missingRows} row(s) or scale(s) missing from the candidate.`);
if (overThreshold || missingRows || (ungatedRows && !UNGATED)) process.exit(1);
