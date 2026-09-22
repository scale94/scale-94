// _prismSpawn.mjs — spawn one prism pass, time it to a chosen age, shoot it.
//
// Extracted verbatim from _a21wavefilm.mjs's per-age loop body (the only
// change is turning the loop body into a callable), because it carries three
// traps that cost real time to find the first time and would cost it again
// for a second script that rewrote them from scratch:
//
//   1. THE SPHERE ROTATES. Measuring the node once and reusing the
//      coordinate for every call puts later clicks on empty space: no effect
//      spawns at all, and the caller reads frames of an idle sphere.
//   2. "THE LARGEST DISC" IS NOT "THE NODE NEAREST THE CAMERA". The layer
//      inflates a disc when its node is LIT, and the sphere fires ambient
//      effects of its own -- so the largest disc wanders the whole sphere
//      from frame to frame, and many of those picks are on the far side
//      where the click is rejected. The target here is the disc nearest the
//      PROJECTED SPHERE CENTRE, which faces the camera by construction.
//   3. THE CLICK HAS TO BE A REAL ONE. Dispatching PointerEvent/MouseEvent in
//      the page spawns nothing -- nine cycles of it produced nine idle
//      spheres -- so the click goes through CDP's input domain and only the
//      hit test is evalled. A synthetic pointerleave IS enough to dismiss the
//      hover card afterwards, which would otherwise sit over the bundle.
//
// THE AGE RETURNED IS MEASURED, NOT INTENDED -- `life` is read off
// __artGeomState immediately before the shot and converted with the same
// 1000/60 the layer's own clock fix uses, because a sleep() is not a clock.

const sleep = ms => new Promise(r => setTimeout(r, ms));

export const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
export const SPHERE_READY = `(() => { const c = ${SPHERE}; return !!c && c.width > 0; })()`;

const LIFE = '(() => { const s = window.__artGeomState();' +
  ' return JSON.stringify({ n: s.effects.length, life: s.effects.length ? s.effects[0].life : -1 }); })()';

export const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
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

/**
 * Spawn a pass on the nearest-to-centre node disc, wait until it is `wantMs`
 * old (measured off the clock, not slept blind), and shoot the sphere canvas.
 *
 * Returns `null` when no effect spawned after 5 click attempts -- the caller
 * decides how to log that miss, exactly as _a21wavefilm.mjs did before this
 * was extracted. `age` in the result is the MEASURED age at capture time and
 * can differ from `wantMs` by the click/read round trip; it can also be -1 if
 * the effect had already died by the time the shot was taken (a long
 * `wantMs` past the pass's release tail) -- callers must not treat a
 * `png` with `age === -1` as a frame of the wave.
 *
 * @param {import('./cdp.mjs').Page} page
 * @param {number} wantMs
 * @returns {Promise<{ png: Buffer, age: number, node: [number, number] } | null>}
 */
export async function shootAtAge(page, wantMs) {
  // ── CONFIRM THE SPAWN, THEN TIME FROM IT ──────────────────────────
  //
  // Not every click takes: the front node is a moving 14-20px target and a
  // click that lands beside it is simply ignored, which earlier versions of
  // this routine recorded as a frame. So the click is retried until an
  // effect exists, and the wait is measured from the age the spawn actually
  // has by the time it is confirmed -- roughly 30ms of round trip that a
  // bare sleep(wantMs) would have added on top of the age it was aiming for.
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
  if (born < 0) return null;

  const remaining = wantMs - born;
  if (remaining > 0) await sleep(remaining);
  const l = JSON.parse(await page.eval(LIFE));
  const got = l.life >= 0 ? l.life * (1000 / 60) : -1;
  const png = await page.screenshot({ clip: hit.clip });
  return { png, age: got, node: [hit.x, hit.y] };
}
