import { describe, it, expect } from 'vitest';
import { buildAccordFormula } from '../accordFormula';
import { MATERIALS } from '../materials';
import { BATCHES, BANDS, TARGET_PCT, MIN_WEIGH_G, STRENGTH_TOL_PT } from '../formulaEngine';
import { REAL_ACCORD, RAMP_SALT, ENVELOPE_META } from './accordFixture';

const SALT = RAMP_SALT();
const CTX = {
  element: 'EARTH', phase: 'SMOKE DISSOLUTION',
  periphery: { sol: { inFlight: [], landings: [], lastReleaseErg: 3.2e31, forge: null }, art: { lyapunov: 0.3, lastR: 3.8 } },
};

const build = (over = {}) => buildAccordFormula({ baseAccord: REAL_ACCORD, salt: SALT }, { ...CTX, ...over }, ENVELOPE_META);

function expectInvariants(b, element) {
  expect(b.state).toBe('ok');
  expect(Math.abs(b.actualPct - TARGET_PCT[element])).toBeLessThanOrEqual(STRENGTH_TOL_PT);
  for (const r of b.rows) expect(r.grams).toBeGreaterThanOrEqual(MIN_WEIGH_G - 1e-9);
  for (const c of b.ifra) expect(c.ok).toBe(true);
  expect(b.alcoholGrams).toBeGreaterThanOrEqual(0);
  for (const [k, [lo, hi]] of Object.entries(BANDS)) {
    expect(b.weighedSplit[k]).toBeGreaterThanOrEqual(lo - 0.5);
    expect(b.weighedSplit[k]).toBeLessThanOrEqual(hi + 0.5);
  }
}

describe('buildAccordFormula (P3 ruling 6)', () => {
  it('compiles both batches, each holding the P1 invariants', () => {
    const f = build();
    expect(f.v).toBe(1);
    expect(f.state).toBe('ok');
    expect(f.batches.small.batch).toEqual(BATCHES.small);
    expect(f.batches.large.batch).toEqual(BATCHES.large);
    expectInvariants(f.batches.small, 'EARTH');
    expectInvariants(f.batches.large, 'EARTH');
  });
  it('keeps every note → material mapping, and the envelope meta as given', () => {
    const f = build();
    expect(f.notes).toEqual(REAL_ACCORD.notes);
    expect(f.envelope).toEqual(ENVELOPE_META);
  });
  it('records the modulators that ran, and the log names the readings', () => {
    const f = build();
    expect(f.modulators.element).toBe('EARTH');
    expect(f.modulators.restWeeks).toBe(7);
    expect(f.modulators.solTilt).toBeGreaterThan(0);
    expect(f.sources.lunar).toEqual({ phase: 'SMOKE DISSOLUTION', dryness: 85 });
    expect(f.batches.small.log[2]).toBe('/LUNAR SMOKE DISSOLUTION → 7 weeks in the dark');
    expect(f.batches.small.log[1].startsWith('/SOL last release 3.2e31 erg → ')).toBe(true);
    expect(f.batches.small.log[3].startsWith('/CHAOS λ +0.300 → salt ±')).toBe(true);
  });
  it('is deterministic', () => {
    expect(build()).toEqual(build());
  });
  it('a different salt moves the grams (the salt is a real input)', () => {
    const a = build();
    const b = buildAccordFormula({ baseAccord: REAL_ACCORD, salt: new Uint8Array(32) }, CTX, ENVELOPE_META);
    expect(a.batches.small.rows).not.toEqual(b.batches.small.rows);
  });
  it('an accord the engine cannot satisfy → infeasible batches, no throw', () => {
    const noTop = { ...REAL_ACCORD, rows: REAL_ACCORD.rows.filter((r) => MATERIALS.find((m) => m.id === r.materialId).layer !== 'top') };
    const f = buildAccordFormula({ baseAccord: noTop, salt: SALT }, CTX, ENVELOPE_META);
    expect(f.state).toBe('infeasible');
    expect(f.batches.small).toEqual({ state: 'infeasible', reason: 'accord has no top row', batch: BATCHES.small });
    expect(f.batches.large.state).toBe('infeasible');
  });
  it('the formula carries no trace of the salt', () => {
    const json = JSON.stringify(build());
    expect(json).not.toContain(Buffer.from(SALT).toString('base64'));
    expect(json).not.toContain(Buffer.from(SALT).toString('hex'));
    expect(json).not.toMatch(/"salt"/);
  });
  it('a bad salt is a programmer error and throws', () => {
    expect(() => buildAccordFormula({ baseAccord: REAL_ACCORD, salt: new Uint8Array(4) }, CTX, ENVELOPE_META)).toThrow();
  });
});

describe('a seal outlives a kit revision (final review)', () => {
  it('an accord naming a material the kit no longer holds compiles as infeasible, named — never throws', () => {
    const kit = MATERIALS.filter((m) => m.id !== REAL_ACCORD.rows[0].materialId);
    const f = buildAccordFormula({ baseAccord: REAL_ACCORD, salt: SALT }, CTX, ENVELOPE_META, kit);
    expect(f.state).toBe('infeasible');
    for (const b of Object.values(f.batches)) {
      expect(b.state).toBe('infeasible');
      expect(b.reason).toBe(`the kit no longer holds this accord — material not in kit: ${REAL_ACCORD.rows[0].materialId}`);
    }
    expect(f.notes).toEqual(REAL_ACCORD.notes);
  });
});
