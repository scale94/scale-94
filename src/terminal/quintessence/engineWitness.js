// src/terminal/quintessence/engineWitness.js — adapter over the compiled
// Fish Scale engine (spec §3.5). One source of truth: bifurcation math lives
// in WASM (run_fish_scale_json) — never reimplement it here. The JS constant
// below exists only for calibration and offline bpm fallback.
import { loadWasm } from '../../wasm/wasmSingleton';

// Feigenbaum point r_∞ — byte-identical to R_INF in fish_scale.rs (the
// engine this adapter fronts). useAssociativeField.js carries a slightly
// different truncation (…70944); the Rust engine's value is canonical here.
// bpm 160 (the Plata threshold) sits exactly at this r.
export const R_CHAOS = 3.569945671877;

const THETA_FSK = 36.0; // canonical interlaminar angle, not visitor-varied in v1

export function trendToPressure(velocity) {
  const v = Math.min(1, Math.max(0, Number(velocity) || 0));
  return 2.8 + 1.2 * v; // the interesting band of the logistic map
}

export function pressureToBpm(r) {
  return Math.round(160 * (r / R_CHAOS));
}

/**
 * Calls the compiled engine. Returns normalized witness or null (engine
 * offline — the artifact then compiles its engine_witness houses as None).
 */
export async function witnessEngine({ rPressure, maxLayers, burnSensitivity }) {
  try {
    const r = Number(rPressure), lay = Number(maxLayers), burn = Number(burnSensitivity);
    if (!Number.isFinite(r) || !Number.isFinite(lay) || !Number.isFinite(burn)) return null;
    const mod = await loadWasm();
    if (typeof mod?.run_fish_scale_json !== 'function') return null;
    const raw = mod.run_fish_scale_json(r, lay, THETA_FSK, burn);
    const j = JSON.parse(raw);
    return {
      regime: j.regime,
      integrity: j.integrity,
      lyapunov: j.lyapunov,
      axiomsActive: j.axioms_active,
      inSanctuary: j.in_sanctuary,
      armorDensity: j.armor_density,
      layers: j.layers,
      burnStatus: j.saponification?.status ?? null,
    };
  } catch (err) {
    if (import.meta.env?.DEV) console.debug('[quintessence] engine witness unavailable:', err);
    return null;
  }
}
