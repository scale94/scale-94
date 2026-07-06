import { describe, it, expect } from 'vitest';
import { SIXTEEN_MINDS } from '../../../data/sixteenMinds';
import { expand, collide } from '../councilCollider';
import { mindEntry, guestEntry, synthesize } from '../councilSynthesis';

const mindByDim = (d) => SIXTEEN_MINDS.find(m => m.dimIndex === d);

function runPair(dA, dB, ordinal = 0) {
  const a = mindEntry(mindByDim(dA));
  const b = mindEntry(mindByDim(dB));
  const result = collide(expand(a.profile), expand(b.profile));
  return synthesize(a, b, result, ordinal);
}

describe('synthesize — determinism & completeness', () => {
  it('same entries + ordinal → identical record content', () => {
    const r1 = runPair(0, 4, 7);
    const r2 = runPair(0, 4, 7);
    expect(JSON.stringify({ ...r1, ts: 0, id: '' })).toBe(JSON.stringify({ ...r2, ts: 0, id: '' }));
  });

  it('produces every section with content for a representative pair', () => {
    const r = runPair(0, 4);
    expect(r.kind).toBe('SYNTHESIS');
    expect(r.v).toBe(1);
    expect(r.sections.sharedGround.fields.length).toBeGreaterThan(0);
    expect(r.sections.frontier.fields.length).toBeGreaterThan(0);
    expect(r.sections.angles.length).toBeGreaterThanOrEqual(2);
    expect(r.sections.angles.length).toBeLessThanOrEqual(4);
    expect(r.sections.openQuestions.length).toBeGreaterThan(0);
    expect(Array.isArray(r.sections.sanctuaries)).toBe(true);
    expect(r.sections.seeds.length).toBeGreaterThanOrEqual(3);
    expect(r.sections.seeds.length).toBeLessThanOrEqual(5);
    expect(typeof r.directive).toBe('string');
    expect(r.directive.length).toBeGreaterThan(40);
    expect(typeof r.line).toBe('string');
  });

  it('metrics carried from collide result + novelty = 1 − cosine', () => {
    const a = mindEntry(mindByDim(2)), b = mindEntry(mindByDim(9));
    const result = collide(expand(a.profile), expand(b.profile));
    const r = synthesize(a, b, result, 0);
    expect(r.metrics.trajectory).toBe(result.trajectory);
    expect(r.metrics.dominantDim).toBe(result.dominantDim);
    expect(r.metrics.novelty).toBeCloseTo(1 - result.cosine, 10);
    expect(r.profiles[0]).toHaveLength(16);
  });

  it('mind fragments appear: at least one seed or angle references thinker text material', () => {
    const r = runPair(0, 15); // Meadows × Raworth — rich text pools
    const corpus = [
      ...r.sections.angles.map(x => x.vector),
      ...r.sections.seeds.map(x => x.text),
    ].join(' ');
    expect(corpus).toMatch(/MEADOWS|RAWORTH|Meadows|Raworth/);
  });

  it('different ordinals vary the seeds deterministically', () => {
    const r1 = runPair(0, 4, 1);
    const r2 = runPair(0, 4, 2);
    expect(r1.sections.seeds.map(s => s.text)).not.toEqual(r2.sections.seeds.map(s => s.text));
  });

  it('equation splice never emits unbalanced-bracket or trailing-colon fragments', () => {
    const r = runPair(13, 14); // Turing × Margulis — punctuated equations
    const splice = r.sections.angles.find(a => a.tag === 'FORMAL SPLICE');
    if (splice) {
      expect(splice.vector).not.toMatch(/[(⟨[{][^)⟩\]}]*\s(against|:)/); // no orphaned opener
      expect(splice.vector).not.toContain('::');
      expect(splice.vector).not.toMatch(/,\s+against/);
    }
  });
});

describe('synthesize — SKS §1 polymorphic guest path', () => {
  it('guest entry with no texts passes through with dim-semantic phrasing', () => {
    const g = guestEntry('PERSONAL KERNEL', new Float32Array(16).fill(0.3).map((v, i) => (i === 6 ? 0.95 : v)));
    const m = mindEntry(mindByDim(4));
    const result = collide(expand(g.profile), expand(m.profile));
    const r = synthesize(g, m, result, 0);
    expect(r.pair[0]).toEqual({ kind: 'guest', label: 'PERSONAL KERNEL' });
    expect(r.pair[1]).toEqual({ kind: 'mind', dimIndex: 4, anchorName: mindByDim(4).anchorName });
    expect(r.sections.sharedGround.fields.length).toBeGreaterThan(0);
    expect(r.sections.seeds.length).toBeGreaterThanOrEqual(3);
    expect(r.directive).toContain('PERSONAL KERNEL');
  });

  it('two guests collide with zero structural modifications', () => {
    const g1 = guestEntry('G1', new Float32Array(16).fill(0.2).map((v, i) => (i < 4 ? 0.9 : v)));
    const g2 = guestEntry('G2', new Float32Array(16).fill(0.2).map((v, i) => (i > 11 ? 0.9 : v)));
    const result = collide(expand(g1.profile), expand(g2.profile));
    expect(() => synthesize(g1, g2, result, 0)).not.toThrow();
  });

  it('all-zero guest profile passes: no crash, seeds >= 3, valid record', () => {
    const g = guestEntry('VOID', new Float32Array(16));
    const m = mindEntry(mindByDim(7));
    const result = collide(expand(g.profile), expand(m.profile));
    const r = synthesize(g, m, result, 0);
    expect(r.sections.seeds.length).toBeGreaterThanOrEqual(3);
    expect(JSON.parse(JSON.stringify(r))).toEqual(JSON.parse(JSON.stringify(r)));
  });
});
