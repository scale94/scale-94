// src/terminal/components/useCompileFrontier.js
// ── useCompileFrontier ───────────────────────────────────────────────────────
// Bridges the observatory bus to the Mercury terminator. Recomputes the frontier
// from live totals on every kernel load/run, and exposes a one-shot `flare` (the
// sunrise sweep) tagged load(cyan) vs run(gold). All bus wiring lives here so the
// shader component stays a pure renderer.
import { useEffect, useState } from 'react';
import { subscribe, getTotals } from '../../observatory/observatoryBus';
import { frontierFromTotals } from './frontier';

export function useCompileFrontier(N) {
  const [frontier, setFrontier] = useState(() => frontierFromTotals(getTotals(), N));
  const [flare, setFlare] = useState(null);

  useEffect(() => {
    // Re-read on mount / N change in case events fired before subscribe.
    setFrontier(frontierFromTotals(getTotals(), N));
    return subscribe((evt) => {
      if (evt.category !== 'transmissions') return;
      if (evt.kind === 'kernel_loaded' || evt.kind === 'kernel_completed') {
        setFrontier(frontierFromTotals(getTotals(), N));
        setFlare({ kind: evt.kind === 'kernel_completed' ? 'run' : 'load', ts: evt.ts });
      }
    });
  }, [N]);

  return { ...frontier, flare };
}
