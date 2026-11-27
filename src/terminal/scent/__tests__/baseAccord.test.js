import { describe, it, expect } from 'vitest';
import { buildBaseAccord, drawChaosSalt } from '../baseAccord';
import { computeFormula, BATCHES, TARGET_PCT, MIN_WEIGH_G } from '../formulaEngine';
import { FX_KIT, FX_NOTE_MATERIALS } from './kitFixture';
import { buildPerfumeCard } from '../../collider/perfumeCard';
import { FIXTURES } from '../../collider/__tests__/fixtures';

const F = FIXTURES[0];
const card = buildPerfumeCard(F.domA, F.domB, F.result);
const cardNotes = [...card.topNotes, ...card.heartNotes, ...card.baseNotes];
const rowParts = (acc, id) => acc.rows.find((r) => r.materialId === id)?.parts;

describe('buildBaseAccord', () => {
  it('every card note appears in notes, in card order, with its card layer', () => {
    const acc = buildBaseAccord(card, FX_NOTE_MATERIALS, FX_KIT);
    expect(acc.notes.map((n) => n.note)).toEqual(cardNotes);
    expect(acc.notes.map((n) => n.cardLayer)).toEqual(
      ['top', 'top', 'heart', 'heart', 'base', 'base']);
  });

  it('a note mapping to 2 materials at parts 3:1 contributes 0.75 / 0.25', () => {
    const acc = buildBaseAccord(card, FX_NOTE_MATERIALS, FX_KIT);
    const n = acc.notes.find((x) => x.note === 'Pink Grapefruit');
    expect(n.materials).toEqual([
      { materialId: 'fx-top-glint', parts: 0.75 },
      { materialId: 'fx-top-hush', parts: 0.25 },
    ]);
    expect(rowParts(acc, 'fx-top-glint')).toBeCloseTo(0.75, 12);
  });

  it('two notes mapping to the same material → one row, parts summed', () => {
    const acc = buildBaseAccord(card, FX_NOTE_MATERIALS, FX_KIT);
    expect(acc.rows.filter((r) => r.materialId === 'fx-heart-bloom')).toHaveLength(1);
    expect(rowParts(acc, 'fx-heart-bloom')).toBeCloseTo(1.5, 12); // 1 + 0.5
    expect(rowParts(acc, 'fx-base-root')).toBeCloseTo(1 + 2 / 3, 12);
    const total = acc.rows.reduce((s, r) => s + r.parts, 0);
    expect(total).toBeCloseTo(cardNotes.length, 12);
  });

  it('rows are in first-appearance order', () => {
    const acc = buildBaseAccord(card, FX_NOTE_MATERIALS, FX_KIT);
    expect(acc.rows.map((r) => r.materialId)).toEqual([
      'fx-top-glint', 'fx-top-hush', 'fx-top-spark', 'fx-heart-bloom',
      'fx-heart-veil', 'fx-base-root', 'fx-base-amber',
    ]);
  });

  it('unmapped note throws Error naming the note', () => {
    const { Cistus, ...rest } = FX_NOTE_MATERIALS; // eslint-disable-line no-unused-vars
    expect(() => buildBaseAccord(card, rest, FX_KIT)).toThrow(/Cistus/);
  });

  it('materialId missing from kit throws Error naming it', () => {
    const bad = { ...FX_NOTE_MATERIALS, Cistus: [{ materialId: 'fx-nope', parts: 1 }] };
    expect(() => buildBaseAccord(card, bad, FX_KIT)).toThrow(/fx-nope/);
  });

  it.each([0, -1, NaN, Infinity, '2'])('parts %s throws', (parts) => {
    const bad = { ...FX_NOTE_MATERIALS, Cistus: [{ materialId: 'fx-top-spark', parts }] };
    expect(() => buildBaseAccord(card, bad, FX_KIT)).toThrow(/Cistus/);
  });

  it('an empty mapping throws', () => {
    expect(() => buildBaseAccord(card, { ...FX_NOTE_MATERIALS, Cistus: [] }, FX_KIT))
      .toThrow(/Cistus/);
  });

  it('does not mutate its inputs', () => {
    const before = JSON.stringify(FX_NOTE_MATERIALS);
    buildBaseAccord(card, FX_NOTE_MATERIALS, FX_KIT);
    expect(JSON.stringify(FX_NOTE_MATERIALS)).toBe(before);
  });
});

describe('output feeds computeFormula', () => {
  const acc = buildBaseAccord(card, FX_NOTE_MATERIALS, FX_KIT);
  const CASES = ['AIR', 'WATER', 'EARTH', 'FIRE'].flatMap((el) =>
    Object.keys(BATCHES).map((b) => [el, b]));

  it.each(CASES)('%s/%s holds the Task 1 invariants', (element, batchName) => {
    const batch = BATCHES[batchName];
    const f = computeFormula({
      baseAccord: acc, salt: new Uint8Array(32),
      modulators: { element, restWeeks: 4 }, batch, kit: FX_KIT,
    });
    expect(Math.abs(f.actualPct - TARGET_PCT[element])).toBeLessThanOrEqual(0.5);
    const total = f.rows.reduce((s, r) => s + r.grams, 0) + f.alcoholGrams;
    expect(Math.abs(total - batch.grams)).toBeLessThan(0.005);
    for (const r of f.rows) expect(r.grams).toBeGreaterThanOrEqual(MIN_WEIGH_G);
    expect(f.ifra.length).toBeGreaterThan(0);
    for (const e of f.ifra) expect(e.ok).toBe(true);
    for (const l of ['top', 'heart', 'base']) {
      expect(f.rows.some((r) => r.layer === l)).toBe(true);
    }
  });
});

describe('drawChaosSalt', () => {
  it('returns 32 bytes drawn from the injected RNG', () => {
    const salt = drawChaosSalt((a) => a.fill(7));
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(32);
    expect(salt.every((x) => x === 7)).toBe(true);
  });
});
