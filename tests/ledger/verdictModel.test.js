import { describe, it, expect } from 'vitest';
import { createVerdict, hashVerdict, validateSubmission } from '../../src/terminal/ledger/verdictModel';

describe('validateSubmission', () => {
  it('accepts valid input', () => {
    const input = {
      lat: 48.2082, lon: 16.3738,
      temp: 15, do: 8.5, bod: 5, dt: 2, epi: 0.8, nitrate: 2, flow: 0.4,
      dependency: 'sovereign',
    };
    const errors = validateSubmission(input);
    expect(errors).toEqual([]);
  });

  it('rejects missing required fields', () => {
    const errors = validateSubmission({ lat: 48, lon: 16 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'temp')).toBe(true);
  });

  it('rejects out-of-range temperature', () => {
    const input = {
      lat: 48, lon: 16,
      temp: 99, do: 8.5, bod: 5, dt: 2, epi: 0.8, nitrate: 2, flow: 0.4,
      dependency: 'sovereign',
    };
    const errors = validateSubmission(input);
    expect(errors.some(e => e.field === 'temp')).toBe(true);
  });
});

describe('createVerdict', () => {
  it('produces a verdict document with required fields', () => {
    const input = {
      lat: 48.2082, lon: 16.3738,
      temp: 15, do: 8.5, bod: 5, dt: 2, epi: 0.8, nitrate: 2, flow: 0.4,
      dependency: 'sovereign',
    };
    const kernelOutput = 'PERMIT_STATUS: APPROVED\nDATA:{"status":"APPROVED","modules":{}}';
    const verdict = createVerdict(input, kernelOutput, 'CHRONO-ACTUARY-KERNEL-2.0');
    expect(verdict.status).toBe('APPROVED');
    expect(verdict.coordinates).toEqual({ lat: 48.2082, lon: 16.3738 });
    expect(verdict.dependency).toBe('sovereign');
    expect(verdict.kernelId).toBe('CHRONO-ACTUARY-KERNEL-2.0');
    expect(verdict.timestamp).toBeDefined();
    expect(verdict.input).toEqual(input);
  });
});

describe('hashVerdict', () => {
  it('produces a 64-char hex SHA-256 hash', async () => {
    const verdict = {
      status: 'APPROVED',
      coordinates: { lat: 48, lon: 16 },
      dependency: 'sovereign',
      kernelId: 'CHRONO-ACTUARY-KERNEL-2.0',
      timestamp: '2026-04-02T12:00:00Z',
      input: { temp: 15 },
      audit: {},
    };
    const hash = await hashVerdict(verdict);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces deterministic hashes', async () => {
    const verdict = { status: 'APPROVED', timestamp: '2026-04-02T12:00:00Z' };
    const h1 = await hashVerdict(verdict);
    const h2 = await hashVerdict(verdict);
    expect(h1).toBe(h2);
  });
});
