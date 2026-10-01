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

// ---- diagnostic extras (phone-run instrumentation; same preallocated-ring discipline) --------

export const LONG_FRAME_MS = 33;

// Per-frame CPU-side record: js ms (frame start -> end of render submit), pointermove count,
// ms spent in the HUD's forced-layout probe, and whether the frame follows a HUD DOM write.
export function createExtraStats(capacity = 1024) {
  return {
    cap: capacity,
    t: new Float64Array(capacity),
    dt: new Float32Array(capacity),
    js: new Float32Array(capacity),
    ptr: new Uint16Array(capacity),
    lay: new Float32Array(capacity),
    hud: new Uint8Array(capacity),
    head: 0,
    count: 0,
    scratch: new Float32Array(capacity),
  };
}

export function pushExtra(s, tS, dtS, jsMs, ptrN, layMs, hudAdj) {
  const h = s.head;
  s.t[h] = tS; s.dt[h] = dtS; s.js[h] = jsMs; s.ptr[h] = ptrN; s.lay[h] = layMs; s.hud[h] = hudAdj ? 1 : 0;
  s.head = (h + 1) % s.cap;
  if (s.count < s.cap) s.count++;
}

function stat(sorted, n) {
  return n ? { p50: pick(sorted, n, 0.5), p95: pick(sorted, n, 0.95), max: sorted[n - 1] } : { p50: 0, p95: 0, max: 0 };
}

export function summarizeExtra(s, nowS) {
  let n = 0, ptrSum = 0, long = 0, longHud = 0, hudFrames = 0;
  for (let k = 0; k < s.count; k++) {
    const i = (s.head - 1 - k + s.cap) % s.cap;
    if (nowS - s.t[i] > PERF_WINDOW_S) break;
    s.scratch[n++] = s.js[i];
    ptrSum += s.ptr[i];
    const isLong = s.dt[i] * 1000 > LONG_FRAME_MS;
    if (s.hud[i] === 1) hudFrames++;
    if (isLong) { long++; if (s.hud[i] === 1) longHud++; }
  }
  const js = stat(s.scratch.subarray(0, n).sort(), n);
  // forced-layout cost only means something on frames that had pointer events
  let layN = 0;
  for (let k = 0; k < n; k++) {
    const i = (s.head - 1 - k + s.cap) % s.cap;
    if (s.ptr[i] > 0) s.scratch[layN++] = s.lay[i];
  }
  const lay = stat(s.scratch.subarray(0, layN).sort(), layN);
  return {
    n, js, ptrAvg: n ? ptrSum / n : 0, layN, layP95: lay.p95, layMax: lay.max,
    long, longHud, hudFrames,
    hudShareOfLong: long ? longHud / long : 0,
    hudBaseRate: n ? hudFrames / n : 0,
  };
}

// Timestamped scalar events: long tasks (duration ms) and resolved GPU timer queries (ms).
export function createEventLog(capacity = 256) {
  return { cap: capacity, t: new Float64Array(capacity), v: new Float32Array(capacity), head: 0, count: 0, scratch: new Float32Array(capacity) };
}

export function pushEvent(s, tS, v) {
  s.t[s.head] = tS; s.v[s.head] = v;
  s.head = (s.head + 1) % s.cap;
  if (s.count < s.cap) s.count++;
}

export function summarizeEvents(s, nowS) {
  let n = 0, total = 0;
  for (let k = 0; k < s.count; k++) {
    const i = (s.head - 1 - k + s.cap) % s.cap;
    if (nowS - s.t[i] > PERF_WINDOW_S) break;
    s.scratch[n++] = s.v[i];
    total += s.v[i];
  }
  const st = stat(s.scratch.subarray(0, n).sort(), n);
  return { n, total, ...st };
}
