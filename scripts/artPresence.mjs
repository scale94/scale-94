// Presence checks for the layers the parity gate structurally cannot see.
// A green 21/21 on these proves "no regression", never "it draws" — the same
// pass follows from deleting the layer. So: switch each one on and look.
import { launch } from './cdp.mjs';
import { decodePng } from './_png.mjs';
import { exergyAlpha, RIFT_ALPHA_NORMAL, RIFT_ALPHA_IMMERSIVE } from '../src/terminal/art/artBackground.js';
import { steadyState, fadeGain } from '../src/terminal/art/artTrail.js';
import {
  EDGE_STRIDE, EDGE_OFF, GLOW_REACH, isDisc, unpackFlags, ADDITIVE_LAYER,
} from '../src/terminal/art/SphereEdges.js';

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
// front-facing, and look for the ghost colour itself. 31 source-over passes at
// alpha 0.069 compound to 0.89, i.e. a nearly opaque (180,180,220) disc.
const GL_READY = `(() => { const w = document.querySelector('[data-art-composite]');
  const g = w && w.querySelector('canvas'); const c = ${SPHERE};
  return !!g && !!c && g.width >= c.clientWidth * 0.9 && g.width > 800; })()`;

const nearestGhostColour = (png) => {
  const { width: W, height: H, data } = decodePng(png);
  let best = 1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const d = Math.hypot(data[i] - 180, data[i + 1] - 180, data[i + 2] - 220);
    if (d < best) best = d;
  }
  return best;
};

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

  await g2.eval('window.__artSetGhosts(null); window.__reseed(); window.__artHarnessReset();');
  await g2.pump(3);
  const gOff = nearestGhostColour(await g2.screenshot({ clip: clip2 }));
  await g2.eval('window.__artSetGhosts(Array.from({length:93},(_,i)=> i%3===2 ? 1 : 0))');
  await g2.pump(3);
  const gOn = nearestGhostColour(await g2.screenshot({ clip: clip2 }));
  const live = JSON.parse(await g2.eval('JSON.stringify(window.__artBgState())')).ghostsLive;

  console.log('GHOST TRAILS  (closest approach to the ghost colour 180,180,220)');
  console.log(`   no session     ${gOff.toFixed(1)}`);
  console.log(`   31 stacked     ${gOn.toFixed(1)}   (${live} live slots published)`);
  // The criterion used to be `gOn < gOff - 10` — a FIXED ABSOLUTE margin — and
  // that made it the fifth time this check called a healthy layer broken.
  //
  // nearestGhostColour is a MINIMUM over the whole frame, so gOff is not a
  // property of the ghost layer at all: it is however close the brightest
  // unrelated pixel (a node, a label) happens to sit to (180,180,220). Once the
  // trail accumulator landed and the whole frame got brighter, gOff fell to
  // 15.4, so the old rule demanded gOn <= 5.4 — i.e. the stacked disc had to
  // match the ghost colour to within 2% before the check would admit the layer
  // existed. The better the rest of the sphere renders, the harder this failed.
  //
  // Replaced with two conditions that are about the layer rather than the frame:
  //   - gOn < 12: 31 stacked ghosts compound to near-opaque, so the disc should
  //     BE the ghost colour. 12 is under 5% of |(180,180,220)|, which says
  //     "this pixel is that colour", not merely "this pixel is bright".
  //   - gOn < gOff * 0.7: and stacking them has to have actually moved it,
  //     which is what distinguishes the layer drawing from the frame being
  //     bright for other reasons.
  // Measured with the trail on: gOff 15.4, gOn 7.5.
  verdict('GHOST TRAILS', live > 0 && gOn < 12 && gOn < gOff * 0.7);
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
function ringsOf(s) {
  const out = [];
  for (let i = 1; i < s.count; i++) {
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

    // Two instances, both strokes (a negative width would make them discs), on
    // the same segment. If the port ever collapses to one instance this is
    // where it says so, before any pixel is read.
    const shapeOk = st.additive.count === 2 && !halo.isDisc && !core.isDisc
      && halo.width > core.width * 3 && halo.glow === 0 && core.glow > 0
      && halo.ax === core.ax && halo.by === core.by;

    console.log(`   instances ${st.additive.count}   halo w ${halo.width.toFixed(2)} glow ${halo.glow}`
      + `   core w ${core.width.toFixed(2)} glow ${core.glow}` + (shapeOk ? '' : '   SHAPE WRONG'));
    console.log(`   core    ${coreOn.mean.toFixed(2)} (${coreOn.n}px)   control ${coreOff.mean.toFixed(2)}`
      + `   excess ${coreExcess.toFixed(2)} (need ${CORE_EXCESS})`);
    console.log(`   halo rim ${rimIn.mean.toFixed(2)} in / ${rimOut.mean.toFixed(2)} out`
      + `   step ${rimStep.toFixed(2)} (need ${HALO_RIM_STEP})`);
    console.log(`   same rim off the bar   step ${rimControl.toFixed(2)} (must be under ${RIM_CONTROL_MAX})`);
    verdict('RESONANCE EDGE', shapeOk && coreExcess >= CORE_EXCESS
      && rimStep >= HALO_RIM_STEP && Math.abs(rimControl) <= RIM_CONTROL_MAX);
  }
} finally { await r5.close(); }

// ── Tally ─────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.ok).length;
console.log(`PRESENCE ${passed}/${results.length}`);
for (const r of results) if (!r.ok) console.log(`   NOT DETECTED: ${r.name}`);
if (passed !== results.length) process.exitCode = 1;
