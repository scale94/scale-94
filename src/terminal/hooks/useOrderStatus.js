// useOrderStatus.js — SOMA-9.4
// Polls /api/transmute/status for fulfillment state of orders
// stored in localStorage (keyed by formulaHash). Stops polling
// once the order reaches SHIPPED.

import { useState, useEffect, useCallback } from 'react';

const POLL_MS = 20_000;
const LS_KEY  = 'ck_order_hashes'; // JSON array of formulaHash strings

export function useOrderStatus(activeHash) {
  const [status, setStatus] = useState(null); // { fulfillmentState, orderId, createdAt }

  const fetchStatus = useCallback(async (hash) => {
    if (!hash) return;
    try {
      const res = await fetch(`/api/transmute/status?hash=${encodeURIComponent(hash)}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!activeHash) { setStatus(null); return; }

    fetchStatus(activeHash);

    // Stop polling once SHIPPED
    const id = setInterval(() => {
      setStatus(prev => {
        if (prev?.fulfillmentState === 'SHIPPED') {
          clearInterval(id);
          return prev;
        }
        fetchStatus(activeHash);
        return prev;
      });
    }, POLL_MS);

    return () => clearInterval(id);
  }, [activeHash, fetchStatus]);

  return status;
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
