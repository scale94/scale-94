// The IndexedDB adapter (final review I3): an open that never settles or is blocked
// resolves to null (volatile) instead of hanging; a connection closed under us
// (iOS backgrounding → InvalidStateError) is reopened once.
import { describe, it, expect } from 'vitest';
import { openIdentityStore } from '../identityStore.idb.js';

function fakeIdb({ hang = false, blocked = false, failFirstTx = 0 } = {}) {
  const data = new Map();
  let opens = 0, txFails = failFirstTx;
  const mkReq = (fn) => { const r = {}; queueMicrotask(() => { try { r.result = fn(); r.onsuccess?.(); } catch (e) { r.error = e; r.onerror?.(); } }); return r; };
  const db = {
    close() {},
    transaction() {
      if (txFails > 0) { txFails--; const e = new Error('closed'); e.name = 'InvalidStateError'; throw e; }
      return { objectStore: () => ({
        get: (k) => mkReq(() => data.get(k)),
        put: (v, k) => mkReq(() => { data.set(k, v); }),
        delete: (k) => mkReq(() => { data.delete(k); }),
      }) };
    },
  };
  return {
    get opens() { return opens; },
    open() {
      opens++;
      const r = {};
      if (hang) return r;
      queueMicrotask(() => {
        if (blocked) { r.onblocked?.(); return; }
        r.result = db; r.onsuccess?.();
      });
      return r;
    },
  };
}

describe('openIdentityStore', () => {
  it('round-trips a value', async () => {
    const s = await openIdentityStore(fakeIdb());
    await s.put('identity', { fp: 'x' });
    expect(await s.get('identity')).toEqual({ fp: 'x' });
  });

  it('an open that never settles resolves to null after the timeout', async () => {
    const t0 = Date.now();
    expect(await openIdentityStore(fakeIdb({ hang: true }), { timeoutMs: 50 })).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('a blocked open resolves to null', async () => {
    expect(await openIdentityStore(fakeIdb({ blocked: true }), { timeoutMs: 5000 })).toBeNull();
  });

  it('an InvalidStateError (connection closed under us) reopens once and succeeds', async () => {
    const idb = fakeIdb({ failFirstTx: 1 });
    const s = await openIdentityStore(idb);
    await expect(s.get('identity')).resolves.toBeNull();
    expect(idb.opens).toBe(2);
  });

  it('no indexedDB at all → null', async () => {
    expect(await openIdentityStore(undefined)).toBeNull();
  });
});
