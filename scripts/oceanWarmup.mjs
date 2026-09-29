// Reduced-motion warm-up cost on the Ledger ocean preview (headless Chrome,
// SwiftShader). Emulates prefers-reduced-motion, records main-thread long
// tasks (≥ 50 ms) and rAF timestamps, and prints:
//   mountTaskMs   — the long task containing the first ocean frame (0 = none ≥ 50 ms)
//   laterTasks    — durations of long tasks after it (a spread warm-up leaves none)
//   maxFrameGapMs — largest rAF interval between first frame and warm. INFO ONLY:
//                   SwiftShader rasterises on the CPU, so this is not a real-GPU figure.
//   warmWallMs    — first frame → 200 simulated days
//
//   node scripts/oceanWarmup.mjs
import { createServer } from 'vite';
import { launch } from './cdp.mjs';

const RECORDER = `(() => {
  window.__lt = [];
  window.__raf = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lt.push([e.startTime, e.duration]);
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) { window.__ltError = String(e); }
  const tick = (t) => { window.__raf.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

const REPORT = `JSON.stringify((() => {
  const o = window.__ocean;
  const lt = window.__lt;
  const mount = lt.find(([s, d]) => s <= o.readyAt && o.readyAt <= s + d);
  const later = lt.filter(([s]) => s > o.readyAt).map(([, d]) => Math.round(d));
  const raf = window.__raf.filter((t) => t >= o.readyAt && t <= o.warmAt);
  let gap = 0;
  for (let i = 1; i < raf.length; i++) gap = Math.max(gap, raf[i] - raf[i - 1]);
  return {
    mountTaskMs: mount ? Math.round(mount[1]) : 0,
    laterTasks: later,
    maxFrameGapMs: Math.round(gap),
    warmWallMs: Math.round(o.warmAt - o.readyAt),
    simDays: o.simDays,
    longTaskObserverError: window.__ltError ?? null,
  };
})())`;

const server = await createServer({
  server: { port: 5197, strictPort: false, host: '127.0.0.1' },
  logLevel: 'error',
});
await server.listen();
const base = server.resolvedUrls.local[0];
let out = null;
let page;
try {
  page = await launch({ url: 'about:blank', width: 1056, height: 560 });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER });
  await page.goto(`${base}ledger-ocean-preview.html?w=1024&dps=9`);
  await page.waitFor('window.__ocean && window.__ocean.warmAt !== null', { timeoutMs: 180000, label: 'warm-up' });
  await new Promise((r) => setTimeout(r, 500));
  out = JSON.parse(await page.eval(REPORT));
} finally {
  if (page) await page.close();
  await server.close();
}
console.log(JSON.stringify(out, null, 2));
const problems = [];
if (!out || !(out.simDays >= 199.99)) problems.push('warm-up did not reach 200 simulated days');
if (out && out.laterTasks.length > 0) problems.push(`long tasks after the first frame: ${JSON.stringify(out.laterTasks)}`);
if (out && out.longTaskObserverError !== null) problems.push(`long-task observer failed: ${out.longTaskObserverError}`);
if (problems.length) console.error(`FAIL: ${problems.join('; ')}`);
process.exit(problems.length ? 1 : 0);
