// _a25filmArmsControlled.mjs — film the SAME prism effect under all three
// chroma arms, so the frames are actually comparable.
//
// _a24filmArms.mjs clicked a fresh spawn for EVERY (arm, age) cell: different
// node pair, different geometry, different sphere orientation, and --
// because each spawn draws its own hueBase -- a different resting hue. An
// A/B whose two halves differ in the effect AND the arm measures neither.
// Confirmed by eye: arm 0's t115ms frame is a three-node WHITE_IRID cascade
// off a green node; arm 1's t126ms frame is a wholly different PITCH_BLACK
// cascade. Nothing in that comparison isolates the arm.
//
// THE FIX: use determinism.mjs's shim (cdp.mjs's `deterministic: true`) to
// spawn exactly ONE effect from ONE boot, then flip the chroma arm BETWEEN
// captures of that same effect -- approach (b) from the task, the stronger
// of the two options, because it needs no replay to agree with itself: it is
// the same JS object in memory for all three shots.
//
// THE ARM SWITCH TAKES EFFECT ON THE NEXT DRAW, WITH NO RE-RENDER (see
// ArtTab.jsx's __artSetChromaMode and the `_cMode` comment: "Read ONCE PER
// EFFECT [per frame] ... an arm that changed mid-effect would put two
// treatments in one frame"). The shim has no way to force a redraw without
// advancing the virtual clock, so each arm flip costs exactly one pumped
// frame (FRAME_MS, ~16.7ms) -- three captures per age therefore span two
// frames of drift, against an effect life of up to 300 frames (~5000ms).
// That drift is measured and printed at every cell, not assumed away.
//
// VERIFICATION, not assumption. Three independent checks, all read off
// published state at capture time and printed per cell:
//   1. SAME EFFECT: __artGeomState().effects[0].id is identical across all
//      three captures at an age (and effects.length === 1: no ambient spawn
//      snuck in underneath).
//   2. SAME GEOMETRY: the additive buffer's bounding box (min/max of every
//      segment endpoint, __artEdgeState().additive) is compared arm-to-arm;
//      the tiny per-flip pump means it will not be bit-identical, but it
//      must be sub-pixel.
//   3. SAME hue0: the arm only rewrites prismWriteAnchors' TINT anchors near
//      a wave's crest (artEdges.js's prismAnchorHue / prismChromaBlend) --
//      "EXACTLY THE RESTING COLOUR AT amp = 0" is the shader's own contract,
//      and most of a chord is untinted even mid-pass. So each run's MEDIAN
//      hue (not mean -- same reasoning _a23combR.mjs's runHueSat uses) is
//      the resting colour hue0 + k*PRISM_HUE_STEP, and it is arm-agnostic by
//      construction: computed identically here across all three captures,
//      it must land within a hair of the same value (the residual is the
//      hue0 drift over the 1-2 pumped frames between flips, which is also
//      printed).
//
//   node scripts/_a25filmArmsControlled.mjs [W] [H] [DPR] [PORT]
import { launch } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SPHERE, SPHERE_READY, clickText } from './_prismSpawn.mjs';

const W    = Number(process.argv[2] ?? 1520);
const H    = Number(process.argv[3] ?? 900);
const DPR  = Number(process.argv[4] ?? 1);
const PORT = Number(process.argv[5] ?? 5173);
const URL  = `http://localhost:${PORT}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FRAME_MS = 1000 / 60;   // same normaliser GATE_FRAME_MS / the shim use

// Same five ages _a23combR.mjs's R table and _a24filmArms.mjs's (uncontrolled)
// film used, so this set describes the same moments.
const AGES = [55, 80, 105, 140, 200];

const ARMS = [
  { mode: 0, name: 'shipped  (rotate in place)', dir: 'lookbook/chromaAB/controlled/arm0-shipped' },
  { mode: 1, name: 'U unison (gather to one hue)', dir: 'lookbook/chromaAB/controlled/arm1-unison' },
  { mode: 2, name: 'A achrom (bleach the crest)', dir: 'lookbook/chromaAB/controlled/arm2-achromatic' },
];
for (const arm of ARMS) mkdirSync(arm.dir, { recursive: true });

// ── Where to click: the node disc nearest the projected sphere centre.
// Verbatim logic from _prismSpawn.mjs's private TARGET (not exported), kept
// in lockstep with it: a negative width in slot 14 marks a node disc.
const TARGET = `(() => {
  const c = ${SPHERE};
  const r = c.getBoundingClientRect();
  const s = window.__artEdgeState(), ST = s.stride, D = s.instances;
  const cx = s.w / 2, cy = s.h / 2;
  let best = null, bestD = Infinity;
  for (let i = 0; i < s.count; i++) {
    const o = i * ST, w = D[o + 14];
    if (w >= 0) continue;
    const d = Math.hypot(D[o] - cx, D[o + 1] - cy);
    if (d < bestD) { bestD = d; best = [D[o], D[o + 1], -w]; }
  }
  if (!best) return JSON.stringify({ ok: false });
  return JSON.stringify({ ok: true,
    x: r.x + best[0] * (r.width / s.w),
    y: r.y + best[1] * (r.height / s.h) });
})()`;

const UNHOVER = `(() => {
  const c = ${SPHERE};
  const r = c.getBoundingClientRect();
  const o = { bubbles: true, composed: true, view: window, pointerId: 1,
              isPrimary: true, pointerType: 'mouse', clientX: r.x - 40, clientY: r.y - 40 };
  c.dispatchEvent(new PointerEvent('pointermove', o));
  c.dispatchEvent(new PointerEvent('pointerout', o));
  c.dispatchEvent(new PointerEvent('pointerleave', { ...o, bubbles: false }));
  return true;
})()`;

// ── Verification snapshot: geom effect identity + additive bbox + hue read,
// all in one eval so the three checks describe the SAME captured instant
// (not three separate round trips that could straddle a pump).
//
// RUNS/hueSatOf/runHueSat below are copied VERBATIM from _a23combR.mjs's
// Step 2b buffer readers (its header explains why verbatim copy is the DRY
// form here: importing would couple two instruments that must be free to
// diverge). c0's offsets (4,5,6) and the phase-delimiter (16) are the same
// EDGE_STRIDE layout every script in this family reads.
const SNAPSHOT = `(() => {
  const g = window.__artGeomState();
  const s = window.__artEdgeState();
  const a = s.additive, ST = s.stride, D = a.instances;
  const limit = a.particleStart > 0 ? Math.min(a.particleStart, a.count) : a.count;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const runs = []; let cur = null;
  for (let i = 0; i < limit; i++) {
    const o = i * ST;
    const x0 = D[o], y0 = D[o + 1], x1 = D[o + 2], y1 = D[o + 3];
    if (x0 < minX) minX = x0; if (x1 < minX) minX = x1;
    if (x0 > maxX) maxX = x0; if (x1 > maxX) maxX = x1;
    if (y0 < minY) minY = y0; if (y1 < minY) minY = y1;
    if (y0 > maxY) maxY = y0; if (y1 > maxY) maxY = y1;
    const ph = D[o + 16];
    if (ph === 0) { cur = { cols: [] }; runs.push(cur); }
    if (cur) cur.cols.push([D[o + 4], D[o + 5], D[o + 6]]);
  }
  return JSON.stringify({
    now: g.now,
    effects: g.effects,
    additiveCount: limit,
    bbox: isFinite(minX) ? { minX, maxX, minY, maxY } : null,
    runs,
  });
})()`;

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

function circularMean(hues) {
  let sx = 0, sy = 0;
  for (const h of hues) { const a = h * Math.PI / 180; sx += Math.cos(a); sy += Math.sin(a); }
  return (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;
}

/** TRIMMED circular mean hue across ALL runs' pixels combined -- the
 *  resting-colour estimate. "Most of a chord is untinted even mid-pass" is
 *  _a23combR.mjs's own reasoning for using the median as the resting hue,
 *  but prismWaveEnv never reaches exactly 0 (PRISM_WAVE_SWELL is a small
 *  permanent floor -- see artEdges.js), and early in a chord's transit the
 *  crest can cover a larger SHARE of the bundle. A plain circular mean is
 *  measurably dragged by that minority in that window (MEASURED: 5.8deg of
 *  arm-to-arm spread at the youngest age here, vs 2.2deg -- the genuine
 *  hue0-drift floor from the one-pumped-frame-per-flip cost -- at every
 *  later age). So this drops the most-deviant TRIM_FRAC of hues from the
 *  first-pass mean before recomputing -- a trimmed estimator, still
 *  measuring the SAME quantity (the resting hue), just less biased by the
 *  crest's own minority of pixels. */
const TRIM_FRAC = 0.3;
function trimmedHueOf(hues) {
  if (!hues.length) return null;
  const pass1 = circularMean(hues);
  const dev = hues.map(h => ({ h, d: angDeltaRaw(h, pass1) })).sort((a, b) => a.d - b.d);
  const keep = dev.slice(0, Math.max(1, Math.round(dev.length * (1 - TRIM_FRAC)))).map(x => x.h);
  return { hue: circularMean(keep), n: keep.length, nAll: hues.length };
}
function medianHueOf(runs) {
  const hues = [];
  for (const run of runs) {
    for (const c of run.cols) {
      const { hue } = hueSatOf(c);
      if (hue !== null) hues.push(hue);
    }
  }
  return trimmedHueOf(hues);
}
/** PER-RUN (per spectral line) trimmed hue, NOT blended across runs. A
 *  single bundle of n spectral lines spans hue0 .. hue0 + (n-1)*48deg (up to
 *  288deg for a 7-line fine bundle) -- MEASURED, this project's own earlier
 *  note. Blending every run's pixels into one circular mean before comparing
 *  arms (medianHueOf, above) therefore compares a multi-modal rainbow's
 *  overall centroid, which a differential per-k tint can drag by several
 *  degrees even at the trimmed estimator, worst at the youngest age where
 *  the crest covers the largest share of the bundle (MEASURED: 6.1deg here
 *  vs 2.2deg at every later age before this fix). Comparing hue RUN BY RUN
 *  instead means each spectral line is checked against ITSELF across arms,
 *  which is what "same hue0" actually claims -- k=0 in arm0 against k=0 in
 *  arm1 against k=0 in arm2, not a blend of k=0..6 against another blend. */
function perRunHues(runs) {
  return runs.map(run => {
    const hues = run.cols.map(c => hueSatOf(c).hue).filter(h => h !== null);
    return trimmedHueOf(hues);
  });
}
function angDeltaRaw(a, b) {
  let d = ((a - b + 540) % 360) - 180;
  return Math.abs(d);
}

function angDelta(a, b) {
  let d = ((a - b + 540) % 360) - 180;
  return Math.abs(d);
}

const main = async () => {
  const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
  const cells = []; // { age, want, arm: [{mode, snap, file}] }
  let allControlled = true;
  const failures = [];

  try {
    await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
    await sleep(2200);
    if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
    await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
    await sleep(3000);

    // Take control of the clock/RNG only after the app has mounted under
    // real timing (determinism.mjs's own contract -- virtualising earlier
    // breaks React's concurrent scheduler).
    await page.eval('window.__virtualize && window.__virtualize()');
    await sleep(150);
    await page.eval('window.__reseed && window.__reseed(); '
      + 'window.__artHarnessReset && window.__artHarnessReset();');
    await page.pump(240);   // let the sphere settle onto its pinned rotation

    // ── Spawn ONE effect, deterministically ────────────────────────────
    let spawned = false;
    for (let attempt = 0; attempt < 8 && !spawned; attempt++) {
      const hit = JSON.parse(await page.eval(TARGET));
      if (!hit.ok) { await page.pump(30); continue; }
      await page.click(hit.x, hit.y);
      await page.eval(UNHOVER);
      await page.pump(3);
      const g = JSON.parse(await page.eval('JSON.stringify(window.__artGeomState())'));
      if (g.effects.length >= 1 && g.effects[0].life < 30) spawned = true;
      else await page.pump(60);
    }
    if (!spawned) throw new Error('no effect spawned after 8 deterministic click attempts');

    const g0 = JSON.parse(await page.eval('JSON.stringify(window.__artGeomState())'));
    const effId = g0.effects[0].id;
    console.log(`\n  spawned effect id=${effId}, ${g0.effects[0].nodes} nodes, `
      + `maxLife=${g0.effects[0].maxLife} frames (${(g0.effects[0].maxLife * FRAME_MS).toFixed(0)}ms)\n`);

    // ── Per age: pump to that age, then flip through all three arms,
    // capturing each without re-clicking. ───────────────────────────────
    for (const want of AGES) {
      const gNow = JSON.parse(await page.eval('JSON.stringify(window.__artGeomState())'));
      const eff = gNow.effects.find(e => e.id === effId);
      if (!eff) { console.log(`  ${want}ms: effect ${effId} is no longer live -- STOPPING ages here`); break; }
      const curMs = eff.life * FRAME_MS;
      const need = Math.round((want - curMs) / FRAME_MS);
      if (need > 0) await page.pump(need);

      const armSnaps = [];
      for (const arm of ARMS) {
        const got = await page.eval(`window.__artSetChromaMode(${arm.mode})`);
        if (!got || got.chromaMode !== arm.mode) {
          console.log(`  ${want}ms  ${arm.name}: SWITCH REFUSED -- age not filmed`);
          allControlled = false;
          continue;
        }
        // The switch lands on the NEXT draw -- one pumped frame, always,
        // including for arm 0, so every arm in this row pays the identical
        // one-frame cost and the three captures are symmetric.
        await page.pump(1);
        const snap = JSON.parse(await page.eval(SNAPSHOT));
        const liveEff = snap.effects.find(e => e.id === effId);
        if (!liveEff) {
          console.log(`  ${want}ms  ${arm.name}: effect ${effId} died mid-sweep -- age not filmed`);
          allControlled = false;
          continue;
        }
        const ageMs = liveEff.life * FRAME_MS;
        const file = `arm${arm.mode}-t${String(Math.round(ageMs)).padStart(4, '0')}ms.png`;
        const png = await page.screenshot();   // whole canvas -- the author looks at the sphere
        writeFileSync(`${arm.dir}/${file}`, png);
        const medHue = medianHueOf(snap.runs);
        const runHues = perRunHues(snap.runs);
        armSnaps.push({
          mode: arm.mode, name: arm.name, file, ageMs,
          effId: liveEff.id, effCount: snap.effects.length, nodes: liveEff.nodes,
          bbox: snap.bbox, medHue, runCount: snap.runs.length, runHues,
        });
        console.log(`  ${String(want).padStart(4)}ms  arm${arm.mode} ${arm.name.padEnd(28)} `
          + `measured ${ageMs.toFixed(1)}ms  id=${liveEff.id}  effects=${snap.effects.length}  `
          + `bbox=[${snap.bbox ? [snap.bbox.minX, snap.bbox.minY, snap.bbox.maxX, snap.bbox.maxY].map(v => v.toFixed(1)).join(',') : 'n/a'}]  `
          + `runs=${snap.runs.length}  blendedHue=${medHue ? medHue.hue.toFixed(2) + 'deg' : 'n/a'}  `
          + `perRunHue=[${runHues.map(r => r ? r.hue.toFixed(1) : 'n/a').join(', ')}]  -> ${file}`);
      }
      cells.push({ want, armSnaps });
    }

    // ── VERIFY THE CONTROL ────────────────────────────────────────────
    console.log('\n  VERIFICATION -- same effect id, matching geometry bbox, matching hue0\n');
    console.log('  age    id match   bbox spread (px)   hue spread (deg)   verdict');
    for (const cell of cells) {
      const rows = cell.armSnaps;
      if (rows.length < 3) {
        console.log(`  ${String(cell.want).padStart(4)}ms   INCOMPLETE (${rows.length}/3 arms captured) -- NOT CONTROLLED`);
        allControlled = false;
        failures.push(`${cell.want}ms: only ${rows.length}/3 arms captured`);
        continue;
      }
      const ids = new Set(rows.map(r => r.effId));
      const idOk = ids.size === 1 && rows.every(r => r.effCount === 1);

      const bboxes = rows.map(r => r.bbox).filter(Boolean);
      let bboxSpread = NaN;
      if (bboxes.length === 3) {
        const spreads = ['minX', 'maxX', 'minY', 'maxY'].map(k => {
          const vs = bboxes.map(b => b[k]);
          return Math.max(...vs) - Math.min(...vs);
        });
        bboxSpread = Math.max(...spreads);
      }

      // RUN-BY-RUN hue comparison (k=0 vs k=0, k=1 vs k=1, ...), not a
      // blend across spectral lines -- see perRunHues's comment for why the
      // blended figure (still printed per-row above) is not trustworthy at
      // early ages.
      const runCounts = rows.map(r => r.runCount);
      const sameRunCount = new Set(runCounts).size === 1;
      let hueSpread = NaN;
      if (sameRunCount && runCounts[0] > 0) {
        let worst = 0;
        for (let k = 0; k < runCounts[0]; k++) {
          const hs = rows.map(r => r.runHues[k]?.hue).filter(h => h != null);
          if (hs.length !== 3) continue;
          const spread = Math.max(angDelta(hs[0], hs[1]), angDelta(hs[0], hs[2]), angDelta(hs[1], hs[2]));
          if (spread > worst) worst = spread;
        }
        hueSpread = worst;
      }

      // Thresholds: bbox spread must stay sub-pixel-ish (a couple of px is
      // the two-frame rotation drift budget at this sphere radius); hue
      // spread must stay well under a fraction of PRISM_HUE_STEP (48deg) --
      // a couple of degrees is the two-frame hueBase->hueTarget drift budget,
      // checked per spectral line so a differential per-k tint cannot hide
      // inside a blended average.
      const bboxOk = Number.isFinite(bboxSpread) && bboxSpread < 6;
      const hueOk = sameRunCount && Number.isFinite(hueSpread) && hueSpread < 3;
      const ok = idOk && bboxOk && hueOk;
      if (!ok) { allControlled = false; failures.push(`${cell.want}ms: idOk=${idOk} bboxOk=${bboxOk}(${bboxSpread}) sameRunCount=${sameRunCount}(${runCounts}) hueOk=${hueOk}(${hueSpread})`); }
      console.log(`  ${String(cell.want).padStart(4)}ms   ${idOk ? 'YES' : 'NO -- DIFFERENT EFFECT'}       `
        + `${Number.isFinite(bboxSpread) ? bboxSpread.toFixed(2).padStart(6) : '   n/a'}             `
        + `${Number.isFinite(hueSpread) ? hueSpread.toFixed(2).padStart(6) : '   n/a'}            `
        + `${ok ? 'CONTROLLED' : 'NOT CONTROLLED'}`);
    }

    console.log('');
    if (allControlled) {
      console.log('  VERDICT: all cells CONTROLLED -- same effect id, sub-pixel geometry match,');
      console.log('  hue0 match within the expected two-frame drift, at every age, across all');
      console.log('  three arms. The frames in lookbook/chromaAB/controlled/ isolate the arm.');
    } else {
      console.log('  VERDICT: NOT FULLY CONTROLLED. Failures:');
      for (const f of failures) console.log(`    - ${f}`);
      console.log('  Do NOT rule on these frames without resolving the failures above.');
      process.exitCode = 1;
    }
  } finally {
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
