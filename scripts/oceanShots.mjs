// Screenshots of the Ledger ocean preview for visual review (headless Chrome,
// SwiftShader, DPR 2). Captures the whole world at three moments and crops of
// the four Courant hotspots and the five preset mouths.
//
//   node scripts/oceanShots.mjs [outDir] [dps]
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from './cdp.mjs';

const OUT = process.argv[2] || join(tmpdir(), 'ledger-ocean-shots');
const DPS = Number(process.argv[3] || 30);
const W = 1024;
const PAD = 16;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// lon/lat → CSS px inside the page (canvas at PAD, PAD; W × W/2; north up).
const toPx = (lon, lat) => [PAD + ((lon + 180) / 360) * W, PAD + ((90 - lat) / 180) * (W / 2)];
const CROPS = {
  'strait-la-perouse': [142.4, 45.4], 'strait-taiwan': [119.9, 24.9],
  'strait-korea': [129.7, 34.8], 'strait-cook': [174.5, -41.5],
  'mouth-mississippi': [-89.25, 29.15], 'mouth-rhine': [4.13, 51.98],
  'mouth-bistrice': [20.03, 39.84], 'mouth-rio-doce': [-39.81, -19.66],
  'mouth-hamhung': [127.6, 39.8],
};

await mkdir(OUT, { recursive: true });
const server = await createServer({ server: { port: 5198, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
let page;
try {
  page = await launch({ url: `${base}ledger-ocean-preview.html?w=${W}&dps=${DPS}`, width: W + 2 * PAD, height: W / 2 + 2 * PAD, dpr: 2 });
  await page.waitFor('window.__ocean && window.__ocean.ready', { timeoutMs: 60000, label: 'ocean ready' });
  const full = { x: PAD, y: PAD, width: W, height: W / 2, scale: 1 };
  let waited = 0;
  for (const wallS of [0, 5, 15]) {
    await sleep((wallS - waited) * 1000);
    waited = wallS;
    const days = await page.eval('window.__ocean.simDays');
    const path = join(OUT, `world-t${wallS}s-${Math.round(days)}d.png`);
    await page.screenshot({ path, clip: full });
    console.log(path);
  }
  for (const [name, [lon, lat]] of Object.entries(CROPS)) {
    const [x, y] = toPx(lon, lat);
    const clip = {
      x: Math.min(PAD + W - 120, Math.max(PAD, Math.round(x - 60))),
      y: Math.min(PAD + W / 2 - 80, Math.max(PAD, Math.round(y - 40))),
      width: 120,
      height: 80,
      scale: 1,
    };
    const path = join(OUT, `${name}.png`);
    await page.screenshot({ path, clip });
    console.log(path);
  }
} finally {
  if (page) await page.close();
  await server.close();
}
process.exit(0);
