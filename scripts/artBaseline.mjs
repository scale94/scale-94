// artBaseline.mjs — capture the /art sphere's pre-WebGL parity baseline.
//
// The spec's acceptance criterion for steps 2-6 is parity with the Canvas2D
// sphere. That is unfalsifiable without a "before", so this captures one:
// reference frames for seven interaction states at three display scales, plus
// the per-frame cost of the draw loop.
//
// Reproducibility: run under scripts/determinism.mjs, which pins Math.random,
// the clock, timers, and frame advancement. Real-time sleeps in the driver and
// `page.screenshot` both execute ZERO frames (rAF is queued, not scheduled;
// measured, not assumed — `scripts/_t9frames.mjs`), so every pump count below
// is a fixed constant.
//
// A FIXED PUMP COUNT IS NOT THE SAME THING AS A REPRODUCIBLE PICTURE, and this
// header used to claim it was ("two cold launches render byte-identical
// canvases"). They do not, and the gap cost this branch a whole capture state:
// `immersive-off` correlated 0.047 between two runs of ONE build, which is what
// two unrelated states score, while every clock the harness recorded agreed to
// four decimal places. Three causes, all of them the same shape — something
// outside the pump budget deciding what the world looks like:
//
//   1. The app boots under REAL timing (it has to, or React never commits and
//      r3f never mounts), and per-frame state accumulated during that boot was
//      not reset. `breathPhase` scales `sphereR`, which scales every node
//      position. See __artHarnessReset in ArtTab.jsx.
//   2. The fired-cascade block's frame budget is not a constant — the shot is
//      placed relative to an async arrival — and every later state inherited
//      the difference. It now re-establishes a known world afterwards.
//   3. The immersive resize is delivered by a ResizeObserver, a real browser
//      task, so which side of the 600-frame settle it landed on was a coin
//      flip. It is now delivered and CHECKED before the settle is spent.
//
// The lesson generalises past this file: a gate that only pins the clock cannot
// see anything that does not accrue from the clock. Read `view` in the manifest
// — rotation, sphere size, both buffer sizes — before quoting any row.
//
// One race survives, and it is honest to name it: module and WASM loading are
// real-time, so the app can reach the first pump batch in one of two states.
// The capture GATES on a boot fingerprint: the first run into an output
// directory records it, later runs into the SAME directory relaunch until they
// match. Note what that does not cover — two runs into two different
// directories share no expectation at all, which is exactly the shape a
// same-build null takes. In practice they never landed on the same fingerprint
// and still correlated 0.98+, so the fingerprint is a coarser thing than it
// looks; treat the bistability claim as unverified rather than inherited.
//
// Not covered here: wall-clock frame rate. Headless SwiftShader renders
// Canvas2D in software and runs rAF unthrottled (~350fps), so its frame
// *interval* is meaningless. What IS comparable before and after is the work
// done inside the draw callback, which this measures. For a true wall-clock
// number see artFrameTime.mjs, which runs headed on the real GPU.
//
//   node scripts/artBaseline.mjs [--out DIR] [--url URL] [--scale NAME]
//
// `--scale` restricts the run to one of the three SCALES below. A reference set
// must always be captured at all three; the flag is for iterating on the
// harness itself, where three of everything is three times the wait and none of
// the extra information.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { launch } from './cdp.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const OUT = arg('--out', 'baseline/art-sphere-2d');
const RESEED_CB = process.argv.includes('--reseed-per-callback');
const URL = arg('--url', 'http://localhost:5174/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Three display scales. The projector is the Ars Electronica install target;
// the retina row exists because step 2 uploads the 2D canvas as a texture every
// frame, and that cost scales with the backing store, not the CSS box.
const SCALES = [
  { name: 'laptop-1520x900@1x',    width: 1520, height: 900,  dpr: 1 },
  { name: 'laptop-1520x900@2x',    width: 1520, height: 900,  dpr: 2 },
  { name: 'projector-1920x1080@1x', width: 1920, height: 1080, dpr: 1 },
];

// Two traps stacked on top of each other here.
//
// The sphere is NOT the largest canvas on the page — a hidden full-viewport
// ambient overlay is, so `offsetParent` filtering is required or the capture
// reads all-zero pixels and reports a false regression.
//
// And from step 2 there are TWO visible canvases at exactly the same size: the
// 2D sphere and the GL bloom composite stacked on it. Sorting by width alone
// picks whichever the DOM happens to return first. The gate is defined on the
// 2D canvas's content, so select it explicitly: getContext('2d') returns null
// on a canvas that already has a WebGL context, which distinguishes them.
// NEVER probe with getContext(). Calling getContext('2d') on a canvas that has
// not got a context yet permanently claims it as a 2D canvas, and the WebGL
// context r3f wants can then never be created ("Canvas has an existing context
// of a different type"). Using it as a discriminator silently disabled the
// composite for a whole capture run, which then produced a bloom-free set of
// reference images that looked plausible. The harness must not be able to
// change what it is measuring.
//
// SphereComposite marks its own subtree with data-art-composite, so the GL
// canvas can be excluded structurally. (Identifying the 2D canvas by its inline
// `cursor: grab` was tried and is wrong: ArtTab switches the cursor to
// `pointer` over a node and the selector then finds nothing mid-capture.)
const SPHERE = `[...document.querySelectorAll('canvas')]
  .filter(c => c.offsetParent && !c.closest('[data-art-composite]'))
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;
const SPHERE_RECT = `(() => { const c = ${SPHERE}; const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`;

const SPHERE_READY = `(() => { const c = ${SPHERE};
  return !!c && c.getBoundingClientRect().width > 800; })()`;

// The GL composite has mounted AND sized itself to the 2D canvas. Waiting on
// this before virtualising is what makes the capture see the bloom layer.
const GL_READY = `(() => {
  const w = document.querySelector('[data-art-composite]');
  const g = w && w.querySelector('canvas');
  const c = ${SPHERE};
  return !!g && !!c && g.width >= c.clientWidth * 0.9 && g.width > 800;
})()`;

const CANVAS_HASH = `(() => {
  const c = ${SPHERE}; const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i += 13) { h ^= d[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
})()`;


// A coarse perceptual signature: mean luminance over a 32x18 grid, 0-255.
// Byte-equality is not achievable for this app (see the README), so the gate is
// a tolerance on this instead. Coarse enough to ignore a few particles landing
// differently, fine enough that a layer failing to render, shifting, or changing
// brightness moves it well outside the noise floor.
const SIGNATURE = `(() => {
  const c = ${SPHERE}; const g = c.getContext('2d');
  const W = c.width, H = c.height, GX = 32, GY = 18;
  const d = g.getImageData(0, 0, W, H).data;
  const sums = new Float64Array(GX * GY), cnt = new Float64Array(GX * GY);
  for (let y = 0; y < H; y += 2) {
    const gy = Math.min(GY - 1, (y * GY / H) | 0);
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const k = gy * GX + Math.min(GX - 1, (x * GX / W) | 0);
      sums[k] += lum; cnt[k]++;
    }
  }
  return Array.from(sums, (v, k) => Math.round((v / (cnt[k] || 1)) * 10) / 10);
})()`;

const HOVERED = `(() => {
  const spans = [...document.querySelectorAll('span')]
    .filter(s => s.style.position === 'absolute' && s.style.font && s.textContent);
  let best = null;
  for (const s of spans) { const o = parseFloat(s.style.opacity || '0');
    if (o > 0.9 && (!best || o > best.o)) best = { o, text: s.textContent, left: parseFloat(s.style.left) }; }
  return best && best.text;
})()`;

const clickByText = (pattern, flags = 'i') => `(() => {
  const re = new RegExp(${JSON.stringify(pattern)}, ${JSON.stringify(flags)});
  const b = [...document.querySelectorAll('button')].find(e => re.test(e.innerText || ''));
  if (!b) return false; b.click(); return true; })()`;

const clickByTitle = (frag) => `(() => {
  const b = [...document.querySelectorAll('button')].find(e => (e.title || '').includes(${JSON.stringify(frag)}));
  if (!b) return false; b.click(); return true; })()`;

// ── Boot under REAL timing, then take control ───────────────────────────────
// The determinism shim stays inert until __virtualize(). Virtualising from page
// load stops React committing concurrent work (its scheduler compares
// performance.now() against a yield deadline), and r3f's <Canvas> then never
// mounts its children — the GL layer stays blank while looking fine. So the app
// boots and mounts normally, and only the captured window is deterministic.
async function bootToSphere(page) {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  await sleep(2500);
  if (!await page.eval(clickByText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere at full size', timeoutMs: 40000 });
  // Let the GL composite finish mounting and the awakening settle, still real-time.
  await page.waitFor(GL_READY, { label: 'GL composite sized', timeoutMs: 40000 });
  await sleep(4000);

  await page.eval('window.__virtualize()');
  // DIAGNOSTIC ONLY -- see __reseedEachCallback in scripts/determinism.mjs.
  // Gives every rAF callback the same stream offset instead of only the first
  // one, to test whether the immersive-block divergence is the app's draw-path
  // thresholds being displaced by three.js's UUID draws. It CHANGES WHICH
  // RANDOM VALUES THE APP SEES, so a set captured with it is a different
  // picture and must never be used as a reference.
  if (RESEED_CB) {
    await page.eval('window.__reseedEachCallback(true)');
    console.log('   [diagnostic] __reseedEachCallback(true) -- NOT a reference capture');
  }
  if (!await page.eval('window.__isVirtual()')) throw new Error('shim did not virtualize');
  // Let in-flight real-rAF loops migrate into the virtual queue. The shim wraps
  // passthrough callbacks so they re-queue instead of being lost, but the
  // browser still has to fire them once.
  await sleep(150);

  // Booting under real timing leaves the sphere carrying real-time history —
  // rotation angle, node positions, particles — which differs run to run. Reset
  // it now that the clock and RNG are ours, so the captured window is
  // reproducible. Dev-only hook; absent from production builds.
  if (!await page.eval('typeof window.__artHarnessReset === "function"')) {
    throw new Error('__artHarnessReset missing — is this a production build?');
  }
  await page.eval('window.__reseed(); window.__artHarnessReset();');

  // From here every count is a fixed constant, so the frame budget is identical
  // on every run.
  await page.pump(240);
}

// CDP acknowledges an input command before the renderer has processed the
// event, so pumping immediately after a dispatch races the handler: the input
// lands either in this frame or the next. Costs zero frames to wait it out, and
// without it the projector scale diverged from `hover` onward while its boot
// fingerprint and idle frame still matched.
const settle = () => sleep(25);

// Sweep a fixed coarse grid, hovering each point, and collect up to `max`
// DISTINCT nodes. Constant frame cost — every grid point is hovered, settled and
// pumped whatever is found — so it does not perturb reproducibility.
//
// `onFound` fires at the grid point where the node was seen, while the cursor is
// still on it. That timing is the whole point. THE SPHERE ROTATES CONTINUOUSLY,
// including under virtual time, and the sweep runs 90 frames: a point recorded
// early and used after the sweep has finished is stale by up to 88 frames of
// rotation. MEASURED, in the state below: the node found on grid point 12 had
// left the front of the sphere by the end of the sweep — its label was gone from
// the DOM altogether, and the click at its recorded position landed on empty
// canvas. Acting at detection reduces that to zero frames.
//
// (The two callers that only want a position — `hover` and `fired-cascade` —
// still take the first hit and use it afterwards. They are on the same 88-frame
// stale path and survive it only because their nodes happen not to rotate out of
// reach: measured drift of 32 px and 50 px on the run this comment was written
// from. That is luck, not design, and is called out in the report; it is not
// changed here because moving those two states would move reference images this
// task has no mandate over.)
//
// `skip` is a set of labels to pass over — the fired-cascade state uses it to
// retry on a different node — and is honoured alongside the distinctness set.
async function findNodes(page, rect,
                         { cols = 9, rows = 5, max = 1, onFound = null, skip = null } = {}) {
  const hits = [];
  const seen = new Set();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round(rect.x + rect.w * (c + 1) / (cols + 1));
      const y = Math.round(rect.y + rect.h * (r + 1) / (rows + 1));
      await page.hover(x, y);
      await settle();
      await page.pump(2);                       // fixed cost per probe
      if (hits.length < max) {
        const lab = await page.eval(HOVERED);   // evals advance no frames
        if (lab && !seen.has(lab) && !(skip && skip.has(lab))) {
          seen.add(lab);
          hits.push({ x, y, label: lab });
          if (onFound) await onFound({ x, y, label: lab });
        }
      }
    }
  }
  return hits;
}

// The original single-node call, unchanged in behaviour: first hit, whole grid
// swept, same frame cost as before.
async function findNode(page, rect, opts = {}) {
  return (await findNodes(page, rect, { ...opts, max: 1 }))[0] ?? null;
}

// The resonance toggle's own DOM label, `◈ resonance [n/2]` while armed. Read
// straight out of React's render, which is a source INDEPENDENT of the pixels
// the shot then captures — the point being that a state named after a mode has
// to prove it engaged before its image is worth anything.
const RESONANCE_LABEL = `(() => { const b = [...document.querySelectorAll('button')]
  .find(e => /resonance/i.test(e.innerText || '')); return b ? b.innerText : null; })()`;

function stats(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const q = p => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return {
    n: s.length,
    mean: +(s.reduce((t, v) => t + v, 0) / s.length).toFixed(3),
    p50: +q(0.50).toFixed(3), p95: +q(0.95).toFixed(3),
    p99: +q(0.99).toFixed(3), max: +s[s.length - 1].toFixed(3),
  };
}

// Boot until the post-boot fingerprint matches `expected`. The first scale to
// run has no expectation and simply records what it got.
const MAX_BOOT_TRIES = 8;
async function bootGated(scale, expected) {
  for (let attempt = 1; attempt <= MAX_BOOT_TRIES; attempt++) {
    const page = await launch({
      url: URL, width: scale.width, height: scale.height, dpr: scale.dpr, deterministic: true,
    });
    await bootToSphere(page);
    const fingerprint = await page.eval(CANVAS_HASH);
    if (!expected || fingerprint === expected) return { page, fingerprint, attempt };
    console.log(`   boot race landed on ${fingerprint}, want ${expected} — relaunching (${attempt}/${MAX_BOOT_TRIES})`);
    await page.close();
  }
  throw new Error(`could not reach boot fingerprint ${expected} in ${MAX_BOOT_TRIES} tries`);
}

// ── One scale: capture every state ──────────────────────────────────────────
async function captureScale(scale, manifest, expectFingerprint) {
  console.log(`\n── ${scale.name} ─────────────────────────`);
  const { page, fingerprint, attempt } = await bootGated(scale, expectFingerprint);
  console.log(`   boot fingerprint ${fingerprint}${attempt > 1 ? ` (after ${attempt} tries)` : ''}`);

  const rect = await page.eval(SPHERE_RECT);
  const store = await page.eval(`(() => { const c = ${SPHERE}; return { w: c.width, h: c.height }; })()`);
  console.log(`   css ${Math.round(rect.w)}x${Math.round(rect.h)}  backing store ${store.w}x${store.h}`);

  // Clip to the sphere's own box rather than the whole viewport. The DOM label
  // overlay is positioned inside that box so it is still captured, but the nav
  // bar, masthead and control strip are not — page chrome changing must not
  // register as a sphere parity failure. Also roughly halves the stored bytes.
  const clipOf = (r) => ({ x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 });

  const shots = {};
  const shot = async (state) => {
    const file = `${OUT}/${scale.name}__${state}.png`;
    // Immersive re-parents the container, so re-read the box each time.
    const png = await page.screenshot({ path: file, clip: clipOf(await page.eval(SPHERE_RECT)) });
    // TWO hashes, because they gate different things.
    //   canvasHash — the 2D canvas's own pixels. What steps 2-6 must not
    //                perturb until they deliberately move a layer off it.
    //   shotHash   — the COMPOSITED result, 2D under GL. From step 3 this is
    //                the only one that sees the migrated layers at all.
    const canvasHash = await page.eval(CANVAS_HASH);
    const signature = await page.eval(SIGNATURE);
    const shotHash = createHash('sha256').update(png).digest('hex').slice(0, 12);
    // WHICH node layers this frame actually contained, counted at each draw
    // call (ArtTab's nodeCensusRef). Two hashes can tell you a frame changed;
    // they cannot tell you whether the layer you are certifying was on screen
    // at all — and eight of the node block's thirteen layers are not, in any
    // state here. A capture that missed a layer scores perfect parity whether
    // that layer ships or is deleted, which is the failure this project has
    // now repeated six times. Costs zero frames: evals do not advance the
    // clock. Absent (null) on a build predating the census.
    const nodeCensus = JSON.parse(await page.eval(
      'JSON.stringify(window.__artNodeState ? window.__artNodeState() : null)'));
    // WHERE THE SPHERE IS POINTING when the shot was taken. `elapsedS` above
    // proves the virtual clock agrees between two runs; it does NOT prove they
    // are the same picture, because rotation does not accrue from the clock.
    // Two same-build runs whose elapsedS matched to 0.06s at every state
    // captured entirely different faces of the sphere in immersive, and nothing
    // in this manifest could see it. Costs zero frames. Null on a build
    // predating the readback.
    // WHAT THE WORLD ACTUALLY IS, not just where the camera is pointing.
    //
    // `rot` + `sphereR` + the buffer sizes were enough to rule the CAMERA out,
    // and that is all they can do. MEASURED, post-step-5 task 3: five same-build
    // runs recorded identical rot, identical sphereR, identical buffers and an
    // identical layer census at every state, and one of them still produced an
    // `immersive-off` frame that correlated 0.032 with the others — the score an
    // unrelated state gets. Everything this manifest could see agreed while the
    // node positions did not, so there was nothing to attribute the difference
    // to and the search had to go through the app.
    //
    // `world` closes that: a hash over the edge layer's whole written instance
    // range, which is projected node geometry, so two runs with the same hash
    // have the same picture and two runs without it differ HERE, at this state,
    // rather than somewhere in the four states before it. Costs zero frames —
    // evals do not advance the clock — and needs no app change, because
    // `__artEdgeState` already publishes the range for the ring instruments.
    //
    // `arch` is here because `initState()` does not lay the nodes out from the
    // seed. It restores them from `initialPositionsRef` when the temporal
    // archaeology has loaded and scatters them around the cluster anchors when
    // it has not, and that load is async and real-timed. Two runs that reset at
    // different sides of it get two different worlds from the same seed.
    const view = JSON.parse(await page.eval(
      `JSON.stringify((() => { const b = window.__artBgState && window.__artBgState();
        const c = ${SPHERE};
        const g = document.querySelector('[data-art-composite] canvas');
        const es = window.__artEdgeState && window.__artEdgeState();
        let world = null;
        if (es && es.instances) {
          let h = 2166136261 >>> 0;
          const dv = new DataView(new ArrayBuffer(4));
          for (let i = 0; i < es.instances.length; i++) {
            dv.setFloat32(0, es.instances[i]);
            const u = dv.getUint32(0);
            h = (h ^ (u & 255)) >>> 0;        h = Math.imul(h, 16777619) >>> 0;
            h = (h ^ ((u >>> 8) & 255)) >>> 0;  h = Math.imul(h, 16777619) >>> 0;
            h = (h ^ ((u >>> 16) & 255)) >>> 0; h = Math.imul(h, 16777619) >>> 0;
            h = (h ^ ((u >>> 24) & 255)) >>> 0; h = Math.imul(h, 16777619) >>> 0;
          }
          world = { hash: h.toString(16).padStart(8, '0'), edges: es.count,
                    e0: es.first ? [+es.first[0].toFixed(3), +es.first[1].toFixed(3)] : null };
        }
        return b ? { rot: b.rot, dragV: b.dragV, hovered: b.hovered,
                     world,
                     arch: { loaded: b.archLoaded, len: b.archLen },
                     // The size the draw loop was actually projecting at, and the
                     // two buffers behind it. Immersive changes all three, and it
                     // changes them on a ResizeObserver — a REAL browser task —
                     // so which pumped frame they change on is not the harness's
                     // to choose. Recorded because sphereR is what scales every
                     // node position, and a shot taken at a different sphereR is
                     // a different picture at an identical rotation.
                     sphereR: +b.sphereR.toFixed(3),
                     canvas: c.width + 'x' + c.height,
                     gl: g ? g.width + 'x' + g.height : null } : null; })())`));
    shots[state] = { file, canvasHash, shotHash, signature, nodeCensus, view };
    const live = nodeCensus
      ? Object.entries(nodeCensus).filter(([, v]) => typeof v === 'number' && v > 0)
          .map(([k]) => k).join(',')
      : 'no census';
    console.log(`   ${state.padEnd(18)} 2d=${canvasHash.padEnd(9)} shot=${shotHash}`
      + (view?.rot ? `  ry=${view.rot.ry.toFixed(4)} rx=${view.rot.rx.toFixed(4)}` : ''));
    console.log(`   ${''.padEnd(18)} layers: ${live}`);
  };

  const cx = Math.round(rect.x + rect.w / 2), cy = Math.round(rect.y + rect.h / 2);
  const away = { x: Math.round(rect.x + 24), y: Math.round(rect.y + 18) };

  // 1. idle — cursor off the sphere, nothing engaged
  await page.hover(away.x, away.y);
  await settle();
  await page.pump(90);
  await shot('idle');

  // 2. idle frame cost — the number step 2 has to beat
  await page.resetCosts();
  await page.pump(600);
  const idleCosts = await page.frameCosts();

  // 3. hover — SHOT AT DETECTION, cursor still on the node.
  //
  // It used to sweep the whole grid, then hover the recorded point afterwards.
  // That point is stale by up to 88 frames of rotation, and `hoveredRef` is
  // written ONLY by the pointermove handler: the single move dispatched after
  // the sweep decides the hover for the whole state, so if the node has
  // rotated off that pixel by then, `nodeAt` returns null and the state named
  // after the hover layer does not contain it. Not hypothetical — this task
  // moved the world by 0.13% and the projector scale's `hover` lost `coreHover`
  // on the next capture, while both laptop scales kept it. The block's own
  // comment already called the old arrangement "luck, not design".
  //
  // Acting at detection makes it robust rather than lucky, and it is what
  // findNodes was given `onFound` for and what the resonance state below
  // already does. Once the pointermove has landed on the node, no later frame
  // can take the hover away, because nothing moves the cursor again. Frame cost
  // is unchanged in shape: every grid point still costs the same, and the hit
  // adds a fixed 45.
  let hoverShot = false;
  const node = await findNode(page, rect, {
    onFound: async () => {
      await settle();
      await page.pump(45);
      await shot('hover');
      hoverShot = true;
    },
  });
  if (!node || !hoverShot) throw new Error('no node found on the hover grid');
  // And prove it, from the layer's own census rather than from the pixels the
  // shot just took. A state that does not contain the layer it is named after
  // scores perfect parity whether that layer ships or is deleted — the failure
  // this branch has now recorded seven times. Null census = a build older than
  // the census hook (the step-wide control is exactly that), so skip, not fail.
  if (shots.hover.nodeCensus && !(shots.hover.nodeCensus.coreHover > 0)) {
    throw new Error(`hover: the state does not contain coreHover (hovered ${node.label});`
      + ` layers present: ${Object.entries(shots.hover.nodeCensus)
          .filter(([, v]) => typeof v === 'number' && v > 0).map(([k]) => k).join(',')}`);
  }
  console.log(`   (hovered ${node.label})`);

  // 4. mid-drag — held, not released, so inertia has not started
  const drag = await page.drag(cx + 140, cy, cx - 140, cy - 60, 14);
  await settle();
  await page.pump(20);
  await shot('mid-drag');
  await page.resetCosts();
  await page.pump(600);
  const dragCosts = await page.frameCosts();
  await drag.release();
  await settle();
  await page.pump(150);            // let inertia decay

  // 5. fired cascade — click a node, capture while the cascade is live.
  // Firing kicks off async work (kernel run, observer emit). Absorb it with a
  // real-time sleep BEFORE pumping: sleeps cost zero frames, so this settles the
  // async without advancing the cascade animation. Without it this was the one
  // state in twenty-one that failed to reproduce.
  //
  // NO PUMP COUNT CAN REACH THE PULSE RINGS, and raising 25 to 35 would not
  // have fixed it. `__pump(n)` (scripts/determinism.mjs) runs n rAF callbacks in
  // ONE synchronous loop and never yields, so no promise continuation, React
  // scheduler task or worker message is delivered between those frames. The
  // cascade's pulse is set by `applyAttractor` (useKineticEdges.js), which
  // arrives on the ASYNC kernel result — so it can never fire inside a single
  // pump call. Measured: pump(25), (35), (60), (100), (160), (240) after the
  // click all give ZERO rings, and so does sleeping 1.5s, 2.5s or 4s first.
  // Only frames INTERLEAVED with yields produce them, and each page.pump(1) is
  // a CDP round trip, i.e. exactly such a yield. See scripts/_t7pulse2.mjs.
  //
  // And WHICH node is fired decides whether there is a ring at all.
  // `applyAttractor` only sets pulse = 1.0 when one end of an edge dominates the
  // other; on a node whose activation stays in the middle it takes the
  // proportional branch and the pulse never clears PULSE_DRAW_CUTOFF. Measured:
  // firing `replicator` gave 3 rings on both laptop manifests, while `ceei` —
  // which is what the projector's grid happens to hit first — gave none in 200
  // stepped frames. So retry on a different node rather than storing a
  // reference that is missing the layer for one scale out of three.
  const RINGS = '(window.__artEdgeState && window.__artEdgeState().rings) ?? -1';
  const tried = new Set();
  let ringsNow = 0, steps = 0, fireNode = null;
  for (let attempt = 0; attempt < 3 && ringsNow <= 0; attempt++) {
    fireNode = await findNode(page, rect, { skip: tried });
    if (!fireNode) break;
    tried.add(fireNode.label);
    await page.click(fireNode.x, fireNode.y);
    await sleep(800);
    // 60 is generous: when the rings come at all they arrive after 20-24
    // stepped frames, and when they do not, no number of frames helps.
    for (let i = 0; i < 60 && ringsNow <= 0; i++) {
      await page.pump(1);
      ringsNow = Number(await page.eval(RINGS));
      steps = i + 1;
    }
  }
  // A fixed offset AFTER arrival, not a fixed count from the click. The ring
  // DECAYS across its ~48-frame life (radius 5.39 -> 2.77 px, mid alpha 0.345
  // -> 0.039), so what decides how it looks is frames-since-arrival. 10 keeps it
  // near peak (alpha ~0.29) with the whole fade still ahead.
  //
  // The cost, stated plainly: the arrival step count varies run to run, so this
  // state now carries a frame or two of rotation jitter that a fixed pump did
  // not. That is the price of the reference actually containing the layer, and
  // it is the right trade on a branch where five layers were invisible to a
  // gate that scored them green.
  for (let i = 0; i < 10; i++) await page.pump(1);
  ringsNow = Number(await page.eval(RINGS));
  if (ringsNow > 0) console.log(`   fired-cascade carries ${ringsNow} pulse ring(s) (arrived after ${steps} stepped frames, fired ${fireNode.label}, ${tried.size} node(s) tried)`);
  else console.log(`   !! fired-cascade carries NO pulse ring — tried ${[...tried].join(', ') || 'no node'}`);
  await shot('fired-cascade');

  // ── RE-ESTABLISH A KNOWN WORLD ───────────────────────────────────────────
  // This is the ONLY block in the capture whose frame budget is not a fixed
  // constant, and it says so above: the shot is placed at a fixed offset from
  // an arrival whose own frame index is set by real async timing. MEASURED, on
  // one pair of same-build runs at the projector scale, the rings arrived after
  // 24 stepped frames in one and 15 in the other — and the attempt loop can add
  // a further 90 (a whole findNode sweep) whenever the first node fired gives
  // no ring.
  //
  // A frame or two of rotation jitter is what that was assumed to cost. It is
  // not. Every state AFTER this one inherits the difference, and the sphere's
  // graph physics has discrete thresholds — edges are born and die — so a
  // nine-frame offset here does not stay a nine-frame offset. It became a
  // WHOLLY DIFFERENT WORLD by the last state captured: `immersive-off` at the
  // projector scale correlated 0.062 between two runs of one build, which is
  // the same number two unrelated states score. `immersive-on` and the two
  // laptop scales were already ~0.99 by then, so this was the last cause
  // standing, and it is not about immersive at all — immersive is simply last.
  //
  // So do not try to make the arrival deterministic; it cannot be, and the
  // arrival-relative shot above is the right design for the ring's own look.
  // Take the shot, then hand the following states a world that does not depend
  // on when it landed. `__reseed()` first, exactly as bootToSphere does, so
  // initState's own draws start from a known stream position rather than from
  // wherever the previous frame left it.
  await page.eval('window.__reseed(); window.__artHarnessReset();');
  await page.pump(400);            // let it expire, and settle the reset world

  // 6. resonance — arm the mode, then shift-click two DIFFERENT nodes.
  //
  // Two independent defects kept this state empty for the whole of steps 2-4,
  // and either one alone is enough to empty it:
  //
  //   1. It called findNode TWICE. The sweep starts from the same origin every
  //      time and returned the first hit, so both calls returned the SAME node —
  //      and ArtTab's shift-click handler toggles (`cur.includes(node.id) ?
  //      filter : append`), so the second click undid the first.
  //   2. Both clicks were dispatched at coordinates recorded up to 88 frames
  //      earlier, and the sphere rotates throughout. MEASURED: the recorded
  //      node's label had left the DOM by the time the click was sent, and the
  //      click landed on empty canvas — `nodeAt` returned null and the handler
  //      took its no-node branch.
  //
  // So the mode was armed with ZERO nodes selected: no resonance bar, and not
  // even the node dimming, which needs `length > 0`. Deleting the entire
  // resonance layer scored 21/21 identically against this capture set.
  //
  // Both are fixed the same way, and it is the way scripts/artPresence.mjs's
  // RESONANCE EDGE check already does it: ONE sweep that shift-clicks each
  // distinct node at the grid point where it was found, cursor still on it.
  await page.hover(away.x, away.y);
  await settle();
  await page.pump(30);
  if (!await page.eval(clickByText('resonance'))) throw new Error('no resonance button');
  await page.pump(20);
  const resNodes = await findNodes(page, rect, {
    max: 2,
    onFound: async (n) => {
      await page.click(n.x, n.y, { modifiers: 8 });   // 8 = Shift
      await sleep(300);
      await page.pump(5);                             // fixed cost per selection
    },
  });
  if (resNodes.length < 2) {
    throw new Error('resonance: needed two distinct nodes on the hover grid, got '
      + (resNodes.map(n => n.label).join(' + ') || 'none'));
  }
  await sleep(800);                                   // resonance analysis is async
  await page.pump(45);
  // Assert the selection from React's OWN label before the shot. That is a
  // source independent of the pixels being captured, and without it this state
  // reported a hovered node, a similarity and a green comparator row for four
  // steps while holding nothing at all. Costs zero frames.
  const resLabel = await page.eval(RESONANCE_LABEL);
  if (resLabel !== '◈ resonance [2/2]') {
    throw new Error(`resonance: expected two selected nodes, toggle reads "${resLabel}"`
      + ` (clicked ${resNodes.map(n => n.label).join(' + ')})`);
  }
  await shot('resonance');
  console.log(`   (resonance ${resNodes.map(n => n.label).join(' + ')})`);
  await page.eval(clickByText('resonance'));       // disarm
  await page.pump(30);

  // 7. immersive on / off — vignette + bloom live here today.
  // Immersive re-parents the container to `fixed inset-0`, and the canvas
  // resize that follows is rAF-driven and slow (the cold sizing above needs
  // ~480 frames). Settling with less caught the shot mid-resize, with the
  // sphere stranded at its old size inside the new viewport.
  //
  // Pumping alone never finished the job, and the way it failed was invisible.
  // MEASURED, with the frame counter exposed from BackdropPass: after the
  // toggle the GL drawing buffer stays at its PRE-immersive size for the whole
  // settle, however long it is — 600 frames, 750 frames — and then resizes on
  // the frame immediately after the first screenshot. r3f measures its
  // container with a ResizeObserver, this page starves that observer of
  // notifications (see SphereComposite's SizeSync note), and it is the
  // screenshot's own forced layout that finally delivers one. So the shot is
  // always the last frame before the resize, at the old buffer size.
  //
  // That is not cosmetic. The trail accumulator (SphereTrail.js) is reconciled
  // against that buffer and its targets are REALLOCATED — hence emptied — when
  // it changes, and the shot sits on the wrong side of that. With the fade on,
  // `immersive-on` scored ratio 1.000 against a same-session control while a
  // sweep inside the same session measured 1.23 on every settled frame: the one
  // row that matters most for the exhibit was structurally blind.
  //
  // So force the delivery with a throwaway capture, then settle.
  //
  // THAT ORDER WAS THE REMAINING RACE, and it is the reason this block was
  // rewritten. Forcing AFTER the settle leaves the question of which size those
  // 600 frames ran at to real timing: between the click and the pump there is
  // only a CDP round trip, and whether React's commit lands inside it is a coin
  // flip. MEASURED both ways in the same probe (`scripts/_t9force.mjs`) — with
  // a real-time gap after the click the GL buffer resizes on the very first
  // pumped frame, and with none it stays old for the whole 600-frame batch,
  // because `__pump` never yields and the commit cannot be delivered inside it.
  // Two same-build runs then settle at two different sizes, the graph physics
  // reads `dimsRef` and evolves differently, and `immersive-on` correlates
  // 0.560. It heals by `immersive-off` — the layout relaxes back — which is
  // exactly why it read as an immersive-only, intermittent fault rather than a
  // world that had diverged for good.
  //
  // So deliver the resize FIRST, at a cost of exactly one frame, and prove it
  // landed before spending the settle. The screenshot and the real-time sleep
  // both cost zero frames (measured: `scripts/_t9frames.mjs`); the single pump
  // is what lets r3f apply the new size to its drawing buffer. Then the whole
  // settle happens at one size, and the total between click and shot is the
  // same 750 frames it always was.
  const SIZES = `(() => { const c = ${SPHERE};
    const g = document.querySelector('[data-art-composite] canvas');
    return { canvas: c.width + 'x' + c.height, gl: g ? g.width + 'x' + g.height : 'none' }; })()`;
  const deliverResize = async (label) => {
    await page.screenshot({ clip: clipOf(await page.eval(SPHERE_RECT)) });  // forces layout
    await sleep(250);                        // lets the observer and React commit land
    await page.pump(1);                      // r3f applies the size inside a frame
    const s = await page.eval(SIZES);
    if (s.canvas !== s.gl) {
      throw new Error(`${label}: the resize never reached the GL buffer — `
        + `2D canvas ${s.canvas}, GL ${s.gl}. Every frame of the settle would run `
        + `at the wrong size, and the two immersive states would stop being `
        + `reproducible. Do not widen this check; find out why the commit is late.`);
    }
  };
  // And the same re-establishment the cascade block does, for the same reason.
  // The resonance sweep hovers 45 grid points and clicks two of them, and CDP
  // acknowledges an input before the renderer has processed it — `settle()`
  // narrows that race but cannot close it, so an input lands in this frame or
  // the next. MEASURED: two same-build runs left the resonance state with `ry`
  // 0.59925 vs 0.60350, which is two frames' worth of the hover damping and
  // nothing else. Two frames. The graph physics turned it into a wholly
  // different configuration by `immersive-off` (r = 0.042) — the same
  // amplification the cascade showed, from an even smaller seed.
  //
  // Chasing every frame-level race in an input path that races by construction
  // is not winnable. Handing the states that must be reproducible a world that
  // does not depend on the path is. Each reset costs an eval and a settle.
  await page.eval('window.__reseed(); window.__artHarnessReset();');
  await page.pump(240);
  await page.hover(away.x, away.y);
  await settle();
  await page.pump(30);
  if (!await page.eval(clickByTitle('Immersive mode'))) throw new Error('no immersive button');
  await deliverResize('immersive-on');
  await page.pump(749);
  await shot('immersive-on');
  await page.resetCosts();
  await page.pump(600);
  const immersiveCosts = await page.frameCosts();

  await page.eval(clickByTitle('Immersive mode'));
  await deliverResize('immersive-off');
  await page.pump(749);
  await shot('immersive-off');

  const errors = page.consoleErrors();
  manifest.scales[scale.name] = {
    bootFingerprint: fingerprint,
    viewport: { width: scale.width, height: scale.height, dpr: scale.dpr },
    sphereCss: { w: Math.round(rect.w), h: Math.round(rect.h) },
    sphereBackingStore: store,
    hoveredNode: node.label,
    // Which pair the resonance state actually compared. The similarity drives
    // the bar's width, alpha and glow, so a run that lands on a different pair
    // is not comparable with one that did not — this is the field that says so.
    resonanceNodes: resNodes.map(n => n.label),
    shots,
    drawCostMs: {
      idle:      stats(idleCosts.draw ?? []),
      drag:      stats(dragCosts.draw ?? []),
      immersive: stats(immersiveCosts.draw ?? []),
    },
    allRafCallbacksIdle: Object.fromEntries(
      Object.entries(idleCosts).map(([k, v]) => [k, stats(v)]),
    ),
    consoleErrors: errors,
  };

  console.log(`   draw cost idle      p50 ${manifest.scales[scale.name].drawCostMs.idle?.p50}ms  p95 ${manifest.scales[scale.name].drawCostMs.idle?.p95}ms`);
  console.log(`   draw cost drag      p50 ${manifest.scales[scale.name].drawCostMs.drag?.p50}ms  p95 ${manifest.scales[scale.name].drawCostMs.drag?.p95}ms`);
  console.log(`   draw cost immersive p50 ${manifest.scales[scale.name].drawCostMs.immersive?.p50}ms  p95 ${manifest.scales[scale.name].drawCostMs.immersive?.p95}ms`);
  if (errors.length) console.log(`   console errors: ${errors.length}`);

  await page.close();
}

// ── main ────────────────────────────────────────────────────────────────────
await mkdir(OUT, { recursive: true });

// If a manifest already exists, hold every scale to the fingerprint it recorded
// so a re-capture lands in the same world as the reference it replaces.
let previous = null;
try { previous = JSON.parse(await readFile(`${OUT}/manifest.json`, 'utf8')); } catch { /* first run */ }
const manifest = {
  capturedAt: new Date().toISOString(),
  gitCommit: process.env.BASELINE_COMMIT ?? null,
  url: URL,
  renderer: 'headless chrome --headless=new --enable-unsafe-swiftshader (software GL)',
  deterministic: true,
  note: 'draw cost is main-thread work inside the rAF callback, in ms. Frame '
      + 'INTERVAL is not measured here: headless software GL runs rAF '
      + 'unthrottled, so interval is meaningless. See artFrameTime.mjs.',
  scales: {},
};

const ONLY = arg('--scale', null);
const RUN = ONLY ? SCALES.filter(s => s.name === ONLY) : SCALES;
if (!RUN.length) throw new Error(`--scale ${ONLY} matches none of: ${SCALES.map(s => s.name).join(', ')}`);
for (const s of RUN) {
  await captureScale(s, manifest, previous?.scales?.[s.name]?.bootFingerprint ?? null);
}

await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\nwrote ${OUT}/manifest.json`);
