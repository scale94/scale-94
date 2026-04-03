import { describe, it, expect } from 'vitest';
import { createVerdict, hashVerdict, validateSubmission, parseKernelOutput } from '../../src/terminal/ledger/verdictModel';

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

describe('parseKernelOutput', () => {
  const SAMPLE_OUTPUT = `ᛟ CHRONO-ACTUARY v2.0.0 // BOOT_OK
OFFICE OF THE RIVER SOVEREIGN · DEEP-TIME AUDIT BUREAU

── MODULE 01 · DISSOLVED OXYGEN LEDGER ────────────────────
TEMP: 15.0°C  DO_SAT: 10.08 mg/L  DO_MIN: 7.23 mg/L
K_d: 0.2300/day  K_r: 0.4000/day  T_CRIT: 2.41 days
STATUS: INFLATION_WARNING  [⚠ AMBER]

── MODULE 02 · THERMAL RENT ────────────────────────────────
ΔT_PROJECT: +2.0°C  BOD×Q10: ×1.149  LICENSE: 30 yr
EOL_CLIMATE: +1.80°C (IPCC RCP8.5)  EOL_TOTAL: +3.80°C
STATUS: THERMAL_STRESS  [⚠ AMBER]

── MODULE 03 · NUTRIENT DEBT ───────────────────────────────
EPI: 0.800  →  WITHIN_CAPACITY  [✓ GREEN]
NITRATE-N: 2.00 mg/L  →  MESOTROPHIC  [✓ GREEN]

── MODULE 04 · HYDRAULIC SOVEREIGNTY ──────────────────────
FLOW_RATIO: 0.400 Q/Qmean  STATUS: VIABLE_HABITAT  [⚠ AMBER]

── MODULE 05 · LANGELIER SATURATION INDEX ──────────────────
LSI: 0.100  STATUS: CARBONATE_EQUILIBRIUM  [✓ GREEN]

── FISCAL LEDGER ───────────────────────────────────────────
HUMAN_PROFIT:         1000000 EUR
DO_DEBT:                    0 EUR
THERMAL_DEBT:          160000 EUR
NUTRIENT_DEBT:              0 EUR
FLOOD_LIABILITY:            0 EUR
ECO_TOTAL:             160000 EUR
NPV_TRUE:        SOLVENT  +840000 EUR

── RULING ──────────────────────────────────────────────────
Approved with binding mitigation schedule. Non-compliance triggers automatic downgrade to REJECTED. The Sovereign monitors.
PERMIT: [CONDITIONAL]

SOURCE: content/rust_kernels/src/kernels/chrono_actuary.rs`;

  it('extracts 5 module statuses', () => {
    const parsed = parseKernelOutput(SAMPLE_OUTPUT);
    expect(parsed.modules).toHaveLength(5);
    expect(parsed.modules[0].signal).toBe('AMBER');
    expect(parsed.modules[1].signal).toBe('AMBER');
    expect(parsed.modules[2].signal).toBe('GREEN');
    expect(parsed.modules[3].signal).toBe('AMBER');
    expect(parsed.modules[4].signal).toBe('GREEN');
  });

  it('extracts computed values', () => {
    const parsed = parseKernelOutput(SAMPLE_OUTPUT);
    expect(parsed.modules[0].values.DO_MIN).toBeCloseTo(7.23);
    expect(parsed.modules[0].values.DO_SAT).toBeCloseTo(10.08);
  });

  it('extracts fiscal data', () => {
    const parsed = parseKernelOutput(SAMPLE_OUTPUT);
    expect(parsed.fiscal.ECO_TOTAL).toBe(160000);
    expect(parsed.fiscal.HUMAN_PROFIT).toBe(1000000);
  });

  it('extracts permit code', () => {
    const parsed = parseKernelOutput(SAMPLE_OUTPUT);
    expect(parsed.permit).toBe('CONDITIONAL');
  });

  it('returns empty structure for garbage input', () => {
    const parsed = parseKernelOutput('nothing useful');
    expect(parsed.modules).toHaveLength(0);
    expect(parsed.permit).toBe('UNKNOWN');
  });
});
