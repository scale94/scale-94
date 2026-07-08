// Panopticon Index — the formula's single home (spec §1).
// Σ(sev²) / (n × 25) × 100, clamped to 100. Accepts both the legislation
// corpus shape ({severity: '3'}, string) and the privacy VECTORS shape
// ({sev: 2}, number). SurveillanceTab, PrivacyTab, and the sovereignty
// assessment all read this module — never a local copy of the formula.

export function computePanopticonIndex(items) {
  if (!items || !items.length) return 0;
  const sum = items.reduce((acc, it) => {
    const s = parseInt(it.severity ?? it.sev, 10) || 0;
    return acc + s * s;
  }, 0);
  return Math.min(100, Math.round(sum / (items.length * 25) * 100));
}

// ── Module-level corpus store ────────────────────────────────────────────────
// App.jsx registers the legislation corpus once after its manifest fetch;
// index stays null until then (degraded mode — spec §6: never blocks compile).

let corpusState = { index: null, lawCount: 0 };
const subs = new Set();

export function setPanopticonCorpus(laws) {
  corpusState = { index: computePanopticonIndex(laws), lawCount: laws?.length ?? 0 };
  subs.forEach((fn) => { try { fn(corpusState); } catch { /* subscriber errors never propagate */ } });
}

export function getPanopticonState() {
  return corpusState;
}

export function subscribePanopticon(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function _resetForTests() {
  corpusState = { index: null, lawCount: 0 };
  subs.clear();
}
