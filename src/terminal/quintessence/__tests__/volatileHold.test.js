// src/terminal/quintessence/__tests__/volatileHold.test.js — the in-memory
// fallback channel (spec §7): held until reset, exactly one vial at a time.
import { describe, it, expect, afterEach } from 'vitest';
import { holdVolatile, heldVolatile, _resetVolatileForTests } from '../volatileHold';

afterEach(() => _resetVolatileForTests());

describe('volatileHold — the unsealed vial', () => {
  it('starts empty and returns what was held', () => {
    expect(heldVolatile()).toBeNull();
    const artifact = { source: 'x', hash: 'h', meta: { volatile: true } };
    holdVolatile(artifact);
    expect(heldVolatile()).toBe(artifact);
  });

  it('reset evaporates the hold', () => {
    holdVolatile({ source: 'y' });
    _resetVolatileForTests();
    expect(heldVolatile()).toBeNull();
  });
});
