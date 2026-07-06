# Council Collision Synthesis Engine (SKS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User-driven Council Ring collisions producing the full staged synthesis breakdown (Shared Ground & Innovation Frontier / Semantic Vectors & Open Questions / Sanctuaries & Prompt Fragments) under the Sovereign Kernel Standard: polymorphic 16-D input, append-only versioned ledger, zero state leaks.

**Architecture:** Shared analysis cores extracted from `nodeFeatures.js` (vector-parameterized, ID functions delegate — zero Scaling change); a pure council-voiced synthesis engine; an SKS ledger as the single source of persistent truth; a pure state-machine reducer consumed by the extended RAF hook (animation gate); new sidebar/panel components in a 3-column grid. Spec: `docs/superpowers/specs/2026-07-06-council-synthesis-engine-design.md`.

**Tech Stack:** React 18 (JSX, no TS), canvas 2D, vitest, localStorage. No new dependencies.

**Conventions:** Tests in `__tests__/` next to sources; run one file with `npx vitest run <path>`. No runtime `Math.random()` in this feature. Do NOT run repo-wide `npm run lint` (~570 pre-existing problems) — lint only the files you touch (`npx eslint <files>`, must be 0 errors 0 warnings). Commit after every task; **never push**. Branch: `feat/council-synthesis-engine`.

**Existing contracts you will consume (already on the branch):**
- `data/sixteenMinds.js`: `SIXTEEN_MINDS` (16 minds: `dimIndex, dimName, anchorName, era, caste, coreEquation, systemDirective, epigraph, body, affinities, keyWorks, excerpt`), `mindProfile(mind)` → `Float32Array(16)`.
- `manifesto/councilCollider.js`: `mulberry32(seed)`, `expand(vec16)`, `collide(a1536, b1536)` → `{cosine, byDim, energies:{social,bio}, trajectory:'FOUNDATION'|'CEILING', dominantDim}`, `pickPair(ordinal, biasIdx)`, `composeLine(mindA, mindB, collision, ordinal)`, constants `DIMS/BLOCK/EXPANDED/SOCIAL_DIMS`.
- `manifesto/councilBus.js`: `councilBus.emit/on/_resetForTests` (bounded pending buffer).
- `manifesto/councilRingMath.js`: `polarToXY(angleDeg, radius, cx, cy)`.
- `manifesto/useCouncilCollider.js` (Phase 1): RAF sim, phases IDLE→INFALL→FLASH→EJECT→COOLDOWN — Task 8 replaces this file wholesale with the code given there.
- `hooks/useColliderNarrative.js`: contains `DIM_SEMANTIC` (lines ~16-33) and `detectPeriod3Sanctuaries` (~lines 310-335) which Tasks 1-2 relocate.

---

### Task 1: Extract DIM_SEMANTIC to `data/dimSemantics.js`

**Files:**
- Create: `src/terminal/data/dimSemantics.js`
- Modify: `src/terminal/hooks/useColliderNarrative.js` (top of file)
- Test: `src/terminal/data/__tests__/dimSemantics.test.js` (create)

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/data/__tests__/dimSemantics.test.js
import { describe, it, expect } from 'vitest';
import { DIM_SEMANTIC } from '../dimSemantics';
import { DIM_NAMES } from '../nodeFeatures';

describe('dimSemantics', () => {
  it('covers exactly the 16 legacy dims with tag/converge/diverge', () => {
    const legacy = DIM_NAMES.slice(0, 16);
    expect(Object.keys(DIM_SEMANTIC).sort()).toEqual([...legacy].sort());
    for (const name of legacy) {
      expect(typeof DIM_SEMANTIC[name].tag).toBe('string');
      expect(typeof DIM_SEMANTIC[name].converge).toBe('string');
      expect(typeof DIM_SEMANTIC[name].diverge).toBe('string');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/data/__tests__/dimSemantics.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/terminal/data/dimSemantics.js`**

Cut the ENTIRE `DIM_SEMANTIC` const from `src/terminal/hooks/useColliderNarrative.js` (the block starting `const DIM_SEMANTIC = {` with all 16 entries `dynamical … economic`) and paste it VERBATIM into the new file with this header, adding `export`:

```js
// src/terminal/data/dimSemantics.js
// Shared dimension vocabulary for both narrative engines (Scaling's
// useColliderNarrative and the Council synthesis engine). Each legacy dim
// maps to a conceptual tag plus converge/diverge narrative fragments.
export const DIM_SEMANTIC = {
  // ... the 16 entries, byte-for-byte as they were in useColliderNarrative.js ...
};
```

- [ ] **Step 4: Update `useColliderNarrative.js`**

Remove the local `DIM_SEMANTIC` const; add to the imports at top:

```js
import { DIM_SEMANTIC } from '../data/dimSemantics';
```

- [ ] **Step 5: Run tests to verify pass + no Scaling regression**

Run: `npx vitest run src/terminal/data/__tests__/dimSemantics.test.js && npx vitest run`
Expected: new test PASS; full suite 279+ all PASS.

- [ ] **Step 6: Lint and commit**

Run: `npx eslint src/terminal/data/dimSemantics.js src/terminal/hooks/useColliderNarrative.js` → 0 problems.

```bash
git add src/terminal/data/dimSemantics.js src/terminal/data/__tests__/dimSemantics.test.js src/terminal/hooks/useColliderNarrative.js
git commit -m "refactor(terminal): extract DIM_SEMANTIC to shared dimSemantics module"
```

---

### Task 2: nodeFeatures vector cores + sanctuary relocation

**Files:**
- Modify: `src/terminal/data/nodeFeatures.js` (functions `analyzeFullEdge` ~line 774, `extractParadoxes` ~line 790)
- Modify: `src/terminal/hooks/useColliderNarrative.js` (remove local `detectPeriod3Sanctuaries`, import instead)
- Test: `src/terminal/data/__tests__/nodeFeatureCores.test.js` (create)

- [ ] **Step 1: Write the failing tests**

```js
// src/terminal/data/__tests__/nodeFeatureCores.test.js
import { describe, it, expect } from 'vitest';
import {
  FEATURES, NODE_IDX,
  analyzeFullEdge, extractParadoxes,
  fullEdgeFromVectors, paradoxesFromVectors, detectPeriod3Sanctuaries,
} from '../nodeFeatures';

const anyTwoIds = () => {
  const ids = Object.keys(NODE_IDX);
  return [ids[0], ids[3]];
};

describe('vector cores delegate identically (Scaling regression guard)', () => {
  it('analyzeFullEdge(idA,idB) ≡ fullEdgeFromVectors on the same FEATURES rows', () => {
    const [idA, idB] = anyTwoIds();
    const byId = analyzeFullEdge(idA, idB);
    const byVec = fullEdgeFromVectors(FEATURES[NODE_IDX[idA]], FEATURES[NODE_IDX[idB]]);
    expect(byVec.sim).toBe(byId.sim);
    expect(byVec.dims).toEqual(byId.dims);
    expect(byVec.drivers).toEqual(byId.drivers);
  });

  it('extractParadoxes(idA,idB) ≡ paradoxesFromVectors on the same FEATURES rows', () => {
    const [idA, idB] = anyTwoIds();
    const byId = extractParadoxes(idA, idB);
    const byVec = paradoxesFromVectors(FEATURES[NODE_IDX[idA]], FEATURES[NODE_IDX[idB]]);
    expect(byVec.finalSim).toBe(byId.finalSim);
    expect(byVec.paradoxes).toEqual(byId.paradoxes);
  });
});

describe('cores handle 16-D council profiles', () => {
  const mk = (self) => { const v = new Float32Array(16).fill(0.05); v[self] = 1.0; v[(self + 5) % 16] = 0.5; return v; };

  it('fullEdgeFromVectors on 16-D vectors returns exactly 16 dims', () => {
    const r = fullEdgeFromVectors(mk(0), mk(4));
    expect(r.dims).toHaveLength(16);
    expect(r.drivers.length).toBeGreaterThan(0);
    expect(r.sim).toBeGreaterThan(-1.001);
  });

  it('paradoxesFromVectors on 16-D vectors returns residuals over 16 dims only', () => {
    const r = paradoxesFromVectors(mk(0), mk(8));
    for (const p of r.paradoxes) expect(p.i).toBeLessThan(16);
  });
});

describe('detectPeriod3Sanctuaries (relocated)', () => {
  it('clusters 3+ paradoxes within the band into a sanctuary', () => {
    const paradoxes = [
      { name: 'a', residual: 0.10 }, { name: 'b', residual: 0.12 },
      { name: 'c', residual: 0.13 }, { name: 'd', residual: 0.40 },
    ];
    const s = detectPeriod3Sanctuaries(paradoxes, 0.05);
    expect(s).toHaveLength(1);
    expect(s[0].members.sort()).toEqual(['a', 'b', 'c']);
    expect(s[0].size).toBe(3);
  });

  it('returns [] for fewer than 3 paradoxes', () => {
    expect(detectPeriod3Sanctuaries([{ name: 'a', residual: 0.1 }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/data/__tests__/nodeFeatureCores.test.js`
Expected: FAIL — `fullEdgeFromVectors` not exported.

- [ ] **Step 3: Refactor `nodeFeatures.js`**

Replace `analyzeFullEdge` (currently ~lines 774-787) and `extractParadoxes` (~lines 790-813) with delegating versions plus exported cores. The cores iterate `Math.min(a.length, b.length)` so 16-D council profiles and 32-D FEATURES rows both work:

```js
// ── Layer 4.4.4.4 — full tensor manifest (vector core + ID delegation) ───────
export function fullEdgeFromVectors(fA, fB) {
  const len = Math.min(fA.length, fB.length);
  const sim = cosineSim(fA, fB);
  const dims = [];
  for (let i = 0; i < len; i++) {
    dims.push({
      name: DIM_NAMES[i] || `dim_${i}`, i,
      vA: fA[i], vB: fB[i],
      delta: Math.abs(fA[i] - fB[i]),
      contrib: fA[i] * fB[i],
    });
  }
  const drivers = [...dims].sort((a, b) => b.contrib - a.contrib).slice(0, 5);
  return { sim, dims, drivers };
}

export function analyzeFullEdge(idA, idB) {
  const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
  if (iA == null || iB == null) return null;
  const core = fullEdgeFromVectors(FEATURES[iA], FEATURES[iB]);
  return { idA, idB, ...core };
}

// ── Layer 5.5.5.5.5 — paradox extraction (vector core + ID delegation) ───────
export function paradoxesFromVectors(vecA, vecB) {
  const len = Math.min(vecA.length, vecB.length);
  const fA = Array.from(vecA).slice(0, len), fB = Array.from(vecB).slice(0, len);
  const origDeltas = fA.map((v, i) => Math.abs(v - fB[i]));

  for (let iter = 0; iter < 64; iter++) {
    const deltas = fA.map((v, i) => Math.abs(v - fB[i]));
    const maxVal = Math.max(...deltas);
    if (maxVal < 0.02) break;
    const maxIdx = deltas.indexOf(maxVal);
    const mid = (fA[maxIdx] + fB[maxIdx]) / 2;
    fA[maxIdx] = mid + (fA[maxIdx] - mid) * 0.93;
    fB[maxIdx] = mid + (fB[maxIdx] - mid) * 0.93;
  }

  const finalSim = cosineSim(fA, fB);
  const paradoxes = fA
    .map((v, i) => ({ name: DIM_NAMES[i] || `dim_${i}`, i, residual: Math.abs(v - fB[i]), original: origDeltas[i] }))
    .filter(d => d.residual > 0.08)
    .sort((a, b) => b.residual - a.residual);

  return { finalSim, paradoxes };
}

export function extractParadoxes(idA, idB) {
  const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
  if (iA == null || iB == null) return null;
  const core = paradoxesFromVectors(FEATURES[iA], FEATURES[iB]);
  return { idA, idB, ...core };
}
```

Delegation-equivalence caution: the original `extractParadoxes` copied rows with `[...FEATURES[iA]]` — plain arrays. `Array.from(vecA).slice(0, len)` is identical for arrays; verify FEATURES rows are plain 32-length arrays (they are — authored literals). The original `analyzeFullEdge` mapped over all `DIM_NAMES` (32) which equals FEATURES row length, so `Math.min` preserves behavior exactly.

Then MOVE `detectPeriod3Sanctuaries` from `useColliderNarrative.js` into `nodeFeatures.js` verbatim (keep its full doctrine comment block), adding `export`. In `useColliderNarrative.js`, delete the local copy and extend the existing import:

```js
import { DIM_NAMES, detectPeriod3Sanctuaries } from '../data/nodeFeatures';
```

- [ ] **Step 4: Run tests to verify pass + full suite green**

Run: `npx vitest run src/terminal/data/__tests__/nodeFeatureCores.test.js && npx vitest run`
Expected: new tests PASS; full suite PASS (Scaling untouched behaviorally).

- [ ] **Step 5: Lint and commit**

Run: `npx eslint src/terminal/data/nodeFeatures.js src/terminal/hooks/useColliderNarrative.js` → 0 new problems in the touched regions (nodeFeatures.js has pre-existing issues elsewhere in the file — only ensure your edit introduces none; if the file's pre-existing state already errors, report counts before/after your change instead).

```bash
git add src/terminal/data/nodeFeatures.js src/terminal/hooks/useColliderNarrative.js src/terminal/data/__tests__/nodeFeatureCores.test.js
git commit -m "refactor(terminal): vector-parameterized analysis cores + sanctuary relocation"
```

---

### Task 3: Extract CopySpan to shared component

**Files:**
- Create: `src/terminal/components/CopySpan.jsx`
- Modify: `src/terminal/views/LatentCollider.jsx` (lines ~15-32: the `CopySpan` function)

- [ ] **Step 1: Create `src/terminal/components/CopySpan.jsx`**

Move the `CopySpan` component from `LatentCollider.jsx` verbatim, converting to a default export with a proper React import:

```jsx
// src/terminal/components/CopySpan.jsx
// Tiny clipboard affordance — click to copy, brief COPIED confirmation.
import React from 'react';

export default function CopySpan({ value, color }) {
  const [copied, setCopied] = React.useState(false);
  const handleClick = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <span
      onClick={handleClick}
      style={{ color: copied ? `rgba(255,215,0,0.36)` : color, cursor: 'pointer' }}
    >
      {copied ? 'COPIED' : value}
    </span>
  );
}
```

- [ ] **Step 2: Update `LatentCollider.jsx`**

Delete the local `CopySpan` function (and its `── CopySpan` comment banner); add to imports:

```js
import CopySpan from '../components/CopySpan.jsx';
```

- [ ] **Step 3: Verify**

Run: `npx vitest run && npx eslint src/terminal/components/CopySpan.jsx src/terminal/views/LatentCollider.jsx`
Expected: suite green; 0 NEW lint problems (LatentCollider is huge and pre-existing issues may exist — compare before/after if flagged).

- [ ] **Step 4: Commit**

```bash
git add src/terminal/components/CopySpan.jsx src/terminal/views/LatentCollider.jsx
git commit -m "refactor(terminal): extract CopySpan clipboard affordance to shared component"
```

---

### Task 4: councilLedger — SKS append-only versioned ledger

**Files:**
- Create: `src/terminal/views/manifesto/councilLedger.js`
- Test: `src/terminal/views/manifesto/__tests__/councilLedger.test.js` (create)

- [ ] **Step 1: Write the failing tests**

```js
// src/terminal/views/manifesto/__tests__/councilLedger.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { councilLedger, LEDGER_KEY, LEDGER_CAP } from '../councilLedger';

const armEvent = (dimIndex) => ({ v: 1, kind: 'EVENT', event: 'ARM', ts: Date.now(), subject: { kind: 'mind', dimIndex } });
const synthRecord = (id, ordinal) => ({
  v: 1, kind: 'SYNTHESIS', id, ts: Date.now(), ordinal,
  pair: [{ kind: 'mind', dimIndex: 0, anchorName: 'Donella Meadows' }, { kind: 'mind', dimIndex: 4, anchorName: 'Nicholas Georgescu-Roegen' }],
  profiles: [Array(16).fill(0.1), Array(16).fill(0.2)],
  metrics: { cosine: 0.5, novelty: 0.5, energies: { social: 1, bio: 1 }, trajectory: 'CEILING', dominantDim: 4 },
  sections: { sharedGround: {}, frontier: {}, angles: [], openQuestions: [], sanctuaries: [], seeds: [] },
  directive: 'd', line: 'l',
});

describe('councilLedger', () => {
  beforeEach(() => {
    localStorage.clear();
    councilLedger._resetForTests();
  });

  it('appends and lists records in order', () => {
    councilLedger.append(armEvent(0));
    councilLedger.append(synthRecord('s1', 0));
    const all = councilLedger.list();
    expect(all).toHaveLength(2);
    expect(all[0].kind).toBe('EVENT');
    expect(all[1].kind).toBe('SYNTHESIS');
  });

  it('list() returns copies — mutating a listed record does not alter the store', () => {
    councilLedger.append(synthRecord('s1', 0));
    const rec = councilLedger.list()[0];
    rec.directive = 'HACKED';
    expect(councilLedger.list()[0].directive).toBe('d');
  });

  it('filters by kind and returns latest', () => {
    councilLedger.append(armEvent(0));
    councilLedger.append(synthRecord('s1', 0));
    councilLedger.append(armEvent(2));
    expect(councilLedger.list({ kind: 'SYNTHESIS' })).toHaveLength(1);
    expect(councilLedger.latest().event).toBe('ARM');
    expect(councilLedger.latest('SYNTHESIS').id).toBe('s1');
  });

  it('caps at LEDGER_CAP with oldest-first eviction', () => {
    for (let i = 0; i < LEDGER_CAP + 10; i++) councilLedger.append(armEvent(i % 16));
    expect(councilLedger.list()).toHaveLength(LEDGER_CAP);
  });

  it('persists to localStorage and rehydrates on fresh instance', () => {
    councilLedger.append(synthRecord('s1', 0));
    councilLedger._resetForTests({ keepStorage: true });
    expect(councilLedger.list()).toHaveLength(1);
    expect(councilLedger.list()[0].id).toBe('s1');
  });

  it('degrades silently when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => councilLedger.append(armEvent(0))).not.toThrow();
    expect(councilLedger.list()).toHaveLength(1); // in-memory still works
    spy.mockRestore();
  });

  it('notifies subscribers on append', () => {
    const seen = [];
    const off = councilLedger.subscribe(r => seen.push(r.kind));
    councilLedger.append(armEvent(0));
    off();
    councilLedger.append(armEvent(1));
    expect(seen).toEqual(['EVENT']);
  });

  it('deriveUiState: trailing SYNTHESIS (no later ARM/RESET) → SYNTHESIZED with record', () => {
    councilLedger.append(armEvent(0));
    councilLedger.append(synthRecord('s1', 0));
    const st = councilLedger.deriveUiState();
    expect(st.mode).toBe('SYNTHESIZED');
    expect(st.record.id).toBe('s1');
  });

  it('deriveUiState: trailing ARM → ARMED with subject; RESET → AMBIENT; empty → AMBIENT', () => {
    expect(councilLedger.deriveUiState().mode).toBe('AMBIENT');
    councilLedger.append(armEvent(7));
    expect(councilLedger.deriveUiState()).toEqual({ mode: 'ARMED', armed: { kind: 'mind', dimIndex: 7 }, record: null });
    councilLedger.append({ v: 1, kind: 'EVENT', event: 'RESET', ts: Date.now(), subject: null });
    expect(councilLedger.deriveUiState().mode).toBe('AMBIENT');
  });

  it('deriveUiState: DISARM after ARM → AMBIENT', () => {
    councilLedger.append(armEvent(3));
    councilLedger.append({ v: 1, kind: 'EVENT', event: 'DISARM', ts: Date.now(), subject: { kind: 'mind', dimIndex: 3 } });
    expect(councilLedger.deriveUiState().mode).toBe('AMBIENT');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilLedger.test.js`
Expected: FAIL — module not found. (Note: vitest environment is jsdom in this repo, so `localStorage` exists; if the file errors on `localStorage` undefined, check `vitest.config`/`vite.config` for `environment: 'jsdom'` — the observatoryBus/react tests already rely on it.)

- [ ] **Step 3: Implement**

```js
// src/terminal/views/manifesto/councilLedger.js
// SKS §2 Ledger Archive — append-only, versioned, immutable, self-contained
// records for every interactive Council event and computed synthesis.
// SKS §3 Zero State Leaks — deriveUiState() is the single source of truth the
// tab rehydrates from; component state is a cache of this ledger, never the
// other way around. localStorage failures degrade silently to in-memory.

export const LEDGER_KEY = 'scale94.council.ledger.v1';
export const LEDGER_CAP = 256;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(log) {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(log));
  } catch {
    // quota / privacy mode — in-memory log remains authoritative for the session
  }
}

const deepCopy = (x) => JSON.parse(JSON.stringify(x));

export const councilLedger = {
  _log: loadFromStorage(),
  _listeners: [],

  append(record) {
    this._log.push(deepCopy(record)); // immutable: store owns its copy
    if (this._log.length > LEDGER_CAP) this._log.splice(0, this._log.length - LEDGER_CAP);
    saveToStorage(this._log);
    this._listeners.forEach(fn => fn(deepCopy(record)));
  },

  list(filter) {
    let out = this._log;
    if (filter?.kind) out = out.filter(r => r.kind === filter.kind);
    return out.map(deepCopy);
  },

  latest(kind) {
    for (let i = this._log.length - 1; i >= 0; i--) {
      if (!kind || this._log[i].kind === kind) return deepCopy(this._log[i]);
    }
    return null;
  },

  subscribe(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  },

  // SKS §3 — derive the tab's persistent UI state from the ledger head.
  // Walk backward: the first decisive entry wins.
  //   SYNTHESIS            → SYNTHESIZED (restore pair + panel)
  //   EVENT ARM            → ARMED (restore armed mind)
  //   EVENT RESET/DISARM   → AMBIENT
  deriveUiState() {
    for (let i = this._log.length - 1; i >= 0; i--) {
      const r = this._log[i];
      if (r.kind === 'SYNTHESIS') return { mode: 'SYNTHESIZED', armed: null, record: deepCopy(r) };
      if (r.kind === 'EVENT') {
        if (r.event === 'ARM') return { mode: 'ARMED', armed: deepCopy(r.subject), record: null };
        if (r.event === 'RESET' || r.event === 'DISARM') return { mode: 'AMBIENT', armed: null, record: null };
        // FIRE events are transitional — keep walking back
      }
    }
    return { mode: 'AMBIENT', armed: null, record: null };
  },

  _resetForTests(opts = {}) {
    this._listeners = [];
    this._log = opts.keepStorage ? loadFromStorage() : [];
    if (!opts.keepStorage) saveToStorage(this._log);
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilLedger.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Lint and commit**

Run: `npx eslint src/terminal/views/manifesto/councilLedger.js` → 0 problems.

```bash
git add src/terminal/views/manifesto/councilLedger.js src/terminal/views/manifesto/__tests__/councilLedger.test.js
git commit -m "feat(manifesto): SKS councilLedger — append-only versioned ledger + rehydration"
```

---

### Task 5: councilStateMachine — pure interaction reducer

**Files:**
- Create: `src/terminal/views/manifesto/councilStateMachine.js`
- Test: `src/terminal/views/manifesto/__tests__/councilStateMachine.test.js` (create)

- [ ] **Step 1: Write the failing tests**

```js
// src/terminal/views/manifesto/__tests__/councilStateMachine.test.js
import { describe, it, expect } from 'vitest';
import { initialCouncilState, councilReducer } from '../councilStateMachine';

describe('councilReducer', () => {
  it('AMBIENT + NODE_CLICK → ARMED with that mind', () => {
    const s = councilReducer(initialCouncilState, { type: 'NODE_CLICK', dimIndex: 3 });
    expect(s).toEqual({ mode: 'ARMED', armedDim: 3, pair: null, record: null });
  });

  it('ARMED + click same node → AMBIENT (disarm)', () => {
    let s = councilReducer(initialCouncilState, { type: 'NODE_CLICK', dimIndex: 3 });
    s = councilReducer(s, { type: 'NODE_CLICK', dimIndex: 3 });
    expect(s.mode).toBe('AMBIENT');
    expect(s.armedDim).toBeNull();
  });

  it('ARMED + click different node → FIRING with ordered pair', () => {
    let s = councilReducer(initialCouncilState, { type: 'NODE_CLICK', dimIndex: 3 });
    s = councilReducer(s, { type: 'NODE_CLICK', dimIndex: 9 });
    expect(s).toEqual({ mode: 'FIRING', armedDim: null, pair: [3, 9], record: null });
  });

  it('FIRING ignores node clicks (input lock)', () => {
    let s = { mode: 'FIRING', armedDim: null, pair: [3, 9], record: null };
    expect(councilReducer(s, { type: 'NODE_CLICK', dimIndex: 1 })).toBe(s);
  });

  it('FIRING + SYNTHESIS_READY → SYNTHESIZED carrying the record', () => {
    let s = { mode: 'FIRING', armedDim: null, pair: [3, 9], record: null };
    s = councilReducer(s, { type: 'SYNTHESIS_READY', record: { id: 'r1' } });
    expect(s.mode).toBe('SYNTHESIZED');
    expect(s.record.id).toBe('r1');
    expect(s.pair).toEqual([3, 9]);
  });

  it('SYNTHESIZED + NODE_CLICK → ARMED (new cycle), record retained until replaced', () => {
    let s = { mode: 'SYNTHESIZED', armedDim: null, pair: [3, 9], record: { id: 'r1' } };
    s = councilReducer(s, { type: 'NODE_CLICK', dimIndex: 5 });
    expect(s.mode).toBe('ARMED');
    expect(s.armedDim).toBe(5);
    expect(s.record).toEqual({ id: 'r1' }); // panel persists while re-arming
  });

  it('RESET from any state → AMBIENT, everything cleared', () => {
    for (const from of [
      initialCouncilState,
      { mode: 'ARMED', armedDim: 2, pair: null, record: null },
      { mode: 'SYNTHESIZED', armedDim: null, pair: [1, 2], record: { id: 'r' } },
    ]) {
      expect(councilReducer(from, { type: 'RESET' })).toEqual(initialCouncilState);
    }
  });

  it('ARMED + TIMEOUT → AMBIENT; other states ignore TIMEOUT', () => {
    const armed = { mode: 'ARMED', armedDim: 2, pair: null, record: null };
    expect(councilReducer(armed, { type: 'TIMEOUT' }).mode).toBe('AMBIENT');
    const synth = { mode: 'SYNTHESIZED', armedDim: null, pair: [1, 2], record: { id: 'r' } };
    expect(councilReducer(synth, { type: 'TIMEOUT' })).toBe(synth);
  });

  it('HYDRATE replaces state wholesale', () => {
    const s = councilReducer(initialCouncilState, {
      type: 'HYDRATE',
      state: { mode: 'SYNTHESIZED', armedDim: null, pair: [0, 4], record: { id: 'x' } },
    });
    expect(s.mode).toBe('SYNTHESIZED');
    expect(s.record.id).toBe('x');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilStateMachine.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/terminal/views/manifesto/councilStateMachine.js
// Pure interaction reducer for the Council collider (spec §1).
// AMBIENT → ARMED → FIRING → SYNTHESIZED. No side effects here — the hook
// performs ledger appends / animations and dispatches results back in.

export const initialCouncilState = { mode: 'AMBIENT', armedDim: null, pair: null, record: null };

export function councilReducer(state, action) {
  switch (action.type) {
    case 'NODE_CLICK': {
      if (state.mode === 'FIRING') return state; // input lock during flight
      if (state.mode === 'ARMED') {
        if (action.dimIndex === state.armedDim) {
          return { ...state, mode: 'AMBIENT', armedDim: null }; // disarm
        }
        return { mode: 'FIRING', armedDim: null, pair: [state.armedDim, action.dimIndex], record: state.record };
      }
      // AMBIENT or SYNTHESIZED: arm (panel/record persists until replaced)
      return { ...state, mode: 'ARMED', armedDim: action.dimIndex, pair: null };
    }
    case 'SYNTHESIS_READY':
      if (state.mode !== 'FIRING') return state;
      return { ...state, mode: 'SYNTHESIZED', record: action.record };
    case 'TIMEOUT':
      return state.mode === 'ARMED' ? { ...state, mode: 'AMBIENT', armedDim: null } : state;
    case 'DISARM':
      return state.mode === 'ARMED' ? { ...state, mode: 'AMBIENT', armedDim: null } : state;
    case 'RESET':
      return initialCouncilState;
    case 'HYDRATE':
      return action.state;
    default:
      return state;
  }
}
```

Note the FIRING pair test expects `record: null` from `initialCouncilState` flows and record retention from SYNTHESIZED flows — the `record: state.record` in NODE_CLICK's FIRING branch handles both (`null` when never synthesized).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilStateMachine.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/terminal/views/manifesto/councilStateMachine.js
git add src/terminal/views/manifesto/councilStateMachine.js src/terminal/views/manifesto/__tests__/councilStateMachine.test.js
git commit -m "feat(manifesto): pure council interaction reducer (AMBIENT/ARMED/FIRING/SYNTHESIZED)"
```

---

### Task 6: councilSynthesis — SKS-polymorphic synthesis engine

**Files:**
- Create: `src/terminal/views/manifesto/councilSynthesis.js`
- Test: `src/terminal/views/manifesto/__tests__/councilSynthesis.test.js` (create)

- [ ] **Step 1: Write the failing tests**

```js
// src/terminal/views/manifesto/__tests__/councilSynthesis.test.js
import { describe, it, expect } from 'vitest';
import { SIXTEEN_MINDS, mindProfile } from '../../../data/sixteenMinds';
import { expand, collide } from '../councilCollider';
import { mindEntry, guestEntry, synthesize } from '../councilSynthesis';

const mindByDim = (d) => SIXTEEN_MINDS.find(m => m.dimIndex === d);

function runPair(dA, dB, ordinal = 0) {
  const a = mindEntry(mindByDim(dA));
  const b = mindEntry(mindByDim(dB));
  const result = collide(expand(a.profile), expand(b.profile));
  return synthesize(a, b, result, ordinal);
}

describe('synthesize — determinism & completeness', () => {
  it('same entries + ordinal → identical record content', () => {
    const r1 = runPair(0, 4, 7);
    const r2 = runPair(0, 4, 7);
    expect(JSON.stringify({ ...r1, ts: 0, id: '' })).toBe(JSON.stringify({ ...r2, ts: 0, id: '' }));
  });

  it('produces every section with content for a representative pair', () => {
    const r = runPair(0, 4);
    expect(r.kind).toBe('SYNTHESIS');
    expect(r.v).toBe(1);
    expect(r.sections.sharedGround.fields.length).toBeGreaterThan(0);
    expect(r.sections.frontier.fields.length).toBeGreaterThan(0);
    expect(r.sections.angles.length).toBeGreaterThanOrEqual(2);
    expect(r.sections.angles.length).toBeLessThanOrEqual(4);
    expect(r.sections.openQuestions.length).toBeGreaterThan(0);
    expect(r.sections.seeds.length).toBeGreaterThanOrEqual(3);
    expect(r.sections.seeds.length).toBeLessThanOrEqual(5);
    expect(typeof r.directive).toBe('string');
    expect(r.directive.length).toBeGreaterThan(40);
    expect(typeof r.line).toBe('string');
  });

  it('metrics carried from collide result + novelty = 1 − cosine', () => {
    const a = mindEntry(mindByDim(2)), b = mindEntry(mindByDim(9));
    const result = collide(expand(a.profile), expand(b.profile));
    const r = synthesize(a, b, result, 0);
    expect(r.metrics.trajectory).toBe(result.trajectory);
    expect(r.metrics.dominantDim).toBe(result.dominantDim);
    expect(r.metrics.novelty).toBeCloseTo(1 - result.cosine, 10);
    expect(r.profiles[0]).toHaveLength(16);
  });

  it('mind fragments appear: at least one seed or angle references thinker text material', () => {
    const r = runPair(0, 15); // Meadows × Raworth — rich text pools
    const corpus = [
      ...r.sections.angles.map(x => x.vector),
      ...r.sections.seeds.map(x => x.text),
    ].join(' ');
    expect(corpus).toMatch(/MEADOWS|RAWORTH|Meadows|Raworth/);
  });

  it('different ordinals vary the seeds deterministically', () => {
    const r1 = runPair(0, 4, 1);
    const r2 = runPair(0, 4, 2);
    expect(r1.sections.seeds.map(s => s.text)).not.toEqual(r2.sections.seeds.map(s => s.text));
  });
});

describe('synthesize — SKS §1 polymorphic guest path', () => {
  it('guest entry with no texts passes through with dim-semantic phrasing', () => {
    const g = guestEntry('PERSONAL KERNEL', new Float32Array(16).fill(0.3).map((v, i) => (i === 6 ? 0.95 : v)));
    const m = mindEntry(mindByDim(4));
    const result = collide(expand(g.profile), expand(m.profile));
    const r = synthesize(g, m, result, 0);
    expect(r.pair[0]).toEqual({ kind: 'guest', label: 'PERSONAL KERNEL' });
    expect(r.sections.sharedGround.fields.length).toBeGreaterThan(0);
    expect(r.sections.seeds.length).toBeGreaterThanOrEqual(3);
    expect(r.directive).toContain('PERSONAL KERNEL');
  });

  it('two guests collide with zero structural modifications', () => {
    const g1 = guestEntry('G1', new Float32Array(16).fill(0.2).map((v, i) => (i < 4 ? 0.9 : v)));
    const g2 = guestEntry('G2', new Float32Array(16).fill(0.2).map((v, i) => (i > 11 ? 0.9 : v)));
    const result = collide(expand(g1.profile), expand(g2.profile));
    expect(() => synthesize(g1, g2, result, 0)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilSynthesis.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/terminal/views/manifesto/councilSynthesis.js
// SKS-polymorphic synthesis engine (spec §4). Pure: entries + collide result
// in, COUNCIL_SYNTHESIS_V1 record out. The engine reads ONLY entry.profile for
// math and entry display fields for voice — a guest kernel passes through with
// zero structural modifications. Deterministic; no Math.random(), no React.
import { fullEdgeFromVectors, paradoxesFromVectors, detectPeriod3Sanctuaries } from '../../data/nodeFeatures';
import { DIM_SEMANTIC } from '../../data/dimSemantics';
import { mulberry32, composeLine } from './councilCollider';

// ── SKS entries ──────────────────────────────────────────────────────────────
export function mindEntry(mind) {
  return {
    kind: 'mind',
    label: mind.anchorName.split(' ').pop().toUpperCase(),
    display: mind.anchorName,
    dimIndex: mind.dimIndex,
    mind,
    profile: mindProfileOf(mind),
    texts: {
      epigraph: mind.epigraph,
      directive: mind.systemDirective,
      excerpt: mind.excerpt,
      equation: mind.coreEquation,
    },
  };
}

// Late import avoidance: mindProfile lives in sixteenMinds; import directly.
import { mindProfile } from '../../data/sixteenMinds';
function mindProfileOf(mind) { return mindProfile(mind); }

export function guestEntry(label, profile, texts = null) {
  return { kind: 'guest', label: String(label).toUpperCase(), display: label, dimIndex: null, mind: null, profile, texts };
}

const entryRef = (e) =>
  e.kind === 'mind'
    ? { kind: 'mind', dimIndex: e.dimIndex, anchorName: e.mind.anchorName }
    : { kind: 'guest', label: e.label };

// ── Fragment pools (voice) ───────────────────────────────────────────────────
const clauses = (s) => (s || '').split(/[;,.—·]/).map(t => t.trim()).filter(t => t.length > 3);

function textPool(entry) {
  if (!entry.texts) return [];
  return [
    ...clauses(entry.texts.epigraph),
    ...(entry.texts.directive ? entry.texts.directive.split(' / ').map(s => s.trim()) : []),
    ...clauses(entry.texts.excerpt),
  ];
}

function equationTerms(entry) {
  return (entry.texts?.equation || '').split(/\s+/).filter(t => t.length > 1);
}

// Pick with fallback: thinker fragment if the pool has one, else dim-semantic phrasing.
function pickFragment(pool, rng, fallback) {
  if (pool.length === 0) return fallback;
  return pool[Math.floor(rng() * pool.length)];
}

// ── Section builders ─────────────────────────────────────────────────────────
const DOMINANCE_THRESHOLD = 0.15;

function buildSharedGround(edge, a, b) {
  const convergent = [...edge.dims].sort((x, y) => y.contrib - x.contrib)
    .filter(d => d.contrib > 0.01).slice(0, 4);
  const fields = convergent.map(d => {
    const sem = DIM_SEMANTIC[d.name];
    const delta = d.vA - d.vB;
    const dominance = Math.abs(delta) < DOMINANCE_THRESHOLD
      ? 'balanced axis'
      : `${delta > 0 ? a.label : b.label} drives this axis (Δ${Math.abs(delta).toFixed(2)})`;
    return {
      dim: d.name,
      tag: sem?.tag || d.name,
      contrib: d.contrib,
      dominance,
      narrative: sem ? sem.converge : `shared structure along ${d.name}`,
    };
  });
  return {
    fields,
    headline: fields.length
      ? `Shared conceptual DNA in ${fields.slice(0, 3).map(f => f.tag).join(', ')} — cosine convergence parsed into ${fields.length} load-bearing fields.`
      : 'No convergent axes above threshold — this pair meets only at the frontier.',
  };
}

function buildFrontier(edge, a, b) {
  const divergent = [...edge.dims].sort((x, y) => y.delta - x.delta).slice(0, 3)
    .filter(d => d.delta > 0.1);
  const fields = divergent.map(d => {
    const sem = DIM_SEMANTIC[d.name];
    return {
      dim: d.name,
      tag: sem?.tag || d.name,
      delta: d.delta,
      holder: d.vA > d.vB ? a.label : b.label,
      narrative: sem ? sem.diverge : `maximum orthogonality along ${d.name}`,
    };
  });
  return {
    fields,
    headline: fields.length
      ? `Maximum orthogonality at ${fields[0].tag} (Δ${fields[0].delta.toFixed(2)}) — the innovation frontier runs through ${fields.map(f => f.tag).join(' / ')}.`
      : 'Near-isomorphic profiles — the frontier is thin; novelty must come from paradox residue.',
  };
}

function buildAngles(edge, paradoxes, a, b, rng) {
  const angles = [];
  const conv = [...edge.dims].sort((x, y) => y.contrib - x.contrib);
  const div = [...edge.dims].sort((x, y) => y.delta - x.delta);
  const poolA = textPool(a), poolB = textPool(b);

  // Angle 1: strongest convergence × strongest divergence — the forcing tension
  if (conv.length && div.length) {
    const c = conv[0], d = div[0];
    angles.push({
      tag: `${DIM_SEMANTIC[c.name]?.tag || c.name} × ${DIM_SEMANTIC[d.name]?.tag || d.name}`,
      vector: `${a.label} and ${b.label} agree on ${DIM_SEMANTIC[c.name]?.tag.toLowerCase() || c.name} ` +
        `(${c.vA.toFixed(2)}/${c.vB.toFixed(2)}) yet split hardest on ${d.name} (Δ${d.delta.toFixed(2)}). ` +
        `"${pickFragment(poolA, rng, DIM_SEMANTIC[c.name]?.converge || c.name)}" meets ` +
        `"${pickFragment(poolB, rng, DIM_SEMANTIC[d.name]?.diverge || d.name)}" — the divergence is the forcing function.`,
    });
  }

  // Angle 2: top paradox as irreducible synthesis axis
  if (paradoxes.length) {
    const p = paradoxes[0];
    angles.push({
      tag: `IRREDUCIBLE · ${DIM_SEMANTIC[p.name]?.tag || p.name}`,
      vector: `After 64 saponification rounds, ${p.name} holds Δ${p.residual.toFixed(3)}. ` +
        `Neither ${a.label} nor ${b.label} yields this axis — the tension cannot be resolved, only exploited. ` +
        `Build the concept that lives inside the contradiction.`,
    });
  }

  // Angle 3: equation splice — both formal languages in one line
  const eqA = equationTerms(a), eqB = equationTerms(b);
  if (eqA.length && eqB.length) {
    angles.push({
      tag: 'FORMAL SPLICE',
      vector: `Set ${eqA[Math.floor(rng() * eqA.length)]} against ${eqB[Math.floor(rng() * eqB.length)]}: ` +
        `two formalisms, one system. What conservation law would make both true simultaneously?`,
    });
  }

  // Angle 4: caste friction (minds only — guests have no caste)
  if (a.mind?.caste && b.mind?.caste && a.mind.caste !== b.mind.caste) {
    const builder = a.mind.caste === 'canon' ? a : b;
    const reader = builder === a ? b : a;
    angles.push({
      tag: 'INSTRUMENT × READING',
      vector: `${builder.label} built the instrument; ${reader.label} read what it measured and was sidelined for it. ` +
        `The synthesis must carry both: the tool and the warning the tool produced.`,
    });
  }

  return angles.slice(0, 4);
}

function buildOpenQuestions(paradoxes, a, b) {
  return paradoxes.slice(0, 5).map(p => {
    const sem = DIM_SEMANTIC[p.name];
    return {
      dim: p.name,
      residual: p.residual,
      question: sem
        ? `${sem.tag}: ${sem.diverge}. Between ${a.label} and ${b.label} this survives at Δ${p.residual.toFixed(3)} — what structural feature makes it irreconcilable?`
        : `What keeps ${p.name} (Δ${p.residual.toFixed(3)}) irreconcilable between ${a.label} and ${b.label}?`,
    };
  });
}

function buildSanctuaries(paradoxes, a, b) {
  return detectPeriod3Sanctuaries(paradoxes).map(s => ({
    ...s,
    narrative: `Period-3 pocket: ${s.members.join(', ')} cluster at residual ≈${s.center.toFixed(3)} — ` +
      `not noise but aligned signal, a quiet zone of transient order inside the ${a.label} × ${b.label} turbulence.`,
    seed: `A sanctuary where ${s.members.join(' and ')} hold the same residual tension — condense it into one structural principle.`,
  }));
}

function buildSeeds(edge, paradoxes, metrics, a, b, rng) {
  const seeds = [];
  const conv = [...edge.dims].sort((x, y) => y.contrib - x.contrib);
  const div = [...edge.dims].sort((x, y) => y.delta - x.delta);
  const poolA = textPool(a), poolB = textPool(b);

  if (conv.length) {
    const c = conv[0];
    seeds.push({
      source: 'SHARED GROUND',
      text: `${a.display || a.label} × ${b.display || b.label} on ${DIM_SEMANTIC[c.name]?.tag || c.name}: ` +
        `${DIM_SEMANTIC[c.name]?.converge || c.name} — design the mechanism both would sign.`,
    });
  }
  if (div.length) {
    const d = div[0];
    seeds.push({
      source: 'FRONTIER',
      text: `Where ${a.label} holds ${d.vA.toFixed(2)} and ${b.label} holds ${d.vB.toFixed(2)} on ${d.name}: ` +
        `${DIM_SEMANTIC[d.name]?.diverge || d.name} — the blueprint lives in the gap.`,
    });
  }
  if (paradoxes.length) {
    const p = paradoxes[0];
    seeds.push({
      source: 'PARADOX',
      text: `Irreconcilable ${DIM_SEMANTIC[p.name]?.tag.toLowerCase() || p.name} (Δ${p.residual.toFixed(3)}): ` +
        `"${pickFragment(poolA, rng, a.label)}" vs "${pickFragment(poolB, rng, b.label)}" — write the axiom that needs both to be true.`,
    });
  }
  seeds.push({
    source: metrics.trajectory === 'FOUNDATION' ? 'SHORTFALL' : 'OVERSHOOT',
    text: metrics.trajectory === 'FOUNDATION'
      ? `This collision falls inward — a social-foundation shortfall. What would ${a.label} and ${b.label} jointly build to raise the floor?`
      : `This collision punches the biophysical ceiling — overshoot. What would ${a.label} and ${b.label} jointly dismantle to come back inside the ring?`,
  });
  if (seeds.length < 5 && conv.length > 1) {
    const c2 = conv[1];
    seeds.push({
      source: 'SECOND AXIS',
      text: `Secondary convergence on ${DIM_SEMANTIC[c2.name]?.tag || c2.name}: run the same collision with this axis as the primary lens.`,
    });
  }
  return seeds.slice(0, 5);
}

function buildDirective(edge, paradoxes, metrics, a, b) {
  const conv = [...edge.dims].sort((x, y) => y.contrib - x.contrib)[0];
  const div = [...edge.dims].sort((x, y) => y.delta - x.delta)[0];
  const trajectoryClause = metrics.trajectory === 'FOUNDATION'
    ? 'The product falls toward the social foundation — treat the output as a floor-raising blueprint.'
    : 'The product breaches the biophysical ceiling — treat the output as an overshoot diagnosis.';
  return (
    `You are synthesizing ${a.display || a.label} × ${b.display || b.label} inside a post-capitalist structural frame. ` +
    `Shared axis: ${DIM_SEMANTIC[conv?.name]?.tag || conv?.name || 'none'}. Frontier: ${DIM_SEMANTIC[div?.name]?.tag || div?.name || 'none'} (Δ${(div?.delta ?? 0).toFixed(2)}). ` +
    `${paradoxes.length} irreducible tension${paradoxes.length === 1 ? '' : 's'} survive saponification. ${trajectoryClause} ` +
    `Generate 3 concrete mechanisms, institutions, or design principles that could only exist at this intersection.`
  );
}

// ── Main entry point ─────────────────────────────────────────────────────────
export function synthesize(entryA, entryB, collideResult, ordinal) {
  const edge = fullEdgeFromVectors(entryA.profile, entryB.profile);
  const { paradoxes } = paradoxesFromVectors(entryA.profile, entryB.profile);
  const rng = mulberry32(
    Math.imul((entryA.dimIndex ?? 97) * 31 + (entryB.dimIndex ?? 89) + 1, 2246822519) + ordinal
  );

  const metrics = {
    cosine: collideResult.cosine,
    novelty: 1 - collideResult.cosine,
    energies: collideResult.energies,
    trajectory: collideResult.trajectory,
    dominantDim: collideResult.dominantDim,
  };

  const sections = {
    sharedGround: buildSharedGround(edge, entryA, entryB),
    frontier: buildFrontier(edge, entryA, entryB),
    angles: buildAngles(edge, paradoxes, entryA, entryB, rng),
    openQuestions: buildOpenQuestions(paradoxes, entryA, entryB),
    sanctuaries: buildSanctuaries(paradoxes, entryA, entryB),
    seeds: buildSeeds(edge, paradoxes, metrics, entryA, entryB, rng),
  };

  // Ticker line: reuse Phase 1's composeLine when both entries are minds;
  // guests get a compact equivalent.
  const line = entryA.kind === 'mind' && entryB.kind === 'mind'
    ? composeLine(entryA.mind, entryB.mind, collideResult, ordinal)
    : `[COLLISION 0x${(ordinal & 0xff).toString(16).padStart(2, '0').toUpperCase()}] ${entryA.label} × ${entryB.label} · TRAJECTORY ${metrics.trajectory === 'FOUNDATION' ? '▼ SOCIAL FOUNDATION' : '▲ BIOPHYSICAL CEILING'}`;

  return {
    v: 1,
    kind: 'SYNTHESIS',
    id: `syn-${ordinal}-${(entryA.dimIndex ?? 'g')}-${(entryB.dimIndex ?? 'g')}-${Date.now().toString(36)}`,
    ts: Date.now(),
    ordinal,
    pair: [entryRef(entryA), entryRef(entryB)],
    profiles: [Array.from(entryA.profile), Array.from(entryB.profile)],
    metrics,
    sections,
    directive: buildDirective(edge, paradoxes, metrics, entryA, entryB),
    line,
  };
}
```

Move the `import { mindProfile }` line up with the other imports at the top of the file (shown mid-file above only to explain provenance; final file has all imports at top, and `mindProfileOf` is dropped in favor of calling `mindProfile(mind)` directly inside `mindEntry`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilSynthesis.test.js`
Expected: PASS (7 tests). Determinism note: `id`/`ts` are excluded from the determinism assertion by the test's `{...r, ts: 0, id: ''}` normalization.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/terminal/views/manifesto/councilSynthesis.js
git add src/terminal/views/manifesto/councilSynthesis.js src/terminal/views/manifesto/__tests__/councilSynthesis.test.js
git commit -m "feat(manifesto): SKS-polymorphic council synthesis engine"
```

---

### Task 7: MindSidebar component

**Files:**
- Create: `src/terminal/views/manifesto/MindSidebar.jsx`

No unit test (presentational; verified in Task 10's browser pass). Keep it pure-presentational: props in, JSX out, no state beyond nothing.

- [ ] **Step 1: Implement**

```jsx
// src/terminal/views/manifesto/MindSidebar.jsx
// Thinker profile card flanking the torus while a pair is selected (spec §3).
// Pure presentational. side: 'left' | 'right'. mind: a SIXTEEN_MINDS entry or
// null (renders the AWAITING placeholder frame).
const MONO = "'Geist Mono', ui-monospace, monospace";

export default function MindSidebar({ mind, side, hue, onDossier }) {
  if (!mind) {
    return (
      <div style={{ border: '1px dashed rgba(120,140,200,0.25)', borderRadius: 4, padding: '14px 12px', fontFamily: MONO, fontSize: 10, color: 'rgba(120,140,200,0.45)', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
        AWAITING SECOND MIND
      </div>
    );
  }
  const accent = hue || '#FFD700';
  return (
    <div style={{ border: `1px solid ${accent}44`, borderRadius: 4, padding: '12px 12px 14px', fontFamily: MONO, background: '#04040a', maxHeight: 420, overflowY: 'auto', textAlign: side === 'right' ? 'right' : 'left' }}>
      <div style={{ fontSize: 9, color: accent, letterSpacing: '0.2em' }}>
        [dim:{String(mind.dimIndex).padStart(2, '0')}] {mind.dimName}
      </div>
      <div style={{ fontSize: 15, color: '#FFD700', fontWeight: 700, marginTop: 3 }}>{mind.anchorName}</div>
      <div style={{ fontSize: 9, color: 'rgba(232,232,240,0.5)', marginTop: 2 }}>{mind.era} · {mind.caste.toUpperCase()}</div>
      <div style={{ fontSize: 12, color: '#FFD700', marginTop: 10 }}>{mind.coreEquation}</div>
      <div style={{ fontSize: 9, color: 'rgba(0,255,170,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 8 }}>▸ {mind.systemDirective}</div>
      <div style={{ fontSize: 10, color: 'rgba(232,232,240,0.75)', fontStyle: 'italic', marginTop: 10, lineHeight: 1.5 }}>“{mind.epigraph}”</div>
      <div style={{ fontSize: 10, color: `${accent}bb`, marginTop: 8, lineHeight: 1.5 }}>“{mind.excerpt}”</div>
      <button
        onClick={() => onDossier(mind)}
        style={{ marginTop: 12, background: 'none', border: `1px solid ${accent}55`, borderRadius: 3, color: accent, fontFamily: MONO, fontSize: 9, letterSpacing: '0.15em', padding: '3px 10px', cursor: 'pointer' }}
      >
        [dossier]
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify parse + lint, commit**

Run: `npx vitest run src/terminal/views/manifesto/ && npx eslint src/terminal/views/manifesto/MindSidebar.jsx`
Expected: existing manifesto tests green; lint 0 problems.

```bash
git add src/terminal/views/manifesto/MindSidebar.jsx
git commit -m "feat(manifesto): MindSidebar thinker profile card"
```

---

### Task 8: useCouncilCollider — state machine, animation gate, ledger wiring

**Files:**
- Rewrite: `src/terminal/views/manifesto/useCouncilCollider.js` (full replacement below)

The Phase-1 file is replaced wholesale. What changes vs Phase 1: reducer-driven interaction modes; ambient runs ONLY in AMBIENT mode; user collisions use denser/brighter choreography; the synthesis computes at EJECT completion (animation gate) — not at collapse; ledger appends (ARM/DISARM/FIRE/RESET events + SYNTHESIS records); rehydration from `councilLedger.deriveUiState()` on mount; 45 s ARMED timeout. All Phase-1 rendering (phases, trails, transforms, gating observers, zero-size guard) is preserved.

- [ ] **Step 1: Replace the file with:**

```js
// src/terminal/views/manifesto/useCouncilCollider.js
// RAF particle sim + SKS interaction state machine for the Council collider.
// Sim state lives in refs; interaction state lives in a pure reducer whose
// persistent truth is the councilLedger (SKS §3 — component state is a cache).
import { useRef, useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { SIXTEEN_MINDS, mindProfile } from '../../data/sixteenMinds';
import { polarToXY } from './councilRingMath';
import { expand, collide, composeLine, pickPair } from './councilCollider';
import { councilBus } from './councilBus';
import { councilLedger } from './councilLedger';
import { initialCouncilState, councilReducer } from './councilStateMachine';
import { mindEntry, synthesize } from './councilSynthesis';

const CX = 320, CY = 320;
const R_FOUNDATION = 150, R_SEAT = 220, R_CEILING = 290;
const VIEW_W = 980, VIEW_X0 = -170; // desktop SVG viewBox "-170 0 980 640"

// Cycle timing (ms)
const T_INFALL = 2600, T_FLASH = 380, T_EJECT = 1100, T_COOLDOWN = 3200;
const STREAM_N_AMBIENT = 22;
const STREAM_N_USER = 44;          // user collisions feel heavier (spec §1 FIRING)
const SPIRAL_GAIN = 0.9;
const CORE_R = 10;
const ARMED_TIMEOUT_MS = 45000;

const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const mindByDim = (d) => SIXTEEN_MINDS.find(m => m.dimIndex === d);

export function useCouncilCollider({ seated, enabled }) {
  const canvasRef = useRef(null);
  const simRef = useRef({ phase: 'IDLE', t0: 0, pair: null, product: null, ordinal: 0, particles: [], userPair: null });
  const rafRef = useRef(0);
  const armedTimerRef = useRef(0);

  const [ui, dispatch] = useReducer(councilReducer, initialCouncilState);
  const uiRef = useRef(ui);
  uiRef.current = ui;

  const [lastCollision, setLastCollision] = useState(null);
  const [activePairIds, setActivePairIds] = useState([]);
  const [running, setRunning] = useState(false);

  // Precompute every mind's 1536-D vector once.
  const expanded = useMemo(() => seated.map(m => expand(mindProfile(m))), [seated]);

  // ── SKS §3 rehydration: ledger head → reducer, once on mount ──────────────
  useEffect(() => {
    const derived = councilLedger.deriveUiState();
    if (derived.mode === 'SYNTHESIZED' && derived.record) {
      const [pA, pB] = derived.record.pair;
      dispatch({
        type: 'HYDRATE',
        state: {
          mode: 'SYNTHESIZED', armedDim: null,
          pair: [pA.dimIndex ?? null, pB.dimIndex ?? null],
          record: derived.record,
        },
      });
      setLastCollision({ line: derived.record.line, trajectory: derived.record.metrics.trajectory });
    } else if (derived.mode === 'ARMED' && derived.armed?.dimIndex != null) {
      dispatch({ type: 'HYDRATE', state: { mode: 'ARMED', armedDim: derived.armed.dimIndex, pair: null, record: null } });
    }
  }, []);

  // ── Interaction API ────────────────────────────────────────────────────────
  const onNodeClick = useCallback((mind) => {
    const state = uiRef.current;
    if (state.mode === 'FIRING') return; // input lock
    if (state.mode === 'ARMED' && state.armedDim === mind.dimIndex) {
      councilLedger.append({ v: 1, kind: 'EVENT', event: 'DISARM', ts: Date.now(), subject: { kind: 'mind', dimIndex: mind.dimIndex } });
    } else if (state.mode === 'ARMED') {
      councilLedger.append({ v: 1, kind: 'EVENT', event: 'FIRE', ts: Date.now(), subject: { kind: 'pair', dims: [state.armedDim, mind.dimIndex] } });
    } else {
      councilLedger.append({ v: 1, kind: 'EVENT', event: 'ARM', ts: Date.now(), subject: { kind: 'mind', dimIndex: mind.dimIndex } });
    }
    dispatch({ type: 'NODE_CLICK', dimIndex: mind.dimIndex });
  }, []);

  const disarm = useCallback(() => {
    if (uiRef.current.mode !== 'ARMED') return;
    councilLedger.append({ v: 1, kind: 'EVENT', event: 'DISARM', ts: Date.now(), subject: { kind: 'mind', dimIndex: uiRef.current.armedDim } });
    dispatch({ type: 'DISARM' });
  }, []);

  const reset = useCallback(() => {
    councilLedger.append({ v: 1, kind: 'EVENT', event: 'RESET', ts: Date.now(), subject: null });
    dispatch({ type: 'RESET' });
    setLastCollision(null);
    setActivePairIds([]);
  }, []);

  // ARMED timeout → auto-disarm
  useEffect(() => {
    clearTimeout(armedTimerRef.current);
    if (ui.mode === 'ARMED') {
      armedTimerRef.current = setTimeout(() => {
        councilLedger.append({ v: 1, kind: 'EVENT', event: 'DISARM', ts: Date.now(), subject: { kind: 'mind', dimIndex: uiRef.current.armedDim } });
        dispatch({ type: 'TIMEOUT' });
      }, ARMED_TIMEOUT_MS);
    }
    return () => clearTimeout(armedTimerRef.current);
  }, [ui.mode, ui.armedDim]);

  // When the reducer enters FIRING, stage the user pair for the RAF loop.
  useEffect(() => {
    if (ui.mode === 'FIRING' && ui.pair) {
      const [dA, dB] = ui.pair;
      simRef.current.userPair = [
        seated.findIndex(m => m.dimIndex === dA),
        seated.findIndex(m => m.dimIndex === dB),
      ];
    }
  }, [ui.mode, ui.pair, seated]);

  // Gate: enabled flag, prefers-reduced-motion, viewport visibility.
  useEffect(() => {
    if (!enabled) { setRunning(false); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) { setRunning(false); return; }
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting));
    io.observe(canvas);
    return () => io.disconnect();
  }, [enabled]);

  // ── The RAF loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let scale = 1;

    const resize = () => {
      if (!canvas.clientWidth || !canvas.clientHeight) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      scale = canvas.width / VIEW_W;
      ctx.fillStyle = '#04040a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const jitter = (seed, ordinal) => {
      let h = Math.imul(seed + ordinal * 97, 2654435761) >>> 0;
      return (h % 1000) / 1000;
    };

    const spawnStreams = (ia, ib, streamN, now) => {
      const sim = simRef.current;
      sim.pair = [ia, ib];
      sim.phase = 'INFALL';
      sim.t0 = now;
      sim.particles = [];
      [ia, ib].forEach((seatIdx, s) => {
        const mind = seated[seatIdx];
        for (let i = 0; i < streamN; i++) {
          sim.particles.push({
            angle: mind.angle,
            hue: mind.hue,
            delay: jitter(s * streamN + i, sim.ordinal) * 900,
            wobble: (jitter(s * streamN + i + 500, sim.ordinal) - 0.5) * 14,
          });
        }
      });
      setActivePairIds([seated[ia].dimIndex, seated[ib].dimIndex]);
    };

    const startAmbientCycle = (now) => {
      const sim = simRef.current;
      const [ia, ib] = pickPair(sim.ordinal, null);
      sim.isUser = false;
      spawnStreams(ia, ib, STREAM_N_AMBIENT, now);
    };

    const startUserCycle = (now) => {
      const sim = simRef.current;
      const [ia, ib] = sim.userPair;
      sim.userPair = null;
      sim.isUser = true;
      spawnStreams(ia, ib, STREAM_N_USER, now);
    };

    const runCollision = (now) => {
      const sim = simRef.current;
      const [ia, ib] = sim.pair;
      const result = collide(expanded[ia], expanded[ib]);
      const mindA = seated[ia], mindB = seated[ib];
      const line = composeLine(mindA, mindB, result, sim.ordinal);
      const domSeat = seated.findIndex(m => m.dimIndex === result.dominantDim);
      sim.product = {
        angle: seated[domSeat].angle,
        targetR: result.trajectory === 'FOUNDATION' ? R_FOUNDATION : R_CEILING + 28,
        boundaryR: result.trajectory === 'FOUNDATION' ? R_FOUNDATION : R_CEILING,
        color: result.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA',
      };
      sim.collideResult = result;
      sim.phase = 'FLASH';
      sim.t0 = now;
      setLastCollision({ line, trajectory: result.trajectory });
      councilBus.emit({
        type: 'COUNCIL_COLLISION',
        pair: [mindA.dimIndex, mindB.dimIndex],
        cosine: result.cosine, trajectory: result.trajectory,
        dominantDim: result.dominantDim, energies: result.energies,
        line, ordinal: sim.ordinal, ts: Date.now(),
        source: sim.isUser ? 'user' : 'ambient',
      });
    };

    // Animation gate (spec §1): synthesis computes ONLY after EJECT completes.
    const completeUserSynthesis = () => {
      const sim = simRef.current;
      const [ia, ib] = sim.pair;
      const entryA = mindEntry(seated[ia]);
      const entryB = mindEntry(seated[ib]);
      const record = synthesize(entryA, entryB, sim.collideResult, sim.ordinal);
      councilLedger.append(record);
      councilBus.emit({ type: 'COUNCIL_SYNTHESIS', recordId: record.id, ordinal: sim.ordinal, ts: record.ts });
      dispatch({ type: 'SYNTHESIS_READY', record });
    };

    const dot = (x, y, r, color) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    const draw = (now) => {
      const sim = simRef.current;
      const mode = uiRef.current.mode;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(4, 4, 10, 0.16)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, -VIEW_X0 * scale, 0);

      const t = now - sim.t0;

      if (sim.phase === 'IDLE') {
        if (mode === 'FIRING' && sim.userPair) {
          startUserCycle(now);
        } else if (mode === 'AMBIENT') {
          startAmbientCycle(now);
        }
        // ARMED / SYNTHESIZED without a staged pair: canvas idles (trails fade)
      } else if (sim.phase === 'INFALL') {
        // A user arming mid-ambient-flight lets the ambient cycle finish visually,
        // but if FIRING was requested, the staged user pair takes over at IDLE.
        let allDone = true;
        for (const p of sim.particles) {
          const prog = Math.min(1, Math.max(0, (t - p.delay) / T_INFALL));
          if (prog < 1) allDone = false;
          if (prog <= 0) continue;
          const r = R_SEAT * (1 - easeInCubic(prog));
          const theta = p.angle + p.wobble * prog
            + (SPIRAL_GAIN * 180 / Math.PI) * (1 - r / R_SEAT);
          const { x, y } = polarToXY(theta, r, CX, CY);
          dot(x, y, sim.isUser ? 2.6 : 2.2, p.hue);
        }
        if (allDone) runCollision(now);
      } else if (sim.phase === 'FLASH') {
        const prog = Math.min(1, t / T_FLASH);
        const flashR = CORE_R + (sim.isUser ? 38 : 26) * prog;
        dot(CX, CY, flashR, `rgba(255, 215, 0, ${(sim.isUser ? 0.95 : 0.85) * (1 - prog)})`);
        if (prog >= 1) { sim.phase = 'EJECT'; sim.t0 = now; }
      } else if (sim.phase === 'EJECT') {
        const prog = Math.min(1, t / T_EJECT);
        const r = sim.product.targetR * easeOutCubic(prog);
        const { x, y } = polarToXY(sim.product.angle, r, CX, CY);
        dot(x, y, sim.isUser ? 4.5 : 3.5, sim.product.color);
        if (r >= sim.product.boundaryR - 2) {
          ctx.beginPath();
          ctx.arc(CX, CY, sim.product.boundaryR, 0, Math.PI * 2);
          ctx.strokeStyle = sim.product.color;
          ctx.globalAlpha = 0.5 * (1 - prog);
          ctx.lineWidth = sim.isUser ? 3 : 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (prog >= 1) {
          if (sim.isUser) completeUserSynthesis(); // ← animation gate opens here
          sim.ordinal += 1;
          sim.phase = 'COOLDOWN';
          sim.t0 = now;
        }
      } else if (sim.phase === 'COOLDOWN') {
        if (t >= T_COOLDOWN) sim.phase = 'IDLE';
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    // simRef holds a stable object (mutated, never reassigned) — capturing it
    // satisfies react-hooks/exhaustive-deps for the cleanup without behavior change.
    const sim = simRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      sim.phase = 'IDLE';
      sim.particles = [];
    };
    // seated/expanded MUST be referentially stable across renders (CouncilRing
    // memoizes seated with [] deps — load-bearing). If that memo breaks, this
    // effect tears down and restarts every render and the sim never advances.
  }, [running, seated, expanded]);

  const armedMind = ui.armedDim != null ? mindByDim(ui.armedDim) : null;
  const pairMinds = ui.pair ? ui.pair.map(d => (d != null ? mindByDim(d) : null)) : null;

  return {
    canvasRef,
    mode: ui.mode,
    armedMind,
    pairMinds,
    synthesisRecord: ui.record,
    activePairIds,
    lastCollision,
    onNodeClick,
    disarm,
    reset,
  };
}
```

Phase-1 ordinal note: `sim.ordinal += 1` moved from `runCollision` to EJECT completion so the SYNTHESIS record and the collision share one ordinal; net behavior (monotonic per cycle) is unchanged.

- [ ] **Step 2: Verify no regressions**

Run: `npx vitest run && npx eslint src/terminal/views/manifesto/useCouncilCollider.js`
Expected: full suite green (no test imports this hook); lint 0 errors 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/manifesto/useCouncilCollider.js
git commit -m "feat(manifesto): council hook — SKS state machine, animation gate, ledger wiring"
```

---

### Task 9: CouncilSynthesisPanel component

**Files:**
- Create: `src/terminal/views/manifesto/CouncilSynthesisPanel.jsx`

Presentational; staged reveal via CSS; verified in Task 10's browser pass.

- [ ] **Step 1: Implement**

```jsx
// src/terminal/views/manifesto/CouncilSynthesisPanel.jsx
// Staged synthesis breakdown below the ring (spec §6). Sections reveal
// sequentially (~250ms cadence); prefers-reduced-motion renders instantly.
import { useEffect, useState } from 'react';
import CopySpan from '../../components/CopySpan.jsx';

const MONO = "'Geist Mono', ui-monospace, monospace";
const STAGE_MS = 250;

function Section({ title, color, revealed, children }) {
  return (
    <div style={{ opacity: revealed ? 1 : 0, transition: 'opacity 300ms', marginTop: 18 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.25em', color, borderBottom: `1px solid ${color}33`, paddingBottom: 4 }}>
        § {title}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

const rowStyle = { fontFamily: MONO, fontSize: 11, color: 'rgba(232,232,240,0.85)', lineHeight: 1.6, marginTop: 6 };
const dimTagStyle = (c) => ({ color: c, fontSize: 10, letterSpacing: '0.1em' });

export default function CouncilSynthesisPanel({ record, onDossier, onReset, minds }) {
  const [stage, setStage] = useState(0);
  const trajColor = record.metrics.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA';

  useEffect(() => {
    setStage(0);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setStage(5); return; }
    let n = 0;
    const iv = setInterval(() => {
      n += 1;
      setStage(n);
      if (n >= 5) clearInterval(iv);
    }, STAGE_MS);
    return () => clearInterval(iv);
  }, [record.id]);

  const { sharedGround, frontier, angles, openQuestions, sanctuaries, seeds } = record.sections;

  return (
    <div id="council-synthesis-panel" style={{ background: '#04040a', border: '1px solid rgba(120,140,200,0.12)', borderRadius: 4, padding: '16px 18px 22px', marginTop: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: '#FFD700', fontWeight: 700 }}>
          {record.pair.map((p, i) => (
            <span key={i}>
              {i > 0 && <span style={{ color: 'rgba(232,232,240,0.5)' }}> × </span>}
              {p.anchorName || p.label}
              {p.kind === 'mind' && minds && (
                <button
                  onClick={() => onDossier(minds.find(m => m.dimIndex === p.dimIndex))}
                  style={{ background: 'none', border: 'none', color: 'rgba(120,140,200,0.7)', fontFamily: MONO, fontSize: 9, cursor: 'pointer', marginLeft: 4 }}
                >
                  [dossier]
                </button>
              )}
            </span>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: trajColor, letterSpacing: '0.15em' }}>
          {record.metrics.trajectory === 'FOUNDATION' ? '▼ SOCIAL FOUNDATION' : '▲ BIOPHYSICAL CEILING'} · 0x{(record.ordinal & 0xff).toString(16).padStart(2, '0').toUpperCase()}
          <button
            onClick={onReset}
            style={{ marginLeft: 14, background: 'none', border: '1px solid rgba(255,0,136,0.4)', borderRadius: 3, color: '#FF0088', fontFamily: MONO, fontSize: 9, letterSpacing: '0.15em', padding: '2px 8px', cursor: 'pointer' }}
          >
            /RESET
          </button>
        </div>
      </div>

      {/* §1 Shared Ground & Innovation Frontier */}
      <Section title="SHARED GROUND & INNOVATION FRONTIER" color="#00FFAA" revealed={stage >= 1}>
        <div style={rowStyle}>{sharedGround.headline}</div>
        {sharedGround.fields.map(f => (
          <div key={f.dim} style={rowStyle}>
            <span style={dimTagStyle('#00FFAA')}>◈ {f.tag}</span> — {f.narrative} · <span style={{ color: 'rgba(232,232,240,0.55)' }}>{f.dominance}</span>
          </div>
        ))}
        <div style={{ ...rowStyle, marginTop: 12 }}>{frontier.headline}</div>
        {frontier.fields.map(f => (
          <div key={f.dim} style={rowStyle}>
            <span style={dimTagStyle('#FF8C00')}>◇ {f.tag}</span> (Δ{f.delta.toFixed(2)}, held by {f.holder}) — {f.narrative}
          </div>
        ))}
      </Section>

      {/* §2 Semantic Vectors & Open Questions */}
      <Section title="SEMANTIC VECTORS & OPEN QUESTIONS" color="#00AAFF" revealed={stage >= 2}>
        {angles.map((a, i) => (
          <div key={i} style={rowStyle}>
            <span style={dimTagStyle('#00AAFF')}>▸ {a.tag}</span>
            <div style={{ marginTop: 2 }}>{a.vector}</div>
          </div>
        ))}
        {openQuestions.map((q, i) => (
          <div key={`q${i}`} style={{ ...rowStyle, color: 'rgba(212,166,255,0.85)' }}>
            ? {q.question}
          </div>
        ))}
        {openQuestions.length === 0 && (
          <div style={rowStyle}>No paradox survives saponification — this pair reconciles fully. The tension budget is zero; novelty must be imported.</div>
        )}
      </Section>

      {/* §3 Sanctuaries & Prompt Fragments */}
      <Section title="SANCTUARIES & PROMPT FRAGMENTS" color="#FFD700" revealed={stage >= 3}>
        {sanctuaries.map((s, i) => (
          <div key={`s${i}`} style={rowStyle}>
            <span style={dimTagStyle('#FFD700')}>⊙ SANCTUARY</span> {s.narrative}
            <div style={{ marginTop: 2 }}>
              ⌗ <CopySpan value={s.seed} color="#FFD700" />
            </div>
          </div>
        ))}
        {seeds.map((s, i) => (
          <div key={`seed${i}`} style={rowStyle}>
            <span style={dimTagStyle('rgba(120,140,200,0.8)')}>[{s.source}]</span>{' '}
            <CopySpan value={s.text} color="rgba(232,232,240,0.9)" />
          </div>
        ))}
      </Section>

      {/* §4 Synthesis Directive */}
      <Section title="SYNTHESIS DIRECTIVE — COPY-PASTE ME" color={trajColor} revealed={stage >= 4}>
        <div style={{ ...rowStyle, border: `1px solid ${trajColor}33`, borderRadius: 3, padding: '10px 12px' }}>
          <CopySpan value={record.directive} color={trajColor} />
        </div>
      </Section>
    </div>
  );
}
```

- [ ] **Step 2: Verify parse + lint, commit**

Run: `npx vitest run src/terminal/views/manifesto/ && npx eslint src/terminal/views/manifesto/CouncilSynthesisPanel.jsx`

```bash
git add src/terminal/views/manifesto/CouncilSynthesisPanel.jsx
git commit -m "feat(manifesto): staged CouncilSynthesisPanel with copy seeds + /RESET"
```

---

### Task 10: CouncilRing integration — grid, banner, scroll alert, clipping fixes

**Files:**
- Modify: `src/terminal/views/manifesto/CouncilRing.jsx` (imports, hook wiring, desktop return; mobile telemetry rows get ellipsis)

- [ ] **Step 1: Update imports and hook usage**

New imports:

```js
import { useCouncilCollider } from './useCouncilCollider';
import MindSidebar from './MindSidebar';
import CouncilSynthesisPanel from './CouncilSynthesisPanel';
```

Inside `CouncilRing()` (replacing the Phase-1 `collider`/`handleSelect` block — hook call stays BEFORE the `if (isMobile)` early return):

```js
const collider = useCouncilCollider({ seated, enabled: !isMobile });
const { onNodeClick } = collider; // stable useCallback — plain identifier satisfies exhaustive-deps
const handleSelect = useCallback((mind) => {
  onNodeClick(mind); // selection is the primary verb — dossier moved to [dossier] affordances
}, [onNodeClick]);
const openDossier = useCallback((mind) => setSelected(mind), []);
```

- [ ] **Step 2: Add the scroll-alert dismissal observer** (before the returns, after the other hooks):

```js
// Output notification (spec §3): visible from SYNTHESIZED until the panel
// has been scrolled into view.
const [alertDismissed, setAlertDismissed] = useState(false);
useEffect(() => {
  if (collider.mode !== 'SYNTHESIZED') { setAlertDismissed(false); return; }
  const panel = document.getElementById('council-synthesis-panel');
  if (!panel) return;
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setAlertDismissed(true); });
  io.observe(panel);
  return () => io.disconnect();
}, [collider.mode, collider.synthesisRecord?.id]);
```

- [ ] **Step 3: Replace the desktop return block wholesale:**

```jsx
// Desktop — 3-column grid: sidebars flank the torus while a pair is selected
// (spec §3). Canvas renders UNDER the SVG. Torus cell has min-width:0 and
// overflow:hidden on the CANVAS only; SVG keeps its full widened viewBox so
// labels never clip (spec §7). Sidebars are grid siblings — never overlays.
const showSidebars = collider.mode !== 'AMBIENT';
const [mindA, mindB] = collider.pairMinds || [collider.armedMind, null];
const hueOf = (m) => (m ? seated.find(s => s.dimIndex === m.dimIndex)?.hue : null);

return (
  <div style={{ width: '100%' }}>
    <div style={{ background: '#04040a', border: '1px solid rgba(120,140,200,0.12)', borderRadius: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: showSidebars ? 'minmax(190px, 230px) minmax(0, 1fr) minmax(190px, 230px)' : 'minmax(0, 1fr)', gap: 12, padding: showSidebars ? '12px' : 0, alignItems: 'start' }}>
        {showSidebars && (
          <MindSidebar mind={mindA} side="left" hue={hueOf(mindA)} onDossier={openDossier} />
        )}
        <div style={{ position: 'relative', minWidth: 0, overflow: 'hidden' }}>
          <canvas
            ref={collider.canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
          {/* viewBox widened horizontally (−170..810) so long anchor labels on both
              arcs have margin and are not clipped by the SVG edge; ring stays centered on 320. */}
          <svg viewBox="-170 0 980 640" style={{ width: '100%', height: 'auto', display: 'block', position: 'relative' }}>
            <RingScaffold />
            {seated.map(m => (
              <Node
                key={m.dimIndex}
                mind={m}
                active={
                  collider.mode === 'ARMED'
                    ? collider.armedMind?.dimIndex === m.dimIndex
                    : collider.activePairIds.includes(m.dimIndex)
                }
                onSelect={handleSelect}
              />
            ))}
          </svg>
        </div>
        {showSidebars && (
          <MindSidebar mind={mindB} side="right" hue={hueOf(mindB)} onDossier={openDossier} />
        )}
      </div>

      {/* ARMED banner */}
      {collider.mode === 'ARMED' && (
        <div style={{ padding: '6px 14px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: '#FFD700', borderTop: '1px solid rgba(255,215,0,0.25)', display: 'flex', gap: 14, alignItems: 'center' }}>
          ⌖ ARMED: {collider.armedMind?.anchorName.split(' ').pop().toUpperCase()} · SELECT SECOND MIND
          <button onClick={() => openDossier(collider.armedMind)} style={{ background: 'none', border: 'none', color: 'rgba(120,140,200,0.8)', fontFamily: MONO, fontSize: 9, cursor: 'pointer' }}>[dossier]</button>
          <button onClick={collider.disarm} style={{ background: 'none', border: 'none', color: 'rgba(255,0,136,0.8)', fontFamily: MONO, fontSize: 9, cursor: 'pointer' }}>[disarm]</button>
        </div>
      )}

      {/* Ticker strip — fixed height, no layout shift */}
      <div style={{ height: 44, padding: '8px 14px', borderTop: '1px solid rgba(120,140,200,0.12)', fontFamily: MONO, fontSize: 11, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        {collider.lastCollision ? (
          <span style={{ display: 'inline-block', minWidth: 0, color: collider.lastCollision.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {collider.lastCollision.line}
          </span>
        ) : (
          <span style={{ color: 'rgba(120,140,200,0.4)', letterSpacing: '0.2em' }}>◉ COUNCIL COLLIDER · AWAITING FIRST EVENT</span>
        )}
      </div>

      {/* Output notification (spec §3) */}
      {collider.mode === 'SYNTHESIZED' && !alertDismissed && (
        <div
          onClick={() => document.getElementById('council-synthesis-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          style={{ padding: '8px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.2em', textAlign: 'center', cursor: 'pointer', color: collider.synthesisRecord?.metrics.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA', borderTop: '1px solid rgba(120,140,200,0.12)', animation: 'council-alert-pulse 1.2s ease-in-out infinite' }}
        >
          ▼ {'//'} SYSTEM_OUTPUT_READY :: SCROLL_DOWN_FOR_SYNTHESIS ▼
        </div>
      )}
    </div>

    {/* Breakdown panel (spec §6) — below the ring container */}
    {collider.mode === 'SYNTHESIZED' && collider.synthesisRecord && (
      <CouncilSynthesisPanel
        record={collider.synthesisRecord}
        minds={seated}
        onDossier={openDossier}
        onReset={collider.reset}
      />
    )}

    <style>{`
      @keyframes council-alert-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      @media (prefers-reduced-motion: reduce) { [style*="council-alert-pulse"] { animation: none !important; } }
    `}</style>

    {selected && <SixteenPanel mind={selected} onClose={() => setSelected(null)} />}
  </div>
);
```

Also declare `showSidebars`, `mindA/mindB`, `hueOf` ABOVE the return (they are plain consts computed after the mobile early return, before the desktop return).

Grid stacking below ~1100px (spec §3): implement with a `useIsNarrow` check mirroring the existing `useIsMobile` pattern (breakpoint 1100): when narrow AND `showSidebars`, render the two `MindSidebar` cards in a two-column flex row BELOW the torus div instead of as grid columns (`gridTemplateColumns: 'minmax(0, 1fr)'`). Concretely: compute `const isNarrow = useIsNarrow();` and branch the two sidebar mounts on it — same components, different container:

```jsx
{showSidebars && isNarrow && (
  <div style={{ display: 'flex', gap: 12, padding: '0 12px 12px' }}>
    <div style={{ flex: 1, minWidth: 0 }}><MindSidebar mind={mindA} side="left" hue={hueOf(mindA)} onDossier={openDossier} /></div>
    <div style={{ flex: 1, minWidth: 0 }}><MindSidebar mind={mindB} side="right" hue={hueOf(mindB)} onDossier={openDossier} /></div>
  </div>
)}
```

with the grid-column mounts conditioned on `showSidebars && !isNarrow`. `useIsNarrow` (add next to `useIsMobile` in CouncilRing.jsx):

```js
function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1100);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1100);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
}
```

- [ ] **Step 4: Mobile clipping fixes (spec §7)**

In the mobile branch's telemetry panel (the four text rows), add single-line truncation to each row div:

```js
whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
```

and change the two fixed font sizes most prone to overflow — the anchorName row (16) and coreEquation row (14) — to responsive clamps:

```js
fontSize: 'clamp(13px, 4vw, 16px)'   // anchorName
fontSize: 'clamp(11px, 3.5vw, 14px)' // coreEquation
```

Mobile wheel safe-area: on the mobile `<svg>`, keep `viewBox="0 0 640 640"` but add `style={{ ..., padding: '0 6px' }}` to the masking container div (the `height: 360, overflow: 'hidden'` wrapper) so counter-rotated labels at the mask edge keep a safe margin.

- [ ] **Step 5: Tests + lint**

Run: `npx vitest run && npx eslint src/terminal/views/manifesto/CouncilRing.jsx`
Expected: full suite green; 0 errors 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/manifesto/CouncilRing.jsx
git commit -m "feat(manifesto): wire synthesis engine — grid sidebars, banner, scroll alert, clipping fixes"
```

---

### Task 11: Browser verification + final sweep

- [ ] **Step 1: Dev-server verification** (vite, `.claude/launch.json` name `scale94-dev`, port 5174; the app shows a boot overlay for ~8s after load — wait it out before asserting). Desktop viewport 1400×1000, navigate to the Manifesto tab, then verify:

1. **Ambient**: collisions run visually; NO breakdown panel; ticker updates.
2. **Arm**: click a node → ambient halts after current cycle; ARMED banner with `[dossier]`/`[disarm]`; left sidebar mounts; right shows AWAITING placeholder; clicking the armed node again disarms → ambient resumes.
3. **Fire**: arm + click second node → denser/brighter particle run; during flight, node clicks are ignored; NO panel until the ejection burst completes; then the SYSTEM_OUTPUT_READY pulse bar appears and the panel prints below with staged section reveal.
4. **Panel**: all four sections populated; seeds + directive copy on click (COPIED flash); `[dossier]` opens SixteenPanel; `/RESET` clears panel + selection → ambient resumes.
5. **Persistence**: fire a collision, switch to another tab (e.g. /Kernel), return to /Manifesto → panel + pair restored (SYNTHESIZED), no re-animation. Then `/RESET` → switch away/back → AMBIENT.
6. **Scroll alert**: dismisses after scrolling the panel into view.
7. **Clipping acceptance** at 1400×1000, 1100×800, 768×1024, 375×812: no text intersects the torus box; no mid-glyph cuts; sidebars stack below torus under 1100px. (Compare canvas/svg/sidebar bounding rects via preview_eval.)
8. Console: no errors, no React warnings.
9. localStorage: `scale94.council.ledger.v1` contains EVENT + SYNTHESIS records; mutate nothing.

- [ ] **Step 2: Final sweep**

Run: `npm test && npm run build`
Run: `git grep -n "Math.random" -- src/terminal/views/manifesto/ src/terminal/data/dimSemantics.js src/terminal/components/CopySpan.jsx` → comments only.
Run: `npx eslint src/terminal/views/manifesto/ src/terminal/data/dimSemantics.js src/terminal/components/CopySpan.jsx` → 0 errors 0 warnings.

- [ ] **Step 3: Commit any stragglers; do NOT push.**

---

## Self-Review Notes

- **Spec coverage:** state machine + gate + persistence + /RESET (Tasks 5, 8, 10), dual sidebars + scroll alert (7, 10), clipping (10), click mechanics + dossier re-route (10), shared cores (1, 2), engine + council voice + guest path (6), SKS ledger + rehydration (4, 8), panel + copy seeds (9), bus recordId (8: `COUNCIL_SYNTHESIS` event), testing (each task + 11).
- **Threshold correction:** spec said paradox survival `≥0.02`; the real core filters `> 0.08` (0.02 is the loop-break epsilon). Core behavior preserved exactly; spec amended alongside this plan.
- **Type consistency check:** `councilLedger.deriveUiState()` → `{mode, armed, record}` consumed in Task 8's rehydration; reducer state `{mode, armedDim, pair, record}` consumed in Task 10 via `collider.mode/armedMind/pairMinds/synthesisRecord`; `synthesize()` record shape matches Task 4's test fixture and Task 9's panel reads (`sections.*`, `metrics.trajectory`, `pair[].anchorName|label`, `directive`, `ordinal`). `mindEntry/guestEntry` exported from councilSynthesis (Task 6) and consumed in Task 8.
- **Known intentional deviations:** ambient cycles do NOT append to the ledger (spec: interactive events only); FIRE events are transitional in `deriveUiState` (a reload mid-flight lands on the prior state rather than resuming an animation).
