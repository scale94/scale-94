// artSmoke.mjs — the /art sphere interaction smoke test.
//
//   node scripts/artSmoke.mjs        (needs the dev server on :5174)
//
// Every GL step of this migration risks the same silent failure: the sphere
// renders perfectly while every hover, click, drag and fusion lands on the
// overlay and dies. The pixel gate cannot see that — it only looks at pixels.
//
// This existed as prose in the step-2 plan and had to be retyped to be re-run,
// so it is a script now. Four of its checks failed on first run against a build
// that was fine; all four were bugs in the checks, and each is commented where
// it sits, because they are the traps anyone rewriting this will hit again.

import { launch } from './cdp.mjs';

const SPHERE = `[...document.querySelectorAll('canvas')]
  .filter(c => c.offsetParent && !c.closest('[data-art-composite]'))
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;
const SPHERE_READY = `(() => { const c = ${SPHERE};
  return !!c && c.getBoundingClientRect().width > 800; })()`;
const RECT = `(() => { const r = ${SPHERE}.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`;
const HOVERED = `(() => {
  const spans = [...document.querySelectorAll('span')]
    .filter(s => s.style.position === 'absolute' && s.style.font && s.textContent);
  let best = null;
  for (const s of spans) { const o = parseFloat(s.style.opacity || '0');
    if (o > 0.9 && (!best || o > best.o)) best = { o, text: s.textContent }; }
  return best && best.text; })()`;
const clickByText = (p) => `(() => {
  const re = new RegExp(${JSON.stringify('')} + ${JSON.stringify(p)}, 'i');
  const b = [...document.querySelectorAll('button')].find(e => re.test(e.innerText || ''));
  if (!b) return false; b.click(); return true; })()`;

const clickByTitle = (frag) => `(() => {
  const b = [...document.querySelectorAll('button')].find(e => (e.title || '').includes(${JSON.stringify(frag)}));
  if (!b) return false; b.click(); return true; })()`;

// IS THE SPHERE STILL ANIMATING?
//
// This used to sample a band through the centre of the 2-D canvas with
// getImageData. STEP 6 EMPTIED THAT CANVAS: the particles were the last moving
// thing on it, and what is left is the destination-out clear and the conductor.
// So the old probe reported "not animating" for a perfectly healthy sphere —
// the gate reading the layer the migration removed, which is this branch's
// defining failure in its smallest form.
//
// It reads the COMPOSITED result now, via a screenshot clipped to the sphere's
// own box. That is the surface a viewer actually sees, it spans both canvases,
// and it stays true wherever a future step moves a layer to.
const composedChanges = async (page, clip, ms) => {
  const a = await page.screenshot({ clip });
  await new Promise(r => setTimeout(r, ms));
  const b = await page.screenshot({ clip });
  return !a.equals(b);
};

// The page fetches live climate data from NASA GISS and Global Forest Watch;
// both fail CORS in headless and are pre-existing, nothing to do with the
// composite. Filter them out rather than letting them mask a real error.
const IGNORE = /CORS policy|ERR_FAILED|Failed to load resource/;
const realErrors = (p) => p.consoleErrors().filter(e => !IGNORE.test(String(e)));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const page = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900 });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await page.eval(clickByText('/CHAOS'));
  await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
  await sleep(4000);

  const rect = await page.eval(RECT);
  const cx = Math.round(rect.x + rect.w / 2), cy = Math.round(rect.y + rect.h / 2);
  // The sphere's own box, for the liveness probes. Clipped rather than
  // full-viewport so that page chrome animating elsewhere cannot stand in for
  // a sphere that has stopped.
  const sphereClip = { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 };

  // 1. two canvases, GL one present
  const layers = await page.eval(`(() => {
    const host = ${SPHERE}.parentElement;
    return [...host.querySelectorAll('canvas')].length;
  })()`);
  check('1 two canvases in the sphere container', layers === 2, `count=${layers}`);

  // 2. hit-testing resolves to the 2D canvas, NOT the GL overlay
  const atCentre = await page.eval(`(() => {
    const t = document.elementFromPoint(${cx}, ${cy});
    if (!t) return 'null';
    if (t.tagName !== 'CANVAS') return t.tagName;
    return t.closest('[data-art-composite]') ? 'CANVAS:gl' : 'CANVAS:2d';
  })()`);
  check('2 elementFromPoint at sphere centre is the 2D canvas', atCentre === 'CANVAS:2d', atCentre);

  // 3. hover a node -> label lights up
  let hit = null;
  for (let r = 1; r <= 5 && !hit; r++) {
    for (let c = 1; c <= 9 && !hit; c++) {
      const x = Math.round(rect.x + rect.w * c / 10), y = Math.round(rect.y + rect.h * r / 6);
      await page.hover(x, y); await sleep(70);
      const lab = await page.eval(HOVERED);
      if (lab) hit = { x, y, lab };
    }
  }
  check('3 hover lights a node label', !!hit, hit ? hit.lab : 'no node found on the probe grid');

  // 3b. hover an EDGE, between nodes rather than on one.
  //
  // Step 4 moves the edge strokes to the GPU while leaving projection, the
  // depth sort and edgeAt() on the CPU, so the failure this guards against is
  // the exact twin of check 2's: the sphere still draws every edge and every
  // edge hover dies. hoveredEdge never reaches the DOM — the only observable
  // is the cursor, which handleMouseMove sets to 'crosshair' the moment
  // edgeAt() returns a hit and to 'grab' when it does not. That makes it a
  // direct read of the hit-test rather than of anything the renderer drew.
  //
  // The probe point is derived FROM THE FRAME. It used to be a fixed 7x13 grid
  // in screen space, "pinned" first with __artHarnessReset, and that version
  // failed about one run in three with "no edge found on the probe grid" — on
  // the WIP build and on the stashed control alike, so a harness defect. The
  // message was also wrong about where it broke. Measured, 9 fresh boots plus
  // 17 in-page replays of the identical scan:
  //
  //   the 91-point grid never once failed to find an edge          0/26
  //   EVERY failure was the second pass, re-hovering the hit point 2/9
  //   drift of the frame under a fixed point: median 2.3px per 40ms and
  //     5.0px per 100ms, p90 10.3px per 100ms — against edgeAt()'s 8px
  //
  // AUTO_SPIN is 0.0025 rad/frame and headless runs at ~130fps, so the sphere
  // turns ~0.33 rad/s, which at sphereR 245 is ~50px/s across the cursor. And
  // __artHarnessReset never held that still: it assigns rotRef once, and the
  // draw loop adds the spin straight back on the next frame. It pinned the
  // starting angle, not the rotation, so the old comment was describing a
  // guarantee the hook does not give. A hit found at 7px is out of range by
  // the time the same coordinates are used again ~90ms later — one hover, one
  // sleep and two evals — which is the whole of the flake. Same family as
  // fc2909a: a coordinate outliving the frame it was true in.
  //
  // So: read the edge instance buffer, take the midpoint of a segment that is
  // drawn RIGHT NOW and clear of every node halo (nodes win the hit-test and
  // set 'pointer'), and hover it with no sleep in between — the cursor is
  // written synchronously inside handleMouseMove, so the dispatch ack is
  // already the guarantee that it has been rewritten. Retries re-read the
  // buffer rather than re-using a point, so no attempt is ever aimed at a
  // frame that has gone. Still a real read of the live cursor.
  const CURSOR = `${SPHERE}.style.cursor`;

  // Midpoints of the segments the GL layer drew this frame, in client coords,
  // furthest-from-any-node first. Decoded against SphereEdges.js's layout:
  // EDGE_OFF ax,ay,bx,by = 0..3 and width = 14, with isDisc() being
  // width <= 0 — the halos, the cores and the pulse rings share this
  // buffer and none of them is a segment. The discs from `discStart` on are
  // the node halos and cores, so their centres are the nodes on screen and
  // there is no need for a second source for where the nodes are.
  const EDGE_MIDPOINTS = `(() => {
    const s = window.__artEdgeState && window.__artEdgeState();
    if (!s) return null;
    const c = ${SPHERE}, r = c.getBoundingClientRect();
    const d = s.instances, S = s.stride;
    const k = r.width / s.w;        // published CSS space -> live rect; normally 1
    const nodes = [];
    for (let i = s.discStart; i < s.count; i++) {
      const o = i * S; if (d[o + 14] <= 0) nodes.push([d[o], d[o + 1]]);
    }
    const out = [];
    for (let i = 0; i < s.count; i++) {
      const o = i * S; if (d[o + 14] <= 0) continue;
      const ax = d[o], ay = d[o + 1], bx = d[o + 2], by = d[o + 3];
      if (Math.hypot(bx - ax, by - ay) < 60) continue;   // no clear middle to aim at
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      let nd = Infinity;
      for (const n of nodes) nd = Math.min(nd, Math.hypot(mx - n[0], my - n[1]));
      if (nd < 45) continue;        // inside a node's 3x-radius hitbox, which wins
      out.push({ x: Math.round(r.left + mx * k), y: Math.round(r.top + my * k), nd: Math.round(nd) });
    }
    return out.sort((p, q) => q.nd - p.nd).slice(0, 6);
  })()`;

  // The far side of the same read: the point on a coarse canvas grid that is
  // FURTHEST from every drawn segment. Hovering it must not say 'crosshair'.
  // This replaces the old second pass, which re-hovered the hit point to rule
  // out a one-frame transient and was itself the flake. It is the stronger
  // assertion anyway: re-reading a point that already said 'crosshair' cannot
  // tell a working hit-test from one stuck on, and this can.
  const EDGE_VOID = `(() => {
    const s = window.__artEdgeState && window.__artEdgeState();
    if (!s) return null;
    const c = ${SPHERE}, r = c.getBoundingClientRect();
    const d = s.instances, S = s.stride, k = r.width / s.w;
    // Confined to the sphere's own disc. A void point in the empty canvas
    // outside it only proves the cursor is not stuck on 'crosshair'; inside,
    // where every edge lives, it proves the hit-test discriminates by
    // POSITION. project() centres on (w/2, h/2) and __artBgState publishes the
    // radius the frame drew at, so this is the drawn sphere, not a guess.
    const R = 0.9 * (window.__artBgState ? window.__artBgState().sphereR : 0);
    const cxp = s.w / 2, cyp = s.h / 2;
    let best = null;
    for (let gy = 1; gy < 16; gy++) for (let gx = 1; gx < 24; gx++) {
      const px = s.w * gx / 24, py = s.h * gy / 16;
      if (R > 0 && Math.hypot(px - cxp, py - cyp) > R) continue;
      let md = Infinity;
      for (let i = 0; i < s.count; i++) {
        const o = i * S; if (d[o + 14] <= 0) continue;
        const ax = d[o], ay = d[o + 1], bx = d[o + 2], by = d[o + 3];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        if (l2 < 1) continue;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
        md = Math.min(md, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
      }
      if (!best || md > best.d) best = { x: Math.round(r.left + px * k), y: Math.round(r.top + py * k), d: md };
    }
    return best && { x: best.x, y: best.y, d: Math.round(best.d) };
  })()`;

  let edgeHit = null, edgeDetail = '__artEdgeState missing — dev build required';
  for (let attempt = 1; attempt <= 8 && !edgeHit; attempt++) {
    const cands = await page.eval(EDGE_MIDPOINTS);
    if (!cands) break;
    if (!cands.length) { edgeDetail = 'no segment midpoint clear of a node this frame'; continue; }
    edgeDetail = `${cands.length} candidates, none hit`;
    for (const p of cands) {
      await page.hover(p.x, p.y);
      if ((await page.eval(CURSOR)) === 'crosshair') { edgeHit = p; break; }
    }
    if (!edgeHit) await sleep(60);   // let the sphere turn before re-reading
  }
  // Negative control, from the same read: a point far from every segment must
  // NOT report an edge.
  let voidOk = false, voidDetail = '';
  if (edgeHit) {
    const v = await page.eval(EDGE_VOID);
    if (v) {
      await page.hover(v.x, v.y);
      const cur = await page.eval(CURSOR);
      voidOk = cur !== 'crosshair';
      voidDetail = `, void ${v.x},${v.y} (${v.d}px clear) = ${cur}`;
    }
  }
  check('3b hover between nodes reports an edge', !!edgeHit && voidOk,
        edgeHit ? `crosshair at ${edgeHit.x},${edgeHit.y} (${edgeHit.nd}px clear of any node)${voidDetail}`
                : edgeDetail);

  // 4. click a node -> cascade fires (canvas keeps changing)
  if (hit) {
    await page.click(hit.x, hit.y); await sleep(400);
    const changed = await composedChanges(page, sphereClip, 200);
    check('4 click fires and the sphere keeps animating', changed === true, `animating=${changed}`);
  } else check('4 click fires and the sphere keeps animating', false, 'skipped, no node');

  // 5. drag rotates
  // Composited, for the same reason as the liveness probes above: after step 6
  // the 2-D canvas no longer carries anything a rotation moves.
  const before = await page.screenshot({ clip: sphereClip });
  await page.drag(cx - 120, cy, cx + 120, cy + 40, 14);
  await sleep(400);
  const after = await page.screenshot({ clip: sphereClip });
  check('5 drag rotates the sphere', !before.equals(after));

  // 5b/5c. A ROTATE-DRAG THAT ENDS ON A NODE MUST NOT FIRE IT.
  //
  // handleMouseUp's "was this a click?" test measured against
  // dragRef.current.lastX/lastY, which handleMouseMove overwrites on every
  // move while the drag is live — so it asked how far the pointer moved since
  // the LAST MOUSEMOVE, which is a pixel or two for any gesture of any length.
  // Drags of 12px and 30px released over a node fired it, readout and all.
  // What limited it was only whether the rotation had carried a node out of
  // nodeAt's reach before the button came up, which is why no gate caught it.
  //
  // The positive control is the point: `rings` staying 0 proves nothing unless
  // a real click at the same moment makes it non-zero, and this branch has
  // scored perfect parity on an absent layer six times.
  const NODE_POINTS = `(() => {
    const s = window.__artEdgeState && window.__artEdgeState();
    if (!s) return null;
    const c = ${SPHERE}, r = c.getBoundingClientRect();
    const d = s.instances, S = s.stride, k = r.width / s.w;
    const seen = [], out = [];
    for (let i = s.discStart; i < s.count; i++) {
      const o = i * S; if (d[o + 14] > 0) continue;
      const x = d[o], y = d[o + 1];
      if (seen.some(q => Math.hypot(q[0] - x, q[1] - y) < 24)) continue;
      seen.push([x, y]);
      if (x < 80 || y < 40 || x > s.w - 40 || y > s.h - 40) continue;  // room to drag in from
      out.push({ x: Math.round(r.left + x * k), y: Math.round(r.top + y * k) });
    }
    return out;
  })()`;
  const ringsOver = async (ms) => {
    let peak = 0;
    for (let t = 0; t < ms; t += 100) {
      await sleep(100);
      const st = await page.eval('(window.__artEdgeState && window.__artEdgeState().rings) || 0');
      peak = Math.max(peak, Number(st) || 0);
    }
    return peak;
  };

  let dragFired = null, dragDetail = 'no node with room to drag into';
  for (let attempt = 1; attempt <= 8 && dragFired === null; attempt++) {
    const pts = await page.eval(NODE_POINTS);
    if (!pts || !pts.length) { await sleep(80); continue; }
    const p = pts[attempt % pts.length];
    const d = await page.drag(p.x - 30, p.y, p.x, p.y, 10);
    // The drag's last move already ran handleMouseMove, which sets the cursor
    // from nodeAt — so this is a direct read that a node IS under the release
    // point, taken before the button comes up rather than assumed after.
    const onNode = (await page.eval(CURSOR)) === 'pointer';
    await d.release();
    if (!onNode) { dragDetail = 'drag did not land on a node'; await sleep(200); continue; }
    const peak = await ringsOver(1500);
    dragFired = peak > 0;
    dragDetail = `30px drag released on a node, peak rings=${peak}`;
  }
  check('5b a rotate-drag released on a node does not fire it', dragFired === false, dragDetail);

  // The control: rings must be reachable from a real click right here, or 5b
  // is measuring a layer that is simply not on screen.
  let ctrlPeak = 0, ctrlDetail = 'no node found for the control click';
  for (let attempt = 1; attempt <= 8 && ctrlPeak === 0; attempt++) {
    const pts = await page.eval(NODE_POINTS);
    if (!pts || !pts.length) { await sleep(80); continue; }
    const p = pts[attempt % pts.length];
    await page.hover(p.x, p.y);
    if ((await page.eval(CURSOR)) !== 'pointer') { await sleep(80); continue; }
    await page.click(p.x, p.y);
    ctrlPeak = await ringsOver(2000);
    ctrlDetail = `click on a node, peak rings=${ctrlPeak}`;
  }
  check('5c control — a real click on the same layer DOES fire it', ctrlPeak > 0, ctrlDetail);

  // 6. shift-click with resonance armed
  const armed = await page.eval(clickByText('resonance'));
  if (armed && hit) {
    await page.click(hit.x, hit.y, { modifiers: 8 });   // 8 = shift
    await sleep(300);
    const errs = realErrors(page).length;
    check('6 shift-click resonance without errors', errs === 0, `errors=${errs}`);
    await page.eval(clickByText('resonance'));          // disarm
  } else check('6 shift-click resonance without errors', false, 'resonance button not found');

  // 7. touch long-press fusion ring — the path the index bug used to kill
  await page.enableTouch();
  const errsBefore = realErrors(page).length;
  if (hit) await page.longPress(hit.x, hit.y, 800);
  await sleep(500);
  const errsAfter = realErrors(page).length;
  check('7 touch long-press fusion throws nothing', errsAfter === errsBefore,
        `new errors=${errsAfter - errsBefore}`);

  // 8. still animating after the long press (the loop must not have died)
  const alive = await composedChanges(page, sphereClip, 250);
  check('8 draw loop alive after long-press', alive === true);

  // 9. immersive on and off
  const on = await page.eval(clickByTitle('Immersive mode'));
  await sleep(600);
  const off = await page.eval(clickByTitle('Immersive mode'));
  await sleep(600);
  check('9 immersive toggles on and off', on && off);

  const errors = realErrors(page);
  console.log(`\nconsole errors: ${errors.length}`);
  for (const e of errors.slice(0, 8)) console.log('   ', String(e).slice(0, 160));

  const passed = results.filter(r => r.pass).length;
  console.log(`\n${passed}/${results.length} smoke checks passed`);
  // Name the failures in the SUMMARY, not only at the point they happen. This
  // output is read through `tail` in every gate run in this project's history,
  // and a "9/10" whose FAIL line has already scrolled past is a score with no
  // finding attached — which is how one intermittent failure here stayed
  // "unexplained" across two tasks.
  if (passed !== results.length)
    console.log(`   FAILED: ${results.filter(r => !r.pass).map(r => r.name).join(' | ')}`);
  if (passed !== results.length) process.exitCode = 1;
} finally {
  await page.close();
}
