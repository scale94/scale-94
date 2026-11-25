// ledgerSeverity.js — one 0..1 pollution severity for an audit, read from the audit itself
// (the kernel's verdict tier + the submitted hydrology), never from a preset id: a manual
// run scales exactly like a preset. Drives the masthead eye's murk (eyeReactions ledgerMurk).
//
// The tier dominates (it is the kernel's ruling); the pollution load shades within it, so two
// REJECTED rivers still differ. An unknown tier falls back to the load alone.
import { paramSeverity } from './severityEngine';

export const TIER_SEVERITY = { APPROVED: 0.05, CONDITIONAL: 0.4, REJECTED: 0.65, EMERGENCY_VETO: 1 };

// The pollution terms of the audit (severityEngine's per-parameter curves): dissolved-oxygen
// deficit, BOD load, nitrate (Redfield's nutrient debt), thermal discharge delta.
const LOAD = [['do', 0.3], ['bod', 0.3], ['nitrate', 0.25], ['dt', 0.15]];

export function pollutionLoad(input) {
  let s = 0;
  for (const [key, w] of LOAD) s += w * paramSeverity(key, input?.[key]);
  return Math.min(1, Math.max(0, s));
}

export function auditSeverity(verdict) {
  const load = pollutionLoad(verdict?.input);
  const tier = TIER_SEVERITY[verdict?.status];
  const s = tier == null ? load : 0.7 * tier + 0.3 * load;
  return Math.min(1, Math.max(0, s));
}
