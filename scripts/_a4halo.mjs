// _a4halo.mjs — the halo around the ink, and the floor far away from it.
//
// Item 5a wanted a number and the handover said which one: "measure the halo
// profile around one bright node, not the frame". Whole-frame luminance cannot
// resolve bloom on this build — MEASURED, same-build frames correlate 0.98-0.99
// and the run-to-run composite variation is the same size as a 1.1 -> 0.4
// intensity change — so a frame mean is noise with a number attached.
//
// This reads a PINNED sweep (scripts/_a3bloom.mjs), where every frame is the
// same world at the same rotation and the only difference is the swept key, and
// asks two questions the eye is asking:
//
//   1. HOW FAR DOES THE GLOW REACH? Mean luminance as a function of distance
//      from the bright ink, out to 250 px.
//   2. HOW MILKY IS THE BLACK? Low percentiles of the artwork's luminance. A
//      wide, shallow bloom lifts the floor everywhere, and that lift is both the
//      "milky exterior halo" and the surface that bands on an 8-bit output over
//      a pitch-black background.
//
// ── THE MASK IS COMPUTED ONCE AND SHARED ───────────────────────────────────
// The distance is measured from a CORE MASK — the pixels bright enough to be
// driving the bloom. That mask is built from the REFERENCE frame (the first one
// on the command line) and then used unchanged for every other frame. Letting
// each frame mask itself would move the ruler with the thing being measured:
// a frame with less bloom has a smaller bright region, so it would be scored
// against a different set of distances and read artificially tight.
//
// ── WHAT IS AND IS NOT CONTROLLED ──────────────────────────────────────────
// At large distances the profile inevitably contains other structures — edges,
// nodes, the wireframe ghost. That is fine here and only here: the world is
// pinned, so that contamination is IDENTICAL in every frame and cancels in the
// comparison between them. It does NOT cancel if these numbers are quoted
// against a frame from another run. They are differences within one sweep, and
// they mean nothing outside it.
//
// The top HEADER rows are excluded. An immersive pixel statistic that includes
// the app nav bar reads 22% "frozen" when the artwork is 0.1% — the strip is
// permanently static bright chrome and it lands inside the sphere crop.
//
//   node scripts/_a4halo.mjs lookbook/a.png lookbook/b.png ...
import { readFileSync } from 'node:fs';
import { decodePng } from './_png.mjs';

const FILES = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!FILES.length) throw new Error('usage: node scripts/_a4halo.mjs <png> [png ...]');

// Device rows of app chrome at the top of the frame. The immersive container is
// inset below the header (dc397b2) and the header is h-24 = 96 CSS px; 110 is
// that plus a margin for the hairline under it.
const HEADER = 110;
// The core mask: pixels this bright are what the bloom's bright-pass is acting
// on. An absolute level is acceptable HERE because it only selects a region to
// measure distance from, and the same region is used for every frame.
const CORE = 0.9;
const MAXD = 250;
// sRGB byte -> relative luminance, in the space the panel actually shows.
const lum = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;

const imgs = FILES.map(f => ({ name: f.replace(/^.*[/\\]/, ''), png: decodePng(readFileSync(f)) }));
const { width: W, height: H } = imgs[0].png;
for (const im of imgs) {
  if (im.png.width !== W || im.png.height !== H) {
    throw new Error('frames differ in size: ' + im.name + ' is ' + im.png.width + 'x' + im.png.height);
  }
}
console.log('\n' + FILES.length + ' frames, ' + W + 'x' + H + ', rows 0-' + (HEADER - 1)
  + ' excluded as app chrome.  Mask from ' + imgs[0].name + ' at lum > ' + CORE + '.');

// ── Core mask + chamfer distance transform, from the reference frame ────────
const INF = 1e9;
const dist = new Float32Array(W * H).fill(INF);
{
  const d = imgs[0].png.data;
  let core = 0;
  for (let y = HEADER; y < H; y++) for (let x = 0; x < W; x++) {
    if (lum(d, (y * W + x) * 4) > CORE) { dist[y * W + x] = 0; core++; }
  }
  if (!core) throw new Error('no pixel above the core threshold in ' + imgs[0].name);
  console.log('   core mask: ' + core + ' px');
}
// Two-pass chamfer (3, 4)/3 — good to ~2% of true Euclidean, and the bins below
// are far coarser than that.
const A = 1, B = 1.41421356;
for (let y = HEADER; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x; let v = dist[i];
  if (y > HEADER) {
    v = Math.min(v, dist[i - W] + A);
    if (x > 0) v = Math.min(v, dist[i - W - 1] + B);
    if (x < W - 1) v = Math.min(v, dist[i - W + 1] + B);
  }
  if (x > 0) v = Math.min(v, dist[i - 1] + A);
  dist[i] = v;
}
for (let y = H - 1; y >= HEADER; y--) for (let x = W - 1; x >= 0; x--) {
  const i = y * W + x; let v = dist[i];
  if (y < H - 1) {
    v = Math.min(v, dist[i + W] + A);
    if (x < W - 1) v = Math.min(v, dist[i + W + 1] + B);
    if (x > 0) v = Math.min(v, dist[i + W - 1] + B);
  }
  if (x < W - 1) v = Math.min(v, dist[i + 1] + A);
  dist[i] = v;
}

// ── 1. Mean luminance by distance from the core ─────────────────────────────
const BINS = [0, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 160, 200, 250];
const binOf = (r) => { for (let b = BINS.length - 1; b >= 0; b--) if (r >= BINS[b]) return b; return 0; };
const profiles = imgs.map(({ png }) => {
  const sum = new Float64Array(BINS.length), cnt = new Float64Array(BINS.length);
  for (let y = HEADER; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, r = dist[i];
    if (r > MAXD) continue;
    const b = binOf(r);
    sum[b] += lum(png.data, i * 4); cnt[b]++;
  }
  return sum.map((s, b) => (cnt[b] ? s / cnt[b] : 0));
});
console.log('\n== MEAN LUMINANCE BY DISTANCE FROM THE BRIGHT INK');
console.log('   px     ' + imgs.map(i => i.name.replace(/^bloom-|\.png$/g, '').padStart(11)).join(''));
for (let b = 0; b < BINS.length; b++) {
  const lo = BINS[b], hi = b + 1 < BINS.length ? BINS[b + 1] : MAXD;
  console.log('   ' + (lo + '-' + hi).padEnd(8)
    + profiles.map(p => p[b].toFixed(5).padStart(11)).join(''));
}
console.log('   ' + 'vs first'.padEnd(8)
  + profiles.map(p => {
    const far = (p[BINS.indexOf(96)] + p[BINS.indexOf(128)] + p[BINS.indexOf(160)]) / 3;
    const ref = (profiles[0][BINS.indexOf(96)] + profiles[0][BINS.indexOf(128)] + profiles[0][BINS.indexOf(160)]) / 3;
    return (ref ? 'x' + (far / ref).toFixed(3) : '-').padStart(11);
  }).join('') + '   <- far field, 96-200 px');

// ── 2. How milky is the black ───────────────────────────────────────────────
// Percentiles over the ARTWORK only, and low ones: a wide shallow bloom lifts
// the floor, and the floor is where a black background shows it.
console.log('\n== ARTWORK LUMINANCE PERCENTILES  (the milky floor, and what bands)');
const PCTS = [1, 5, 10, 25, 50, 90, 99];
console.log('   pct    ' + imgs.map(i => i.name.replace(/^bloom-|\.png$/g, '').padStart(11)).join(''));
const cols = imgs.map(({ png }) => {
  const vals = new Float64Array((H - HEADER) * W);
  let n = 0;
  for (let y = HEADER; y < H; y++) for (let x = 0; x < W; x++) vals[n++] = lum(png.data, (y * W + x) * 4);
  const s = vals.subarray(0, n).slice().sort();
  return PCTS.map(p => s[Math.min(n - 1, Math.floor(n * p / 100))]);
});
PCTS.forEach((p, k) => {
  console.log('   p' + String(p).padEnd(6) + cols.map(c => c[k].toFixed(5).padStart(11)).join(''));
});

// ── 3. What the bright-pass is handed ───────────────────────────────────────
// Not a bloom measurement — a sanity check that the frames really do hold the
// same world. These counts are set by the ink, not by the pyramid, so they
// should barely move across a `levels` sweep. If they move a lot, the sweep is
// not a sweep and nothing above it means anything.
console.log('\n== SANITY: pixels the bright-pass can see (lum > 0.28) and clipped pixels (>= 254)');
console.log('   frame                 over-threshold      clipped      frame mean');
imgs.forEach(({ name, png }) => {
  let over = 0, clip = 0, sum = 0, n = 0;
  for (let y = HEADER; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, l = lum(png.data, i);
    if (l > 0.28) over++;
    if (png.data[i] >= 254 || png.data[i + 1] >= 254 || png.data[i + 2] >= 254) clip++;
    sum += l; n++;
  }
  console.log('   ' + name.padEnd(24) + String(over).padStart(10)
    + String(clip).padStart(13) + (sum / n).toFixed(5).padStart(16));
});
