// _a19budget.mjs — how much room is left in the additive stream?
//
// _a18wsweep found that real prism chords tessellate to n = 8-11, not the 24
// the wavefront design assumed, and that a pulse cannot be sampled cleanly at
// that density. One remedy is to raise the prism's tessellation. Whether that
// is even affordable is a question about ONE number: the peak occupancy of the
// additive pool during a full-strength click, against its capacity.
//
// Raising n multiplies the prism's instance count almost exactly linearly --
// it writes (pairs x spectral lines x 2 passes x n) -- so the headroom ratio
// measured here IS the largest tessellation multiplier available.
//
// Samples on a timer rather than per frame: occupancy depends on how many
// effects are live, not on how fast frames go by, so a slow poll costs nothing
// in fidelity. (It would be wrong for _a17prismclock, which times frames.)
//
//   node scripts/_a19budget.mjs [W] [H] [DPR] [PORT]
import { launch } from './cdp.mjs';

const W    = Number(process.argv[2] ?? 1520);
const H    = Number(process.argv[3] ?? 900);
const DPR  = Number(process.argv[4] ?? 1);
const PORT = Number(process.argv[5] ?? 5173);
const ARM  = process.argv[6] === undefined ? null : Number(process.argv[6]);
const URL  = `http://localhost:${PORT}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_RECT = '(() => { const c = ' + SPHERE + '; const r = c.getBoundingClientRect();'
  + ' return { x: r.x, y: r.y, w: r.width, h: r.height }; })()';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 700; })()';
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';

const DISCS = `(() => {
  const s = window.__artEdgeState ? window.__artEdgeState() : null;
  if (!s) return JSON.stringify({ hook: false });
  const ST = s.stride, D = s.instances, out = [];
  for (let i = 0; i < s.count; i++) {
    const o = i * ST, w = D[o + 14];
    if (w >= 0) continue;
    out.push([D[o], D[o + 1], -w]);
  }
  return JSON.stringify({ hook: true, w: s.w, h: s.h, discs: out });
})()`;

const GEOM = '(() => JSON.stringify(window.__artGeomState()))()';

const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: false });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere canvas' });
  await sleep(1500);

  let armSet = null;
  if (ARM !== null) {
    armSet = JSON.parse(await page.eval(`JSON.stringify(window.__artSetPacketArm(${ARM}))`));
    if (!armSet || armSet.packetArm !== ARM) throw new Error(`__artSetPacketArm(${ARM}) did not land: ${JSON.stringify(armSet)}`);
    console.log(`packet arm ${ARM}: w=${armSet.w} step=${armSet.step} forced n=${armSet.segments}`);
  }

  const probe0 = JSON.parse(await page.eval(GEOM));
  if (!probe0.additive) throw new Error('__artGeomState has no additive block — stale page?');
  const CAP = probe0.additive.capacity;

  const idle = JSON.parse(await page.eval(DISCS));
  if (!idle.hook || !idle.discs.length) throw new Error('no node discs on screen');
  const rect = await page.eval(SPHERE_RECT);

  // FOUR clicks on the four largest discs, ~250ms apart. PRISM_MAX_EFFECTS is
  // 4 and spawnEffect drops the oldest beyond it, so four overlapping
  // full-strength effects IS the provable worst case this pool must hold --
  // measuring one click would understate the peak by close to 4x.
  const targets = idle.discs.slice().sort((a, b) => b[2] - a[2]).slice(0, 4);

  let peak = 0, peakEff = 0, dropped = 0;
  const trace = [];
  const sample = async (tag) => {
    const g = JSON.parse(await page.eval(GEOM));
    const c = g.additive.count;
    trace.push([tag, c, g.effects.length]);
    if (c > peak) { peak = c; peakEff = g.effects.length; }
    dropped = Math.max(dropped, g.additive.dropped);
  };

  await sample('idle');
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    await page.click(rect.x + t[0] * (rect.w / idle.w), rect.y + t[1] * (rect.h / idle.h));
    await sleep(120);
    await sample(`click ${i + 1}`);
  }
  // Ride the overlap out: the four envelopes peak together shortly after the
  // last click, which is where the pool is fullest.
  for (let i = 0; i < 14; i++) { await sleep(180); await sample(`+${(i + 1) * 180}ms`); }

  console.log('\n  when          additive   effects');
  for (const [tag, c, e] of trace) {
    console.log(`  ${tag.padEnd(12)}  ${String(c).padStart(8)}   ${String(e).padStart(7)}`);
  }

  const headroom = CAP / Math.max(peak, 1);
  console.log(`\ncapacity          ${CAP}`);
  console.log(`peak occupancy    ${peak}  (${(peak / CAP * 100).toFixed(1)}% full, ${peakEff} live effects)`);
  console.log(`dropped           ${dropped}`);
  console.log(`\nHEADROOM = ${headroom.toFixed(2)}x`);
  console.log(`So the prism's tessellation could rise by at most ~${headroom.toFixed(2)}x`);
  console.log(`before this pool overflows -- and real chords sit at n = 8-11 today.`);
  console.log(`Reaching n = 20 needs about ${(20 / 9).toFixed(2)}x.`);
  if (dropped > 0) {
    console.log('\nWARNING: the pool is ALREADY dropping instances at the shipped tessellation.');
  }
} finally {
  await page.close();
}
