// Sovereignty assessment — grand-vision stage 5 (spec §2).
// Pure and deterministic: exposure = clamp(threat − resistance, 0, 100),
// where threat is the live panopticon index and resistance derives from the
// accord's intrinsic Rust-OCK scalars. Exposure drives threshold-based
// redaction of the perfume card. No React imports, no randomness.

// ── Tunability contract (spec §7) ────────────────────────────────────────────
// These constants are the aesthetic dial of the whole layer. Retuning is a
// one-line change here; the unit suite parameterizes against these exports.
// Target: at corpus index ~61, ordinary compiles land at exposure 15–40
// (one to two vaulted field groups) — friction visible, artifact never blinded.

export const RESISTANCE_WEIGHTS = { sovereignty: 0.7, cleanRoom: 0.3 };

export const REDACTION_MAP = [
  { threshold: 15, vectorId: 'VERCEL_ANALYTICS',       category: 'behavioral_telemetry', fields: ['evap'] },
  { threshold: 30, vectorId: 'SERVER_LOG_RETENTION',   category: 'traffic_retention',    fields: ['longevity', 'concPct'] },
  { threshold: 45, vectorId: 'COOKIE_STATUS',          category: 'behavioral_tracking',  fields: ['heartNotes'] },
  { threshold: 60, vectorId: 'CLASSIFIED_CHALLENGE',   category: 'ephemeral_session',    fields: ['nodeClass', 'polLabel'] },
  { threshold: 75, vectorId: 'EXTERNAL_LINK_EXPOSURE', category: 'third_party_handoff',  fields: ['baseNotes'] },
  { threshold: 90, vectorId: 'LOCAL_EXECUTION',        category: 'local_execution',      fields: ['topNotes'] },
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
