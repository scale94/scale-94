import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../prng';

describe('mulberry32', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = mulberry32(0x4867), b = mulberry32(0x4867);
    for (let i = 0; i < 1000; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
});
