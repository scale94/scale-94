// useTemporalArchaeology.js — IndexedDB persistence of sphere simulation state
// Stores anonymous session snapshots; on return visits, the sphere inherits
// ghost positions and bifurcation memory from the previous session.
// No user identity constructed — session UUID is random. Data is purely
// simulation state (node positions, r value, phase regime).

import { useRef, useEffect, useCallback } from 'react';

const DB_NAME    = 'soma-archaeology';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;
const MAX_SESSIONS = 16;
const SAVE_INTERVAL = 30_000;  // 30 seconds

// ── IndexedDB helpers (raw API, no library) ─────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'uuid' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function loadLatestSession() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const idx   = store.index('timestamp');
      const req   = idx.openCursor(null, 'prev');  // most recent first
      req.onsuccess = () => {
        const cursor = req.result;
        resolve(cursor ? cursor.value : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function saveSession(record) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    // Garbage collect old sessions
    await gcSessions(db);
  } catch { /* IndexedDB failures must never crash the art */ }
}

async function gcSessions(db) {
  try {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const idx   = store.index('timestamp');
    const req   = idx.openCursor(null, 'prev');
    let count = 0;
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      count++;
      if (count > MAX_SESSIONS) {
        cursor.delete();
      }
      cursor.continue();
    };
  } catch { /* ignore gc failures */ }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useTemporalArchaeology({ stateRef, fieldRef, entropyRef }) {
  const archaeologyRef = useRef({
    ghostPositions: null,       // Float32Array(31*3) from previous session
    ghostR: null,               // previous session's final r value
    ghostPhase: null,           // previous session's final phase
    bifurcatedNodes: new Set(), // nodes that bifurcated in previous sessions
    loaded: false,
    sessionUUID: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
    startTime: Date.now(),
  });

  // Serialize current state into a session record
  const buildRecord = useCallback(() => {
    const arch = archaeologyRef.current;
    const s = stateRef?.current;
    const f = fieldRef?.current;

    // Serialize node positions
    const nodeCount = s?.nodes?.length ?? 0;
    const positions = new Float32Array(Math.max(nodeCount, 31) * 3);
    if (s?.nodes) {
      for (let i = 0; i < s.nodes.length; i++) {
        positions[i * 3]     = s.nodes[i].x;
        positions[i * 3 + 1] = s.nodes[i].y;
        positions[i * 3 + 2] = s.nodes[i].z;
      }
    }

    // Collect bifurcated node IDs from history
    const bifurcNodes = [];
    if (f?.bifurcationHistory) {
      for (const entry of f.bifurcationHistory) {
        if (entry.nodeId) bifurcNodes.push(entry.nodeId);
      }
    }

    return {
      uuid: arch.sessionUUID,
      timestamp: Date.now(),
      duration: Date.now() - arch.startTime,
      finalR: f?.r ?? 2.8,
      finalPhase: f?.phase ?? 'STABLE',
      nodePositions: Array.from(positions),  // IDB can't store Float32Array directly in all browsers
      bifurcatedNodes: bifurcNodes,
      entropyFingerprint: entropyRef?.current?.[5] ?? 0,
    };
  }, [stateRef, fieldRef, entropyRef]);

  // Load previous session on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prev = await loadLatestSession();
      if (cancelled) return;
      if (prev) {
        const arch = archaeologyRef.current;
        // Restore ghost positions
        if (prev.nodePositions && prev.nodePositions.length >= 93) {
          arch.ghostPositions = new Float32Array(prev.nodePositions);
        }
        arch.ghostR = prev.finalR ?? null;
        arch.ghostPhase = prev.finalPhase ?? null;
        // Build bifurcated nodes set from all previous sessions' data
        if (prev.bifurcatedNodes) {
          for (const nid of prev.bifurcatedNodes) {
            arch.bifurcatedNodes.add(nid);
          }
        }
        arch.loaded = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Periodic save + beforeunload
  useEffect(() => {
    const doSave = () => {
      const record = buildRecord();
      saveSession(record);
    };

    const interval = setInterval(doSave, SAVE_INTERVAL);
    window.addEventListener('beforeunload', doSave);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', doSave);
      doSave();  // final save on unmount
    };
  }, [buildRecord]);

  return { archaeologyRef };
}
