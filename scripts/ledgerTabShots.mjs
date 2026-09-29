// Screenshots of the live Ledger tab (ocean hero, HUD, header) for visual
// review: desktop 1440×1000 @1x and phone 390×844 @3x, headless Chrome
// (SwiftShader). Per view: the viewport after 8 s, the hero alone, the hero
// with the probe active (hover on desktop, tap on the phone) and, desktop
// only, a source-ring tooltip.
//
//   node scripts/ledgerTabShots.mjs [outDir]
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from './cdp.mjs';

const OUT = process.argv[2] || join(tmpdir(), 'ledger-tab-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HERO = `document.querySelector('canvas[aria-label^="Ledger ocean"]')`;
const NAV = `[...document.querySelectorAll('button[aria-label="Ledger"]')].find((b) => b.offsetParent)`;
const VIEWS = [
  { name: 'desktop', width: 1440, height: 1000, dpr: 1, mobile: false },
  { name: 'mobile', width: 390, height: 844, dpr: 3, mobile: true },
];
const PROBE_AT = [-88.0, 26.5];      // Gulf of Mexico, off the Mississippi mouth
const RING_AT = [6.9603, 50.9375];   // Rhine preset site (Cologne)

await mkdir(OUT, { recursive: true });
const server = await createServer({ server: { port: 5196, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const shot = async (page, name, clip) => {
  const path = join(OUT, name);
  await page.screenshot({ path, ...(clip ? { clip } : {}) });
  console.log(path);
};
try {
  for (const v of VIEWS) {
    const page = await launch({ url: base, width: v.width, height: v.height, dpr: v.dpr });
    try {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width: v.width, height: v.height, deviceScaleFactor: v.dpr, mobile: v.mobile,
      });
      if (v.mobile) await page.enableTouch();
      await page.waitFor(`!!(${NAV})`, { timeoutMs: 60000, label: 'Ledger nav' });
      await page.eval(`${NAV}.click()`);
      await page.waitFor(`(() => { const c = ${HERO}; return !!c && c.getBoundingClientRect().width > 200; })()`, {
        timeoutMs: 60000, label: 'ocean canvas',
      });
      await page.eval('window.scrollTo(0, 0)');
      await sleep(8000);
      await shot(page, `${v.name}-viewport.png`);
      const r = await page.eval(`(() => { const b = ${HERO}.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()`);
      const clip = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h), scale: 1 };
      const at = ([lon, lat]) => [r.x + ((lon + 180) / 360) * r.w, r.y + ((90 - lat) / 180) * r.h];
      await shot(page, `${v.name}-hero.png`, clip);
      const [px, py] = at(PROBE_AT);
      if (v.mobile) {
        await page.touch('touchStart', px, py);
        await page.touch('touchEnd', px, py);
      } else {
        await page.hover(px, py);
      }
      await sleep(400);
      await shot(page, `${v.name}-hero-probe.png`, clip);
      if (!v.mobile) {
        const [rx, ry] = at(RING_AT);
        await page.hover(rx, ry);
        await sleep(300);
        await shot(page, `${v.name}-hero-ring-tooltip.png`, clip);
      }
      const errors = page.consoleErrors();
      if (errors.length) console.log(`${v.name} console errors: ${JSON.stringify(errors)}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await server.close();
}
process.exit(0);
