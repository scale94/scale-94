// Throwaway — is the 2-D source canvas still carrying any ink?
//
// SphereComposite's SourceQuad re-uploads a full-resolution CanvasTexture every
// frame (`texture.needsUpdate = true`) and the screen shader composites it with
// `mix(bg, src.rgb, src.a)`. Its comment says the cost was MEASURED — and it
// was, back when that canvas carried the whole 2-D sphere. Since the WebGL
// migration the only `ctx` call left in ArtTab's draw loop is a
// `destination-out` fillRect, which erases alpha on a surface nothing paints.
//
// If `src.a` is 0 everywhere then the upload is dead weight, and deleting it
// (with the `mix`) is bit-identical by construction — which artCompare can then
// prove for free against the certified reference.
//
// WHY THIS IS A SCRIPT AND NOT A DEVTOOLS ONE-LINER. The desktop app's browser
// pane never fires requestAnimationFrame: MEASURED at 0 frames in 1 s with
// document.hidden false. Every canvas read there returns the pre-boot state and
// looks exactly like a confirmed-dead layer. This boots a real Chrome instead.
//
// Runs the page LIVE — no --deterministic, no __virtualize. The question is
// what the draw loop actually paints over a few seconds of real frames, so the
// clock must be real.
//
//   node scripts/_a5srcalpha.mjs [W] [H] [DPR] [--normal]
//
// Touches no tracked source, so there is nothing to restore and no `git status`
// check to run afterwards.
import { launch } from './cdp.mjs';

const URL = 'http://localhost:5174/';
const W   = Number(process.argv[2] ?? 1920);
const H   = Number(process.argv[3] ?? 1080);
const DPR = Number(process.argv[4] ?? 1);
const NORMAL = process.argv.includes('--normal');
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
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';
const clickImmersive = '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => /immersive/i.test((e.innerText || "") + " " + (e.title || "") + " " + (e.getAttribute("aria-label") || "")));' +
  ' if (!b) return false; b.click(); return true; })()';

// Reads the SOURCE canvas, the one SourceQuad uploads — explicitly the sibling
// of [data-art-composite], never "the widest canvas on the page". The site-wide
// film-grain canvas is also full-screen, is NOT inside the composite, and is
// full of ink; a selector that can pick it up answers a different question and
// answers it wrong.
const PROBE = `(() => {
  const host = document.querySelector('[data-art-composite]');
  if (!host) return JSON.stringify({ error: 'no composite host' });
  const c = host.parentElement.querySelector('canvas');
  if (!c) return JSON.stringify({ error: 'no source canvas' });
  const g = c.getContext('2d');
  if (!g) return JSON.stringify({ error: 'source canvas has no 2d context' });
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let maxA = 0, nzA = 0, maxRGB = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a > maxA) maxA = a;
    if (a > 0) nzA++;
    const m = Math.max(d[i], d[i + 1], d[i + 2]);
    if (m > maxRGB) maxRGB = m;
  }
  return JSON.stringify({
    size: c.width + 'x' + c.height, px: d.length / 4,
    maxAlpha: maxA, nonZeroAlphaPx: nzA, maxRGB,
  });
})()`;

// rAF really running? The whole reason this script exists. A reading taken
// while the loop is dead is indistinguishable from a dead layer.
const RAF_ALIVE = `(async () => {
  let n = 0; const t0 = performance.now();
  await new Promise(res => {
    const step = () => { n++; performance.now() - t0 < 1000 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
    setTimeout(res, 1500);
  });
  return JSON.stringify({ rafFramesIn1s: n, hidden: document.hidden });
})()`;

const page = await launch({ url: URL, width: W, height: H, dpr: DPR });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  await sleep(2500);
  if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
  await page.waitFor(GL_READY, { label: 'GL composite sized', timeoutMs: 40000 });

  if (!NORMAL && !await page.eval(clickImmersive)) throw new Error('no immersive toggle');
  await sleep(4000);

  const raf = JSON.parse(await page.eval(RAF_ALIVE, { awaitPromise: true }));
  console.log('rAF          ', raf);
  if (!raf.rafFramesIn1s) throw new Error('rAF is not running — every reading below would be meaningless');

  console.log('idle         ', JSON.parse(await page.eval(PROBE)));

  // Fire a cascade. If ANY layer still reaches the 2-D canvas it is most likely
  // an event layer, so a reading taken only at rest would miss it.
  const at = JSON.parse(await page.eval('JSON.stringify((() => {'
    + ' const c = ' + SPHERE + '; const r = c.getBoundingClientRect();'
    + ' return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })())'));
  await page.click(at.x, at.y);
  await sleep(600);
  console.log('mid-cascade  ', JSON.parse(await page.eval(PROBE)));
  await sleep(3000);
  console.log('after cascade', JSON.parse(await page.eval(PROBE)));
} finally {
  await page.close();
}
