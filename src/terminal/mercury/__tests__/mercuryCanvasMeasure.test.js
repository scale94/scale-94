import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mercury is the landing tab and mounts while the boot reveal scales the app up from scale(0.01). r3f measures its
// parent with getBoundingClientRect (post-transform) and only re-measures on ResizeObserver / window resize, neither of
// which a transform fires: the canvas locked to its first, scaled-down size (measured 10x5 px in a 950x534 container,
// 2026-11-22) and showed a black bar until a tab switch remounted it. offsetSize measures the layout box instead.
const src = readFileSync(resolve(__dirname, '../MercuryCanvas.jsx'), 'utf8');

describe('MercuryCanvas sizing', () => {
  it('measures its layout size, not the transformed rect (the boot reveal scales it)', () => {
    expect(src).toMatch(/<Canvas[^>]*\bresize=\{\{[^}]*\boffsetSize:\s*true/s);
  });
});
