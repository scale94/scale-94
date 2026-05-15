import { describe, it, expect } from 'vitest';
import { buildChimeraGlyph } from '../src/terminal/views/chimeraGlyph.js';

const SAMPLE_DIMS = {
  convergence: [
    { name: 'nonlinearity', contrib: 0.7 },
    { name: 'criticality',  contrib: 0.5 },
  ],
  divergence: [
    { name: 'temporal', delta: 0.6 },
  ],
  paradoxes: [
    { name: 'spatial', residual: 0.3 },
  ],
};

describe('buildChimeraGlyph', () => {
  it('returns an SVG string with viewBox 0 0 240 240', () => {
    const svg = buildChimeraGlyph({
      accordHash: 'a'.repeat(64),
      dims: SAMPLE_DIMS, hueA: 200, hueB: 320,
      viability: 5, nodeClass: 'RTA',
    });
    expect(svg).toMatch(/<svg[^>]*viewBox="0 0 240 240"/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('embeds the last 8 chars of hash as a stamp', () => {
    const svg = buildChimeraGlyph({
      accordHash: '1234567890abcdef'.repeat(4),
      dims: SAMPLE_DIMS, hueA: 100, hueB: 200,
      viability: 5, nodeClass: 'RTA',
    });
    expect(svg).toContain('90ABCDEF');
  });

  it('is deterministic — same hash always produces same SVG', () => {
    const args = {
      accordHash: 'deadbeef'.repeat(8),
      dims: SAMPLE_DIMS, hueA: 100, hueB: 200,
      viability: 5, nodeClass: 'DPA',
    };
    expect(buildChimeraGlyph(args)).toBe(buildChimeraGlyph(args));
  });

  it('produces different SVGs for different hashes', () => {
    const baseArgs = { dims: SAMPLE_DIMS, hueA: 100, hueB: 200, viability: 5, nodeClass: 'RTA' };
    const a = buildChimeraGlyph({ ...baseArgs, accordHash: 'a'.repeat(64) });
    const b = buildChimeraGlyph({ ...baseArgs, accordHash: 'b'.repeat(64) });
    expect(a).not.toBe(b);
  });

  it('uses 3-pointed star for RTA, 4 for DPA, 5 for R2A', () => {
    const args = { accordHash: '00'.repeat(32), dims: SAMPLE_DIMS, hueA: 0, hueB: 0, viability: 5 };
    const rta = buildChimeraGlyph({ ...args, nodeClass: 'RTA' });
    const dpa = buildChimeraGlyph({ ...args, nodeClass: 'DPA' });
    const r2a = buildChimeraGlyph({ ...args, nodeClass: 'R2A' });
    // Count the polygon points attribute lengths as a proxy
    const countPoints = svg => (svg.match(/<polygon[^>]*points="([^"]+)"/)?.[1] || '').split(/\s+/).length;
    expect(countPoints(rta)).toBe(3);
    expect(countPoints(dpa)).toBe(4);
    expect(countPoints(r2a)).toBe(5);
  });
});
