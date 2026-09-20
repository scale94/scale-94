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
// So this shoots pump(1) at offsets 0-8 -- inside the transit, not after it
// -- and FAILS LOUDLY if no frame contains a strimer instance, rather than
// producing confident frames of nothing.
//
// ── IT PATCHES NOTHING ─────────────────────────────────────────────────────
// The feature is real now. There is no ArtTab.jsx / SphereComposite.jsx
// string-patch here, unlike _s2layer.mjs (which probed the layer before it
// existed) and _a3bloom.mjs (which moves a build-time constant no other path
// reaches). Both of those are SOURCES TO READ for their launch / world-pinning
// / immersive-toggle / canvas-rect-read / profileAlong-describe-ascii blocks,
// carried over verbatim below -- never to be dynamically import()'d, which
// EXECUTES their patch-and-restore against this branch's rewritten regions.
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
// profileAlong/describe/ascii (carried over below, per the brief's Step 1)
// sample LUMINANCE along a known SCREEN-SPACE edge. The old throwaway probe
// had that because its ArtTab.jsx patch published ax/ay/bx/by for the one
// edge it was watching. window.__artStrimerState() does not publish screen
// coordinates for any packet, and reconstructing them here would mean
// re-deriving the rotation matrix and the physics-evolved node positions --
// exactly the "re-deriving is how the two drift" trap the brief warns about,
// this time for a simulation instead of a script block. So this rig does NOT
// call profileAlong: the Step 3 gate is done by looking at the PNGs directly,
// and the numeric sweep comes straight from window.__artStrimerState()'s own
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

// ── Also carried over verbatim from _s2layer.mjs. Not currently invoked --
// see the header note above on why this rig has no screen-space edge
// coordinates to feed them. Kept so a future pixel-domain rig does not have
// to re-derive them.
function profileAlong(png, ax, ay, bx, by, dpr, off, n = 80) {
  const { width, height, data } = png;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = Math.round((off.left + ax + (bx - ax) * t) * dpr);
    const y = Math.round((off.top + ay + (by - ay) * t) * dpr);
    let best = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const px = x + dx, py = y + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const o = (py * width + px) * 4;
        const l = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
        if (l > best) best = l;
      }
    }
    out[i] = best;
  }
  return out;
}

const RAMP = ' .:-=+*#%@';
const ascii = (p, bp) => p.map((v, i) => {
  const d = Math.max(0, v - (bp[i] ?? 0));
  return RAMP[Math.min(RAMP.length - 1, Math.round(d * (RAMP.length - 1) / 0.6))];
}).join('');

function describe(profile, baseline, frac = 0.25) {
  let pi = 0;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] - (baseline[i] ?? 0) > profile[pi] - (baseline[pi] ?? 0)) pi = i;
  }
  const lift = profile[pi] - (baseline[pi] ?? 0);
  let i = pi;
  while (i > 0 && (profile[i - 1] - (baseline[i - 1] ?? 0)) > lift * frac) i--;
  let j = pi;
  while (j < profile.length - 1 && (profile[j + 1] - (baseline[j + 1] ?? 0)) > lift * frac) j++;
  return {
    at: +(pi / (profile.length - 1)).toFixed(3),
    peak: +profile[pi].toFixed(4),
    lift: +lift.toFixed(4),
    span: +((j - i) / (profile.length - 1)).toFixed(3),
  };
}

// Silence the "declared but never used" shape of the above without deleting
// carried-over code the brief asked for verbatim; a future pixel-domain rig
// wires real input into these.
void profileAlong; void ascii; void describe;

// The clamp artStrimer.js's packetDuration enforces. Reported here as
// literals so a reader does not have to open that file to see what "hitting
// a clamp" means numerically; nothing in this rig imports or evaluates that
// module.
const DURATION_MIN_MS = 70;
const DURATION_MAX_MS = 160;
const STRIMER_MS_PER_UNIT_CURRENT = 200; // NOT changed by this script — Amendment C.

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
    for (let f = 0; f <= 8; f++) {
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
    // this sweep's f<=8 window (150ms of travel) — itself evidence the
    // packet's duration is at or past that, i.e. close to DURATION_MAX_MS.
    const dsts0 = shots[0].dsts;
    const transit = {};
    for (let k = 0; k < spawned; k++) {
      const hit = shots.findIndex(s => (s.us[k] ?? 0) >= 1);
      transit[dsts0[k]] = hit < 0 ? null : +((hit + 1) * (1000 / 60)).toFixed(1);
    }
    console.log(tag, 'transit ms:', JSON.stringify(transit));

    // The observed 3D chord per edge, straight from the app's own inputs —
    // see the Math.hypot wrap above. Reported alongside a clamp verdict:
    // "AT_MIN"/"AT_MAX" when the corresponding transit sits within one
    // frame (16.7ms) of the clamp bound, since a wrong dial is survivable
    // only because of that clamp and this is the number that says whether
    // it is doing the work.
    const FRAME_MS = 1000 / 60;
    const chordByDst = {};
    dsts0.forEach((dst, k) => {
      const raw = chords[k];
      const t = transit[dst];
      const clamp = t == null ? 'AT_MAX (never reached u=1 in 150ms)'
        : t <= DURATION_MIN_MS + FRAME_MS ? 'AT_MIN'
        : t >= DURATION_MAX_MS - FRAME_MS ? 'AT_MAX'
        : 'unclamped';
      chordByDst[dst] = { chord: +raw.toFixed(4), impliedMsAtCurrentDial: +(raw * STRIMER_MS_PER_UNIT_CURRENT).toFixed(1), observedTransitMs: t, clamp };
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
