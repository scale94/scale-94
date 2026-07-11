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
                   houses: { ecocide: null, ledger: null, privacy: null, surveillance: null } };
    const { source } = await compileKernel(FULL_SPINE, bare, ENGINE, OPTS);
    expect(source).toContain('HOUSE EMPTY — never witnessed');
    expect(source).toContain('ciphers: None');
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
});
