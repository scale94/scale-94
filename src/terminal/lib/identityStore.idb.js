// identityStore.idb.js — the IndexedDB backend for identityVault.js.
// Values go through structured clone, which is what lets a non-extractable
// CryptoKey persist without ever being exported. Resolves to null when IndexedDB
// is missing or refuses to open (private mode, blocked site data); the vault
// treats null as a volatile identity.

const DB_NAME = 'scale94_identity_v1';
const STORE = 'kv';

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

export async function openIdentityStore(idb = globalThis.indexedDB) {
  if (!idb) return null;
  let db;
  try {
    const open = idb.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    db = await req(open);
  } catch (_) {
    return null;
  }
  const tx = (mode) => db.transaction(STORE, mode).objectStore(STORE);
  return {
    async get(key) { return (await req(tx('readonly').get(key))) ?? null; },
    async put(key, value) { await req(tx('readwrite').put(value, key)); },
    async delete(key) { await req(tx('readwrite').delete(key)); },
  };
}
