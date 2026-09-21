// _a12ortho.mjs — do the orthogonal bridge endpoints land on real nodes?
//
// Tests ONE reported hypothesis and nothing else: that some ortho endpoints are
// hitting a stale or null target index and collapsing to a default vector,
// which would draw a chord from a node to somewhere no node is.
//
// HOW IT DECIDES, without needing projected node positions exposed. Every edge
// in this mesh terminates on a node CENTRE -- that is already true of the
// non-ortho population, which is the overwhelming majority and is not under
// suspicion. So the non-ortho endpoints ARE the set of occupied node centres,
// measured rather than assumed. An ortho endpoint that matches none of them is
// the reported defect; one that matches is not.
//
// A collapse to a default vector has a second signature this also looks for:
// several endpoints landing on the SAME point, and that point being the origin
// or the canvas centre.
//
//   node scripts/_a12ortho.mjs [W] [H] [DPR]
import { launch } from './cdp.mjs';

const URL = 'http://localhost:5173/';
const W   = Number(process.argv[2] ?? 1520);
const H   = Number(process.argv[3] ?? 900);
const DPR = Number(process.argv[4] ?? 1);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 700; })()';
const SPHERE_RECT = '(() => { const c = ' + SPHERE + '; const r = c.getBoundingClientRect();' +
  ' return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()';
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';

// Endpoints straight out of the buffer. EDGE_OFF: ax 0, ay 1, bx 2, by 3,
// width 14, flags 15. isOrtho is bit 7 of the glow byte, i.e. floor(f/65536)>=128.
// Discs are told apart by a NEGATIVE width and are excluded -- a pulse ring has
// no endpoints in this sense.
const ENDPOINTS = '(() => {' +
  ' const s = window.__artEdgeState ? window.__artEdgeState() : null;' +
  ' if (!s) return JSON.stringify({ hook: false });' +
  ' const D = s.instances, ST = s.stride;' +
  ' const ortho = [], plain = [];' +
  ' for (let i = 0; i < s.count; i++) {' +
  '   const o = i * ST;' +
  '   const w = D[o + 14];' +
  '   if (w <= 0) continue;' +
  '   const rec = { ax: D[o], ay: D[o + 1], bx: D[o + 2], by: D[o + 3], w };' +
  '   if (Math.floor(D[o + 15] / 65536) >= 128) ortho.push(rec); else plain.push(rec);' +
  ' }' +
  ' return JSON.stringify({ hook: true, count: s.count, ortho, plain, w: s.w, h: s.h }); })()';

const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  await sleep(2200);
  if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
  await sleep(3500);
  await page.eval('window.__virtualize && window.__virtualize()');
  await sleep(150);
  await page.eval('window.__reseed && window.__reseed(); window.__artHarnessReset && window.__artHarnessReset();');
  await page.pump(240);

  const rect = JSON.parse(await page.eval('JSON.stringify(' + SPHERE_RECT + ')'));

  // FORGE THE REAL WAY. __artSetOrthogonal only re-flags existing edges, so it
  // cannot reproduce a bad TARGET INDEX -- the reported hypothesis is about the
  // bridge's target, and only the real forge chooses one. Right-click sweeps a
  // grid the way artBaseline's ortho-bridge state does.
  const step = 26;
  let forged = 0;
  for (let y = rect.y + 40; y < rect.y + rect.h - 40 && forged < 8; y += step) {
    for (let x = rect.x + 40; x < rect.x + rect.w - 40 && forged < 8; x += step) {
      const before = JSON.parse(await page.eval(ENDPOINTS)).ortho.length;
      await page.rightClick(x, y);
      await sleep(120);
      await page.pump(3);
      const after = JSON.parse(await page.eval(ENDPOINTS)).ortho.length;
      if (after > before) forged++;
    }
  }
  await page.pump(30);

  const s = JSON.parse(await page.eval(ENDPOINTS));
  if (!s.hook) throw new Error('__artEdgeState missing');
  console.log('forged ' + forged + ' bridge(s); ' + s.ortho.length + ' ortho instance(s), '
    + s.plain.length + ' plain, buffer ' + s.w + 'x' + s.h);
  if (!s.ortho.length) throw new Error('no ortho instances -- nothing to test. Refusing to report.');

  // The occupied node centres, MEASURED off the non-ortho population.
  const centres = [];
  const add = (x, y) => {
    for (const c of centres) if (Math.abs(c.x - x) < 2 && Math.abs(c.y - y) < 2) return;
    centres.push({ x, y });
  };
  for (const e of s.plain) { add(e.ax, e.ay); add(e.bx, e.by); }
  console.log('distinct node centres implied by the non-ortho edges: ' + centres.length);

  const near = (x, y) => centres.some(c => Math.hypot(c.x - x, c.y - y) < 3);
  const bad = [];
  for (const e of s.ortho) {
    const aOK = near(e.ax, e.ay), bOK = near(e.bx, e.by);
    if (!aOK || !bOK) bad.push({ ...e, aOK, bOK });
  }

  console.log('');
  for (const e of s.ortho) {
    console.log('  ortho  a=(' + e.ax.toFixed(1) + ',' + e.ay.toFixed(1) + ')'
      + '  b=(' + e.bx.toFixed(1) + ',' + e.by.toFixed(1) + ')'
      + '  len=' + Math.hypot(e.bx - e.ax, e.by - e.ay).toFixed(1)
      + '  w=' + e.w.toFixed(2)
      + '  ' + (near(e.ax, e.ay) ? 'a:on-node' : 'a:OFF-NODE')
      + ' ' + (near(e.bx, e.by) ? 'b:on-node' : 'b:OFF-NODE'));
  }

  // The second signature of a collapse: many endpoints on ONE point, and that
  // point being the origin or the canvas centre.
  const tally = new Map();
  for (const e of s.ortho) {
    for (const [x, y] of [[e.ax, e.ay], [e.bx, e.by]]) {
      const k = Math.round(x) + ',' + Math.round(y);
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
  }
  const piled = [...tally.entries()].filter(([, n]) => n > 2).sort((a, b) => b[1] - a[1]);

  console.log('');
  console.log('endpoints shared by more than two ortho instances: '
    + (piled.length ? piled.map(([k, n]) => k + ' x' + n).join('  ') : 'none'));
  const originHit = [...tally.keys()].filter(k => k === '0,0').length;
  console.log('endpoints at the origin (0,0): ' + originHit);
  console.log('endpoints at the buffer centre (' + Math.round(s.w / 2) + ','
    + Math.round(s.h / 2) + '): '
    + ([...tally.keys()].filter(k => k === Math.round(s.w / 2) + ',' + Math.round(s.h / 2)).length));

  console.log('');
  if (bad.length) {
    console.log('VERDICT: ' + bad.length + ' of ' + s.ortho.length
      + ' ortho endpoint pair(s) do NOT land on a node centre. The stale/null');
    console.log('target hypothesis is SUPPORTED and this is a real defect.');
    process.exitCode = 1;
  } else {
    console.log('VERDICT: all ' + s.ortho.length + ' ortho instances terminate on measured');
    console.log('node centres at both ends. No collapsed endpoint, no default vector,');
    console.log('no pile-up. The stale/null target hypothesis is REFUTED.');
  }
} finally {
  await page.close();
}
