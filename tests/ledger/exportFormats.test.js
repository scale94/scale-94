import { describe, it, expect } from 'vitest';
import { generateJsonLd, generateEmbedHtml } from '../../src/terminal/ledger/exportFormats';

const MOCK_VERDICT = {
  hash: 'a7f3c9002e81d4aabbccdd',
  status: 'EMERGENCY_VETO',
  coordinates: { lat: 48.2082, lon: 16.3738 },
  dependency: 'external',
  kernelId: 'CHRONO-ACTUARY-KERNEL-2.0',
  timestamp: '2027-06-14T09:31:22Z',
  input: { temp: 24.3, do: 4.1, bod: 22, dt: 6, epi: 0.8, nitrate: 14, flow: 0.08 },
  ruling: 'Thermal rent exceeds biocapacity.',
  audit: { status: 'EMERGENCY_VETO' },
};

describe('generateJsonLd', () => {
  it('produces valid JSON-LD structure', () => {
    const ld = generateJsonLd(MOCK_VERDICT);
    const parsed = JSON.parse(ld);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('Dataset');
    expect(parsed.name).toContain('EMERGENCY_VETO');
    expect(parsed.identifier).toBe(MOCK_VERDICT.hash);
    expect(parsed.spatialCoverage.geo.latitude).toBe(48.2082);
  });
});

describe('generateEmbedHtml', () => {
  it('produces an HTML snippet with verdict data', () => {
    const html = generateEmbedHtml(MOCK_VERDICT);
    expect(html).toContain('EMERGENCY_VETO');
    expect(html).toContain('48.2082');
    expect(html).toContain(MOCK_VERDICT.hash.slice(0, 12));
  });
});
