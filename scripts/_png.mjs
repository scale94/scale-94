// _png.mjs — minimal PNG decode, dependency-free.
//
// Exists because the /art pixel gate has to read the COMPOSITED screenshot from
// step 3 onward, and comparing screenshots means decoding them in Node.
//
// Why the gate could not keep reading the 2D canvas: the signature was computed
// in-page from getImageData and summed R, G and B with no alpha term. That was
// correct while the 2D canvas was opaque and therefore *was* the whole picture.
// Once the clear became a `destination-out` alpha erase, a faded pixel keeps its
// full-brightness straight RGB and only loses alpha — so the old signature read
// a nearly-invisible trail as if it were at full brightness. It reported a mean
// difference of ~6 and a max of ~129 on a change that is provably identity.
//
// Node's zlib does the inflate; the rest is the PNG filter reconstruction from
// the spec. 8-bit only, non-interlaced — which is everything Chrome's
// Page.captureScreenshot emits.

import { inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };  // grey, RGB, grey+alpha, RGBA

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}

/** decodePng(buffer) -> { width, height, data } with data as RGBA bytes. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');

  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  let palette = null, trns = null;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;                       // length + type + data + crc

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }

  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error('interlaced PNG not supported');

  const isPalette = colorType === 3;
  const ch = isPalette ? 1 : CHANNELS[colorType];
  if (!ch) throw new Error(`unsupported colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride);
  const prev = new Uint8Array(stride);

  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    for (let i = 0; i < stride; i++) {
      const x = raw[rp + i];
      const a = i >= ch ? line[i - ch] : 0;   // left
      const b = prev[i];                      // up
      const c = i >= ch ? prev[i - ch] : 0;   // up-left
      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: v = x + paeth(a, b, c); break;
        default: throw new Error(`bad filter ${filter} on row ${y}`);
      }
      line[i] = v & 0xff;
    }
    rp += stride;

    // Expand the scanline to RGBA.
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4, s = x * ch;
      if (isPalette) {
        const p = line[s] * 3;
        out[o] = palette[p]; out[o + 1] = palette[p + 1]; out[o + 2] = palette[p + 2];
        out[o + 3] = trns && line[s] < trns.length ? trns[line[s]] : 255;
      } else if (colorType === 0) {
        out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = 255;
      } else if (colorType === 4) {
        out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = line[s + 1];
      } else if (colorType === 2) {
        out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2]; out[o + 3] = 255;
      } else {
        out[o] = line[s]; out[o + 1] = line[s + 1];
        out[o + 2] = line[s + 2]; out[o + 3] = line[s + 3];
      }
    }
    prev.set(line);
  }

  return { width, height, data: out };
}

/**
 * The same 32x18 mean-luminance signature the in-page version produced, over a
 * decoded screenshot. Grid-normalised, so two captures whose sphere rects differ
 * by a pixel still compare cleanly.
 *
 * The screenshot is already composited and opaque, so unlike the canvas version
 * this needs no alpha term — the alpha it would have used is 255 everywhere.
 */
export function signatureFromRgba(data, width, height, GX = 32, GY = 18) {
  const sums = new Float64Array(GX * GY), cnt = new Float64Array(GX * GY);
  for (let y = 0; y < height; y += 2) {
    const gy = Math.min(GY - 1, (y * GY / height) | 0);
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const k = gy * GX + Math.min(GX - 1, (x * GX / width) | 0);
      sums[k] += lum; cnt[k]++;
    }
  }
  return Array.from(sums, (v, k) => Math.round((v / (cnt[k] || 1)) * 10) / 10);
}
