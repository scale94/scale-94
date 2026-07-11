// src/terminal/quintessence/__tests__/taxonomyRegistry.test.js — the faculty roster (spec §8).
import { describe, it, expect } from 'vitest';
import { TAXONOMY, ownerOf, lensFor } from '../taxonomyRegistry';
import { mulberry32 } from '../../views/manifesto/councilCollider';

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

const CTX = {
  spine: {
    trend: { label: 'degrowth', velocity: 0.9 },
    council: { pair: ['ELINOR OSTROM', 'NORBERT WIENER'], directive: 'd', trajectory: 'FOUNDATION', paradoxCount: 3 },
    phase: 'SMOKE DISSOLUTION',
    element: 'FIRE',
  },
  periphery: {
    ciphers: { sealed: 1, verifies: 2, unlocks: 1 },
    transmissions: { count: 4, ledgerDepth: 2, lastKernel: 'FSF-12.1.0' },
    essences: { collisions: 2, crystallized: 1, polarity: 'RADIANT' },
    lunarRead: { phase: 'Waxing Gibbous', illum: 0.82 },
    houses: { ecocide: 1, ledger: null, privacy: 3, surveillance: null },
  },
  meta: { dryness: 85, bpm: 172, verdict: 'PLATA', daemon: 'TheDevil', filledHouses: 6 },
};

describe('lensFor — the reading', () => {
  it('is deterministic: same ctx + seed → identical line', () => {
    const a = lensFor('narcos_payload', CTX, mulberry32(42));
    const b = lensFor('narcos_payload', CTX, mulberry32(42));
    expect(a).toBe(b);
    expect(a).toMatch(/^⟨SEMIOTICS⟩ /);
  });

  it('interpolates the visitor value as detail', () => {
    const line = lensFor('narcos_payload', CTX, mulberry32(1));
    expect(line).toContain('velocity 0.90 read as murmur');
    const astro = lensFor('entropy_lock', CTX, mulberry32(1));
    expect(astro).toContain('82.0% illuminated');
  });

  it('band edges land as documented (spec §5)', () => {
    const at = (slot, ctx) => {
      const entry = TAXONOMY.find(d => d.owns.includes(slot));
      return entry.band(ctx);
    };
    const withVelocity = v => ({ ...CTX, spine: { ...CTX.spine, trend: { label: 't', velocity: v } } });
    expect(at('narcos_payload', withVelocity(0.99))).toBe('murmur');
    expect(at('narcos_payload', withVelocity(1))).toBe('current');
    expect(at('narcos_payload', withVelocity(3))).toBe('panic');

    const withDryness = d => ({ ...CTX, meta: { ...CTX.meta, dryness: d } });
    expect(at('pirarucu', withDryness(39))).toBe('green');
    expect(at('pirarucu', withDryness(40))).toBe('burn');
    expect(at('pirarucu', withDryness(70))).toBe('mineral');

    const withIllum = i => ({ ...CTX, periphery: { ...CTX.periphery, lunarRead: i == null ? null : { phase: 'p', illum: i } } });
    expect(at('entropy_lock', withIllum(0.24))).toBe('dark');
    expect(at('entropy_lock', withIllum(0.25))).toBe('crescent');
    expect(at('entropy_lock', withIllum(0.5))).toBe('gibbous');
    expect(at('entropy_lock', withIllum(0.75))).toBe('full');
    expect(at('entropy_lock', withIllum(null))).toBe('absent');

    const withBpm = b => ({ ...CTX, meta: { ...CTX.meta, bpm: b } });
    expect(at('necromantic_engine', withBpm(159))).toBe('calcifying');
    expect(at('necromantic_engine', withBpm(160))).toBe('chaotic'); // mirrors the Plata threshold

    const withParadox = n => ({ ...CTX, spine: { ...CTX.spine, council: { ...CTX.spine.council, paradoxCount: n } } });
    expect(at('council_pair', withParadox(0))).toBe('monolith');
    expect(at('council_pair', withParadox(1))).toBe('dialectic');
    expect(at('council_pair', withParadox(2))).toBe('polyphony');

    const withFilled = n => ({ ...CTX, meta: { ...CTX.meta, filledHouses: n } });
    expect(at('witness_intro', withFilled(2))).toBe('sparse');
    expect(at('witness_intro', withFilled(3))).toBe('attended');
    expect(at('witness_intro', withFilled(6))).toBe('dense');
  });

  it('unknown slot returns a tagged fallback, does not throw', () => {
    const line = lensFor('not_a_slot', CTX, mulberry32(7));
    expect(line).toBe('⟨UNREGISTERED⟩ the reading resists its instrument');
  });

  it('never throws on a hollow ctx — degrades to a valid reading', () => {
    const line = lensFor('narcos_payload', { spine: {} }, mulberry32(7));
    expect(line).toMatch(/^⟨SEMIOTICS⟩ /); // velocity→0→murmur, element→AIR default
  });
});
