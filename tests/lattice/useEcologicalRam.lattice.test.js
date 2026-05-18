import { describe, it, expect } from 'vitest';
import { SAFE_ALIAS_TO_KERNEL, SAFE_KERNELS } from '../../src/terminal/hooks/useEcologicalRam';

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
