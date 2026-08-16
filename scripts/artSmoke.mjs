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

// Sample a band through the CENTRE of the sphere, in backing-store pixels.
// Sampling row 0 or the top-left corner is useless: those are empty, and with
// the destination-out clear they settle to a fixed fully-transparent value and
// never change again — which reads as "the draw loop is dead".
const centreBand = (ms) => `(() => {
  const c = ${SPHERE}, g = c.getContext('2d');
  const x = Math.max(0, (c.width >> 1) - 150), y = Math.max(0, (c.height >> 1) - 60);
  const grab = () => g.getImageData(x, y, 300, 120).data.join(',');
  const a = grab();
  return new Promise(res => setTimeout(() => res(a !== grab()), ${ms}));
})()`;

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
  // Probed on a grid rather than aimed at one midpoint: the sphere is spinning
  // and the node set is data-driven, so a hard-coded pair is a flake waiting
  // to happen. Points that land on a node are rejected — nodes take priority
  // in the handler and set 'pointer'.
  //
  // Pinned to a fixed rotation FIRST. Without this the grid is scanned against
  // whatever angle real-time boot happened to land on, and on a spinning
  // sphere that has a real false-negative tail: two runs of this exact check
  // landed their hit at 652,462 and 755,390 — different starting angles put
  // different edges under the 91 probe points, and sometimes none of them.
  // __artHarnessReset (dev-only harness hook) pins rotation to rx=0.18, ry=0,
  // so the same edges sit under the same probe cells run to run. Still a real
  // hit-test read of the live cursor, not a weakened stand-in for one.
  await page.eval(`(() => { window.__artHarnessReset && window.__artHarnessReset(); return true; })()`);
  await sleep(120);

  const CURSOR = `${SPHERE}.style.cursor`;
  let edgeHit = null;
  for (let r = 1; r <= 7 && !edgeHit; r++) {
    for (let c = 1; c <= 13 && !edgeHit; c++) {
      const x = Math.round(rect.x + rect.w * c / 14), y = Math.round(rect.y + rect.h * r / 8);
      await page.hover(x, y); await sleep(40);
      const cur = await page.eval(CURSOR);
      if (cur === 'crosshair') edgeHit = { x, y };
    }
  }
  // Re-assert on a second pass: a lone true reading could still be a one-frame
  // transient (mid-animation the cursor style write and this read are not
  // atomic). Re-hover the same point and require the hit to hold.
  if (edgeHit) {
    await page.hover(edgeHit.x, edgeHit.y); await sleep(40);
    const stillHit = (await page.eval(CURSOR)) === 'crosshair';
    if (!stillHit) edgeHit = null;
  }
  check('3b hover between nodes reports an edge', !!edgeHit,
        edgeHit ? `crosshair at ${edgeHit.x},${edgeHit.y}` : 'no edge found on the probe grid');

  // 4. click a node -> cascade fires (canvas keeps changing)
  if (hit) {
    await page.click(hit.x, hit.y); await sleep(400);
    const changed = await page.eval(centreBand(200), { awaitPromise: true });
    check('4 click fires and the sphere keeps animating', changed === true, `animating=${changed}`);
  } else check('4 click fires and the sphere keeps animating', false, 'skipped, no node');

  // 5. drag rotates
  const CENTRE = `(() => { const c = ${SPHERE}, g = c.getContext('2d');
    const x = Math.max(0, (c.width >> 1) - 150), y = Math.max(0, (c.height >> 1) - 60);
    return g.getImageData(x, y, 300, 120).data.join(','); })()`;
  const before = await page.eval(CENTRE);
  await page.drag(cx - 120, cy, cx + 120, cy + 40, 14);
  await sleep(400);
  const after = await page.eval(CENTRE);
  check('5 drag rotates the sphere', before !== after);

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
  const alive = await page.eval(centreBand(250), { awaitPromise: true });
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
