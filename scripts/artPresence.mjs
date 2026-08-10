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

// deterministic:true only INSTALLS the shim; it stays inert until
// __virtualize(). The first three checks need real time (a 4s fade, a 114 BPM
// beat, a 1s flash decay), so virtualisation is deferred to the ghost check.
const page = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900, deterministic: true });
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
  console.log(lit > quiet + 0.3 ? '   => RENDERS\n' : '   => NOT DETECTED\n');
  await sleep(1500);   // let the flash decay back out

} finally { await page.close(); }

// ── GHOST TRAILS: last session's positions, read from IndexedDB ───────────
// Empty in a fresh harness profile, so this layer never draws during capture.
//
// Runs in its OWN page, and that is load-bearing: driven from the session
// above, __virtualize() lands after ~20s of real rAF and pump() then fails to
// advance the draw loop at all — measured as two byte-identical screenshots.
//
// THREE MORE WAYS THIS CHECK CAN LIE, all of them met while writing it:
//   1. Mean blue-lean over the sphere is ~65x too coarse — the layer
//      contributes 0.008 against ~0.5 of animation noise, so it reports
//      "not detected" whether the layer works or not.
//   2. Pixel-diffing two deterministic runs drowns in the harness's own
//      41k-changed-pixel reproducibility floor.
//   3. Seeding arbitrary positions gets them BACK-FACE CULLED (measured rz
//      -1.497 against the -0.3 threshold) — the layer correctly draws nothing
//      and the check reads it as a failure.
//
// So: freeze the clock, pin the rotation with __artHarnessReset (rx=0.18,
// ry=0), stack all 31 ghosts at model (0,0,1) which is then reliably
// front-facing, and look for the ghost colour itself. 31 source-over passes at
// alpha 0.069 compound to 0.89, i.e. a nearly opaque (180,180,220) disc.
const GL_READY = `(() => { const w = document.querySelector('[data-art-composite]');
  const g = w && w.querySelector('canvas'); const c = ${SPHERE};
  return !!g && !!c && g.width >= c.clientWidth * 0.9 && g.width > 800; })()`;

const nearestGhostColour = (png) => {
  const { width: W, height: H, data } = decodePng(png);
  let best = 1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const d = Math.hypot(data[i] - 180, data[i + 1] - 180, data[i + 2] - 220);
    if (d < best) best = d;
  }
  return best;
};

const g2 = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900, deterministic: true });
try {
  await g2.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await g2.eval(clickText('/CHAOS'));
  await g2.waitFor(READY, { label: 'sphere', timeoutMs: 40000 });
  await g2.waitFor(GL_READY, { label: 'GL sized', timeoutMs: 40000 });
  await sleep(4000);
  await g2.eval('window.__virtualize()');
  await sleep(150);

  const r2 = await g2.eval(RECT);
  const clip2 = { x: r2.x, y: r2.y, width: r2.w, height: r2.h, scale: 1 };

  await g2.eval('window.__artSetGhosts(null); window.__reseed(); window.__artHarnessReset();');
  await g2.pump(3);
  const gOff = nearestGhostColour(await g2.screenshot({ clip: clip2 }));
  await g2.eval('window.__artSetGhosts(Array.from({length:93},(_,i)=> i%3===2 ? 1 : 0))');
  await g2.pump(3);
  const gOn = nearestGhostColour(await g2.screenshot({ clip: clip2 }));
  const live = JSON.parse(await g2.eval('JSON.stringify(window.__artBgState())')).ghostsLive;

  console.log('GHOST TRAILS  (closest approach to the ghost colour 180,180,220)');
  console.log(`   no session     ${gOff.toFixed(1)}`);
  console.log(`   31 stacked     ${gOn.toFixed(1)}   (${live} live slots published)`);
  // The criterion used to be `gOn < gOff - 10` — a FIXED ABSOLUTE margin — and
  // that made it the fifth time this check called a healthy layer broken.
  //
  // nearestGhostColour is a MINIMUM over the whole frame, so gOff is not a
  // property of the ghost layer at all: it is however close the brightest
  // unrelated pixel (a node, a label) happens to sit to (180,180,220). Once the
  // trail accumulator landed and the whole frame got brighter, gOff fell to
  // 15.4, so the old rule demanded gOn <= 5.4 — i.e. the stacked disc had to
  // match the ghost colour to within 2% before the check would admit the layer
  // existed. The better the rest of the sphere renders, the harder this failed.
  //
  // Replaced with two conditions that are about the layer rather than the frame:
  //   - gOn < 12: 31 stacked ghosts compound to near-opaque, so the disc should
  //     BE the ghost colour. 12 is under 5% of |(180,180,220)|, which says
  //     "this pixel is that colour", not merely "this pixel is bright".
  //   - gOn < gOff * 0.7: and stacking them has to have actually moved it,
  //     which is what distinguishes the layer drawing from the frame being
  //     bright for other reasons.
  // Measured with the trail on: gOff 15.4, gOn 7.5.
  console.log(live > 0 && gOn < 12 && gOn < gOff * 0.7 ? '   => RENDERS' : '   => NOT DETECTED');
} finally { await g2.close(); }
