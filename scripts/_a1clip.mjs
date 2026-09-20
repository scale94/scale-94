// Scratch — WHERE DOES THE SPHERE ACTUALLY GET CUT, and by what?
//
// The report is "the orbital sphere clips against the viewport margins during
// rotation". Two very different mechanisms produce that picture and they want
// opposite fixes:
//
//   A. the sphere is too big for its container  -> shrink the radius
//   B. the container is the FULL viewport, top: 0, and the nav bar paints over
//      its first ~N rows                        -> inset the container
//
// B also puts the sphere's CENTRE above the centre of the band it can actually
// be seen in, which a radius change does not fix -- it just leaves dead space
// at the bottom. So this measures both halves before anything is changed:
//
//   - the nav bar's rect, the immersive container's rect, the canvas rect
//   - sphereR, and the sphere's GEOMETRIC half-extent
//   - one ink bounding box from a real screenshot, as a sanity check only
//
// It does NOT measure the swept envelope -- see the note at the foot of this
// file for the measurement that was deleted from here and why. Use
// `scripts/_a1clear.mjs` for that.
//
// project() is sx = w/2 + rx*sphereR*scale, scale = FOCAL_K/(FOCAL_K + rz).
// Maximising sqrt(1-rz^2)*K/(K+rz) over rz gives rz = -1/K and a maximum
// projected offset of K/sqrt(K*K-1) = 1.0707 sphereR at K = 2.8. That is the
// number the container has to be able to hold, not sphereR itself.
//
//   node scripts/_a1clip.mjs [W] [H] [DPR]
import { launch } from './cdp.mjs';
import { decodePng } from './_png.mjs';

const URL = 'http://localhost:5174/';
const W   = Number(process.argv[2] ?? 1920);
const H   = Number(process.argv[3] ?? 1080);
const DPR = Number(process.argv[4] ?? 1);
const FOCAL_K = 2.8;
const MAXK = FOCAL_K / Math.sqrt(FOCAL_K * FOCAL_K - 1);   // 1.0707
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 800; })()';
const GL_READY = '(() => {' +
  ' const w = document.querySelector("[data-art-composite]");' +
  ' const g = w && w.querySelector("canvas");' +
  ' const c = ' + SPHERE + ';' +
  ' return !!g && !!c && g.width >= c.clientWidth * 0.9 && g.width > 800; })()';
const clickByText = (p) => '(() => { const re = new RegExp(' + JSON.stringify(p) + ', "i");' +
  ' const b = [...document.querySelectorAll("button")].find(e => re.test(e.innerText || ""));' +
  ' if (!b) return false; b.click(); return true; })()';

// Geometry, all in CSS px. The nav bar is found by walking up from the /CHAOS
// button until an ancestor spans the viewport -- that is the strip that paints.
const GEOM = 'JSON.stringify((() => {' +
  ' const b = window.__artBgState ? window.__artBgState() : null;' +
  ' const c = ' + SPHERE + ';' +
  ' const g = document.querySelector("[data-art-composite] canvas");' +
  ' const cont = c ? c.parentElement : null;' +
  ' const r = el => { if (!el) return null; const q = el.getBoundingClientRect();' +
  '   return { x: +q.x.toFixed(1), y: +q.y.toFixed(1), w: +q.width.toFixed(1), h: +q.height.toFixed(1),' +
  '            bottom: +q.bottom.toFixed(1), right: +q.right.toFixed(1) }; };' +
  ' let nav = [...document.querySelectorAll("button")].find(e => /\\/CHAOS/i.test(e.innerText || ""));' +
  ' let navStrip = null;' +
  ' while (nav) { if (nav.getBoundingClientRect().width >= window.innerWidth * 0.9) { navStrip = nav; break; } nav = nav.parentElement; }' +
  ' const cs = cont ? getComputedStyle(cont) : null;' +
  ' return {' +
  '   viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },' +
  '   nav: r(navStrip),' +
  '   container: r(cont),' +
  '   containerPos: cs ? cs.position : null,' +
  '   canvasCss: r(c),' +
  '   canvasBuf: c ? (c.width + "x" + c.height) : null,' +
  '   glBuf: g ? (g.width + "x" + g.height) : null,' +
  '   sphereR: b ? +b.sphereR.toFixed(3) : null,' +
  ' }; })())';

const page = await launch({ url: URL, width: W, height: H, dpr: DPR });
await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
await sleep(2500);
if (!await page.eval(clickByText('/CHAOS'))) throw new Error('no /CHAOS nav button');
await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
await page.waitFor(GL_READY, { label: 'GL composite sized', timeoutMs: 40000 });
await sleep(4000);

// Ink bounding box of a real screenshot, in CSS px, restricted to rows at or
// below `fromY` so the nav strip's permanently-lit text cannot enter it.
async function inkBox(fromY) {
  const png = await page.screenshot();
  const { data, width, height } = decodePng(png);
  const sx = width / W;           // device px per CSS px
  const y0 = Math.max(0, Math.round(fromY * sx));
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, lit = 0;
  for (let y = y0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (l < 24) continue;
      lit++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const css = v => +(v / sx).toFixed(1);
  return lit ? { lit, left: css(minX), right: css(maxX), top: css(minY), bottom: css(maxY),
                 buf: width + 'x' + height } : { lit: 0, buf: width + 'x' + height };
}

function report(label, g, ink) {
  const vh = g.viewport.h, vw = g.viewport.w;
  const R = g.sphereR ?? 0;
  const half = R * MAXK;
  const cx = g.canvasCss ? g.canvasCss.x + g.canvasCss.w / 2 : vw / 2;
  const cy = g.canvasCss ? g.canvasCss.y + g.canvasCss.h / 2 : vh / 2;
  console.log('\n== ' + label);
  console.log('   viewport      ' + vw + 'x' + vh + ' @' + g.viewport.dpr);
  console.log('   nav strip     ' + (g.nav ? ('y ' + g.nav.y + ' -> ' + g.nav.bottom + '  (h ' + g.nav.h + ')') : 'not found'));
  console.log('   container     ' + g.containerPos + '  y ' + g.container.y + ' -> ' + g.container.bottom + '  (' + g.container.w + 'x' + g.container.h + ')');
  console.log('   canvas css    y ' + g.canvasCss.y + ' -> ' + g.canvasCss.bottom + '  (' + g.canvasCss.w + 'x' + g.canvasCss.h + ')   buf ' + g.canvasBuf + '   gl ' + g.glBuf);
  console.log('   sphereR       ' + g.sphereR + '   max projected offset ' + half.toFixed(1) + ' (' + MAXK.toFixed(4) + ' x R)');
  console.log('   sphere centre (' + cx.toFixed(1) + ', ' + cy.toFixed(1) + ')   geometric extent y ' +
              (cy - half).toFixed(1) + ' -> ' + (cy + half).toFixed(1) + '   x ' + (cx - half).toFixed(1) + ' -> ' + (cx + half).toFixed(1));
  if (g.nav) {
    const over = g.nav.bottom - (cy - half);
    console.log('   UNDER THE NAV ' + (over > 0 ? over.toFixed(1) + ' px of the sphere sits above the nav bottom edge' : 'none (' + (-over).toFixed(1) + ' px clear)'));
  }
  console.log('   free margin   top ' + (cy - half).toFixed(1) + '   bottom ' + (vh - (cy + half)).toFixed(1) +
              '   left ' + (cx - half).toFixed(1) + '   right ' + (vw - (cx + half)).toFixed(1));
  if (ink) {
    console.log('   INK (below nav, real screenshot)  x ' + ink.left + ' -> ' + ink.right +
                '   y ' + ink.top + ' -> ' + ink.bottom + '   lit ' + ink.lit + '   shot ' + ink.buf);
  }
}

const gN = JSON.parse(await page.eval(GEOM));
const inkN = await inkBox(gN.nav ? gN.nav.bottom : 0);
report('NORMAL', gN, inkN);

if (!await page.eval(clickByText('Immersive'))) {
  const byTitle = '(() => { const b = [...document.querySelectorAll("button")]' +
    '.find(e => /immersive/i.test((e.title || "") + " " + (e.getAttribute("aria-label") || "")));' +
    ' if (!b) return false; b.click(); return true; })()';
  if (!await page.eval(byTitle)) throw new Error('no Immersive control found');
}
await sleep(3500);

const gI = JSON.parse(await page.eval(GEOM));
const inkI = await inkBox(gI.nav ? gI.nav.bottom : 0);
report('IMMERSIVE', gI, inkI);

// THE DECISIVE MEASUREMENT. The report says "during rotations", so a single
// frame cannot answer it: only some nodes are near the envelope at any instant.
// And the nav bar paints over whatever is behind it, so a screenshot cannot see
// the part that is cut. So: hide the nav strip (a probe-only DOM change, no
// source is touched), then take the UNION of the ink bounding box over a full
// stretch of the auto-rotation. That is the swept envelope the container has to
// hold, measured from pixels rather than from the projection model.
const PAINTED = '(() => {' +
  ' let n = [...document.querySelectorAll("button")].find(e => (e.innerText || "").indexOf("/CHAOS") >= 0);' +
  ' let best = null;' +
  ' while (n) { const q = n.getBoundingClientRect(); const cs = getComputedStyle(n);' +
  '   const bg = cs.backgroundColor || "";' +
  '   const opaque = bg && bg !== "transparent" && bg.indexOf("rgba(0, 0, 0, 0)") < 0;' +
  '   if (q.height > 220) break;' +
  '   if (q.width >= window.innerWidth * 0.9 && (opaque || cs.borderBottomWidth !== "0px" || cs.backdropFilter !== "none")) best = n;' +
  '   n = n.parentElement; }' +
  ' if (!best) return null;' +
  ' const q = best.getBoundingClientRect();' +
  ' return JSON.stringify({ y: +q.y.toFixed(1), bottom: +q.bottom.toFixed(1), h: +q.height.toFixed(1),' +
  '   bg: getComputedStyle(best).backgroundColor, bf: getComputedStyle(best).backdropFilter }); })()';

const painted = await page.eval(PAINTED);
const nav2 = painted ? JSON.parse(painted) : null;
console.log('\n== the strip that actually PAINTS over the artwork');
console.log('   ' + (nav2 ? ('y ' + nav2.y + ' -> ' + nav2.bottom + '  (h ' + nav2.h + ')   bg ' + nav2.bg + '   backdrop ' + nav2.bf)
                           : 'not found -- falling back to the button-row rect'));

// ── A MEASUREMENT THIS INSTRUMENT USED TO MAKE, AND MUST NOT ────────────────
//
// It hid the header and took the union of the ink bbox over a rotation sweep,
// then reported the difference as "N px of live artwork is painted over by the
// strip". It read 91 px before the fix and 60 px after. BOTH NUMBERS WERE
// WRONG, and the code that produced them is deleted rather than kept with a
// caveat, because a caveat in a comment does not survive being quoted.
//
// The header is `sticky`, not `fixed`: page content sits UNDERNEATH it by
// design. So hiding it does not reveal the artwork behind it -- it reveals the
// page's own HUD, which was never part of the immersive picture. The statistic
// was measuring chrome. That is the same failure as the "22% of immersive ink
// is frozen" reading that turned out to be the nav bar, one layer down, and it
// cost this session an hour.
//
// What to use instead:
//   - for "is the artwork inside its box", the numbers ABOVE: the container
//     rect from the DOM and the 1.0707 x sphereR bound from the projection.
//     Exact, rotation-invariant, and no pixels are involved.
//   - for the swept VISIBLE envelope including disc radius and glow halo,
//     `scripts/_a1clear.mjs`, which samples the live rotation but restricts
//     every bbox to rows INSIDE the container -- the header is 90% opaque, not
//     opaque, so the HUD bleeds through it at 10% and lands in any bbox that
//     starts higher.
//
// Rule of thumb this cost: before hiding an element to see what is behind it,
// check whether it is `sticky`. If it is, what you reveal is not what it covers.

await page.close();
