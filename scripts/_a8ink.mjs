// _a8ink.mjs — per-frame light budget across ONE PINNED BREATH, for the A/B
// between the glow shoulder and the build without it.
//
//   node scripts/_a8ink.mjs <tag-prefix> [<tag-prefix> ...]
//   e.g. node scripts/_a8ink.mjs lookbook/glow/ctrl-imm lookbook/glow/glow-imm
//
// ── WHY NOT `_a4halo.mjs` ──────────────────────────────────────────────────
// That instrument masks a CORE at lum > 0.9 and measures distance out from it.
// MEASURED: a resting sphere with no cascade in flight has no pixel that
// bright, so it throws. It was built for `_a3bloom.mjs`'s bright-node sweep and
// this is the opposite world — the dim, dormant one the hum lives in.
//
// ── THE THREE NUMBERS, AND THE FOURTH THAT IS THE POINT ────────────────────
// `ink`, `lit` and `ink/lit` are `artInk.mjs`'s trio and mean what they mean
// there: total light, drawn AREA, and how hard each lit pixel is lit. Summed,
// never averaged, for artInk's reason — a mean buries a thin edge inside a
// cell's dark majority.
//
// The fourth is `hot`: pixels at or above the composer's `luminanceThreshold`
// (0.28). That is the population the bloom's bright-pass acts on, so it is the
// direct answer to "does the halo pump the bloom": if `hot` does not move when
// the halo swells, the halo is not reaching the bright-pass, whatever it does
// to the total. Reported as a per-frame series so the BREATH is visible, not
// just the mean — a bloom that pumps is one whose `hot` swings with the phase.
//
// `floor` is the 10th percentile of the artwork region: the milky-black lift a
// wide shallow glow produces. It is the number that would show the halo
// raising the black everywhere rather than drawing a halo.
//
// Every statistic excludes the top HEADER rows: the nav strip is permanently
// bright static chrome and it lands inside the frame. An immersive pixel
// statistic that includes it reads 22% "frozen" when the artwork is 0.1%.
import { readFileSync, existsSync } from 'node:fs';
import { decodePng } from './_png.mjs';

const PREFIXES = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!PREFIXES.length) throw new Error('usage: node scripts/_a8ink.mjs <tag-prefix> [...]');

const HEADER = 110;          // device rows of app chrome — `_a4halo.mjs`'s constant
const FLOOR  = 0.02;         // the noise floor `lit` counts above
const HOT    = 0.28;         // SphereComposite's luminanceThreshold
const lum = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;

function measure(file) {
  const png = decodePng(readFileSync(file));
  const { width: W, height: H, data } = png;
  const top = Math.min(HEADER, H);
  let ink = 0, lit = 0, hot = 0, max = 0;
  const vals = [];
  for (let y = top; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = lum(data, (y * W + x) * 4);
      vals.push(v);
      if (v > max) max = v;
      if (v > FLOOR) { lit++; ink += v; }
      if (v >= HOT) hot++;
    }
  }
  vals.sort((a, b) => a - b);
  const pct = (p) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))];
  return { W, H, px: vals.length, ink, lit, hot, max, floor: pct(0.10), p99: pct(0.99) };
}

const fmt = (x, n = 4) => Number.isFinite(x) ? x.toFixed(n) : String(x);
const spread = (xs) => {
  const lo = Math.min(...xs), hi = Math.max(...xs), mid = (lo + hi) / 2;
  return { lo, hi, swingPct: mid ? ((hi - lo) / mid) * 100 : 0 };
};

const sets = [];
for (const prefix of PREFIXES) {
  const frames = [];
  for (let i = 0; ; i++) {
    const f = prefix + '-f' + i + '.png';
    if (!existsSync(f)) break;
    frames.push({ i, ...measure(f) });
  }
  if (!frames.length) throw new Error('no frames found for ' + prefix + ' (expected ' + prefix + '-f0.png)');
  sets.push({ prefix, frames });

  const name = prefix.replace(/^.*[/\\]/, '');
  console.log('\n' + name + '   ' + frames.length + ' frames, ' + frames[0].W + 'x' + frames[0].H
    + ', ' + frames[0].px.toLocaleString() + ' px measured (rows ' + HEADER + '+)');
  console.log('  f   ' + 'ink'.padStart(12) + 'lit'.padStart(10) + 'ink/lit'.padStart(10)
    + 'hot>=0.28'.padStart(11) + 'max'.padStart(9) + 'floor(p10)'.padStart(12));
  for (const f of frames) {
    console.log('  ' + String(f.i).padEnd(3)
      + Math.round(f.ink).toLocaleString().padStart(12)
      + f.lit.toLocaleString().padStart(10)
      + fmt(f.ink / f.lit).padStart(10)
      + f.hot.toLocaleString().padStart(11)
      + fmt(f.max).padStart(9)
      + fmt(f.floor, 5).padStart(12));
  }
  for (const key of ['ink', 'lit', 'hot']) {
    const s = spread(frames.map(f => f[key]));
    console.log('  ' + key.padEnd(4) + ' across the breath: ' + Math.round(s.lo).toLocaleString()
      + ' -> ' + Math.round(s.hi).toLocaleString() + '   swing ' + s.swingPct.toFixed(2) + '%');
  }
}

// ── The A/B, only when exactly two sets are given ───────────────────────────
// Ratios are candidate-over-reference with the FIRST prefix as the reference,
// which is why the control is passed first. Both sets come from the same pinned
// world at the same rotation, so a ratio here is the glow and nothing else.
if (sets.length === 2) {
  const [ref, cand] = sets;
  const mean = (fs, k) => fs.reduce((s, f) => s + f[k], 0) / fs.length;
  console.log('\n' + cand.prefix.replace(/^.*[/\\]/, '') + '  vs  '
    + ref.prefix.replace(/^.*[/\\]/, '') + '   (means over the breath)');
  for (const key of ['ink', 'lit', 'hot']) {
    const a = mean(ref.frames, key), b = mean(cand.frames, key);
    console.log('  ' + key.padEnd(4) + ' ' + Math.round(a).toLocaleString().padStart(12)
      + ' -> ' + Math.round(b).toLocaleString().padStart(12)
      + '   x' + (a ? (b / a).toFixed(4) : 'inf').padStart(8)
      + '   ' + (b - a >= 0 ? '+' : '') + Math.round(b - a).toLocaleString());
  }
  for (const key of ['ink', 'lit', 'hot']) {
    const a = spread(ref.frames.map(f => f[key])), b = spread(cand.frames.map(f => f[key]));
    console.log('  ' + key.padEnd(4) + ' BREATH SWING ' + a.swingPct.toFixed(2) + '%  ->  '
      + b.swingPct.toFixed(2) + '%');
  }
}
