// ── useInverseEngine ──────────────────────────────────────────────────────────
// Cache-first driver for the Inverse Extinction Engine.
//   fresh cache  → render immediately, ZERO network this visit
//   stale cache  → render it (STALE badge) and harvest in the background
//   no cache     → harvest; on failure the UI shows the idle state
// status: 'idle' | 'harvesting' | 'live' | 'stale' | 'error'

import { useState, useEffect, useCallback, useRef } from 'react';
import { readEngineCache, writeEngineCache, harvest } from '../lib/inverseEngine';
import { publishHealing } from '../lib/healingSignal';

export function useInverseEngine() {
  const [state, setState] = useState(() => readEngineCache());
  const [status, setStatus] = useState('idle');
  const inFlightRef = useRef(false);

  const runHarvest = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('harvesting');
    try {
      const result = await harvest();
      writeEngineCache(result);
      publishHealing(result);
      setState({ ...result, stale: false });
      setStatus('live');
    } catch {
      setStatus(readEngineCache() ? 'stale' : 'error');
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const cached = readEngineCache();
    if (cached && !cached.stale) {
      // re-announce so live subscribers (Ecocide) warm up without a harvest
      publishHealing(cached);
      setStatus('live');
      return;
    }
    if (cached) setStatus('stale');
    runHarvest();
  }, [runHarvest]);

  return { state, status, runHarvest };
}
