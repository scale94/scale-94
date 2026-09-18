// Item 5a — A BLOOM SWEEP TO LOOK AT, not a number to argue with.
//
// The author's words about this build, in a live browser: "too much bloom in
// immersive". That is an aesthetic judgement, so this produces PICTURES at
// several values and stops. It does not pick one.
//
// `BLOOM.intensity` is a build-time constant read as a prop
// (`SphereComposite.jsx`: <Bloom intensity={BLOOM.intensity} .../>), so it
// cannot be moved at run time from the page. This therefore PATCHES TRACKED
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
// Only `intensity` moves. One variable at a time: `luminanceThreshold` (0.28,
// which is what decides WHAT blooms rather than how hard) is the other lever
// and deserves its own sweep rather than being confounded with this one.
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
// them is BLOOM.intensity.
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
// bleed channel driven -- before shooting. Same world, same rotation, bloom is
// the only variable, but now there is something for it to act on.
//
//   node scripts/_a3bloom.mjs [W] [H] [DPR] [v1,v2,v3,...] [--bright]
import { launch } from './cdp.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'F:/scale_9.4/src/terminal/art/artComposite.js';
const URL = 'http://localhost:5174/';
const W   = Number(process.argv[2] ?? 1920);
const H   = Number(process.argv[3] ?? 1080);
const DPR = Number(process.argv[4] ?? 1);
const VALUES = (process.argv[5] && !process.argv[5].startsWith('--')
  ? process.argv[5] : '1.1,0.85,0.6,0.4').split(',').map(Number);
const BRIGHT = process.argv.includes('--bright');
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

const original = readFileSync(SRC, 'utf8');
const m = original.match(/(\n\s*intensity:\s*)([0-9.]+)(,)/);
if (!m) throw new Error('could not find BLOOM.intensity in ' + SRC);
console.log('BLOOM.intensity is currently ' + m[2] + '   sweeping ' + VALUES.join(', '));
mkdirSync('F:/scale_9.4/lookbook', { recursive: true });

async function shoot(v) {
  writeFileSync(SRC, original.replace(m[0], m[1] + v + m[3]), 'utf8');
  await sleep(1200);                       // let vite notice the file before a cold load
  const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
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
      + '          edges: e ? e.count : null,'
      + '          ry: b ? +b.rot.ry.toFixed(6) : null,'
      + '          sphereR: b ? +b.sphereR.toFixed(2) : null }; })())'));
    const out = 'lookbook/bloom-' + (BRIGHT ? 'bright-' : '') + String(v).replace('.', 'p') + '.png';
    await page.screenshot({ path: out });
    console.log('   intensity ' + String(v).padEnd(6) + ' -> ' + out
      + '   box ' + state.box + '   edges ' + state.edges
      + '   ry ' + state.ry + '   sphereR ' + state.sphereR);
    return { out, state };
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
const keys = made.map(r => r.state.box + ' | ' + r.state.edges + ' edges | ry '
  + r.state.ry + ' | sphereR ' + r.state.sphereR);
const same = keys.every(k => k === keys[0]);
console.log('world pinned across the sweep: ' + (same ? 'YES -- ' + keys[0]
  : 'NO, THESE FRAMES ARE NOT COMPARABLE:\n  ' + keys.join('\n  ')));
console.log('wrote ' + made.length + ' frames:\n  ' + made.map(r => r.out).join('\n  '));
