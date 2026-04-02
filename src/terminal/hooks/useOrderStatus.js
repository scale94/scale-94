// useOrderStatus.js — SOMA-9.4
// Polls /api/transmute/status for fulfillment state of orders
// stored in localStorage (keyed by formulaHash). Stops polling
// once the order reaches SHIPPED.

import { useState, useEffect, useCallback } from 'react';

const POLL_MS = 20_000;
const LS_KEY  = 'ck_order_hashes'; // JSON array of formulaHash strings

export function useOrderStatus(activeHash) {
  // Resolve hash: use live session hash, or fall back to localStorage
  const resolvedHash = activeHash || getStoredHash(null);
  const [status, setStatus] = useState(() => {
    // Hydrate from localStorage cache if available
    if (!resolvedHash) return null;
    try {
      const cached = localStorage.getItem(`ck_order_status_${resolvedHash}`);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [trackedHash, setTrackedHash] = useState(resolvedHash);

  // Update tracked hash when it changes
  useEffect(() => {
    if (resolvedHash && resolvedHash !== trackedHash) {
      setTrackedHash(resolvedHash);
    }
  }, [resolvedHash, trackedHash]);

  const fetchStatus = useCallback(async (hash) => {
    if (!hash) return;
    try {
      const res = await fetch(`/api/transmute/status?hash=${encodeURIComponent(hash)}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
      // Persist to localStorage so returning visitors see their last status
      try {
        localStorage.setItem(`ck_order_status_${hash}`, JSON.stringify(data));
      } catch { /* storage blocked */ }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!trackedHash) { setStatus(null); return; }

    fetchStatus(trackedHash);

    // Stop polling once SHIPPED
    const id = setInterval(() => {
      setStatus(prev => {
        if (prev?.fulfillmentState === 'SHIPPED') {
          clearInterval(id);
          return prev;
        }
        fetchStatus(trackedHash);
        return prev;
      });
    }, POLL_MS);

    return () => clearInterval(id);
  }, [trackedHash, fetchStatus]);

  // Return null if no status data, so consumers' null-checks still work
  if (!status) return trackedHash ? { fulfillmentState: null, hash: trackedHash } : null;
  return { ...status, hash: trackedHash };
}

// Persist a formulaHash to localStorage after order dispatch
export function storeOrderHash(hash) {
  if (!hash) return;
  try {
    const hashes = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (!hashes.includes(hash)) {
      hashes.push(hash);
      localStorage.setItem(LS_KEY, JSON.stringify(hashes));
    }
  } catch { /* storage blocked */ }
}

// Retrieve the latest stored hash (for current session display)
export function getStoredHash(formulaHash) {
  if (formulaHash) return formulaHash;
  try {
    const hashes = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return hashes.length ? hashes[hashes.length - 1] : null;
  } catch { return null; }
}
