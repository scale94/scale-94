// _a10dash.mjs — what the dash antialiasing and the ortho beads cost the frame.
//
// Two questions the unit tests structurally cannot answer:
//
//   1. DOES THE SHADER LINK? A fragment shader that fails to compile draws
//      NOTHING and raises no GL error. This project has shipped exactly that
//      once (the strimer material, whose verbatim GLSL rendered an empty
//      screen because a y-flip reversed the winding and FrontSide culled every
//      face). Source-level token locks prove tokens, not pixels.
//
//   2. WHAT DID IT COST THE BLOOM? Gating the ortho halo REMOVES light from
//      the gaps, and ortho is the brightest halo family on the sphere
//      (orthoGlow 10 +/- 4px with the opaque isOrtho shadow). `hot` counts
//      pixels at or above SphereComposite's 0.28 luminanceThreshold, so it is
//      the direct answer to "does this move the bloom".
//
// SAME-BUILD A/B, three arms, one build each:
//
//   shipped   — as committed.
//   no-bead   — beadGate forced to 0.0: the halo goes back to running
//               continuously along the whole chord. Isolates the bead.
//   hard-cut  — the box filter replaced by the step() it replaced. Isolates
//               the antialiasing, and tests the claim in the spec that a box
//               filter is INK-NEUTRAL by construction because it integrates to
//               the true D/P duty. If that claim is right, hard-cut and
//               shipped agree on `ink` to within the run-to-run floor.
//
// THE RESTORE DISCIPLINE IS THE POINT, and it is not decoration. `git checkout
// -- <file>` restores to the last COMMIT, not to pre-patch bytes, and on this
// project it destroyed an uncommitted edit. The original bytes are held in
// memory, every arm is inside one try/finally so a throw anywhere still
// restores, and the restore is verified by re-reading and comparing rather
// than assumed.
//
// NEVER run this while an artBaseline/artCompare capture is in flight: it
// edits tracked source, Vite HMRs the edit into that page, and the tell is two
// different gitCommit stamps across the manifests.
//
//   node scripts/_a10dash.mjs [W] [H] [DPR]
import { launch } from './cdp.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePng } from './_png.mjs';

const SRC = 'F:/scale_9.4/src/terminal/art/SphereEdges.js';
// 5173, NOT the 5174 the older instruments in this folder point at. vite.config
// declares port 5173 with strictPort, so 5174 never listens and a page loaded
// from it throws unboundedly on every dynamic import.
const URL = 'http://localhost:5173/';
const W   = Number(process.argv[2] ?? 1520);
const H   = Number(process.argv[3] ?? 900);
const DPR = Number(process.argv[4] ?? 1);

const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 700; })()';
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';

// Instance census straight out of the buffer. Proves the dashed/ortho path is
// actually populated, so a zero `ink` can be told apart from "nothing dashed
// was on screen" -- which would make the whole A/B vacuous.
const CENSUS = '(() => {' +
  ' const s = window.__artEdgeState ? window.__artEdgeState() : null;' +
  ' if (!s) return JSON.stringify({ hook: false });' +
  ' const D = s.instances, ST = s.stride;' +
  ' let dashed = 0, ortho = 0;' +
  ' for (let i = 0; i < s.count; i++) {' +
  '   const fl = D[i * ST + 15];' +
  '   if (Math.floor(fl % 256) > 0) dashed++;' +
  '   if (Math.floor(fl / 65536) >= 128) ortho++;' +
  ' }' +
  ' const hist = {};' +
  ' for (let i = 0; i < s.count; i++) {' +
  '   const fl = D[i * ST + 15];' +
  '   const w = D[i * ST + 14];' +
  '   const k = (w <= 0 ? "disc" : "seg") + ":p" + Math.floor(fl % 256)' +
  '     + ":g" + Math.floor(fl / 65536);' +
  '   hist[k] = (hist[k] || 0) + 1;' +
  ' }' +
  ' return JSON.stringify({ hook: true, count: s.count, dashed, ortho, hist,' +
  '   additive: s.additive ? s.additive.count : null,' +
  '   dropped: s.additive ? s.additive.dropped : null }); })()';

// Identical arithmetic to _a8ink.mjs, deliberately: a second ink formula that
// drifted from that one would make the two instruments silently incomparable.
const FLOOR = 0.02;
const HOT   = 0.28;          // SphereComposite's luminanceThreshold
const lum = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;

function measure(png) {
  const { data, width, height } = decodePng(png);
  let ink = 0, lit = 0, hot = 0, max = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = lum(data, (y * width + x) * 4);
      if (v > FLOOR) { lit++; ink += v; }
      if (v >= HOT) hot++;
      if (v > max) max = v;
    }
  }
  return { ink: +ink.toFixed(1), lit, hot, inkPerLit: +(lit ? ink / lit : 0).toFixed(5), max: +max.toFixed(4) };
}

const ARMS = {
  shipped:  null,
  // THE NOISE FLOOR, and it is not optional. The same unpatched build, shot a
  // second time. Every delta below has to clear THIS before it means anything:
  // this project once read 15.28% and 16.51% from two runs of one build and
  // nearly shipped the 1.23-point gap as a finding. A measured arm that does
  // not beat the repeat is reported as UNRESOLVED, not as a small effect.
  'repeat':  null,
  'no-bead': [
    'float beadGate = vIsOrtho * step(0.001, vDash.x) * (1.0 - vIsDisc);',
    'float beadGate = 0.0;',
  ],
  'hard-cut': [
    'float dashMask = clamp(sd / dpxDash + 0.5, 0.0, 1.0);',
    'float dashMask = step(0.0, sd);',
  ],
};

const original = readFileSync(SRC, 'utf8');
for (const [arm, patch] of Object.entries(ARMS)) {
  if (patch && !original.includes(patch[0])) {
    throw new Error('patch anchor for "' + arm + '" did not match — refusing to run');
  }
}
console.log('all patch anchors matched; source is ' + original.length + ' bytes');

async function shoot(arm) {
  const patch = ARMS[arm];
  if (patch) writeFileSync(SRC, original.replace(patch[0], patch[1]), 'utf8');
  else writeFileSync(SRC, original, 'utf8');
  await sleep(600);   // let vite rebuild before the page loads

  // deterministic: installs the frame/RNG/clock shim BEFORE any page script,
  // which is the only way two boots of this sphere are comparable, and it is
  // also what defines window.__pump. Without it the world differs boot to boot
  // -- a documented instability on this project -- and every delta below is
  // that noise wearing a measurement's clothes.
  const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
  try {
    await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
    await sleep(2200);
    if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
    await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
    await sleep(3500);

    // Pin the clock and the RNG, then step a FIXED number of frames, so every
    // arm is measured at the same world state rather than at whatever moment
    // the wall clock happened to land on.
    await page.eval('window.__virtualize && window.__virtualize()');
    await sleep(150);
    await page.eval('window.__reseed && window.__reseed(); window.__artHarnessReset && window.__artHarnessReset();');
    await page.pump(240);

    // Forge the orthogonal bridges this world would otherwise never have.
    // They are a PROP the reasoning engine accumulates over a live session, so
    // a fresh boot has none and both arms below would measure nothing. The
    // hook marks REAL edges and returns the count, which is asserted rather
    // than trusted -- a hook that silently marked nothing would put us right
    // back to reporting boot noise as a measurement.
    const marked = JSON.parse(await page.eval(
      'JSON.stringify(window.__artSetOrthogonal ? window.__artSetOrthogonal(11) : null)'));
    if (!marked || !marked.marked) {
      throw new Error('__artSetOrthogonal marked nothing: ' + JSON.stringify(marked));
    }
    await page.pump(30);

    const census = JSON.parse(await page.eval(CENSUS));

    // REFUSE TO PRODUCE A VACUOUS NUMBER. Both arms below only touch code
    // reached by DASHED instances, and the bead arm only by ORTHO ones. With
    // none on screen every delta is boot noise, and the first run of this
    // script reported -8.26% ink for the bead while the census said zero
    // ortho instances existed. A measurement whose mechanism was never
    // exercised is worse than no measurement.
    if (!census.hook) throw new Error('__artEdgeState missing — cannot verify the population');
    if (!census.dashed) {
      // The histogram is the diagnosis, not decoration: it says WHICH families
      // are on screen. A run of seg:p0:g48..g67 with no p12 is a world whose
      // orthogonal bridges were never forged -- orthogonalBridges is a PROP fed
      // by the reasoning engine over a live session, and a fresh harness boot
      // has none.
      console.log('flag histogram (family:dashPeriod:glowByte): ' + JSON.stringify(census.hist));
      throw new Error('NO DASHED INSTANCES on screen (count=' + census.count
        + ') — the dash arms would measure nothing. Refusing to report.');
    }
    if (!census.ortho) throw new Error('NO ORTHO INSTANCES on screen (dashed=' + census.dashed
      + ') — the bead arm would measure nothing. Refusing to report.');

    const png = await page.screenshot();
    const ink = measure(png);

    // A shader that failed to link draws nothing and logs nothing useful, so
    // check BOTH: the console, and whether anything was actually drawn.
    const errs = (page.consoleErrors() || []).filter(e =>
      /shader|glsl|compile|link|program|webgl/i.test(String(e)));

    return { arm, ...census, ...ink, shaderErrors: errs.length, firstError: errs[0] || null };
  } finally {
    await page.close();
  }
}

const rows = [];
try {
  for (const arm of Object.keys(ARMS)) {
    const r = await shoot(arm);
    rows.push(r);
    console.log(arm.padEnd(10)
      + ' count=' + String(r.count).padStart(5)
      + ' dashed=' + String(r.dashed).padStart(4)
      + ' ortho=' + String(r.ortho).padStart(4)
      + ' ink=' + String(r.ink).padStart(10)
      + ' lit=' + String(r.lit).padStart(8)
      + ' hot=' + String(r.hot).padStart(7)
      + ' shaderErrors=' + r.shaderErrors);
  }
} finally {
  writeFileSync(SRC, original, 'utf8');
  const restored = readFileSync(SRC, 'utf8') === original;
  console.log('restored: ' + (restored ? 'YES (byte-exact)' : 'NO — SOURCE IS DAMAGED, FIX BY HAND'));
  if (!restored) process.exitCode = 1;
}

const base = rows.find(r => r.arm === 'shipped');
if (base) {
  console.log('');
  console.log('vs shipped:'.padEnd(12) + 'ink'.padStart(10) + 'lit'.padStart(10)
    + 'ink/lit'.padStart(10) + 'hot'.padStart(10));
  for (const r of rows) {
    if (r.arm === 'shipped') continue;
    const d = (a, b) => (b === 0 ? 'n/a' : (100 * (a / b - 1)).toFixed(2) + '%');
    console.log(r.arm.padEnd(12)
      + d(base.ink, r.ink).padStart(10)
      + d(base.lit, r.lit).padStart(10)
      + d(base.inkPerLit, r.inkPerLit).padStart(10)
      + d(base.hot, r.hot).padStart(10));
  }
  console.log('');
  const rep = rows.find(r => r.arm === 'repeat');
  if (rep) {
    const floor = Math.abs(100 * (base.ink / rep.ink - 1));
    const hotFloor = Math.abs(100 * (base.hot / rep.hot - 1));
    console.log('');
    console.log('SAME-BUILD FLOOR: ink ' + floor.toFixed(2) + '%, hot ' + hotFloor.toFixed(2) + '%.');
    console.log('Any arm below its own floor is UNRESOLVED, not small. Read "no-bead"');
    console.log('as what the BEAD added and "hard-cut" as what the ANTIALIASING added.');
  }
}
