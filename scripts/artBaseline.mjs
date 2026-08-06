// artBaseline.mjs — capture the /art sphere's pre-WebGL parity baseline.
//
// The spec's acceptance criterion for steps 2-6 is parity with the Canvas2D
// sphere. That is unfalsifiable without a "before", so this captures one:
// reference frames for seven interaction states at three display scales, plus
// the per-frame cost of the draw loop.
//
// Reproducibility: run under scripts/determinism.mjs, which pins Math.random,
// the clock, timers, and frame advancement. Real-time sleeps in the driver
// execute ZERO frames (rAF is queued, not scheduled), so every pump count below
// is a fixed constant. Two cold launches then render byte-identical canvases —
// which is what makes these images a pixel-diff gate rather than a mood board.
//
// One race survives, and it is honest to name it: module and WASM loading are
// real-time, so the app can reach the first pump batch in one of two states.
// Measured over repeated launches it is strictly bistable — the same two boot
// fingerprints, never a third. So the capture GATES on the fingerprint: the
// first run records it, later runs relaunch until they match. A comparison run
// that cannot reach the recorded fingerprint fails loudly instead of quietly
// diffing two different worlds.
//
// Not covered here: wall-clock frame rate. Headless SwiftShader renders
// Canvas2D in software and runs rAF unthrottled (~350fps), so its frame
// *interval* is meaningless. What IS comparable before and after is the work
// done inside the draw callback, which this measures. For a true wall-clock
// number see artFrameTime.mjs, which runs headed on the real GPU.
//
//   node scripts/artBaseline.mjs [--out DIR] [--url URL]

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { launch } from './cdp.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const OUT = arg('--out', 'baseline/art-sphere-2d');
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

const CANVAS_HASH = `(() => {
  const c = ${SPHERE}; const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i += 13) { h ^= d[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
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

// ── Boot to a settled sphere on a fixed frame budget ─────────────────────────
async function bootToSphere(page) {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  await sleep(2500);
  await page.pump(120);
  await sleep(500);
  // Re-seed immediately before the sphere mounts. Module evaluation consumes
  // Math.random() before any app code runs, so without this a step that merely
  // adds a dependency shifts the RNG stream and every captured hash changes
  // while the renderer is untouched — which is what step 2 did. Re-seeding here
  // means the reference compares rendering, not module-graph side effects.
  await page.eval('window.__reseed(); window.__reseedEachFrame(true);');
  if (!await page.eval(clickByText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await sleep(1500);
  await page.pump(300);
  await sleep(800);
  await page.pump(300);          // canvas sizing is rAF-driven and slow to settle
  await sleep(500);
  await page.pump(120);
  if (!await page.eval(SPHERE_READY)) throw new Error('sphere never reached full size');
}

// CDP acknowledges an input command before the renderer has processed the
// event, so pumping immediately after a dispatch races the handler: the input
// lands either in this frame or the next. Costs zero frames to wait it out, and
// without it the projector scale diverged from `hover` onward while its boot
// fingerprint and idle frame still matched.
const settle = () => sleep(25);

// Find a node by hovering a fixed coarse grid. Constant frame cost, so it does
// not perturb reproducibility; returns the first grid point with a node under it.
async function findNode(page, rect, { cols = 9, rows = 5 } = {}) {
  let hit = null;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round(rect.x + rect.w * (c + 1) / (cols + 1));
      const y = Math.round(rect.y + rect.h * (r + 1) / (rows + 1));
      await page.hover(x, y);
      await settle();
      await page.pump(2);                       // fixed cost per probe
      if (!hit) { const lab = await page.eval(HOVERED); if (lab) hit = { x, y, label: lab }; }
    }
  }
  return hit;
}

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
    await page.screenshot({ path: file, clip: clipOf(await page.eval(SPHERE_RECT)) });
    const hash = await page.eval(CANVAS_HASH);
    shots[state] = { file, canvasHash: hash };
    console.log(`   ${state.padEnd(18)} ${hash}`);
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

  // 3. hover
  const node = await findNode(page, rect);
  if (!node) throw new Error('no node found on the hover grid');
  await page.hover(node.x, node.y);
  await settle();
  await page.pump(45);
  await shot('hover');
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
  const fireNode = await findNode(page, rect);
  await page.click(fireNode.x, fireNode.y);
  await sleep(800);
  await page.pump(25);
  await shot('fired-cascade');
  await page.pump(400);            // let it expire

  // 6. resonance — arm the mode, then shift-click two nodes
  await page.hover(away.x, away.y);
  await settle();
  await page.pump(30);
  if (!await page.eval(clickByText('resonance'))) throw new Error('no resonance button');
  await page.pump(20);
  const rA = await findNode(page, rect);
  await page.click(rA.x, rA.y, { modifiers: 8 });     // 8 = Shift
  await sleep(500);
  await page.pump(30);
  const rB = await findNode(page, rect);
  await page.click(rB.x, rB.y, { modifiers: 8 });
  await sleep(800);                                   // resonance analysis is async
  await page.pump(45);
  await shot('resonance');
  await page.eval(clickByText('resonance'));       // disarm
  await page.pump(30);

  // 7. immersive on / off — vignette + bloom live here today.
  // Immersive re-parents the container to `fixed inset-0`, and the canvas
  // resize that follows is rAF-driven and slow (the cold sizing above needs
  // ~480 frames). Settling with less caught the shot mid-resize, with the
  // sphere stranded at its old size inside the new viewport.
  await page.hover(away.x, away.y);
  await settle();
  await page.pump(30);
  if (!await page.eval(clickByTitle('Immersive mode'))) throw new Error('no immersive button');
  await page.pump(600);
  await shot('immersive-on');
  await page.resetCosts();
  await page.pump(600);
  const immersiveCosts = await page.frameCosts();

  await page.eval(clickByTitle('Immersive mode'));
  await page.pump(600);
  await shot('immersive-off');

  const errors = page.consoleErrors();
  manifest.scales[scale.name] = {
    bootFingerprint: fingerprint,
    viewport: { width: scale.width, height: scale.height, dpr: scale.dpr },
    sphereCss: { w: Math.round(rect.w), h: Math.round(rect.h) },
    sphereBackingStore: store,
    hoveredNode: node.label,
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

for (const s of SCALES) {
  await captureScale(s, manifest, previous?.scales?.[s.name]?.bootFingerprint ?? null);
}

await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\nwrote ${OUT}/manifest.json`);
