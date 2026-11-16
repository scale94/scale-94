// quality.js — which render path a device gets. Pure: no DOM, no React.
//
// uQuality is 1 (full) or 0.5 (reduced: fewer noise octaves actually
// evaluated, one granulation layer most of the time, a single arch strand,
// and a smaller canvas). Chosen once shortly after mount; a measured switch
// from 1 to 0.5 happens at most once and never back (SolCanvas owns that).

export const QUALITY_FULL = 1;
export const QUALITY_REDUCED = 0.5;
export const NARROW_PX = 768;          // viewports narrower than this are phones
export const SLOW_FRAME_MS = 20;       // first-second average frame time above this is slow
export const WARMUP_S = 0.4;           // running time discarded first (tab fade, commit, link jank)
export const MEASURE_S = 1;            // running time measured after the warm-up
const TRIM_SLOWEST = 0.1;              // share of the slowest frames dropped from the mean
const NARROW_DPR_MAX = 1.5;            // narrow screens never render above this ratio
const REDUCED_SCALE = 0.75;            // the reduced path's share of the full ratio
const HARNESS_DPR_MAX = 2;             // glHost caps devicePixelRatio at 2

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** 0.5 for a narrow viewport or a slow first second; 1 otherwise (and for non-finite input). */
export function chooseQuality({ viewportWidth, avgFrameMs } = {}) {
  if (finite(viewportWidth) && viewportWidth < NARROW_PX) return QUALITY_REDUCED;
  if (finite(avgFrameMs) && avgFrameMs > SLOW_FRAME_MS) return QUALITY_REDUCED;
  return QUALITY_FULL;
}

/**
 * The typical frame time (ms) of a measured run: the mean after dropping the
 * slowest 10%, so a few hitches (GC, a late commit) cannot read as a slow
 * device. Non-finite and negative entries are ignored; NaN when none remain.
 */
export function typicalFrameMs(samplesMs = []) {
  const s = [];
  for (const v of samplesMs) if (finite(v) && v >= 0) s.push(v);
  if (s.length === 0) return NaN;
  s.sort((a, b) => a - b);
  const keep = Math.max(1, s.length - Math.floor(s.length * TRIM_SLOWEST));
  let sum = 0;
  for (let i = 0; i < keep; i++) sum += s[i];
  return sum / keep;
}

/**
 * Backing-store pixels per CSS pixel. Full quality on a wide screen is
 * exactly the harness's own ratio, min(2, dpr); narrow screens cap it at 1.5;
 * the reduced path renders at 0.75 of that.
 */
export function pixelRatioFor({ quality, viewportWidth, dpr } = {}) {
  let r = Math.min(HARNESS_DPR_MAX, finite(dpr) && dpr > 0 ? dpr : 1);
  if (finite(viewportWidth) && viewportWidth < NARROW_PX) r = Math.min(r, NARROW_DPR_MAX);
  return finite(quality) && quality < QUALITY_FULL ? r * REDUCED_SCALE : r;
}
