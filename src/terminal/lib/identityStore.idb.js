// identityStore.idb.js — the IndexedDB backend for identityVault.js.
// Values go through structured clone, which is what lets a non-extractable
// CryptoKey persist without ever being exported. Resolves to null when IndexedDB
// is missing, refuses to open, is blocked, or does not answer within the timeout
// (a known WebKit failure mode); the vault treats null as a volatile identity.
// A connection the browser closes under us (iOS backgrounding → InvalidStateError)
// is reopened once per operation.

const DB_NAME = 'scale94_identity_v1';
const STORE = 'kv';
const OPEN_TIMEOUT_MS = 3000;

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

function openDb(idb, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (db) => { if (!done) { done = true; clearTimeout(timer); resolve(db); } };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      const open = idb.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onsuccess = () => {
        const db = open.result;
        if (done) { db.close?.(); return; }
        db.onversionchange = () => db.close();
        finish(db);
      };
      open.onerror = () => finish(null);
      open.onblocked = () => finish(null);
    } catch (_) {
      finish(null);
    }
  });
}

export async function openIdentityStore(idb = globalThis.indexedDB, { timeoutMs = OPEN_TIMEOUT_MS } = {}) {
  if (!idb) return null;
  let db = await openDb(idb, timeoutMs);
  if (!db) return null;

  async function run(mode, op) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await req(op(db.transaction(STORE, mode).objectStore(STORE)));
      } catch (e) {
        if (attempt > 0 || e?.name !== 'InvalidStateError') throw e;
        const again = await openDb(idb, timeoutMs);
        if (!again) throw e;
        db = again;
      }
    }
  }

  return {
    async get(key) { return (await run('readonly', (s) => s.get(key))) ?? null; },
    async put(key, value) { await run('readwrite', (s) => s.put(value, key)); },
    async delete(key) { await run('readwrite', (s) => s.delete(key)); },
  };
}
