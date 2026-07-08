// Sovereignty assessment — grand-vision stage 5 (spec §2).
// Pure and deterministic: exposure = clamp(threat − resistance, 0, 100),
// where threat is the live panopticon index and resistance derives from the
// accord's intrinsic Rust-OCK scalars. Exposure drives threshold-based
// redaction of the perfume card. No React imports, no randomness.

// ── Tunability contract (spec §7) ────────────────────────────────────────────
// These constants are the aesthetic dial of the whole layer. Retuning is a
// one-line change here; the unit suite parameterizes against these exports.
// Target: at corpus index ~61, the majority of ordinary compiles show one to
// two vaulted field groups — friction visible, artifact never blinded.
//
// Calibrated 2026-07-08 against 10 sampled collisions: the Rust OCK scalars
// are bimodal (combined resistance either ~12–30 or ~56–85 at the original
// 0.7/0.3 weights), which left half of all compiles fully clean and none in
// the target band. The 0.4/0.15 weights compress that spread so the
// high-resistance cluster still feels friction, and the 55/70/85/95 upper
// thresholds keep the low-resistance cluster at 1–2 vaulted groups while
// reserving deep redactions (base/top notes) for a genuinely worse corpus.

export const RESISTANCE_WEIGHTS = { sovereignty: 0.4, cleanRoom: 0.15 };

export const REDACTION_MAP = [
  { threshold: 15, vectorId: 'VERCEL_ANALYTICS',       category: 'behavioral_telemetry', fields: ['evap'] },
  { threshold: 30, vectorId: 'SERVER_LOG_RETENTION',   category: 'traffic_retention',    fields: ['longevity', 'concPct'] },
  { threshold: 55, vectorId: 'COOKIE_STATUS',          category: 'behavioral_tracking',  fields: ['heartNotes'] },
  { threshold: 70, vectorId: 'CLASSIFIED_CHALLENGE',   category: 'ephemeral_session',    fields: ['nodeClass', 'polLabel'] },
  { threshold: 85, vectorId: 'EXTERNAL_LINK_EXPOSURE', category: 'third_party_handoff',  fields: ['baseNotes'] },
  { threshold: 95, vectorId: 'LOCAL_EXECUTION',        category: 'local_execution',      fields: ['topNotes'] },
];

export const CENSOR = '██████';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function assessSovereignty({ panopticonIndex, accord }) {
  const sov   = accord?.sovereignty ?? 0;
  const clean = accord?.cleanRoom   ?? 0;
  const resistance = Math.round(
    (sov * RESISTANCE_WEIGHTS.sovereignty + clean * RESISTANCE_WEIGHTS.cleanRoom) * 100
  );

  if (panopticonIndex == null) {
    return {
      threat: null, resistance, exposure: 0, redactions: [],
      verdict: 'PANOPTICON OFFLINE — SEALED WITHOUT ASSESSMENT',
    };
  }

  const exposure = clamp(Math.round(panopticonIndex - resistance), 0, 100);
  const fired = REDACTION_MAP.filter((e) => exposure >= e.threshold);
  const redactions = fired.flatMap((e) =>
    e.fields.map((field) => ({ field, vectorId: e.vectorId, threshold: e.threshold }))
  );
  const verdict = redactions.length === 0
    ? 'CLEAN COMPILE — NO FIELDS VAULTED'
    : `${redactions.length} FIELDS VAULTED · ${fired.map((e) => e.vectorId).join(' + ')}`;

  return { threat: panopticonIndex, resistance, exposure, redactions, verdict };
}

// Pure redaction: new card object, original untouched. `name`, `id`, `conc`,
// `dom`, `sec`, and the tesseract hash are never in REDACTION_MAP — the state
// always sees THAT the artifact exists; it can't read its interior (spec §2).
export function redactCard(card, redactions) {
  if (!redactions || !redactions.length) return card;
  const out = { ...card, __redacted: redactions.map((r) => r.field) };
  for (const { field } of redactions) {
    const v = card[field];
    if (field === 'evap') out[field] = [0, 0, 0];
    else if (Array.isArray(v)) out[field] = v.map(() => CENSOR);
    else out[field] = CENSOR;
  }
  return out;
}

// Transit annotation for order plaintext blocks: ' [VECTOR_ID]' or ''.
export const transitTag = (redactions, field) => {
  const r = redactions?.find((x) => x.field === field);
  return r ? ` [${r.vectorId}]` : '';
};

// ── Last-assessment store (feeds PrivacyTab's readout — spec §5) ─────────────
// In-memory only; page reload clears it.

let lastAssessment = null;
const subs = new Set();

export function publishAssessment(assessment) {
  lastAssessment = assessment;
  subs.forEach((fn) => { try { fn(assessment); } catch { /* never propagate */ } });
}

export function getLastAssessment() {
  return lastAssessment;
}

export function subscribeSovereignty(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function _resetSovereigntyForTests() {
  lastAssessment = null;
  subs.clear();
}
