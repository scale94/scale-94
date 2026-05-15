import { describe, it, expect } from 'vitest';
import { __test__ } from '../src/terminal/hooks/useColliderNarrative.js';

const { detectArchetype } = __test__;

describe('detectArchetype', () => {
  it('returns null when convergence is empty', () => {
    expect(detectArchetype([])).toBeNull();
    expect(detectArchetype(null)).toBeNull();
  });

  it('returns a pair archetype when only 2 strong dims present', () => {
    const conv = [
      { name: 'nonlinearity', contrib: 0.5 },
      { name: 'criticality',  contrib: 0.4 },
    ];
    const result = detectArchetype(conv);
    expect(result.kind).toBe('pair');
    expect(result.label).toBe('BIFURCATION CASCADE');
  });

  it('returns a trinity archetype when all 3 dims are substantively present', () => {
    const conv = [
      { name: 'nonlinearity',   contrib: 0.6 },
      { name: 'criticality',    contrib: 0.5 },
      { name: 'dimensionality', contrib: 0.4 },
    ];
    const result = detectArchetype(conv);
    expect(result.kind).toBe('trinity');
    expect(result.label).toBe('HIGH-D BIFURCATION CASCADE');
  });

  it('falls back to pair when the third trinity dim is too weak', () => {
    // Third dim contrib (0.05) is below 0.6 * avg(0.6, 0.5) = 0.33, so trinity is filtered out
    const conv = [
      { name: 'nonlinearity',   contrib: 0.6 },
      { name: 'criticality',    contrib: 0.5 },
      { name: 'dimensionality', contrib: 0.05 },
    ];
    const result = detectArchetype(conv);
    expect(result.kind).toBe('pair');
  });

  it('falls back to pair when only 2 of 3 trinity dims are present', () => {
    const conv = [
      { name: 'nonlinearity', contrib: 0.6 },
      { name: 'criticality',  contrib: 0.5 },
      // 'dimensionality' missing entirely
    ];
    const result = detectArchetype(conv);
    expect(result.kind).toBe('pair');
  });
});

describe('buildPromptFragments metric injection', () => {
  it('passes metrics object to template functions', () => {
    const { buildPromptFragments } = __test__;
    const archetype = { kind: 'pair', label: 'BIFURCATION CASCADE', thesis: '', dims: ['nonlinearity','criticality'] };
    const result = {
      novelty: 0.6, coherence: 0.4, viability: 5.0,
      turbulence: 0.08, catalysis: 0.1, resonanceFreq: 0.3,
      convergence: [{ name: 'nonlinearity', contrib: 0.5, delta: 0.1 }],
      divergence: [{ name: 'temporal', delta: 0.87 }],
      paradoxes: [{ name: 'spatial', residual: 0.42 }],
    };
    const frags = buildPromptFragments(archetype, result, 'Cosmology', 'Music');
    // Find the turbulence fragment — it now reads delta from m
    const turb = frags.find(f => f.source === 'TURBULENCE');
    expect(turb).toBeTruthy();
    // Should reference daughter-concept count derived from turbulence
    expect(turb.text).toMatch(/\d+ daughter concepts/);
  });
});
