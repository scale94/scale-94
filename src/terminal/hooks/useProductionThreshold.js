// useProductionThreshold.js — SOMA-9.4
// Fetches the persistent production threshold counter from Vercel KV
// via /api/transmute/threshold. Polls every 30s for live updates.
// Falls back to localStorage ('ck_count') if the API is unavailable.

import { useState, useEffect } from 'react';

const POLL_MS = 30_000;

export function useProductionThreshold() {
  const [threshold, setThreshold] = useState(() => {
    // Optimistic initial state from localStorage while API loads
    try {
      const local = parseInt(localStorage.getItem('ck_count') || '0', 10);
      return { current: local, target: 10, loaded: false };
    } catch {
      return { current: 0, target: 10, loaded: false };
    }
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchThreshold() {
      try {
        const res = await fetch('/api/transmute/threshold');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const serverCurrent = data.current ?? 0;
        const serverTarget  = data.target  ?? 10;
        // Reconcile: use whichever count is higher (local vs server)
        // to avoid resetting user progress when API is stale
        const localCount = (() => {
          try { return parseInt(localStorage.getItem('ck_count') || '0', 10); } catch { return 0; }
        })();
        const best = Math.max(serverCurrent, localCount);
        if (!cancelled) {
          setThreshold({ current: best, target: serverTarget, loaded: true });
          // Persist reconciled value back to localStorage
          try { localStorage.setItem('ck_count', String(best)); }
          catch { /* storage unavailable or full — the in-memory value still stands */ }
        }
      } catch {
        // API unavailable — promote localStorage fallback to loaded state
        if (!cancelled) setThreshold(prev => ({ ...prev, loaded: true }));
      }
    }

    fetchThreshold();
    const id = setInterval(fetchThreshold, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return threshold;
}
