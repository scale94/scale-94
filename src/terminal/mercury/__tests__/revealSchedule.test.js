import { describe, it, expect } from 'vitest';
import { buildReveal, frameAt, FLASH_MS, MAX_FLASHES_PER_S, revealBatchOf } from '../revealSchedule';
import { buildAccordFormula } from '../../scent/accordFormula';
import { buildBaseAccord } from '../../scent/baseAccord';
import { MATERIALS } from '../../scent/materials';
import { NOTE_MATERIALS } from '../../scent/noteInterpretation';
import { buildPerfumeCard, PERF_NOTES } from '../../collider/perfumeCard';
import { FIXTURES } from '../../collider/__tests__/fixtures';
import { ENVELOPE_META } from '../../scent/__tests__/accordFixture';

const CTX = { element: 'EARTH', phase: 'SMOKE DISSOLUTION', periphery: {} };
const formulaFor = (card, salt = new Uint8Array(32)) =>
  buildAccordFormula({ baseAccord: buildBaseAccord(card, NOTE_MATERIALS, MATERIALS), salt }, CTX, ENVELOPE_META);
const REAL = FIXTURES.map((f) => formulaFor(buildPerfumeCard(f.domA, f.domB, f.result)));
const FAMILY = Object.keys(PERF_NOTES.top).map((fam) => formulaFor({
  topNotes: PERF_NOTES.top[fam], heartNotes: PERF_NOTES.heart[fam], baseNotes: PERF_NOTES.base[fam],
}));
const BYTES = Uint8Array.from({ length: ENVELOPE_META.aeadBytes }, (_, i) => (i * 131 + 7) % 256);
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');

function flashOnsets(r) {
  return r.steps.filter((s) => s.flashAt != null).map((s) => s.flashAt);
}
function maxPerWindow(onsets, windowMs = 1000) {
  const t = [...new Set(onsets)].sort((a, b) => a - b);
  let max = 0;
  for (let i = 0; i < t.length; i++) {
    let n = 0;
    for (let j = i; j < t.length && t[j] < t[i] + windowMs; j++) n++;
    max = Math.max(max, n);
  }
  return max;
}

describe('buildReveal', () => {
  const f = REAL[0];
  const r = buildReveal({ formula: f, aeadBytes: BYTES });

  it('the header names the primitives and the real byte counts', () => {
    expect(r.header).toBe(`ENVELOPE · ML-KEM-768 CT (${ENVELOPE_META.ctBytes} B) · AES-256-GCM · ${ENVELOPE_META.aeadBytes} B`);
    expect(r.steps[0]).toMatchObject({ kind: 'header', text: r.header, at: 0 });
  });

  it('order: header, ACCORD UNSEALED, notes with their rows, modulator lines, FORMULA MODULATED', () => {
    const kinds = r.steps.map((s) => s.kind);
    expect(kinds[0]).toBe('header');
    expect(r.steps[1]).toMatchObject({ kind: 'stage', text: 'ACCORD UNSEALED' });
    expect(r.steps.at(-1)).toMatchObject({ kind: 'stage', text: 'FORMULA MODULATED' });
    const firstMod = kinds.indexOf('mod');
    expect(kinds.lastIndexOf('row')).toBeLessThan(firstMod);
    expect(r.steps.filter((s) => s.kind === 'mod').map((s) => s.text)).toEqual(revealBatchOf(f).log);
    for (let i = 1; i < r.steps.length; i++) expect(r.steps[i].at).toBeGreaterThanOrEqual(r.steps[i - 1].at);
  });

  it('every weighed row appears exactly once; a material under two notes is a ref the second time', () => {
    const rows = r.steps.filter((s) => s.kind === 'row');
    const batch = revealBatchOf(f);
    expect(rows.map((s) => s.materialId).sort()).toEqual(batch.rows.map((x) => x.materialId).sort());
    const refs = r.steps.filter((s) => s.kind === 'ref');
    for (const ref of refs) {
      expect(ref.text).toBe(`↳ ${ref.name} (above)`);
      const rowIdx = r.steps.findIndex((s) => s.kind === 'row' && s.materialId === ref.materialId);
      expect(rowIdx).toBeLessThan(r.steps.indexOf(ref));
    }
    expect(refs.length).toBeGreaterThan(0);
  });

  it('rows carry the formula values verbatim', () => {
    const batch = revealBatchOf(f);
    for (const s of r.steps.filter((x) => x.kind === 'row')) {
      const row = batch.rows.find((x) => x.materialId === s.materialId);
      expect(s).toMatchObject({ name: row.name, value: `${row.grams.toFixed(2)} g`, layer: row.layer, cas: row.cas, stock: row.stock });
    }
  });

  it('row i of n resolves out of its own slice of aead_ct; the slices tile it', () => {
    const rows = r.steps.filter((s) => s.kind === 'row');
    const n = rows.length;
    const L = BYTES.length;
    rows.forEach((s, i) => {
      expect(s.bytesHex).toBe(hex(BYTES.slice(Math.floor((i * L) / n), Math.floor(((i + 1) * L) / n))));
    });
    expect(rows.map((s) => s.bytesHex).join('')).toBe(hex(BYTES));
  });

  it('flashes last FLASH_MS', () => {
    expect(FLASH_MS).toBe(80);
    const s = r.steps.find((x) => x.flashAt != null);
    expect(frameAt(r, s.flashAt).get(s).flashing).toBe(true);
    expect(frameAt(r, s.flashAt + FLASH_MS - 1).get(s).flashing).toBe(true);
    expect(frameAt(r, s.flashAt + FLASH_MS).get(s).flashing).toBe(false);
    expect(frameAt(r, s.flashAt - 1).get(s).flashing).toBe(false);
  });

  it('a row resolves left to right: a growing prefix of name + value, the rest from its bytes', () => {
    const s = r.steps.find((x) => x.kind === 'row');
    const full = s.name + s.value;
    let prev = -1;
    for (let t = s.at; t <= s.at + s.sweepMs; t += 10) {
      const fr = frameAt(r, t).get(s);
      expect(fr.resolvedChars).toBeGreaterThanOrEqual(prev);
      prev = fr.resolvedChars;
      expect(fr.chars.slice(0, fr.resolvedChars)).toBe(full.slice(0, fr.resolvedChars));
      for (let i = fr.resolvedChars; i < full.length; i++) expect(fr.chars[i]).toBe(s.bytesHex[i % s.bytesHex.length]);
    }
    expect(frameAt(r, s.at + s.sweepMs).get(s).resolvedChars).toBe(full.length);
    expect(frameAt(r, s.at - 1).get(s).shown).toBe(false);
  });

  it('the flash lands when the grams land, on at most the last four characters', () => {
    for (const s of r.steps.filter((x) => x.kind === 'row')) {
      expect(s.flashAt).toBe(s.at + s.sweepMs);
      expect(s.flashChars).toBe(Math.min(4, s.value.length));
    }
  });

  it('frameAt past the end shows everything resolved and nothing flashing', () => {
    const fr = frameAt(r, r.totalMs + 1000);
    for (const s of r.steps) {
      expect(fr.get(s).shown).toBe(true);
      expect(fr.get(s).flashing).toBe(false);
      if (s.kind === 'row') expect(fr.get(s).resolvedChars).toBe((s.name + s.value).length);
    }
  });
});

// Review Focus 5
describe('flash limit (WCAG 2.3.1)', () => {
  it.each([...REAL.map((f, i) => [`fixture ${i}`, f]), ...FAMILY.map((f, i) => [`family ${i}`, f])])(
    '%s: never more than 3 flash onsets in any 1 s window',
    (_, f) => {
      const r = buildReveal({ formula: f, aeadBytes: BYTES });
      expect(MAX_FLASHES_PER_S).toBe(3);
      expect(maxPerWindow(flashOnsets(r))).toBeLessThanOrEqual(3);
    },
  );

  it('a 40-note stress accord holds the limit too', () => {
    const f = FAMILY[0];
    const notes = Array.from({ length: 40 }, (_, i) => ({ ...f.notes[i % f.notes.length], note: `n${i}` }));
    const r = buildReveal({ formula: { ...f, notes }, aeadBytes: BYTES });
    expect(maxPerWindow(flashOnsets(r))).toBeLessThanOrEqual(3);
  });

  it('every fixture card adds 3–6 s', () => {
    for (const f of REAL) {
      const { totalMs } = buildReveal({ formula: f, aeadBytes: BYTES });
      expect(totalMs).toBeGreaterThanOrEqual(3000);
      expect(totalMs).toBeLessThanOrEqual(6000);
    }
  });

  it('reduced motion: zero time, zero flashes, everything resolved at t = 0', () => {
    const r = buildReveal({ formula: REAL[0], aeadBytes: BYTES, reducedMotion: true });
    expect(r.totalMs).toBe(0);
    expect(flashOnsets(r)).toEqual([]);
    const fr = frameAt(r, 0);
    for (const s of r.steps) {
      expect(fr.get(s).shown).toBe(true);
      expect(fr.get(s).flashing).toBe(false);
      if (s.kind === 'row') expect(fr.get(s).resolvedChars).toBe((s.name + s.value).length);
    }
  });
});

describe('edge cases', () => {
  it('small infeasible, large ok → the reveal shows the large batch', () => {
    const f = { ...REAL[0], batches: { small: { state: 'infeasible', reason: 'x', batch: { grams: 7, vialMl: 10 } }, large: REAL[0].batches.large } };
    expect(revealBatchOf(f)).toBe(REAL[0].batches.large);
  });

  it('both infeasible → notes, then the named infeasible line; no rows, no flash', () => {
    const inf = (g) => ({ state: 'infeasible', reason: 'accord has no top row', batch: { grams: g, vialMl: 10 } });
    const f = { ...REAL[0], state: 'infeasible', batches: { small: inf(7), large: inf(10) } };
    const r = buildReveal({ formula: f, aeadBytes: BYTES });
    expect(r.steps.some((s) => s.kind === 'row')).toBe(false);
    expect(flashOnsets(r)).toEqual([]);
    expect(r.steps.find((s) => s.kind === 'mod').text).toBe('FORMULA INFEASIBLE — accord has no top row');
  });

  it('fewer bytes than rows: an empty slice resolves out of a dot, never invented bytes', () => {
    const r = buildReveal({ formula: REAL[0], aeadBytes: new Uint8Array(2) });
    const empty = r.steps.filter((s) => s.kind === 'row' && s.bytesHex === '');
    expect(empty.length).toBeGreaterThan(0);
    const s = empty[0];
    expect(frameAt(r, s.at).get(s).chars[0]).toBe('·');
  });
});
