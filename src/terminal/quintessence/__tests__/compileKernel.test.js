import { describe, it, expect } from 'vitest';
import { compileKernel, ELEMENT_MAP } from '../compileKernel';

const FULL_SPINE = {
  trend: { label: 'degrowth', velocity: 0.9, volume: 1200 },
  council: { pair: ['ELINOR OSTROM', 'NORBERT WIENER'],
             directive: 'You are synthesizing OSTROM × WIENER inside a post-capitalist structural frame.',
             trajectory: 'FOUNDATION', paradoxCount: 3 },
  phase: 'SMOKE DISSOLUTION',
  element: 'FIRE',
};

const FULL_PERIPHERY = {
  ciphers: { sealed: 1, verifies: 2, unlocks: 1 },
  transmissions: { count: 4, ledgerDepth: 2, lastKernel: 'FSF-12.1.0' },
  essences: { collisions: 2, crystallized: 1, polarity: 'RADIANT' },
  lunarRead: { phase: 'Waxing Gibbous', illum: 0.82 },
  houses: { ecocide: 1, ledger: null, privacy: 3, surveillance: null },
  art: { resonances: 1, lastSim: 0.83, bifurcations: 14, chimeras: 1,
         lastR: 3.72, lyapunov: 0.021, regime: 'CHAOS' },
  ecocideSim: { phase: 'COLLAPSE', rift: 0.72 },
  ledgerVerdict: 'REJECTED',
};

const ENGINE = {
  regime: 'ARMOR_DENSE_CHAOS', integrity: 87.5, lyapunov: 0.42, axiomsActive: 7,
  inSanctuary: false, armorDensity: 1.61, layers: 12, burnStatus: 'POST-WINDOW',
};

const OPTS = { compiledAt: '2026-07-09T12:00:00.000Z' };

describe('compileKernel', () => {
  it('is deterministic: same inputs → identical source and hash', async () => {
    const a = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    const b = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(a.source).toBe(b.source);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different element → different hash', async () => {
    const a = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    const b = await compileKernel({ ...FULL_SPINE, element: 'WATER' }, FULL_PERIPHERY, ENGINE, OPTS);
    expect(a.hash).not.toBe(b.hash);
  });

  it('header carries name, fork version, build hash prefix, and the axiom', async () => {
    const { source, hash } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source).toContain('KERNEL OF QUINTESSENCE :: FORK OF FISH SCALE 11.2 :: BUILD 0x' + hash.slice(0, 8).toUpperCase());
    expect(source).toContain('THIS IS A SEALED VIAL. CARRY IT OUT.');
    expect(source).toContain('Theory that cannot be compiled does not yet exist as knowledge.');
  });

  it('maps all four elements to daemon state and atom role (spec §3.2)', () => {
    expect(ELEMENT_MAP.FIRE).toEqual({ atom: 'Boson', daemon: 'TheDevil' });
    expect(ELEMENT_MAP.AIR).toEqual({ atom: 'Boson', daemon: 'TheDevil' });
    expect(ELEMENT_MAP.EARTH).toEqual({ atom: 'Fermion', daemon: 'TheMask' });
    expect(ELEMENT_MAP.WATER).toEqual({ atom: 'Fermion', daemon: 'TheMask' });
  });

  it('compiles dryness from the phase and embeds the directive', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source).toContain('dryness_coefficient: 85'); // SMOKE DISSOLUTION
    expect(source).toContain('post-capitalist structural frame');
  });

  it('bpm >= 160 → Plata; the verdict keys off trend velocity via r', async () => {
    const hot = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);      // v=0.9 → r=3.88 → bpm>160
    expect(hot.meta.verdict).toBe('PLATA');
    expect(hot.source).toContain('PlataOPlomo::Plata');
    const cold = await compileKernel(
      { ...FULL_SPINE, trend: { label: 'stasis', velocity: 0.0 } },
      FULL_PERIPHERY, ENGINE, OPTS);                                                // v=0 → r=2.8 → bpm<160
    expect(cold.meta.verdict).toBe('PLOMO');
    expect(cold.source).toContain('PlataOPlomo::Plomo');
  });

  it('empty houses compile as None with the witness comment', async () => {
    const bare = { ciphers: null, transmissions: null, essences: null, lunarRead: null,
                   houses: { ecocide: null, ledger: null, privacy: null, surveillance: null },
                   art: null, ecocideSim: null, ledgerVerdict: null };
    const { source } = await compileKernel(FULL_SPINE, bare, ENGINE, OPTS);
    expect(source).toContain('HOUSE EMPTY — never witnessed');
    expect(source).toContain('ciphers: None');
    expect(source).toContain('house_chaos: None');
    expect(source).toContain('TRANSIT UNREAD — the clock was never wound');
    expect(source).toContain('AtomicU64::new(0)');
  });

  it('engine offline compiles the offline block, still verdicts via JS fallback', async () => {
    const { source, meta } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, null, OPTS);
    expect(source).toContain('ENGINE OFFLINE — constants unwitnessed');
    expect(meta.verdict).toBe('PLATA'); // bpm fallback still resolves
  });

  it('inherits the panic handler verbatim', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source).toContain('#[panic_handler]');
    expect(source).toContain('core::hint::spin_loop()');
  });

  it('every faculty tag appears in the artifact (registry spec §4)', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    const TAGS = [
      'LITERATURE & PHILOLOGY', 'PHILOSOPHY', 'AESTHETICS', 'HISTORY', 'RELIGIOUS STUDIES',
      'SEMIOTICS', 'PSYCHOLOGY', 'SOCIOLOGY', 'ANTHROPOLOGY', 'LINGUISTICS', 'ECONOMICS',
      'ASTRONOMY ⇄ ASTROLOGY', 'CHEMISTRY ⇄ ALCHEMY', 'COGNITIVE SCIENCE ⇄ MYTHOLOGY', 'LINGUISTICS ⇄ HERMETICS',
    ];
    for (const tag of TAGS) expect(source, tag).toContain(`⟨${tag}⟩`);
  });

  it('engine_witness stays unlensed — computed, not narrated (registry spec §4)', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    const start = source.indexOf('mod engine_witness');
    const end = source.indexOf('THE PERIPHERAL WITNESS');
    expect(start).toBeGreaterThan(-1);
    expect(source.slice(start, end)).not.toContain('⟨');
  });

  it('multi-slot owners emit one grouped lens line (HISTORY, SOCIOLOGY)', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source.match(/⟨HISTORY⟩/g)).toHaveLength(1);
    expect(source.match(/⟨SOCIOLOGY⟩/g)).toHaveLength(1);
  });

  it('deep periphery: house_chaos compiles all three states (spec §5.2 + chaos spec §3)', async () => {
    const a = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(a.source).toContain('house_chaos: Some("chimera fused ×1 · 14 bifurcations · resonance 0.83 · sphere r 3.72 λ +0.021 CHAOS")');
    const visitsOnly = { ...FULL_PERIPHERY, art: { visits: 2 } };
    const b = await compileKernel(FULL_SPINE, visitsOnly, ENGINE, OPTS);
    expect(b.source).toContain('house_chaos: Some("entered 2× · the sphere untouched")');
    const never = { ...FULL_PERIPHERY, art: null };
    const c = await compileKernel(FULL_SPINE, never, ENGINE, OPTS);
    expect(c.source).toContain('house_chaos: None');
  });

  it('twin cascade: Δr line compares sphere r against the trend-driven engine r (chaos spec §3)', async () => {
    // trendToPressure(0.9) = 2.8 + 1.2·0.9 = 3.88 · sphere r 3.72 → trailed by 0.16
    const trailed = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(trailed.source).toContain('the sphere trailed the world by Δr 0.16');

    const ahead = await compileKernel(FULL_SPINE,
      { ...FULL_PERIPHERY, art: { ...FULL_PERIPHERY.art, lastR: 3.95 } }, ENGINE, OPTS);
    expect(ahead.source).toContain('the sphere ran ahead of the world by Δr +0.07');

    // sphere never phase-witnessed → the absence is named
    const silent = await compileKernel(FULL_SPINE,
      { ...FULL_PERIPHERY, art: { resonances: 1, lastSim: 0.83, bifurcations: 14, chimeras: 1,
                                  lastR: null, lyapunov: null, regime: null } }, ENGINE, OPTS);
    expect(silent.source).toContain('the twin cascade never spoke');
  });

  it('deep periphery: ledger and ecocide houses carry their testimony', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source).toContain('house_ledger: Some("verdict REJECTED")'); // verdict alone fills the house
    expect(source).toContain('house_ecocide: Some("entered 1× · phase COLLAPSE · metabolic rift 0.72")');
  });
});
