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
        const { current, target } = await res.json();
        if (!cancelled) setThreshold({ current, target, loaded: true });
      } catch {
        // API unavailable — keep current value (localStorage fallback stays)
      }
    }

    fetchThreshold();
    const id = setInterval(fetchThreshold, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return threshold;
}
