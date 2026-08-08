// Presence checks for the layers the parity gate structurally cannot see.
// A green 21/21 on these proves "no regression", never "it draws" — the same
// pass follows from deleting the layer. So: switch each one on and look.
import { launch } from './cdp.mjs';
import { decodePng } from './_png.mjs';

const SPHERE = `[...document.querySelectorAll('canvas')]
  .filter(c => c.offsetParent && !c.closest('[data-art-composite]'))
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;
const READY = `(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 800; })()`;
const RECT = `(() => { const r = ${SPHERE}.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`;
const clickText = (p) => `(() => { const re = new RegExp(${JSON.stringify(p)}, 'i');
  const b = [...document.querySelectorAll('button')].find(e => re.test(e.innerText || ''));
  if (!b) return false; b.click(); return true; })()`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Mean channel-lean inside a disc: how much the pixels there lean toward a
// given hue direction, over the black backdrop.
function lean(png, frac, pick) {
  const { width: W, height: H, data } = decodePng(png);
  const cx = W >> 1, cy = H >> 1, R = Math.min(W, H) * frac;
  let sum = 0, n = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (Math.hypot(x - cx, y - cy) > R) continue;
    const i = (y * W + x) * 4;
    sum += pick(data[i], data[i + 1], data[i + 2]); n++;
  }
  return sum / n;
}
const magenta = (r, g, b) => Math.max(0, (r + b) / 2 - g);   // 217,70,239
const gold    = (r, g, b) => Math.max(0, (r + g) / 2 - b);   // 255,215,0

const page = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900 });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await page.eval(clickText('/CHAOS'));
  await page.waitFor(READY, { label: 'sphere', timeoutMs: 40000 });

  const rect = await page.eval(RECT);
  const clip = { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 };

  // ── GENESIS GLOW: awakening phase 0, fades out inside ~3.8s ─────────────
  // Sample immediately, then again well after the phase gate has closed.
  let early = 0;
  for (let i = 0; i < 8; i++) { early = Math.max(early, lean(await page.screenshot({ clip }), 0.35, gold)); await sleep(180); }
  await sleep(9000);
  const late = lean(await page.screenshot({ clip }), 0.35, gold);
  console.log('GENESIS GLOW  (gold lean in the central disc)');
  console.log(`   during phase 0   ${early.toFixed(3)}`);
  console.log(`   after it closes  ${late.toFixed(3)}`);
  console.log(early > late + 0.15 ? '   => RENDERS\n' : '   => NOT DETECTED\n');

  // ── EXERGY PULSE: ecocide bus, never non-zero during capture ────────────
  if (!await page.eval('typeof window.__artSetEcocide === "function"')) {
    throw new Error('__artSetEcocide missing — production build?');
  }
  const off = lean(await page.screenshot({ clip }), 0.5, magenta);
  await page.eval('window.__artSetEcocide({ exergyRate: 1 })');
  await sleep(600);
  const on = lean(await page.screenshot({ clip }), 0.5, magenta);
  console.log('EXERGY PULSE  (magenta lean in the central disc)');
  console.log(`   rate 0   ${off.toFixed(3)}`);
  console.log(`   rate 1   ${on.toFixed(3)}`);
  console.log(on > off + 0.2 ? '   => RENDERS\n' : '   => NOT DETECTED\n');
  await page.eval('window.__artSetEcocide({ exergyRate: 0 })');
  await sleep(400);

  // ── FLASH GRID: bifurcation events only, never fired during capture ─────
  // Measured in the far side bands, well outside the sphere: the hex grid is
  // the ONLY layer that paints there, so anything else lighting up would be a
  // bug rather than a false positive. It decays over 64 frames (~1s), so the
  // screenshot has to follow the trigger immediately.
  const bands = (png) => {
    const { width: W, height: H, data } = decodePng(png);
    let sum = 0, n = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (x > W * 0.08 && x < W * 0.92) continue;
      const i = (y * W + x) * 4;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++;
    }
    return sum / n;
  };
  const quiet = bands(await page.screenshot({ clip }));

  // Right-click a node -> orthogonal bridge -> bgFlash = 0.7.
  const HOVERED = `(() => {
    const s = [...document.querySelectorAll('span')].filter(e =>
      e.style.position === 'absolute' && e.style.font && e.textContent);
    let best = null;
    for (const e of s) { const o = parseFloat(e.style.opacity || '0');
      if (o > 0.9 && (!best || o > best.o)) best = { o, t: e.textContent }; }
    return best && best.t; })()`;
  let hit = null;
  for (let r = 1; r <= 5 && !hit; r++) for (let c = 1; c <= 9 && !hit; c++) {
    const x = Math.round(rect.x + rect.w * c / 10), y = Math.round(rect.y + rect.h * r / 6);
    await page.hover(x, y); await sleep(70);
    if (await page.eval(HOVERED)) hit = { x, y };
  }
  if (!hit) throw new Error('no node found to right-click');
  await page.rightClick(hit.x, hit.y);
  let lit = 0;
  for (let i = 0; i < 4; i++) lit = Math.max(lit, bands(await page.screenshot({ clip })));

  console.log('FLASH GRID  (mean luminance in the far side bands)');
  console.log(`   quiet          ${quiet.toFixed(3)}`);
  console.log(`   after trigger  ${lit.toFixed(3)}`);
  console.log(lit > quiet + 0.3 ? '   => RENDERS' : '   => NOT DETECTED');
} finally { await page.close(); }
