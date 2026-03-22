// useCollectiveR.js — Bifurcation Conductor + Collective Perturbation
//
// Two forces that let visitors (solo or in groups) manually steer the
// Feigenbaum r-parameter toward chaos:
//
// 1. Bifurcation Conductor — a draggable vertical strip on the ArtTab canvas.
//    Dragging up pushes r toward R_MAX, releasing lets it spring-decay back.
//
// 2. Collective Perturbation — when 3+ peers are connected via SomaPresence,
//    their aggregate cursor entropy drives r upward through a sigmoid gate.
//    1 visitor = negligible, 3 = noticeable, 5+ = strong push toward chaos.
//
// Output: stepCollectiveR() called each RAF frame, returns rDelta to add to
//         fieldRef.current.r. Pure ref-based — zero React re-renders.

import { useRef, useCallback } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────

// Conductor
const R_MIN            = 1.0;
const R_MAX            = 3.999;
const MANUAL_DECAY     = 0.97;    // spring-decay per frame when released

// Collective perturbation — sigmoid gate
const SIGMOID_CENTER   = 3.0;     // half-max at 3 peers
const SIGMOID_GAIN     = 1.5;     // steepness
const MAX_CONTRIBUTION = 0.0025;  // max r-push per frame from collective
const ENTROPY_SMOOTH   = 0.06;    // EMA smoothing for peer entropy

// ── Sigmoid ──────────────────────────────────────────────────────────────────

function sigmoid(x, center, gain) {
  return 1.0 / (1.0 + Math.exp(-gain * (x - center)));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCollectiveR() {
  const stateRef = useRef({
    // Conductor
    manualTarget: null,          // 0..1 normalized position, null = released
    manualR:      0,             // smoothed manual contribution to r

    // Collective
    peerEntropy:  0,             // EMA-smoothed aggregate peer cursor entropy
    collectiveR:  0,             // current collective contribution to r

    // Combined output
    rDelta:       0,             // total r adjustment this frame
    conductorY:   0,             // 0..1 for visual indicator (0=bottom/stable, 1=top/chaos)
  });

  /**
   * Called from pointer events on the conductor strip.
   * @param {number|null} normalizedY — 0 (bottom/stable) to 1 (top/chaos), or null on release
   */
  const setConductor = useCallback((normalizedY) => {
    stateRef.current.manualTarget = normalizedY;
  }, []);

  /**
   * Feed aggregate peer cursor activity each frame.
   * @param {number} peerCount — number of connected peers
   * @param {number} rawEntropy — 0..1 aggregate cursor movement entropy
   */
  const feedPeerEntropy = useCallback((peerCount, rawEntropy) => {
    const s = stateRef.current;
    // EMA smooth the raw entropy
    s.peerEntropy += (rawEntropy - s.peerEntropy) * ENTROPY_SMOOTH;

    // Sigmoid gate: scale contribution by peer count
    const gate = sigmoid(peerCount, SIGMOID_CENTER, SIGMOID_GAIN);
    s.collectiveR = s.peerEntropy * gate * MAX_CONTRIBUTION;
  }, []);

  /**
   * Step the collective r system. Call once per RAF frame.
   * @param {object} fieldRef — ref to associative field state (fieldRef.current.r)
   * @returns {number} rDelta — amount to add to fieldRef.current.r
   */
  const stepCollectiveR = useCallback((fieldRef) => {
    const s = stateRef.current;
    let rDelta = 0;

    // ── Conductor contribution ───────────────────────────────────────────
    if (s.manualTarget !== null) {
      // Map 0..1 to r range
      const targetR = R_MIN + s.manualTarget * (R_MAX - R_MIN);
      const currentR = fieldRef?.current?.r ?? 2.8;
      // Push toward target — stronger when far, gentler when close
      const diff = targetR - currentR;
      s.manualR = diff * 0.04;  // 4% per frame toward target
    } else {
      // Spring-decay: manualR fades toward 0
      s.manualR *= MANUAL_DECAY;
      if (Math.abs(s.manualR) < 0.0001) s.manualR = 0;
    }
    rDelta += s.manualR;

    // ── Collective contribution ──────────────────────────────────────────
    rDelta += s.collectiveR;

    // ── Apply ────────────────────────────────────────────────────────────
    s.rDelta = rDelta;

    // Update conductor visual position from current r
    if (fieldRef?.current) {
      s.conductorY = Math.max(0, Math.min(1,
        (fieldRef.current.r - R_MIN) / (R_MAX - R_MIN)
      ));
    }

    // Clamp final r
    if (fieldRef?.current) {
      fieldRef.current.r = Math.max(R_MIN, Math.min(R_MAX,
        fieldRef.current.r + rDelta
      ));
    }

    return rDelta;
  }, []);

  return { stateRef, setConductor, feedPeerEntropy, stepCollectiveR };
}
