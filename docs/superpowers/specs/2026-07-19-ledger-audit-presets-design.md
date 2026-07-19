# Ledger Audit Presets — Design

**Date:** 2026-07-19
**Status:** Approved, pending implementation

## Problem

`SubmissionForm.jsx` (the Open Ledger's audit-submission form) requires typing
9 numeric fields by hand every time: `lat`, `lon`, plus the 7 `PARAM_RANGES`
fields (`temp`, `do`, `bod`, `dt`, `epi`, `nitrate`, `flow`). There's no fast
path to a representative case — every audit starts from a blank form.

## Goal

Add 5 one-click presets that fill the entire form (location + all 7
parameters) with a real, grounded case, spanning a healthy-to-catastrophic
range. Values stay editable afterward — a preset is a starting point, not a
lock.

## Data model — `src/terminal/ledger/auditPresets.js` (new file)

Exports `AUDIT_PRESETS`, an array of 5 objects:

```js
{
  key: 'mercury',        // stable id
  label: 'MERCURY',      // button text
  tone: 'safe',          // 'safe' | 'stress' | 'critical' — drives button tint
  siteName: 'Syri i Kaltër (Blue Eye), Albania',
  lat: 39.9269,
  lon: 20.0088,
  temp: 11, do: 11.5, bod: 1, dt: 0, epi: 1.2, nitrate: 2, flow: 48,
}
```

All 7 parameter values are chosen to land within `PARAM_RANGES` (so they
always pass `validateSubmission`) and to produce a specific severity
narrative under the existing `severityEngine.js` math
(`paramSeverity`/`discreteSeverity`, thresholds recapped below). Nothing new
is added to the severity engine — presets are just numbers tuned against the
math that already exists.

Severity recap (`do` and `flow` are inverted — higher is healthier):

| param | safe | stress | critical |
|---|---|---|---|
| temp | < 18 | 18–31.4 | ≥ 31.5 |
| do (inv.) | > 8.4 | 4.2–8.4 | < 4.2 |
| bod | < 24 | 24–41.9 | ≥ 42 |
| dt | < 4 | 4–6.9 | ≥ 7 |
| epi | < 3.2 | 3.2–5.5 | ≥ 5.6 |
| nitrate | < 20 | 20–34.9 | ≥ 35 |
| flow (inv.) | > 36 | 18–36 | < 18 |

### The 5 presets — final values

| | MERCURY | GERMANY | USA | BRAZIL | NORTH KOREA |
|---|---|---|---|---|---|
| site | Syri i Kaltër (Blue Eye spring), Albania | Rhine at Cologne, Germany | Lower Mississippi at New Orleans, USA | Rio Doce estuary at Regência, Brazil (post-2015 Mariana dam disaster) | Hamhung industrial corridor, North Korea |
| lat, lon | 39.9269, 20.0088 | 50.9375, 6.9603 | 29.9511, -90.0715 | -19.78, -39.74 | 39.9186, 127.535 |
| tone | safe | safe | stress | stress | critical |
| temp (°C) | 11 | 17 | 23 | 26 | 33 |
| do (mg/L) | 11.5 | 9.5 | 6.5 | 4.5 | 3 |
| bod (mg/L) | 1 | 6 | 27 | 35 | 55 |
| dt (°C) | 0 | 3.5 | 5 | 2 | 8 |
| epi (m) | 1.2 | 2.5 | 3.5 | 4.5 | 6.5 |
| nitrate (mg/L) | 2 | 18 | 32 | 25 | 42 |
| flow (m3/s) | 48 | 42 | 30 | 22 | 12 |

- **MERCURY** — the pristine baseline; every dot reads green.
- **GERMANY** — all safe, but `do`, `dt`, `nitrate` sit right at the
  threshold — "complies, but under pressure," reflecting a real regulated
  river with legacy industrial load.
- **USA** — stress tier across the board; nitrate at 32 (near the 35
  critical line) is the real, documented Gulf dead-zone/agricultural-runoff
  story.
- **BRAZIL** — stress leaning toward critical (`do` and `bod` both close to
  their critical lines) — grounded in the real mining-tailings collapse.
- **NORTH KOREA** — all params critical. Hamhung is a real, known chemical-
  industry city, chosen so the site itself is grounded even though no public
  water-quality data exists for it — the preset is explicitly
  speculative/satirical, framed that way in a code comment rather than
  presented as sourced.

## UI — `SubmissionForm.jsx` changes

- New row of 5 pill buttons, first thing in the form (above "Coordinates").
- Each button's border/text color comes from the existing
  `SEV_DOT_COLORS` map (`safe` teal `#14b8a6`, `stress` amber `#f59e0b`,
  `critical` red `#ef4444`) via the preset's `tone` — no new palette.
- `onClick` → `applyPreset(preset)`: **one** `setForm` call setting
  `lat, lon, siteName, temp, do, bod, dt, epi, nitrate, flow` from the preset
  plus `dependency: 'attested'`, and `setErrors([])`. Matches the "single
  state update" pattern `pullPrior` already uses.
- No change to `notes` — left as the user's own field.
- No change to `verdictModel.js`, `severityEngine.js`, or the kernel/backend
  — this is a pure form-prefill feature.

## Testing

New `src/terminal/ledger/__tests__/auditPresets.test.js` (matches the
project's `__tests__` colocation convention), asserting for each preset:

- all 7 params are within their `PARAM_RANGES` min/max (i.e.
  `validateSubmission` would accept them for those fields)
- `discreteSeverity(paramSeverity(key, value))` for each param matches the
  preset's intended tier (all `'safe'` for Mercury and Germany-safe-margin
  params, mixed `'stress'` for USA/Brazil, all `'critical'` for North Korea)

No component-level test for the button row itself — matches existing
practice (`SubmissionForm.jsx` currently has no dedicated test file).

## Out of scope

- No changes to `AuditCascade`/verdict display, no new dependency category,
  no persistence of "which preset was used."
- No preset editing UI (add/remove/customize presets) — fixed set of 5.
