// src/terminal/quintessence/__tests__/taxonomyRegistry.test.js — the faculty roster (spec §8).
import { describe, it, expect } from 'vitest';
import { TAXONOMY, ownerOf, lensFor } from '../taxonomyRegistry';
import { mulberry32 } from '../../views/manifesto/councilCollider';

const TINTS = ['FIRE', 'WATER', 'AIR', 'EARTH'];

describe('taxonomyRegistry — completeness', () => {
  it('seats all 16 disciplines across the three tiers (5 humanities, 6 soft sciences, 5 overlap pairs)', () => {
    expect(TAXONOMY).toHaveLength(16);
    const byTier = { HUMANITIES: 0, SOFT_SCIENCES: 0, OVERLAP_MATRIX: 0 };
    for (const d of TAXONOMY) byTier[d.tier]++;
    expect(byTier.HUMANITIES).toBe(5);
    expect(byTier.SOFT_SCIENCES).toBe(6);
    expect(byTier.OVERLAP_MATRIX).toBe(5);
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
    expect(line).toContain('velocity 0.90 read as panic');
    const astro = lensFor('entropy_lock', CTX, mulberry32(1));
    expect(astro).toContain('82.0% illuminated');
  });

  it('band edges land as documented (spec §5)', () => {
    const at = (slot, ctx) => {
      const entry = TAXONOMY.find(d => d.owns.includes(slot));
      return entry.band(ctx);
    };
    // velocity is rank-derived ∈ (0,1] (BskyTab emits (total-i)/total) —
    // edges live on that scale: <0.35 murmur, <0.75 current, ≥0.75 panic.
    const withVelocity = v => ({ ...CTX, spine: { ...CTX.spine, trend: { label: 't', velocity: v } } });
    expect(at('narcos_payload', withVelocity(0.34))).toBe('murmur');
    expect(at('narcos_payload', withVelocity(0.35))).toBe('current');
    expect(at('narcos_payload', withVelocity(0.74))).toBe('current');
    expect(at('narcos_payload', withVelocity(0.75))).toBe('panic');
    expect(at('narcos_payload', withVelocity(1))).toBe('panic');

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
    expect(at('witness_intro', withFilled(6))).toBe('attended'); // shifted: 9 houses now
    expect(at('witness_intro', withFilled(7))).toBe('dense');
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

describe('deep periphery — enriched readings', () => {
  const entry = slot => TAXONOMY.find(d => d.owns.includes(slot));
  const withPeriphery = patch => ({ ...CTX, periphery: { ...CTX.periphery, ...patch } });
  const BARE_HOUSES = { ecocide: null, ledger: null, privacy: null, surveillance: null };

  it('aesthetics owns house_chaos and reads art OR essences as witnessed', () => {
    expect(ownerOf('house_chaos')).toBe('AESTHETICS');
    const aesthetics = entry('house_essences');
    expect(aesthetics.band(withPeriphery({ essences: null, art: null }))).toBe('absent');
    expect(aesthetics.band(withPeriphery({ essences: null, art: { visits: 2 } }))).toBe('witnessed');
    expect(aesthetics.band(withPeriphery({ art: null }))).toBe('witnessed'); // essences present in CTX
  });

  it('aesthetics detail: art interactions → essences → visits-only → null', () => {
    const aesthetics = entry('house_essences');
    expect(aesthetics.detail(withPeriphery({ art: { resonances: 1, lastSim: 0.83, bifurcations: 0, chimeras: 1 } })))
      .toBe('1 chimera · resonance 0.83');
    expect(aesthetics.detail(withPeriphery({ art: null }))).toBe('1 crystallized');
    expect(aesthetics.detail(withPeriphery({ essences: null, art: { visits: 2 } })))
      .toBe('the sphere seen, unengaged');
    expect(aesthetics.detail(withPeriphery({ essences: null, art: null }))).toBeNull();
  });

  it('aesthetics detail speaks cascade vocabulary when the regime was witnessed', () => {
    const aesthetics = entry('house_essences');
    expect(aesthetics.detail(withPeriphery({
      art: { resonances: 1, lastSim: 0.83, bifurcations: 0, chimeras: 1,
             lastR: 3.72, lyapunov: 0.021, regime: 'CHAOS' },
    }))).toBe('1 chimera · resonance 0.83 · regime CHAOS');
  });

  it('sociology: band counts ecocideSim, detail interpolates the rift', () => {
    const sociology = entry('house_ecocide');
    expect(sociology.band(withPeriphery({ houses: BARE_HOUSES, ecocideSim: null }))).toBe('absent');
    expect(sociology.band(withPeriphery({ houses: BARE_HOUSES, ecocideSim: { phase: 'COLLAPSE', rift: 0.72 } }))).toBe('witnessed');
    expect(sociology.detail(withPeriphery({ ecocideSim: { phase: 'COLLAPSE', rift: 0.72 } })))
      .toBe('metabolic rift 0.72 at COLLAPSE');
    expect(sociology.detail(withPeriphery({ ecocideSim: { phase: 'COLLAPSE', rift: null } })))
      .toBe('phase COLLAPSE witnessed');
    expect(sociology.detail(withPeriphery({ ecocideSim: null }))).toBeNull();
  });

  it('history: band counts ledgerVerdict, detail names the ruling', () => {
    const history = entry('house_ledger');
    expect(history.band(withPeriphery({ transmissions: null, houses: BARE_HOUSES, ledgerVerdict: null }))).toBe('absent');
    expect(history.band(withPeriphery({ transmissions: null, houses: BARE_HOUSES, ledgerVerdict: 'REJECTED' }))).toBe('witnessed');
    expect(history.detail(withPeriphery({ ledgerVerdict: 'REJECTED' }))).toBe('the cascade ruled REJECTED');
    expect(history.detail(withPeriphery({ ledgerVerdict: null }))).toBeNull();
  });

  it('anthropology denominator is 9', () => {
    const anthro = entry('witness_intro');
    expect(anthro.detail({ ...CTX, meta: { ...CTX.meta, filledHouses: 6 } })).toBe('6 of 9 houses witnessed');
  });
});

describe('sociology_economics — THE LINKER lens (spec 2026-07-17)', () => {
  const entry = TAXONOMY.find(d => d.id === 'sociology_economics');

  it('owns the linker slot', () => {
    expect(ownerOf('linker')).toBe('SOCIOLOGY ⇄ ECONOMICS');
  });

  it('bands unopened → consulted → linked', () => {
    expect(entry.band({ periphery: {} })).toBe('unopened');
    expect(entry.band({ periphery: { corpus: { linked: [], consulted: ['X'], total: 43 } } })).toBe('consulted');
    expect(entry.band({ periphery: { corpus: { linked: ['X'], consulted: [], total: 43 } } })).toBe('linked');
  });

  it('detail prices the contact', () => {
    expect(entry.detail({ periphery: { corpus: { linked: ['A'], consulted: ['B', 'C'], total: 43 } } }))
      .toBe('1 linked · 2 consulted · of 43');
    expect(entry.detail({ periphery: {} })).toBeNull();
  });

  it('lensFor renders the double tag', () => {
    const line = lensFor('linker', { spine: { element: 'FIRE' }, periphery: {} }, mulberry32(7));
    expect(line).toMatch(/^⟨SOCIOLOGY ⇄ ECONOMICS⟩ /);
  });
});
