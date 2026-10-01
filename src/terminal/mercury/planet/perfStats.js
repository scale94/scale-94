// src/terminal/mercury/planet/perfStats.js — frame-time statistics for the dev perf HUD
// (phase-4 spec §4). A preallocated ring buffer filled from useFrame (no allocation per
// frame); summaries run at the HUD's 4 Hz. The still/liquid split exists because the
// liquid branch is the expensive state and an average would hide it.

export const PERF_WINDOW_S = 2;

// Live readout the frame loop writes and the HUD (and probes, via window.__mercuryPerf) read.
export const PERF_INFO = { tau: 0, heatK: 0, coverage: 0, tailB: 0, vrKmS: 0 };

export function createPerfStats(capacity = 1024) {
  return {
    cap: capacity,
    t: new Float64Array(capacity),
    dt: new Float32Array(capacity),
    liquid: new Uint8Array(capacity),
    head: 0,
    count: 0,
    scratch: new Float32Array(capacity),
  };
}

export function pushFrame(s, tS, dtS, liquid) {
  s.t[s.head] = tS;
  s.dt[s.head] = dtS;
  s.liquid[s.head] = liquid ? 1 : 0;
  s.head = (s.head + 1) % s.cap;
  if (s.count < s.cap) s.count++;
}

const pick = (sorted, n, p) => sorted[Math.min(n - 1, Math.floor(p * n))];

export function summarize(s, nowS, { liquid } = {}) {
  let n = 0;
  for (let k = 0; k < s.count; k++) {
    const i = (s.head - 1 - k + s.cap) % s.cap;
    if (nowS - s.t[i] > PERF_WINDOW_S) break;
    if (liquid !== undefined && (s.liquid[i] === 1) !== liquid) continue;
    s.scratch[n++] = s.dt[i] * 1000;
  }
  if (n === 0) return { n: 0, p50: 0, p95: 0, max: 0, fps: 0 };
  const sorted = s.scratch.subarray(0, n).sort();
  const p50 = pick(sorted, n, 0.5);
  return { n, p50, p95: pick(sorted, n, 0.95), max: sorted[n - 1], fps: p50 > 0 ? 1000 / p50 : 0 };
}
