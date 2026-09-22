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

// ── Bundle bounding box (opt-in clip) ───────────────────────────────────────
//
// Spec section 4.5: an R number must be quoted against the bundle's OWN
// region, not the whole sphere canvas -- the canvas also carries filaments,
// chimera fringes, resonance edges, base edges and node discs, none of which
// window.__artSetChromaMode can touch, and a clip that includes them measures
// a population of pixels the arm is structurally incapable of moving.
//
// This walks the SAME range _a23combR.mjs's RUNS constant already walks --
// window.__artEdgeState().additive.instances, up to particleStart -- so the
// clip and the buffer read that seeded a trusted number are provably looking
// at the same geometry, not two different ideas of "the bundle".
//
// PRISM_BBOX_PAD_PX pads the raw segment-endpoint box before it becomes a
// clip rect, in CSS px, because two things put ink past a segment's own
// coordinates and neither is a number this script can read off published
// state:
//   1. The glow pass strokes up to PRISM_GLOW_W (5px) wide, and the vertex
//      shader pads every segment by halfWidth + 1px of antialiasing on top
//      of that (SphereEdges.js: `pad = halfW + 1.0 + ...`) -- about 3.5px of
//      real ink past a segment's raw endpoints.
//   2. The composer's Bloom pass (mipmapBlur across 4 levels, radius 0.7 --
//      artComposite.js's BLOOM) re-spreads any bright pixel well beyond the
//      stroke, by an amount nothing here publishes.
// 48px clears both several times over. It is picked generously on stated
// reasoning, once -- not tuned until a wanted R number appears (task-5
// review, finding 1).
export const PRISM_BBOX_PAD_PX = 48;

const BUNDLE_BBOX = `(() => {
  const PAD = ${PRISM_BBOX_PAD_PX};
  const c = ${SPHERE};
  const r = c.getBoundingClientRect();
  const s = window.__artEdgeState();
  if (!s) return JSON.stringify({ ok: false, reason: 'no __artEdgeState' });
  const ST = s.stride, a = s.additive, D = a.instances;
  // Same limit RUNS uses: everything before particleStart, or the whole
  // stream when no particle writer has run this frame.
  const limit = a.particleStart > 0 ? Math.min(a.particleStart, a.count) : a.count;
  if (!limit) return JSON.stringify({ ok: false, reason: 'no live effect (additive buffer empty)' });
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < limit; i++) {
    const o = i * ST;
    const x0 = D[o], y0 = D[o + 1], x1 = D[o + 2], y1 = D[o + 3];
    if (x0 < minX) minX = x0; if (x1 < minX) minX = x1;
    if (x0 > maxX) maxX = x0; if (x1 > maxX) maxX = x1;
    if (y0 < minY) minY = y0; if (y1 < minY) minY = y1;
    if (y0 > maxY) maxY = y0; if (y1 > maxY) maxY = y1;
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return JSON.stringify({ ok: false, reason: 'non-finite geometry' });
  }
  const sx = r.width / s.w, sy = r.height / s.h;
  const cssMinX = r.x + minX * sx, cssMaxX = r.x + maxX * sx;
  const cssMinY = r.y + minY * sy, cssMaxY = r.y + maxY * sy;
  if ((cssMaxX - cssMinX) < 1e-6 || (cssMaxY - cssMinY) < 1e-6) {
    return JSON.stringify({ ok: false, reason: 'zero-area box' });
  }
  const clip = {
    x: cssMinX - PAD, y: cssMinY - PAD,
    width:  (cssMaxX - cssMinX) + 2 * PAD,
    height: (cssMaxY - cssMinY) + 2 * PAD,
    scale: 1,
  };
  const EPS = 0.5;
  if (clip.x < r.x - EPS || clip.y < r.y - EPS ||
      clip.x + clip.width  > r.x + r.width  + EPS ||
      clip.y + clip.height > r.y + r.height + EPS) {
    return JSON.stringify({ ok: false, reason: 'box partly off-canvas',
      clip, canvas: { x: r.x, y: r.y, width: r.width, height: r.height } });
  }
  return JSON.stringify({ ok: true, clip });
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
 * @param {{ bundleClip?: boolean }} [opts] `bundleClip: true` clips the shot
 *   to the live effect's own prism geometry (see BUNDLE_BBOX above) instead
 *   of the whole sphere canvas. Defaults to false so existing callers --
 *   `_a21wavefilm.mjs` chief among them -- keep the whole-canvas clip they
 *   have always used; this is opt-in precisely so that instrument's frames
 *   do not change.
 * @returns {Promise<{ png: Buffer, age: number, node: [number, number] } | null>}
 */
export async function shootAtAge(page, wantMs, { bundleClip = false } = {}) {
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

  // Computed here, right before the shot -- not back at TARGET's click-time
  // read -- because the sphere keeps rotating and the pass keeps advecting
  // for the whole `remaining` wait; a box measured before that wait would be
  // stale by exactly the amount this function exists to control for.
  let clip = hit.clip;
  if (bundleClip) {
    const bb = JSON.parse(await page.eval(BUNDLE_BBOX));
    if (!bb.ok) {
      throw new Error(`shootAtAge: bundle clip invalid at wantMs=${wantMs} `
        + `(measured age ${got.toFixed(0)}ms) -- ${bb.reason}`
        + (bb.clip ? ` clip=${JSON.stringify(bb.clip)} canvas=${JSON.stringify(bb.canvas)}` : ''));
    }
    clip = bb.clip;
  }
  const png = await page.screenshot({ clip });
  return { png, age: got, node: [hit.x, hit.y] };
}
