// Boot reconcile (final review I1/I2): read the stored identity's fp straight from
// IndexedDB (no WASM), and only a store that opened and holds no record means "gone".
import { describe, it, expect, beforeEach } from 'vitest';
import { reconcileSpineAtBoot } from '../aetherRuntime.js';
import { getSpine, missingVertebrae, _resetSpineForTests } from '../../quintessence/spineStore';
import { sealScentForTests, FX_FP } from '../../quintessence/__tests__/scentFixture';

const ORPHAN = 'SEAL ORPHANED — the key evaporated';
const storeWith = (rec) => async () => ({ get: async () => rec, put: async () => {}, delete: async () => {} });

beforeEach(() => { _resetSpineForTests(); sealScentForTests(); });

describe('reconcileSpineAtBoot', () => {
  it('store opened, record matches → stays marked', async () => {
    await reconcileSpineAtBoot({ openStore: storeWith({ v: 1, fp: FX_FP }) });
    expect(getSpine().scent.orphaned).toBeFalsy();
  });

  it('store opened, no record → orphaned', async () => {
    await reconcileSpineAtBoot({ openStore: storeWith(null) });
    expect(missingVertebrae().at(-1)).toBe(ORPHAN);
  });

  it('store opened, a different identity → orphaned', async () => {
    await reconcileSpineAtBoot({ openStore: storeWith({ v: 1, fp: 'f'.repeat(32) }) });
    expect(getSpine().scent.orphaned).toBe(true);
  });

  it('store failed to open → skip, never orphan (the key may still be on disk)', async () => {
    await reconcileSpineAtBoot({ openStore: async () => null });
    expect(getSpine().scent.orphaned).toBeFalsy();
  });

  it('store read throws → skip, never orphan', async () => {
    await reconcileSpineAtBoot({ openStore: async () => ({ get: async () => { throw new Error('InvalidStateError'); } }) });
    expect(getSpine().scent.orphaned).toBeFalsy();
  });

  it('a later good boot heals a stale orphan flag', async () => {
    await reconcileSpineAtBoot({ openStore: storeWith(null) });
    await reconcileSpineAtBoot({ openStore: storeWith({ v: 1, fp: FX_FP }) });
    expect(getSpine().scent.orphaned).toBe(false);
  });
});
