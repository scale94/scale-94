// Item 5a — A BLOOM SWEEP TO LOOK AT, not a number to argue with.
//
// The author's words about this build, in a live browser: "too much bloom in
// immersive". That is an aesthetic judgement, so this produces PICTURES at
// several values and stops. It does not pick one.
//
// `BLOOM` is a build-time constant read as props
// (`SphereComposite.jsx`: <Bloom intensity={BLOOM.intensity} .../>), so nothing
// here can be moved at run time from the page. This therefore PATCHES TRACKED
// SOURCE -- `src/terminal/art/artComposite.js` -- once per value, launches a
// FRESH browser so nothing depends on HMR, shoots, and restores.
//
// ── THE TRAP THIS SHARES WITH `_nullPatch` ─────────────────────────────────
// A session that dies while the patch is applied leaves tracked source
// modified. The restore is in a `finally` and the original bytes are held in
// memory, but a hard kill beats that. RUN `git status` AFTER THIS. If it shows
// artComposite.js modified, `git checkout -- src/terminal/art/artComposite.js`
// is the revert -- there is nothing else in this file worth keeping.
//
// ONE KEY MOVES PER RUN, and the run says which. `--levels` sweeps the mipmap
// pyramid depth (HOW FAR the bloom reaches); the default sweeps `intensity`
// (HOW HARD it hits). `luminanceThreshold` (0.28, which decides WHAT blooms) is
// a third lever and deserves its own sweep rather than being confounded with
// either of these.
//
// -- THE WORLD IS PINNED, AND THE FIRST VERSION OF THIS DID NOT PIN IT -------
// Each value needs its own browser, so each frame is a separate boot. Left
// live, every frame lands at a different rotation with a different set of lit
// nodes, and then the sweep is not a sweep: a whole-frame luminance reading
// across the first run fell 1.000 / 0.889 / 0.782 / 0.785 -- NOT monotonic in
// the one thing being varied, because the boot-to-boot difference was the same
// size as the effect. Four frames of four different worlds are also far harder
// to judge by eye, which is the entire point of producing them.
//
// So this pins the world exactly as artBaseline does before its immersive shot:
// deterministic launch, __virtualize(), __reseed() + __artHarnessReset(), 240
// pumped frames, a real hover away from every node, settle, 30 more frames,
// then the toggle with the resize DELIVERED (screenshot to force layout, a real
// sleep for the yield, one pump for r3f) and 749 frames to settle. Every frame
// is then the same world at the same rotation and the only difference between
// them is the swept key.
//
// -- AND THE PINNED STATE HAS TO CONTAIN THE THING BEING JUDGED -------------
// Pinning made the frames comparable and then chose a state with almost no
// bloom in it. `immersive-on` after a harness reset is DIM: 23k lit pixels
// against 62k in a live boot, because the awakening has finished, nothing is
// firing and no particles are alive. Whole-frame luminance across the sweep
// moved 0.4% end to end, and the frames look nearly identical to the eye.
//
// A sweep of a state where the effect is absent is not evidence that the effect
// is small. So `--bright` re-runs the same pinned sequence and then lights the
// piece up the way the live boot does -- the beacon pulse back on and the
// bleed channel driven -- before shooting.
//
// `--bright` was still not the state the complaint is about. The author's
// report is "if there's only three nodes being triggered the bloom is fine ...
// if there's like 5 nodes being wired and fired that's when the bloom gets
// blown out", so `--fired` stages THAT: the resonance mode armed with two
// nodes selected, a real hover-confirmed click firing a cascade, and the bright
// pass on top. `--fired` implies `--bright`.
//
// -- WHY THE FIRED STATE IS PINNED AND artBaseline's IS NOT -----------------
// artBaseline's fired-cascade block pumps UNTIL the pulse rings arrive and then
// shoots at a fixed offset, and it retries on up to three different nodes. Both
// are right for a reference -- the state has to contain the layer -- and both
// are fatal here, because a variable frame count is a variable ROTATION, and
// this sweep's whole claim is that rotation is identical across its frames.
//
// So the budget after the click is FIXED (`FIRE_STEPS` yielding pumps, no
// retry) and the ring arrival frame is REPORTED rather than waited on. If the
// rings land on a different frame in two runs, that is a difference between the
// frames and the run says so instead of hiding it inside a wait.
//
// The grid sweeps are safe for the same reason artBaseline's are: `findNodes`
// hovers, settles and pumps EVERY grid point whatever it finds, so its frame
// cost is a constant 2 per point and does not depend on the result.
//
//   node scripts/_a3bloom.mjs [W] [H] [DPR] [v1,v2,...] [--bright|--fired] [--levels]
import { launch } from './cdp.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'F:/scale_9.4/src/terminal/art/artComposite.js';
const URL = 'http://localhost:5174/';
const W   = Number(process.argv[2] ?? 1920);
const H   = Number(process.argv[3] ?? 1080);
const DPR = Number(process.argv[4] ?? 1);
const LEVELS = process.argv.includes('--levels');
const KEY = LEVELS ? 'levels' : 'intensity';
const DEFAULTS = LEVELS ? '8,6,5,4,3' : '1.1,0.85,0.6,0.4';
const VALUES = (process.argv[5] && !process.argv[5].startsWith('--')
  ? process.argv[5] : DEFAULTS).split(',').map(Number);
const FIRED  = process.argv.includes('--fired');
const BRIGHT = FIRED || process.argv.includes('--bright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settle = () => sleep(25);

// Frames pumped after the fire click, one at a time so each is a real yield.
// artBaseline measured the rings arriving 20-24 stepped frames after the click
// when they arrive at all, and never at any count when they do not, so 70 is
// generous rather than hopeful -- and unlike artBaseline's loop it is spent
// whatever happens, which is what keeps the rotation constant.
const FIRE_STEPS = 70;

// How many nodes the fired pass clicks, over and above the two the resonance
// selection holds. The author's comparison is three against five, so this side
// of it has to be able to reach five.
const FIRE_NODES = 4;

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

// The hovered node's own DOM label, and the resonance toggle's. Both are
// artBaseline's, and both are DOM reads rather than constants lifted out of
// src/ -- the kind of copy that put `S = 17` in artSmoke across a stride bump.
const HOVERED = '(() => {' +
  ' const spans = [...document.querySelectorAll("span")]' +
  '   .filter(s => s.style.position === "absolute" && s.style.font && s.textContent);' +
  ' let best = null;' +
  ' for (const s of spans) { const o = parseFloat(s.style.opacity || "0");' +
  '   if (o > 0.9 && (!best || o > best.o)) best = { o, text: s.textContent }; }' +
  ' return best && best.text; })()';
const RESONANCE_LABEL = '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => /resonance/i.test(e.innerText || "")); return b ? b.innerText : null; })()';
const RINGS = '(window.__artEdgeState && window.__artEdgeState().rings) ?? -1';

/** Hover a fixed coarse grid and collect up to `max` DISTINCT nodes, calling
 *  `onFound` at the grid point where each was seen with the cursor still on it.
 *  CONSTANT frame cost -- every point is hovered, settled and pumped whatever is
 *  found -- which is what makes it usable inside a pinned sweep. Lifted from
 *  artBaseline, which is not a module and exports nothing. */
async function findNodes(page, rect, { cols = 9, rows = 5, max = 1, onFound = null, skip = null } = {}) {
  const hits = [], seen = new Set();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round(rect.x + rect.w * (c + 1) / (cols + 1));
      const y = Math.round(rect.y + rect.h * (r + 1) / (rows + 1));
      await page.hover(x, y);
      await settle();
      await page.pump(2);
      if (hits.length < max) {
        const lab = await page.eval(HOVERED);
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

const original = readFileSync(SRC, 'utf8');
const m = original.match(new RegExp('(\\n\\s*' + KEY + ':\\s*)([0-9.]+)(,)'));
if (!m) throw new Error('could not find BLOOM.' + KEY + ' in ' + SRC);
console.log('BLOOM.' + KEY + ' is currently ' + m[2] + '   sweeping ' + VALUES.join(', ')
  + '   state: ' + (FIRED ? 'fired (resonance + cascade + bright)' : BRIGHT ? 'bright' : 'plain'));
mkdirSync('F:/scale_9.4/lookbook', { recursive: true });

async function shoot(v) {
  writeFileSync(SRC, original.replace(m[0], m[1] + v + m[3]), 'utf8');
  await sleep(1200);                       // let vite notice the file before a cold load
  const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
  const notes = {};
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

    if (!await page.eval(clickImmersive)) throw new Error('no Immersive control found');
    // The resize delivery, as artBaseline does it: a screenshot to force layout
    // (zero frames), a real-time sleep so the observer and React's commit can
    // land (zero frames, but it is the YIELD a real browser task needs), then
    // one pump so r3f applies the size.
    await page.screenshot();
    await sleep(250);
    await page.pump(1);
    await page.pump(749);

    // ── The fired pass ────────────────────────────────────────────────────
    // Everything here runs INSIDE immersive. That was worth checking rather
    // than assuming: the /CHAOS control chrome stays mounted and visible under
    // the immersive container (the resonance toggle reads `◈ resonance` at
    // (1655, 216) at 1920x1080), so the mode can be armed after the toggle and
    // nothing has to survive the re-layout `initState()` does on the way in.
    if (FIRED) {
      // The immersive box is NOT the viewport -- it is inset below the app
      // header -- so the grid has to be sized from the canvas as it is now,
      // after the toggle, not from the rect the normal-mode sphere had.
      const rect = JSON.parse(await page.eval('JSON.stringify((() => {'
        + ' const c = ' + SPHERE + '; const r = c.getBoundingClientRect();'
        + ' return { x: Math.round(r.x), y: Math.round(r.y),'
        + '          w: Math.round(r.width), h: Math.round(r.height) }; })())'));
      notes.grid = rect.w + 'x' + rect.h + ' at ' + rect.x + ',' + rect.y;

      await page.hover(away.x, away.y);
      await settle();
      await page.pump(30);
      if (!await page.eval(clickText('resonance'))) throw new Error('no resonance button');
      await page.pump(20);

      // ONE sweep that shift-clicks each distinct node where it was found, not
      // two sweeps returning the same node at stale coordinates. Both of those
      // defects kept artBaseline's resonance state empty for three whole steps.
      const resNodes = await findNodes(page, rect, {
        max: 2,
        onFound: async (n) => {
          await page.click(n.x, n.y, { modifiers: 8 });   // 8 = Shift
          await sleep(300);
          await page.pump(5);                             // fixed cost per selection
        },
      });
      await sleep(800);                                   // analysis is async: zero frames
      await page.pump(45);
      notes.resonance = await page.eval(RESONANCE_LABEL);
      notes.resNodes = resNodes.map(n => n.label).join(' + ') || 'none';
      if (resNodes.length < 2 || notes.resonance !== '\u25c8 resonance [2/2]') {
        throw new Error('resonance: expected two selected nodes, toggle reads "'
          + notes.resonance + '" (clicked ' + notes.resNodes + ')');
      }

      // Fire SEVERAL nodes, and DIFFERENT ones from the two holding the
      // resonance selection, so the cascade and the resonance edge are separate
      // structures rather than the same pair counted twice.
      //
      // Several, because the complaint is explicitly comparative -- three nodes
      // fine, five blown out -- and a one-node fire cannot show the difference
      // between the two. One sweep with an onFound click, like the resonance
      // selection above, so the cost stays the same constant 90 frames whatever
      // it finds and every click lands with the cursor still on its node.
      const skip = new Set(resNodes.map(n => n.label));
      const fired = await findNodes(page, rect, {
        max: FIRE_NODES, skip,
        onFound: async (n) => {
          await page.click(n.x, n.y);
          await sleep(300);
          await page.pump(5);                             // fixed cost per fire
        },
      });
      if (!fired.length) throw new Error('fired: no further nodes on the hover grid');
      notes.fired = fired.map(n => n.label).join(' + ');
      await sleep(800);                                   // async kernel + observer emit
      // A FIXED budget, spent whatever happens. Record the frame the rings
      // arrive on instead of waiting for them -- see the header.
      let rings = 0, arrivedAt = null;
      for (let i = 0; i < FIRE_STEPS; i++) {
        await page.pump(1);
        if (rings <= 0) {
          rings = Number(await page.eval(RINGS));
          if (rings > 0) arrivedAt = i + 1;
        }
      }
      notes.rings = rings;
      notes.arrivedAt = arrivedAt;
    }

    // The bright pass. Both hooks are dev-only and deterministic -- the beacon
    // is put back into awakening phase 1 with its t0 held mid-window so
    // stepAwakening does not advance out of it, and the bleed channel is driven
    // on every third node. Neither takes a draw from artRandom, so the world
    // measured below is still the same world.
    if (BRIGHT) {
      await page.eval('window.__artForceBeacon(true)');
      await page.eval('window.__artForceBleed(0.85)');
      await page.pump(90);
    }

    // Read the world back OUT of the running page rather than trusting the
    // sequence. If two frames of this sweep disagree here they are not a sweep,
    // and a shot labelled with a value it was not taken at is worse than none.
    const state = JSON.parse(await page.eval('JSON.stringify((() => {'
      + ' const c = ' + SPHERE + '; const q = c.getBoundingClientRect();'
      + ' const e = window.__artEdgeState ? window.__artEdgeState() : null;'
      + ' const b = window.__artBgState ? window.__artBgState() : null;'
      + ' return { box: Math.round(q.width) + "x" + Math.round(q.height),'
      + '          edges: e ? e.count : null, world: e ? e.worldCount : null,'
      + '          rings: e ? e.rings : null,'
      + '          ry: b ? +b.rot.ry.toFixed(6) : null,'
      + '          sphereR: b ? +b.sphereR.toFixed(2) : null }; })())'));
    const tag = (FIRED ? 'fired-' : BRIGHT ? 'bright-' : '')
      + (LEVELS ? 'lv' : '') + String(v).replace('.', 'p');
    const out = 'lookbook/bloom-' + tag + '.png';
    await page.screenshot({ path: out });
    console.log('   ' + KEY + ' ' + String(v).padEnd(6) + ' -> ' + out
      + '   box ' + state.box + '   edges ' + state.edges + '/' + state.world
      + '   ry ' + state.ry + '   sphereR ' + state.sphereR
      + (FIRED ? '   rings ' + state.rings + ' (arrived frame ' + notes.arrivedAt + ')'
        + '   res ' + notes.resNodes + '   fired ' + notes.fired : ''));
    return { out, state, notes };
  } finally {
    await page.close();
  }
}

const made = [];
try {
  for (const v of VALUES) made.push(await shoot(v));
} finally {
  writeFileSync(SRC, original, 'utf8');
  const back = readFileSync(SRC, 'utf8') === original;
  console.log('\nsource restored: ' + (back ? 'yes, byte-identical' : 'NO -- CHECK git status AND REVERT'));
}

// The sweep is only a sweep if every frame is the same world. Say so out loud
// rather than leaving it to be inferred from the fact that a pinning sequence
// ran: pinning can fail silently, and a frame set that quietly holds four
// different worlds looks exactly like one that holds one.
//
// The fired state adds three more things that can differ between two runs and
// would otherwise hide inside "same rotation": WHICH nodes the grid selected,
// WHICH node was fired, and the frame the pulse rings arrived on. All three are
// in the key, because a frame set where the cascade landed 4 frames earlier in
// one shot is not a sweep of the bloom either.
const keys = made.map(r => r.state.box + ' | ' + r.state.edges + '/' + r.state.world
  + ' edges | ry ' + r.state.ry + ' | sphereR ' + r.state.sphereR
  + (FIRED ? ' | res ' + r.notes.resNodes + ' | fired ' + r.notes.fired
    + ' | rings ' + r.state.rings + '@' + r.notes.arrivedAt : ''));
const same = keys.every(k => k === keys[0]);
console.log('world pinned across the sweep: ' + (same ? 'YES -- ' + keys[0]
  : 'NO, THESE FRAMES ARE NOT COMPARABLE:\n  ' + keys.join('\n  ')));
console.log('wrote ' + made.length + ' frames:\n  ' + made.map(r => r.out).join('\n  '));
