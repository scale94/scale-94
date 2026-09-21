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

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_READY = `(() => { const c = ${SPHERE}; return !!c && c.width > 0; })()`;

const LIFE = '(() => { const s = window.__artGeomState();' +
  ' return JSON.stringify({ n: s.effects.length, life: s.effects.length ? s.effects[0].life : -1 }); })()';

const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';

// Where to click, in client coordinates. A NEGATIVE width in slot 14 is how
// the edge layer marks a node disc.
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
    y: r.y + best[1] * (r.height / s.h),
    clip: { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 } });
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
    // ── CONFIRM THE SPAWN, THEN TIME FROM IT ──────────────────────────
    //
    // Not every click takes: the front node is a moving 14-20px target and a
    // click that lands beside it is simply ignored, which earlier versions of
    // this script recorded as a frame. So the click is retried until an
    // effect exists, and the wait is measured from the age the spawn actually
    // has by the time it is confirmed -- roughly 30ms of round trip that a
    // bare sleep(want) would have added on top of the age it was aiming for.
    //
    // A life over 300ms is NOT the click's effect. The sphere fires ambient
    // effects of its own, and an earlier run cheerfully labelled one of those
    // "45ms" while reading 1389.
    let hit = null, born = -1;
    for (let attempt = 0; attempt < 5 && born < 0; attempt++) {
      hit = JSON.parse(await page.eval(TARGET));
      if (!hit.ok) { await sleep(300); continue; }
      await page.click(hit.x, hit.y);
      await page.eval(UNHOVER);
      const l0 = JSON.parse(await page.eval(LIFE));
      const age0 = l0.life >= 0 ? l0.life * (1000 / 60) : -1;
      if (age0 >= 0 && age0 < 300) born = age0;
      else await sleep(age0 >= 0 ? 4200 : 400);
    }
    if (born < 0) {
      console.log(`  ${String(want).padStart(5)}ms   NO SPAWN AFTER 5 CLICKS`); misses++; continue;
    }
    const remaining = want - born;
    if (remaining > 0) await sleep(remaining);
    const l = JSON.parse(await page.eval(LIFE));
    const got = l.life >= 0 ? l.life * (1000 / 60) : -1;
    if (got < 0) misses++;
    const png = await page.screenshot({ clip: hit.clip });
    const name = `w${String(want).padStart(3, '0')}-t${String(Math.round(got)).padStart(4, '0')}ms.png`;
    writeFileSync(`${OUT}/${name}`, png);
    console.log(`  ${String(want).padStart(5)}ms  ${got.toFixed(0).padStart(7)}ms   `
      + `(${hit.x.toFixed(0)},${hit.y.toFixed(0)})   ${name}`);
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
