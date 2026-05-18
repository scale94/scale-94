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
