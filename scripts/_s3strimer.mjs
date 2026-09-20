// _s3strimer.mjs — THE COMMITTED CAPTURE RIG for the strimer wavefront.
//
// Tasks 1-3 built the real thing: window.__artFireStrimer(id) spawns one
// packet per edge touching a node, they travel on an ease-out curve driven by
// performance.now(), a dim rail lights the whole edge under each, each
// terminates in a micro-ping, and the layer leaves zero residual one frame
// later. This is the only rig that can catch it.
//
// THE ASSERTION THIS SCRIPT EXISTS FOR: the existing LIVE_OFFSETS = [14, 26,
// 44] shoots long after a 6-frame packet has landed, and a wavefront that has
// already passed is not in the frame being graded. Grading an absent effect
// is the trap that cost the project a whole session on the old bloom sweep.
// So this shoots pump(1) at offsets 0-SWEEP_FRAMES -- covering the WHOLE
// transient, not just its opening -- and FAILS LOUDLY if no frame contains a
// strimer instance, rather than producing confident frames of nothing.
// SWEEP_FRAMES is derived below from DURATION_MAX_MS + PING_MS, not a bare
// literal: an earlier version of this rig stopped at f<=8 (150ms), short of
// the 227ms worst-case packet life, and as a result never once observed the
// longest edge (ceei, chord ~1.04-1.06) actually arrive -- its
// observedTransitMs came back null in both modes, and the ping's decay to
// instances:0 was never photographed either.
//
// ── IT PATCHES NOTHING ─────────────────────────────────────────────────────
// The feature is real now. There is no ArtTab.jsx / SphereComposite.jsx
// string-patch here, unlike _s2layer.mjs (which probed the layer before it
// existed) and _a3bloom.mjs (which moves a build-time constant no other path
// reaches). Both of those are SOURCES TO READ for their launch / world-pinning
// / immersive-toggle / canvas-rect-read blocks, carried over verbatim below
// -- never to be dynamically import()'d, which EXECUTES their patch-and-
// restore against this branch's rewritten regions. _s2layer.mjs also still
// holds profileAlong/describe/ascii (screen-space luminance sampling); this
// rig deleted its own dead copy of those -- see the note further down.
//
// ── THE CHORD, WITHOUT A SOURCE PATCH ──────────────────────────────────────
// The design's dial (STRIMER_MS_PER_UNIT, artStrimer.js) is chosen from the
// 3D chord between a packet's endpoints, and window.__artStrimerState()
// deliberately does not publish node world positions -- fireStrimer's `src`/
// `dst` ids are all it gives. Rather than patch ArtTab.jsx to leak `nodes`
// (forbidden -- see the header above), this wraps the ONE synchronous call
// that computes the chord: fireStrimer's target loop calls
// `Math.hypot(dst.x-src.x, dst.y-src.y, dst.z-src.z)` once per edge, and
// nothing else in the synchronous span of window.__artFireStrimer(id) calls
// Math.hypot (fireNode(id, {neighbours:false}) touches only `energy`). The
// deterministic harness never advances the clock except inside pump(), so no
// draw-loop frame -- which also calls Math.hypot, in screen space -- can
// interleave with this one page.eval. Math.hypot is swapped back in the same
// synchronous tick it was swapped out in. No tracked file changes; the app's
// own real inputs come back as plain numbers.
//
// ── WHAT THIS RIG DOES NOT DO ──────────────────────────────────────────────
// profileAlong/describe/ascii (screen-space LUMINANCE sampling along a known
// edge, per the brief's Step 1) are not carried in this file at all -- see
// the deletion note further down. The old throwaway probe had that sampler
// because its ArtTab.jsx patch published ax/ay/bx/by for the one edge it was
// watching. window.__artStrimerState() does not publish screen coordinates
// for any packet, and reconstructing them here would mean re-deriving the
// rotation matrix and the physics-evolved node positions -- exactly the
// "re-deriving is how the two drift" trap the brief warns about, this time
// for a simulation instead of a script block. So this rig does NOT sample
// pixels: the Step 3 gate is done by looking at the PNGs directly, and the
// numeric sweep comes straight from window.__artStrimerState()'s own
// `u`/`instances`, which needs no reconstruction at all.
//
// Usage:  node scripts/_s3strimer.mjs [--normal|--imm]

import { writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { launch } from './cdp.mjs';

const OUT = 'lookbook/strimer';
const URL = 'http://localhost:5174/';

const ONLY_NORMAL = process.argv.includes('--normal');
const ONLY_IMM    = process.argv.includes('--imm');
const MODES = ONLY_IMM ? ['imm'] : ONLY_NORMAL ? ['normal'] : ['normal', 'imm'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Carried over verbatim from _s2layer.mjs (read, never import()'d) ───────
const SPHERE = `[...document.querySelectorAll('canvas')]
  .filter(c => c.offsetParent && !c.closest('[data-art-composite]'))
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;
const SPHERE_READY = `(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 800; })()`;
const clickByText = (p, f = 'i') => `(() => { const re = new RegExp(${JSON.stringify(p)}, ${JSON.stringify(f)});
  const b = [...document.querySelectorAll('button')].find(e => re.test(e.innerText || ''));
  if (!b) return false; b.click(); return true; })()`;
// TRAP (Amendment C): the immersive toggle is an icon button with no
// innerText. Matching title + aria-label too is what keeps this rig alive
// past the normal cells.
const CLICK_IMMERSIVE = `(() => {
  const b = [...document.querySelectorAll('button')].find(e =>
    /immersive/i.test((e.innerText || '') + ' ' + (e.title || '')
      + ' ' + (e.getAttribute('aria-label') || '')));
  if (!b) return false; b.click(); return true; })()`;

// profileAlong/describe/ascii (screen-space luminance sampling, carried over
// from _s2layer.mjs per the plan's Step 1) were deleted here 2026-09-20.
// They were never called -- window.__artStrimerState() publishes no screen
// coordinates to feed them (see the header note above) -- and the author
// ruled against keeping them dead in a second file: _s2layer.mjs stays
// committed, so a future rig that publishes screen coordinates is one
// `git show` away from the sampler; carrying a verbatim copy here bought
// nothing but a `void profileAlong; void ascii; void describe;` line whose
// only job was silencing the unused-variable warning.

// The clamp artStrimer.js's packetDuration enforces. Reported here as
// literals so a reader does not have to open that file to see what "hitting
// a clamp" means numerically; nothing in this rig imports or evaluates that
// module.
const DURATION_MIN_MS = 70;
const DURATION_MAX_MS = 160;
const STRIMER_MS_PER_UNIT_CURRENT = 200; // NOT changed by this script — Amendment C.

// The ping's life, mirrored as literals exactly as DURATION_MIN_MS/MAX_MS
// above are — nothing in this rig imports artStrimer.js.
const PING_FRAMES = 4;
const PING_MS = PING_FRAMES * (1000 / 60);

// DERIVED, not a bare literal: worst-case packet life is the full clamped
// travel (DURATION_MAX_MS) plus the post-arrival ping (PING_MS), and pump(1)
// advances one frame (1000/60 ms) each call. Rounding up gives the fewest
// pumps that still cover the whole transient, with a frame of margin.
const SWEEP_FRAMES = Math.ceil((DURATION_MAX_MS + PING_MS) / (1000 / 60)); // 14

// ── Run ──────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const report = { durationClampMs: [DURATION_MIN_MS, DURATION_MAX_MS], runs: [] };

for (const mode of MODES) {
  const tag = mode;
  const page = await launch({ url: URL, width: 1520, height: 900, dpr: 1, deterministic: true });
  try {
    // ── World-pinning, carried over verbatim from _s2layer.mjs ─────────────
    await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
    await sleep(2500);
    if (!await page.eval(clickByText('/CHAOS'))) throw new Error('no /CHAOS nav button');
    await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
    await sleep(4000);
    await page.eval('window.__virtualize()');
    await sleep(150);
    await page.eval('window.__reseed(); window.__artHarnessReset();');
    await page.pump(240);
    await page.pump(30);

    if (mode === 'imm') {
      if (!await page.eval(CLICK_IMMERSIVE)) throw new Error('no immersive toggle');
      await page.screenshot({ path: `${OUT}/_settle-${tag}.png` });
      await sleep(400);
      await page.pump(1);
      await page.pump(749);
    } else {
      await page.pump(750);
    }

    const basePath = `${OUT}/${tag}-base.png`;
    await page.screenshot({ path: basePath });

    // A degree-4 node, from the SPHERE_ADJ census of 2026-09-20. Fired
        // through the app's own handler rather than a hover-grid click, so
    // WHICH node fired is a fact about this script and not about where
    // the grid happened to land.
    //
    // The chord evidence Amendment C asks for rides along in the SAME
    // synchronous call: fireStrimer's target loop is the only Math.hypot
    // call in window.__artFireStrimer's call graph (see the file header),
    // so wrapping it here for the span of one call captures the app's own
    // real 3D chord per edge with no source patch and no re-derived physics.
    const fireRaw = await page.eval(`(() => {
      const _chords = [];
      const _orig = Math.hypot;
      Math.hypot = (...a) => { const r = _orig(...a); _chords.push(r); return r; };
      let spawned;
      try { spawned = window.__artFireStrimer("biocoenosis"); }
      finally { Math.hypot = _orig; }
      return JSON.stringify({ spawned, chords: _chords });
    })()`);
    const { spawned, chords } = JSON.parse(fireRaw);
    if (!spawned) throw new Error('fired biocoenosis and got no packets');

    const shots = [];
    for (let f = 0; f <= SWEEP_FRAMES; f++) {
      await page.pump(1);
      const path = `${OUT}/${tag}-f${String(f).padStart(2, '0')}.png`;
      await page.screenshot({ path });
      const st = JSON.parse(await page.eval(
        'JSON.stringify(window.__artStrimerState())'));
      shots.push({ f, path, count: st.count, instances: st.instances,
        us: st.packets.map(p => p.u), dsts: st.packets.map(p => p.dst) });
    }

    // THE ASSERTION THIS SCRIPT EXISTS FOR. A transient that has already
    // passed is not in the frame being graded: the old
    // LIVE_OFFSETS = [14, 26, 44] shoots long after a 6-frame packet has
    // landed, and grading an absent effect is the trap that cost the old
    // bloom sweep a whole session. Fail loudly rather than produce
    // confident frames of nothing.
    if (!shots.some(s => s.instances > 0)) {
      throw new Error(tag + ': NO STRIMER INSTANCES IN ANY FRAME'
        + ' — the capture missed the transient');
    }

    // The observed transit, which is what sets STRIMER_MS_PER_UNIT. Each
    // packet's duration is the frame it first reached u = 1, times the
    // harness frame of 1000/60 ms. `null` means u never reached 1 inside
    // this sweep's SWEEP_FRAMES window (~250ms of travel, comfortably past
    // the 227ms worst-case packet life) — which would now mean the packet's
    // duration exceeds even DURATION_MAX_MS, not just that the window was
    // too short to see it (the earlier f<=8/150ms window's failure mode).
    const dsts0 = shots[0].dsts;
    const transit = {};
    for (let k = 0; k < spawned; k++) {
      const hit = shots.findIndex(s => (s.us[k] ?? 0) >= 1);
      transit[dsts0[k]] = hit < 0 ? null : +((hit + 1) * (1000 / 60)).toFixed(1);
    }
    console.log(tag, 'transit ms:', JSON.stringify(transit));

    // The observed 3D chord per edge, straight from the app's own inputs —
    // see the Math.hypot wrap above. `clamp` is the GROUND TRUTH verdict:
    // packetDuration() clamps via Math.min/Math.max on the EXACT raw value
    // (raw = chord * STRIMER_MS_PER_UNIT_CURRENT), so that is what `clamp`
    // must be compared against -- never the observed transit, which is
    // quantized to a 16.7ms frame and can cross a boundary the exact value
    // never does. Concretely: grayscott's implied 145.2ms is genuinely
    // below DURATION_MAX_MS (160) and never clamps, but its quantized
    // transit of 150ms sits past DURATION_MAX_MS - FRAME_MS (143.3), which
    // is why a transit-derived `clamp` mislabelled it AT_MAX. `nearBoundary`
    // keeps that transit-proximity signal under its own name -- it answers
    // a different question (did the observed frame-quantized arrival land
    // near a bound) and must never be re-merged into `clamp`.
    const FRAME_MS = 1000 / 60;
    const sweepMs = Math.round((SWEEP_FRAMES + 1) * FRAME_MS);
    const chordByDst = {};
    dsts0.forEach((dst, k) => {
      const raw = chords[k];
      const t = transit[dst];
      const impliedMsAtCurrentDial = +(raw * STRIMER_MS_PER_UNIT_CURRENT).toFixed(1);
      const clamp = impliedMsAtCurrentDial <= DURATION_MIN_MS ? 'AT_MIN'
        : impliedMsAtCurrentDial >= DURATION_MAX_MS ? 'AT_MAX'
        : 'unclamped';
      const nearBoundary = t == null ? `AT_MAX (never reached u=1 in ${sweepMs}ms)`
        : t <= DURATION_MIN_MS + FRAME_MS ? 'AT_MIN'
        : t >= DURATION_MAX_MS - FRAME_MS ? 'AT_MAX'
        : 'unclamped';
      chordByDst[dst] = { chord: +raw.toFixed(4), impliedMsAtCurrentDial, observedTransitMs: t, clamp, nearBoundary };
    });
    console.log(tag, 'chord/clamp:', JSON.stringify(chordByDst, null, 1));

    // ── Canvas-rect read, carried over verbatim in spirit from _s2layer.mjs.
    // TRAP (Amendment C): the screenshot spans the WINDOW; the sphere canvas
    // is elsewhere in it. Read the rect rather than fit it afterwards.
    const res = JSON.parse(await page.eval(
      'JSON.stringify((() => { const c = ' + SPHERE + '; const r = c.getBoundingClientRect();'
      + ' return { innerW: window.innerWidth, left: r.left, top: r.top }; })())'));

    const errs = await page.consoleErrors();
    report.runs.push({ mode, basePath, res, spawned, dsts: dsts0, shots, transit, chords: chordByDst, errs: errs.slice(0, 5) });
    console.log(`${tag}: spawned ${spawned} packets -> [${dsts0.join(', ')}]`
      + `  canvas +${res.left.toFixed(0)},+${res.top.toFixed(0)}`
      + (errs.length ? `  CONSOLE ERRORS: ${errs.length}` : '  console clean'));
  } finally {
    await page.close();
  }
}

await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));

console.log('\n── PER-FRAME INSTANCE SWEEP (u >= 1 means that packet has landed) ──');
for (const run of report.runs) {
  console.log(`\n${run.mode}  spawned ${run.spawned} -> [${run.dsts.join(', ')}]`);
  console.log('   f  instances  ' + run.dsts.map(d => d.padEnd(8)).join(' '));
  for (const s of run.shots) {
    console.log(`  ${String(s.f).padStart(2)}  ${String(s.instances).padStart(9)}  `
      + s.us.map(u => (u >= 1 ? ' arrived' : (+u.toFixed(3)).toString()).padEnd(8)).join(' '));
  }
}
console.log('\nFrames in ' + OUT + ' — LOOK AT THEM. This sweep is not the gate.');
