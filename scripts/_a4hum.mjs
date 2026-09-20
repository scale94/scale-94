// Task 3 — A SWEEP TO LOOK AT, not a number to argue with.
//
// The wire hum (`HUM` in `src/terminal/art/artEdges.js`) breathes the graph's
// edges at rest. Its five constants are AESTHETIC DIALS, to be chosen on
// frames rather than argued about -- see the file header there. A still frame
// cannot show breathing, so this shoots ONE FULL BREATH CYCLE per value --
// six frames spread across `HUM.periodMs` -- and leaves the choosing to the
// author.
//
// `HUM` is a build-time constant read directly by `humGain()`
// (`artEdges.js`), so nothing here can be moved at run time from the page.
// This therefore PATCHES TRACKED SOURCE -- `src/terminal/art/artEdges.js` --
// once per shot, launches a FRESH browser so nothing depends on HMR, pumps
// through one breath, and restores.
//
// ── THE TRAP THIS SHARES WITH `_a3bloom.mjs` ────────────────────────────────
// A session that dies while the patch is applied leaves tracked source
// modified. The restore is in a `finally` and the original bytes are held in
// memory, but a hard kill beats that. RUN `git status` AFTER THIS. If it shows
// artEdges.js modified, `git checkout -- src/terminal/art/artEdges.js` is the
// revert -- there is nothing else in this file worth keeping.
//
// -- THE WORLD IS PINNED, exactly as `_a3bloom.mjs` pins it ------------------
// Each value gets its own browser boot, so each breath-cycle needs its own
// pinning: deterministic launch, __virtualize(), __reseed() +
// __artHarnessReset(), 240 pumped frames, a real hover away from every node,
// settle, 30 more frames, then (immersive) the toggle with the resize
// DELIVERED and 749 more pumps, or (normal) 750 pumps flat -- the same budget
// `_a3bloom.mjs` uses, for the same reason: the pumped budget has to be held
// identical across the branch so the MODE is the only thing that moves the
// frame. From that pinned instant, six frames are shot at equal pump
// intervals across one breath, so within one boot the world is provably the
// same graph at the same rotation throughout, and only the phase of the hum
// (and, across boots, the swept dial) differs.
//
// -- A SCOPE CHANGE FROM THE BRIEF, AND WHY -----------------------------------
// The brief sweeps `amplitude` alone. This also sweeps `wavenumber`, behind
// `--wavenumber`, exactly the way `_a3bloom.mjs` puts `--levels` beside its
// default `intensity` sweep -- because a traced instance buffer over two
// breath periods on the committed build put the MEAN a0 byte across 40 graph
// edges at +/-14.5% against a per-edge design amplitude of +/-15%. If the
// edges were well spread in phase that mean would sit well below the per-edge
// amplitude; at 0.97 of it they are close to IN PHASE -- nearer a global blink
// than a drifting wave. `wavenumber` is the lever for spatial spread, so the
// author needs to see it move too, not just amplitude.
//
// ONE KEY MOVES PER RUN, and BOTH keys go in every filename regardless of
// which one moved -- copying `_a3bloom.mjs`'s naming discipline (see the long
// note at its own screenshot call) -- so an amplitude run and a wavenumber
// run can never silently overwrite each other's frames.
//
// `0` is in the default amplitude set ON PURPOSE, as the CONTROL: a hum
// nobody can see and a hum that is not running produce the same still, and
// the control is the only thing that tells them apart. It has no equivalent
// meaning for wavenumber (0 there is just a slower, perfectly-in-phase
// amplitude sweep, not "hum off"), so it is not forced into that set.
//
// The six-frames-per-breath arithmetic (540 pumps at HUM.periodMs 9000 and
// the harness's 1000/60 ms per pump, sampled every 90) is DERIVED below from
// `HUM.periodMs` as read out of the source at run time, not hard-coded, so
// the rig stays correct if a period is ever swept too.
//
//   node scripts/_a4hum.mjs [W] [H] [DPR] [v1,v2,...] [--wavenumber] [--normal]
import { launch } from './cdp.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'F:/scale_9.4/src/terminal/art/artEdges.js';
const URL = 'http://localhost:5174/';
const W   = Number(process.argv[2] ?? 1920);
const H   = Number(process.argv[3] ?? 1080);
const DPR = Number(process.argv[4] ?? 1);

const WAVENUMBER = process.argv.includes('--wavenumber');
const NORMAL     = process.argv.includes('--normal');

const KEY   = WAVENUMBER ? 'wavenumber' : 'amplitude';
const OTHER = WAVENUMBER ? 'amplitude' : 'wavenumber';
const DEFAULTS = WAVENUMBER ? '2.0,3.5,5.0,7.0' : '0,0.10,0.15,0.22';
const VALUES = (process.argv[5] && !process.argv[5].startsWith('--')
  ? process.argv[5] : DEFAULTS).split(',').map(Number);

const MODES = NORMAL ? ['imm', 'normal'] : ['imm'];

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

// Reads the world back OUT of the running page, `_a3bloom.mjs`-style, so a
// frame set that quietly holds two different worlds says so instead of being
// inferred from the fact that a pinning sequence ran.
const WORLD_STATE = '(() => {' +
  ' const c = ' + SPHERE + '; const q = c.getBoundingClientRect();' +
  ' const e = window.__artEdgeState ? window.__artEdgeState() : null;' +
  ' const b = window.__artBgState ? window.__artBgState() : null;' +
  ' return JSON.stringify({ box: Math.round(q.width) + "x" + Math.round(q.height),' +
  '   worldCount: e ? e.worldCount : null,' +
  '   ry: b ? +b.rot.ry.toFixed(6) : null, sphereR: b ? +b.sphereR.toFixed(2) : null }); })()';

// The hum's own signature in the instance buffer: the mean, min and max of a0
// (the packed alphas' first channel -- see `packAlphas`/`unpackAlphas` in
// SphereEdges.js) across the graph's own edges (`worldCount`, not the
// travelling-pulse discs sharing the same buffer). This is the exact quantity
// the scope-change note above was measured from, read back live per frame
// instead of asserted -- a frame set that claims to sweep the hum but whose
// a0 never moves has not actually reached the render.
const HUM_PROBE = '(() => {' +
  ' const s = window.__artEdgeState ? window.__artEdgeState() : null;' +
  ' if (!s) return JSON.stringify({ error: "no __artEdgeState" });' +
  ' const stride = s.stride, n = s.worldCount;' +
  ' let sum = 0, min = 1, max = 0;' +
  ' for (let i = 0; i < n; i++) {' +
  '   const packed = s.instances[i * stride + 13];' +
  '   const a0 = Math.floor(packed % 256) / 255;' +
  '   sum += a0; if (a0 < min) min = a0; if (a0 > max) max = a0;' +
  ' }' +
  ' return JSON.stringify({ n, meanA0: n ? +(sum / n).toFixed(4) : null,' +
  '   minA0: +min.toFixed(4), maxA0: +max.toFixed(4) }); })()';

const slug = (x) => String(x).replace('.', 'p');
// Anchored on the key name, not the number, per the brief -- and matched
// per-line (`^...` with `m`) so the substitution cannot spill into the
// trailing `// comment` each line carries.
const KEYS = ['amplitude', 'wavenumber'];
const findKey = (src, key) =>
  src.match(new RegExp('^(\\s*' + key + ':\\s*)([\\d.]+)(,)', 'm'));
const patchLine = (src, key, value) =>
  src.replace(new RegExp('^(\\s*' + key + ':\\s*)[\\d.]+,', 'm'), '$1' + value + ',');

const original = readFileSync(SRC, 'utf8');
const found = {};
for (const k of KEYS) {
  const m = findKey(original, k);
  if (!m) throw new Error('could not find HUM.' + k + ' in ' + SRC);
  found[k] = m[2];
}
const periodMatch = original.match(/^\s*periodMs:\s*([\d.]+),/m);
if (!periodMatch) throw new Error('could not find HUM.periodMs in ' + SRC);
const PERIOD_MS = Number(periodMatch[1]);

// Derived, not hard-coded -- see the header. FRAME_MS mirrors the constant
// baked into determinism.mjs's page-side shim (`const FRAME_MS = 1000 / 60`),
// which is the harness's own advance-per-pump and is not itself a HUM dial.
const FRAME_MS = 1000 / 60;
const NUM_FRAMES = 6;
const TOTAL_PUMPS = Math.round(PERIOD_MS / FRAME_MS);
const FRAME_INTERVAL = Math.round(TOTAL_PUMPS / NUM_FRAMES);

console.log('HUM.' + KEY + ' is currently ' + found[KEY] + '   sweeping ' + VALUES.join(', ')
  + '   with HUM.' + OTHER + ' held at ' + found[OTHER]
  + '   modes: ' + MODES.join(', ')
  + '   breath: ' + PERIOD_MS + 'ms = ' + TOTAL_PUMPS + ' pumps, sampled every ' + FRAME_INTERVAL);
mkdirSync('F:/scale_9.4/lookbook/hum', { recursive: true });

const patched = (v) => patchLine(original, KEY, v);

// BOTH keys in every filename, whichever moved -- see the header note. The
// held key's value comes from `found`, the swept key's from `v` itself, so
// the name always reflects what the frame was actually shot at.
const tag = (v, mode) => {
  const amp = KEY === 'amplitude' ? v : found.amplitude;
  const wn  = KEY === 'wavenumber' ? v : found.wavenumber;
  return mode + '-a' + slug(amp) + '-w' + slug(wn);
};

async function shoot(v, mode) {
  writeFileSync(SRC, patched(v), 'utf8');
  await sleep(1200);                       // let vite notice the file before a cold load
  const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
  const t = tag(v, mode);
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

    // Identical pumped budget (750) in both branches -- `_a3bloom.mjs`'s
    // discipline -- so the mode is the only thing that moves the frame.
    if (mode === 'normal') {
      await page.pump(750);
    } else {
      if (!await page.eval(clickImmersive)) throw new Error('no Immersive control found');
      await page.screenshot();               // force layout (zero frames)
      await sleep(250);                       // the yield a real browser task needs
      await page.pump(1);                     // r3f applies the size
      await page.pump(749);
    }

    // From this pinned instant, walk one full breath at equal pump intervals,
    // shooting each frame in place -- one boot, six samples of its own hum.
    for (let i = 0; i < NUM_FRAMES; i++) {
      if (i > 0) await page.pump(FRAME_INTERVAL);
      const path = 'lookbook/hum/' + t + '-f' + i + '.png';
      await page.screenshot({ path });
      const probe = JSON.parse(await page.eval(HUM_PROBE));
      frames.push({ i, path, probe });
    }

    const world = JSON.parse(await page.eval(WORLD_STATE));
    console.log('   ' + KEY + ' ' + String(v).padEnd(6) + ' ' + mode.padEnd(6)
      + ' -> ' + frames.length + ' frames   box ' + world.box + '   worldCount ' + world.worldCount
      + '   ry ' + world.ry + '   sphereR ' + world.sphereR);
    console.log('       a0 mean per frame: '
      + frames.map(f => f.probe.meanA0).join(', '));
    return { v, mode, frames, world };
  } finally {
    await page.close();
  }
}

const made = [];
try {
  for (const v of VALUES) {
    for (const mode of MODES) {
      made.push(await shoot(v, mode));
    }
  }
} finally {
  writeFileSync(SRC, original, 'utf8');
  const back = readFileSync(SRC, 'utf8') === original;
  console.log('\nsource restored: ' + (back ? 'yes, byte-identical' : 'NO -- CHECK git status AND REVERT'));
}

// The sweep is only a sweep if every boot in a mode is the same world. Say so
// out loud rather than leaving it to be inferred from the fact that a pinning
// sequence ran -- `_a3bloom.mjs`'s discipline again. Geometry does not depend
// on HUM.amplitude or HUM.wavenumber at all, so every boot in the same mode
// should agree on box/worldCount/ry/sphereR whatever value was swept; a
// mismatch means the pin failed, not that the dial did something to the
// graph.
for (const mode of MODES) {
  const rows = made.filter(r => r.mode === mode);
  const keys = rows.map(r => r.world.box + ' | worldCount ' + r.world.worldCount
    + ' | ry ' + r.world.ry + ' | sphereR ' + r.world.sphereR);
  const same = keys.every(k => k === keys[0]);
  console.log('world pinned across the ' + mode + ' sweep: '
    + (same ? 'YES -- ' + keys[0] : 'NO, THESE FRAMES ARE NOT COMPARABLE:\n  ' + keys.join('\n  ')));
}
console.log('wrote ' + made.reduce((n, r) => n + r.frames.length, 0) + ' frames across '
  + made.length + ' boots:\n  ' + made.map(r => r.frames.map(f => f.path).join(', ')).join('\n  '));
