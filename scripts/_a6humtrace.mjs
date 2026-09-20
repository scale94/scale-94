// Throwaway — does the hum actually reach the written edge buffer, and does it
// oscillate at the period the constants ask for?
//
// A still frame cannot show breathing and a screenshot diff cannot separate the
// hum from the graph's own drift, so this reads the SOURCE OF TRUTH instead:
// the packed alpha of the graph edges, sampled straight out of the instance
// buffer the GL layer renders, once per wall-clock sample over two full breath
// periods.
//
// What it proves, and what it does not. It proves the gain is being applied,
// with the right relative amplitude and the right period. It does NOT prove the
// result looks good — that is Task 3's sweep and the author's call.
//
// Runs LIVE: no --deterministic, no __virtualize. The question is what real
// frames do over real seconds.
//
//   node scripts/_a6humtrace.mjs [W] [H] [DPR]
//
// Touches no tracked source.
import { launch } from './cdp.mjs';

const W   = Number(process.argv[2] ?? 1920);
const H   = Number(process.argv[3] ?? 1080);
const DPR = Number(process.argv[4] ?? 1);
const URL = 'http://localhost:5174/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 800; })()';
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';

// Mean packed alpha over the GRAPH edges only (not rings, not discs), plus the
// clock the hum is phased on. packAlphas quantises to a byte per stop; the a0
// stop is the low byte, which is all this needs — it moves with baseAlpha.
const SAMPLE = `(() => {
  const s = window.__artEdgeState && window.__artEdgeState();
  if (!s) return JSON.stringify({ error: 'no __artEdgeState' });
  const n = Math.min(s.count, s.discStart ?? s.count);
  if (!n) return JSON.stringify({ error: 'no graph edges written' });
  const d = s.instances;
  let sum = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const w = d[i * s.stride + 14];
    if (!(w > 0)) continue;                 // negative width = a pulse ring
    const packed = d[i * s.stride + 13];
    sum += packed - Math.floor(packed / 256) * 256;   // the a0 byte
    k++;
  }
  return JSON.stringify({ t: performance.now(), n: k, meanA0: k ? sum / k : 0 });
})()`;

const page = await launch({ url: URL, width: W, height: H, dpr: DPR });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  await sleep(2500);
  if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
  await sleep(4000);

  // A FULL AXIS PRECESSION (97s), sampled every 500ms. Two breath periods is
  // not enough: the mean over edges is attenuated by how spread their phases
  // are, and that spread swings as the axis cone turns. A short window reads
  // one moment of that and reports it as the amplitude.
  const rows = [];
  for (let i = 0; i < 225; i++) {
    const r = JSON.parse(await page.eval(SAMPLE));
    if (r.error) throw new Error(r.error);
    rows.push(r);
    await sleep(500);
  }

  const vals = rows.map(r => r.meanA0);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals), max = Math.max(...vals);
  console.log('edges sampled      ', rows[0].n);
  console.log('mean a0 byte       ', mean.toFixed(3));
  console.log('min / max          ', min.toFixed(3), '/', max.toFixed(3));
  console.log('peak-to-peak / mean', ((max - min) / mean).toFixed(4));
  console.log('span seconds       ', ((rows.at(-1).t - rows[0].t) / 1000).toFixed(1));
  console.log('\nseries (0.5s apart):');
  console.log(vals.map(v => v.toFixed(2)).join(' '));
} finally {
  await page.close();
}
