import { describe, it, expect } from 'vitest';
import { DIM_SEMANTIC } from '../dimSemantics';
import { DIM_NAMES } from '../nodeFeatures';

describe('dimSemantics', () => {
  it('covers exactly the 16 legacy dims with tag/converge/diverge', () => {
    const legacy = DIM_NAMES.slice(0, 16);
    expect(Object.keys(DIM_SEMANTIC).sort()).toEqual([...legacy].sort());
    for (const name of legacy) {
      expect(typeof DIM_SEMANTIC[name].tag).toBe('string');
      expect(typeof DIM_SEMANTIC[name].converge).toBe('string');
      expect(typeof DIM_SEMANTIC[name].diverge).toBe('string');
    }
  });
});
