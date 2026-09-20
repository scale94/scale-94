// _s1wake.mjs — THROWAWAY. The one measurement the strimer design forks on.
//
// THE QUESTION. The additive edge mesh renders into the trail accumulator
// (SphereComposite's BackdropPass: renderTrailFade, then gl.render(scene)), so
// anything drawn on an edge feeds back at survival = 1 - m. From source that
// is 0.28 normal / 0.68 immersive, i.e. decay constants of 0.79 and 2.59
// frames. If that arithmetic is right, a travelling head smears itself into a
// wake ~3x longer in exhibit mode than in normal, and the author's "zero
// lingering residual wash" is unreachable on this layer at ANY parameter.
//
// That is a claim about a picture derived from reading code, which on this
// project is the kind of claim that dies on checking. So: measure it.
//
// ── WHAT IT DOES ──────────────────────────────────────────────────────────
// Patches ArtTab's draw loop with a probe block guarded by `window.__strimer`
// that writes a stacked white disc travelling one edge, then shoots EVERY
// frame from the fire through well past the arrival, in both modes, at three
// stack heights. It then reads the luminance profile ALONG THAT EDGE out of
// each PNG, so the wake is measured rather than eyeballed — and the frames are
// kept so it can be eyeballed too, which is the gate that actually decides.
//
// ── WHY THE HEAD IS STACKED DISCS AND NOT A BRIGHT COLOUR ────────────────
// The 18-float instance layout CANNOT express ink above 1.0. writeHsl clamps
// s and l to [0,1], writeRgb255 divides by 255, packAlphas quantises alpha to
// a byte, and COMPOSITE_ADDITIVE emits col*topA + shadowCol*botA with every
// factor <= 1. One instance maxes at exactly 1.0 per channel. The prism
// reaches its measured 37x by stacking 770 coincident curves, and that is the
// only route to overbright that costs no layout change — so the probe uses it
// and risks nothing in a certified renderer. `stack` 2.4 means two instances
// at alpha 1 plus one at alpha 0.4.
//
// ── THE TRAP THIS SHARES WITH _a3bloom AND _nullPatch ────────────────────
// IT PATCHES TRACKED SOURCE — src/terminal/views/ArtTab.jsx — and restores in
// a `finally`. A hard kill beats the restore. RUN `git status` AFTER THIS. If
// ArtTab.jsx shows modified, `git checkout -- src/terminal/views/ArtTab.jsx`
// is the whole revert; there is nothing in the patch worth keeping.
// NEVER run this during a capture.
//
// ── WHY TIME AND NOT A FRAME COUNTER ─────────────────────────────────────
// The probe advances on performance.now(), not on a frame count. That is the
// /SCENT double-speed bug's fix — a frame counter runs at 2x on a 120Hz
// display — and it costs nothing here because determinism.mjs virtualises
// performance.now() and advances it FRAME_MS = 1000/60 per __pump. So a
// delta-time packet is bit-reproducible under the harness AND correct on real
// hardware. Confirming that is the second thing this probe establishes: `u`
// should read 0.167, 0.333, 0.500 ... on successive pumps, exactly.
//
// ── WHY THE PATCH PICKS THE EDGE AND NOT THE RIG ─────────────────────────
// The probe interpolates `proj[i]`, which is rebuilt every frame and which no
// published hook exposes. Rather than have the rig guess an index, the patch
// chooses the longest projected edge ITSELF on its first frame, holds those
// two node ids, and publishes the endpoints it drew between on every frame
// after. The sampler reads those — so the line the profile is taken along is
// by construction the line the head travelled, rotation drift included. A rig
// that recomputed the endpoints would be a second implementation of the
// probe's own geometry, which is how the two silently disagree.
//
// Usage:  node scripts/_s1wake.mjs            both modes, stacks 1/2/3
//         node scripts/_s1wake.mjs --normal   normal only
//         node scripts/_s1wake.mjs --imm      immersive only

import { readFile, writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { launch } from './cdp.mjs';
import { decodePng } from './_png.mjs';

const SRC = 'src/terminal/views/ArtTab.jsx';
const OUT = 'lookbook/wake';
const URL = 'http://localhost:5174/';

const ONLY_NORMAL = process.argv.includes('--normal');
const ONLY_IMM    = process.argv.includes('--imm');
const MODES = ONLY_IMM ? ['imm'] : ONLY_NORMAL ? ['normal'] : ['normal', 'imm'];
const STACKS = [1, 2, 3];

// The packet's transit, in ms of VIRTUAL time. 100ms at 60fps is 6 frames, the
// middle of the author's 80-120ms. Shots run to 18 frames so the tail AFTER
// arrival is in the data rather than assumed to be short — the whole question
// is what the wire looks like once the probe has stopped drawing.
const TRANSIT_MS = 100;
const SHOT_FRAMES = 18;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const SPHERE = `[...document.querySelectorAll('canvas')]
  .filter(c => c.offsetParent && !c.closest('[data-art-composite]'))
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;
const SPHERE_READY = `(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 800; })()`;
const clickByText = (p, f = 'i') => `(() => { const re = new RegExp(${JSON.stringify(p)}, ${JSON.stringify(f)});
  const b = [...document.querySelectorAll('button')].find(e => re.test(e.innerText || ''));
  if (!b) return false; b.click(); return true; })()`;

// The immersive toggle is an ICON button with no innerText at all — its label
// lives in `title`. Matching innerText alone finds nothing and the run dies
// after the normal cells, which is exactly how this failed the first time.
// Same three attributes _a3bloom matches, for the same reason.
const CLICK_IMMERSIVE = `(() => {
  const b = [...document.querySelectorAll('button')].find(e =>
    /immersive/i.test((e.innerText || '') + ' ' + (e.title || '')
      + ' ' + (e.getAttribute('aria-label') || '')));
  if (!b) return false; b.click(); return true; })()`;

// ── The patch ──────────────────────────────────────────────────────────────
// Inserted before the particle block's census read, so the head lands in `ag`
// after the prism chords — the "signal over resonance" order the design asks
// for — and before the particles, which do not overlap an edge.
//
// `u >= 1` stops the writes ENTIRELY. Everything visible on the wire after
// that frame is the accumulator, which is precisely what this measures.
const ANCHOR = '      const _pcen = nodeCensusRef.current;';
const PATCH = `      // ── PROBE (_s1wake.mjs, throwaway — see that file's header) ──────
      if (window.__strimer) {
        const _sp = window.__strimer;
        // Choose the edge ONCE, on the first frame, and hold the node ids.
        // Longest projected edge on the near hemisphere: most pixels to
        // measure the head across, and not fighting the depth fade.
        if (_sp.aId == null && es) {
          let _bl = -1;
          for (const _e of es) {
            const _i = nodes.findIndex(n => n.id === _e.aId);
            const _j = nodes.findIndex(n => n.id === _e.bId);
            if (_i < 0 || _j < 0) continue;
            const _p = proj[_i], _q = proj[_j];
            if (!_p || !_q || _p.depth < 0 || _q.depth < 0) continue;
            const _L = Math.hypot(_q.sx - _p.sx, _q.sy - _p.sy);
            if (_L > _bl) { _bl = _L; _sp.aId = _e.aId; _sp.bId = _e.bId; }
          }
          _sp.len = _bl;
        }
        const _ia = _sp.aId == null ? -1 : nodes.findIndex(n => n.id === _sp.aId);
        const _ib = _sp.bId == null ? -1 : nodes.findIndex(n => n.id === _sp.bId);
        const _pa = _ia >= 0 ? proj[_ia] : null;
        const _pb = _ib >= 0 ? proj[_ib] : null;
        const _u = (performance.now() - _sp.t0) / _sp.ms;
        _sp.u = _u;
        _sp.drawn = 0;
        if (_pa && _pb) {
          // Published EVERY frame, drawing or not: the sampler takes its
          // profile along exactly this line, so rotation drift between the
          // arm and the last shot cannot desynchronise the two.
          _sp.ax = _pa.sx; _sp.ay = _pa.sy; _sp.bx = _pb.sx; _sp.by = _pb.sy;
          if (_u >= 0 && _u < 1) {
            const _hx = _pa.sx + (_pb.sx - _pa.sx) * _u;
            const _hy = _pa.sy + (_pb.sy - _pa.sy) * _u;
            const _hr = _sp.r * ((_pa.scale + _pb.scale) * 0.5) * ink;
            const _n = Math.ceil(_sp.stack);
            for (let _k = 0; _k < _n && ag.count < MAX_ADDITIVE_EDGES; _k++) {
              writeDisc(ag.data, ag.count * EDGE_STRIDE, {
                cx: _hx, cy: _hy, rOuter: _hr,
                // lit 100 is (1,1,1) whatever the hue — a WHITE head, because
                // the knee scales all three channels equally and so can never
                // whiten a saturated one. See the design notes.
                hsl: { hue: 190, sat: 0, lit: 100 },
                alpha: Math.min(1, _sp.stack - _k),
                flags: packFlags(0, 0, 0),
              });
              ag.count++;
              _sp.drawn++;
            }
          }
        }
      }
`;

// ── Sampling a PNG along the edge ──────────────────────────────────────────
// The probe's head runs a straight line in CSS px and the shot is in device
// px, so every sample is scaled by dpr. 200 samples along A->B, each the MAX
// luminance in a 5x5 box around the point — max rather than mean because a
// 1-2px bright core sampled by a mean is diluted by its own neighbourhood and
// the thing being measured is a peak's persistence.
function profileAlong(png, ax, ay, bx, by, dpr, off, n = 200) {
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
        // Rec.709 on the 8-bit sRGB the screenshot carries, NOT decoded: the
        // question is how bright this READS, and the frames are graded by eye
        // in the same space.
        const l = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
        if (l > best) best = l;
      }
    }
    out[i] = best;
  }
  return out;
}

/**
 * Peak position (0..1 along the edge), its lift over the idle wire, and the
 * WAKE: the span BEHIND the peak still above `frac` of that lift, as a
 * fraction of the edge length.
 *
 * Measured against a per-sample baseline rather than a single number, because
 * the idle wire is not uniform — it carries the edge's own gradient, the
 * node halos at both ends and whatever the rest of the sim is doing.
 */
function describe(profile, baseline, frac = 0.25) {
  let pi = 0;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] - (baseline[i] ?? 0) > profile[pi] - (baseline[pi] ?? 0)) pi = i;
  }
  const peak = profile[pi];
  const lift = peak - (baseline[pi] ?? 0);
  let i = pi;
  while (i > 0 && (profile[i - 1] - (baseline[i - 1] ?? 0)) > lift * frac) i--;
  let j = pi;
  while (j < profile.length - 1 && (profile[j + 1] - (baseline[j + 1] ?? 0)) > lift * frac) j++;
  return {
    at: +(pi / (profile.length - 1)).toFixed(3),
    peak: +peak.toFixed(4),
    lift: +lift.toFixed(4),
    wake: +((pi - i) / (profile.length - 1)).toFixed(3),
    ahead: +((j - pi) / (profile.length - 1)).toFixed(3),
  };
}

// ── Run ────────────────────────────────────────────────────────────────────
const original = await readFile(SRC, 'utf8');
if (!original.includes(ANCHOR)) throw new Error('patch anchor not found in ' + SRC);
if (original.includes('__strimer')) throw new Error(SRC + ' already patched — check git status');

mkdirSync(OUT, { recursive: true });
const report = { transitMs: TRANSIT_MS, shotFrames: SHOT_FRAMES, runs: [] };

try {
  await writeFile(SRC, original.replace(ANCHOR, PATCH + ANCHOR), 'utf8');
  console.log('patched', SRC);

  for (const mode of MODES) {
    for (const stack of STACKS) {
      const tag = `${mode}-s${stack}`;
      // One boot per cell. Two cells in one boot would share an accumulator
      // the first cell left charged, and the tail IS the measurement.
      const page = await launch({ url: URL, width: 1520, height: 900, dpr: 1, deterministic: true });
      try {
        await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
        await sleep(2500);
        if (!await page.eval(clickByText('/CHAOS'))) throw new Error('no /CHAOS nav button');
        await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
        await sleep(4000);

        // Pin the world exactly as artBaseline and _a3bloom do, so every cell
        // is the same graph at the same rotation and the only difference
        // between two frames is the key being swept.
        await page.eval('window.__virtualize()');
        await sleep(150);
        await page.eval('window.__reseed(); window.__artHarnessReset();');
        await page.pump(240);
        await page.pump(30);

        if (mode === 'imm') {
          if (!await page.eval(CLICK_IMMERSIVE)) throw new Error('no immersive toggle');
          // The toggle is a ResizeObserver plus a React commit. Deliver it the
          // way _a3bloom does: a screenshot to force layout, a real sleep for
          // the yield, one pump for r3f, then settle. The pumped budget is
          // held identical to the normal branch — 750 either way.
          await page.screenshot({ path: `${OUT}/_settle-${tag}.png` });
          await sleep(400);
          await page.pump(1);
          await page.pump(749);
        } else {
          await page.pump(750);
        }

        // The idle wire, BEFORE the probe is armed. Every lift below is
        // measured against this frame, so the edge's own ink is not counted
        // as wake. Taken before arming so the accumulator is genuinely cold.
        const basePath = `${OUT}/${tag}-base.png`;
        await page.screenshot({ path: basePath });

        await page.eval(
          `window.__strimer = { aId: null, bId: null, t0: performance.now(),`
          + ` ms: ${TRANSIT_MS}, stack: ${stack}, r: 3 };`);
        // One pump to let the patch choose its edge and publish the endpoints
        // before any shot is taken. This frame is f0 and is shot like the rest.
        const shots = [];
        for (let f = 0; f <= SHOT_FRAMES; f++) {
          await page.pump(1);
          const path = `${OUT}/${tag}-f${String(f).padStart(2, '0')}.png`;
          await page.screenshot({ path });
          const sp = JSON.parse(await page.eval(
            'JSON.stringify((({u,drawn,ax,ay,bx,by,aId,bId,len}) =>'
            + ' ({u,drawn,ax,ay,bx,by,aId,bId,len}))(window.__strimer))'));
          shots.push({ f, path, ...sp, u: +Number(sp.u).toFixed(4) });
        }

        // THE CANVAS RECT, AND WHY THE FIRST RUN OF THIS WAS UNREADABLE.
        //
        // The probe's endpoints are in the sphere canvas's own CSS px — that
        // is the space the whole edge layer is written in — but a screenshot
        // is the WHOLE PAGE. Sampling the shot at (ax*dpr, ay*dpr) therefore
        // reads a strip of page chrome, and the first run's table duly showed
        // a "peak" that never tracked `u` and did not move when the head's
        // brightness tripled. Publish the rect and the offset stops being a
        // free parameter fitted after the fact.
        //
        // innerWidth, not the canvas width, is what the screenshot spans, so
        // it is what dpr divides.
        const res = JSON.parse(await page.eval(
          'JSON.stringify((() => { const e = window.__artEdgeState();'
          + ' const c = ' + SPHERE + '; const r = c.getBoundingClientRect();'
          + ' return { w: e.w, h: e.h, count: e.count, innerW: window.innerWidth,'
          + '   left: r.left, top: r.top, cw: r.width, ch: r.height }; })())'));

        report.runs.push({ mode, stack, basePath, res, shots });
        const last = shots[shots.length - 1];
        console.log(`${tag}: edge ${shots[0].aId}->${shots[0].bId}`
          + ` len ${Number(shots[0].len).toFixed(0)}px, u ${shots[0].u} -> ${last.u}`);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await writeFile(SRC, original, 'utf8');
  console.log('restored', SRC, '— run `git status` to confirm');
}

// ── Read the frames ────────────────────────────────────────────────────────
// Every frame is sampled along ITS OWN published endpoints, and the baseline
// along the first shot's, since the idle frame predates the probe's choice.
// The sphere rotates ~0.3px/frame, so over 19 frames the baseline is up to
// ~6px stale against the last shot — 2.4% of a 249px edge. Noted rather than
// corrected: the discriminator is drawn>0 against drawn=0, a far larger signal.
const RAMP = ' .:-=+*#%@';
const ascii = (p, bp) => p.map((v, i) => {
  const d = Math.max(0, v - (bp[i] ?? 0));
  return RAMP[Math.min(RAMP.length - 1, Math.round(d * (RAMP.length - 1) / 0.6))];
}).join('');

for (const run of report.runs) {
  const first = run.shots[0];
  const base = decodePng(await readFile(run.basePath));
  // The screenshot spans the WINDOW, not the canvas. See the rect read above.
  const dpr = base.width / run.res.innerW;
  const off = { left: run.res.left, top: run.res.top };
  run.dpr = dpr;
  const b80 = profileAlong(base, first.ax, first.ay, first.bx, first.by, dpr, off, 80);
  for (const s of run.shots) {
    const png = decodePng(await readFile(s.path));
    const p = profileAlong(png, s.ax, s.ay, s.bx, s.by, dpr, off, 80);
    Object.assign(s, describe(p, b80));
    s.ascii = ascii(p, b80);
  }
}

await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));

console.log('\n── PROFILE ALONG THE EDGE ─────────────────────────────────');
console.log('u  = packet position, 0 at A and 1 at B (>=1: probe draws NOTHING)');
console.log('at = where the brightest lift sits; it should TRACK u');
console.log('wake = span behind it still above 25% of the lift');
console.log('The bar is the LIFT over the idle wire: A on the left, B on the right.');
for (const run of report.runs) {
  console.log(`\n${run.mode} stack=${run.stack}  (dpr ${run.dpr.toFixed(3)}, `
    + `edge ${Number(run.shots[0].len).toFixed(0)}px, `
    + `canvas +${run.res.left.toFixed(0)},+${run.res.top.toFixed(0)})`);
  console.log('   f  u       dr   lift     at   wake');
  for (const s of run.shots) {
    console.log(`  ${String(s.f).padStart(2)}  ${String(s.u).padStart(6)} `
      + `${String(s.drawn).padStart(2)}  ${String(s.lift).padStart(6)}  `
      + `${String(s.at).padStart(5)}  ${String(s.wake).padStart(5)}  |${s.ascii}|`);
  }
}
console.log('\nTHE ROWS WITH drawn = 0 ARE THE ANSWER: that is the accumulator');
console.log('alone. Frames in ' + OUT + ' — LOOK AT THEM. A profile along one');
console.log('line cannot see the halo the bloom pyramid puts around the head.');
