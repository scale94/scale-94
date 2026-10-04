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
    const before = new Uint8Array(m.bytes);
    const r = 0.2;
    expect(stampQuench(m, D, r, 7)).toBeGreaterThan(0);
    expect(m.marksLive).toBe(true);

    let coreCount = 0, ringCount = 0;
    let badR = 0, badG = 0, badA = 0;
    let badCoreValue = 0, badRingValue = 0, badOutValue = 0;

    for (let i = 0; i < m.w * m.h; i++) {
      if (m.bytes[4 * i] !== before[4 * i]) badR++;
      if (m.bytes[4 * i + 1] !== before[4 * i + 1]) badG++;
      if (m.bytes[4 * i + 3] !== before[4 * i + 3]) badA++;

      const s = angTo(m, i) / r, b = m.bytes[4 * i + 2];
      if (s < 0.5) {
        coreCount++;
        if (b !== 255) badCoreValue++;
      }
      if (s > 0.72 && s < 0.93) {
        ringCount++;
        if (b < 126 || b > 129) badRingValue++;
      }
      if (s > 1.25) {
        if (b !== 0) badOutValue++;
      }
    }

    expect(badR).toBe(0);
    expect(badG).toBe(0);
    expect(badA).toBe(0);
    expect(badCoreValue).toBe(0);
    expect(badRingValue).toBe(0);
    expect(badOutValue).toBe(0);
    expect(coreCount).toBeGreaterThan(10);
    expect(ringCount).toBeGreaterThan(10);
  });
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
