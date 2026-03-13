// useKineticEdges.js — Edge influence state for the fade_doctrine graph.
//
// Each edge carries:
//   strength    [0..1] — lerp weight for edge color (0=pure source, 1=pure target)
//   pulse       [0..1] — overwrite pulse intensity, decays over time
//   overwrite   bool   — true when source is actively dominating target
//   direction   +1|-1  — which end is the dominant node (+1 = a→b dominance)
//
// Strength drives the lerp:
//   Color_edge = lerp(Color_source, Color_target, strength)
//
// Default strength = 0.5 (balanced, no directionality).
// Attractor data shifts strength toward 0 (source bleeds in) or 1 (target absorbs).

import { useRef, useCallback, useEffect } from 'react';

// Thresholds for overwrite cascade detection
const OVERWRITE_DOMINANCE = 0.65;  // activation above which a node is "dominant"
const OVERWRITE_SUPPRESS  = 0.20;  // activation below which a node is "suppressed"

/**
 * useKineticEdges({ edges, nodes })
 *
 * edges — array of [aId, bId] tuples
 * nodes — array of node descriptors { id, cluster, ... }
 *
 * Returns:
 *   edgeStateRef  — { current: EdgeState[] }
 *   stepEdges     — () → void   — called each RAF frame to decay pulses
 *   applyAttractor— (data) → void — update strengths from Hopfield result
 */
export function useKineticEdges({ edges, nodes }) {
  const edgeStateRef = useRef(null);

  // Initialise edge state
  useEffect(() => {
    edgeStateRef.current = edges.map(([aId, bId]) => ({
      aId,
      bId,
      strength:  0.5,   // balanced lerp by default
      pulse:     0,
      overwrite: false,
      direction: 0,     // +1 = a dominates b, -1 = b dominates a, 0 = neutral
    }));
  }, [edges]);

  // Decay pulse values each frame
  const stepEdges = useCallback(() => {
    const es = edgeStateRef.current;
    if (!es) return;
    for (const e of es) {
      if (e.pulse > 0) {
        e.pulse = Math.max(0, e.pulse - 0.018);
        if (e.pulse <= 0) {
          e.overwrite = false;
          e.direction = 0;
          // Slowly recover toward balanced strength
        }
      }
      // Drift strength back toward 0.5 when no overwrite active
      if (!e.overwrite && Math.abs(e.strength - 0.5) > 0.01) {
        e.strength += (0.5 - e.strength) * 0.03;
      }
    }
  }, []);

  /**
   * applyAttractor(data, graphStateRef)
   *
   * data         — { act: f64[], energy, seed, co: int[] }
   * graphStateRef— stateRef from useSomaGraph (for triggerOverwrite)
   * triggerOverwrite — (sourceId, targetId) → void
   */
  const applyAttractor = useCallback((data, nodesArr, triggerOverwrite) => {
    const es = edgeStateRef.current;
    if (!es || !data?.act) return;

    for (const e of es) {
      const idxA = nodesArr.findIndex(n => n.id === e.aId);
      const idxB = nodesArr.findIndex(n => n.id === e.bId);
      if (idxA < 0 || idxB < 0) continue;

      const actA = data.act[idxA] ?? 0;
      const actB = data.act[idxB] ?? 0;

      // Determine dominance
      const aDominates = actA > OVERWRITE_DOMINANCE && actB < OVERWRITE_SUPPRESS;
      const bDominates = actB > OVERWRITE_DOMINANCE && actA < OVERWRITE_SUPPRESS;

      if (aDominates) {
        // A bleeds into B — strength → 0 (source color dominates edge)
        e.strength  = Math.max(0.05, e.strength - 0.15);
        e.pulse     = 1.0;
        e.overwrite = true;
        e.direction = +1;
        triggerOverwrite?.(e.aId, e.bId);
      } else if (bDominates) {
        // B bleeds into A — strength → 1
        e.strength  = Math.min(0.95, e.strength + 0.15);
        e.pulse     = 1.0;
        e.overwrite = true;
        e.direction = -1;
        triggerOverwrite?.(e.bId, e.aId);
      } else {
        // Proportional: both active → balanced; neither → neutral
        const t = (actA + actB) * 0.5;
        e.strength += ((0.5 + (actB - actA) * 0.3) - e.strength) * 0.08;
        if (t > 0.4) e.pulse = Math.min(1, e.pulse + t * 0.1);
      }
    }
  }, []);

  return { edgeStateRef, stepEdges, applyAttractor };
}
