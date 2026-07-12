import { describe, it, expect, beforeEach } from 'vitest';
import { loadSealedArtifact, clearSealedArtifact, STORAGE_KEY } from '../sealedArtifact';
import { holdVolatile, _resetVolatileForTests } from '../volatileHold';

describe('sealedArtifact', () => {
  beforeEach(() => {
    _resetVolatileForTests();
    localStorage.removeItem(STORAGE_KEY);
  });

  it('exports the canonical storage key', () => {
    expect(STORAGE_KEY).toBe('quintessence_kernel_v1');
  });

  it('prefers the volatile hold over the persisted seal', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: 'persisted' }));
    holdVolatile({ hash: 'volatile' });
    expect(loadSealedArtifact().hash).toBe('volatile');
  });

  it('reads the persisted seal when nothing is held', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: 'persisted' }));
    expect(loadSealedArtifact().hash).toBe('persisted');
  });

  it('clearSealedArtifact breaks the seal: hold and storage both gone', () => {
    holdVolatile({ hash: 'volatile' });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: 'persisted' }));
    clearSealedArtifact();
    expect(loadSealedArtifact()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
