import { describe, it, expect } from 'vitest';
import { HG_N, HG_K, HG_F0, conductorFresnel } from '../hgOptics';

const F = (c, i) => conductorFresnel(c, HG_N[i], HG_K[i]);

describe('hgOptics — Hg as a conductor', () => {
  it('normal incidence is quicksilver: ~0.78, neutral across RGB', () => {
    for (const f of HG_F0) expect(f).toBeGreaterThan(0.76), expect(f).toBeLessThan(0.8);
    expect(Math.max(...HG_F0) - Math.min(...HG_F0)).toBeLessThan(0.01);
  });

  it('the exact formula meets the closed-form F0 at normal incidence', () => {
    for (let i = 0; i < 3; i++) expect(F(1, i)).toBeCloseTo(HG_F0[i], 6);
  });

  it('grazing incidence reflects everything', () => {
    for (let i = 0; i < 3; i++) expect(F(0, i)).toBeCloseTo(1, 6);
  });

  it('sags below F0 near the principal angle, which Schlick cannot', () => {
    const c = Math.cos(78 * Math.PI / 180);
    for (let i = 0; i < 3; i++) expect(F(c, i)).toBeLessThan(HG_F0[i]);
  });

  it('stays within [0, 1] over every angle', () => {
    for (let a = 0; a <= 90; a += 1) {
      for (let i = 0; i < 3; i++) {
        const r = F(Math.cos(a * Math.PI / 180), i);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      }
    }
  });
});
