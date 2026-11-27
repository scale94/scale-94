import { describe, it, expect } from 'vitest';
import { MATERIALS } from '../materials';
import { NOTE_MATERIALS, NOTE_RATIONALE } from '../noteInterpretation';
import { isValidCas } from '../casCheck';
import { PERF_NOTES } from '../../collider/perfumeCard';

const STOCK_LADDER = [1.0, 0.5, 0.1, 0.01, 0.001];
const isUrl = (u) => typeof u === 'string' && /^https:\/\/\S+$/.test(u);
const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const cited = (s) => !!(s && s.name && isUrl(s.url) && isDate(s.accessed));
const byId = (id) => MATERIALS.find((m) => m.id === id);

describe('isValidCas', () => {
  it('accepts ethanol and rejects a wrong check digit or a malformed string', () => {
    expect(isValidCas('64-17-5')).toBe(true);
    expect(isValidCas('64-17-6')).toBe(false);
    expect(isValidCas('6417-5')).toBe(false);
    expect(isValidCas('')).toBe(false);
    expect(isValidCas(null)).toBe(false);
  });
});

describe('MATERIALS', () => {
  it('every row has id, name, cas, layer, role, stocks from the ladder, ifraCat4MaxPct number|null', () => {
    for (const m of MATERIALS) {
      expect(typeof m.id, m.id).toBe('string');
      expect(m.name, m.id).toBeTruthy();
      expect(m.cas, m.id).toBeTruthy();
      expect(['top', 'heart', 'base'], m.id).toContain(m.layer);
      expect(m.role, m.id).toBeTruthy();
      expect(m.stocks.length, m.id).toBeGreaterThan(0);
      for (const s of m.stocks) expect(STOCK_LADDER, m.id).toContain(s);
      expect(m.ifraCat4MaxPct === null || (typeof m.ifraCat4MaxPct === 'number' && m.ifraCat4MaxPct > 0), m.id).toBe(true);
    }
  });

  it('every row cites its CAS', () => {
    for (const m of MATERIALS) expect(cited(m.sources.casSource), m.id).toBe(true);
  });

  it('every row cites its IFRA standard, or that it is unrestricted', () => {
    for (const m of MATERIALS) {
      const s = m.sources.ifraSource;
      expect(s, m.id).toBeTruthy();
      expect(isUrl(s.url), m.id).toBe(true);
      if (s.unrestricted === true) expect(s.evidence, m.id).toBeTruthy();
      else {
        expect(s.standard && s.amendment, m.id).toBeTruthy();
        expect(m.ifraCat4MaxPct, m.id).not.toBeNull();
      }
    }
  });

  it('every constituent names its standard with a URL and passes the CAS check', () => {
    for (const m of MATERIALS) {
      for (const c of m.ifraConstituents ?? []) {
        expect(isValidCas(c.cas), `${m.id}/${c.name}`).toBe(true);
        expect(isUrl(c.standardUrl), `${m.id}/${c.name}`).toBe(true);
      }
    }
  });

  it('every solid has a cited solubility, and a 10% stock only where it confirms 10%', () => {
    const solids = MATERIALS.filter((m) => m.physicalState === 'solid');
    expect(solids.length).toBeGreaterThan(0);
    for (const m of solids) {
      expect(m.solubility, m.id).toBeTruthy();
      expect(cited(m.sources.solubilitySource), m.id).toBe(true);
      if (m.stocks.some((s) => s >= 0.1 && s < 1)) expect(m.solubility.supports10pctStock, m.id).toBe(true);
    }
    expect(MATERIALS.some((m) => m.physicalState === 'unconfirmed')).toBe(false);
  });

  it('every cas passes isValidCas; no duplicate id or cas', () => {
    for (const m of MATERIALS) expect(isValidCas(m.cas), m.id).toBe(true);
    expect(new Set(MATERIALS.map((m) => m.id)).size).toBe(MATERIALS.length);
    expect(new Set(MATERIALS.map((m) => m.cas)).size).toBe(MATERIALS.length);
  });

  it('fixture names never leak', () => {
    expect(MATERIALS.some((m) => m.id.startsWith('fx-'))).toBe(false);
  });

  it('is frozen all the way down', () => {
    expect(Object.isFrozen(MATERIALS)).toBe(true);
    expect(Object.isFrozen(MATERIALS[0].stocks)).toBe(true);
    expect(Object.isFrozen(MATERIALS[0].sources.casSource)).toBe(true);
  });
});

describe('sign-off rulings (2026-11-27) are in the table', () => {
  it('E: Bergamot FCF, CAS 89957-91-5, ceiling derived under STD 089, bergapten cited', () => {
    const b = byId('bergamot_oil');
    expect(b.name).toMatch(/FCF/);
    expect(b.cas).toBe('89957-91-5');
    expect(b.stocks).toEqual([1, 0.1]);
    expect(b.ifraCat4MaxPctBasis).toMatch(/^derived: STD 089/);
    expect(b.sources.ifraSource.url).toMatch(/IFRA_STD_089\.pdf$/);
    expect(b.sources.ifraSource.fallback.cat4MaxPct).toBe(0.4);
    expect(cited(b.furocoumarins.source)).toBe(true);
    expect(b.ifraConstituents.find((c) => c.name === 'Citral').pctInMaterial).toBe(1.5);
  });

  it('C: 10% steps on the four core neat liquids; methyl octine carbonate at 0.1%', () => {
    for (const id of ['hedione', 'phenylethyl_alcohol', 'iso_e_super', 'cedarwood_atlas_oil']) {
      expect(byId(id).stocks, id).toEqual([1, 0.1]);
    }
    expect(byId('methyl_octine_carbonate').stocks).toEqual([0.001]);
  });

  it('D: solids carry a crystal (neat) stock; coumarin, ambrox and cashmeran stop at 1%', () => {
    for (const m of MATERIALS.filter((x) => x.physicalState === 'solid')) expect(m.stocks[0], m.id).toBe(1);
    for (const id of ['coumarin', 'ambrox', 'cashmeran']) expect(byId(id).stocks, id).toEqual([1, 0.01]);
  });

  it('A: the six naturals carry the peroxide-value purchase spec', () => {
    for (const id of ['bergamot_oil', 'petitgrain_bigarade_oil', 'black_pepper_oil', 'cardamom_oil', 'olibanum_oil', 'ylang_ylang_oil']) {
      expect(byId(id).purchaseSpec, id).toMatch(/IFRA-compliant peroxide value \(< 20 mmol\/L\)/);
    }
  });

  it('F: ylang carries benzyl cyanide at the STD 112 notebox ceiling', () => {
    const bc = byId('ylang_ylang_oil').ifraConstituents.find((c) => c.cas === '140-29-4');
    expect(bc.standardCat4MaxPct).toBe(0.01);
    expect(bc.standardUrl).toMatch(/IFRA_STD_112\.pdf$/);
  });
});

describe('NOTE_MATERIALS', () => {
  const names = new Set();
  for (const layer of Object.values(PERF_NOTES)) for (const fam of Object.values(layer)) for (const n of fam) names.add(n);

  it('every name in PERF_NOTES (all layers and families) has an entry, and nothing else does', () => {
    for (const n of names) expect(NOTE_MATERIALS[n], n).toBeTruthy();
    for (const n of Object.keys(NOTE_MATERIALS)) expect(names.has(n), n).toBe(true);
  });

  it('every materialId exists in MATERIALS with positive parts; every entry has a kind and why', () => {
    const ids = new Set(MATERIALS.map((m) => m.id));
    for (const [n, list] of Object.entries(NOTE_MATERIALS)) {
      expect(list.length, n).toBeGreaterThan(0);
      for (const { materialId, parts } of list) {
        expect(ids.has(materialId), `${n} → ${materialId}`).toBe(true);
        expect(parts > 0, `${n} → ${materialId}`).toBe(true);
      }
      expect(['direct', 'interpretation', 'stand-in'], n).toContain(NOTE_RATIONALE[n].kind);
      expect(NOTE_RATIONALE[n].why, n).toBeTruthy();
    }
  });

  it('every resinous heart note carries a heart-layer material', () => {
    for (const n of PERF_NOTES.heart.resinous) {
      const layers = NOTE_MATERIALS[n].map(({ materialId }) => byId(materialId).layer);
      expect(layers, n).toContain('heart');
    }
  });
});
