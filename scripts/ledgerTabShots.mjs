// Screenshots of the live Ledger tab (ocean hero, HUD, header) for visual
// review: desktop 1440×1000 @1x and phone 390×844 @3x, headless Chrome
// (SwiftShader). Per view: the viewport after 8 s, the hero alone, the hero
// with the probe active (hover on desktop, tap on the phone) and a
// source-ring tooltip. Phone only: a tap on the Gulf ~7 px off the Mississippi
// ring centre (beyond the 6 px ring tap radius: probes), a tap on open
// Atlantic ~19 px from that ring (probes), and the legend with its notes
// expanded.
// 3b, both views: zooms on the Danube, the Bay of Bengal and the Yangtze
// (river-stage parcels, DO_MIN ticks); the USA preset moved inland to Wuhan
// (the PROVISIONAL ghost while typing); then RUN AUDIT and a shot ~450 ms into
// the seal flare. Submitting writes one verdict into the throwaway profile.
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
const OFF_RING_AT = [-86.0, 23.5];   // Gulf water ~7 css px from the Mississippi ring centre at 334 px
const OPEN_WATER_AT = [-70.0, 27.0]; // Atlantic ~19 css px from the Mississippi ring centre at 334 px
const GHOST_SITE = { lat: 30.59, lon: 114.3 };   // Wuhan: a user site ~9 cells inland
const ZOOMS = [
  ['river-danube', [12, 50], [31, 42]],
  ['river-bengal', [86, 26], [95, 19]],
  ['river-yangtze', [118, 34], [126, 28]],
];
const EAST_CHINA = [[110, 36], [126, 26]];
const MISSISSIPPI = [[-91, 30.6], [-88.6, 28.6]];

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
      const tap = async ([x, y]) => {
        await page.touch('touchStart', x, y);
        await page.touch('touchEnd', x, y);
      };
      if (v.mobile) {
        await tap(at(OFF_RING_AT));
        await sleep(400);
        await shot(page, `${v.name}-hero-probe-offring.png`, clip);
        await tap(at(OPEN_WATER_AT));
        await sleep(400);
        await shot(page, `${v.name}-hero-probe-openwater.png`, clip);
        await tap(at(RING_AT));
        await sleep(400);
        await shot(page, `${v.name}-hero-ring-tooltip.png`, clip);
        await sleep(5500); // PROBE_TAP_HOLD_MS: the legend comes back
        const t = await page.eval(`(() => { const b = document.querySelector('[data-hud="notes-toggle"]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
        await tap(t);
        await sleep(400);
        await shot(page, `${v.name}-hero-notes.png`, clip);
      } else {
        const [rx, ry] = at(RING_AT);
        await page.hover(rx, ry);
        await sleep(300);
        await shot(page, `${v.name}-hero-ring-tooltip.png`, clip);
      }
      // ── 3b ──────────────────────────────────────────────────────────────
      const zoom = async (name, [lon0, lat1], [lon1, lat0], scale = v.mobile ? 2 : 3) => {
        const [x0, y0] = at([lon0, lat1]);
        const [x1, y1] = at([lon1, lat0]);
        await shot(page, name, {
          x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0),
          scale,
        });
      };
      // Clear the state the 3a shots leave on the hero so it does not cover
      // the zooms: desktop, the Rhine ring tooltip (pointer moves off the
      // hero); phone, the expanded notes (tap the toggle again).
      if (v.mobile) {
        const t = await page.eval(`(() => { const b = document.querySelector('[data-hud="notes-toggle"]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
        await tap(t);
      } else {
        await page.hover(r.x + r.w / 2, r.y + r.h + 60);
      }
      await sleep(400);
      await page.eval('window.scrollTo(0, 0)');
      for (const [name, a, b] of ZOOMS) await zoom(`${v.name}-${name}.png`, a, b);
      // Short-river glide: two close-ups of the Mississippi (New Orleans → Head
      // of Passes, 1.6 d of travel, slowed to one course per 6 s) ~50 ms apart.
      // Parcels should have moved ~1/120 of the course, not jumped or strobed.
      const t0 = Date.now();
      await zoom(`${v.name}-glide-mississippi-a.png`, ...MISSISSIPPI, v.mobile ? 4 : 10);
      await sleep(Math.max(0, 50 - (Date.now() - t0)));
      await zoom(`${v.name}-glide-mississippi-b.png`, ...MISSISSIPPI, v.mobile ? 4 : 10);
      console.log(`${v.name} glide pair taken ${Date.now() - t0} ms apart`);

      const clickText = (text) => page.eval(`(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)});
        if (b) b.click();
        return !!b;
      })()`);
      const setField = (field, value) => page.eval(`(() => {
        const el = document.querySelector('[data-field="${field}"] input');
        if (!el) return false;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(String(value))});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      if (!(await clickText('USA'))) throw new Error('USA preset button not found');
      if (!(await setField('lat', GHOST_SITE.lat)) || !(await setField('lon', GHOST_SITE.lon))) {
        throw new Error('coordinate inputs not found');
      }
      await sleep(600);
      await page.eval('window.scrollTo(0, 0)');
      await shot(page, `${v.name}-ghost.png`, clip);
      await zoom(`${v.name}-ghost-zoom.png`, ...EAST_CHINA);

      if (!(await clickText('RUN AUDIT'))) throw new Error('RUN AUDIT button not found');
      await page.waitFor(`!!document.querySelector('[data-sealing="true"]')`, { timeoutMs: 30000, label: 'seal' });
      await sleep(450);
      await page.eval('window.scrollTo(0, 0)');
      await shot(page, `${v.name}-seal-flare.png`, clip);
      await zoom(`${v.name}-seal-flare-zoom.png`, ...EAST_CHINA);
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
