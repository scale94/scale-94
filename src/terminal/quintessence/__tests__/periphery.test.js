import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emit, _resetForTests } from '../../../observatory/observatoryBus';
import { snapshotPeriphery } from '../periphery';
import kernelBuilds from '../../data/kernelBuilds';

describe('snapshotPeriphery', () => {
  beforeEach(() => _resetForTests());

  it('an untouched session yields all-None houses', () => {
    const p = snapshotPeriphery();
    expect(p).toEqual({
      ciphers: null, transmissions: null, essences: null,
      lunarRead: null, houses: { ecocide: null, ledger: null, privacy: null, surveillance: null },
      art: null, ecocideSim: null, ledgerVerdict: null, manifestoFragment: null,
      corpus: null,
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
    expect(p.transmissions).toEqual({ count: 1, ledgerDepth: 3, lastKernel: 'FSF-12.1.0', lastSignal: null });
    expect(p.essences).toEqual({ collisions: 1, crystallized: 1, polarity: 'RADIANT', lastAccord: null });
    expect(p.lunarRead).toEqual({ phase: 'Waxing Gibbous', illum: 0.82 });
    expect(p.houses).toEqual({ ecocide: null, ledger: null, privacy: 1, surveillance: null });
  });

  it('ledger-only transmissions witness has lastKernel null', () => {
    emit('transmissions', 'ledger_appended', { depth: 1 });
    const p = snapshotPeriphery();
    expect(p.transmissions).toEqual({ count: 0, ledgerDepth: 1, lastKernel: null, lastSignal: null });
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
      art: null, ecocideSim: null, ledgerVerdict: null, manifestoFragment: null,
      corpus: null,
    });
  });

  it('deep periphery: art witnesses interactions, falls back to visits, else null', () => {
    expect(snapshotPeriphery().art).toBeNull();
    emit('gaze', 'tab_navigated', { tab: 'art' });
    expect(snapshotPeriphery().art).toEqual({ visits: 1 });
    emit('gaze', 'art_resonance', { sim: 0.83 });
    emit('gaze', 'art_bifurcation', { count: 14 });
    emit('gaze', 'art_chimera', {});
    expect(snapshotPeriphery().art).toEqual({
      resonances: 1, lastSim: 0.83, bifurcations: 14, chimeras: 1,
      lastR: null, lyapunov: null, regime: null, selectedNode: null, resonancePair: null,
    });
  });

  it('witnesses the sphere cascade: art_regime → lastR / lyapunov / regime', () => {
    emit('gaze', 'art_regime', { r: 3.72, lyapunov: 0.021, regime: 'CHAOS' });
    const p = snapshotPeriphery();
    expect(p.art.lastR).toBe(3.72);
    expect(p.art.lyapunov).toBe(0.021);
    expect(p.art.regime).toBe('CHAOS');
    // a later transition overwrites — the seal reads the LAST witnessed state
    emit('gaze', 'art_regime', { r: 2.91, lyapunov: -0.4, regime: 'STABLE' });
    expect(snapshotPeriphery().art.regime).toBe('STABLE');
  });

  it('deep periphery: ecocideSim and ledgerVerdict witness the signals', () => {
    let p = snapshotPeriphery();
    expect(p.ecocideSim).toBeNull();
    expect(p.ledgerVerdict).toBeNull();
    emit('gaze', 'ecocide_phase', { phase: 'COLLAPSE', metabolicRift: 0.72, exergyRate: 0.1 });
    emit('transmissions', 'verdict_issued', { verdict: 'REJECTED' });
    p = snapshotPeriphery();
    expect(p.ecocideSim).toEqual({ phase: 'COLLAPSE', rift: 0.72, growthRate: null, mandateActive: null });
    expect(p.ledgerVerdict).toBe('REJECTED');
  });

  it('deep periphery: malformed rift compiles as null, phase still witnessed', () => {
    emit('gaze', 'ecocide_phase', { phase: 'OVERSHOOT', metabolicRift: 'not-a-number' });
    expect(snapshotPeriphery().ecocideSim).toEqual({ phase: 'OVERSHOOT', rift: null, growthRate: null, mandateActive: null });
  });
});

describe('corpus (THE LINKER, spec 2026-07-17)', () => {
  beforeEach(() => _resetForTests());

  it('kernel_loaded consults a corpus build', () => {
    emit('transmissions', 'kernel_loaded', { kernelId: 'BOSONIC-KERNEL-3.0.0' });
    const p = snapshotPeriphery();
    expect(p.corpus).toEqual({ linked: [], consulted: ['BOSONIC-KERNEL-3.0.0'], total: kernelBuilds.length });
  });

  it('kernel_consulted resolves via articleId', () => {
    emit('gaze', 'kernel_consulted', { articleId: 'SOMA-KERNEL-5.5.0' });
    expect(snapshotPeriphery().corpus.consulted).toEqual(['SOMA-KERNEL-5.5.0']);
  });

  it('consult + completed alias → linked (linked wins ties)', () => {
    emit('transmissions', 'kernel_loaded', { kernelId: 'BOSONIC-KERNEL-3.0.0' });
    emit('transmissions', 'kernel_completed', { kernelId: 'bosonic' });
    const c = snapshotPeriphery().corpus;
    expect(c.linked).toEqual(['BOSONIC-KERNEL-3.0.0']);
    expect(c.consulted).toEqual([]);
  });

  it('a run without a consult does not conjure the corpus', () => {
    emit('transmissions', 'kernel_completed', { kernelId: 'bosonic' });
    expect(snapshotPeriphery().corpus).toBeNull();
  });

  it('non-corpus ids are ignored', () => {
    emit('transmissions', 'kernel_loaded', { kernelId: 'kuramoto' });
    emit('gaze', 'kernel_consulted', { articleId: 'not-a-kernel-article' });
    expect(snapshotPeriphery().corpus).toBeNull();
  });

  it('ordering follows kernelBuilds order', () => {
    emit('transmissions', 'kernel_loaded', { kernelId: 'SOMA-KERNEL-5.5.0' });
    emit('transmissions', 'kernel_loaded', { kernelId: 'BOSONIC-KERNEL-3.0.0' });
    expect(snapshotPeriphery().corpus.consulted).toEqual(['BOSONIC-KERNEL-3.0.0', 'SOMA-KERNEL-5.5.0']);
  });
});
