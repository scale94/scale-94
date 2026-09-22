// _a21wavefilm.mjs — ONE FRAME PER CLICK, AT A CONTROLLED AGE.
//
// _a20wavetrace samples one live effect in a loop, and a single
// __artEdgeState eval costs a sizeable fraction of a transit -- tolerable
// when the pulse TRAIN ran for 570ms, useless now that a single pass is over
// in about 100ms. Its four PNGs are also taken AFTER its sample loop, so
// "a-launch" is a frame roughly a second past the click and has never shown a
// launch. This script does the opposite: one click per frame, one frame per
// run of the gesture, so the age of each frame is chosen rather than caught.
//
// THREE THINGS IT HAD TO LEARN THE HARD WAY, all of which produced credible
// output with nothing in it:
//
//   1. THE SPHERE ROTATES. Measuring the node once and reusing the
//      coordinate for every cycle put later clicks on empty space: no effect
//      spawned at all, and the script wrote frames of an idle sphere.
//   2. "THE LARGEST DISC" IS NOT "THE NODE NEAREST THE CAMERA". The layer
//      inflates a disc when its node is LIT, and the sphere fires ambient
//      effects of its own -- so the largest disc wanders the whole sphere
//      from frame to frame, and many of those picks are on the far side
//      where the click is rejected. The target here is the disc nearest the
//      PROJECTED SPHERE CENTRE, which faces the camera by construction.
//   3. THE CLICK HAS TO BE A REAL ONE. Dispatching PointerEvent/MouseEvent
//      in the page spawns nothing -- nine cycles of it produced nine idle
//      spheres -- so the click goes through CDP's input domain and only the
//      hit test is evalled. A synthetic pointerleave IS enough to dismiss the
//      hover card afterwards, which would otherwise sit over the bundle.
//
// THE AGE IN THE FILENAME IS MEASURED, NOT INTENDED -- `life` is read off
// __artGeomState immediately before the shot and converted with the same
// 1000/60 the layer's own clock fix uses, because a sleep() is not a clock.
//
//   node scripts/_a21wavefilm.mjs [W] [H] [DPR] [PORT]
import { launch } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SPHERE_READY, clickText, shootAtAge } from './_prismSpawn.mjs';

const W    = Number(process.argv[2] ?? 1520);
const H    = Number(process.argv[3] ?? 900);
const DPR  = Number(process.argv[4] ?? 1);
const PORT = Number(process.argv[5] ?? 5173);
const URL  = `http://localhost:${PORT}/`;
const OUT  = 'lookbook/prismfilm';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The ages one pass actually passes through on a median chord (transit ~103ms,
// release 360ms), biased DOWN by the ~28ms the click and the life read cost.
const AGES = [0, 30, 55, 80, 105, 140, 200, 320, 480, 900];

mkdirSync(OUT, { recursive: true });
const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: false });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere canvas' });
  await sleep(1500);

  console.log('  wanted   measured   node        file');
  let misses = 0;
  for (const want of AGES) {
    // shootAtAge (scripts/_prismSpawn.mjs) owns the confirm-then-time
    // sequence: it retries the click until an effect is confirmed alive
    // (a click beside the 14-20px disc is silently ignored), measures the
    // age off the clock rather than a bare sleep(want), and shoots the
    // sphere canvas once `want` is reached.
    const hit = await shootAtAge(page, want);
    if (!hit) {
      console.log(`  ${String(want).padStart(5)}ms   NO SPAWN AFTER 5 CLICKS`); misses++; continue;
    }
    const got = hit.age;
    if (got < 0) misses++;
    const name = `w${String(want).padStart(3, '0')}-t${String(Math.round(got)).padStart(4, '0')}ms.png`;
    writeFileSync(`${OUT}/${name}`, hit.png);
    console.log(`  ${String(want).padStart(5)}ms  ${got.toFixed(0).padStart(7)}ms   `
      + `(${hit.node[0].toFixed(0)},${hit.node[1].toFixed(0)})   ${name}`);
    await sleep(4200);            // let the effect die entirely before the next
  }
  console.log(`\n  frames written to ${OUT}/`);
  if (misses) {
    console.log(`\n  ${misses} FRAME(S) HAVE NO LIVE EFFECT and show an idle sphere. `
      + 'A frame at age -1 is not a frame of the wave; do not read one.');
  }
} finally {
  await page.close();
}
