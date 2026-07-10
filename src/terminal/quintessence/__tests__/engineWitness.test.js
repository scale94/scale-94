import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadWasmMock = vi.fn();
vi.mock('../../../wasm/wasmSingleton', () => ({ loadWasm: (...a) => loadWasmMock(...a) }));

import { trendToPressure, pressureToBpm, R_CHAOS, witnessEngine } from '../engineWitness';

describe('trendToPressure', () => {
  it('is monotone and bounded to [2.8, 4.0]', () => {
    expect(trendToPressure(0)).toBeCloseTo(2.8);
    expect(trendToPressure(1)).toBeCloseTo(4.0);
    expect(trendToPressure(0.5)).toBeGreaterThan(trendToPressure(0.2));
    expect(trendToPressure(-5)).toBeCloseTo(2.8);   // clamped
    expect(trendToPressure(99)).toBeCloseTo(4.0);   // clamped
  });
});

describe('pressureToBpm', () => {
  it('calibrates 160 exactly at chaos onset (spec §3.5)', () => {
    expect(pressureToBpm(R_CHAOS)).toBe(160);
    expect(pressureToBpm(R_CHAOS - 0.1)).toBeLessThan(160);   // Plomo side
    expect(pressureToBpm(4.0)).toBeGreaterThanOrEqual(160);   // Plata side
  });
});

describe('witnessEngine', () => {
  beforeEach(() => loadWasmMock.mockReset());

  it('normalizes a JSON result from run_fish_scale_json', async () => {
    loadWasmMock.mockResolvedValue({
      run_fish_scale_json: (r, layers, theta, burn) => JSON.stringify({
        regime: 'ARMOR_DENSE_CHAOS', integrity: 87.5, lyapunov: 0.42,
        axioms_active: 7, in_sanctuary: false, armor_density: 1.61, layers: 12,
        saponification: { status: 'POST-WINDOW — full chaos regime. Burn grip dissolves into noise.' },
      }),
    });
    const w = await witnessEngine({ rPressure: 3.8, maxLayers: 12, burnSensitivity: 0.85 });
    expect(w).toEqual({
      regime: 'ARMOR_DENSE_CHAOS', integrity: 87.5, lyapunov: 0.42,
      axiomsActive: 7, inSanctuary: false, armorDensity: 1.61, layers: 12,
      burnStatus: 'POST-WINDOW — full chaos regime. Burn grip dissolves into noise.',
    });
  });

  it('returns null when the module lacks the export (stale wasm)', async () => {
    loadWasmMock.mockResolvedValue({});
    expect(await witnessEngine({ rPressure: 3, maxLayers: 4, burnSensitivity: 1 })).toBeNull();
  });

  it('returns null when WASM init rejects (engine offline, spec §7)', async () => {
    // mockRejectedValueOnce (not mockRejectedValue): on this toolchain (vitest 4.1.2 /
    // Node 24.11.1) a bare mockRejectedValue's Promise.reject(...) is reported as a
    // false-positive "unhandled rejection" test failure even though witnessEngine's
    // own try/catch demonstrably handles it (verified via manual instrumentation) —
    // a reproducible tinyspy/vitest timing quirk independent of this file's code.
    // The Once-variant sidesteps the false positive with identical observable behavior.
    loadWasmMock.mockRejectedValueOnce(new Error('no wasm'));
    expect(await witnessEngine({ rPressure: 3, maxLayers: 4, burnSensitivity: 1 })).toBeNull();
  });
});
