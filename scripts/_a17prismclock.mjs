// _a17prismclock.mjs — does the prism envelope advance on the CLOCK or on the
// FRAME COUNT?
//
// THE WHOLE POINT OF THIS INSTRUMENT IS THAT THE PARITY HARNESS CANNOT ANSWER
// THIS. `determinism.mjs` virtualises performance.now() and advances it by
// exactly FRAME_MS per __pump, so under capture the elapsed-ms-per-draw ratio
// is pinned at exactly 1000/60 and a frame-counted layer and a clock-driven
// one are BIT IDENTICAL. 24/24 ADMISSIBLE proves only that the 60fps frame did
// not move; it can never prove a refresh-rate bug is fixed, and this project
// has already been bitten by exactly that reasoning once (see the breath-clock
// work). So this runs on the REAL clock — `deterministic: false` — and the
// discrimination comes from running at a frame rate that is NOT 60.
//
// ── THE MEASUREMENT ───────────────────────────────────────────────────────
//
// `eff.life` is an authored-FRAME count against `eff.maxLife`. Two slopes:
//
//   d(life)/d(draw)          == 1.0  <=>  frame-counted  (THE BUG)
//   d(life)/d(ms) * 16.667   == 1.0  <=>  clock-driven   (THE FIX)
//
// At exactly 60fps both are 1.0 and the probe says nothing — so it REFUSES to
// report unless the measured rate is far enough from 60 to separate them. A
// probe that cannot fail is not evidence.
//
// ── WHY IT SAMPLES IN-PAGE ────────────────────────────────────────────────
//
// Polling from the harness would put a CDP round trip between every frame of
// the thing being timed, and `__artEdgeState` — the other hook that can see
// the prism — serialises the whole additive buffer (~74000 instances x 18
// floats at full strength). Either would cost more than the frame it is
// trying to measure. The sampler lives inside the patched rAF callback and
// the trace is read ONCE at the end.
//
// Counts `cb.name === 'draw'` and NOT every rAF callback: counting all of
// them inflated a 269.6fps measurement to 875.7 on this project, and hid a
// stall while doing it.
//
//   node scripts/_a17prismclock.mjs [W] [H] [DPR] [PORT]
import { launch } from './cdp.mjs';

const W    = Number(process.argv[2] ?? 1520);
const H    = Number(process.argv[3] ?? 900);
const DPR  = Number(process.argv[4] ?? 1);
const PORT = Number(process.argv[5] ?? 5173);
const URL  = `http://localhost:${PORT}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// How far from 60fps the run must land before either slope can be quoted.
// At 60fps the two hypotheses predict the same number, so this is the gate
// that makes the instrument capable of failing.
const RATE_MARGIN = 12;   // fps

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_RECT = '(() => { const c = ' + SPHERE + '; const r = c.getBoundingClientRect();'
  + ' return { x: r.x, y: r.y, w: r.width, h: r.height }; })()';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 700; })()';
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';

// Node disc centres: same buffer as the edges, NEGATIVE width, index >=
// discStart. Read ONCE, before the click, purely to find something to click.
const DISCS = `(() => {
  const s = window.__artEdgeState ? window.__artEdgeState() : null;
  if (!s) return JSON.stringify({ hook: false });
  const ST = s.stride, D = s.instances, out = [];
  for (let i = 0; i < s.count; i++) {
    const o = i * ST, w = D[o + 14];
    if (w >= 0) continue;
    out.push([D[o], D[o + 1], -w]);
  }
  return JSON.stringify({ hook: true, w: s.w, h: s.h, discs: out });
})()`;

// The in-page sampler. Patches rAF once, counts only `draw`, and records the
// live effects AFTER the callback returns so `life` reflects this frame's
// own increment.
const INSTALL = `(() => {
  if (window.__geomTrace) return 'already';
  if (!window.__artGeomState) return 'no-hook';
  window.__geomTrace = [];
  window.__drawCount = 0;
  window.__sawDrawName = null;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => orig((t) => {
    const r = cb(t);
    if (cb && cb.name === 'draw') {
      window.__drawCount++;
      if (window.__sawDrawName === null) window.__sawDrawName = cb.name;
      if (window.__geomTrace.length < 20000) {
        const g = window.__artGeomState();
        window.__geomTrace.push([g.now, window.__drawCount,
          g.effects.map(e => [e.id, e.life, e.maxLife])]);
      }
    }
    return r;
  });
  return 'ok';
})()`;

const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: false });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere canvas' });
  await sleep(1500);

  const install = await page.eval(INSTALL);
  if (install !== 'ok') throw new Error(`sampler not installed: ${install}`);

  // ── LIVENESS, BEFORE ANYTHING IS MEASURED ────────────────────────────────
  // A trace that never grows and a trace that grows but shows no effect are
  // different findings, and a probe that cannot tell them apart would report
  // "no bug" for a dead hook. Both are asserted separately.
  await sleep(1200);
  const warm = JSON.parse(await page.eval(
    '(() => JSON.stringify({ n: window.__geomTrace.length, d: window.__drawCount, name: window.__sawDrawName }))()'));
  if (warm.d === 0) {
    throw new Error('LIVENESS FAILED: zero `draw` callbacks counted. Either the rAF '
      + 'patch missed the loop or the page is rAF-suspended (hidden pane / backgrounded window).');
  }
  console.log(`sampler live: ${warm.n} samples over ${warm.d} draws, callback name ${warm.name}`);

  // Something to click. One expensive read, before the measurement starts.
  const idle = JSON.parse(await page.eval(DISCS));
  if (!idle.hook) throw new Error('no __artEdgeState hook');
  if (!idle.discs.length) throw new Error('no node discs on screen');
  const rect = await page.eval(SPHERE_RECT);
  // The widest disc is the nearest node: biggest hit target, and a front-facing
  // click is the one that spawns the longest-lived effect.
  const target = idle.discs.slice().sort((a, b) => b[2] - a[2])[0];
  const sx = rect.x + target[0] * (rect.w / idle.w);
  const sy = rect.y + target[1] * (rect.h / idle.h);

  const before = JSON.parse(await page.eval(
    '(() => JSON.stringify(window.__artGeomState().effects.length))()'));
  await page.click(sx, sy);
  console.log(`clicked disc at buffer (${target[0].toFixed(1)}, ${target[1].toFixed(1)}) `
    + `r=${target[2].toFixed(1)} -> page (${sx.toFixed(1)}, ${sy.toFixed(1)})`);

  // Let the whole effect live and die. The longest authored life is 300
  // frames = 5s at 60fps; under software GL a FRAME-COUNTED effect can run
  // far longer than that, which is the point, so allow generous headroom.
  await sleep(18000);

  const trace = JSON.parse(await page.eval('JSON.stringify(window.__geomTrace)'));
  const spawned = JSON.parse(await page.eval(
    '(() => JSON.stringify({ live: window.__artGeomState().effects.length, d: window.__drawCount }))()'));

  // ── Overall render rate ──────────────────────────────────────────────────
  const tSpan = trace[trace.length - 1][0] - trace[0][0];
  const dSpan = trace[trace.length - 1][1] - trace[0][1];
  const fps = dSpan / (tSpan / 1000);
  console.log(`\n${trace.length} samples, ${dSpan} draws over ${(tSpan / 1000).toFixed(2)}s `
    + `= ${fps.toFixed(1)} fps`);

  // ── Find the effect the click spawned ────────────────────────────────────
  // By id, and the one with the most samples: idle `soft` effects from the
  // awakening machine can be in flight at the same time, and averaging two
  // effects' slopes together would blur exactly the number under test.
  const byId = new Map();
  for (const [t, d, effs] of trace) {
    for (const [id, life, maxLife] of effs) {
      if (!byId.has(id)) byId.set(id, { id, maxLife, pts: [] });
      byId.get(id).pts.push([t, d, life]);
    }
  }
  if (!byId.size) {
    throw new Error(`LIVENESS FAILED: the trace grew to ${trace.length} samples but never `
      + `saw a live prism effect (${before} before the click, ${spawned.live} after). `
      + `The click did not land on a node, or spawnEffect did not fire.`);
  }
  const eff = [...byId.values()].sort((a, b) => b.pts.length - a.pts.length)[0];
  const pts = eff.pts;
  if (pts.length < 20) throw new Error(`only ${pts.length} samples on the longest effect`);

  // Slopes from first to last sample of that effect. A straight difference,
  // not a fit: `life` is an accumulator, so the endpoints ARE the total and a
  // regression would only add a way to be wrong.
  const dLife = pts[pts.length - 1][2] - pts[0][2];
  const dMs   = pts[pts.length - 1][0] - pts[0][0];
  const dDraw = pts[pts.length - 1][1] - pts[0][1];
  const perDraw = dLife / dDraw;
  const perFrameMs = (dLife / dMs) * (1000 / 60);
  const liveMs = dMs * (eff.maxLife / Math.max(dLife, 1e-9));

  console.log(`\neffect ${eff.id} — maxLife ${eff.maxLife} authored frames `
    + `(${(eff.maxLife * 1000 / 60 / 1000).toFixed(2)}s authored)`);
  console.log(`  ${pts.length} samples, life ${pts[0][2].toFixed(2)} -> ${pts[pts.length - 1][2].toFixed(2)} `
    + `over ${dDraw} draws / ${dMs.toFixed(0)}ms`);
  console.log(`\n  d(life)/d(draw)        = ${perDraw.toFixed(4)}   (1.0 => FRAME-COUNTED)`);
  console.log(`  d(life)/d(ms)*16.667   = ${perFrameMs.toFixed(4)}   (1.0 => CLOCK-DRIVEN)`);
  console.log(`\n  extrapolated full life = ${(liveMs / 1000).toFixed(2)}s   `
    + `(authored ${(eff.maxLife / 60).toFixed(2)}s)`);

  // ── The gate ─────────────────────────────────────────────────────────────
  if (Math.abs(fps - 60) < RATE_MARGIN) {
    console.log(`\nINCONCLUSIVE: ${fps.toFixed(1)} fps is within ${RATE_MARGIN} of 60, where both `
      + `hypotheses predict 1.0. Re-run under a different render rate.`);
    process.exitCode = 2;
  } else {
    const frameCounted = Math.abs(perDraw - 1) < 0.05;
    const clockDriven  = Math.abs(perFrameMs - 1) < 0.10;
    console.log(`\nVERDICT at ${fps.toFixed(1)} fps: `
      + (frameCounted && !clockDriven ? 'FRAME-COUNTED (the bug is present)'
        : clockDriven && !frameCounted ? 'CLOCK-DRIVEN (the bug is fixed)'
          : 'AMBIGUOUS — neither slope is 1.0; read the numbers above'));
  }
} finally {
  await page.close();
}
