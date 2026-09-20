// artCadenceRate.mjs — does the sphere emit at its AUTHORED rate, or at the
// display's refresh rate?
//
// This exists because the parity harness cannot answer that question, and it is
// important to be blunt about why. `scripts/determinism.mjs` virtualises
// performance.now() and advances it by exactly 1000/60 per pumped frame, so
// every artBaseline capture is a 60fps capture. A cadence gated on a frame
// counter and a cadence gated on the clock are IDENTICAL at 60fps by
// construction — that is the whole design goal of the fix. artCompare is
// therefore structurally blind here: 21/21 ADMISSIBLE proves the 60fps picture
// did not move, and says nothing whatsoever about refresh-rate dependence.
//
// So this measures fires per WALL second against a real rAF loop, and it runs
// HEADLESS ON PURPOSE. Headless SwiftShader drives rAF unthrottled at ~200-400
// fps, which is the one condition on this machine that resembles the 360Hz
// QD-OLED the bug was reported on. Headed would be capped at the panel's vsync
// (60Hz here), where the bug is invisible by definition.
//
// ── The control, and why the numbers are worthless without it ───────────────
//
// A probe that reports "20 fires/sec, as authored" proves nothing on its own:
// a broken probe reports a plausible number too. So the driver installs its own
// FRAME-COUNTED gate in the same rAF loop — the exact `++n % 3 === 0` this
// commit removed — and reports it alongside. The control is wrong by
// construction. If the control reads ~fps/3 while the app's period-3 gate reads
// ~20/sec, the instrument can tell the two apart and the app is on the right
// side. If they agree, either the fix failed or the probe is measuring nothing,
// and the run is inadmissible either way.
//
// ── The second observable, which is NOT a rate ──────────────────────────────
//
// `__artNodeState().particleGlow` is the live particle POPULATION, and it is
// reported because it exposes something the fires count cannot: `stepParticles`
// still ages every particle by `lifes[i] += 1` PER DRAW, and integrates
// position and drag per draw too. That is the same defect class as the six
// cadences, at a site this commit deliberately does not touch. Emission is now
// wall-clock while decay is still per-frame, so at high refresh the population
// falls rather than holding. Measured, reported, and left for its own branch.
//
//   node scripts/artCadenceRate.mjs [--seconds 12] [--url URL] [--headed]

import { writeFile, mkdir } from 'node:fs/promises';
import { launch } from './cdp.mjs';
import { gitProvenance } from './_git.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const SECONDS = Number(arg('--seconds', 12));
const URL     = arg('--url', 'http://localhost:5174/');
const OUT     = arg('--out', null);
const HEADED  = process.argv.includes('--headed');
// Throttle rAF delivery to a chosen rate. Headless SwiftShader runs unthrottled
// at several hundred fps, which is the condition the bug lives in; this pins it
// back down so the SAME build can be measured at 60Hz and at 875Hz and the two
// compared. It is how the particle-population figure below is made comparable.
const THROTTLE = arg('--throttle-fps', null);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = `[...document.querySelectorAll('canvas')].filter(c => c.offsetParent)
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;

// The control. Counts real rAF callbacks, and runs the frame-counted gate this
// commit deleted. Deliberately NOT importing anything from the app: a control
// that shares code with the thing it controls is not a control.
// The control counts ONLY the sphere's own `draw` callback, by function name,
// the way artFrameTime.mjs does.
//
// This is not fastidiousness — counting every rAF callback made the instrument
// lie. The page runs several independent loops (r3f's render loop, the observer
// eye, the sphere), so an undiscriminating counter reports their SUM as "fps"
// and inflates the frame-counted prediction every cadence is judged against.
// Worse, it hides a stall: measured, one run reported a healthy 129 fps while
// every gate had frozen, because the sphere's draw had stopped and the other
// loops were carrying the count on their own.
//
// `callbacks` is kept alongside so the two are visible as separate numbers and
// the gap between them can never pass for the draw rate again.
const CONTROL = `(() => {
  window.__ctl = { draws: 0, callbacks: 0, mod3: 0, mod8: 0, t0: performance.now() };
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => orig((t) => {
    const c = window.__ctl;
    c.callbacks++;
    if (cb.name === 'draw') {
      c.draws++;
      if (c.draws % 3 === 0) c.mod3++;   // the old idle-A cadence, verbatim
      if (c.draws % 8 === 0) c.mod8++;   // the old edge cadence, verbatim
    }
    cb(t);
  });
  window.__ctlReset = () => {
    const c = window.__ctl;
    c.draws = 0; c.callbacks = 0; c.mod3 = 0; c.mod8 = 0; c.t0 = performance.now();
  };
})()`;

const page = await launch({ url: URL, width: 1520, height: 900, dpr: 1, headless: !HEADED });

await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
// WAIT for the nav rather than sleeping at it. The boot splash mounts a canvas
// of its own within a second, so the canvas check above clears long before the
// terminal's nav exists — a fixed sleep here raced the mount and lost.
await page.waitFor(
  `[...document.querySelectorAll('button')].some(e => /\\/CHAOS/i.test(e.innerText || ''))`,
  { label: '/CHAOS nav', timeoutMs: 45000 });
await sleep(500);
await page.eval(`(() => { const b = [...document.querySelectorAll('button')].find(e => /\\/CHAOS/i.test(e.innerText || '')); if (!b) throw new Error('no /CHAOS nav'); b.click(); })()`);
await page.waitFor(`(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 800; })()`, { label: 'sphere' });
// Long settle: the awakening has to be past phase 0 (4s) or the genesis gate is
// still live and the idle cadences are competing with the cascade for the pool.
await sleep(6000);

const hasProbe = await page.eval('typeof window.__artCadenceState === "function"');
if (THROTTLE) {
  // Installed BEFORE the control, so the control counts DELIVERED frames (the
  // app's real draw rate) and not the re-queues this does to pace them.
  await page.eval(`(() => {
    const interval = 1000 / ${Number(THROTTLE)};
    const orig = window.requestAnimationFrame.bind(window);
    let lastDelivered = 0;
    window.requestAnimationFrame = (cb) => orig(function tick(t) {
      const now = performance.now();
      if (now - lastDelivered >= interval) { lastDelivered = now; cb(t); }
      else orig(tick);      // re-queue; the app's own loop must not be broken
    });
  })()`);
  await sleep(1500);
}
await page.eval(CONTROL);
await sleep(600);

const sample = async () => ({
  wall: Date.now(),
  cadence: hasProbe ? await page.eval('window.__artCadenceState()') : null,
  ctl: await page.eval('window.__ctl'),
  glow: await page.eval('(window.__artNodeState && window.__artNodeState().particleGlow) ?? null'),
});

await page.eval('window.__ctlReset()');
const a = await sample();
// Population is sampled repeatedly across the window, not just at the ends: it
// is a live instantaneous count, and one reading of it is a single frame's luck.
const glows = [];
const t0 = Date.now();
while (Date.now() - t0 < SECONDS * 1000) {
  await sleep(400);
  glows.push(await page.eval('(window.__artNodeState && window.__artNodeState().particleGlow) ?? null'));
}
const b = await sample();

const secs = (b.wall - a.wall) / 1000;
const fps = (b.ctl.draws - a.ctl.draws) / secs;
const cbRate = (b.ctl.callbacks - a.ctl.callbacks) / secs;
// A run where the sphere stalled is INADMISSIBLE, not merely odd. Measured: one
// run reported a healthy 129 fps with every gate reading exactly zero, because
// the sphere's draw had stopped and the page's other rAF loops were carrying
// the count alone. Counting `draw` by name fixes the inflation; this catches
// the stall itself, which no per-gate number can distinguish from "quiet".
const stalled = fps < 1;
if (stalled) {
  console.error(`\n  INADMISSIBLE: the sphere's draw ran ${fps.toFixed(2)}/s while the page served ` +
                `${cbRate.toFixed(0)} rAF callbacks/s. The sphere stalled; nothing below is a rate.\n`);
}
const live = glows.filter(g => typeof g === 'number');
const meanGlow = live.length ? live.reduce((t, v) => t + v, 0) / live.length : null;

const rows = [];
if (a.cadence) {
  for (const [name, g] of Object.entries(a.cadence.gates)) {
    const fires = b.cadence.gates[name].fires - g.fires;
    rows.push({
      gate: name,
      period: g.period,
      firesPerSec: +(fires / secs).toFixed(2),
      authored: +(60 / g.period).toFixed(2),
      frameCountedWouldBe: +(fps / g.period).toFixed(2),
    });
  }
}

const control = {
  mod3PerSec: +((b.ctl.mod3 - a.ctl.mod3) / secs).toFixed(2),
  mod8PerSec: +((b.ctl.mod8 - a.ctl.mod8) / secs).toFixed(2),
  mod3Authored: 20, mod8Authored: 7.5,
};

const report = {
  ...gitProvenance(),
  headless: !HEADED, seconds: +secs.toFixed(2), fps: +fps.toFixed(1),
  allRafCallbacksPerSec: +cbRate.toFixed(1), sphereStalled: stalled,
  refreshMultipleOf60: +(fps / 60).toFixed(2),
  hasCadenceProbe: hasProbe,
  gates: rows,
  control,
  particleGlow: { mean: meanGlow == null ? null : +meanGlow.toFixed(1), n: live.length },
};

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n  sphere draw ${report.fps} fps  (${report.refreshMultipleOf60}x a 60Hz frame)   ` +
            `all rAF callbacks ${report.allRafCallbacksPerSec}/s   window ${report.seconds}s\n`);
console.log(`  ${pad('gate', 11)}${pad('period', 8)}${pad('fires/s', 10)}${pad('authored', 10)}frame-counted would be`);
for (const r of rows) {
  console.log(`  ${pad(r.gate, 11)}${pad(r.period, 8)}${pad(r.firesPerSec, 10)}${pad(r.authored, 10)}${r.frameCountedWouldBe}`);
}
if (!rows.length) console.log('  (no __artCadenceState on this build — control only)');
console.log(`\n  CONTROL, frame-counted in the driver (wrong by construction):`);
console.log(`    ++n %% 3 : ${control.mod3PerSec}/s   (authored would be 20)`);
console.log(`    ++n %% 8 : ${control.mod8PerSec}/s   (authored would be 7.5)`);
console.log(`\n  live particle population (mean of ${live.length}): ${report.particleGlow.mean}`);

if (OUT) {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/cadence-rate.json`, JSON.stringify(report, null, 2));
  console.log(`\n  -> ${OUT}/cadence-rate.json`);
}
await page.close();
