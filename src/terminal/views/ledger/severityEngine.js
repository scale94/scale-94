// severityEngine.js — continuous severity math for all Ledger visualizations
// Severity: 0 = perfectly safe, 1 = maximally critical
// Used by: RiverPulse, SubmissionForm severity dots, AuditCascade

const PARAM_KEYS = ['temp', 'do', 'bod', 'dt', 'epi', 'nitrate', 'flow'];

// Params where HIGHER value = HEALTHIER (inverted severity)
const INVERTED = new Set(['do', 'flow']);

// Per-parameter safe ceilings (value at which severity ≈ 1.0)
// Tuned to match the Rust kernel's threshold logic
const CEILINGS = {
  temp:    45,
  do:      14,   // inverted: severity = 1 - v/14
  bod:     60,
  dt:      10,
  epi:     8,
  nitrate: 50,
  flow:    60,   // inverted: severity = 1 - v/60
};

export function paramSeverity(key, value) {
  if (value === null || value === undefined || isNaN(Number(value))) return 0;
  const v = Number(value);
  const ceil = CEILINGS[key];
  if (!ceil) return 0;

  if (INVERTED.has(key)) {
    return Math.max(0, Math.min(1, 1 - v / ceil));
  }
  return Math.max(0, Math.min(1, v / ceil));
}

export function discreteSeverity(continuous) {
  if (continuous < 0.4) return 'safe';
  if (continuous < 0.7) return 'stress';
  return 'critical';
}

export function aggregateHealth(params) {
  let sum = 0;
  let count = 0;
  for (const key of PARAM_KEYS) {
    const v = params[key];
    if (v !== undefined && v !== null && v !== '' && !isNaN(Number(v))) {
      sum += paramSeverity(key, Number(v));
      count++;
    }
  }
  if (count === 0) return 50; // neutral when no data
  const avgSeverity = sum / count;
  return Math.round(100 * (1 - avgSeverity));
}

export { PARAM_KEYS };
