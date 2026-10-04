import { describe, it, expect } from 'vitest';
import { createScarMap, stampQuench, stampGlaze, quenchProfile, crossMarks, texelDir } from '../scarMap';

const D = [0, 0, 1];
const angTo = (m, i) => { const d = texelDir(m, i % m.w, Math.floor(i / m.w)); return Math.acos(Math.min(1, d[0] * D[0] + d[1] * D[1] + d[2] * D[2])); };

describe('scar map — amendment A', () => {
  it('quenchProfile: a full core, a half-height evaporite plateau, nothing beyond 1.1 (+ jitter)', () => {
    expect(quenchProfile(0, 0)).toBe(1);
    expect(quenchProfile(0.5, 0.9)).toBe(1);
    expect(quenchProfile(0.8, 0)).toBeCloseTo(0.5, 12);
    expect(quenchProfile(0.94, 0)).toBeCloseTo(0.5, 12);
    expect(quenchProfile(1.1, 0)).toBeCloseTo(0, 12);
    expect(quenchProfile(1.15, 0.5)).toBeCloseTo(0, 12);
    expect(quenchProfile(1.05, 1)).toBeCloseTo(0.5, 12);
  });
  it('stampQuench writes only B, with the profile (core 255, ring ~128), and sets marksLive', () => {
    const m = createScarMap(512, 256);
    const before = Array.from(m.bytes);
    const r = 0.2;
    expect(stampQuench(m, D, r, 7)).toBeGreaterThan(0);
    expect(m.marksLive).toBe(true);
    let core = 0, ring = 0;
    for (let i = 0; i < m.w * m.h; i++) {
      expect(m.bytes[4 * i]).toBe(before[4 * i]);
      expect(m.bytes[4 * i + 1]).toBe(before[4 * i + 1]);
      expect(m.bytes[4 * i + 3]).toBe(before[4 * i + 3]);
      const s = angTo(m, i) / r, b = m.bytes[4 * i + 2];
      if (s < 0.5) { expect(b).toBe(255); core++; }
      if (s > 0.72 && s < 0.93) { expect(b).toBeGreaterThanOrEqual(126); expect(b).toBeLessThanOrEqual(129); ring++; }
      if (s > 1.25) expect(b).toBe(0);
    }
    expect(core).toBeGreaterThan(10);
    expect(ring).toBeGreaterThan(10);
  }, 30000);
  it('stampQuench max-combines (a second, smaller stamp never lowers a texel)', () => {
    const m = createScarMap(256, 128);
    stampQuench(m, D, 0.2, 1);
    const first = Array.from(m.bytes);
    stampQuench(m, D, 0.1, 2);
    for (let i = 0; i < m.w * m.h; i++) expect(m.bytes[4 * i + 2]).toBeGreaterThanOrEqual(first[4 * i + 2]);
  });
  it('crossMarks wipes B and A only when the liquid/crust side changes, in either direction', () => {
    const m = createScarMap(64, 32);
    stampQuench(m, D, 0.3, 1);
    stampGlaze(m, D, 0.3);
    expect(crossMarks(m, null, false)).toBe(false);   // first frame: nothing to compare against
    expect(crossMarks(m, false, false)).toBe(false);  // still crust: the rinds stay
    expect(m.marksLive).toBe(true);
    expect(crossMarks(m, false, true)).toBe(true);    // re-melt: the rinds and the glaze melt away with the crust
    expect(m.marksLive).toBe(false);
    for (let i = 0; i < m.w * m.h; i++) { expect(m.bytes[4 * i + 2]).toBe(0); expect(m.bytes[4 * i + 3]).toBe(0); }
    stampGlaze(m, D, 0.3);
    expect(crossMarks(m, true, true)).toBe(false);
    expect(crossMarks(m, true, false)).toBe(true);    // re-crust: frozen-Hg marks are buried
    expect(crossMarks(m, false, true)).toBe(false);   // nothing left to wipe
  });
});
