# Sovereignty–Panopticon Integration Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every crystallized accord is assessed against the live Panopticon index; net exposure redacts card fields (redacted-in-transit, complete-in-vault), the Privacy tab goes live, and the duplicated panopticon formula gets one shared home.

**Architecture:** Two new pure lib modules (`panopticon.js`: formula + corpus store; `sovereignty.js`: assessment + redaction topology + last-assessment store) with zero React imports, wired into three existing consumers: App registers the legislation corpus after load, SurveillanceTab/PrivacyTab read the shared score, and LatentCollider runs the assessment at crystallize time, rendering censor bars + a `[SOVEREIGN VIEW]` toggle on the TesseractCard and shipping redacted plaintext blocks in the order body while the existing RSA-OAEP payload stays complete.

**Tech Stack:** React 19, Vite, Vitest (tests in `tests/*.test.js`, importing `describe/it/expect` from `'vitest'` per the existing `tests/councilRingMath.test.js` pattern).

**Spec:** `docs/superpowers/specs/2026-07-08-sovereignty-panopticon-integration-design.md`

**Key existing code facts** (verified 2026-07-08):
- Panopticon formula today: `SurveillanceTab.jsx:87-94` (`useMemo` over `legislationArticles`, severity is a **string**, `parseInt`'d) and a duplicate constant over 6 hardcoded VECTORS at `PrivacyTab.jsx:77-80`.
- App loads legislation at `App.jsx:224-248`; `setDynamicData(...)` at `:248` is the registration point.
- `classifyAccord` returns `sovereignty` and `cleanRoom` scalars in [0,1] (`LatentCollider.jsx:171-172,201-202`), Rust-computed (`ockSovereignty`/`ockCleanRoom`).
- `handleCrystallize` at `LatentCollider.jsx:1149-1174` builds the card + tesseract profile; `handleAcquire` at `:1176+` builds `noteBlock`/`physBlock`/`vaultBlock` (`:1213-1233`) and the RSA-OAEP `encryptedPayload` (`:1198-1204`, already complete-formula).
- Cards render at `:3269-3296`: `TesseractCard` (primary, defined `:3934`) or `CrystallizeCard` (fallback when hash generation failed — no profile, therefore no assessment; it stays untouched).
- `TesseractCard`'s note pyramid `NOTE_LAYERS` at `:3971-3975`; `handleDownload` (`:3941-3956`) generates a local manifest file — local file = client enclave = must use the **full** card.

---

### Task 1: `panopticon.js` — formula single-home + corpus store

**Files:**
- Create: `src/terminal/lib/panopticon.js`
- Test: `tests/panopticon.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/panopticon.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  computePanopticonIndex,
  setPanopticonCorpus,
  getPanopticonState,
  subscribePanopticon,
  _resetForTests,
} from '../src/terminal/lib/panopticon.js';

describe('computePanopticonIndex', () => {
  it('matches the SurveillanceTab formula on severity-shaped (string) items', () => {
    // Σ(sev²)/(n×25)×100 = (25+9+1)/(3×25)×100 = 46.67 → 47
    expect(computePanopticonIndex([{ severity: '5' }, { severity: '3' }, { severity: '1' }])).toBe(47);
  });

  it('accepts sev-shaped (numeric) items — the privacy VECTORS shape', () => {
    // (4+4+0+0+1+4)/(6×25)×100 = 8.67 → 9
    expect(computePanopticonIndex([{ sev: 2 }, { sev: 2 }, { sev: 0 }, { sev: 0 }, { sev: 1 }, { sev: 2 }])).toBe(9);
  });

  it('returns 0 for empty or absent corpus', () => {
    expect(computePanopticonIndex([])).toBe(0);
    expect(computePanopticonIndex(null)).toBe(0);
    expect(computePanopticonIndex(undefined)).toBe(0);
  });

  it('clamps at 100', () => {
    // 81/25×100 = 324 → clamped 100
    expect(computePanopticonIndex([{ severity: '9' }])).toBe(100);
  });

  it('treats non-numeric severity as 0', () => {
    expect(computePanopticonIndex([{ severity: 'garbage' }, {}])).toBe(0);
  });
});

describe('corpus store', () => {
  beforeEach(() => _resetForTests());

  it('is null-index before registration', () => {
    expect(getPanopticonState()).toEqual({ index: null, lawCount: 0 });
  });

  it('registration computes, caches, and notifies subscribers', () => {
    let seen = null;
    subscribePanopticon((s) => { seen = s; });
    setPanopticonCorpus([{ severity: '5' }]);
    expect(getPanopticonState()).toEqual({ index: 100, lawCount: 1 });
    expect(seen).toEqual({ index: 100, lawCount: 1 });
  });

  it('unsubscribe stops notifications', () => {
    let n = 0;
    const un = subscribePanopticon(() => { n += 1; });
    setPanopticonCorpus([]);
    un();
    setPanopticonCorpus([]);
    expect(n).toBe(1);
  });

  it('a throwing subscriber does not break registration', () => {
    subscribePanopticon(() => { throw new Error('boom'); });
    expect(() => setPanopticonCorpus([{ severity: '3' }])).not.toThrow();
    expect(getPanopticonState().index).toBe(36); // 9/25×100
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/panopticon.test.js`
Expected: FAIL — cannot resolve `../src/terminal/lib/panopticon.js`.

- [ ] **Step 3: Implement the module**

Create `src/terminal/lib/panopticon.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/panopticon.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/panopticon.js tests/panopticon.test.js
git commit -m "feat(sovereignty): panopticon formula single-home + corpus store"
```

---

### Task 2: `sovereignty.js` — assessment, redaction topology, last-assessment store

**Files:**
- Create: `src/terminal/lib/sovereignty.js`
- Test: `tests/sovereignty.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/sovereignty.test.js`. Note every numeric expectation is **parameterized against the exported constants** (spec §7 tunability contract) — retuning weights/thresholds must not break this suite:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  RESISTANCE_WEIGHTS,
  REDACTION_MAP,
  CENSOR,
  assessSovereignty,
  redactCard,
  transitTag,
  publishAssessment,
  getLastAssessment,
  subscribeSovereignty,
  _resetSovereigntyForTests,
} from '../src/terminal/lib/sovereignty.js';

const accordOf = (sovereignty, cleanRoom) => ({ sovereignty, cleanRoom });
const expectedResistance = (s, c) =>
  Math.round((s * RESISTANCE_WEIGHTS.sovereignty + c * RESISTANCE_WEIGHTS.cleanRoom) * 100);

const CARD = Object.freeze({
  name: 'TEST × CHIMERA', id: 'a-b-123',
  conc: 'EAU DE PARFUM', concPct: '15–20%', longevity: '6–10 hours',
  topNotes: ['bergamot', 'yuzu'], heartNotes: ['jasmine', 'rose', 'clove'], baseNotes: ['cedar', 'musk'],
  dom: 'floral', sec: 'fresh', hueA: 10, hueB: 200,
  nodeClass: 'RTA', polLabel: 'MERIDIAN', evap: [0.4, 0.35, 0.25],
});

describe('assessSovereignty', () => {
  it('resistance follows RESISTANCE_WEIGHTS', () => {
    const a = assessSovereignty({ panopticonIndex: 61, accord: accordOf(0.4, 0.5) });
    expect(a.resistance).toBe(expectedResistance(0.4, 0.5));
    expect(a.threat).toBe(61);
    expect(a.exposure).toBe(Math.max(0, Math.min(100, Math.round(61 - a.resistance))));
  });

  it('missing scalars default to resistance 0 — maximum vulnerability', () => {
    const a = assessSovereignty({ panopticonIndex: 61, accord: {} });
    expect(a.resistance).toBe(0);
    expect(a.exposure).toBe(61);
    const b = assessSovereignty({ panopticonIndex: 61, accord: null });
    expect(b.resistance).toBe(0);
  });

  it('null threat → OFFLINE verdict, exposure 0, no redactions', () => {
    const a = assessSovereignty({ panopticonIndex: null, accord: accordOf(0.4, 0.5) });
    expect(a.threat).toBeNull();
    expect(a.exposure).toBe(0);
    expect(a.redactions).toEqual([]);
    expect(a.verdict).toBe('PANOPTICON OFFLINE — SEALED WITHOUT ASSESSMENT');
  });

  it('exposure clamps to [0, 100]', () => {
    expect(assessSovereignty({ panopticonIndex: 5, accord: accordOf(1, 1) }).exposure).toBe(0);
    expect(assessSovereignty({ panopticonIndex: 100, accord: accordOf(0, 0) }).exposure).toBe(100);
  });

  it('each threshold fires at exactly its boundary and not one below', () => {
    for (const entry of REDACTION_MAP) {
      // Exposure exactly at threshold: entry fires.
      const at = assessSovereignty({ panopticonIndex: entry.threshold, accord: accordOf(0, 0) });
      expect(at.redactions.some((r) => r.vectorId === entry.vectorId)).toBe(true);
      // One below: entry does not fire.
      const below = assessSovereignty({ panopticonIndex: entry.threshold - 1, accord: accordOf(0, 0) });
      expect(below.redactions.some((r) => r.vectorId === entry.vectorId)).toBe(false);
    }
  });

  it('redaction is cumulative — all entries at or below exposure fire', () => {
    const mid = REDACTION_MAP[2].threshold; // third entry's threshold
    const a = assessSovereignty({ panopticonIndex: mid, accord: accordOf(0, 0) });
    const firedIds = new Set(a.redactions.map((r) => r.vectorId));
    for (const entry of REDACTION_MAP) {
      expect(firedIds.has(entry.vectorId)).toBe(entry.threshold <= mid);
    }
    // Every fired entry contributes ALL its fields.
    const expectedFieldCount = REDACTION_MAP
      .filter((e) => e.threshold <= mid)
      .reduce((n, e) => n + e.fields.length, 0);
    expect(a.redactions).toHaveLength(expectedFieldCount);
  });

  it('is deterministic — same inputs, deep-equal output', () => {
    const args = { panopticonIndex: 61, accord: accordOf(0.31, 0.62) };
    expect(assessSovereignty(args)).toEqual(assessSovereignty(args));
  });

  it('verdict names fired vectors when redacting, CLEAN COMPILE otherwise', () => {
    const clean = assessSovereignty({ panopticonIndex: 10, accord: accordOf(1, 1) });
    expect(clean.verdict).toBe('CLEAN COMPILE — NO FIELDS VAULTED');
    const dirty = assessSovereignty({ panopticonIndex: 100, accord: accordOf(0, 0) });
    for (const entry of REDACTION_MAP) expect(dirty.verdict).toContain(entry.vectorId);
  });
});

describe('redactCard', () => {
  it('returns the same object when there are no redactions', () => {
    expect(redactCard(CARD, [])).toBe(CARD);
    expect(redactCard(CARD, null)).toBe(CARD);
  });

  it('censors note arrays preserving length, strings to CENSOR, evap to zeros', () => {
    const a = assessSovereignty({ panopticonIndex: 100, accord: accordOf(0, 0) }); // everything fires
    const r = redactCard(CARD, a.redactions);
    expect(r.topNotes).toEqual([CENSOR, CENSOR]);
    expect(r.heartNotes).toEqual([CENSOR, CENSOR, CENSOR]);
    expect(r.baseNotes).toEqual([CENSOR, CENSOR]);
    expect(r.longevity).toBe(CENSOR);
    expect(r.concPct).toBe(CENSOR);
    expect(r.nodeClass).toBe(CENSOR);
    expect(r.polLabel).toBe(CENSOR);
    expect(r.evap).toEqual([0, 0, 0]);
    expect(r.__redacted).toEqual(a.redactions.map((x) => x.field));
  });

  it('never touches identity fields and never mutates the original', () => {
    const a = assessSovereignty({ panopticonIndex: 100, accord: accordOf(0, 0) });
    const r = redactCard(CARD, a.redactions);
    expect(r.name).toBe(CARD.name);
    expect(r.id).toBe(CARD.id);
    expect(r.conc).toBe(CARD.conc);
    expect(r.dom).toBe(CARD.dom);
    expect(r.sec).toBe(CARD.sec);
    // Original untouched (CARD is frozen — mutation would have thrown — but verify values too):
    expect(CARD.heartNotes).toEqual(['jasmine', 'rose', 'clove']);
    expect(CARD.evap).toEqual([0.4, 0.35, 0.25]);
  });
});

describe('transitTag', () => {
  it('annotates a redacted field with its claiming vector', () => {
    const a = assessSovereignty({ panopticonIndex: 45, accord: accordOf(0, 0) }); // heartNotes fires at 45
    expect(transitTag(a.redactions, 'heartNotes')).toBe(' [COOKIE_STATUS]');
    expect(transitTag(a.redactions, 'topNotes')).toBe('');
    expect(transitTag(null, 'heartNotes')).toBe('');
  });
});

describe('last-assessment store', () => {
  beforeEach(() => _resetSovereigntyForTests());

  it('starts empty, publishes, notifies, unsubscribes', () => {
    expect(getLastAssessment()).toBeNull();
    let seen = null;
    const un = subscribeSovereignty((a) => { seen = a; });
    const assessment = assessSovereignty({ panopticonIndex: 61, accord: accordOf(0.4, 0.5) });
    publishAssessment(assessment);
    expect(getLastAssessment()).toBe(assessment);
    expect(seen).toBe(assessment);
    un();
    publishAssessment(null);
    expect(seen).toBe(assessment); // no further notification
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sovereignty.test.js`
Expected: FAIL — cannot resolve `../src/terminal/lib/sovereignty.js`.

- [ ] **Step 3: Implement the module**

Create `src/terminal/lib/sovereignty.js`:

```js
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

// Transit annotation for order plaintext blocks: '  [VECTOR_ID]' or ''.
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sovereignty.test.js`
Expected: PASS (13 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass (351 pre-existing + 23 new = 374).

- [ ] **Step 6: Commit**

```bash
git add src/terminal/lib/sovereignty.js tests/sovereignty.test.js
git commit -m "feat(sovereignty): assessment engine, redaction topology, last-assessment store"
```

---

### Task 3: Wire App corpus registration + SurveillanceTab shared formula

**Files:**
- Modify: `src/terminal/App.jsx:248` (registration) and imports
- Modify: `src/terminal/views/SurveillanceTab.jsx:86-94` and imports

- [ ] **Step 1: Register the corpus in App.jsx**

Add to `src/terminal/App.jsx` imports (near the other `./lib/` imports, e.g. next to `import { getGateState, setGateState } from './lib/gateStorage';`):

```js
import { setPanopticonCorpus } from './lib/panopticon';
```

At `App.jsx:248`, directly after:

```js
        setDynamicData({ generatedArticles, academicArticles, legislationArticles, tagIndex: tagsJson, systemArticles: systemJson, manifest });
```

add:

```js
        // Register the legislation corpus with the shared panopticon module —
        // SurveillanceTab, PrivacyTab, and the sovereignty assessment all read
        // this single score (spec §1). Until this line runs, index is null
        // (degraded mode: compiles seal without assessment).
        setPanopticonCorpus(legislationArticles);
```

- [ ] **Step 2: SurveillanceTab reads the shared formula**

In `src/terminal/views/SurveillanceTab.jsx`, add import:

```js
import { computePanopticonIndex } from '../lib/panopticon';
```

Replace lines 86-94:

```js
  // ── Panopticon Index — Σ(sev²) / (n × 25) × 100 ─────────────────────────
  const panopticonIndex = useMemo(() => {
    if (!legislationArticles.length) return 0;
    const sum = legislationArticles.reduce((acc, a) => {
      const s = parseInt(a.severity, 10) || 0;
      return acc + s * s;
    }, 0);
    return Math.min(100, Math.round(sum / (legislationArticles.length * 25) * 100));
  }, [legislationArticles]);
```

with:

```js
  // ── Panopticon Index — shared formula home: src/terminal/lib/panopticon.js ─
  const panopticonIndex = useMemo(
    () => computePanopticonIndex(legislationArticles),
    [legislationArticles]
  );
```

(Everything downstream — color thresholds at `:209`, the `/100 · Panopticon Index` label at `:472` — keeps using the `panopticonIndex` variable unchanged. The rendered number is identical: the shared function is a verbatim extraction of this formula, covered by Task 1's string-severity test.)

- [ ] **Step 3: Verify**

Run: `npm test` — expected: 374 passing, nothing broken.
Run: `npm run lint` — expected: no new warnings/errors in `App.jsx` or `SurveillanceTab.jsx` (pre-existing repo-wide lint noise in unrelated test files is not a regression).

- [ ] **Step 4: Commit**

```bash
git add src/terminal/App.jsx src/terminal/views/SurveillanceTab.jsx
git commit -m "feat(sovereignty): register corpus in App, SurveillanceTab reads shared formula"
```

---

### Task 4: PrivacyTab goes live

**Files:**
- Modify: `src/terminal/views/PrivacyTab.jsx` (delete constant `:77-80`, live score, claim lines, LAST ASSESSMENT row, SVG counter)

- [ ] **Step 1: Imports + live state hooks**

Change line 1 and add lib imports:

```js
import React, { useState, useEffect } from 'react';
import { Lock, Shield, Eye, Database, ShieldAlert, AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react';
import { getPanopticonState, subscribePanopticon } from '../lib/panopticon';
import { getLastAssessment, subscribeSovereignty, REDACTION_MAP } from '../lib/sovereignty';
```

(Keep whichever lucide icons the file actually uses — do not drop existing ones.)

Delete the module-load constant at lines 77-80:

```js
// Panopticon Index: Σ(sev²) / (n × 25) × 100
const panopticonScore = Math.round(
  VECTORS.reduce((acc, v) => acc + v.sev * v.sev, 0) / (VECTORS.length * 25) * 100
);
```

Inside the `PrivacyTab` component body (`const PrivacyTab = ({ systemArticles = {} }) => {` at `:84`), add as the first lines:

```js
  const [pan, setPan]   = useState(getPanopticonState);
  const [last, setLast] = useState(getLastAssessment);
  useEffect(() => subscribePanopticon(setPan), []);
  useEffect(() => subscribeSovereignty(setLast), []);
  const panopticonScore = pan.index; // null until the legislation corpus registers
```

- [ ] **Step 2: Live score in the panel header**

At the mini score block (`:250-259`), replace `{panopticonScore}` (line 256) with `{panopticonScore ?? '—'}` and replace the sub-label line:

```jsx
              <div className="text-[8px] tracking-widest text-orange-400/40 uppercase">/ 100 · P-INDEX</div>
```

with:

```jsx
              <div className="text-[8px] tracking-widest text-orange-400/40 uppercase">
                {panopticonScore == null ? 'CORPUS OFFLINE' : '/ 100 · LIVE P-INDEX'}
              </div>
```

- [ ] **Step 3: Rewrite the context blurb**

The old blurb (`:263-270`) describes the deleted local constant ("operator-controlled surface of near-zero active surveillance"). Replace the inner text so it describes the live corpus score:

```jsx
          {/* Context blurb */}
          <div className="px-6 py-4 border-b border-orange-900/20 text-xs font-mono text-orange-400/60 leading-relaxed">
            <span className="text-orange-500">{'>_'}</span>{' '}
            The Panopticon is no longer architectural — it is infrastructural. This score is computed{' '}
            <span className="text-orange-300 font-bold">live</span> over the{' '}
            <span className="text-orange-300 font-bold">{pan.lawCount}</span> active statutes of the{' '}
            <span className="text-orange-300 font-bold">SURVEILLANCE_INDEX</span> corpus —{' '}
            <span className="text-cyan-400 font-bold">Σ(sev²) / (n × 25) × 100</span> — the same number the
            surveillance kernel renders. It is the environmental load every crystallized accord is assessed
            against: exposure above a vector's threshold vaults that vector's fields behind the censor bar.
          </div>
```

- [ ] **Step 4: LAST ASSESSMENT row**

Directly after the context blurb `</div>` and before the `{/* Vector cards */}` comment, insert:

```jsx
          {/* Last sovereignty assessment (spec §5) */}
          <div className="px-6 py-3 border-b border-orange-900/20 text-[10px] font-mono tracking-widest" style={{ color: 'rgba(6,182,212,0.7)' }}>
            {last
              ? `LAST ASSESSMENT ▸ EXPOSURE ${last.exposure} · ${last.redactions.length} FIELDS VAULTED${
                  last.redactions.length
                    ? ` · VECTORS FIRED: ${[...new Set(last.redactions.map((r) => r.vectorId))].join(' + ')}`
                    : ''
                }`
              : 'NO COMPILATION ASSESSED THIS SESSION'}
          </div>
```

- [ ] **Step 5: Vector claim lines**

Inside the `VECTORS.map((v) => { ... })` card body (after the existing `detail` paragraph, wherever the card's inner column ends), add:

```jsx
                  {(() => {
                    const m = REDACTION_MAP.find((e) => e.vectorId === v.id);
                    return m ? (
                      <div className="mt-2 text-[9px] font-mono tracking-widest text-cyan-400/50">
                        CLAIMS AT EXPOSURE ≥ {m.threshold} ▸ {m.fields.join(' · ')}
                      </div>
                    ) : null;
                  })()}
```

(All six VECTORS ids have a REDACTION_MAP entry, so this renders on every card; the find-guard keeps it safe if either list changes.)

- [ ] **Step 6: SVG NO DATA counter**

At `:173-176`, replace the arrow text:

```jsx
                  <text x={(arrow.x1 + arrow.x2) / 2} y={42} textAnchor="middle"
                        fill="#06b6d4" fontSize="8" fontFamily="monospace" opacity="0.6">
                    NO DATA
                  </text>
```

with:

```jsx
                  <text x={(arrow.x1 + arrow.x2) / 2} y={42} textAnchor="middle"
                        fill="#06b6d4" fontSize="8" fontFamily="monospace" opacity="0.6">
                    {`NO DATA${last?.redactions?.length ? ` · ${last.redactions.length} VAULTED` : ''}`}
                  </text>
```

(The SVG lives inside the component render, so `last` is in scope; if the SVG is currently rendered above the hooks' insertion point that's fine — hooks are declared at the top of the component body.)

- [ ] **Step 7: Verify + commit**

Run: `npm test` (374 passing) and `npm run lint` (no new problems in `PrivacyTab.jsx`).

```bash
git add src/terminal/views/PrivacyTab.jsx
git commit -m "feat(sovereignty): privacy tab live — shared index, claim thresholds, last assessment"
```

---

### Task 5: LatentCollider — assessment at crystallize, censor rendering, redacted transit

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx` (imports; `handleCrystallize` `:1149-1174`; `handleAcquire` `:1176+`; card mount `:3269-3296`; `TesseractCard` `:3934+`)

- [ ] **Step 1: Imports + sovereign-view state**

Add to the import block at the top of `LatentCollider.jsx` (after line 14):

```js
import { getPanopticonState } from '../lib/panopticon';
import { assessSovereignty, redactCard, publishAssessment, transitTag } from '../lib/sovereignty';
```

In the component that declares `const [crystal, setCrystal] = useState(null);` (`:1135`), add alongside it:

```js
  const [sovereignView, setSovereignView] = useState(false);
```

- [ ] **Step 2: Assessment in `handleCrystallize`**

Inside the existing tesseract `try` block (`:1159-1168`), after `const profile = await buildTesseractProfile(...)` and **before** `setTesseract(profile)`, insert:

```js
      // ── Sovereignty assessment — stage 5: panopticon load on this compile ──
      // Never blocks or breaks crystallize (spec §6): failure degrades to the
      // OFFLINE verdict. The encryptedFormula above was built from the FULL
      // card — the vault always holds the complete formula.
      try {
        const { index, lawCount } = getPanopticonState();
        const assessment = assessSovereignty({ panopticonIndex: index, accord: result.accord });
        profile.sovereignty = { ...assessment, panopticonIndexAtSeal: index, lawCount, sealedAt: Date.now() };
      } catch (e) {
        console.error('[SOVEREIGNTY] assessment failed:', e);
        profile.sovereignty = {
          threat: null, resistance: 0, exposure: 0, redactions: [],
          verdict: 'PANOPTICON OFFLINE — SEALED WITHOUT ASSESSMENT',
          panopticonIndexAtSeal: null, lawCount: 0, sealedAt: Date.now(),
        };
      }
      publishAssessment(profile.sovereignty);
      setSovereignView(false);
```

(`setTesseract(profile)` then ships the profile with its `sovereignty` block. The existing outer catch that nulls tesseract is unchanged.)

- [ ] **Step 3: Redacted transit blocks in `handleAcquire`**

At `:1195`, after `const card = crystal; if (!card) return;`, insert:

```js
    // ── Sovereignty: plaintext leaving the browser ships redacted; the
    // RSA-OAEP encryptedPayload below already carries the complete formula
    // (redacted-in-transit, complete-in-vault — spec §3).
    const sovereignty = tesseract?.sovereignty;
    const redactionList = sovereignty?.redactions ?? [];
    const txCard = redactionList.length ? redactCard(card, redactionList) : card;
```

Replace the `noteBlock` construction (`:1213-1217`):

```js
    const noteBlock = [
      `ᛏ TOP    ${card.topNotes.join(' · ')}`,
      `ᚺ HEART  ${card.heartNotes.join(' · ')}`,
      `ᛒ BASE   ${card.baseNotes.join(' · ')}`,
    ].join('\n');
```

with:

```js
    const noteBlock = [
      `ᛏ TOP    ${txCard.topNotes.join(' · ')}${transitTag(redactionList, 'topNotes')}`,
      `ᚺ HEART  ${txCard.heartNotes.join(' · ')}${transitTag(redactionList, 'heartNotes')}`,
      `ᛒ BASE   ${txCard.baseNotes.join(' · ')}${transitTag(redactionList, 'baseNotes')}`,
    ].join('\n');
```

Replace the `physBlock` construction (`:1219-1225`):

```js
    const physBlock = [
      `CONCENTRATION  ${card.conc} · ${card.concPct}`,
      `LONGEVITY      ${card.longevity}`,
      `NODE CLASS     ${card.nodeClass}`,
      `POLARITY       ${card.polLabel || 'MERIDIAN'}`,
      `DOM / SEC      ${card.dom.toUpperCase()} × ${card.sec.toUpperCase()}`,
    ].join('\n');
```

with:

```js
    const physBlock = [
      `CONCENTRATION  ${txCard.conc} · ${txCard.concPct}${transitTag(redactionList, 'concPct')}`,
      `LONGEVITY      ${txCard.longevity}${transitTag(redactionList, 'longevity')}`,
      `NODE CLASS     ${txCard.nodeClass}${transitTag(redactionList, 'nodeClass')}`,
      `POLARITY       ${txCard.polLabel || 'MERIDIAN'}${transitTag(redactionList, 'polLabel')}`,
      `DOM / SEC      ${txCard.dom.toUpperCase()} × ${txCard.sec.toUpperCase()}`,
    ].join('\n');
```

Extend the `vaultBlock` (`:1227-1233`) with one line before the closing `].join('\n')`:

```js
      `SOVEREIGNTY  EXPOSURE ${sovereignty?.exposure ?? '—'}/100 · ${redactionList.length} FIELDS VAULTED`,
```

In the `orderBody` JSON (`:1239-1254`), add after `vaultBlock,`:

```js
      sovereignty: sovereignty
        ? {
            threat: sovereignty.threat,
            resistance: sovereignty.resistance,
            exposure: sovereignty.exposure,
            redactionCount: redactionList.length,
            panopticonIndexAtSeal: sovereignty.panopticonIndexAtSeal,
          }
        : null,
```

- [ ] **Step 4: Redacted display card at the mount point**

At the card mount (`:3269`), compute the display card and pass sovereignty props. Replace:

```jsx
      {crystal && tesseract ? (
        <TesseractCard
          card={crystal}
```

with:

```jsx
      {crystal && tesseract ? (
        <TesseractCard
          card={
            tesseract.sovereignty?.redactions?.length && !sovereignView
              ? redactCard(crystal, tesseract.sovereignty.redactions)
              : crystal
          }
          fullCard={crystal}
          sovereignty={tesseract.sovereignty}
          sovereignView={sovereignView}
          onToggleSovereignView={() => setSovereignView((v) => !v)}
```

(the remaining existing props — `tesseract`, `narrative`, `acquired`, etc. — stay exactly as they are. `CrystallizeCard` in the `: crystal && (` fallback branch is untouched: no tesseract profile means no assessment.)

- [ ] **Step 5: TesseractCard — strip, toggle, censor tags, evap masking, full-card download**

Update the signature at `:3934`:

```js
function TesseractCard({ card, fullCard = card, sovereignty = null, sovereignView = false, onToggleSovereignView, tesseract, narrative, acquired, selectedTier, onRegister, serverCount, serverTarget, orderStatus, living, onLivingRedeemed }) {
```

In `handleDownload` (`:3941-3956`), the manifest is a local file — client enclave, sovereign zone — so change the one line:

```js
    const md = generateManifestMarkdown(card, tesseract, living);
```

to:

```js
    const md = generateManifestMarkdown(fullCard, tesseract, living); // local file = client enclave: always complete
```

Give `NOTE_LAYERS` (`:3971-3975`) a `field` key:

```js
  const NOTE_LAYERS = [
    { key: 'top',   label: 'TOP',   glyph: 'ᛏ', field: 'topNotes',   notes: card.topNotes,   color: '#FFD700', sub: '0–30 min',    pct: card.evap[0] },
    { key: 'heart', label: 'HEART', glyph: 'ᚺ', field: 'heartNotes', notes: card.heartNotes, color: '#d946ef', sub: '30 min–4 hr', pct: card.evap[1] },
    { key: 'base',  label: 'BASE',  glyph: 'ᛒ', field: 'baseNotes',  notes: card.baseNotes,  color: '#B8860B', sub: '4 hr+',      pct: card.evap[2] },
  ];
```

Insert the **sovereignty strip** immediately after the hash-display block closes (after `:4014`'s `</div>`, before the `{/* ── Name + Bottle ── */}` block):

```jsx
        {/* ── Sovereignty strip (spec §4) — omitted entirely on a clean compile ── */}
        {sovereignty && (sovereignty.redactions.length > 0 || sovereignty.threat === null) && (
          <div
            className="mb-5 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap"
            style={{ border: '1px solid rgba(244,63,94,0.25)', background: 'rgba(244,63,94,0.04)' }}
          >
            <span className="text-[8px] font-mono tracking-widest" style={{ color: 'rgba(244,63,94,0.85)' }}>
              {sovereignty.threat === null
                ? '⛨ PANOPTICON OFFLINE — SEALED WITHOUT ASSESSMENT'
                : `⛨ THREAT ${sovereignty.threat} · RESISTANCE ${sovereignty.resistance} · EXPOSURE ${sovereignty.exposure} · ${sovereignty.redactions.length} FIELDS VAULTED`}
            </span>
            {sovereignty.redactions.length > 0 && (
              <button
                onClick={onToggleSovereignView}
                className="text-[8px] font-mono tracking-widest px-2 py-1 rounded-sm"
                style={{ border: '1px solid rgba(6,182,212,0.4)', color: '#06b6d4', background: 'none', cursor: 'pointer' }}
              >
                {sovereignView
                  ? '◈ SOVEREIGN VIEW · decrypted in client enclave — never transits'
                  : '[SOVEREIGN VIEW]'}
              </button>
            )}
          </div>
        )}
```

In the note-pyramid render (the `NOTE_LAYERS.map(...)` inside TesseractCard's JSX), two point changes:

1. Where the layer header row renders `label`, append a censor tag when that layer is redacted (`card.__redacted` exists only on a redacted display card):

```jsx
                  <span className="text-[9px] font-bold font-mono tracking-widest" style={{ color: `${color}bb` }}>{label}</span>
                  {card.__redacted?.includes(field) && (
                    <span className="text-[7px] font-mono tracking-widest" style={{ color: 'rgba(244,63,94,0.7)' }}>
                      [{sovereignty?.redactions?.find((r) => r.field === field)?.vectorId}]
                    </span>
                  )}
```

2. Where the percentage renders (`{(pct * 100).toFixed(0)}%`), mask when evap is redacted:

```jsx
                  <span className="text-[7px] font-mono" style={{ color: `${color}50` }}>
                    {card.__redacted?.includes('evap') ? '██' : `${(pct * 100).toFixed(0)}%`}
                  </span>
```

(Redacted string fields — `longevity`, `concPct`, `nodeClass`, `polLabel` — need **no** render changes anywhere: `redactCard` already replaced their values with `██████`, and every render site prints them as plain strings. The note arrays likewise render their `██████` entries through the existing `.join`/`.map` paths.)

- [ ] **Step 6: Verify + commit**

Run: `npm test` (374 passing) and `npm run lint` (no new problems in `LatentCollider.jsx`).

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(sovereignty): stage-5 assessment at crystallize — censor bars, sovereign view, redacted transit"
```

---

### Task 6: Verification — suite, lint, browser, calibration sampling

**Files:** none (verification only; a retune of `sovereignty.js` constants is permitted if calibration misses the band)

- [ ] **Step 1: Full suite + lint**

Run: `npm test` → 374 passing. Run: `npm run lint` → no new problems in the six touched files.

- [ ] **Step 2: Start the dev server, open the terminal site**

Use the `scale94-dev` launch config (port 5174). Bypass the access gate via `localStorage.setItem('scale94.gate','passed')` + reload. Note: the boot animation's rAF loop stalls when the automated tab is unfocused (`document.hidden`) — if the app appears stuck at `transform: scale(1.8); opacity: 0`, neutralize with `document.querySelector('.flex.flex-col.flex-grow').style.transform='none'` + `.style.opacity='1'` (known harness quirk, not a bug). Also dispatch `window.dispatchEvent(new Event('resize'))` after any viewport resize — the app's width hooks listen for the event.

- [ ] **Step 3: Index parity**

Surveillance tab and Privacy tab must render the **same** live P-INDEX number (the corpus-derived score, 61 at time of writing). Privacy tab additionally shows the statute count in its blurb and `NO COMPILATION ASSESSED THIS SESSION`.

- [ ] **Step 4: Calibration sampling (spec §7 acceptance criterion)**

In the Scaling tab, run collisions and crystallize across **≥10 distinct domain pairs**. For each, record the strip's EXPOSURE value (or note a clean compile). **Acceptance: the majority land in the 15–40 exposure window (1–2 vaulted field groups).** If the OCK scalars skew high (mostly clean compiles — critique invisible) or low (3+ groups vaulted routinely — blackout-heavy), retune `RESISTANCE_WEIGHTS`/`REDACTION_MAP` thresholds in `src/terminal/lib/sovereignty.js`, re-run `npm test` (suite is parameterized — must stay green without edits), commit the retune as `tune(sovereignty): calibrate to 15–40 exposure band`, and re-sample.

- [ ] **Step 5: Redaction mechanics at forced-high exposure**

Temporarily set `RESISTANCE_WEIGHTS` to `{ sovereignty: 0, cleanRoom: 0 }` (resistance 0 → exposure = live index = 61 → three vectors fire: evap, longevity/concPct, heartNotes, nodeClass/polLabel). Verify on a fresh crystallize:
- Censor bars (`██████`) render for heart notes with the `[COOKIE_STATUS]` tag; longevity/conc% and node class/polarity show bars; evap percentages show `██` and flat bars.
- The strip reads `⛨ THREAT 61 · RESISTANCE 0 · EXPOSURE 61 · 6 FIELDS VAULTED` with the `[SOVEREIGN VIEW]` button.
- Toggling SOVEREIGN VIEW reveals the full card with the "never transits" label; toggling back re-censors.
- Register/acquire flow: the dispatched order body's `noteBlock` contains censored lines + vector tags while `encryptedPayload` is non-trivial (complete formula); `vaultBlock` has the SOVEREIGNTY line.
- Privacy tab now shows the LAST ASSESSMENT row with fired vectors and the SVG `NO DATA · 6 VAULTED` counter.
- **Revert the weights** and confirm `git diff` on `sovereignty.js` is clean (or only the deliberate Task-6 retune remains).

- [ ] **Step 6: Offline degradation**

Block the legislation fetch (DevTools request blocking on `/kernel/legislation*`, or temporarily rename the manifest key) and reload: Surveillance tab index reads 0, Privacy tab reads `— · CORPUS OFFLINE`, and a crystallize seals with the `⛨ PANOPTICON OFFLINE — SEALED WITHOUT ASSESSMENT` strip and zero redactions. Unblock and confirm recovery.

- [ ] **Step 7: Desktop + mobile spot-check**

At 1400×1000 and 375×812: strip and censor bars wrap cleanly inside the card (`flex-wrap` on the strip), no horizontal scroll introduced.
