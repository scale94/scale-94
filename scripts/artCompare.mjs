// artCompare.mjs — compare two /art capture sets.
//
//   node scripts/artCompare.mjs <referenceDir> <candidateDir> [--threshold N]
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

import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const REF = args[0];
const CAND = args[1];
const ti = args.indexOf('--threshold');
const THRESHOLD = ti >= 0 ? Number(args[ti + 1]) : 4.0;

if (!REF || !CAND) {
  console.error('usage: node scripts/artCompare.mjs <referenceDir> <candidateDir> [--threshold N]');
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

let fails = 0, checked = 0;
const rows = [];

for (const scale of Object.keys(ref.scales)) {
  const rs = ref.scales[scale], cs = cand.scales[scale];
  if (!cs) { console.log(`MISSING SCALE  ${scale}`); fails++; continue; }
  for (const state of Object.keys(rs.shots)) {
    const r = rs.shots[state], c = cs.shots[state];
    if (!c) { rows.push(`MISSING  ${scale} ${state}`); fails++; continue; }
    checked++;
    const d = diff(r.signature, c.signature);
    const identical = r.canvasHash === c.canvasHash;
    const ok = d.mean <= THRESHOLD;
    if (!ok) fails++;
    rows.push(
      `${ok ? 'ok  ' : 'FAIL'}  ${scale.replace(/-\d.*/, '').padEnd(10)}${state.padEnd(16)}`
      + `mean=${d.mean.toFixed(3).padStart(8)}  max=${d.max.toFixed(1).padStart(6)}`
      + `  ${identical ? '(2D canvas byte-identical)' : ''}`,
    );
  }
}

console.log(rows.join('\n'));
console.log(`\n${checked - fails}/${checked} states within threshold ${THRESHOLD} (mean abs difference, 0-255 scale)`);
if (fails) {
  console.log(`\n${fails} FAILED — look at the PNGs before believing any explanation of why.`);
  process.exit(1);
}
