// artLiveShots.mjs — live (non-deterministic) screenshots of the sphere.
//
// Companion to artBaseline.mjs, which is deterministic and therefore the parity
// gate — but which is blind to the GL layer: it replaces requestAnimationFrame
// with a manual pump, and r3f's render loop does not run under that in either
// frameloop mode. So the deterministic capture shows the 2D layer only.
//
// This script runs the app normally, so the GL composite renders. The frames are
// NOT reproducible and must never be used as a hash gate — they exist so a human
// can look at the bloom.
//
//   node scripts/artLiveShots.mjs [--out DIR]

import { mkdir } from 'node:fs/promises';
import { launch } from './cdp.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = arg('--out', 'baseline/art-sphere-step2/live');
const URL = arg('--url', 'http://localhost:5174/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Exclude the GL layer by its marker — never probe with getContext(), which
// permanently claims an uninitialised canvas and kills r3f's WebGL context.
const SPHERE = `[...document.querySelectorAll('canvas')]
  .filter(c => c.offsetParent && !c.closest('[data-art-composite]'))
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;

const SCALES = [
  { name: 'laptop-1520x900@1x',     width: 1520, height: 900,  dpr: 1 },
  { name: 'projector-1920x1080@1x', width: 1920, height: 1080, dpr: 1 },
];

await mkdir(OUT, { recursive: true });

for (const s of SCALES) {
  const page = await launch({ url: URL, width: s.width, height: s.height, dpr: s.dpr });
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(3500);
  await page.eval(`(() => { const b = [...document.querySelectorAll('button')].find(e => /\\/CHAOS/i.test(e.innerText || '')); if (!b) throw new Error('no /CHAOS nav'); b.click(); })()`);
  await page.waitFor(`(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 800; })()`, { label: 'sphere' });
  await sleep(6000);

  const rect = await page.eval(`(() => { const c = ${SPHERE}; const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  const clip = { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 };

  const glAlive = await page.eval(`(() => { const w = document.querySelector('[data-art-composite]');
    const c = w && w.querySelector('canvas');
    return !!c && c.width > 800; })()`);

  await page.screenshot({ path: `${OUT}/${s.name}__idle.png`, clip });
  console.log(`${s.name}  sphere ${Math.round(rect.w)}x${Math.round(rect.h)}  GL layer alive: ${glAlive}`);

  // Immersive, where the vignette lives.
  await page.eval(`(() => { const b = [...document.querySelectorAll('button')].find(e => (e.title || '').includes('Immersive mode')); b && b.click(); })()`);
  await sleep(5000);
  const r2 = await page.eval(`(() => { const c = ${SPHERE}; const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  await page.screenshot({
    path: `${OUT}/${s.name}__immersive-on.png`,
    clip: { x: r2.x, y: r2.y, width: r2.w, height: r2.h, scale: 1 },
  });

  const errs = page.consoleErrors().filter(e => !/ResizeObserver loop/.test(e));
  if (errs.length) console.log(`   console errors: ${errs.slice(0, 3).join(' | ')}`);
  await page.close();
}
console.log(`\nwrote ${OUT}`);
