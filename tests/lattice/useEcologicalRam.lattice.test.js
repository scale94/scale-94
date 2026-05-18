import { describe, it, expect, beforeEach } from 'vitest';
import { SAFE_ALIAS_TO_KERNEL, SAFE_KERNELS, readLatticeState, writeLatticeState, LATTICE_STORAGE_KEY, defaultLatticeState } from '../../src/terminal/hooks/useEcologicalRam';

describe('SAFE_ALIAS_TO_KERNEL', () => {
  it('exposes exactly three canonical safe kernels', () => {
    expect(SAFE_KERNELS).toEqual(['daly', 'biodiversity', 'replicator']);
  });

  it('maps every daly alias to "daly"', () => {
    ['daly', 'ecological', 'entropy_econ', 'daly_rules', 'daly_thermo'].forEach(a => {
      expect(SAFE_ALIAS_TO_KERNEL[a]).toBe('daly');
    });
  });

  it('maps every biodiversity alias to "biodiversity"', () => {
    ['biodiversity', 'biocoenosis', 'species', 'shannon_ecology', 'ecology'].forEach(a => {
      expect(SAFE_ALIAS_TO_KERNEL[a]).toBe('biodiversity');
    });
  });

  it('maps every replicator alias to "replicator"', () => {
    ['replicator', 'ostrom_game', 'commons', 'evolutionary', 'cooperate', 'altruist', 'gametheory'].forEach(a => {
      expect(SAFE_ALIAS_TO_KERNEL[a]).toBe('replicator');
    });
  });

  it('does not include non-safe aliases', () => {
    ['leviathan', 'fusion', 'tesseract', 'soma_plus', 'gaia_scale', 'kuramoto'].forEach(a => {
      expect(SAFE_ALIAS_TO_KERNEL[a]).toBeUndefined();
    });
  });
});

describe('lattice state persistence', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns defaults when localStorage is empty', () => {
    const s = readLatticeState();
    expect(s).toEqual(defaultLatticeState());
    expect(s.attemptCount).toBe(0);
    expect(s.foundSafes).toEqual([]);
    expect(s.unlocked).toBe(false);
    expect(s.failed).toBe(false);
    expect(s.lastRefillAt).toBe(0);
    expect(s.hintSeen).toBe(false);
  });

  it('round-trips state through localStorage', () => {
    const s = { attemptCount: 2, foundSafes: ['daly', 'biodiversity'], unlocked: false, failed: false, lastRefillAt: 0, hintSeen: true };
    writeLatticeState(s);
    expect(readLatticeState()).toEqual(s);
  });

  it('uses the correct storage key', () => {
    expect(LATTICE_STORAGE_KEY).toBe('scale94_lattice_protocol');
    writeLatticeState(defaultLatticeState());
    expect(localStorage.getItem(LATTICE_STORAGE_KEY)).not.toBeNull();
  });

  it('returns defaults if stored JSON is malformed', () => {
    localStorage.setItem(LATTICE_STORAGE_KEY, '{not json');
    expect(readLatticeState()).toEqual(defaultLatticeState());
  });

  it('returns defaults if localStorage throws (private-mode fallback)', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    expect(readLatticeState()).toEqual(defaultLatticeState());
    Storage.prototype.getItem = orig;
  });
});

import { renderHook, act } from '@testing-library/react';
import { useEcologicalRam } from '../../src/terminal/hooks/useEcologicalRam';

function setup() {
  const logs = [];
  const appendSystemLog = (entry) => { logs.push(entry); };
  const view = renderHook(() => useEcologicalRam({ appendSystemLog }));
  return { ...view, logs };
}

describe('useEcologicalRam — lattice game branching', () => {
  beforeEach(() => { localStorage.clear(); });

  it('safe alias adds to foundSafes, increments attemptCount, applies normal recharge', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('daly'); });
    expect(result.current.latticeState.foundSafes).toEqual(['daly']);
    expect(result.current.latticeState.attemptCount).toBe(1);
    expect(result.current.latticeState.unlocked).toBe(false);
    expect(result.current.ramPct).toBe(70 + 22); // RAM_START + daly delta, capped at 100
    const hint = logs.find(l => l.msg.includes('[LATTICE:HONORED]'));
    expect(hint).toBeDefined();
    expect(hint.msg).toContain('1 of 3');
    expect(hint.msg).toContain('2 attempts remaining');
  });

  it('safe alias resolves canonical name from alias (e.g. ecological → daly)', () => {
    const { result } = setup();
    act(() => { result.current.applyRamDelta('ecological'); });
    expect(result.current.latticeState.foundSafes).toEqual(['daly']);
  });

  it('duplicate safe alias burns attempt but does not re-add to foundSafes', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('daly'); });
    act(() => { result.current.applyRamDelta('daly'); });
    expect(result.current.latticeState.foundSafes).toEqual(['daly']);
    expect(result.current.latticeState.attemptCount).toBe(2);
    const dup = logs.find(l => l.msg.includes('already registered'));
    expect(dup).toBeDefined();
  });

  it('non-safe alias wipes RAM to 0 (bypassing 5% floor)', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('leviathan'); });
    expect(result.current.ramPct).toBe(0);
    expect(result.current.latticeState.attemptCount).toBe(1);
    expect(result.current.latticeState.foundSafes).toEqual([]);
    const wipe = logs.find(l => l.msg.includes('[LATTICE:ZEROED]'));
    expect(wipe).toBeDefined();
    expect(wipe.msg).toContain('2 attempts remaining');
  });

  it('finding 3rd safe within 3 attempts unlocks re$$ill', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('daly'); });
    act(() => { result.current.applyRamDelta('biodiversity'); });
    act(() => { result.current.applyRamDelta('replicator'); });
    expect(result.current.latticeState.unlocked).toBe(true);
    expect(result.current.latticeState.failed).toBe(false);
    const unlock = logs.find(l => l.msg.includes('[RE$$ILL:UNLOCKED]'));
    expect(unlock).toBeDefined();
  });

  it('3 attempts with fewer than 3 safes triggers failed', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('leviathan'); });
    act(() => { result.current.applyRamDelta('daly'); });
    act(() => { result.current.applyRamDelta('fusion'); });
    expect(result.current.latticeState.failed).toBe(true);
    expect(result.current.latticeState.unlocked).toBe(false);
    const seal = logs.find(l => l.msg.includes('[LATTICE:SILENT]'));
    expect(seal).toBeDefined();
  });

  it('state persists to localStorage after each delta', () => {
    const { result } = setup();
    act(() => { result.current.applyRamDelta('daly'); });
    const stored = JSON.parse(localStorage.getItem('scale94_lattice_protocol'));
    expect(stored.foundSafes).toEqual(['daly']);
    expect(stored.attemptCount).toBe(1);
  });

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 2, foundSafes: ['daly', 'biodiversity'], unlocked: false,
      failed: false, lastRefillAt: 0, hintSeen: true,
    }));
    const { result } = setup();
    expect(result.current.latticeState.attemptCount).toBe(2);
    expect(result.current.latticeState.foundSafes).toEqual(['daly', 'biodiversity']);
  });

  it('once unlocked, non-safe runs apply normal delta with 5% floor (game suppressed)', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly','biodiversity','replicator'], unlocked: true, failed: false, lastRefillAt: 0, hintSeen: true,
    }));
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('leviathan'); });
    expect(result.current.ramPct).toBeGreaterThanOrEqual(5); // floor restored
    expect(result.current.ramPct).toBeLessThan(70);          // delta applied
    expect(logs.find(l => l.msg.includes('[LATTICE:ZEROED]'))).toBeUndefined();
  });

  it('once failed, non-safe runs apply normal delta with 5% floor', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly'], unlocked: false, failed: true, lastRefillAt: 0, hintSeen: true,
    }));
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('leviathan'); });
    expect(result.current.ramPct).toBeGreaterThanOrEqual(5);
    expect(logs.find(l => l.msg.includes('[LATTICE:ZEROED]'))).toBeUndefined();
  });
});

describe('useEcologicalRam — boot hint', () => {
  beforeEach(() => { localStorage.clear(); });

  it('emits the LATTICE_PROTOCOL hint once on first mount', () => {
    const { logs } = setup();
    const hint = logs.find(l => l.msg.includes('[LATTICE_PROTOCOL]'));
    expect(hint).toBeDefined();
    expect(hint.msg).toContain('3 kernels honor the commons');
    expect(hint.msg).toContain("'re$$ill'");
  });

  it('persists hintSeen so the hint does not repeat on next mount', () => {
    setup(); // first mount
    const { logs } = setup(); // second mount — fresh hook, same localStorage
    const hint = logs.find(l => l.msg.includes('[LATTICE_PROTOCOL]'));
    expect(hint).toBeUndefined();
  });

  it('suppresses the hint when already unlocked', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly','biodiversity','replicator'], unlocked: true,
      failed: false, lastRefillAt: 0, hintSeen: false,
    }));
    const { logs } = setup();
    expect(logs.find(l => l.msg.includes('[LATTICE_PROTOCOL]'))).toBeUndefined();
  });

  it('suppresses the hint when already failed', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly'], unlocked: false, failed: true,
      lastRefillAt: 0, hintSeen: false,
    }));
    const { logs } = setup();
    expect(logs.find(l => l.msg.includes('[LATTICE_PROTOCOL]'))).toBeUndefined();
  });
});

describe('useEcologicalRam — applyRefill', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns { ok: false, reason: "locked" } when not unlocked', () => {
    const { result } = setup();
    let outcome;
    act(() => { outcome = result.current.applyRefill(); });
    expect(outcome).toEqual({ ok: false, reason: 'locked' });
    expect(result.current.ramPct).toBe(70);
  });

  it('refills to 100 when unlocked and cooldown elapsed', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly','biodiversity','replicator'], unlocked: true,
      failed: false, lastRefillAt: 0, hintSeen: true,
    }));
    const { result } = setup();
    // Drain a bit first
    act(() => { result.current.applyRamDelta(-20); });
    expect(result.current.ramPct).toBe(50);
    let outcome;
    act(() => { outcome = result.current.applyRefill(); });
    expect(outcome.ok).toBe(true);
    expect(result.current.ramPct).toBe(100);
    expect(result.current.latticeState.lastRefillAt).toBeGreaterThan(0);
  });

  it('returns { ok: false, reason: "cooldown", remainingMs } if within 60s', () => {
    const recent = Date.now() - 10_000; // 10s ago
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly','biodiversity','replicator'], unlocked: true,
      failed: false, lastRefillAt: recent, hintSeen: true,
    }));
    const { result } = setup();
    let outcome;
    act(() => { outcome = result.current.applyRefill(); });
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBe('cooldown');
    expect(outcome.remainingMs).toBeGreaterThan(45_000);
    expect(outcome.remainingMs).toBeLessThanOrEqual(50_000);
  });
});
