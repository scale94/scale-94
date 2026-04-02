// Verdict Store — IndexedDB-backed local archive
// Append-only. No deletion. No mutation. Immutability is structural.

import { hashVerdict } from './verdictModel';

const DB_NAME = 'scale94-ledger';
const DB_VERSION = 1;
const STORE_NAME = 'verdicts';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('coordinates', ['coordinates.lat', 'coordinates.lon'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeVerdict(verdict) {
  const hash = await hashVerdict(verdict);
  const record = { ...verdict, hash };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllVerdicts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('timestamp').getAll();
    req.onsuccess = () => resolve(req.result.reverse()); // newest first
    req.onerror = () => reject(req.error);
  });
}

export async function getVerdictByHash(hash) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(hash);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getVerdictCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
