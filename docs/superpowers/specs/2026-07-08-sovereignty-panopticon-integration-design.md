# Cryptographic Sovereignty — Panopticon Integration Layer — Design Spec

**Date:** 2026-07-08
**Branch:** new branch off main (`feat/sovereignty-panopticon-layer`)
**Status:** Approved design; ready for implementation planning
**Source material:** `field_fracture/development/Cryptographic Sovereignty & The Panopticon Integration Layer.md` (truncated draft) and `field_fracture/development/1.0.0 the grand vision.md` (9-stage planetary auto-audit, stages 4→5→6)

## Overview

The `PANOPTICON_INDEX` (surveillance tab) and `PRIVACY_PROTOCOL` (privacy tab) currently float in isolation: the panopticon threat score is computed live from the legislation corpus but trapped as component-local state, the privacy tab is purely presentational, and the two tabs compute *disagreeing* copies of the same formula. This spec integrates both modules into the Crystallize→Tesseract compilation chain as the grand vision's missing stage 5: every collision that crystallizes is assessed against the live geopolitical threat environment, and the resulting **exposure** determines how much of the perfume card is redacted from public view and sealed into the existing encrypted vault. Redacted-in-transit, complete-in-vault — the crypto-anarchist critique of institutional overreach made mechanical.

The stage-5 score is a **relation**, not an environment reading: hostility of the current surveillance infrastructure *to this specific synthesized thought*. Both halves already exist in code — the environmental threat (legislation-corpus panopticon index, `SurveillanceTab.jsx:87-94`) and the thought's intrinsic resistance (the Rust OCK kernel's per-collision `sovereignty` and `cleanRoom` scalars, `LatentCollider.jsx:171-172`, already sealed into the Tesseract hash canonical as `sv`/`cs`).

## Goals

1. One shared panopticon module owning the `Σ(sev²)/(n×25)×100` formula; SurveillanceTab and PrivacyTab become consumers of the same live score (fixing the current duplicate/disagreeing computation).
2. A pure, deterministic sovereignty assessment run at crystallize time: `exposure = clamp(threat − resistance, 0, 100)`, where threat is the live panopticon index and resistance derives from the accord's intrinsic OCK scalars.
3. Exposure-driven redaction of the perfume card, with topology defined by the privacy tab's six exposure vectors: each vector claims specific card fields at a fixed exposure threshold.
4. Vault-recoverable sovereignty: plaintext that leaves the browser (order `noteBlock`/`physBlock`) ships redacted; the existing RSA-OAEP `encryptedPayload` carries the complete formula; a `[SOVEREIGN VIEW]` toggle un-redacts locally only.
5. The privacy tab goes live: real-time panopticon index plus a last-assessment readout, making both floating modules load-bearing.
6. Full determinism (no `Math.random()`), graceful degradation when the legislation corpus is unavailable, existing test suite stays green.

## Non-goals (this phase)

- No mega-compiler orchestration: this is stage 5 only, inserted into the already-wired Crystallize→Tesseract chain. No new event buses; `councilBus` stays unsubscribed.
- No Council Ring integration — the sovereignty module's API is designed so the council synthesis *could* consume it later, but nothing subscribes now.
- No user-configurable countermeasures (the "privacy vectors as toggles" concept is deferred to a possible phase 2).
- No change to `generateAccordHash` — the accord hash remains the scent's stable identity; the sovereignty layer is a separate seal, not a hash input.
- No full re-animation of the privacy tab's pipeline SVG — one live counter only.

---

## 1 · Shared panopticon module — `src/terminal/lib/panopticon.js`

The formula's single home. Pure core plus a tiny module-level store:

```js
computePanopticonIndex(items)        // pure: Σ(sev²) / (n × 25) × 100, rounded, clamped ≤ 100
setPanopticonCorpus(laws)            // called by App.jsx after legislation loads; caches {index, lawCount}
getPanopticonState()                 // → { index: number|null, lawCount: number }
subscribePanopticon(fn)              // → unsubscribe; fires on corpus registration/change
_resetForTests()
```

- `App.jsx` already fetches `legislationArticles` (`App.jsx:224-248`); after the load resolves it calls `setPanopticonCorpus(laws)`. Each law's `sev` field feeds the formula exactly as `SurveillanceTab.jsx:87-94` does today.
- **SurveillanceTab** replaces its local `useMemo` with the shared module (rendered number is identical — parity is a test).
- **PrivacyTab** deletes its module-load constant (`PrivacyTab.jsx:77-80`, computed over the 6 hardcoded VECTORS) and displays the live corpus-derived index instead. The 6 VECTORS stay — repurposed as the redaction topology (§2), not as a score input.
- Degraded mode: corpus never registered (fetch failed, offline) → `{index: null}`. Downstream, assessment returns no redactions and verdict `PANOPTICON OFFLINE — SEALED WITHOUT ASSESSMENT`.

## 2 · Sovereignty assessment — `src/terminal/lib/sovereignty.js`

Pure, deterministic, no imports from React or view files:

```js
assessSovereignty({ panopticonIndex, accord }) → {
  threat:      panopticonIndex,                                        // 0–100 | null
  resistance:  Math.round((accord.sovereignty * 0.7 + accord.cleanRoom * 0.3) * 100),
  exposure:    clamp(threat − resistance, 0, 100),                     // 0 when threat is null
  redactions:  [{ field, vectorId, threshold }],                       // sorted by threshold
  verdict:     string,                                                 // human-readable strip line
}
```

- `accord.sovereignty` and `accord.cleanRoom` are the Rust OCK scalars already returned by `classifyAccord` (`LatentCollider.jsx:171-172,201-202`), each in [0,1]. Missing/undefined scalars default to 0 (resistance 0 — maximum vulnerability, honest default).
- **Redaction topology** — module constant `REDACTION_MAP`, keyed by the privacy tab's six vector categories. A vector claims its fields when `exposure ≥ threshold`:

| Threshold | Vector id | Category | Redacts (card fields) |
|---|---|---|---|
| 15 | `VERCEL_ANALYTICS` | behavioral_telemetry | `evap` |
| 30 | `SERVER_LOG_RETENTION` | traffic_retention | `longevity`, `concPct` |
| 55 | `COOKIE_STATUS` | behavioral_tracking | `heartNotes` |
| 70 | `CLASSIFIED_CHALLENGE` | ephemeral_session | `nodeClass`, `polLabel` |
| 85 | `EXTERNAL_LINK_EXPOSURE` | third_party_handoff | `baseNotes` |
| 95 | `LOCAL_EXECUTION` | local_execution | `topNotes` |

> **As-built calibration (2026-07-08, browser-sampled):** the draft thresholds (15/30/45/60/75/90) and weights (0.7/0.3) missed the acceptance band — the Rust OCK scalars proved bimodal (combined resistance ~12–30 or ~56–85), leaving 5/10 sampled compiles fully clean and only 2/10 in-band. As shipped: `RESISTANCE_WEIGHTS = { sovereignty: 0.4, cleanRoom: 0.15 }` and the thresholds above. Re-sampled across the same 10 domain pairs: **8/10 compiles at 1–2 vaulted groups, 1 clean (exposure 14), 1 at 3 groups (exposure 55), 0 blackouts** — acceptance met. Deep redactions (`baseNotes`/`topNotes`) remain unreachable until the legislative corpus index itself exceeds ~85: the world has to get worse before the engine censors deeper.

- `name`, `id`, `conc`, `dom`, `sec`, and the Tesseract `hash` are **never redacted** — the state always sees *that* the artifact exists; it can't read its interior. (`conc` tier stays public; only the percentage is retained metadata.)
- Redaction is cumulative: at exposure 62, everything with threshold ≤ 60 is redacted.
- Companion helper `redactCard(card, redactions)` → a new card object where each redacted field's value is replaced by a `{redacted: true, vectorId}` marker (arrays become arrays of markers matching original length, so layout is stable). Pure; the original card is untouched.
- The module keeps the **last assessment** in memory: `getLastAssessment()` / `subscribeSovereignty(fn)` — feeds the privacy tab's readout (§5). Not persisted; page reload clears it.

## 3 · Crystallize integration — `LatentCollider.jsx`

In `handleCrystallize` (`LatentCollider.jsx:1149-1174`), after `buildTesseractProfile` resolves:

1. `const assessment = assessSovereignty({ panopticonIndex: getPanopticonState().index, accord: result.accord })`
2. The tesseract profile gains a `sovereignty` block: `{ ...assessment, panopticonIndexAtSeal: index, lawCount, sealedAt: profile-build timestamp }`. `generateAccordHash` is **not** modified — the scent's identity is stable across geopolitical time; the sovereignty block records what the world looked like when it was sealed.
3. Component state holds both `crystal` (full card, for sovereign view) and the redacted card derived via `redactCard`.

In `handleAcquire` (`LatentCollider.jsx:1176+`):

- `noteBlock` and `physBlock` (`:1213-1225`) are built from the **redacted** card — redacted entries render as `██████ [VECTOR_ID]` lines. This is the plaintext that transits the network in the order body.
- `encryptedPayload` (RSA-OAEP, `:1198-1204`) is unchanged — it already serializes the complete `encryptedFormula`. Complete-in-vault requires zero new crypto.
- The order body gains `sovereignty: { threat, resistance, exposure, redactionCount, panopticonIndexAtSeal }` so the fulfillment side sees the seal conditions.
- `vaultBlock` gains one line: `SOVEREIGNTY   EXPOSURE {exposure}/100 · {n} FIELDS VAULTED`.

## 4 · Card rendering — censor bars + sovereign view

- Wherever the crystal card renders a redacted field, show a censor bar: `██████ [TRAFFIC_RETENTION]` in the claiming vector's id, styled in the card's existing mono/terminal idiom (red-tinted, consistent with SurveillanceTab's threat colors).
- A **sovereignty strip** renders on the card between the notes and the Tesseract block:
  `⛨ THREAT {t} · RESISTANCE {r} · EXPOSURE {e} · {n} FIELDS VAULTED`
  (or `⛨ PANOPTICON OFFLINE — SEALED WITHOUT ASSESSMENT` in degraded mode; strip omitted entirely when exposure is 0 with a live index — a clean card needs no scar).
- A `[SOVEREIGN VIEW]` toggle sits on the strip when redactions exist. Toggled on: the full card renders locally with the note `decrypted in client enclave — never transits`. Toggled off (default): censor bars. The toggle affects **display only**; order dispatch always uses the redacted card.

## 5 · Privacy tab goes live — `PrivacyTab.jsx`

- The "Panopticon Threat Assessment" panel header reads the live index via `getPanopticonState()`/`subscribePanopticon` (component gains this one subscription; drops `React.memo` inertness for a minimal state hook). Degraded mode shows `— /100 · CORPUS OFFLINE`.
- The 6 VECTORS cards remain as-is visually, each gaining one line: the card fields it claims and its exposure threshold (static text from `REDACTION_MAP` — the topology made legible).
- New compact **LAST ASSESSMENT** row under the panel: `EXPOSURE {e} · {n} FIELDS VAULTED · VECTORS FIRED: {ids}` via `subscribeSovereignty`, or `NO COMPILATION ASSESSED THIS SESSION` before any crystallize.
- The pipeline SVG: the existing "NO DATA" arrow label becomes `NO DATA · {n} VAULTED` when a last assessment exists. Nothing else in the SVG changes.

## 6 · Determinism & error handling

- No `Math.random()` anywhere; assessment and redaction are pure functions of (corpus, accord).
- Corpus unavailable → null index → exposure 0, no redactions, OFFLINE verdict; crystallize flow is never blocked by the sovereignty layer.
- Malformed accord (missing OCK scalars) → resistance 0; assessment still returns a well-formed object.
- The sovereignty module must never throw into `handleCrystallize` — assessment failure degrades to the OFFLINE verdict (try/catch at the call site, consistent with the existing tesseract try/catch).

## 7 · Testing

Vitest units (all pure logic):

- `panopticon.test.js` — formula parity: index over the current legislation corpus fixture equals the value SurveillanceTab renders today (61 at time of writing); empty corpus → 0; unregistered → null state; subscribe/notify.
- `sovereignty.test.js` — resistance weighting; exposure clamping (threat null, threat < resistance, both extremes); threshold boundaries (exposure exactly 15/30/.../90 fires the vector, one below does not); cumulative redaction; determinism (same inputs → deep-equal output); missing scalars → resistance 0; `redactCard` purity and array-length stability.
- Order-body redaction — `noteBlock` built from a redacted card contains censor lines while the serialized `encryptedFormula` remains complete.
- Existing suite (351) stays green; SurveillanceTab index parity verified in-browser.

### Tunability contract

The resistance weights (drafted 0.7/0.3; as-built 0.4/0.15 — see §2's calibration amendment) and the six thresholds (drafted 15/30/45/60/75/90; as-built 15/30/55/70/85/95) are the aesthetic dial of the whole layer. They live as named constants in **one block** at the top of `sovereignty.js` (`RESISTANCE_WEIGHTS`, `REDACTION_MAP`); unit tests parameterize against these constants rather than hardcoding their values, so retuning is a one-line change that does not break the suite.

### Calibration verification (acceptance criterion)

The "typical" resistance is an estimate until measured — the OCK scalars (`ockSovereignty`, `ockCleanRoom`) come from the Rust kernel and their real distribution is unverified. After wiring, sample a spread of real collisions (≥10 distinct domain pairs) in the browser and record the exposure distribution. **Acceptance: at the current corpus index (61), the majority of ordinary compiles show one to two vaulted field groups** (under the drafted thresholds that meant the 15–40 exposure window; under the as-built thresholds 1–2 groups spans exposure 15–54). Friction visible, artifact never blinded. If the kernel skews high (most cards compile clean, critique invisible) or low (blackout-heavy), retune the §7 constants and re-sample — the intended band is the tested property, not a hoped-for side effect. **Result: met after one retune — 8/10 sampled compiles at 1–2 groups (see §2 as-built note).**

Browser verification: crystallize at current corpus (verify strip renders or is cleanly absent), temporarily inflate threat in dev to force redactions, verify censor bars, sovereign view toggle, order body redaction, privacy tab live readouts, offline degradation (block the legislation fetch), and the calibration sampling above.

## Module summary

| File | Status | Responsibility |
|---|---|---|
| `src/terminal/lib/panopticon.js` | new | Formula single-home + corpus store + subscriptions |
| `src/terminal/lib/sovereignty.js` | new | Assessment, REDACTION_MAP topology, redactCard, last-assessment store |
| `src/terminal/App.jsx` | touch | `setPanopticonCorpus(laws)` after legislation load |
| `src/terminal/views/SurveillanceTab.jsx` | touch | Local useMemo → shared module read |
| `src/terminal/views/PrivacyTab.jsx` | modify | Live index, vector threshold lines, LAST ASSESSMENT row, SVG counter |
| `src/terminal/views/LatentCollider.jsx` | modify | Assessment at crystallize, redacted card render + sovereign view, redacted order blocks, sovereignty in profile/vault block |
| `tests/panopticon.test.js` | new | Formula + store units |
| `tests/sovereignty.test.js` | new | Assessment + redaction units |
