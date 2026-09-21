// _a9lens.mjs — light-budget A/B for the node core LENS (`LENS_CENTER_K` /
// `LENS_KNEE_K` / `LENS_KNEE` / `LENS_RIM_K` in `src/terminal/art/artNodes.js`).
//
// Adapted from `_a4hum.mjs` — same method: patch a constant in tracked
// source, shoot a same-build control against the changed build, restore,
// compare by matched frame index. Read `_a4hum.mjs`'s own header before
// touching this; the traps it paid for are the traps here too.
//
// ── WHAT MOVES, AND WHY THAT IS THE CONTROL ─────────────────────────────────
// The core disc used to be a flat opaque fill. It is now a three-stop radial
// ramp (`lensStops()`): transparent centre, `LENS_KNEE_K` at the shoulder,
// `LENS_RIM_K` (already 1) at the rim. Setting `LENS_CENTER_K = 1` AND
// `LENS_KNEE_K = 1` makes all three stops equal to the flat alpha the core
// used to carry — the ramp collapses back to the pre-lens flat disc, in the
// SAME build, same shader, same instance-buffer path. That is the control
// arm. The lens arm patches both back to the shipped 0.35 / 0.485. Nothing
// else in the file moves; `LENS_KNEE` and `LENS_RIM_K` are left alone in
// both arms.
//
// ── THE SHAPE DIFFERENCE FROM `_a4hum.mjs`'s PATCH, AND THE HAZARD IT NAMES ─
// `_a4hum.mjs` patches an object property (`key: value,`) with a regex
// anchored on the property name. These two constants are top-level
// `export const KEY = value;` statements — a different shape, so that regex
// would silently match nothing here. The patch below is anchored on
// `export const KEY = ` instead, and — because a string-replace that matches
// nothing and reports success has already cost this project a session (see
// `_a4hum.mjs`'s own header and MEMORY) — every patch is followed by an
// explicit assertion: the file's bytes must have changed, and the new value
// must be present verbatim. A patch that fails silently throws instead.
//
// ── THE WORLD IS PINNED, exactly as `_a4hum.mjs` pins it ────────────────────
// Each arm/mode combination gets its own fresh browser boot: deterministic
// launch, __virtualize(), __reseed() + __artHarnessReset(), 240 pumped
// frames, a real hover away from every node, settle, 30 more frames, then
// (immersive) the toggle with the resize DELIVERED and 749 more pumps, or
// (normal) 750 pumps flat — `_a4hum.mjs`'s exact budget, for the same
// reason: identical pumped budget across the branch so the MODE (and here,
// the ARM) is the only thing that can move the frame, never a difference in
// how far the sim was allowed to run before the shutter opens.
//
// From that pinned instant, six frames are shot at fixed pump intervals (90
// pumps apart — about 1.5s of virtual time at 60fps), so within one boot the
// frames sample the sphere's own rotation and the chaos state's natural
// drift. That drift is NOT confounded across arms: frame i is always i*90
// pumps past the SAME pinned instant, so frame i of the control and frame i
// of the lens arm are the same point in the sim's own timeline, run twice —
// once flat, once lensed. `_a8ink.mjs` is pointed at matched frame index for
// exactly this reason. Comparing frame 3 of one arm to frame 5 of the other
// would be comparing two different rotations and two different chaos states,
// not the lens.
//
// ── WORLD-PIN VERIFICATION, carried over from `_a4hum.mjs` ──────────────────
// Geometry does not depend on LENS_CENTER_K/LENS_KNEE_K at all (the lens only
// reshapes alpha within the disc, per artNodes.js's own header), so every
// boot in the same mode should agree on box/worldCount/ry/sphereR whatever
// arm patched it. A mismatch means the pin failed, not that the lens moved
// the sphere, and is reported loudly rather than folded into the numbers.
//
// ── RESTORE, in an outer `finally` ───────────────────────────────────────────
// The whole shoot loop is wrapped once, not per-shot, so a throw at any
// point — a bad patch, a dead boot, a failed nav — still restores the file
// from the in-memory original before the process exits. The restore is
// followed by a byte-identical re-read, not assumed.
//
//   node scripts/_a9lens.mjs [W] [H] [DPR]
import { launch } from './cdp.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'F:/scale_9.4/src/terminal/art/artNodes.js';
const URL = 'http://localhost:5174/';
const W   = Number(process.argv[2] ?? 1920);
const H   = Number(process.argv[3] ?? 1080);
const DPR = Number(process.argv[4] ?? 1);

const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 800; })()';
const GL_READY = '(() => {' +
  ' const w = document.querySelector("[data-art-composite]");' +
  ' const g = w && w.querySelector("canvas");' +
  ' const c = ' + SPHERE + ';' +
  ' return !!g && !!c && g.width >= c.clientWidth * 0.9 && g.width > 800; })()';
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';
const clickImmersive = '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => /immersive/i.test((e.innerText || "") + " " + (e.title || "") + " " + (e.getAttribute("aria-label") || "")));' +
  ' if (!b) return false; b.click(); return true; })()';

// Identical to `_a4hum.mjs`'s WORLD_STATE — it reads `__artEdgeState` and
// `__artBgState`, neither of which lives in the file this script patches, so
// it is exactly as valid a pin here. `__artNodeState().core` rides along as
// an extra check specific to this A/B: the lens only reshapes alpha, so the
// number of core discs actually drawn should also agree across every boot.
const WORLD_STATE = '(() => {' +
  ' const c = ' + SPHERE + '; const q = c.getBoundingClientRect();' +
  ' const e = window.__artEdgeState ? window.__artEdgeState() : null;' +
  ' const b = window.__artBgState ? window.__artBgState() : null;' +
  ' const n = window.__artNodeState ? window.__artNodeState() : null;' +
  ' return JSON.stringify({ box: Math.round(q.width) + "x" + Math.round(q.height),' +
  '   worldCount: e ? e.worldCount : null,' +
  '   ry: b ? +b.rot.ry.toFixed(6) : null, sphereR: b ? +b.sphereR.toFixed(2) : null,' +
  '   core: n ? n.core : null }); })()';

const KEYS = ['LENS_CENTER_K', 'LENS_KNEE_K'];
// Anchored on `export const KEY = `, NOT `_a4hum.mjs`'s `key:` object-property
// shape — these are top-level exported consts, a different declaration form.
const findKey = (src, key) =>
  src.match(new RegExp('^export const ' + key + ' = ([\\d.]+);', 'm'));
const patchLine = (src, key, value) =>
  src.replace(new RegExp('^export const ' + key + ' = [\\d.]+;', 'm'),
    'export const ' + key + ' = ' + value + ';');

const original = readFileSync(SRC, 'utf8');
const found = {};
for (const k of KEYS) {
  const m = findKey(original, k);
  if (!m) throw new Error('could not find ' + k + ' in ' + SRC + ' — patch anchor did not match');
  found[k] = m[1];
}
console.log('found in source: ' + KEYS.map(k => k + '=' + found[k]).join('  '));

// ── The two arms ─────────────────────────────────────────────────────────
// control: both stops forced to 1 -> lensStops() returns three equal alphas
// -> the ramp collapses to the pre-lens flat disc. lens: the shipped pair.
const ARMS = {
  control: { LENS_CENTER_K: '1', LENS_KNEE_K: '1' },
  lens:    { LENS_CENTER_K: '0.35', LENS_KNEE_K: '0.485' },
};
const MODES = ['normal', 'imm'];

const NUM_FRAMES = 6;
const FRAME_INTERVAL = 90;   // pumps between shots, ~1.5s of virtual time at 60fps

mkdirSync('F:/scale_9.4/lookbook/lens', { recursive: true });

function patched(armValues) {
  let src = original;
  for (const k of KEYS) {
    src = patchLine(src, k, armValues[k]);
    // Assert the patch actually landed — the exact hazard this file's header
    // calls out. A match failure here throws before any browser is launched.
    const check = findKey(src, k);
    if (!check || check[1] !== armValues[k]) {
      throw new Error('patch for ' + k + ' did not take (wanted ' + armValues[k]
        + ', anchor now reads ' + (check ? check[1] : 'NO MATCH') + ')');
    }
  }
  return src;
}

async function shoot(arm, mode) {
  const src = patched(ARMS[arm]);
  writeFileSync(SRC, src, 'utf8');
  // Assert against the file on disk too, not just the in-memory string.
  const onDisk = readFileSync(SRC, 'utf8');
  if (onDisk !== src) throw new Error('write to ' + SRC + ' did not read back identical');
  for (const k of KEYS) {
    if (!onDisk.includes('export const ' + k + ' = ' + ARMS[arm][k] + ';')) {
      throw new Error('post-write check failed: ' + k + ' = ' + ARMS[arm][k] + ' not found in ' + SRC);
    }
  }
  await sleep(1200);   // let vite notice the file before a cold load

  const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
  const tag = arm + '-' + mode;
  const frames = [];
  try {
    await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
    await sleep(2500);
    if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
    await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
    await page.waitFor(GL_READY, { label: 'GL composite sized', timeoutMs: 40000 });
    await sleep(4000);

    await page.eval('window.__virtualize()');
    await sleep(150);
    await page.eval('window.__reseed(); window.__artHarnessReset();');

    const away = JSON.parse(await page.eval('JSON.stringify((() => {'
      + ' const c = ' + SPHERE + '; const r = c.getBoundingClientRect();'
      + ' return { x: Math.round(r.x + 24), y: Math.round(r.y + 18) }; })())'));

    await page.pump(240);
    await page.hover(away.x, away.y);
    await sleep(25);
    await page.pump(30);

    // Identical pumped budget (750) in both branches -- `_a4hum.mjs`'s
    // discipline -- so mode (and here, arm) is the only thing moving the frame.
    if (mode === 'normal') {
      await page.pump(750);
    } else {
      if (!await page.eval(clickImmersive)) throw new Error('no Immersive control found');
      await page.screenshot();               // force layout (zero frames)
      await sleep(250);                       // the yield a real browser task needs
      await page.pump(1);                     // r3f applies the size
      await page.pump(749);
    }

    for (let i = 0; i < NUM_FRAMES; i++) {
      if (i > 0) await page.pump(FRAME_INTERVAL);
      const path = 'lookbook/lens/' + tag + '-f' + i + '.png';
      await page.screenshot({ path });
      frames.push({ i, path });
    }

    const world = JSON.parse(await page.eval(WORLD_STATE));
    console.log('  ' + arm.padEnd(8) + mode.padEnd(7)
      + ' -> ' + frames.length + ' frames   box ' + world.box + '   worldCount ' + world.worldCount
      + '   ry ' + world.ry + '   sphereR ' + world.sphereR + '   core ' + world.core);
    return { arm, mode, frames, world };
  } finally {
    await page.close();
  }
}

const made = [];
let restoreOk = false;
try {
  console.log('shooting control (' + KEYS.map(k => k + '=' + ARMS.control[k]).join(', ') + ') and lens ('
    + KEYS.map(k => k + '=' + ARMS.lens[k]).join(', ') + '), modes: ' + MODES.join(', '));
  for (const arm of ['control', 'lens']) {
    for (const mode of MODES) {
      made.push(await shoot(arm, mode));
    }
  }
} finally {
  writeFileSync(SRC, original, 'utf8');
  const back = readFileSync(SRC, 'utf8');
  restoreOk = back === original;
  console.log('\nsource restored: ' + (restoreOk ? 'yes, byte-identical' : 'NO -- CHECK git status AND REVERT'));
  if (!restoreOk) {
    console.error('RESTORE VERIFICATION FAILED for ' + SRC + ' -- run: git checkout -- ' + SRC);
  }
}

// World-pin check, per mode, across BOTH arms -- a mismatch here means the
// two arms are not comparable and no ink number that follows should be
// trusted.
for (const mode of MODES) {
  const rows = made.filter(r => r.mode === mode);
  const keys = rows.map(r => r.arm + ': ' + r.world.box + ' | worldCount ' + r.world.worldCount
    + ' | ry ' + r.world.ry + ' | sphereR ' + r.world.sphereR + ' | core ' + r.world.core);
  // Geometry/world fields (not `core`, which the lens should not move either,
  // but is reported as an extra signal) must agree across arms within a mode.
  const geomKeys = rows.map(r => r.world.box + ' | worldCount ' + r.world.worldCount
    + ' | ry ' + r.world.ry + ' | sphereR ' + r.world.sphereR);
  const same = geomKeys.every(k => k === geomKeys[0]);
  console.log('world pinned across the ' + mode + ' arms: '
    + (same ? 'YES -- ' + geomKeys[0] : 'NO, THESE FRAMES ARE NOT COMPARABLE:') );
  console.log('  ' + keys.join('\n  '));
}

console.log('\nwrote ' + made.reduce((n, r) => n + r.frames.length, 0) + ' frames across '
  + made.length + ' boots:\n  ' + made.map(r => r.frames.map(f => f.path).join(', ')).join('\n  '));

console.log('\nnext: for each mode, run\n'
  + '  node scripts/_a8ink.mjs lookbook/lens/control-normal lookbook/lens/lens-normal\n'
  + '  node scripts/_a8ink.mjs lookbook/lens/control-imm lookbook/lens/lens-imm');

if (!restoreOk) process.exitCode = 1;
