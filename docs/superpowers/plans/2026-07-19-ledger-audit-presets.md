# Ledger Audit Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 one-click presets (MERCURY, GERMANY, USA, BRAZIL, NORTH KOREA) to the Open Ledger's audit-submission form, each prefilling location + all 7 audit parameters from a real, grounded case.

**Architecture:** A single new data module (`auditPresets.js`) exports a plain array of preset objects — no new abstractions, no changes to the severity engine or verdict model. `SubmissionForm.jsx` gets a new button row and one `setForm` call wired to it, following the existing `pullPrior` pattern already in that file.

**Tech Stack:** React (existing), Vitest (existing test runner) — no new dependencies.

## Global Constraints

- All 7 parameter values per preset must fall within `PARAM_RANGES` from `src/terminal/ledger/verdictModel.js` (`temp` -5..50, `do` 0..20, `bod` 0..100, `dt` -10..20, `epi` 0..20, `nitrate` 0..100, `flow` 0..100).
- Preset button tint must reuse the existing `SEV_DOT_COLORS` map in `SubmissionForm.jsx` (`safe` `#14b8a6`, `stress` `#f59e0b`, `critical` `#ef4444`) — no new color palette.
- Selecting a preset sets `dependency: 'attested'` on the form.
- No changes to `verdictModel.js`, `severityEngine.js`, `AuditCascade`, or any backend/kernel code — this is a pure form-prefill feature.
- Spec of record: `docs/superpowers/specs/2026-07-19-ledger-audit-presets-design.md`.

---

### Task 1: Audit presets data module

**Files:**
- Create: `src/terminal/ledger/auditPresets.js`
- Test: `src/terminal/ledger/__tests__/auditPresets.test.js`

**Interfaces:**
- Produces: `AUDIT_PRESETS` — an array of exactly 5 objects, each shaped
  `{ key: string, label: string, tone: 'safe'|'stress'|'critical', siteName: string, lat: number, lon: number, temp: number, do: number, bod: number, dt: number, epi: number, nitrate: number, flow: number }`.
  Task 2 imports this as `import { AUDIT_PRESETS } from '../../ledger/auditPresets';` (path relative to `src/terminal/views/ledger/SubmissionForm.jsx`).
- Consumes: `PARAM_RANGES` from `../verdictModel` (relative to the new file's own directory) and `paramSeverity`, `discreteSeverity` from `../../views/ledger/severityEngine` — test-only, to verify the data.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/ledger/__tests__/auditPresets.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { AUDIT_PRESETS } from '../auditPresets';
import { PARAM_RANGES } from '../verdictModel';
import { paramSeverity, discreteSeverity } from '../../views/ledger/severityEngine';

const PARAM_KEYS = ['temp', 'do', 'bod', 'dt', 'epi', 'nitrate', 'flow'];

// Expected discreteSeverity() tier per preset, per param — hand-computed
// against severityEngine.js's actual formulas (see the design spec for the
// derivation). This is what makes each preset's narrative real rather than
// asserted by fiat.
const EXPECTED_TIERS = {
  mercury:      { temp: 'safe',     do: 'safe',     bod: 'safe',     dt: 'safe',     epi: 'safe',     nitrate: 'safe',     flow: 'safe' },
  germany:      { temp: 'safe',     do: 'safe',     bod: 'safe',     dt: 'safe',     epi: 'safe',     nitrate: 'safe',     flow: 'safe' },
  usa:          { temp: 'stress',   do: 'stress',   bod: 'stress',   dt: 'stress',   epi: 'stress',   nitrate: 'stress',   flow: 'stress' },
  brazil:       { temp: 'stress',   do: 'stress',   bod: 'stress',   dt: 'safe',     epi: 'stress',   nitrate: 'stress',   flow: 'stress' },
  north_korea:  { temp: 'critical', do: 'critical', bod: 'critical', dt: 'critical', epi: 'critical', nitrate: 'critical', flow: 'critical' },
};

describe('AUDIT_PRESETS', () => {
  it('has exactly 5 presets with the expected keys', () => {
    expect(AUDIT_PRESETS.map(p => p.key).sort()).toEqual(
      ['brazil', 'germany', 'mercury', 'north_korea', 'usa'].sort()
    );
  });

  it('every param value is within PARAM_RANGES for every preset', () => {
    for (const preset of AUDIT_PRESETS) {
      for (const key of PARAM_KEYS) {
        const { min, max } = PARAM_RANGES[key];
        expect(preset[key], `${preset.key}.${key}`).toBeGreaterThanOrEqual(min);
        expect(preset[key], `${preset.key}.${key}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it('every preset has lat, lon, siteName, and a valid tone', () => {
    for (const preset of AUDIT_PRESETS) {
      expect(typeof preset.lat).toBe('number');
      expect(typeof preset.lon).toBe('number');
      expect(typeof preset.siteName).toBe('string');
      expect(preset.siteName.length).toBeGreaterThan(0);
      expect(['safe', 'stress', 'critical']).toContain(preset.tone);
    }
  });

  it('produces the intended severity narrative for every param of every preset', () => {
    for (const preset of AUDIT_PRESETS) {
      const expected = EXPECTED_TIERS[preset.key];
      for (const key of PARAM_KEYS) {
        const tier = discreteSeverity(paramSeverity(key, preset[key]));
        expect(tier, `${preset.key}.${key}`).toBe(expected[key]);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/__tests__/auditPresets.test.js`
Expected: FAIL — `auditPresets.js` doesn't exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `src/terminal/ledger/auditPresets.js`:

```js
// auditPresets.js — one-click reference cases for the Open Ledger's audit
// form. Each preset fills location + all 7 PARAM_RANGES fields at once.
// Values are tuned against severityEngine.js's thresholds — see
// docs/superpowers/specs/2026-07-19-ledger-audit-presets-design.md for the
// derivation of every number.

export const AUDIT_PRESETS = [
  {
    key: 'mercury',
    label: 'MERCURY',
    tone: 'safe',
    siteName: 'Syri i Kaltër (Blue Eye spring), Albania',
    lat: 39.9269, lon: 20.0088,
    temp: 11, do: 11.5, bod: 1, dt: 0, epi: 1.2, nitrate: 2, flow: 48,
  },
  {
    key: 'germany',
    label: 'GERMANY',
    tone: 'safe',
    siteName: 'Rhine at Cologne, Germany',
    lat: 50.9375, lon: 6.9603,
    temp: 17, do: 9.5, bod: 6, dt: 3.5, epi: 2.5, nitrate: 18, flow: 42,
  },
  {
    key: 'usa',
    label: 'USA',
    tone: 'stress',
    siteName: 'Lower Mississippi at New Orleans, USA',
    lat: 29.9511, lon: -90.0715,
    temp: 23, do: 6.5, bod: 27, dt: 5, epi: 3.5, nitrate: 32, flow: 30,
  },
  {
    key: 'brazil',
    label: 'BRAZIL',
    tone: 'stress',
    siteName: 'Rio Doce estuary at Regência, Brazil (post-2015 Mariana dam disaster)',
    lat: -19.78, lon: -39.74,
    temp: 26, do: 4.5, bod: 35, dt: 2, epi: 4.5, nitrate: 25, flow: 22,
  },
  {
    key: 'north_korea',
    label: 'NORTH KOREA',
    tone: 'critical',
    // Speculative/satirical — no real public water-quality data exists for
    // North Korea. Hamhung is a real, known chemical-industry city; the
    // numbers themselves are not sourced, they're the worst case the model
    // can express.
    siteName: 'Hamhung industrial corridor, North Korea (unverified — no public data)',
    lat: 39.9186, lon: 127.535,
    temp: 33, do: 3, bod: 55, dt: 8, epi: 6.5, nitrate: 42, flow: 12,
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/ledger/__tests__/auditPresets.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/terminal/ledger/auditPresets.js src/terminal/ledger/__tests__/auditPresets.test.js
git commit -m "feat(ledger): add audit presets data module (Mercury/Germany/USA/Brazil/NK)"
```

---

### Task 2: Wire presets into the submission form

**Files:**
- Modify: `src/terminal/views/ledger/SubmissionForm.jsx`

**Interfaces:**
- Consumes: `AUDIT_PRESETS` from Task 1 (`src/terminal/ledger/auditPresets.js`), each object shaped as defined in Task 1's Interfaces block. Consumes the file's own existing `SEV_DOT_COLORS` (line ~14) and `setForm`/`setErrors` state setters (line ~52, ~66).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Add the import**

In `src/terminal/views/ledger/SubmissionForm.jsx`, after the existing imports (after line 6, the `observatoryBus` import), add:

```js
import { AUDIT_PRESETS } from '../../ledger/auditPresets';
```

- [ ] **Step 2: Add the `applyPreset` handler**

Immediately after the existing `pullPrior` callback (ends at line 103, right before the blank line preceding `const handleSubmit = ...` at line 105), add:

```js
  const applyPreset = useCallback((preset) => {
    setForm(prev => ({
      ...prev,
      lat: preset.lat,
      lon: preset.lon,
      siteName: preset.siteName,
      temp: preset.temp,
      do: preset.do,
      bod: preset.bod,
      dt: preset.dt,
      epi: preset.epi,
      nitrate: preset.nitrate,
      flow: preset.flow,
      dependency: 'attested',
    }));
    setErrors([]);
  }, []);
```

- [ ] **Step 3: Add the preset button row to the JSX**

In the same file, the return block starts with:

```jsx
    <div className="space-y-6" ref={formRef}>
      <style>{SEV_DOT_STYLES}</style>
      {/* Coordinates */}
```

Insert a new block between `<style>{SEV_DOT_STYLES}</style>` and the `{/* Coordinates */}` comment:

```jsx
      {/* Audit Presets */}
      <div>
        <div className="text-[10px] uppercase tracking-[3px] text-teal-500 font-mono mb-3">Presets</div>
        <div className="flex flex-wrap gap-2">
          {AUDIT_PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors hover:bg-white/5"
              style={{ borderColor: SEV_DOT_COLORS[preset.tone], color: SEV_DOT_COLORS[preset.tone] }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

```

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `npx vitest run`
Expected: PASS — all existing tests plus the 4 new ones from Task 1 still pass. `SubmissionForm.jsx` has no existing dedicated test file, so no component test is expected to run for this change (matches the design spec's "Testing" section).

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`, open the app, navigate to the `/LEDGER` tab, open "SUBMIT AUDIT".

- Confirm a row of 5 pill buttons (MERCURY, GERMANY, USA, BRAZIL, NORTH KOREA) appears above "Coordinates", tinted teal/teal/amber/amber/red respectively.
- Click MERCURY: confirm Latitude/Longitude/Site name and all 7 Audit Parameters fields populate, the severity dots next to each parameter label all read green, and the "Data Supply Chain" section shows ATTESTED selected.
- Click NORTH KOREA: confirm the same fields update to the new values and all severity dots read red.
- Confirm the "RUN AUDIT" button is enabled (no validation errors) after selecting any preset.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/ledger/SubmissionForm.jsx
git commit -m "feat(ledger): add one-click audit preset buttons to submission form"
```
