// Presence checks for the layers the parity gate structurally cannot see.
// A green 21/21 on these proves "no regression", never "it draws" — the same
// pass follows from deleting the layer. So: switch each one on and look.
import { launch } from './cdp.mjs';
import { decodePng } from './_png.mjs';
import {
  exergyAlpha, RIFT_ALPHA_NORMAL, RIFT_ALPHA_IMMERSIVE,
  GHOST_RGB, GHOST_COUNT, GHOST_ALPHA,
} from '../src/terminal/art/artBackground.js';
import { steadyState, fadeGain } from '../src/terminal/art/artTrail.js';
import {
  EDGE_STRIDE, EDGE_OFF, GLOW_REACH, isDisc, unpackAlphas, unpackFlags, ADDITIVE_LAYER,
} from '../src/terminal/art/SphereEdges.js';
import { CURVE_MAX_SEGMENTS } from '../src/terminal/art/artCurve.js';
import {
  resonanceGlow, RESONANCE_CORE_MID_A, RESONANCE_CORE_MID_K, RESONANCE_GLOW_SCALE,
  prismGlowWidth, PRISM_SPECTRAL_FINE, PRISM_GLOW_W, PRISM_CORE_W, PRISM_POLY_W, PRISM_SPOKE_W,
  FILAMENT_DASH, FILAMENT_CORE_W, CHIMERA_DASH,
} from '../src/terminal/art/artEdges.js';

// Every check reports through this so the run ends with a count rather than
// five paragraphs a reader has to tally by eye. A failure is a non-zero exit:
// these are the only instruments that can tell "ported" from "deleted".
const results = [];
const verdict = (name, ok) => {
  results.push({ name, ok });
  console.log(ok ? '   => RENDERS\n' : '   => NOT DETECTED\n');
};

const SPHERE = `[...document.querySelectorAll('canvas')]
  .filter(c => c.offsetParent && !c.closest('[data-art-composite]'))
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;
const READY = `(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 800; })()`;
const RECT = `(() => { const r = ${SPHERE}.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`;
const clickText = (p) => `(() => { const re = new RegExp(${JSON.stringify(p)}, 'i');
  const b = [...document.querySelectorAll('button')].find(e => re.test(e.innerText || ''));
  if (!b) return false; b.click(); return true; })()`;
// Immersive mode has no text label, only a title — and the sphere's own
// controls are icon buttons, so matching on innerText finds nothing.
const clickTitle = (frag) => `(() => { const b = [...document.querySelectorAll('button')]
  .find(e => (e.title || '').includes(${JSON.stringify(frag)}));
  if (!b) return false; b.click(); return true; })()`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Mean channel-lean inside a disc: how much the pixels there lean toward a
// given hue direction, over the black backdrop.
function lean(png, frac, pick) {
  const { width: W, height: H, data } = decodePng(png);
  const cx = W >> 1, cy = H >> 1, R = Math.min(W, H) * frac;
  let sum = 0, n = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (Math.hypot(x - cx, y - cy) > R) continue;
    const i = (y * W + x) * 4;
    sum += pick(data[i], data[i + 1], data[i + 2]); n++;
  }
  return sum / n;
}
const magenta = (r, g, b) => Math.max(0, (r + b) / 2 - g);   // 217,70,239
const gold    = (r, g, b) => Math.max(0, (r + g) / 2 - b);   // 255,215,0

// deterministic:true only INSTALLS the shim; it stays inert until
// __virtualize(). The first three checks need real time (a 4s fade, a 114 BPM
// beat, a 1s flash decay), so virtualisation is deferred to the ghost check.
const page = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900, deterministic: true });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await page.eval(clickText('/CHAOS'));
  await page.waitFor(READY, { label: 'sphere', timeoutMs: 40000 });

  const rect = await page.eval(RECT);
  const clip = { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 };

  // ── GENESIS GLOW: awakening phase 0, fades out inside ~3.8s ─────────────
  // Sample immediately, then again well after the phase gate has closed.
  let early = 0;
  for (let i = 0; i < 8; i++) { early = Math.max(early, lean(await page.screenshot({ clip }), 0.35, gold)); await sleep(180); }
  await sleep(9000);
  const late = lean(await page.screenshot({ clip }), 0.35, gold);
  console.log('GENESIS GLOW  (gold lean in the central disc)');
  console.log(`   during phase 0   ${early.toFixed(3)}`);
  console.log(`   after it closes  ${late.toFixed(3)}`);
  verdict('GENESIS GLOW', early > late + 0.15);

  // ── EXERGY PULSE: ecocide bus, never non-zero during capture ────────────
  if (!await page.eval('typeof window.__artSetEcocide === "function"')) {
    throw new Error('__artSetEcocide missing — production build?');
  }
  const off = lean(await page.screenshot({ clip }), 0.5, magenta);
  await page.eval('window.__artSetEcocide({ exergyRate: 1 })');
  await sleep(600);
  const on = lean(await page.screenshot({ clip }), 0.5, magenta);
  console.log('EXERGY PULSE  (magenta lean in the central disc)');
  console.log(`   rate 0   ${off.toFixed(3)}`);
  console.log(`   rate 1   ${on.toFixed(3)}`);
  verdict('EXERGY PULSE', on > off + 0.2);
  await page.eval('window.__artSetEcocide({ exergyRate: 0 })');
  await sleep(400);

  // ── FLASH GRID: bifurcation events only, never fired during capture ─────
  // Measured in the far side bands, well outside the sphere: the hex grid is
  // the ONLY layer that paints there, so anything else lighting up would be a
  // bug rather than a false positive. It decays over 64 frames (~1s), so the
  // screenshot has to follow the trigger immediately.
  const bands = (png) => {
    const { width: W, height: H, data } = decodePng(png);
    let sum = 0, n = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (x > W * 0.08 && x < W * 0.92) continue;
      const i = (y * W + x) * 4;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++;
    }
    return sum / n;
  };
  const quiet = bands(await page.screenshot({ clip }));

  // Right-click a node -> orthogonal bridge -> bgFlash = 0.7.
  const HOVERED = `(() => {
    const s = [...document.querySelectorAll('span')].filter(e =>
      e.style.position === 'absolute' && e.style.font && e.textContent);
    let best = null;
    for (const e of s) { const o = parseFloat(e.style.opacity || '0');
      if (o > 0.9 && (!best || o > best.o)) best = { o, t: e.textContent }; }
    return best && best.t; })()`;
  let hit = null;
  for (let r = 1; r <= 5 && !hit; r++) for (let c = 1; c <= 9 && !hit; c++) {
    const x = Math.round(rect.x + rect.w * c / 10), y = Math.round(rect.y + rect.h * r / 6);
    await page.hover(x, y); await sleep(70);
    if (await page.eval(HOVERED)) hit = { x, y };
  }
  if (!hit) throw new Error('no node found to right-click');
  await page.rightClick(hit.x, hit.y);
  let lit = 0;
  for (let i = 0; i < 4; i++) lit = Math.max(lit, bands(await page.screenshot({ clip })));

  console.log('FLASH GRID  (mean luminance in the far side bands)');
  console.log(`   quiet          ${quiet.toFixed(3)}`);
  console.log(`   after trigger  ${lit.toFixed(3)}`);
  verdict('FLASH GRID', lit > quiet + 0.3);
  await sleep(1500);   // let the flash decay back out

} finally { await page.close(); }

// ── GHOST TRAILS: last session's positions, read from IndexedDB ───────────
// Empty in a fresh harness profile, so this layer never draws during capture.
//
// Runs in its OWN page, and that is load-bearing: driven from the session
// above, __virtualize() lands after ~20s of real rAF and pump() then fails to
// advance the draw loop at all — measured as two byte-identical screenshots.
//
// THREE MORE WAYS THIS CHECK CAN LIE, all of them met while writing it:
//   1. Mean blue-lean over the sphere is ~65x too coarse — the layer
//      contributes 0.008 against ~0.5 of animation noise, so it reports
//      "not detected" whether the layer works or not.
//   2. Pixel-diffing two deterministic runs drowns in the harness's own
//      41k-changed-pixel reproducibility floor.
//   3. Seeding arbitrary positions gets them BACK-FACE CULLED (measured rz
//      -1.497 against the -0.3 threshold) — the layer correctly draws nothing
//      and the check reads it as a failure.
//
// So: freeze the clock, pin the rotation with __artHarnessReset (rx=0.18,
// ry=0), stack all 31 ghosts at model (0,0,1) which is then reliably
// front-facing, and look for the ghost colour itself.
//
// ── THE FOURTH WAY, and the one that made this check FLAKY ────────────────
// The statistic used to be the closest approach to (180,180,220) anywhere in
// the frame. A MINIMUM over 700k pixels is not a property of the ghost layer:
// it is however close the single luckiest unrelated pixel happens to sit to
// that colour. The boot fingerprint is not deterministic — 8 relaunches, 8
// fingerprints — so it was a lottery ticket, and it was drawn three pumps
// after __virtualize() lands on ~6.5s of REAL-time rAF. Measured over 8
// isolated runs of the old block: the OFF reading ranged 8.7 to 72.9, an 8x
// spread on the denominator of its own verdict, while the ON reading came in
// at 2.2, 5.1, 5.8, 6.0, 6.4, 7.0, 7.8 — and then 19.3, one false red in
// eight against its `< 12` arm. The pair recorded in the old comment (15.4,
// 7.5) is inside neither population.
//
// Three pumps was the other half of it. The frame is nowhere near settled
// there: the disc's own neighbourhood measured (8,8,6) at pump 3 and
// (191,245,240) at pump 30 in the same session. Every other check in this file
// pumps 240 after __artHarnessReset. This one pumped 3.
//
// So the frame-wide minimum is gone. The layer publishes WHERE it drew —
// __artBgState().ghostFirst is the first ghost's (sx, sy, radius, alpha) as
// the shader received it — and the check reads that and looks THERE.
//   - Read on the MEASURED frame, never the reset frame. The sphere keeps
//     rotating under pump(), measured 0.44 px/frame, so by frame 240 the disc
//     is ~79 px from where the pinned rotation put it. Sampling the reset
//     position would read background and call the layer dead.
//   - The statistic is the mean distance to the ghost colour over the disc's
//     core — 0.6 of the published radius, 6-7 px — against the same disc in a
//     frame where the layer had nothing to draw.
//
// ── It asserts the layer's OPACITY, not its brightness ────────────────────
// Source-over toward a fixed colour is a contraction toward that colour. 31
// stacked passes at the published alpha compound to C = 1 - (1-a)^31, the
// trail accumulator lifts that to steadyState(C, m), and every pixel's
// distance to (180,180,220) is multiplied by exactly 1 - steadyState(C, m),
// WHATEVER WAS UNDERNEATH. That is the number asserted here, and it is why
// this check now has no absolute margin at all: an absolute threshold is a
// claim about the backdrop, and the backdrop is the lottery. Both of the
// previous criteria were absolute (`gOn < gOff - 10`, then `gOn < 12`) and
// both called a healthy layer broken.
//
// Being background-invariant by construction is what takes the boot
// fingerprint out of the reading. Measured over 6 runs: 0.1300-0.1455 against
// a model 0.1230, i.e. +5.8% to +18.4%. The residual is small, one-signed and
// not isolated — the 2D canvas composites over this disc and the bloom pass
// reaches it — so it is bounded rather than tuned away.
//
// ── Validated against its own null ────────────────────────────────────────
// The null is the ghost inkOver, and only that, multiplied by zero in the
// fragment shader. Every uniform is still written, so the live count, the
// position, the radius and the alpha are byte-identical across the two builds
// and only the pixels differ:
//
//        live layer (6 runs)   pull 0.1300-0.1455    dev  +5.8% to +18.4%
//        ghost ink discarded   pull 0.9988-1.0027    dev  +712% to +716%
//
// The populations do not overlap. GHOST_TOL 0.35 brackets the live one with
// room at both ends and still leaves the band's top 6x under the worst null.
//
// ── And the two frames have to be COMPARABLE ──────────────────────────────
// The ratio is taken across two separate 240-frame sessions, so the check also
// measures the annulus from 5 to 10 radii about the same centre — same
// neighbourhood, ~1275 px, no ghost ink in it — in both. That read
// 0.9980-1.0010 across all twelve runs above, live and null alike. If the two
// frames ever stop being comparable there the denominator is not a control and
// no number on this row means anything, so it is part of the verdict rather
// than a note.
const GL_READY = `(() => { const w = document.querySelector('[data-art-composite]');
  const g = w && w.querySelector('canvas'); const c = ${SPHERE};
  return !!g && !!c && g.width >= c.clientWidth * 0.9 && g.width > 800; })()`;

const GHOST_SETTLE = 240;     // frames — the settle count the other checks use
const GHOST_CORE_F = 0.6;     // fraction of the published radius sampled
const GHOST_TOL = 0.35;
// The core runs 6-7 px, so this is a floor and not a threshold: it exists so a
// region decoded to nowhere reads as a FAILURE rather than as a mean over an
// empty sample, which is the guard the two blocks below also carry.
const GHOST_MIN_PX = 4;
const GHOST_CTL_TOL = 0.05;   // measured 0.9980-1.0010 over twelve runs
const GHOST_STACK = `window.__artSetGhosts(Array.from({length:${GHOST_COUNT * 3}},(_,i)=> i%3===2 ? 1 : 0))`;

// Mean distance to the ghost colour over an annulus [r0, r1] about (cx, cy).
function ghostRing(img, cx, cy, r0, r1) {
  const { width: W, height: H, data } = img;
  const [GR, GG, GB] = GHOST_RGB;
  let sum = 0, n = 0;
  for (let y = Math.max(0, Math.floor(cy - r1)); y <= Math.min(H - 1, Math.ceil(cy + r1)); y++)
    for (let x = Math.max(0, Math.floor(cx - r1)); x <= Math.min(W - 1, Math.ceil(cx + r1)); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < r0 || d > r1) continue;
      const i = (y * W + x) * 4;
      sum += Math.hypot(data[i] - GR, data[i + 1] - GG, data[i + 2] - GB); n++;
    }
  return { mean: sum / (n || 1), n };
}
const ghostDisc = (img, cx, cy, rad) => ghostRing(img, cx, cy, -1, rad);

const g2 = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900, deterministic: true });
try {
  await g2.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await g2.eval(clickText('/CHAOS'));
  await g2.waitFor(READY, { label: 'sphere', timeoutMs: 40000 });
  await g2.waitFor(GL_READY, { label: 'GL sized', timeoutMs: 40000 });
  await sleep(4000);
  await g2.eval('window.__virtualize()');
  await sleep(150);

  const r2 = await g2.eval(RECT);
  const clip2 = { x: r2.x, y: r2.y, width: r2.w, height: r2.h, scale: 1 };

  // Two sessions from the same reset, the same length, differing in one bit:
  // whether the ghost layer has anything to draw.
  const sample = async (setup) => {
    await g2.eval(`window.__reseed(); window.__artHarnessReset(); ${setup}`);
    await g2.pump(GHOST_SETTLE);
    const img = decodePng(await g2.screenshot({ clip: clip2 }));
    const st = JSON.parse(await g2.eval('JSON.stringify(window.__artBgState())'));
    return { img, st };
  };
  const off = await sample('window.__artSetGhosts(null)');
  const on = await sample(GHOST_STACK);

  const [gx, gy, grad, ga] = on.st.ghostFirst;
  const live = on.st.ghostsLive;
  const m = on.st.rift.a;
  const dOn = ghostDisc(on.img, gx, gy, grad * GHOST_CORE_F);
  const dOff = ghostDisc(off.img, gx, gy, grad * GHOST_CORE_F);
  const cOn = ghostRing(on.img, gx, gy, grad * 5, grad * 10);
  const cOff = ghostRing(off.img, gx, gy, grad * 5, grad * 10);

  const pull = dOn.mean / dOff.mean;
  const cover = steadyState(1 - (1 - ga) ** GHOST_COUNT, m);
  const want = 1 - cover;
  const dev = pull / want - 1;
  const ctl = cOn.mean / cOff.mean;

  // `want` is computed from the alpha the page itself published, which is the
  // self-fulfilling shape the TRAIL ACCUMULATION block below refuses: an alpha
  // of ~0 would make `want` ~1 and the null would sail through. The stack is
  // seeded at model (0,0,1) against a pinned rotation, so its depth stays well
  // front-facing — measured rz 0.812 at frame 240 — and this floor is a guard
  // on the arithmetic, not a measurement of the layer.
  const alphaOk = ga >= GHOST_ALPHA * 0.5;
  const bandOk = dOn.n >= GHOST_MIN_PX;
  const ctlOk = Math.abs(ctl - 1) <= GHOST_CTL_TOL;

  console.log('GHOST TRAILS  (the published disc, against the same disc with the layer off)');
  console.log(`   ${live}/${GHOST_COUNT} slots live   disc r${grad.toFixed(2)} at ${gx.toFixed(1)},${gy.toFixed(1)}`
    + `   alpha ${ga.toFixed(4)}${alphaOk ? '' : ' — TOO FAINT TO PREDICT FROM'}   m ${m}`);
  console.log(`   core ${dOn.n}px   no session ${dOff.mean.toFixed(1)}   31 stacked ${dOn.mean.toFixed(1)}`
    + (bandOk ? '' : `   SAMPLE UNDER ${GHOST_MIN_PX}px — not a measurement`));
  console.log(`   pull ${pull.toFixed(4)}   expected ${want.toFixed(4)} (coverage ${cover.toFixed(4)})`
    + `   dev ${(dev * 100).toFixed(1)}% (tol ${(GHOST_TOL * 100).toFixed(0)}%)`);
  console.log(`   frames comparable off the disc   ${cOff.mean.toFixed(1)} -> ${cOn.mean.toFixed(1)}`
    + `   ratio ${ctl.toFixed(4)} (${cOn.n}px)` + (ctlOk ? '' : '   NOT COMPARABLE — the ratio above is not a control'));
  verdict('GHOST TRAILS',
    live === GHOST_COUNT && alphaOk && bandOk && ctlOk && Math.abs(dev) <= GHOST_TOL);
} finally { await g2.close(); }

// ── TRAIL ACCUMULATION: the GL layers' frame-to-frame ink ─────────────────
// The last four checks each ask "does this layer paint". This one asks whether
// what any of them paints SURVIVES INTO THE NEXT FRAME. The 2D canvas clears
// with `destination-out` rgba(0,0,0,m) — a partial alpha erase — so a layer
// redrawn every frame settles well above the alpha it is drawn with. A layer
// that moved onto the GPU drew into a target that was fully rewritten each
// frame and lost that silently: no error, no missing geometry, just less light.
// The 32x18 comparator scored a measured 22% edge-ink loss as 21/21 green.
//
// What is distinctive is not brightness — a wrong constant is also brighter —
// but that ink must RISE over the first frames after a layer switches on and
// then settle, at a rate set by the mode's own clear alpha.
//
// ── Why not whole-frame ink ────────────────────────────────────────────────
// The obvious metric is the ratio of frame ink at n=30 to n=1, against
// fadeGain(m). It cannot work here. The rift base is deliberately NOT in the
// accumulator (SphereComposite adds it in the screen pass, `ink.rgb +
// uRift*(1-ink.a)`, so the clear colour can never compound), and neither is the
// 2D canvas, which never lost its accumulation and is most of the frame's ink.
// Both are large constants that do not rise, and they drag any whole-frame
// ratio toward 1.0 whatever the accumulator is doing.
//
// So the metric is a DIFFERENCE against the same frame with the layer off. One
// layer is switched on, and every constant — rift base, 2D canvas, the other GL
// layers, bloom, vignette — subtracts out.
//
// ── Why the exergy pulse is the probe ─────────────────────────────────────
// It is the only migrated layer that is (a) a clean step function of a hook the
// harness owns, with no easing and no time term, (b) large in area, and (c)
// drawn at a genuinely SMALL alpha. That last one is not optional. The gain is
// `steadyState(a, m)/a = 1/(1 - (1-m)(1-a))`, and `fadeGain(m) = 1/m` is only
// its a -> 0 limit. The stacked-ghost configuration the check above uses reaches
// alpha 0.89, where the gain is 1.08 and there is nothing to see.
//
// ── The number this asserts is a BOUND, not the expectation ───────────────
// The pulse is a gradient: exergyAlpha(1) = 0.06 at the centre, falling to 0 at
// the rim. The gain 1/(1 - (1-m)(1-a)) RISES as a falls, so the value asserted
// here — computed at the centre alpha — is the SMALLEST gain anywhere on the
// disc, i.e. a strict lower bound on what the whole pulse should show.
//
//        immersive  m=0.32   g(0.06) = 2.772   g(0) = fadeGain = 3.125
//        normal     m=0.72   g(0.06) = 1.357   g(0) = fadeGain = 1.389
//
// The honest expectation is the ink-weighted average over the gradient. With
// a(u) = 0.06u, u = 1 - t, first-frame ink ∝ u², disc area element ∝ (1-u)du:
//
//   R(m) = ∫₀¹ u²(1-u)·g(0.06u) du ÷ ∫₀¹ u²(1-u) du       (denominator = 1/12)
//   R(0.32) = 0.2420 / 0.08333 = 2.905        R(0.72) = 1.370
//
// so the model says immersive should read 2.90, bounded below by 2.772.
//
// MEASURED: immersive 2.675-2.723 over six runs — 6-8% under the model and
// 1.8-3.5% under its own lower bound. Normal 1.386-1.408, i.e. 1.2-2.8% OVER its
// 1.370. The model is therefore violated in immersive, and this is deliberately
// not tuned away:
//
//   - 8-bit quantisation moves the measurement toward the centre bound. Ink is
//     read from a quantised composite, and over most of the pulse's area the
//     per-pixel first-frame value is order ONE BYTE. Where it rounds to 0 the
//     faint outer annulus — precisely the high-gain, small-a region — never
//     enters either frame, which drops the expectation from 2.90 toward 2.772.
//   - The same rounding also biases the RATIO DOWN. Round-to-nearest inflates a
//     0.5-1.5-byte frame-1 pixel proportionally more than its ~2.9x larger
//     frame-30 counterpart, so s1 is lifted relative to s30. That is the leading
//     candidate for the residual 3.5% below the bound; the pulse's centre also
//     lands on the brightest part of the composite, where channel saturation
//     clips the magenta lean at frame 30 and not at frame 1.
//
// Neither is measured here, and until one of them is, the number this check
// defends is the SHAPE — immersive near 2.7-3.1 against normal near 1.36-1.41,
// a separation of 1.90-1.94x measured against 2.04-2.12x predicted — not a
// 3-digit constant. Hence TOLERANCE 15%, bracketing [2.675, 2.905] with room, and
// hence the fadeGain column printed beside it rather than asserted on: "within
// 15% of fadeGain(m)" (the plan's rule) passes immersive by 0.7 percentage
// points, which is a coin flip rather than a gate.
//
// IF THIS NUMBER MOVES, SUSPECT THE BUFFER FORMAT FIRST. Switching the
// accumulator to HalfFloatType — a one-token change, already on the backlog for
// the OLED banding — removes the quantisation floor and should move immersive UP
// toward 2.90. That would be the model being satisfied, not a regression.
//
// ── Both modes, and the modes must be DIFFERENT ───────────────────────────
// `survival` is read per-frame from the tint the 2D canvas erased with
// (`state.rift.a`). Hard-coding it to either mode's value still passes in that
// mode. Running both is 5 seconds and makes that failure visible.
//
// But reading `m` from the page and computing `expected` from that same read is
// self-fulfilling: if the immersive toggle does not engage, m stays 0.72,
// expected becomes 1.357, the ratio reads ~1.39 and the row passes — labelled
// `immersive`, having never once exercised the exhibit mode. So each row also
// asserts the m it EXPECTED for its mode, and the immersive row asserts that the
// sphere actually reached the viewport. A green row now means the mode ran.
//
// ── The check validates its own instrument ────────────────────────────────
// The virtual clock advances one frame per pump, so the sim is not frozen and
// the frame drifts underneath the measurement. That drift is measured over an
// identical 30-frame window with the layer off, and printed as a percentage of
// the signal. Measured 0.13-0.58% over six runs, against MAX_DRIFT 2%. If that
// ever stops being true the ratio means nothing, so it is part of the verdict
// rather than a note.
const EXERGY_RATE = 1;
const PULSE_ALPHA = exergyAlpha(EXERGY_RATE);
const TOLERANCE = 0.15;
// |drift| as a fraction of the first frame's signal. Drift does NOT cancel in
// the ratio — `s30` absorbs the whole 30-frame drift against `off1` while `s1`
// absorbs about 1/30 of it — so at the old 0.10 an allowed drift could eat two
// thirds of the 0.15 tolerance budget on its own. Measured drift is 0.13-0.58%,
// so 0.02 still leaves 3.4x headroom over the worst reading yet.
const MAX_DRIFT = 0.02;
// The sphere must fill this fraction of the viewport for a row to be allowed to
// call itself immersive.
const IMMERSIVE_MIN = 0.98;

// Summed magenta lean over the frame. Summed, not averaged: the pulse is a
// broad faint gradient, and a mean over the disc divides its signal by the
// dark majority — the identical failure that made the first ghost check 65x
// too coarse to see its own layer.
const magentaInk = (png) => {
  const { width: W, height: H, data } = decodePng(png);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += magenta(data[i], data[i + 1], data[i + 2]);
  return sum;
};

const t3 = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900, deterministic: true });
try {
  await t3.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await t3.eval(clickText('/CHAOS'));
  await t3.waitFor(READY, { label: 'sphere', timeoutMs: 40000 });
  await t3.waitFor(GL_READY, { label: 'GL sized', timeoutMs: 40000 });
  await sleep(4000);
  await t3.eval('window.__virtualize()');
  await sleep(150);
  await t3.eval('window.__reseed(); window.__artHarnessReset();');
  await t3.pump(240);

  const rectClip = async () => {
    const r = await t3.eval(RECT);
    return { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 };
  };
  const viewport = await t3.eval('({ w: window.innerWidth, h: window.innerHeight })');

  const riseIn = async (label, wantM) => {
    const clip = await rectClip();
    const shot = async () => magentaInk(await t3.screenshot({ clip }));
    const m = JSON.parse(await t3.eval('JSON.stringify(window.__artBgState())')).rift.a;

    // Two frames 30 apart with the layer OFF: the drift control.
    await t3.eval(`window.__artSetEcocide({ exergyRate: 0 })`);
    await t3.pump(45);
    const off0 = await shot();
    await t3.pump(30);
    const off1 = await shot();

    // Switch it on, and read the first accumulated frame and the settled one.
    await t3.eval(`window.__artSetEcocide({ exergyRate: ${EXERGY_RATE} })`);
    await t3.pump(1);
    const on1 = await shot();
    await t3.pump(29);
    const on30 = await shot();
    await t3.eval('window.__artSetEcocide({ exergyRate: 0 })');
    await t3.pump(60);

    const s1 = on1 - off1, s30 = on30 - off1;
    const expected = steadyState(PULSE_ALPHA, m) / PULSE_ALPHA;
    return {
      label, m, wantM, s1, s30, expected,
      w: Math.round(clip.width), h: Math.round(clip.height),
      size: `${Math.round(clip.width)}x${Math.round(clip.height)}`,
      ratio: s30 / s1,
      drift: Math.abs(off1 - off0) / Math.abs(s1),
    };
  };

  const rows = [await riseIn('normal', RIFT_ALPHA_NORMAL)];
  if (!await t3.eval(clickTitle('Immersive mode'))) throw new Error('no immersive button');
  // The immersive resize is delivered by the screenshot's own forced layout, not
  // by pumping — see artBaseline.mjs. Without the throwaway capture the trail
  // targets are reallocated (emptied) on the frame after the real one.
  await t3.pump(600);
  await t3.screenshot({ clip: await rectClip() });
  await t3.pump(150);
  rows.push(await riseIn('immersive', RIFT_ALPHA_IMMERSIVE));

  console.log(`TRAIL ACCUMULATION  (exergy pulse ink at frame 30 / frame 1, alpha ${PULSE_ALPHA})`);
  let ok = true;
  for (const r of rows) {
    const dev = r.ratio / r.expected - 1;
    const modeOk = r.m === r.wantM;
    const pass = Math.abs(dev) <= TOLERANCE && r.drift <= MAX_DRIFT && r.s1 > 0 && modeOk;
    if (!pass) ok = false;
    console.log(`   ${r.label.padEnd(10)} ${r.size.padEnd(10)} m=${r.m}`
      + (modeOk ? '' : `   MODE NEVER ENGAGED — expected m=${r.wantM}`));
    console.log(`      ink f1 ${r.s1.toFixed(0).padStart(10)}   f30 ${r.s30.toFixed(0).padStart(10)}`
      + `   ratio ${r.ratio.toFixed(3)}`);
    console.log(`      expected ${r.expected.toFixed(3)} (fadeGain ${fadeGain(r.m).toFixed(3)})`
      + `   dev ${(dev * 100).toFixed(1)}%   idle drift ${(r.drift * 100).toFixed(2)}% of f1`
      + `   ${pass ? 'ok' : 'FAIL'}`);
  }

  // Cross-row: the two rows must describe two different modes. `expected` is
  // computed from the same `m` the row read back, so a row that silently stayed
  // in normal mode agrees with itself perfectly. What it cannot fake is being
  // DIFFERENT from the other row, or filling the screen.
  const [norm, imm] = rows;
  const distinct = imm.m !== norm.m;
  const grew = imm.w > norm.w && imm.h > norm.h;
  const fills = imm.w >= viewport.w * IMMERSIVE_MIN && imm.h >= viewport.h * IMMERSIVE_MIN;
  console.log(`   exhibit mode   m ${norm.m} -> ${imm.m} ${distinct ? 'distinct' : 'IDENTICAL — the toggle did nothing'}`
    + `   ·   sphere ${norm.size} -> ${imm.size} ${grew ? 'grew' : 'DID NOT GROW'}`
    + `   ·   viewport ${viewport.w}x${viewport.h} ${fills ? 'filled' : 'NOT FILLED — letterbox, see 31bff8a'}`);
  if (!(distinct && grew && fills)) ok = false;

  verdict('TRAIL ACCUMULATION', ok);
} finally { await t3.close(); }

// ── PULSE RINGS: the travelling disc on a live cascade ────────────────────
// The parity comparator cannot see this layer AT ALL, and not because it is
// small. MEASURED: at the `fired-cascade` capture state — the one state in the
// twenty-one that exists to catch a cascade — `window.__artEdgeState().rings`
// is 0. The pulses are set a further ~10 frames later and are gone ~60 frames
// after that, so every stored frame in every baseline directory was taken with
// this layer off screen. A green comparator row for the rings is therefore
// evidence of nothing, in either direction.
//
// So this check fires a cascade itself and looks at the discs.
//
// ── The control has to be a place the STROKE also is ──────────────────────
// A ring rides ON its edge, and the edge widens on the very frame the ring
// appears: lineWidth carries a `+ pulse * 1.8` term and the gradient a
// `+ pulse * 0.40` alpha boost. So "brighter here than in the surrounding
// annulus" is not evidence — the fattened stroke passes through the middle of
// the disc and covers ~50% of it against ~7% of an annulus, which fakes an
// 8-9x ratio on its own.
//
// Two things separate the disc from the stroke:
//   1. MASK THE STROKE OUT. Only pixels at |perpendicular offset| >= the full
//      edge width are sampled. The stroke's half-width is half of that, so the
//      band is clear of it and of its antialiasing, while the disc — radius
//      4-5.5px against a 3-4px stroke — still reaches there.
//   2. CONTROL FURTHER ALONG THE SAME EDGE, 5 radii away, with the same mask.
//      Same stroke, same width, same pulse boost, same bloom neighbourhood, no
//      disc.
//
// The side matters. An edge is not symmetric about the ring — measured with the
// discs suppressed, the two flanks read 12.8 and 22.7 — so the check picks the
// flank by the ring's own MOTION (nearest ring in the previous frame) and
// controls against the LEADING one, never whichever happens to be darker.
//
// ── The instrument was validated against its own null ─────────────────────
// A `discard` on the disc branch of EDGE_FRAG, everything else untouched:
//
//        layer live      ring 34.3-35.2   control 12.9-15.2   ratio 2.30-2.67
//        disc discarded  ring 15.3        control 12.8        ratio 1.20
//
// Note the null still publishes rings=3. State and pixels are separate
// questions and this asserts on both. Thresholds sit between the two measured
// populations with headroom on each side: 35% above the worst live run, 42%
// above the null.
const RING_RATIO = 1.7;
const RING_EXCESS = 10;     // luminance units, 0-255. Null measured 2.5, live 19.7-21.8.

// Mean luminance over the part of a disc lying clear of the edge stroke.
function maskedMean(img, cx, cy, rad, nx, ny, band) {
  const { width: W, height: H, data } = img;
  let sum = 0, n = 0;
  for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(H - 1, Math.ceil(cy + rad)); y++)
    for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(W - 1, Math.ceil(cx + rad)); x++) {
      if (Math.hypot(x - cx, y - cy) > rad) continue;
      if (Math.abs((x - cx) * nx + (y - cy) * ny) < band) continue;
      const i = (y * W + x) * 4;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++;
    }
  return { mean: sum / (n || 1), n };
}

// The rings published for this frame, each with the edge it belongs to. A ring
// is the instance AFTER its own edge (that interleave is what keeps the depth
// sort honest) and is flagged by a negative width — see SphereEdges.js.
//
// Nothing about the layout or the sign rule is restated here: EDGE_STRIDE and
// EDGE_OFF give the offsets and `isDisc()` gives the discriminator, all three
// from the module that packs the buffer and whose shader reads it. This used to
// spell the test `w >= 0` and the offset `14` itself, and the copy had already
// drifted — `isDisc` is `<= 0` (the shader's `step`), so an instance of width
// exactly 0 was an edge here and a disc on the GPU.
// Bounded by `discStart`, the index the WRITER publishes as the first disc
// that is not a pulse ring. From step 5 the node halos and cores live in this
// same buffer and are discs by the same sign rule, so an unbounded scan finds
// 62 of them and calls them rings — measured: 129 motion-matched samples over
// 79640px instead of 39 over 207px, and the check collapsed to ratio 1.46 on a
// frame whose rings were perfectly fine. Falls back to `count` so this still
// runs against a build that predates the field.
function ringsOf(s) {
  const out = [];
  const end = s.discStart ?? s.count;
  for (let i = 1; i < end; i++) {
    const o = i * EDGE_STRIDE, w = s.instances[o + EDGE_OFF.width];
    if (!isDisc(w)) continue;
    const e = (i - 1) * EDGE_STRIDE;
    out.push({
      x: s.instances[o + EDGE_OFF.ax], y: s.instances[o + EDGE_OFF.ay], r: Math.abs(w) / 2,
      edgeWidth: s.instances[e + EDGE_OFF.width],
    });
  }
  return out;
}

const r4 = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900, deterministic: true });
try {
  await r4.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await r4.eval(clickText('/CHAOS'));
  await r4.waitFor(READY, { label: 'sphere', timeoutMs: 40000 });
  await r4.waitFor(GL_READY, { label: 'GL sized', timeoutMs: 40000 });
  await sleep(4000);
  await r4.eval('window.__virtualize()');
  await sleep(150);
  await r4.eval('window.__reseed(); window.__artHarnessReset();');
  await r4.pump(240);

  const rect = await r4.eval(RECT);
  // The instance buffer's coordinates are the 2D canvas's own CSS px, so the
  // clip's top-left IS its origin and no offset is needed. (Subtracting the
  // viewport rect instead moved every sample ~250px and read pure background.)
  const clip = { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 };

  // (The flash check's HOVERED is scoped to its own block.)
  const HOVERED_LABEL = `(() => {
    const s = [...document.querySelectorAll('span')].filter(e =>
      e.style.position === 'absolute' && e.style.font && e.textContent);
    let best = null;
    for (const e of s) { const o = parseFloat(e.style.opacity || '0');
      if (o > 0.9 && (!best || o > best.o)) best = { o, t: e.textContent }; }
    return best && best.t; })()`;
  let hit = null;
  for (let row = 1; row <= 5 && !hit; row++) for (let c = 1; c <= 9 && !hit; c++) {
    const x = Math.round(rect.x + rect.w * c / 10), y = Math.round(rect.y + rect.h * row / 6);
    await r4.hover(x, y); await sleep(70); await r4.pump(2);
    if (await r4.eval(HOVERED_LABEL)) hit = { x, y };
  }
  console.log('PULSE RINGS  (masked disc luminance vs the same mask further along the edge)');
  // Not a throw. This check is the LAST block, and the try/finally around it
  // closes the browser without catching — so an escaping error here aborted the
  // script before the tally printed, taking the five preceding checks' verdicts
  // out of the output with it. A harness that cannot find a node to fire has
  // failed to measure the layer, which is one failure among six, not a reason
  // to publish nothing.
  if (!hit) {
    console.log('   NO NODE FOUND TO FIRE — the 5x9 hover sweep matched no label,');
    console.log('   so no cascade was started and the rings were never exercised.');
    verdict('PULSE RINGS', false);
  } else {
    await r4.click(hit.x, hit.y);
    await sleep(800);              // absorb the kernel run, costing zero frames

    const acc = { on: [0, 0], ahead: [0, 0] };
    const add = (k, m) => { acc[k][0] += m.mean * m.n; acc[k][1] += m.n; };
    let frames = 0, instances = 0, matched = 0, prev = [];
    for (let f = 1; f <= 90 && frames < 14; f++) {
      await r4.pump(1);
      const s = JSON.parse(await r4.eval('JSON.stringify(window.__artEdgeState())'));
      if (!s.rings) { prev = []; continue; }
      const img = decodePng(await r4.screenshot({ clip }));
      const now = ringsOf(s);
      frames++; instances += s.rings;
      for (const g of now) {
        let bd = 30, best = null;
        for (const p of prev) { const d = Math.hypot(p.x - g.x, p.y - g.y); if (d < bd) { bd = d; best = p; } }
        if (!best || bd < 0.5) continue;      // first frame, or not yet moving
        matched++;
        const mx = (g.x - best.x) / bd, my = (g.y - best.y) / bd;
        const band = Math.max(g.edgeWidth, 1.5), rad = g.r * 0.9, off = g.r * 5;
        add('on',    maskedMean(img, g.x, g.y, rad, -my, mx, band));
        add('ahead', maskedMean(img, g.x + mx * off, g.y + my * off, rad, -my, mx, band));
      }
      prev = now;
    }
    const mean = (k) => acc[k][0] / (acc[k][1] || 1);
    const ratio = mean('on') / Math.max(mean('ahead'), 0.5);
    const excess = mean('on') - mean('ahead');

    console.log(`   frames with rings ${frames}   ring instances ${instances}   motion-matched ${matched}`);
    console.log(`   ring    ${mean('on').toFixed(2)}   (${acc.on[1]} px sampled)`);
    console.log(`   control ${mean('ahead').toFixed(2)}   (${acc.ahead[1]} px sampled)`);
    console.log(`   excess ${excess.toFixed(2)} (need ${RING_EXCESS})   ratio ${ratio.toFixed(2)} (need ${RING_RATIO})`);
    // frames > 0 is not a formality: a run that catches no live pulse must FAIL,
    // not pass by measuring nothing. That is the exact way this project has
    // reported a working layer green six times.
    verdict('PULSE RINGS', frames > 0 && matched >= 8 && ratio >= RING_RATIO && excess >= RING_EXCESS);
  }
} finally { await r4.close(); }

// ── RESONANCE EDGE: the shift-click coalescence bar ───────────────────────
// The comparator cannot see this layer AT ALL, and unlike the rings there is no
// argument to have about it: no capture state arms resonance mode, so DELETING
// the layer scores 21/21 identically to shipping it. This check and the 2D
// hybrid beside it are the only evidence the port produced anything.
//
// It is TWO strokes under `lighter`, not one — a wide low-alpha halo and then a
// narrow bright core over it — and that is the whole reason it reads as two
// things coalescing rather than as a thick edge. A port that drops the halo
// renders an entirely plausible bright bar, so a metric that only reads the
// centre of it proves nothing. Both are asserted, separately.
//
// ── The magnitudes, computed before the metric was chosen ─────────────────
// The nodes this sweep lands on give sim 0.771, so the core is 4.21px wide at
// mid alpha 0.827 of pure white, over a sphere backdrop that reads ~11. That is
// ~211 luminance of signal against ~11 of background before the trail gain —
// bright enough that a plain mean over the stroke's own footprint is a fine
// instrument, and no ratio-of-ratios is needed. (The mean over the whole sphere
// disc that the first ghost check used would have been ~65x too coarse; the bar
// is ~600px of a ~700k-px frame.)
//
// The halo is 18.6px wide at mid alpha 0.118 of (255,255,200) — call it 30
// luminance, ~1/7 of the core. Its own band cannot simply be averaged: the
// core's gaussian shoulder is 22.5px in radius and the bloom pass smears the
// core further, so BOTH are present out there. Measured, suppressing the halo
// alone drops that band's excess only from 84.9 to 60.6, a 1.40x separation —
// usable but thin.
//
// What the glow and the bloom cannot fake is the halo's RIM. The halo is a box
// filter with a hard edge at its half-width; everything else in that
// neighbourhood is smooth. So the halo's quantity is the STEP across that rim —
// mean over [hw-2.5, hw-0.5] minus mean over [hw+0.5, hw+2.5]. Measured, that
// separates 34.0 live from 13.5 with the halo suppressed: 2.5x.
//
// ── Validated against its own null, twice ─────────────────────────────────
// Both nulls suppress pixels only — a `discard` in the additive fragment
// shader, with the instance buffer still written — so the geometry the bands
// are measured from is byte-identical across all three builds.
//
//        build                       core excess   halo rim step
//        live (4 runs)               220.5-221.7      34.00-34.04
//        halo discarded (glow<0.001) 214.1-214.3            13.48
//        whole layer discarded             -1.3           -0.06
//
// Note the middle row: the core is untouched by the halo's absence, which is
// what makes these two independent assertions rather than one measured twice.
// Thresholds sit between the populations — CORE_EXCESS is 46% under the worst
// live run, HALO_RIM_STEP is 35% under it and 63% over the null.
//
// ── And the instrument checks itself in-run ───────────────────────────────
// The same rim step is measured a second time on a line displaced
// perpendicular by the halo's half-width plus the core's full glow reach: off
// the bar entirely, same neighbourhood, same bloom. There is no rim there, so
// it must read ~0 (measured 0.04-0.49 across every build above). If it does
// not, the endpoints were decoded wrong and no other number on this row means
// anything — so it is part of the verdict, not a note.
const CORE_EXCESS = 120;      // luminance, 0-255
const HALO_RIM_STEP = 22;
const RIM_CONTROL_MAX = 5;    // the off-bar rim step, which must be ~0

// Every band must actually have measured something. `barBand` returns
// `sum / (n || 1)`, so an EMPTY sample reads as a mean of ZERO and is
// indistinguishable from a measured black band — which turns three of the
// numbers below into a false green: an empty coreOff makes the excess coreOn's
// own ~233, an empty rimOut makes the step rimIn's own ~93, and two empty
// control bands make rimControl 0, i.e. the one assertion whose entire purpose
// is to prove the endpoints decoded correctly passes VACUOUSLY. This is the
// same guard the PULSE RINGS block above states is "not a formality".
// Measured: the six bands run 500-900 px; 50 is a floor, not a threshold.
const MIN_BAND_PX = 50;

// The core's glow RADIUS, pinned — not merely "> 0".
//
// The entire reason this task introduced a per-material glowQuant is that at the
// edge mesh's 1/8 px step a 22.5 px radius saturates the [0,127] clamp at
// 15.875. If the packing call in ArtTab.jsx regresses to the default
// quantisation the byte clamps to 127, this harness decodes it at the additive
// step as 31.75, `glow > 0` is satisfied, and the row goes GREEN — while the
// shader draws a 31.75 px shoulder instead of a 22.5 px one and the peak drops
// from 0.134 to 0.095. That is ~2 luminance against a 113-luminance margin on
// CORE_EXCESS, and the rim step is measured where the core's gaussian is smooth,
// so no pixel assertion here moves either. An instrument that reads the state it
// exists to exercise and then declines to assert on it is this project's
// signature failure, and this was the seventh occurrence.
//
// The similarity is recoverable through the decoder already imported: the core's
// MID alpha is 0.40 + sim*0.55, so sim = (a1 - A) / K and the expected radius is
// resonanceGlow(sim). Two quantisations sit between that and the decoded byte:
//
//   glow byte   round(glow * q) / q          -> +/- 0.5/4      = 0.125 px
//   mid alpha   round(a1 * 255) / 255        -> +/- 0.5/255 on a1,
//               / K = 0.55 -> +/- 0.00357 on sim,
//               * RESONANCE_GLOW_SCALE = 24  -> +/- 0.0856 px
//
// so the bound is their sum, 0.2106 px. (The reviewer's suggested 0.125 covers
// only the second of the two and would fail on its own arithmetic.) Against it,
// the regression it exists to catch is 31.75 vs 22.5 — 9.25 px, a 44x margin.
const GLOW_TOL = 0.5 / ADDITIVE_LAYER.glowQuant
  + RESONANCE_GLOW_SCALE * (0.5 / 255) / RESONANCE_CORE_MID_K;

// CDP's modifier bitmask: Alt 1, Ctrl 2, Meta 4, Shift 8. Shift-click is the
// only way into this layer.
const SHIFT_KEY = 8;

// The toggle's own label, read straight out of the DOM. This is deliberately
// NOT the instance buffer: the point is to establish that resonance armed and
// that two nodes are selected from a source independent of the thing being
// measured. A check that reads the layer's own state and then reports a number
// about it is this project's signature failure — six occurrences.
const RESONANCE_LABEL = `(() => { const b = [...document.querySelectorAll('button')]
  .find(e => /resonance/i.test(e.innerText || '')); return b ? b.innerText : null; })()`;

// The hover probe again — the ring check's copy is scoped to its own block.
const HOVERED_NODE = `(() => {
  const s = [...document.querySelectorAll('span')].filter(e =>
    e.style.position === 'absolute' && e.style.font && e.textContent);
  let best = null;
  for (const e of s) { const o = parseFloat(e.style.opacity || '0');
    if (o > 0.9 && (!best || o > best.o)) best = { o, t: e.textContent }; }
  return best && best.t; })()`;

// The two instances, decoded through EDGE_OFF / EDGE_STRIDE / isDisc exactly as
// ringsOf() above does — one decoder for this buffer, never a second.
function strokesOf(add) {
  const at = (i, f) => add.instances[i * EDGE_STRIDE + f];
  const one = (i) => ({
    ax: at(i, EDGE_OFF.ax), ay: at(i, EDGE_OFF.ay),
    bx: at(i, EDGE_OFF.bx), by: at(i, EDGE_OFF.by),
    width: Math.abs(at(i, EDGE_OFF.width)),
    isDisc: isDisc(at(i, EDGE_OFF.width)),
    glow: unpackFlags(at(i, EDGE_OFF.flags), ADDITIVE_LAYER.glowQuant).glow,
    // The MID gradient stop's alpha, which is where the similarity is
    // recoverable from — see GLOW_TOL. unpackAlphas, not a second decoder.
    midA: unpackAlphas(at(i, EDGE_OFF.alphas)).a1,
  });
  // Write order, which is also draw order: halo first, core over it.
  return { halo: one(0), core: one(1) };
}

// Mean luminance over the pixels whose perpendicular distance from the bar
// (optionally displaced by `shift`) lies in [lo, hi]. `along` is trimmed to the
// middle 70% so the node blobs at either end never enter any band.
function barBand(img, s, lo, hi, shift = 0) {
  const { width: W, height: H, data } = img;
  const dx = s.bx - s.ax, dy = s.by - s.ay, len = Math.hypot(dx, dy);
  if (!(len > 1)) return { mean: 0, n: 0 };
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const m = Math.abs(shift) + hi + 2;
  const x0 = Math.max(0, Math.floor(Math.min(s.ax, s.bx) - m));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(s.ax, s.bx) + m));
  const y0 = Math.max(0, Math.floor(Math.min(s.ay, s.by) - m));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(s.ay, s.by) + m));
  let sum = 0, n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const rx = x - s.ax, ry = y - s.ay;
    const along = (rx * ux + ry * uy) / len;
    if (along < 0.15 || along > 0.85) continue;
    const perp = Math.abs(rx * nx + ry * ny - shift);
    if (perp < lo || perp > hi) continue;
    const i = (y * W + x) * 4;
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++;
  }
  return { mean: sum / (n || 1), n };
}

const r5 = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900, deterministic: true });
try {
  await r5.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await r5.eval(clickText('/CHAOS'));
  await r5.waitFor(READY, { label: 'sphere', timeoutMs: 40000 });
  await r5.waitFor(GL_READY, { label: 'GL sized', timeoutMs: 40000 });
  await sleep(4000);
  await r5.eval('window.__virtualize()');
  await sleep(150);
  await r5.eval('window.__reseed(); window.__artHarnessReset();');
  await r5.pump(240);

  const rect = await r5.eval(RECT);
  // Same as the ring check: the instance buffer's coordinates ARE the 2D
  // canvas's CSS px, so the clip's top-left is their origin.
  const clip = { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 };

  console.log('RESONANCE EDGE  (the two strokes of the shift-click bar, each against its own control)');
  const armed = await r5.eval(clickText('resonance'));
  await r5.pump(2);
  const label0 = await r5.eval(RESONANCE_LABEL);

  // The hover sweep, reused from the ring check, but it has to land on two
  // DIFFERENT nodes — shift-clicking the same one twice toggles it back off and
  // leaves a one-node selection that draws nothing.
  const picked = [];
  const seen = new Set();
  sweep:
  for (let row = 1; row <= 5; row++) for (let c = 1; c <= 9; c++) {
    const x = Math.round(rect.x + rect.w * c / 10), y = Math.round(rect.y + rect.h * row / 6);
    await r5.hover(x, y); await sleep(70); await r5.pump(2);
    const label = await r5.eval(HOVERED_NODE);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    await r5.click(x, y, { modifiers: SHIFT_KEY });
    await sleep(200); await r5.pump(2);
    picked.push(label);
    if (picked.length === 2) break sweep;
  }
  await r5.pump(30);

  const label2 = await r5.eval(RESONANCE_LABEL);
  // MODE FIRST. Everything below is a confident, meaningless number if the
  // toggle did not arm or the two shift-clicks did not land.
  const modeOk = armed && label0 === '◈ resonance [0/2]' && label2 === '◈ resonance [2/2]';
  console.log(`   toggle "${label0}" -> "${label2}"   nodes ${picked.join(' + ') || 'NONE'}`
    + (modeOk ? '' : '   MODE NEVER ENGAGED — the shift-clicks did not land'));

  if (!modeOk) {
    verdict('RESONANCE EDGE', false);
  } else {
    const st = JSON.parse(await r5.eval('JSON.stringify(window.__artEdgeState())'));
    const { halo, core } = strokesOf(st.additive);
    const img = decodePng(await r5.screenshot({ clip }));

    const cHW = Math.max(core.width / 2, 1), hHW = halo.width / 2;
    // Far enough out that neither the halo nor the core's gaussian reaches:
    // the halo's own half-width plus the full GLOW_REACH the vertex shader
    // pads the quad by.
    const shift = hHW + GLOW_REACH * core.glow + 4;

    const coreOn = barBand(img, core, 0, cHW);
    const coreOff = barBand(img, core, 0, cHW, shift);
    const rimIn = barBand(img, core, hHW - 2.5, hHW - 0.5);
    const rimOut = barBand(img, core, hHW + 0.5, hHW + 2.5);
    const rimInC = barBand(img, core, hHW - 2.5, hHW - 0.5, shift);
    const rimOutC = barBand(img, core, hHW + 0.5, hHW + 2.5, shift);

    const coreExcess = coreOn.mean - coreOff.mean;
    const rimStep = rimIn.mean - rimOut.mean;
    const rimControl = rimInC.mean - rimOutC.mean;

    // Every band, including both controls. An empty sample is a mean of zero
    // and would sail through three of the four numbers above — see MIN_BAND_PX.
    const bands = { coreOn, coreOff, rimIn, rimOut, rimInC, rimOutC };
    const thin = Object.entries(bands).filter(([, b]) => b.n < MIN_BAND_PX).map(([k]) => k);
    const bandsOk = thin.length === 0;

    // The similarity the packed core actually encodes, and the radius it
    // implies. `core.glow > 0` alone cannot tell 22.5 from a clamp-saturated
    // 31.75 — see GLOW_TOL.
    const simEnc = (core.midA - RESONANCE_CORE_MID_A) / RESONANCE_CORE_MID_K;
    const glowWant = resonanceGlow(simEnc);
    const glowErr = Math.abs(core.glow - glowWant);

    // Two instances, both strokes (a negative width would make them discs), on
    // the same segment — all FOUR endpoint coordinates, since a writer that got
    // bx or ay wrong on one instance would otherwise pass the shape gate and
    // then be measured with mismatched geometry. If the port ever collapses to
    // one instance this is where it says so, before any pixel is read.
    const shapeOk = st.additive.count === 2 && !halo.isDisc && !core.isDisc
      && halo.width > core.width * 3 && halo.glow === 0 && glowErr <= GLOW_TOL
      && halo.ax === core.ax && halo.ay === core.ay
      && halo.bx === core.bx && halo.by === core.by;

    console.log(`   instances ${st.additive.count}   halo w ${halo.width.toFixed(2)} glow ${halo.glow}`
      + `   core w ${core.width.toFixed(2)} glow ${core.glow}` + (shapeOk ? '' : '   SHAPE WRONG'));
    console.log(`   sim ${simEnc.toFixed(4)} from the packed mid alpha`
      + `   core glow ${core.glow} vs ${glowWant.toFixed(3)} expected`
      + `   err ${glowErr.toFixed(4)} (tol ${GLOW_TOL.toFixed(4)})`);
    console.log(`   core    ${coreOn.mean.toFixed(2)} (${coreOn.n}px)   control ${coreOff.mean.toFixed(2)} (${coreOff.n}px)`
      + `   excess ${coreExcess.toFixed(2)} (need ${CORE_EXCESS})`);
    console.log(`   halo rim ${rimIn.mean.toFixed(2)} (${rimIn.n}px) in / ${rimOut.mean.toFixed(2)} (${rimOut.n}px) out`
      + `   step ${rimStep.toFixed(2)} (need ${HALO_RIM_STEP})`);
    console.log(`   same rim off the bar   ${rimInC.mean.toFixed(2)} (${rimInC.n}px) / ${rimOutC.mean.toFixed(2)} (${rimOutC.n}px)`
      + `   step ${rimControl.toFixed(2)} (must be under ${RIM_CONTROL_MAX})`
      + (bandsOk ? '' : `   EMPTY BANDS: ${thin.join(', ')} — under ${MIN_BAND_PX}px, so their means are not measurements`));
    verdict('RESONANCE EDGE', shapeOk && bandsOk && coreExcess >= CORE_EXCESS
      && rimStep >= HALO_RIM_STEP && Math.abs(rimControl) <= RIM_CONTROL_MAX);
  }
} finally { await r5.close(); }

// ── PRISM GEOMETRY: the command-triggered burst ───────────────────────────
// Even more invisible to the comparator than the resonance edge: this layer is
// fired by a COMMAND, no capture state issues one, and deleting all three of
// its sub-layers scores 21/21 identically to shipping them. This check and the
// 2D hybrid beside it are the only evidence the port produced anything.
//
// THREE sub-layers, and they must be asserted SEPARATELY, because a port that
// drops the polygon or the spokes still renders a completely convincing chord
// bundle:
//   1. the chord bundle — for every pair of effect nodes, and each of
//      spectralN spectral lines, TWO quadratic Beziers (a wide glow pass and a
//      sharp core), each CPU-flattened into a run of straight instances;
//   2. the sacred polygon — one closed ring through the nodes;
//   3. the star spokes — one line from the projected sphere centre to each.
// They are separable in the buffer by WIDTH, which is the one field that
// differs between them and never collides: 0.5 spoke, 1.2 core, 1.6 polygon,
// 5.0 down to 2.6 for the seven glow passes.
//
// ── The effect is asserted to have FIRED from the DOM, not the buffer ──────
// The geometry shell echoes the command it dispatched into a span. That is the
// resonance check's trick — a label the layer does not write — and it is what
// stops this block reporting a confident number about a frame where nothing
// happened. Reading the instance buffer to decide whether the instance buffer
// is populated is this project's signature failure; it has now happened seven
// times.
//
// ── The instance count is asserted against ARITHMETIC, not against zero ────
// Given N projected effect nodes and spectralN spectral lines, the layer's
// shape is fully determined:
//
//   spokes    N instances,  N polylines (they all start at the centre)
//   polygon   N instances,  1 polyline  (a CLOSED ring: every segment's end is
//                                        the next one's start, including the
//                                        last, so the whole thing chains)
//   glow      C(N,2) polylines in EACH of the spectralN width classes
//   core      spectralN * C(N,2) polylines, all at width 1.2
//   and       total glow segments === total core segments, because both passes
//             flatten the SAME curve and share its point list
//
// N is read three independent ways — the spoke count, the polygon count, and
// C(N,2) inverted from a glow class's polyline count — and all three must
// agree. That is what catches a silent truncation against the cap, which is
// also asserted directly through `dropped`.
//
// Counting polylines is itself the abutment test. A polyline is detected by
// each instance's A endpoint being BIT-IDENTICAL to the previous one's B; any
// joint that failed to abut would split a run and push the polyline count
// above the predicted one. Under `lighter` a joint that overlaps adds twice and
// beads, and one that gaps leaves a hole, so exact abutment is correctness
// rather than tidiness.
//
// ── Validated against its own null, three times ───────────────────────────
// Each null suppresses ONE sub-layer in PIXELS ONLY — a width-gated `discard`
// in the additive fragment shader, instance buffer still written — so the masks
// every band is measured through are byte-identical across all four builds.
//
// Measured twice, by two sessions, on the same rig (scripts/_prismMeasure.mjs
// with scripts/_nullPatch.mjs); the second run's figures are the ones below and
// the first run's agreed to within a unit on every cell.
//
//        build              chord excess   polygon excess   spoke excess
//        live                      138.25          67.94            26.03
//        chords discarded            8.77          88.76            22.60
//        polygon discarded         139.84          21.60            27.66
//        spokes discarded          138.34          68.23            13.22
//
// The off-diagonal is informative: suppressing the chords RAISES the polygon
// and spoke numbers, because the chord bundle is most of what contaminates
// their control bands. Each threshold sits between that sub-layer's own two
// populations.
//
// The spoke margin is the thin one and is stated rather than hidden: 26.0 live
// against 13.2 null, a 2.0x separation, where the chords get 16x. A spoke is
// 0.5px wide — the faintest thing this layer draws — and its control band
// cannot escape the chord bundle it lies inside. 19.5 sits 25% under the live
// figure and 48% over the null.
const PRISM_CHORD_EXCESS = 70;    // luminance, 0-255. Live 138.3, null 8.8.
const PRISM_POLY_EXCESS = 45;     // Live 67.9, null 21.6.
const PRISM_SPOKE_EXCESS = 19.5;  // Live 26.0, null 13.2.
const PRISM_MIN_BAND_PX = 200;    // measured 693-34349; a floor, not a threshold
// The alias typed into the geometry shell. Any node id works; this one resolves
// to a six-node neighbourhood, which is enough for a polygon and 15 pairs.
const PRISM_ALIAS = 'run kuramoto';

// Every prism instance carries one of these widths and nothing else does. Read
// from artEdges.js rather than spelled here, so a width the port changed would
// fail to classify instead of being silently measured as another sub-layer.
const PRISM_GLOW_WIDTHS = Array.from({ length: PRISM_SPECTRAL_FINE }, (_, k) => prismGlowWidth(k));
const nearW = (a, b) => Math.abs(a - b) < 0.01;

// Decoded through EDGE_STRIDE / EDGE_OFF / isDisc exactly as ringsOf() and
// strokesOf() above do — one decoder for this buffer, never a second.
function prismOf(add) {
  const segs = { chord: [], poly: [], spoke: [] };
  const runs = {};              // width -> polyline count
  const runLen = {};            // width -> longest polyline, in segments
  let prevKey = null, prevBX = null, prevBY = null, cur = 0;
  let discs = 0, unclassified = 0, maxTurn = 0, prevUX = 0, prevUY = 0;
  for (let i = 0; i < add.count; i++) {
    const o = i * EDGE_STRIDE;
    const w = add.instances[o + EDGE_OFF.width];
    // A negative width is the pulse ring's disc sentinel. Nothing this layer
    // writes may be one; if something is, it renders as a blob, not a stroke.
    if (isDisc(w)) { discs++; continue; }
    const s = {
      ax: add.instances[o + EDGE_OFF.ax], ay: add.instances[o + EDGE_OFF.ay],
      bx: add.instances[o + EDGE_OFF.bx], by: add.instances[o + EDGE_OFF.by], w,
    };
    const key = w.toFixed(3);
    const chordW = nearW(w, PRISM_CORE_W) || PRISM_GLOW_WIDTHS.some(g => nearW(w, g));
    // EXACT equality — that is the whole point. See the abutment note above.
    const cont = prevKey === key && prevBX === s.ax && prevBY === s.ay;
    const L = Math.hypot(s.bx - s.ax, s.by - s.ay);
    const ux = L > 0 ? (s.bx - s.ax) / L : 0, uy = L > 0 ? (s.by - s.ay) / L : 0;
    if (cont) {
      cur++;
      // The turn at this joint, which is what sets the size of the wedge butt
      // caps leave where the canvas put a miter.
      //
      // CHORD JOINTS ONLY. The polygon is also one continuous run — a closed
      // ring shares every endpoint — and its corners turn by tens of degrees,
      // so folding them in here would report a POLYGON corner as if it were a
      // tessellation joint at the 5px glow width. They are two different
      // deviations with two different widths and they are measured apart: the
      // polygon's corners come back through `segs.poly` and are turned into
      // miter arithmetic by the caller.
      if (chordW) {
        const dot = Math.max(-1, Math.min(1, ux * prevUX + uy * prevUY));
        maxTurn = Math.max(maxTurn, Math.acos(dot));
      }
    } else {
      if (prevKey !== null) runLen[prevKey] = Math.max(runLen[prevKey] ?? 0, cur);
      runs[key] = (runs[key] || 0) + 1;
      cur = 1;
    }
    prevKey = key; prevBX = s.bx; prevBY = s.by; prevUX = ux; prevUY = uy;
    if (nearW(w, PRISM_SPOKE_W)) segs.spoke.push(s);
    else if (nearW(w, PRISM_POLY_W)) segs.poly.push(s);
    else if (chordW) segs.chord.push(s);
    else unclassified++;
  }
  if (prevKey !== null) runLen[prevKey] = Math.max(runLen[prevKey] ?? 0, cur);
  return { segs, runs, runLen, discs, unclassified, maxTurn };
}

/**
 * The polygon's LOST MITER JOINS, from the corner angles the buffer actually
 * carries. One closed canvas path with miter joins became N butt-capped
 * segments, so at every corner the wedge between the two end caps and the miter
 * tip is no longer painted. This is a known deviation of the port, not a bug to
 * be papered over with an invented join — it is measured and reported.
 *
 * At a corner turning by dt, with halfW = w/2 and f = dt/2:
 *   opening  |AB|      = 2 halfW sin f        the gap between the two end caps
 *   depth    |JM|-|Jc| = halfW (sec f - cos f)  how far the miter tip stood out
 *   area     quad JAMB = halfW^2 tan f        the ink that is no longer laid
 * All N corners are walked, including the closing one, which the run-based
 * joint scan above cannot see because the run STARTS there.
 */
function prismMiterLoss(poly, width) {
  const halfW = width / 2;
  const n = poly.length;
  const out = { corners: 0, maxTurn: 0, maxOpen: 0, maxDepth: 0, area: 0, ink: 0 };
  if (n < 3) return out;
  const dir = (s) => {
    const dx = s.bx - s.ax, dy = s.by - s.ay, L = Math.hypot(dx, dy);
    return L > 0 ? [dx / L, dy / L, L] : [0, 0, 0];
  };
  for (let i = 0; i < n; i++) {
    const [px, py] = dir(poly[(i + n - 1) % n]);
    const [qx, qy, L] = dir(poly[i]);
    out.ink += L * width;
    const dt = Math.acos(Math.max(-1, Math.min(1, px * qx + py * qy)));
    if (!(dt > 0)) continue;
    const f = dt / 2;
    out.corners++;
    out.maxTurn = Math.max(out.maxTurn, dt);
    out.maxOpen = Math.max(out.maxOpen, 2 * halfW * Math.sin(f));
    out.maxDepth = Math.max(out.maxDepth, halfW * (1 / Math.cos(f) - Math.cos(f)));
    out.area += halfW * halfW * Math.tan(f);
  }
  return out;
}

// A pixel MASK along a set of segments, optionally displaced perpendicular by
// `shift`. A mask rather than a per-segment accumulation because the chord
// bundle overlaps itself heavily and a per-segment sum would weight a pixel by
// how many segments happen to run through it.
function prismBand(W, H, segs, band, shift, trim) {
  const m = new Uint8Array(W * H);
  for (const s of segs) {
    const dx = s.bx - s.ax, dy = s.by - s.ay, L = Math.hypot(dx, dy);
    if (!(L > 0.5)) continue;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const ox = nx * shift, oy = ny * shift, pad = band + 2;
    const x0 = Math.max(0, Math.floor(Math.min(s.ax, s.bx) + ox - pad));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(s.ax, s.bx) + ox + pad));
    const y0 = Math.max(0, Math.floor(Math.min(s.ay, s.by) + oy - pad));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(s.ay, s.by) + oy + pad));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const rx = x - s.ax - ox, ry = y - s.ay - oy;
      const along = (rx * ux + ry * uy) / L;
      if (along < trim || along > 1 - trim) continue;
      if (Math.abs(rx * nx + ry * ny) > band) continue;
      m[y * W + x] = 1;
    }
  }
  return m;
}

const prismMean = (img, mask, exclude) => {
  const { width: W, height: H, data } = img;
  let sum = 0, n = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || (exclude && exclude[i])) continue;
    const j = i * 4;
    sum += 0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2]; n++;
  }
  return { mean: sum / (n || 1), n };
};

// The geometry shell's own echo span, and the command form. Deliberately NOT
// the instance buffer — see the note above.
const PRISM_ECHO = `(() => { const s = [...document.querySelectorAll('span')]
  .find(e => (e.textContent || '').startsWith('\\u21b3 ') || e.textContent === 'geometry_shell');
  return s ? s.textContent : null; })()`;
const PRISM_RUN = `(() => {
  const inp = [...document.querySelectorAll('input')].find(e => /run <kernel>/.test(e.placeholder || ''));
  if (!inp) return 'NO INPUT';
  // React owns this input's value, so set it through the native descriptor and
  // let React's synthetic onChange see the event.
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(inp, ${JSON.stringify(PRISM_ALIAS)});
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  const f = inp.closest('form'); if (!f) return 'NO FORM';
  f.requestSubmit(); return 'ok'; })()`;

const r6 = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900, deterministic: true });
try {
  await r6.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await r6.eval(clickText('/CHAOS'));
  await r6.waitFor(READY, { label: 'sphere', timeoutMs: 40000 });
  await r6.waitFor(GL_READY, { label: 'GL sized', timeoutMs: 40000 });
  await sleep(4000);
  await r6.eval('window.__virtualize()');
  await sleep(150);
  await r6.eval('window.__reseed(); window.__artHarnessReset();');
  await r6.pump(240);

  const rect = await r6.eval(RECT);
  // As above: the instance buffer's coordinates ARE the 2D canvas's CSS px, so
  // the clip's top-left is their origin and no offset is needed.
  const clip = { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 };

  console.log('PRISM GEOMETRY  (three sub-layers, each against its own displaced control)');
  const echo0 = await r6.eval(PRISM_ECHO);
  const fired = await r6.eval(PRISM_RUN);
  await sleep(300);
  // 40 frames in: the envelope ramps over the first 10% of maxLife and holds
  // until 65%, so this sits on the plateau rather than on either ramp.
  await r6.pump(40);
  const echo1 = await r6.eval(PRISM_ECHO);

  // FIRED FIRST. Every number below is confident and meaningless if the command
  // never reached spawnEffect.
  const firedOk = fired === 'ok' && echo0 === 'geometry_shell'
    && echo1 === `↳ ${PRISM_ALIAS}`;
  console.log(`   shell "${echo0}" -> "${echo1}"`
    + (firedOk ? '' : `   COMMAND NEVER LANDED (submit said ${fired})`));

  if (!firedOk) {
    verdict('PRISM GEOMETRY', false);
  } else {
    const st = JSON.parse(await r6.eval('JSON.stringify(window.__artEdgeState())'));
    const img = decodePng(await r6.screenshot({ clip }));
    const { width: W, height: H } = img;
    const { segs, runs, runLen, discs, unclassified, maxTurn } = prismOf(st.additive);

    // ── The arithmetic ────────────────────────────────────────────────────
    const N = segs.spoke.length;                       // one spoke per node
    const pairs = (N * (N - 1)) / 2;
    const glowRuns = PRISM_GLOW_WIDTHS.map(w => runs[w.toFixed(3)] ?? 0);
    const coreRuns = runs[PRISM_CORE_W.toFixed(3)] ?? 0;
    const polyRuns = runs[PRISM_POLY_W.toFixed(3)] ?? 0;
    const spokeRuns = runs[PRISM_SPOKE_W.toFixed(3)] ?? 0;
    const coreSegs = segs.chord.filter(s => nearW(s.w, PRISM_CORE_W)).length;
    const glowSegs = segs.chord.length - coreSegs;
    const countOk = N >= 3
      && st.additive.dropped === 0 && discs === 0 && unclassified === 0
      && segs.poly.length === N && polyRuns === 1        // ONE closed ring
      && spokeRuns === N
      && glowRuns.every(r => r === pairs)
      && coreRuns === PRISM_SPECTRAL_FINE * pairs
      && glowSegs === coreSegs                            // both passes, same curve
      && Object.entries(runLen).every(([w, n]) =>
        nearW(+w, PRISM_POLY_W) || nearW(+w, PRISM_SPOKE_W) || n <= CURVE_MAX_SEGMENTS);

    console.log(`   ${N} nodes -> ${pairs} pairs   instances ${st.additive.count}/${st.additive.capacity}`
      + `   dropped ${st.additive.dropped}` + (countOk ? '' : '   ARITHMETIC WRONG'));
    console.log(`   polylines  spokes ${spokeRuns}/${N}   polygon ${polyRuns}/1 (closed ring, ${segs.poly.length}/${N} segments)`
      + `   glow ${glowRuns.join(',')} each /${pairs}   core ${coreRuns}/${PRISM_SPECTRAL_FINE * pairs}`);
    // The two KNOWN DEVIATIONS of this port, measured rather than asserted.
    //
    // 1. The tessellation's joint notch. Butt caps meeting at a turn dt leave a
    //    wedge on the outer side where the canvas put a miter. The brief's
    //    figure for it is the OPENING, 2*halfW*sin(dt/2) ~ w*dt/2 — the chord
    //    between the two cap corners — and one pixel of that at the widest
    //    stroke here (the k=0 glow pass, w = PRISM_GLOW_W) needs
    //    dt <= 2*asin(1/PRISM_GLOW_W) = 23.07deg. The DEEPEST UNPAINTED POINT is
    //    half that, halfW*sin(dt/2), which is what scripts/_prismNotch.mjs
    //    measured by rasterising the ideal stroke against the emitted
    //    rectangles (0.02px grid) — it agreed with this closed form to within
    //    the grid step on every shape in the archetype family, so the number
    //    printed here is a formula that has been checked against a raster rather
    //    than one standing in for it. Both are printed; neither is asserted,
    //    per the brief. See artCurve.js's header
    //    for why the residual above 23.07deg is not closable by tolerance.
    // 2. The polygon's lost miters, at its own 1.6px width — see prismMiterLoss.
    const halfG = PRISM_GLOW_W / 2, fJ = maxTurn / 2;
    const mit = prismMiterLoss(segs.poly, PRISM_POLY_W);
    console.log(`   chord segments  glow ${glowSegs} = core ${coreSegs}`
      + `   longest curve ${Math.max(...PRISM_GLOW_WIDTHS.map(w => runLen[w.toFixed(3)] ?? 0))}/${CURVE_MAX_SEGMENTS} segments`);
    console.log(`   joint notch  worst chord turn ${(maxTurn * 180 / Math.PI).toFixed(2)}deg`
      + `   opening ${(2 * halfG * Math.sin(fJ)).toFixed(4)}px`
      + `   deepest unpainted ${(halfG * Math.sin(fJ)).toFixed(4)}px`
      + `   (1px of opening at ${(2 * Math.asin(1 / PRISM_GLOW_W) * 180 / Math.PI).toFixed(2)}deg, w=${PRISM_GLOW_W})`);
    console.log(`   lost miters  ${mit.corners} polygon corners`
      + `   worst turn ${(mit.maxTurn * 180 / Math.PI).toFixed(2)}deg`
      + `   worst opening ${mit.maxOpen.toFixed(3)}px  depth ${mit.maxDepth.toFixed(3)}px`
      + `   unpainted ${mit.area.toFixed(2)}px2 of ${mit.ink.toFixed(0)}px2 (${(100 * mit.area / mit.ink).toFixed(3)}%)`);

    // ── The pixels, one band per sub-layer ────────────────────────────────
    const rows = [
      ['chord', segs.chord, 0.8, 55, 0.00, PRISM_CHORD_EXCESS],
      ['polygon', segs.poly, 1.2, 7, 0.12, PRISM_POLY_EXCESS],
      ['spoke', segs.spoke, 0.8, 5, 0.30, PRISM_SPOKE_EXCESS],
    ];
    let pixelsOk = true, bandsOk = true;
    for (const [name, list, band, shift, trim, need] of rows) {
      const on = prismBand(W, H, list, band, 0, trim);
      const a = prismBand(W, H, list, band, shift, trim);
      const b = prismBand(W, H, list, band, -shift, trim);
      const off = new Uint8Array(W * H);
      for (let i = 0; i < off.length; i++) off[i] = (a[i] || b[i]) ? 1 : 0;
      const onM = prismMean(img, on);
      // The control excludes the layer's own band, so a control pixel is never
      // a pixel the sub-layer painted.
      const offM = prismMean(img, off, on);
      const excess = onM.mean - offM.mean;
      // An EMPTY band reads as a mean of zero and is indistinguishable from a
      // measured black one — the same guard the two checks above carry.
      const thin = onM.n < PRISM_MIN_BAND_PX || offM.n < PRISM_MIN_BAND_PX;
      if (thin) bandsOk = false;
      if (!(excess >= need)) pixelsOk = false;
      console.log(`   ${name.padEnd(8)} ${onM.mean.toFixed(2)} (${onM.n}px)`
        + `   control +-${shift} ${offM.mean.toFixed(2)} (${offM.n}px)`
        + `   excess ${excess.toFixed(2)} (need ${need})`
        + (thin ? `   BAND TOO THIN — under ${PRISM_MIN_BAND_PX}px, not a measurement` : ''));
    }
    verdict('PRISM GEOMETRY', countOk && bandsOk && pixelsOk);
  }
} finally { await r6.close(); }

// ── THE TWO ORPHAN CURVE LAYERS: analogy filaments, chimera fringes ───────
//
// Both are dashed quadratic Béziers on the additive mesh (task 6b), and both
// are invisible to the comparator for a reason NEITHER of the checks above has:
// the simulation does not produce them.
//
// MEASURED over 3551 harness frames rather than assumed, because "is this layer
// in the capture at all" is the question this project has now got wrong twice:
//
//   filaments   96 exist and ZERO are ever drawn. `fil.nodeA` indexes the
//               272-node corpus (nodeFeatures.NODES) while the draw loop's
//               `nodes`/`proj` are the ~31-node sphere, so `iA >= nodes.length`
//               drops every one of them — smallest index observed, 48. That is
//               PRE-EXISTING, the same index-space family as the /art `query`
//               probe that never renders, and repairing it would make an
//               invisible layer appear, i.e. a visual change rather than a port.
//   zones       live, but only in a burst: 160 of 3551 frames, all inside the
//               first ~200, peaking at 49 zones and strength 0.71 while the
//               Kuramoto clusters are still finding phase. Once they lock at
//               orderParam 1 there is no sync/async boundary left and the layer
//               is empty for the rest of the session.
//
// So the harness drives `window.__artSetAnalogy`, which writes the same refs
// the simulation writes — the same treatment __artSetEcocide and __artSetGhosts
// already give three background layers that no capture can arm. The state is
// asserted to have ENGAGED from what that hook reports the SIMULATION holds,
// which is not the buffer being measured and not the pixels.
//
// ── Validated against three nulls ─────────────────────────────────────────
// Each suppresses one thing in PIXELS ONLY — a dash-period-gated `discard` in
// the additive fragment shader — so the instance buffer, and therefore every
// band mask, is byte-identical across all four builds:
//
//        build                   filament excess   chimera excess
//        live (3 runs)             18.51-19.07       13.79-13.93
//        filaments discarded            4.23              13.64
//        chimera discarded             18.70               7.51
//
// The chimera margin is the thin one and is stated rather than hidden: 13.9
// live against 7.5 null, a 1.85x separation. Its control band cannot escape the
// filaments and the base edges it crosses. 10.5 sits 24% under the live floor
// and 40% over the null.
const FIL_EXCESS = 11;      // luminance, 0-255. Live 18.5-19.1, null 4.2.
const CHI_EXCESS = 10.5;    // Live 13.6-13.9, null 7.5.
const FZ_MIN_BAND_PX = 800; // measured 1864-8091; a floor, not a threshold

// ── The dash-continuity check, which the earlier tasks did not need ───────
//
// A phase field that is POPULATED BUT WRONG restarts the pattern at every joint.
// The ink is the same and only its arrangement moves, so no luminance mean sees
// it — MEASURED: the band excesses above move by under 9% between the correct
// build and one with the phase deliberately reset per segment.
//
// A run-length histogram or a spectral peak would be the obvious instruments
// and both degrade badly here: the sphere rotates between frames, the trail
// accumulator holds a fading copy of where the stroke was, and the bloom pass
// spreads it — and that degradation looks exactly like the defect. But the
// pattern is not unknown. The instance buffer states it exactly, so this scores
// the pixels against a PREDICTION, and against two competing predictions:
//
//   continuous   lit iff mod(instancePhase + d, period) < duty   (what was built)
//   restarted    lit iff mod(d, period) < duty                   (the pre-6b form)
//
// Contrast is mean(lit) - mean(dark) under each, pooled over every polyline of
// the layer, sampled in arc length with the background read from the same arc
// position a few px to either side. The MARGIN is continuous - restarted.
// Smear shrinks both models equally; only the phase decides which wins.
//
// The ANTI-PHASE row is the method's own control — the continuous model slid by
// half a period, which must come back with the contrast REVERSED rather than
// merely smaller, or "lit" is measuring something that is not a dash.
//
//        build                        filament margin   chimera margin
//        live (3 runs, GL and 2D)        +37.7 .. +38.5   +10.1 .. +10.9
//        dash phase reset per segment           -35.45          -17.11
//
const FIL_DASH_MARGIN = 15;   // live +37.7..+38.5, restarted-null -35.45
const CHI_DASH_MARGIN = 4;    // live +10.1..+10.9, restarted-null -17.11

const FIL_PERIOD = FILAMENT_DASH[0] + FILAMENT_DASH[1];
const CHI_PERIOD = CHIMERA_DASH[0] + CHIMERA_DASH[1];

// What the harness injects. `age`/`maxAge` are NOT optional: _animateFilaments
// increments age every frame and prunes on `age < maxAge`, so a filament
// without them prunes itself on the first step and draws nothing.
const FZ_FILAMENTS = [
  { nodeA: 0, nodeB: 12, strength: 1, age: 0, maxAge: 1e9 },
  { nodeA: 3, nodeB: 19, strength: 1, age: 0, maxAge: 1e9 },
  { nodeA: 5, nodeB: 24, strength: 1, age: 0, maxAge: 1e9 },
  { nodeA: 8, nodeB: 17, strength: 1, age: 0, maxAge: 1e9 },
  { nodeA: 2, nodeB: 27, strength: 1, age: 0, maxAge: 1e9 },
  { nodeA: 10, nodeB: 22, strength: 1, age: 0, maxAge: 1e9 },
];
const FZ_ZONES = [
  { clusterA: 'eco', clusterB: 'drk', boundaryStrength: 0.5, syncA: 0.9, syncB: 0.1 },
  { clusterA: 'sync', clusterB: 'crypto', boundaryStrength: 0.5, syncA: 0.2, syncB: 0.8 },
  { clusterA: 'phys', clusterB: 'eco', boundaryStrength: 0.5, syncA: 0.6, syncB: 0.3 },
];
const FZ_INJECT = `JSON.stringify(window.__artSetAnalogy({
  filaments: ${JSON.stringify(FZ_FILAMENTS)}, zones: ${JSON.stringify(FZ_ZONES)} }))`;

// Decoded through EDGE_STRIDE / EDGE_OFF / isDisc / unpackFlags exactly as
// ringsOf(), strokesOf() and prismOf() do — one decoder for this buffer.
//
// Classified by the packed DASH PERIOD, the one field that separates these two
// layers from everything else on the additive mesh: 14 filament, 10 chimera,
// 0 for the resonance edge and all three prism sub-layers. Width then splits
// the filament's two passes — its core is a constant 0.8 and its glow scales
// with the projection, which never reaches that low.
function fzOf(add) {
  const out = { filGlow: [], filCore: [], chi: [], other: 0, discs: 0 };
  const runs = { filGlow: 0, filCore: 0, chi: 0 };
  let prevKey = null, prevBX = null, prevBY = null;
  for (let i = 0; i < add.count; i++) {
    const o = i * EDGE_STRIDE;
    const w = add.instances[o + EDGE_OFF.width];
    if (isDisc(w)) { out.discs++; continue; }
    const f = unpackFlags(add.instances[o + EDGE_OFF.flags], ADDITIVE_LAYER.glowQuant);
    const s = {
      ax: add.instances[o + EDGE_OFF.ax], ay: add.instances[o + EDGE_OFF.ay],
      bx: add.instances[o + EDGE_OFF.bx], by: add.instances[o + EDGE_OFF.by], w,
      phase: add.instances[o + EDGE_OFF.phase], duty: f.dashDuty, period: f.dashPeriod,
    };
    let cls = null;
    if (f.dashPeriod === FIL_PERIOD) {
      cls = Math.abs(w - FILAMENT_CORE_W) < 0.01 ? 'filCore' : 'filGlow';
    } else if (f.dashPeriod === CHI_PERIOD) cls = 'chi';
    if (!cls) { out.other++; prevKey = null; continue; }
    // EXACT abutment, as everywhere else in this file: a joint that failed to
    // meet would split the run and push the polyline count above the predicted.
    const key = cls + ':' + w.toFixed(3);
    const cont = prevKey === key && prevBX === s.ax && prevBY === s.ay;
    if (!cont) runs[cls]++;
    s.run = cls + ':' + (runs[cls] - 1);
    prevKey = key; prevBX = s.bx; prevBY = s.by;
    out[cls].push(s);
  }
  out.runs = runs;
  return out;
}

// Bilinear luminance read — the strokes here are 0.8px to 5px wide and land
// between pixel centres, so a nearest-neighbour read aliases the dashes.
function fzSample(img, x, y) {
  const { width: W, height: H, data } = img;
  const xi = Math.max(0, Math.min(W - 2, Math.floor(x)));
  const yi = Math.max(0, Math.min(H - 2, Math.floor(y)));
  const fx = x - xi, fy = y - yi;
  const lum = (px, py) => {
    const j = (py * W + px) * 4;
    return 0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2];
  };
  return lum(xi, yi) * (1 - fx) * (1 - fy) + lum(xi + 1, yi) * fx * (1 - fy)
    + lum(xi, yi + 1) * (1 - fx) * fy + lum(xi + 1, yi + 1) * fx * fy;
}

/** Walk one polyline in arc length, sampling the stroke and its own local
 *  background, and carrying BOTH candidate dash phases at every sample. */
function fzProfile(img, segs, halfW, step = 0.25) {
  const run = [...segs].sort((a, b) => a.phase - b.phase);
  const OFF = halfW + 5;      // where the background is read, clear of the stroke
  const samples = [];
  let s0 = 0;
  for (const s of run) {
    const dx = s.bx - s.ax, dy = s.by - s.ay, L = Math.hypot(dx, dy);
    if (!(L > 1e-6)) continue;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    for (let d = 0; d < L; d += step) {
      const px = s.ax + ux * d, py = s.ay + uy * d;
      let peak = 0;
      for (let o = -halfW; o <= halfW; o += 0.25) {
        peak = Math.max(peak, fzSample(img, px + nx * o, py + ny * o));
      }
      const bg = (fzSample(img, px + nx * OFF, py + ny * OFF)
        + fzSample(img, px - nx * OFF, py - ny * OFF)) / 2;
      samples.push({ v: peak - bg, cont: s.phase + d, local: d });
    }
    s0 += L;
  }
  return { samples, total: s0 };
}

/** Mean(lit) - mean(dark) under one model. Samples within `guard` px of a
 *  pattern edge are dropped, so partial coverage at the transitions cannot
 *  flatten the contrast toward zero on its own. */
function fzModel(samples, key, period, duty, shift = 0, guard = 1) {
  let litSum = 0, litN = 0, darkSum = 0, darkN = 0;
  for (const p of samples) {
    const ph = ((p[key] + shift) % period + period) % period;
    if (Math.min(ph, Math.abs(ph - duty), period - ph) < guard) continue;
    if (ph < duty) { litSum += p.v; litN++; } else { darkSum += p.v; darkN++; }
  }
  return { contrast: (litN ? litSum / litN : NaN) - (darkN ? darkSum / darkN : NaN), litN, darkN };
}

const r7 = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900, deterministic: true });
try {
  await r7.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await r7.eval(clickText('/CHAOS'));
  await r7.waitFor(READY, { label: 'sphere', timeoutMs: 40000 });
  await r7.waitFor(GL_READY, { label: 'GL sized', timeoutMs: 40000 });
  await sleep(4000);
  await r7.eval('window.__virtualize()');
  await sleep(150);
  await r7.eval('window.__reseed(); window.__artHarnessReset();');
  // Well past the boot chimera burst, so the only zones in the frame are the
  // injected ones and the natural layer cannot contaminate the bands.
  await r7.pump(240);

  const rect = await r7.eval(RECT);
  const clip = { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 };

  console.log('ORPHAN CURVES  (analogy filaments + chimera fringes, dashed on the additive mesh)');
  const hasHook = await r7.eval('typeof window.__artSetAnalogy === "function"');
  if (!hasHook) {
    console.log('   __artSetAnalogy missing — production build?');
    verdict('ANALOGY FILAMENTS', false);
    verdict('CHIMERA FRINGES', false);
  } else {
    // The simulation's own count BEFORE anything is injected, so the note above
    // about neither layer being reachable is a number this run took, not lore.
    const natural = JSON.parse(await r7.eval('JSON.stringify(window.__artSetAnalogy({}))'));
    console.log(`   simulation at frame 240: ${natural.filaments} filaments, ${natural.zones} zones`
      + ` (neither reaches the pixels — see the note above)`);

    // Inject, then pump ONE frame at a time until the writers have run: the sim
    // rebuilds the zone list every 8 frames and the filament list every 64, and
    // can wipe an injection before the draw loop sees it.
    let cls = null, st = null, injected = null, tries = 0;
    while (tries++ < 12) {
      injected = JSON.parse(await r7.eval(FZ_INJECT));
      await r7.pump(1);
      st = JSON.parse(await r7.eval('JSON.stringify(window.__artEdgeState())'));
      cls = fzOf(st.additive);
      if (cls.filGlow.length + cls.chi.length > 0) break;
    }
    const img = decodePng(await r7.screenshot({ clip }));
    const { width: W, height: H } = img;

    // ENGAGED FIRST, from the simulation state rather than from the buffer or
    // the pixels — the prism check's DOM-echo trick, one layer down.
    const engaged = injected.filaments === FZ_FILAMENTS.length
      && injected.zones === FZ_ZONES.length;
    console.log(`   injected ${injected.filaments}/${FZ_FILAMENTS.length} filaments,`
      + ` ${injected.zones}/${FZ_ZONES.length} zones after ${tries} attempt(s)`
      + (engaged ? '' : '   STATE NEVER ENGAGED'));

    // ── The arithmetic ────────────────────────────────────────────────────
    // Each filament is ONE curve drawn TWICE (a wide glow and a sharp core over
    // it), so the two polyline counts must be equal and the two segment counts
    // must be equal — they share the point list. Each zone is one curve, one
    // pass. Depth and projection can drop a filament, so the count is asserted
    // against the two passes agreeing rather than against 6.
    const D = cls.runs.filGlow;
    const Z = cls.runs.chi;
    const coreW = [...new Set(cls.filCore.map(s => s.w.toFixed(3)))];
    const chiPhases = cls.chi.map(s => s.phase);
    const countOk = D > 0 && Z > 0
      && st.additive.dropped === 0 && cls.discs === 0 && cls.other === 0
      && cls.runs.filCore === D                       // both passes, same curves
      && cls.filGlow.length === cls.filCore.length    // and the same tessellation
      && coreW.length === 1 && Math.abs(+coreW[0] - FILAMENT_CORE_W) < 0.001
      && cls.filGlow.every(s => s.duty === FILAMENT_DASH[0])
      && cls.filCore.every(s => s.duty === FILAMENT_DASH[0])   // the CORE is dashed too
      && cls.chi.every(s => s.duty === CHIMERA_DASH[0])
      // The scrolling offset: every chimera instance's phase is seeded from the
      // same reduced lineDashOffset, so the smallest one in the frame is that
      // offset and it is inside one period.
      && Math.min(...chiPhases) >= 0 && Math.min(...chiPhases) < CHI_PERIOD;
    console.log(`   instances ${st.additive.count}/${st.additive.capacity}   dropped ${st.additive.dropped}`
      + `   discs ${cls.discs}   unclassified ${cls.other}` + (countOk ? '' : '   ARITHMETIC WRONG'));
    console.log(`   polylines  filament glow ${cls.runs.filGlow} = core ${cls.runs.filCore}`
      + `   segments ${cls.filGlow.length} = ${cls.filCore.length}`
      + `   core width ${coreW.join(',')} (constant ${FILAMENT_CORE_W}, unscaled)`
      + `   chimera ${Z} runs / ${cls.chi.length} segments`);
    console.log(`   dash  filament ${FILAMENT_DASH.join('/')} on BOTH passes`
      + `   chimera ${CHIMERA_DASH.join('/')} scrolling, offset this frame`
      + ` ${Math.min(...chiPhases).toFixed(2)}px of ${CHI_PERIOD}`);

    // ── The pixels, one band per layer ────────────────────────────────────
    const rows = [
      ['ANALOGY FILAMENTS', 'filament', [...cls.filGlow, ...cls.filCore], 1.2, 12, FIL_EXCESS],
      ['CHIMERA FRINGES', 'chimera', cls.chi, 1.5, 14, CHI_EXCESS],
    ];
    const bandOk = {};
    for (const [name, label, list, band, shift, need] of rows) {
      if (!list.length) { console.log(`   ${label.padEnd(9)} NO INSTANCES`); bandOk[name] = false; continue; }
      const on = prismBand(W, H, list, band, 0, 0.02);
      const a = prismBand(W, H, list, band, shift, 0.02);
      const b = prismBand(W, H, list, band, -shift, 0.02);
      const off = new Uint8Array(W * H);
      for (let i = 0; i < off.length; i++) off[i] = (a[i] || b[i]) ? 1 : 0;
      const onM = prismMean(img, on);
      const offM = prismMean(img, off, on);
      const excess = onM.mean - offM.mean;
      const thin = onM.n < FZ_MIN_BAND_PX || offM.n < FZ_MIN_BAND_PX;
      bandOk[name] = excess >= need && !thin;
      console.log(`   ${label.padEnd(9)} ${onM.mean.toFixed(2)} (${onM.n}px)`
        + `   control +-${shift} ${offM.mean.toFixed(2)} (${offM.n}px)`
        + `   excess ${excess.toFixed(2)} (need ${need})`
        + (thin ? `   BAND TOO THIN — under ${FZ_MIN_BAND_PX}px, not a measurement` : ''));
    }

    // ── Dash continuity in the RENDERED FRAME ─────────────────────────────
    const dashOk = {};
    for (const [name, label, list, halfW, dash, need] of [
      ['ANALOGY FILAMENTS', 'filament', cls.filGlow, 2.5, FILAMENT_DASH, FIL_DASH_MARGIN],
      ['CHIMERA FRINGES', 'chimera', cls.chi, 2.5, CHIMERA_DASH, CHI_DASH_MARGIN],
    ]) {
      const P = dash[0] + dash[1];
      const byRun = new Map();
      for (const s of list) {
        if (!byRun.has(s.run)) byRun.set(s.run, []);
        byRun.get(s.run).push(s);
      }
      const pooled = [];
      let total = 0;
      for (const run of byRun.values()) {
        const prof = fzProfile(img, run, halfW);
        for (const s of prof.samples) pooled.push(s);
        total += prof.total;
      }
      if (pooled.length < 200) { console.log(`   dash ${label}: too few samples`); dashOk[name] = false; continue; }
      const cont = fzModel(pooled, 'cont', P, dash[0]);
      const rest = fzModel(pooled, 'local', P, dash[0]);
      const anti = fzModel(pooled, 'cont', P, dash[0], P / 2);
      const margin = cont.contrast - rest.contrast;
      // The anti-phase control has to REVERSE, not merely shrink: if the model's
      // "lit" set is measuring something that is not a dash, sliding it half a
      // period cannot flip the sign.
      const reversed = anti.contrast < 0 && Math.abs(anti.contrast) > 0.5 * cont.contrast;
      dashOk[name] = margin >= need && reversed;
      console.log(`   dash ${label.padEnd(9)} ${byRun.size} runs, ${total.toFixed(0)}px of path,`
        + ` ${pooled.length} samples`);
      console.log(`        contrast  continuous ${cont.contrast.toFixed(2)}`
        + `   restarted-per-segment ${rest.contrast.toFixed(2)}`
        + `   MARGIN ${margin.toFixed(2)} (need ${need})`);
      console.log(`        anti-phase control ${anti.contrast.toFixed(2)}`
        + ` (must be under ${(-0.5 * cont.contrast).toFixed(2)})`
        + (reversed ? '' : '   NOT REVERSED — "lit" is not measuring a dash'));
    }

    verdict('ANALOGY FILAMENTS', engaged && countOk && bandOk['ANALOGY FILAMENTS']
      && dashOk['ANALOGY FILAMENTS']);
    verdict('CHIMERA FRINGES', engaged && countOk && bandOk['CHIMERA FRINGES']
      && dashOk['CHIMERA FRINGES']);
  }
} finally { await r7.close(); }


// ── Tally ─────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.ok).length;
console.log(`PRESENCE ${passed}/${results.length}`);
for (const r of results) if (!r.ok) console.log(`   NOT DETECTED: ${r.name}`);
if (passed !== results.length) process.exitCode = 1;
