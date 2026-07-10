import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emit, _resetForTests } from '../../../observatory/observatoryBus';
import { snapshotPeriphery } from '../periphery';

describe('snapshotPeriphery', () => {
  beforeEach(() => _resetForTests());

  it('an untouched session yields all-None houses', () => {
    const p = snapshotPeriphery();
    expect(p).toEqual({
      ciphers: null, transmissions: null, essences: null,
      lunarRead: null, houses: { ecocide: null, ledger: null, privacy: null, surveillance: null },
    });
  });

  it('witnessed events become Some(value)', () => {
    emit('ciphers', 'verify', {});
    emit('ciphers', 'unlock', {});
    emit('transmissions', 'kernel_completed', { kernelId: 'FSF-12.1.0' });
    emit('transmissions', 'ledger_appended', { depth: 3 });
    emit('essences', 'collision_fired', { polarity: 'RADIANT' });
    emit('essences', 'crystallized', {});
    emit('gaze', 'lunar_read', { phase: 'Waxing Gibbous', illum: 0.82 });
    emit('gaze', 'tab_navigated', { tab: 'privacy' });
    emit('gaze', 'tab_navigated', { tab: 'bsky' }); // not a tracked house

    const p = snapshotPeriphery();
    expect(p.ciphers).toEqual({ sealed: 0, verifies: 1, unlocks: 1 });
    expect(p.transmissions).toEqual({ count: 1, ledgerDepth: 3, lastKernel: 'FSF-12.1.0' });
    expect(p.essences).toEqual({ collisions: 1, crystallized: 1, polarity: 'RADIANT' });
    expect(p.lunarRead).toEqual({ phase: 'Waxing Gibbous', illum: 0.82 });
    expect(p.houses).toEqual({ ecocide: null, ledger: null, privacy: 1, surveillance: null });
  });

  it('ledger-only transmissions witness has lastKernel null', () => {
    emit('transmissions', 'ledger_appended', { depth: 1 });
    const p = snapshotPeriphery();
    expect(p.transmissions).toEqual({ count: 0, ledgerDepth: 1, lastKernel: null });
  });

  it('a throwing bus compiles as an unwitnessed session', async () => {
    const { snapshotPeriphery: snap } = await (async () => {
      vi.resetModules();
      vi.doMock('../../../observatory/observatoryBus', () => ({
        getTotals: () => { throw new Error('dead bus'); },
        getJournal: () => { throw new Error('dead bus'); },
      }));
      const mod = await import('../periphery');
      vi.doUnmock('../../../observatory/observatoryBus');
      return mod;
    })();
    expect(snap()).toEqual({
      ciphers: null, transmissions: null, essences: null,
      lunarRead: null, houses: { ecocide: null, ledger: null, privacy: null, surveillance: null },
    });
  });
});
