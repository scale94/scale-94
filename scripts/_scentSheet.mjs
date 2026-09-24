// Eight-instant contact sheet of the /SCENT chamber via the dev scrub hook.
// Needs the dev server on :5174.
//
//   node scripts/_scentSheet.mjs <outDir> [dpr] ["Domain A title"] ["Domain B title"]
import { mkdir } from 'node:fs/promises';
import { launch } from './cdp.mjs';

const OUT = process.argv[2] ?? 'lookbook/scent';
const DPR = Number(process.argv[3] ?? 1);
const A = process.argv[4] ?? 'Feigenbaum Universality';
const B = process.argv[5] ?? 'Twisted Bilayer Graphene';
const URL_ = 'http://localhost:5174/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = [
  ['1-wall-cloud', 'accelerating', 200],
  ['2-t0-pinch', 'accelerating', 1790],
  ['3-docking', 'colliding', 60],
  ['4-ringdown', 'colliding', 250],
  ['5-bond-failure', 'colliding', 560],
  ['6-needles', 'colliding', 700],
  ['7-rings', 'colliding', 1300],
  ['8-dark', 'colliding', 2450],
];
const clickWhere = (pred) => `(() => {
  const b = [...document.querySelectorAll('button')]
    .find(e => e.getBoundingClientRect().width > 0 && (${pred})(e));
  if (!b) return false; b.click(); return true; })()`;
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

await mkdir(OUT, { recursive: true });
const page = await launch({ url: URL_, width: 1520, height: 900, dpr: DPR });
try {
  await page.waitFor(`(() => { const b = document.querySelector('button[aria-label="Scent"]');
    return !!b && b.getBoundingClientRect().width > 40; })()`, { label: 'Scent nav', timeoutMs: 60000 });
  await page.eval(`document.querySelector('button[aria-label="Scent"]').click()`);
  await page.waitFor('!!document.querySelector("[data-chamber-renderer]")', { label: 'chamber', timeoutMs: 30000 });
  await sleep(1500);
  for (const t of [A, B]) {
    if (!await page.eval(clickWhere(`e => e.title === ${JSON.stringify(t)}`))) throw new Error(`no domain button titled ${t}`);
    await sleep(400);
  }
  await page.waitFor('/WASM · RESULT/.test(document.body.innerText)', { label: 'collision result', timeoutMs: 30000 });
  console.log('accumulator:', await page.eval(
    `document.querySelector('[data-chamber-renderer]').getAttribute('data-chamber-accum')`));
  await page.eval(`document.querySelector('[data-chamber-renderer]').scrollIntoView({ block: 'center' })`);
  await sleep(400);
  for (const [name, phase, ms] of SHOTS) {
    await page.eval(`window.__scentScrub(${JSON.stringify(phase)}, ${ms})`);
    await sleep(150);
    const r = await page.eval(`(() => { const b = document.querySelector('[data-chamber-renderer]').getBoundingClientRect();
      return { x: b.left + window.scrollX, y: b.top + window.scrollY, width: b.width, height: b.height }; })()`);
    const path = `${OUT}/${slug(A)}-x-${slug(B)}-${name}-dpr${DPR}.png`;
    await page.screenshot({ path, clip: { ...r, scale: 1 } });
    console.log('shot', path);
  }
  await page.eval('window.__scentScrub(null)');
} finally {
  await page.close();
}
process.exit(0);
