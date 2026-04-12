import { describe, it, expect } from 'vitest';
import { ELEMENTS } from '../../src/terminal/data/periodicElements';

describe('ELEMENTS array', () => {
  it('has exactly 118 entries', () => {
    expect(ELEMENTS).toHaveLength(118);
  });

  it('each element has required fields of correct type', () => {
    for (const el of ELEMENTS) {
      expect(typeof el.symbol).toBe('string');
      expect(typeof el.name).toBe('string');
      expect(typeof el.atomicNumber).toBe('number');
      expect(typeof el.period).toBe('number');
      expect(typeof el.block).toBe('string');
      expect(typeof el.phaseAffinity).toBe('number');
      expect(el.phaseAffinity).toBeGreaterThanOrEqual(0);
      expect(el.phaseAffinity).toBeLessThanOrEqual(1);
    }
  });

  it('atomic numbers run 1–118 with no gaps', () => {
    const nums = ELEMENTS.map(e => e.atomicNumber).sort((a, b) => a - b);
    for (let i = 0; i < 118; i++) expect(nums[i]).toBe(i + 1);
  });
});

describe('phaseAffinity — anchor', () => {
  it('Hg (#80) is exactly 1.00', () => {
    const hg = ELEMENTS.find(e => e.atomicNumber === 80);
    expect(hg.phaseAffinity).toBe(1.00);
  });
});

describe('phaseAffinity — group 12 (0.90)', () => {
  it('Zn (#30) is 0.90', () => {
    expect(ELEMENTS[29].phaseAffinity).toBe(0.90);
  });
  it('Cd (#48) is 0.90', () => {
    expect(ELEMENTS[47].phaseAffinity).toBe(0.90);
  });
  it('Cn (#112) is 0.90', () => {
    expect(ELEMENTS[111].phaseAffinity).toBe(0.90);
  });
});

describe('phaseAffinity — period 6 (0.85)', () => {
  it('Cs (#55) is 0.85', () => {
    expect(ELEMENTS[54].phaseAffinity).toBe(0.85);
  });
  it('Au (#79) is 0.85', () => {
    expect(ELEMENTS[78].phaseAffinity).toBe(0.85);
  });
  it('Rn (#86) is 0.85', () => {
    expect(ELEMENTS[85].phaseAffinity).toBe(0.85);
  });
  it('all 31 non-Hg period-6 elements are 0.85', () => {
    const p6 = ELEMENTS.filter(e => e.period === 6 && e.atomicNumber !== 80);
    expect(p6).toHaveLength(31);
    for (const el of p6) expect(el.phaseAffinity).toBe(0.85);
  });
});

describe('phaseAffinity — d-block (0.55)', () => {
  it('Fe (#26) is 0.55', () => {
    expect(ELEMENTS[25].phaseAffinity).toBe(0.55);
  });
  it('Ag (#47) is 0.55', () => {
    expect(ELEMENTS[46].phaseAffinity).toBe(0.55);
  });
  it('Rf (#104) is 0.55', () => {
    expect(ELEMENTS[103].phaseAffinity).toBe(0.55);
  });
});

describe('phaseAffinity — period 5 non-d (0.40)', () => {
  it('Rb (#37) is 0.40', () => {
    expect(ELEMENTS[36].phaseAffinity).toBe(0.40);
  });
  it('Xe (#54) is 0.40', () => {
    expect(ELEMENTS[53].phaseAffinity).toBe(0.40);
  });
});

describe('phaseAffinity — dissipating (0.15)', () => {
  it('H (#1) is 0.15', () => {
    expect(ELEMENTS[0].phaseAffinity).toBe(0.15);
  });
  it('K (#19) is 0.15', () => {
    expect(ELEMENTS[18].phaseAffinity).toBe(0.15);
  });
  it('U (#92) is 0.15', () => {
    expect(ELEMENTS[91].phaseAffinity).toBe(0.15);
  });
});

describe('phaseAffinity — tier counts', () => {
  it('locked tier (≥0.70) has 35 elements', () => {
    expect(ELEMENTS.filter(e => e.phaseAffinity >= 0.70)).toHaveLength(35);
  });
  it('weak tier (0.40–0.69) has 36 elements', () => {
    expect(ELEMENTS.filter(e => e.phaseAffinity >= 0.40 && e.phaseAffinity < 0.70)).toHaveLength(36);
  });
  it('dissipating tier (<0.40) has 47 elements', () => {
    expect(ELEMENTS.filter(e => e.phaseAffinity < 0.40)).toHaveLength(47);
  });
});
