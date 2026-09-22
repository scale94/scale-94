// _a24filmArms.mjs — Task 7's deliverable: one pass per arm, at the same
// matched ages _a23combR.mjs measures R at, so the author can look at the
// exact moments the metric describes.
//
// WHOLE-CANVAS CLIP, not the bundle bbox. _a23combR.mjs clips to the
// bundle's own geometry because that is the only population of pixels
// window.__artSetChromaMode can move, and mixing in the rest of the sphere
// would dilute the R number (see that script's header). But the author is
// not going to look at an R number -- he is going to look at the sphere, so
// these films use shootAtAge's DEFAULT clip (the whole sphere canvas,
// `bundleClip` left false), same as _a21wavefilm.mjs has always used.
//
// Per-arm directories so the three arms' frames can never be confused with
// each other by filename collision alone:
//   lookbook/chromaAB/arm0-shipped/
//   lookbook/chromaAB/arm1-unison/
//   lookbook/chromaAB/arm2-achromatic/
//
//   node scripts/_a24filmArms.mjs [W] [H] [DPR] [PORT]
import { launch } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SPHERE_READY, clickText, shootAtAge } from './_prismSpawn.mjs';

const W    = Number(process.argv[2] ?? 1520);
const H    = Number(process.argv[3] ?? 900);
const DPR  = Number(process.argv[4] ?? 1);
const PORT = Number(process.argv[5] ?? 5173);
const URL  = `http://localhost:${PORT}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Same five ages _a23combR.mjs's R table uses, so the film and the metric
// describe the same moments.
const AGES = [55, 80, 105, 140, 200];

const ARMS = [
  { mode: 0, name: 'shipped  (rotate in place)', dir: 'lookbook/chromaAB/arm0-shipped' },
  { mode: 1, name: 'U unison (gather to one hue)', dir: 'lookbook/chromaAB/arm1-unison' },
  { mode: 2, name: 'A achrom (bleach the crest)', dir: 'lookbook/chromaAB/arm2-achromatic' },
];

// Same reasoning as _a23combR.mjs's ARM_DECAY_MS: let a pass die entirely
// before the next click, so a still-alive straggler from the previous arm
// (or the previous age, within the same arm) cannot sit in the frame under
// the wrong arm's mode.
const DECAY_MS = 4200;

for (const arm of ARMS) mkdirSync(arm.dir, { recursive: true });

const main = async () => {
  const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: false });
  const written = { }; // dir -> [{age, file, bytes}]
  try {
    await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
    if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
    await page.waitFor(SPHERE_READY, { label: 'sphere canvas' });
    await sleep(1500);

    for (const arm of ARMS) {
      const got = await page.eval(`window.__artSetChromaMode(${arm.mode})`);
      if (!got || got.chromaMode !== arm.mode) {
        console.log(`  ${arm.name}: SWITCH REFUSED (${JSON.stringify(got)}) -- arm NOT filmed`);
        written[arm.dir] = [];
        continue;
      }
      console.log(`\n  -- ${arm.name} --`);
      console.log('  wanted   measured   node        file');
      const rows = [];
      for (const want of AGES) {
        const hit = await shootAtAge(page, want); // bundleClip defaults false: whole canvas
        if (!hit) {
          console.log(`  ${String(want).padStart(5)}ms   NO SPAWN AFTER 5 CLICKS`);
          // Pushed as null, not skipped: the verification cross-check reads
          // rows[i] against AGES[i] by array index, so a dropped entry would
          // silently misalign every age after it rather than just being
          // absent at its own (same trap _a23combR.mjs's measureArmRTable
          // guards against with its NaN push).
          rows.push(null);
          continue;
        }
        const got2 = hit.age;
        const name = `arm${arm.mode}-t${String(Math.round(got2)).padStart(4, '0')}ms.png`;
        const path = `${arm.dir}/${name}`;
        writeFileSync(path, hit.png);
        console.log(`  ${String(want).padStart(5)}ms  ${got2.toFixed(0).padStart(7)}ms   `
          + `(${hit.node[0].toFixed(0)},${hit.node[1].toFixed(0)})   ${name}`);
        rows.push({ want, age: got2, file: name, bytes: hit.png.length });
        await sleep(DECAY_MS);
      }
      written[arm.dir] = rows;
      await sleep(DECAY_MS);
    }

    // ── VERIFY: one file per age, and same-age frames DIFFER across arms ──
    console.log('\n  VERIFICATION');
    for (const arm of ARMS) {
      const rows = written[arm.dir] || [];
      const wrote = rows.filter(Boolean).length;
      console.log(`  ${arm.dir}: ${wrote}/${AGES.length} frames written`);
    }
    console.log('\n  same-age byte-size cross-check (identical sizes across arms would mean');
    console.log('  the arm switch did not reach the film path -- a real failure, not a formality):');
    console.log('  nominal age   shipped bytes   U bytes   A bytes   all-different?');
    for (let i = 0; i < AGES.length; i++) {
      const s = written[ARMS[0].dir]?.[i]?.bytes;
      const u = written[ARMS[1].dir]?.[i]?.bytes;
      const a = written[ARMS[2].dir]?.[i]?.bytes;
      const vals = [s, u, a];
      const allPresent = vals.every(v => Number.isFinite(v));
      const allDifferent = allPresent && new Set(vals).size === 3;
      console.log(`  ${String(AGES[i]).padStart(9)}ms   ${String(s ?? 'n/a').padStart(11)}   `
        + `${String(u ?? 'n/a').padStart(7)}   ${String(a ?? 'n/a').padStart(7)}   `
        + `${allPresent ? (allDifferent ? 'YES' : 'NO -- SUSPECT') : 'missing frame(s)'}`);
    }
  } finally {
    // The mode-0 restore stays in `finally` regardless of which path exits.
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
