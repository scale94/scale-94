// The pure core of the same-build null gate (scripts/artNull.mjs).
//
// The whole-instrument check is not here and cannot be: it needs three full
// capture sets, which are minutes of browser time and ~60 MB of PNGs. That was
// run against known answers instead — five post-fix sets reproduce all 21
// numbers in `.superpowers/sdd/post-step5-task1-report.md` §4 to four decimals,
// and the mid-investigation pair still scores 0.0624 on projector
// `immersive-off`. What is tested here is the arithmetic and the argument
// handling underneath that, which is where a silent wrong answer would hide.

import { describe, it, expect } from 'vitest';
import {
  correlate, detectionPower, worstPair, parseArgs, shotFile,
  MIN_SETS, NULL_FLOOR,
} from '../scripts/artNull.mjs';

const plane = (name, values, width = values.length, height = 1) =>
  ({ name, width, height, out: Float64Array.from(values) });

describe('correlate', () => {
  it('scores an identical plane 1', () => {
    const a = Float64Array.from([1, 5, 2, 9, 4]);
    expect(correlate(a, a)).toBeCloseTo(1, 12);
  });

  it('is invariant to brightness and gain, which is why it survives a bloom', () => {
    const a = Float64Array.from([1, 5, 2, 9, 4]);
    const b = Float64Array.from([...a].map((v) => v * 3 + 40));
    expect(correlate(a, b)).toBeCloseTo(1, 12);
  });

  it('scores an inverted plane -1', () => {
    const a = Float64Array.from([1, 5, 2, 9, 4]);
    const b = Float64Array.from([...a].map((v) => -v));
    expect(correlate(a, b)).toBeCloseTo(-1, 12);
  });

  it('scores a flat frame 0, not NaN — a blank capture is broken, not missing', () => {
    const flat = new Float64Array(16);
    const real = Float64Array.from({ length: 16 }, (_, i) => i);
    expect(correlate(flat, flat)).toBe(0);
    expect(correlate(flat, real)).toBe(0);
    expect(Number.isNaN(correlate(flat, real))).toBe(false);
  });

  it('separates the same world from an unrelated one by a wide margin', () => {
    // Sparse structured ink, as the sphere draws it: a few lit pixels in a
    // mostly dark frame. A one-pixel nudge is still ~1; a reshuffle is not.
    const n = 4096;
    const world = new Float64Array(n);
    for (let i = 0; i < n; i += 37) world[i] = 200;
    const nudged = new Float64Array(n);
    for (let i = 0; i < n; i += 37) nudged[i] = 198;
    const other = new Float64Array(n);
    for (let i = 5; i < n; i += 41) other[i] = 200;
    expect(correlate(world, nudged)).toBeGreaterThan(0.999);
    expect(correlate(world, other)).toBeLessThan(0.2);
  });
});

describe('detectionPower', () => {
  // This arithmetic is the justification for MIN_SETS being 3 rather than 2,
  // and it is quoted in the header of artNull.mjs and in the task report. If it
  // ever changes, those change with it.
  it('rates a single pair a coin flip against a 1-in-3 intermittent fault', () => {
    expect(detectionPower(2)).toBeCloseTo(0.4444, 4);
  });

  it('rates three sets 0.67 and five sets 0.86', () => {
    expect(detectionPower(3)).toBeCloseTo(0.6667, 4);
    expect(detectionPower(5)).toBeCloseTo(0.8642, 4);
  });

  it('rises with every added set', () => {
    const p = [2, 3, 4, 5, 6, 7].map((n) => detectionPower(n));
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThan(p[i - 1]);
  });

  it('never certifies a lone capture', () => {
    expect(detectionPower(1)).toBe(0);
  });
});

describe('worstPair', () => {
  it('returns the lowest correlation in the group, not the first or the mean', () => {
    const base = [0, 1, 2, 3, 4, 5, 6, 7];
    const { worst, where } = worstPair([
      plane('a', base),
      plane('b', base.map((v) => v + 0.001)),
      plane('c', [7, 1, 5, 3, 0, 6, 2, 4]),          // the odd one out
      plane('d', base.map((v) => v * 2)),
    ]);
    expect(worst).toBeLessThan(0.5);
    expect(where).toContain('c');
  });

  it('scores a group that agrees at ~1', () => {
    const base = [3, 1, 4, 1, 5, 9, 2, 6];
    const { worst } = worstPair([
      plane('a', base),
      plane('b', base.map((v) => v + 0.01)),
      plane('c', base.map((v) => v - 0.01)),
    ]);
    expect(worst).toBeGreaterThan(0.999);
  });

  it('reports a size mismatch instead of correlating it', () => {
    // Two buffer sizes are not a picture difference. Scoring them as one is how
    // an immersive resize landing on the wrong side of the settle would get
    // laundered into a plausible-looking correlation.
    const r = worstPair([
      plane('a', [1, 2, 3, 4], 2, 2),
      plane('b', [1, 2, 3, 4, 5, 6], 3, 2),
    ]);
    expect(r.size).toBe('2x2 vs 3x2');
    expect(r.worst).toBeNull();
  });
});

describe('parseArgs', () => {
  it('defaults to the documented floor and minimum', () => {
    const a = parseArgs(['x', 'y']);
    expect(a.floor).toBe(NULL_FLOOR);
    expect(a.minSets).toBe(MIN_SETS);
    expect(a.write).toBeNull();
    expect(a.dirs).toEqual(['x', 'y']);
  });

  it('does not mistake a flag value for a capture directory', () => {
    const a = parseArgs(['baseline/a', 'baseline/b', '--floor', '0.99', '--min-sets', '4']);
    expect(a.dirs).toEqual(['baseline/a', 'baseline/b']);
    expect(a.floor).toBe(0.99);
    expect(a.minSets).toBe(4);
  });

  it('keeps --write out of the compared set even though it names one of them', () => {
    const a = parseArgs(['baseline/a', 'baseline/b', 'baseline/c', '--write', 'baseline/a']);
    expect(a.dirs).toEqual(['baseline/a', 'baseline/b', 'baseline/c']);
    expect(a.write).toBe('baseline/a');
  });
});

describe('shotFile', () => {
  it('resolves against the directory being read, not the recorded path', () => {
    // A baseline stays readable after it is moved or renamed. Trusting the
    // manifest path would break every reference set the moment it is copied.
    const shot = { file: 'baseline/somewhere-else/laptop-1520x900@1x__idle.png' };
    expect(shotFile('baseline/here', 'laptop-1520x900@1x', 'idle', shot))
      .toBe('baseline/here/laptop-1520x900@1x__idle.png');
  });

  it('falls back to the naming convention when a shot records no path', () => {
    expect(shotFile('baseline/here', 'projector-1920x1080@1x', 'immersive-off', undefined))
      .toBe('baseline/here/projector-1920x1080@1x__immersive-off.png');
  });
});
