// src/terminal/quintessence/spineStore.js — the deliberate choices (spec §6).
// Four vertebrae since scent-aether P2: trend, council, phase, scent (the sealed accord).
// Bus-adjacent store, same discipline as observatoryBus: no React, listeners
// are a Set, localStorage-persisted so a reload mid-journey keeps the spine.
// The element is written at the altar click (spec §4) and is not gate-checked.
import { LUNAR_ACCORDS } from '../data/lunarAccords';

const STORAGE_KEY = 'quintessence_spine_v1';
const ELEMENTS = ['FIRE', 'EARTH', 'WATER', 'AIR'];
const PHASES = LUNAR_ACCORDS.map(a => a.accord);

const emptySpine = () => ({ trend: null, council: null, phase: null, element: null, scent: null });

export const SCENT_ABSENT = 'NO ACCORD SEALED';
export const SCENT_ORPHANED = 'SEAL ORPHANED — the key evaporated';
export const SCENT_BROKEN = 'SEAL BROKEN — the accord would not open';

let spine = restore();
const listeners = new Set();

function restore() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) return { ...emptySpine(), ...JSON.parse(raw) };
  } catch (_) { /* volatile spine is acceptable */ }
  return emptySpine();
}

function persist() {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(spine)); }
  catch (_) { /* volatile spine is acceptable */ }
}

function write(patch) {
  spine = { ...spine, ...patch };
  persist();
  listeners.forEach(fn => {
    // One throwing subscriber must not stop the rest from being notified.
    try { fn(spine); } catch (_) { /* isolated per listener */ }
  });
}

export function getSpine() { return { ...spine }; }

export function setTrend(trend) {
  // Contract for the future bsky picker (spec §8.1):
  // { label: string, velocity: number in [0,1], volume?: number|null }
  write({ trend: { label: String(trend.label), velocity: Number(trend.velocity) || 0, volume: trend.volume ?? null } });
}

export function setCouncil(council) {
  // Projected from the SYNTHESIS record (councilSynthesis.js) by the caller:
  // pair = record.pair labels, directive = record.directive,
  // trajectory = record.metrics.trajectory, paradoxCount = record.sections.openQuestions.length.
  // A council is a collision between two minds; a pair with fewer than two
  // labels is malformed. Rejecting it here (like setPhase rejects bad accords)
  // keeps every "is this vertebra marked?" predicate agreeing: the eye and the
  // armed-line read !!spine.council, the altar's mirror reads council.pair — a
  // pairless-but-truthy council would arm the altar while the mirror still
  // showed the gap. The one production caller already wraps this in try/catch.
  if (!Array.isArray(council?.pair) || council.pair.length < 2) {
    throw new Error('council needs a pair of two');
  }
  write({ council: {
    pair: council.pair, directive: council.directive,
    trajectory: council.trajectory, paradoxCount: council.paradoxCount ?? 0,
  } });
}

export function setPhase(accordName) {
  if (!PHASES.includes(accordName)) throw new Error(`unknown olfactory phase: ${accordName}`);
  write({ phase: accordName });
}

export function setElement(element) {
  if (!ELEMENTS.includes(element)) throw new Error(`unknown element: ${element}`);
  write({ element });
}

// The scent vertebra (scent-aether P2, spec §5.3). Only a real ML-KEM-768
// envelope fills it: an unsealed card (insecure origin, no WASM) never does.
// The plaintext never touches the spine: only the ciphertext envelope does.
export function setScent({ envelope, cardName, sealedAt, fp }) {
  if (!envelope || envelope.v !== 1 || envelope.kem !== 'ML-KEM-768' || typeof envelope.fp !== 'string') {
    throw new Error('setScent needs a sealed ML-KEM-768 envelope');
  }
  if (fp !== envelope.fp) throw new Error('setScent: fp does not match the envelope');
  write({ scent: { envelope, cardName: String(cardName), sealedAt: Number(sealedAt) || 0, fp } });
}

// Orphaning is decided when the identity is known (boot, rotate, restore), not per
// read, so missingVertebrae() stays synchronous for its readers (plan ruling 6).
// currentFp null = no identity on this device.
export function reconcileScent(currentFp) {
  if (!spine.scent) return;
  const orphaned = !currentFp || currentFp !== spine.scent.fp;
  if (orphaned === !!spine.scent.orphaned) return;
  write({ scent: { ...spine.scent, orphaned } });
}

// The altar tried the envelope and it failed authentication or would not parse
// (scent-aether P3 ruling 2). The mark falls until the visitor crystallizes again;
// setScent writes a fresh scent, which carries no `broken`.
export function markScentBroken() {
  if (!spine.scent || spine.scent.broken) return;
  write({ scent: { ...spine.scent, broken: true } });
}

export function missingVertebrae() {
  const missing = [];
  if (!spine.trend)   missing.push('NO TREND MARKED');
  if (!spine.council) missing.push('NO COUNCIL COLLISION');
  if (!spine.phase)   missing.push('NO PHASE COMPILED');
  if (!spine.scent?.envelope)  missing.push(SCENT_ABSENT);
  else if (spine.scent.orphaned) missing.push(SCENT_ORPHANED);
  else if (spine.scent.broken) missing.push(SCENT_BROKEN);
  return missing;
}

export function subscribeSpine(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function _resetSpineForTests(opts = {}) {
  if (opts.keepStorage) {
    spine = restore();
  } else {
    try { globalThis.localStorage?.removeItem(STORAGE_KEY); }
    catch (_) { /* storage unavailable (private mode / blocked) — nothing to clear */ }
    spine = emptySpine();
  }
  listeners.clear();
}

// DEV escape hatch: lets the altar→reliquary flow be exercised in the browser
// before the bsky trend picker ships (spec §8.1). Stripped from prod builds.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__quintessenceSpine = { getSpine, setTrend, setCouncil, setPhase, setElement, reconcileScent };
}
