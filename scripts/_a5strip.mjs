// _a5strip.mjs — one crop from each frame of a pinned sweep, side by side.
//
// The frames of a pinned sweep differ by an amount the eye cannot find while
// flicking between five 1920x1080 files in a folder. Putting the same crop from
// each of them in one image at the same scale is the only way to actually SEE
// what the swept key did, and the pictures are the deliverable here — the
// handover is explicit that whole-frame luminance cannot resolve bloom.
//
// A 2px divider between panels, drawn in mid grey so it cannot be mistaken for
// content on a black background.
//
//   node scripts/_a5strip.mjs out.png X Y W H in1.png in2.png ...
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePng } from './_png.mjs';
import { encodePng } from './_x_pngwrite.mjs';

const [OUT, X, Y, CW, CH, ...FILES] = process.argv.slice(2);
if (!OUT || !FILES.length) {
  throw new Error('usage: node scripts/_a5strip.mjs out.png X Y W H in1.png [in2.png ...]');
}
const x0 = Number(X), y0 = Number(Y), cw = Number(CW), ch = Number(CH);
const GAP = 2;

const imgs = FILES.map(f => decodePng(readFileSync(f)));
for (const [i, p] of imgs.entries()) {
  if (x0 + cw > p.width || y0 + ch > p.height) {
    throw new Error('crop ' + cw + 'x' + ch + ' at ' + x0 + ',' + y0
      + ' does not fit ' + FILES[i] + ' (' + p.width + 'x' + p.height + ')');
  }
}

const W = cw * imgs.length + GAP * (imgs.length - 1);
const out = new Uint8Array(W * ch * 4);
for (let i = 3; i < out.length; i += 4) out[i] = 255;          // opaque
for (let p = 0; p < imgs.length; p++) {
  const src = imgs[p].data, sw = imgs[p].width, ox = p * (cw + GAP);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const s = ((y0 + y) * sw + (x0 + x)) * 4, d = (y * W + ox + x) * 4;
      out[d] = src[s]; out[d + 1] = src[s + 1]; out[d + 2] = src[s + 2];
    }
  }
  if (p < imgs.length - 1) {
    for (let y = 0; y < ch; y++) for (let g = 0; g < GAP; g++) {
      const d = (y * W + ox + cw + g) * 4;
      out[d] = 90; out[d + 1] = 90; out[d + 2] = 90;
    }
  }
}
writeFileSync(OUT, encodePng(out, W, ch));
console.log('wrote ' + OUT + '  ' + W + 'x' + ch + '  panels left to right:');
FILES.forEach((f, i) => console.log('   ' + (i + 1) + '. ' + f));
