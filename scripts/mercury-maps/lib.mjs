// scripts/mercury-maps/lib.mjs — pure raster helpers for build.mjs (tested).

export function boxDownsample(src, w, h, channels, f) {
  if (w % f !== 0 || h % f !== 0) throw new Error(`factor ${f} must divide ${w}×${h}`);
  const ow = w / f, oh = h / f;
  const out = new Float32Array(ow * oh * channels);
  const inv = 1 / (f * f);
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      for (let c = 0; c < channels; c++) {
        let sum = 0;
        for (let dy = 0; dy < f; dy++) {
          const row = (oy * f + dy) * w;
          for (let dx = 0; dx < f; dx++) sum += src[(row + ox * f + dx) * channels + c];
        }
        out[(oy * ow + ox) * channels + c] = sum * inv;
      }
    }
  }
  return out;
}

export function rollToLonZero(data, w, h, channels, lonStartDeg) {
  const shift = Math.round((((-lonStartDeg % 360) + 360) % 360) / 360 * w) % w;
  if (shift === 0) return data;
  const out = new data.constructor(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (y * w + ((x + shift) % w)) * channels;
      const dst = (y * w + x) * channels;
      for (let c = 0; c < channels; c++) out[dst + c] = data[src + c];
    }
  }
  return out;
}

// Deterministic ±0.5 LSB dither: kills terracing when the shader exaggerates relief.
export function quantise8Dithered(values, min, max) {
  const out = new Uint8Array(values.length);
  const scale = 255 / (max - min);
  for (let i = 0; i < values.length; i++) {
    const h = Math.sin(i * 12.9898) * 43758.5453;
    const noise = (h - Math.floor(h)) - 0.5;
    const q = Math.round((values[i] - min) * scale + noise);
    out[i] = q < 0 ? 0 : q > 255 ? 255 : q;
  }
  return out;
}

export function minMax(values, isValid = () => true) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!isValid(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

// Percentile clip via a 1-unit-bin histogram (O(n), low memory): returns the
// values at rank floor(lo*(n-1)) and floor(hi*(n-1)) of the valid samples.
export function percentileRange(values, lo, hi, isValid = () => true) {
  const { min: vmin, max: vmax } = minMax(values, isValid);
  if (vmin === Infinity) return { min: Infinity, max: -Infinity };
  const bins = new Uint32Array(Math.floor(vmax - vmin) + 1);
  let n = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!isValid(v)) continue;
    bins[Math.floor(v - vmin)]++;
    n++;
  }
  const at = (rank) => {
    let acc = 0;
    for (let b = 0; b < bins.length; b++) {
      acc += bins[b];
      if (acc > rank) return vmin + b;
    }
    return vmax;
  };
  return { min: at(Math.floor(lo * (n - 1))), max: at(Math.floor(hi * (n - 1))) };
}
