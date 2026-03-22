// useVisitorEntropy.js — Visitor behavior → simulation perturbation vector
// Tracks 5 browser-event channels + 1 aggregate, outputs a Float64Array[6]
// read by the RAF loop each frame. Pure ref-based — zero React re-renders.

import { useRef, useEffect, useCallback } from 'react';

// Channel indices
const CH_SCROLL      = 0;  // scroll velocity → r acceleration
const CH_HOVER       = 1;  // hover duration → neighbor resonance
const CH_IDLE        = 2;  // idle time → system cooling
const CH_DRAG        = 3;  // drag velocity → physics turbulence
const CH_RHYTHM      = 4;  // click rhythm regularity → coupling strength
const CH_AGGREGATE   = 5;  // Shannon entropy of channels 0-4

const EMA_ALPHA      = 0.08;   // smoothing constant
const IDLE_CEILING   = 8000;   // ms until full cooling
const RHYTHM_BUF_LEN = 8;     // click timestamp ring buffer size

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function shannonEntropy(vals) {
  let sum = 0;
  for (let i = 0; i < vals.length; i++) sum += vals[i];
  if (sum < 1e-12) return 0;
  let h = 0;
  for (let i = 0; i < vals.length; i++) {
    const p = vals[i] / sum;
    if (p > 1e-12) h -= p * Math.log2(p);
  }
  // Normalize to [0,1] by dividing by log2(N)
  return h / Math.log2(vals.length);
}

export function useVisitorEntropy({ hoveredRef, dragRef }) {
  const entropyRef = useRef(new Float64Array(6));

  const internalsRef = useRef({
    scrollAccum: 0,           // accumulated scroll delta
    hoverStart: 0,            // timestamp when hover began
    lastHoveredId: null,      // track hover changes
    lastInteraction: performance.now(),
    clickTimes: new Float64Array(RHYTHM_BUF_LEN),
    clickIdx: 0,
    clickCount: 0,
    lastStep: performance.now(),
  });

  // ── Event listeners ──────────────────────────────────────────────
  useEffect(() => {
    const int = internalsRef.current;

    const onWheel = (e) => {
      int.scrollAccum += Math.abs(e.deltaY) + Math.abs(e.deltaX);
      int.lastInteraction = performance.now();
    };

    const onClick = () => {
      const now = performance.now();
      int.clickTimes[int.clickIdx % RHYTHM_BUF_LEN] = now;
      int.clickIdx++;
      int.clickCount = Math.min(int.clickCount + 1, RHYTHM_BUF_LEN);
      int.lastInteraction = now;
    };

    const onAnyInput = () => {
      int.lastInteraction = performance.now();
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('mousemove', onAnyInput);
    window.addEventListener('touchstart', onAnyInput, { passive: true });
    window.addEventListener('keydown', onAnyInput);

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('click', onClick);
      window.removeEventListener('mousemove', onAnyInput);
      window.removeEventListener('touchstart', onAnyInput);
      window.removeEventListener('keydown', onAnyInput);
    };
  }, []);

  // ── Per-frame step (called from RAF loop) ────────────────────────
  const stepEntropy = useCallback(() => {
    const int = internalsRef.current;
    const ent = entropyRef.current;
    const now = performance.now();

    // Channel 0 — Scroll entropy
    const rawScroll = clamp01(int.scrollAccum * 0.008);
    int.scrollAccum *= 0.92;  // decay
    ent[CH_SCROLL] += (rawScroll - ent[CH_SCROLL]) * EMA_ALPHA;

    // Channel 1 — Hover resonance
    const hId = hoveredRef?.current ?? null;
    if (hId !== null) {
      if (hId !== int.lastHoveredId) {
        int.hoverStart = now;
        int.lastHoveredId = hId;
      }
      const hoverMs = now - int.hoverStart;
      // Sigmoid centered at 500ms, steepness 0.005
      const rawHover = 1 / (1 + Math.exp(-(hoverMs - 500) * 0.005));
      ent[CH_HOVER] += (rawHover - ent[CH_HOVER]) * EMA_ALPHA;
    } else {
      int.lastHoveredId = null;
      ent[CH_HOVER] *= (1 - EMA_ALPHA);  // decay toward 0
    }

    // Channel 2 — Idle cooling
    const idleMs = now - int.lastInteraction;
    const rawIdle = clamp01(idleMs / IDLE_CEILING);
    ent[CH_IDLE] += (rawIdle - ent[CH_IDLE]) * EMA_ALPHA;

    // Channel 3 — Drag turbulence
    const drag = dragRef?.current;
    if (drag && drag.active) {
      const v = Math.sqrt(drag.vx * drag.vx + drag.vy * drag.vy);
      const rawDrag = clamp01(v * 20);
      ent[CH_DRAG] += (rawDrag - ent[CH_DRAG]) * EMA_ALPHA;
    } else {
      ent[CH_DRAG] *= (1 - EMA_ALPHA * 0.5);  // slower decay
    }

    // Channel 4 — Click rhythm (coefficient of variation of intervals)
    if (int.clickCount >= 3) {
      const n = Math.min(int.clickCount, RHYTHM_BUF_LEN);
      // Compute intervals between recent clicks
      const sorted = [];
      for (let i = 0; i < n; i++) sorted.push(int.clickTimes[i]);
      sorted.sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < sorted.length; i++) {
        const dt = sorted[i] - sorted[i - 1];
        if (dt > 0 && dt < 5000) intervals.push(dt);  // ignore >5s gaps
      }
      if (intervals.length >= 2) {
        let mean = 0;
        for (const iv of intervals) mean += iv;
        mean /= intervals.length;
        let variance = 0;
        for (const iv of intervals) variance += (iv - mean) * (iv - mean);
        variance /= intervals.length;
        const cv = Math.sqrt(variance) / (mean + 1e-6);
        // Low CV = rhythmic = high coupling
        const rawRhythm = clamp01(1 - cv);
        ent[CH_RHYTHM] += (rawRhythm - ent[CH_RHYTHM]) * EMA_ALPHA;
      }
    } else {
      ent[CH_RHYTHM] *= (1 - EMA_ALPHA * 0.3);  // very slow decay
    }

    // Channel 5 — Aggregate Shannon entropy of channels 0-4
    const sub = [ent[0], ent[1], ent[2], ent[3], ent[4]];
    ent[CH_AGGREGATE] = shannonEntropy(sub);

    int.lastStep = now;
  }, [hoveredRef, dragRef]);

  return { entropyRef, stepEntropy };
}
