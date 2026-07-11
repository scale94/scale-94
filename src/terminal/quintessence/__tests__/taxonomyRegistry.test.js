// src/terminal/quintessence/__tests__/taxonomyRegistry.test.js — the faculty roster (spec §8).
import { describe, it, expect } from 'vitest';
import { TAXONOMY, ownerOf } from '../taxonomyRegistry';

const TINTS = ['FIRE', 'WATER', 'AIR', 'EARTH'];

describe('taxonomyRegistry — completeness', () => {
  it('seats all 15 disciplines across the three tiers (5 humanities, 6 soft sciences, 4 overlap pairs)', () => {
    expect(TAXONOMY).toHaveLength(15);
    const byTier = { HUMANITIES: 0, SOFT_SCIENCES: 0, OVERLAP_MATRIX: 0 };
    for (const d of TAXONOMY) byTier[d.tier]++;
    expect(byTier.HUMANITIES).toBe(5);
    expect(byTier.SOFT_SCIENCES).toBe(6);
    expect(byTier.OVERLAP_MATRIX).toBe(4);
  });

  it('every overlap-matrix entry carries the double tag', () => {
    for (const d of TAXONOMY.filter(d => d.tier === 'OVERLAP_MATRIX'))
      expect(d.tag).toContain('⇄');
  });

  it('every slot has exactly one owner', () => {
    const all = TAXONOMY.flatMap(d => d.owns);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(18); // every artifact slot seated
  });

  it('every band pool carries all four tints with ≥2 fragments each (spec §5)', () => {
    for (const d of TAXONOMY)
      for (const [band, tints] of Object.entries(d.pools))
        for (const el of TINTS)
          expect(tints[el]?.length, `${d.id}.${band}.${el}`).toBeGreaterThanOrEqual(2);
  });

  it('ownerOf resolves the reliquary annotations', () => {
    expect(ownerOf('narcos_payload')).toBe('SEMIOTICS');
    expect(ownerOf('pirarucu')).toBe('CHEMISTRY ⇄ ALCHEMY');
    expect(ownerOf('house_ledger')).toBe('HISTORY');
    expect(ownerOf('house_privacy')).toBe('SOCIOLOGY');
    expect(ownerOf('not_a_slot')).toBeNull();
  });
});
