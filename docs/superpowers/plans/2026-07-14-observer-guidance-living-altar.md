# Observer Guidance + Living Altar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The eye ambiently teaches the four element houses, mirrors every tab click, pulses in sync with the suggested tab; the altar's four element seals become living wet/dry gateways with a hold-to-seal armed ritual.

**Architecture:** A new React-free `guidanceStore` (same discipline as `spineStore`) runs the ambient suggestion cycle and mirror-flash; a pure `resolveEyeState` function owns the eye's priority chain (testable without WebGL); `ObserverEye` gains `pulse`/`constrict`/`lens` props; `QuintessenceAltar` seals derive wet/dry from `observatoryBus` gaze totals, click always navigates, hold (1.2s, interval-driven — never rAF, which is suppressed in the preview pane) seals.

**Tech Stack:** React 18, Vite, vitest (`npm test` = `vitest run`), WebGL1 fragment shader, Tailwind classes + inline styles.

**Spec:** `docs/superpowers/specs/2026-07-14-observer-guidance-living-altar-design.md`

## Global Constraints

- Doctrine: guidance never blocks navigation, never disables a control, never removes chrome. No door ever closes.
- Element↔house keystone (LOCKED): FIRE=`art` tint `[255,176,32]`, AIR=`transmission` tint `[168,85,247]`, WATER=`ledger` tint `[20,184,166]`, EARTH=`ecocide` tint `[122,184,0]`.
- Shared beat period: **2400ms**, phase-anchored to `performance.now()` on both CSS (`animation-delay: -(now % 2400)ms`) and shader (`u_t` is already `performance.now()/1000`-rooted) sides.
- Cadence constants: initial rest 15000ms, suggest 20000ms, rest 40000–70000ms (random), mirror-flash 1500ms, hold-to-seal 1200ms.
- Armed prompt copy, verbatim: `[ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL]`
- `prefers-reduced-motion`: no tab pulse, no progressive constriction; ObserverEye's existing static-snap behavior is the model.
- All timers that repeat must be cleanable (unmount/HMR); a dead guidance store degrades to `resting`, a failed witness read renders all seals dry. Never throw from a store.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Run the full suite (`npm test`) before each commit; 431 tests currently pass — never commit below that baseline plus your new tests.
- Do NOT push to origin under any circumstances.

---

### Task 1: guidanceStore — the ambient picker

**Files:**
- Create: `src/terminal/quintessence/guidanceStore.js`
- Test: `src/terminal/quintessence/__tests__/guidanceStore.test.js`

**Interfaces:**
- Consumes: `getSpine`/`subscribeSpine` from `./spineStore`, `STORAGE_KEY` from `./sealedArtifact`.
- Produces (later tasks rely on these exact names):
  - `NAV_TINTS: Record<tabId, [r,g,b]>` — every nav tab's hue.
  - `ELEMENT_HOUSES: string[]` — `['art','transmission','ledger','ecocide']`.
  - `getGuidance() → { suggestion: {tab,tint}|null, flash: {tab,tint}|null }`
  - `subscribeGuidance(fn) → unsubscribe` (fn receives the getGuidance() shape)
  - `startGuidance()` — idempotent.
  - `notifyNav(tab: string)` — mirror-flash + accepted-suggestion handling.
  - `_resetGuidanceForTests({ random } = {})`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/quintessence/__tests__/guidanceStore.test.js
// The yellow-prop picker: element houses only, no nagging, no immediate repeats.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getGuidance, subscribeGuidance, startGuidance, notifyNav,
  NAV_TINTS, ELEMENT_HOUSES, _resetGuidanceForTests,
} from '../guidanceStore';
import { setTrend, _resetSpineForTests } from '../spineStore';

const INITIAL_REST = 15000, SUGGEST = 20000, REST_MAX = 70000;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  _resetSpineForTests();
  _resetGuidanceForTests({ random: () => 0 }); // rest always REST_MIN, pick always pool[0]
});
afterEach(() => {
  _resetGuidanceForTests();
  _resetSpineForTests();
  vi.useRealTimers();
});

describe('guidanceStore — the element curriculum', () => {
  it('exports the four element houses and a tint for every nav tab', () => {
    expect(ELEMENT_HOUSES).toEqual(['art', 'transmission', 'ledger', 'ecocide']);
    for (const t of [...ELEMENT_HOUSES, 'kernel', 'bsky', 'manifesto', 'scaling',
                     'privacy', 'surveillance', 'cryptography', 'lunar', 'ledger', 'mercury']) {
      expect(NAV_TINTS[t], t).toHaveLength(3);
    }
  });

  it('stays silent through the initial rest, then suggests an element house', () => {
    startGuidance();
    expect(getGuidance().suggestion).toBeNull();
    vi.advanceTimersByTime(INITIAL_REST);
    const s = getGuidance().suggestion;
    expect(ELEMENT_HOUSES).toContain(s.tab);
    expect(s.tint).toEqual(NAV_TINTS[s.tab]);
  });

  it('withdraws the suggestion after SUGGEST_MS and rests before the next', () => {
    startGuidance();
    vi.advanceTimersByTime(INITIAL_REST);
    const first = getGuidance().suggestion.tab;
    vi.advanceTimersByTime(SUGGEST);
    expect(getGuidance().suggestion).toBeNull();       // the rest interlude
    vi.advanceTimersByTime(40000);                     // random=()=>0 → rest is exactly REST_MIN
    const second = getGuidance().suggestion.tab;       // advance exactly to the next suggestion window
    expect(second).not.toBe(first);                    // no immediate repeat
    expect(ELEMENT_HOUSES).toContain(second);
  });

  it('never suggests once the journey starts (spine touched)', () => {
    startGuidance();
    setTrend({ label: 'x', velocity: 0.5 });
    vi.advanceTimersByTime(INITIAL_REST + SUGGEST + REST_MAX);
    expect(getGuidance().suggestion).toBeNull();
  });

  it('notifyNav fires a mirror-flash in the clicked tab tint, clears after 1500ms', () => {
    startGuidance();
    notifyNav('scaling');
    expect(getGuidance().flash).toEqual({ tab: 'scaling', tint: NAV_TINTS.scaling });
    vi.advanceTimersByTime(1500);
    expect(getGuidance().flash).toBeNull();
  });

  it('navigating to the suggested house ends the suggestion early (invitation accepted)', () => {
    startGuidance();
    vi.advanceTimersByTime(INITIAL_REST);
    const s = getGuidance().suggestion.tab;
    notifyNav(s);
    expect(getGuidance().suggestion).toBeNull();
  });

  it('never suggests the tab the visitor is currently on', () => {
    startGuidance();
    notifyNav('art');                                   // visitor sits on chaos
    vi.advanceTimersByTime(1500 + INITIAL_REST + SUGGEST + 10 * REST_MAX);
    // walk several cycles; 'art' must never be suggested while active
    for (let i = 0; i < 6; i++) {
      const s = getGuidance().suggestion;
      if (s) expect(s.tab).not.toBe('art');
      vi.advanceTimersByTime(SUGGEST + REST_MAX);
    }
  });

  it('subscribers are notified on every transition and unsubscribe cleanly', () => {
    const seen = [];
    const un = subscribeGuidance(g => seen.push(g.suggestion?.tab ?? null));
    startGuidance();
    vi.advanceTimersByTime(INITIAL_REST);
    expect(seen.at(-1)).not.toBeNull();
    un();
    const n = seen.length;
    vi.advanceTimersByTime(SUGGEST + REST_MAX);
    expect(seen.length).toBe(n);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/guidanceStore.test.js`
Expected: FAIL — `Cannot find module '../guidanceStore'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/quintessence/guidanceStore.js — the yellow-prop picker (spec §3).
// Bus-adjacent store, same discipline as spineStore: no React, listener Set.
// Ambient mode teaches ONLY the four element houses. Eligibility = untouched
// spine and no sealed kernel; the store goes dormant the moment the journey
// starts and never nags — a mandatory rest interlude follows every suggestion.
import { getSpine, subscribeSpine } from './spineStore';
import { STORAGE_KEY } from './sealedArtifact';

// One hue vocabulary for the whole guidance layer (mirror-flash needs all tabs).
export const NAV_TINTS = {
  kernel: [6, 182, 212],    bsky: [56, 189, 248],     manifesto: [139, 92, 246],
  transmission: [168, 85, 247], scaling: [217, 70, 239], privacy: [244, 63, 94],
  surveillance: [239, 68, 68], cryptography: [249, 115, 22], art: [255, 176, 32],
  ecocide: [122, 184, 0],   lunar: [139, 92, 246],    ledger: [20, 184, 166],
  mercury: [192, 192, 192],
};

// The element curriculum (keystone): FIRE=art, AIR=transmission, WATER=ledger, EARTH=ecocide.
export const ELEMENT_HOUSES = ['art', 'transmission', 'ledger', 'ecocide'];

const INITIAL_REST_MS = 15000;
const SUGGEST_MS      = 20000;
const REST_MIN_MS     = 40000;
const REST_MAX_MS     = 70000;
const FLASH_MS        = 1500;

let suggestion = null;      // { tab, tint } | null
let flash = null;           // { tab, tint } | null
let activeTab = null;       // last navigated tab — never suggest where the visitor stands
let lastSuggested = null;   // no immediate repeats
let started = false;
let timer = 0, flashTimer = 0;
let unsubSpine = null;
let rng = Math.random;
const listeners = new Set();

function ping() {
  const snap = getGuidance();
  listeners.forEach(fn => { try { fn(snap); } catch (_) { /* noisy subscriber ≠ dead store */ } });
}

function eligible() {
  const s = getSpine();
  if (s.trend || s.council || s.phase || s.element) return false;
  try { if (globalThis.localStorage?.getItem(STORAGE_KEY)) return false; } catch (_) { /* volatile is fine */ }
  return true;
}

function pickHouse() {
  let pool = ELEMENT_HOUSES.filter(t => t !== activeTab && t !== lastSuggested);
  if (pool.length === 0) pool = ELEMENT_HOUSES.filter(t => t !== activeTab);
  return pool[Math.floor(rng() * pool.length)];
}

function scheduleRest(ms) {
  clearTimeout(timer);
  timer = setTimeout(beginSuggestion, ms);
}

function beginSuggestion() {
  if (!eligible()) { goDormant(); return; }
  const tab = pickHouse();
  lastSuggested = tab;
  suggestion = { tab, tint: NAV_TINTS[tab] };
  ping();
  clearTimeout(timer);
  timer = setTimeout(endSuggestion, SUGGEST_MS);
}

function endSuggestion() {
  suggestion = null;
  ping();
  scheduleRest(REST_MIN_MS + Math.floor(rng() * (REST_MAX_MS - REST_MIN_MS)));
}

function goDormant() {
  clearTimeout(timer);
  if (suggestion) { suggestion = null; ping(); }
}

function onSpine() {
  if (!eligible()) goDormant();
  else if (!suggestion) scheduleRest(INITIAL_REST_MS); // spine reset → re-enter gently
}

export function getGuidance() { return { suggestion, flash }; }

export function subscribeGuidance(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function startGuidance() {
  if (started) return;
  started = true;
  unsubSpine = subscribeSpine(onSpine);
  if (eligible()) scheduleRest(INITIAL_REST_MS);
}

export function notifyNav(tab) {
  activeTab = tab;
  clearTimeout(flashTimer);
  flash = { tab, tint: NAV_TINTS[tab] || NAV_TINTS.mercury };
  flashTimer = setTimeout(() => { flash = null; ping(); }, FLASH_MS);
  if (suggestion && suggestion.tab === tab) {
    // Invitation accepted — withdraw and rest. No ledger entry (fork-of-will is out of scope).
    suggestion = null;
    clearTimeout(timer);
    scheduleRest(REST_MIN_MS + Math.floor(rng() * (REST_MAX_MS - REST_MIN_MS)));
  }
  ping();
}

export function _resetGuidanceForTests({ random } = {}) {
  clearTimeout(timer); clearTimeout(flashTimer);
  if (unsubSpine) { unsubSpine(); unsubSpine = null; }
  suggestion = null; flash = null; activeTab = null; lastSuggested = null;
  started = false; listeners.clear();
  rng = random || Math.random;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/quintessence/__tests__/guidanceStore.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Full suite + commit**

Run: `npm test` — expected: all pass (431 + 8).

```bash
git add src/terminal/quintessence/guidanceStore.js src/terminal/quintessence/__tests__/guidanceStore.test.js
git commit -m "feat(observer): guidanceStore — the ambient element curriculum picker

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: resolveEyeState — the priority chain as a pure function

**Files:**
- Create: `src/terminal/components/resolveEyeState.js`
- Test: `src/terminal/components/__tests__/resolveEyeState.test.js`
- Modify: `src/terminal/components/MercuryEyeIndicator.jsx` (lines ~81–96 VERTEBRA const, ~164–172 state computation)

**Interfaces:**
- Consumes: nothing runtime; tint values must match the existing `VERTEBRA` in `MercuryEyeIndicator.jsx` exactly.
- Produces:
  - `resolveEyeState({ flaring, sealed, spine, suggestion, flash }) → { state, tint, gaze, pulse, pulseTab }`
    - `state ∈ 'compiling'|'complete'|'armed'|'leaning'|'resting'`; `tint: [r,g,b]|null`; `gaze: [x,y]|null`; `pulse: boolean`; `pulseTab: string|null`.
  - `pulseTabFor({ sealed, flaring, spine, suggestion }) → string|null` (Task 4 uses this in App).

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/components/__tests__/resolveEyeState.test.js
// Spec §2: compiling > complete > armed > compass > mirror-flash > ambient > resting
// (mirror-flash is an overlay: it beats every base state except compiling).
import { describe, it, expect } from 'vitest';
import { resolveEyeState, pulseTabFor } from '../resolveEyeState';

const empty  = { trend: null, council: null, phase: null, element: null };
const trendOnly = { ...empty, trend: { label: 'x' } };
const full   = { trend: {}, council: {}, phase: 'DARK INCUBATION', element: null };
const S = (over = {}) => ({ flaring: false, sealed: false, spine: empty, suggestion: null, flash: null, ...over });

describe('resolveEyeState — the priority chain', () => {
  it('compiling beats everything, including flash', () => {
    const r = resolveEyeState(S({ flaring: true, sealed: true, flash: { tab: 'art', tint: [1, 2, 3] } }));
    expect(r.state).toBe('compiling');
  });

  it('mirror-flash overlays complete/armed/compass/ambient as leaning in the flash tint', () => {
    for (const base of [S({ sealed: true }), S({ spine: full }), S({ spine: trendOnly }), S()]) {
      const r = resolveEyeState({ ...base, flash: { tab: 'scaling', tint: [217, 70, 239] } });
      expect(r.state).toBe('leaning');
      expect(r.tint).toEqual([217, 70, 239]);
    }
  });

  it('sealed → complete, no pulse, no pulseTab', () => {
    const r = resolveEyeState(S({ sealed: true, suggestion: { tab: 'art', tint: [1, 2, 3] } }));
    expect(r).toMatchObject({ state: 'complete', pulse: false, pulseTab: null });
  });

  it('full spine → armed with pulse (synced to the altar), no pulseTab', () => {
    const r = resolveEyeState(S({ spine: full }));
    expect(r).toMatchObject({ state: 'armed', pulse: true, pulseTab: null });
  });

  it('journey started → compass-leaning at next vertebra, pulseTab = its tab', () => {
    const r = resolveEyeState(S({ spine: trendOnly }));
    expect(r.state).toBe('leaning');
    expect(r.tint).toEqual([167, 139, 250]);   // council violet
    expect(r.pulseTab).toBe('manifesto');
    expect(r.pulse).toBe(true);
  });

  it('empty spine + ambient suggestion → leaning in the house hue, pulseTab = the house', () => {
    const r = resolveEyeState(S({ suggestion: { tab: 'ledger', tint: [20, 184, 166] } }));
    expect(r.state).toBe('leaning');
    expect(r.tint).toEqual([20, 184, 166]);
    expect(r.pulseTab).toBe('ledger');
  });

  it('empty spine, no suggestion → resting', () => {
    expect(resolveEyeState(S()).state).toBe('resting');
  });

  it('flash keeps the underlying pulseTab alive (the tab pulse must not blink off)', () => {
    const r = resolveEyeState(S({ spine: trendOnly, flash: { tab: 'kernel', tint: [6, 182, 212] } }));
    expect(r.pulseTab).toBe('manifesto');
  });

  it('pulseTabFor mirrors the chain without flash', () => {
    expect(pulseTabFor({ sealed: false, flaring: false, spine: trendOnly, suggestion: null })).toBe('manifesto');
    expect(pulseTabFor({ sealed: true, flaring: false, spine: trendOnly, suggestion: null })).toBeNull();
    expect(pulseTabFor({ sealed: false, flaring: false, spine: full, suggestion: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/components/__tests__/resolveEyeState.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/components/resolveEyeState.js — the eye's priority chain (spec §2).
// Pure: no React, no WebGL — the whole chain is table-testable.
// Order: compiling > (mirror-flash overlay) > complete > armed > compass > ambient > resting.
const VERTEBRAE = [
  { key: 'trend',   tab: 'bsky',      tint: [56, 189, 248] },   // BSKY sky
  { key: 'council', tab: 'manifesto', tint: [167, 139, 250] },  // Manifesto violet
  { key: 'phase',   tab: 'lunar',     tint: [217, 70, 239] },   // Lunar fuchsia
];
const NAV_GAZE = [0.15, -0.04]; // drift toward the nav row

export function resolveEyeState({ flaring, sealed, spine, suggestion, flash }) {
  if (flaring) return { state: 'compiling', tint: null, gaze: null, pulse: false, pulseTab: null };

  const next = VERTEBRAE.find(v => !spine[v.key]);
  const marked = !!(spine.trend || spine.council || spine.phase);
  const pulseTab = sealed ? null
    : !next ? null                                  // armed: the altar is the pulse partner
    : marked ? next.tab                             // compass curriculum
    : suggestion ? suggestion.tab                   // element curriculum
    : null;

  if (flash) return { state: 'leaning', tint: flash.tint, gaze: null, pulse: false, pulseTab };
  if (sealed) return { state: 'complete', tint: null, gaze: null, pulse: false, pulseTab: null };
  if (!next)  return { state: 'armed', tint: null, gaze: null, pulse: true, pulseTab: null };
  if (marked) return { state: 'leaning', tint: next.tint, gaze: NAV_GAZE, pulse: true, pulseTab };
  if (suggestion) return { state: 'leaning', tint: suggestion.tint, gaze: NAV_GAZE, pulse: true, pulseTab };
  return { state: 'resting', tint: null, gaze: null, pulse: false, pulseTab: null };
}

export function pulseTabFor({ sealed, flaring, spine, suggestion }) {
  return resolveEyeState({ flaring, sealed, spine, suggestion, flash: null }).pulseTab;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/components/__tests__/resolveEyeState.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Refactor MercuryEyeIndicator to consume it (no behavior change yet)**

In `src/terminal/components/MercuryEyeIndicator.jsx`:

Add import at top (after the existing imports):
```js
import { resolveEyeState } from './resolveEyeState';
```

Delete the `VERTEBRA` const (lines ~84–89, the block starting `const VERTEBRA = [`) — it now lives in `resolveEyeState.js`.

Replace the state computation block (lines ~164–172):
```js
  const nextVert = VERTEBRA.find(v => !spine[v.key]);
  const anyMarked = !!(spine.trend || spine.council || spine.phase);
  const eyeState = flaring ? 'compiling'
    : sealed ? 'complete'
    : !nextVert ? 'armed'
    : anyMarked ? 'leaning'
    : 'resting';
  const leanTint = eyeState === 'leaning' && nextVert ? nextVert.tint : null;
  const leanGaze = eyeState === 'leaning' ? [0.15, -0.04] : null;
```
with:
```js
  // Guidance (suggestion/flash) arrives in the next task; nulls preserve today's behavior.
  const { state: eyeState, tint: leanTint, gaze: leanGaze, pulse: eyePulse } =
    resolveEyeState({ flaring, sealed, spine, suggestion: null, flash: null });
```

The `<ObserverEye … />` call keeps `state={eyeState} tint={leanTint} gaze={leanGaze}` unchanged (`eyePulse` is consumed in Task 4 — the unused variable is fine for one task; prefix it `_eyePulse` if lint complains, then rename back in Task 4).

- [ ] **Step 6: Full suite + commit**

Run: `npm test` — expected: all pass.

```bash
git add src/terminal/components/resolveEyeState.js src/terminal/components/__tests__/resolveEyeState.test.js src/terminal/components/MercuryEyeIndicator.jsx
git commit -m "feat(observer): extract resolveEyeState — the priority chain as a pure function

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Wire ambient mode + mirror-flash into the eye and handleNav

**Files:**
- Modify: `src/terminal/components/MercuryEyeIndicator.jsx` (imports + one state hook)
- Modify: `src/terminal/App.jsx` (`handleNav`, lines ~565–581)

**Interfaces:**
- Consumes: `startGuidance`, `subscribeGuidance`, `getGuidance`, `notifyNav` from `../quintessence/guidanceStore` (Task 1); `resolveEyeState` (Task 2).
- Produces: the eye now visibly enters ambient/mirror states. No new exports.

- [ ] **Step 1: Subscribe the eye to guidance**

In `MercuryEyeIndicator.jsx`, add to the imports:
```js
import { getGuidance, subscribeGuidance, startGuidance } from '../quintessence/guidanceStore';
```

Inside the component, next to the existing `spine`/`sealed` state hooks, add:
```js
  const [guidance, setGuidance] = useState(getGuidance);
  useEffect(() => { startGuidance(); return subscribeGuidance(setGuidance); }, []);
```

Update the resolve call from Task 2 to pass real guidance:
```js
  const { state: eyeState, tint: leanTint, gaze: leanGaze, pulse: eyePulse } =
    resolveEyeState({ flaring, sealed, spine, suggestion: guidance.suggestion, flash: guidance.flash });
```

- [ ] **Step 2: Notify guidance from handleNav**

In `App.jsx`, add to the imports near the other quintessence imports (there is an existing `emitObs` import from `../observatory/observatoryBus` — put this adjacent):
```js
import { notifyNav } from './quintessence/guidanceStore';
```

In `handleNav` (line ~565), inside the existing deferred emit (the `setTimeout` that fires `emitObs('gaze','tab_navigated',…)`), add the notify so flash and witness stay in step:
```js
        setTimeout(() => {
          emitObs('gaze', 'tab_navigated', { tab });
          notifyNav(tab);
        }, 0);
```
(Replace the existing single-line `setTimeout(() => emitObs('gaze', 'tab_navigated', { tab }), 0);` with this block. `handleNav` only — `handleReturnToRoot` and article-open flows are content navigation, not tab-bar clicks; they don't flash.)

- [ ] **Step 3: Verify live in the browser pane**

Start the dev server (`preview_start` name `scale94-dev`), viewport ≥1024px wide, then in the page console (pane toolkit):
1. `localStorage.removeItem('quintessence_spine_v1'); location.reload()` — eye rests silver.
2. Wait ~15s (or `vi`-less: just wait) — the eye should lean into one of the four house hues for 20s, then rest. Confirm hue via pixel readback (patched `drawArrays` + `readPixels` on the 64px canvas — dominant channel must match the suggested house).
3. Click any tab — the pupil flashes that tab's hue ~1.5s (readback again), then returns.
4. Mark a trend via `window.__quintessenceSpine.setTrend({label:'t',velocity:.5})` — ambient goes dormant; compass violet resumes (existing behavior).

Expected: all four behaviors observable. If rAF is suppressed in the pane, the watchdog keeps the eye lerping (already built).

- [ ] **Step 4: Full suite + commit**

Run: `npm test` — expected: all pass.

```bash
git add src/terminal/components/MercuryEyeIndicator.jsx src/terminal/App.jsx
git commit -m "feat(observer): ambient element curriculum + mirror-flash wired into the eye

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: The shared-beat pulse (eye shader + nav tabs, desktop and mobile)

**Files:**
- Modify: `src/terminal/components/ObserverEye.jsx` (shader + props)
- Modify: `src/terminal/components/MercuryEyeIndicator.jsx` (pass `pulse`)
- Modify: `src/terminal/App.jsx` (nav pulse state + CSS + button classes)

**Interfaces:**
- Consumes: `pulseTabFor` from `./components/resolveEyeState`; `getGuidance`/`subscribeGuidance` from guidanceStore; `getSpine`/`subscribeSpine` from spineStore.
- Produces: `ObserverEye` prop `pulse: boolean` (brightness pulse at 2400ms, `u_t`-phased). CSS class `nav-beat` + CSS var `--beat-delay`.

- [ ] **Step 1: Add the pulse uniform to ObserverEye**

In `ObserverEye.jsx`:

1. Component signature gains `pulse = false`:
```js
export default function ObserverEye({ state = 'resting', size = 28, tint = null, gaze = null, pulse = false, onClick, title, className = '', ariaLabel }) {
```
2. Add a ref + sync (extend the existing ref-sync effect):
```js
  const pulseRef  = useRef(pulse);
```
and in the existing `useEffect(() => { stateRef.current = state; … }, [state, tint, gaze])`, extend to:
```js
  useEffect(() => {
    stateRef.current = state; tintRef.current = tint; gazeRef.current = gaze; pulseRef.current = pulse;
    snapRef.current?.();
  }, [state, tint, gaze, pulse]);
```
3. In the FS source, add the uniform to the declaration line (`u_t,u_focus,u_irid,u_speed` line):
```
'uniform float u_t,u_focus,u_irid,u_speed,u_pulse;uniform vec3 c0,c1,c2;uniform vec2 u_gaze;',
```
and immediately before the `float a=1.0-smoothstep(0.93,1.0,r);` line insert:
```
' col*=1.0+u_pulse*0.16*sin(u_t*2.61799);',   // 2π/2.4s — the shared beat
```
4. Register the uniform: add `'u_pulse'` to the `['u_t','u_focus','u_irid','u_speed','c0','c1','c2','u_gaze']` array.
5. Add to `cur`: `pulse: 0` in the `const cur = { … }` initializer; in `frame()`, after the `cur.irid` lerp add:
```js
      cur.pulse = lerp(cur.pulse, pulseRef.current ? 1 : 0, e);
```
   in `render()` add:
```js
      gl.uniform1f(U.u_pulse, cur.pulse);
```
   and in the reduced-motion `snapRef.current` body add `cur.pulse = pulseRef.current ? 1 : 0;` before `render(0)` — but note reduced-motion renders `u_t = 0`, so the pulse term is inert there by construction (sin(0) = 0 offset — acceptable and intended: no pulse under reduced motion).

- [ ] **Step 2: Pass pulse from MercuryEyeIndicator**

In the `<ObserverEye … />` element add:
```jsx
        pulse={eyePulse}
```

- [ ] **Step 3: Nav pulse state in App**

In `App.jsx` imports:
```js
import { getGuidance as getEyeGuidance, subscribeGuidance } from './quintessence/guidanceStore';
import { getSpine as getSpineSnap, subscribeSpine as subscribeSpineSnap } from './quintessence/spineStore';
import { pulseTabFor } from './components/resolveEyeState';
```

Inside the `App` component (near the other state hooks, before `handleNav`):
```js
  // ── Synced tab pulse (Observer guidance spec §4): the suggested tab breathes
  // on the eye's 2400ms beat. sealed:false is safe — sealing requires a complete
  // spine, and a complete spine already yields pulseTab null (armed).
  const [eyeGuidance, setEyeGuidance] = useState(getEyeGuidance);
  const [spineSnap, setSpineSnap] = useState(getSpineSnap);
  useEffect(() => subscribeGuidance(setEyeGuidance), []);
  useEffect(() => subscribeSpineSnap(() => setSpineSnap(getSpineSnap())), []);
  const pulseTab = pulseTabFor({ sealed: false, flaring: false, spine: spineSnap, suggestion: eyeGuidance.suggestion });
  const beatDelay = useMemo(() => `-${Math.round(performance.now() % 2400)}ms`, [pulseTab]);
  const beat = (tab) => (pulseTab === tab ? ' nav-beat' : '');
```
(`useMemo` is already imported in App.jsx; if not, add it to the React import.)

- [ ] **Step 4: The CSS**

Inside the `<header …>` JSX (next to the existing `<style>` blocks in the tree — App already injects component-scoped styles; place this one just inside the header, before the eye), add:
```jsx
      <style>{`
        .nav-beat {
          animation: nav-beat 2400ms ease-in-out infinite;
          animation-delay: var(--beat-delay, 0ms);
        }
        @keyframes nav-beat {
          0%, 100% { opacity: 0.55; filter: none; }
          50%      { opacity: 1;    filter: drop-shadow(0 0 6px currentColor); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nav-beat { animation: none; }
        }
      `}</style>
```
And on the `<nav aria-label="Main navigation" …>` element add the CSS var to its `style` prop:
```jsx
style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', '--beat-delay': beatDelay }}
```

- [ ] **Step 5: Tag the suggestible buttons**

Seven tabs can ever pulse (4 element houses + 3 vertebrae). In the **desktop nav** (lines ~1094–1120), append `${beat('<tab>')}` inside the existing template-literal `className` of exactly these buttons, at the end of the literal:

| aria-label | beat argument |
|---|---|
| BSKY | `beat('bsky')` |
| Manifesto | `beat('manifesto')` |
| Transmission | `beat('transmission')` |
| Chaos | `beat('art')` |
| Ecocide | `beat('ecocide')` |
| Ledger | `beat('ledger')` |
| Lunar | `beat('lunar')` |

Example (BSKY — apply the same trailing `${beat('…')}` pattern to each of the seven):
```jsx
<button aria-label="BSKY" … className={`${activeTab === 'bsky' ? '…' : '…'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap${beat('bsky')}`}>
```

In the **mobile bottom nav** (lines ~1430–1470), the same seven buttons exist with plain-string classNames — convert each affected `className="…"` to a template literal and append the same `${beat('…')}`. The mobile nav's parent `<nav>` also needs `style={{ '--beat-delay': beatDelay }}` added (merge with any existing style prop).

- [ ] **Step 6: Verify live**

Browser pane, clean spine, wait for a suggestion:
1. The suggested tab breathes (opacity 0.55↔1 + glow) while the eye leans in the same hue.
2. Confirm phase sync: `getComputedStyle(document.querySelector('.nav-beat')).animationDelay` is negative and < 2400ms; visually the tab's bright peak coincides with the pupil's bright peak (screenshot pair at 1.2s offset shows opposite phases of both).
3. `matchMedia('(prefers-reduced-motion: reduce)')` emulation → no pulse animation.

- [ ] **Step 7: Full suite + commit**

Run: `npm test` — expected: all pass.

```bash
git add src/terminal/components/ObserverEye.jsx src/terminal/components/MercuryEyeIndicator.jsx src/terminal/App.jsx
git commit -m "feat(observer): shared-beat pulse — eye and suggested tab breathe as one object

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Living seals — wet/dry, click = navigate

**Files:**
- Create: `src/terminal/mercury/ElementSeal.jsx`
- Modify: `src/terminal/components/ObserverEye.jsx` (add `lens` prop)
- Modify: `src/terminal/mercury/QuintessenceAltar.jsx` (ELEMENTS + seals + onNavigate)
- Modify: `src/terminal/views/MercuryTab.jsx` (thread prop, line ~224)
- Modify: `src/terminal/App.jsx` (line ~1288, `<MercuryTab />`)
- Test: `src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx` (rewrite)

**Interfaces:**
- Consumes: `emit`, `getTotals`, `subscribe`, `_resetForTests` from `src/observatory/observatoryBus.js`; ObserverEye.
- Produces:
  - `ObserverEye` prop `lens: boolean` (default `true`; `false` skips the hexagon SVG).
  - `ElementSeal({ wet, tint, armed = false, holdProgress = 0, size = 72 })`.
  - `QuintessenceAltar({ onDeposited, onNavigate })` — `onNavigate(tab: string)`.
  - App passes `onNavigateTab` to `MercuryTab`, which forwards as `onNavigate` to the altar.

- [ ] **Step 1: Rewrite the altar test file**

Replace the entire contents of `src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx`:

```jsx
// src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx — the living altar (spec §5–6).
// Smoke-level: wet/dry from the witness, click always navigates, the armed
// prompt names the gesture. No compile-flow simulation (timers + wasm not worth mocking).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import QuintessenceAltar from '../../mercury/QuintessenceAltar';
import { setTrend, setCouncil, setPhase, _resetSpineForTests } from '../spineStore';
import { emit, _resetForTests as resetBus } from '../../../observatory/observatoryBus';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ELEMENT_IDS = ['FIRE', 'AIR', 'EARTH', 'WATER'];

let container = null;
let root = null;
let onNavigate = null;

function sealButtons() {
  return [...container.querySelectorAll('button')]
    .filter(b => ELEMENT_IDS.some(id => b.textContent.includes(id)));
}
function sealFor(id) {
  return sealButtons().find(b => b.textContent.includes(id));
}
function completeSpine() {
  act(() => {
    setTrend({ label: 'degrowth', velocity: 0.9 });
    setCouncil({ pair: ['OSTROM', 'WIENER'], directive: 'test directive', trajectory: 'FOUNDATION', paradoxCount: 2 });
    setPhase('SMOKE DISSOLUTION');
  });
}

beforeEach(() => {
  _resetSpineForTests();
  resetBus();
  localStorage.clear();
  onNavigate = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<QuintessenceAltar onNavigate={onNavigate} />); });
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  _resetSpineForTests();
  resetBus();
});

describe('QuintessenceAltar — the living altar', () => {
  it('empty spine: names the missing vertebrae, but the seals are NEVER disabled', () => {
    const text = container.textContent;
    expect(text).toContain('SPINE INCOMPLETE');
    const seals = sealButtons();
    expect(seals).toHaveLength(4);
    for (const b of seals) expect(b.disabled).toBe(false);
  });

  it('click always navigates to the element house — never ignites', () => {
    act(() => { sealFor('FIRE').click(); });
    expect(onNavigate).toHaveBeenCalledWith('art');
    act(() => { sealFor('WATER').click(); });
    expect(onNavigate).toHaveBeenCalledWith('ledger');
    act(() => { sealFor('AIR').click(); });
    expect(onNavigate).toHaveBeenCalledWith('transmission');
    act(() => { sealFor('EARTH').click(); });
    expect(onNavigate).toHaveBeenCalledWith('ecocide');
  });

  it('seals are dry until their house is visited, then wet (live via the bus)', () => {
    expect(sealFor('FIRE').getAttribute('data-wet')).toBe('false');
    act(() => { emit('gaze', 'tab_navigated', { tab: 'art' }); });
    expect(sealFor('FIRE').getAttribute('data-wet')).toBe('true');
    expect(sealFor('WATER').getAttribute('data-wet')).toBe('false');
  });

  it('armed altar: the prompt names the gesture, and click STILL navigates', () => {
    completeSpine();
    expect(container.textContent).toContain('ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL');
    expect(container.textContent).not.toContain('SPINE INCOMPLETE');
    act(() => { sealFor('EARTH').click(); });
    expect(onNavigate).toHaveBeenCalledWith('ecocide');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx`
Expected: FAIL — seals disabled, no `data-wet` attribute, click ignites (or no-ops), no armed prompt.

- [ ] **Step 3: Add the `lens` prop to ObserverEye**

Signature (extending Task 4's version):
```js
export default function ObserverEye({ state = 'resting', size = 28, tint = null, gaze = null, pulse = false, lens = true, onClick, title, className = '', ariaLabel }) {
```
Wrap the `<svg …>…</svg>` block (the hexagon) in:
```jsx
      {lens && (
        <svg viewBox="0 0 280 280" aria-hidden="true" …>…</svg>
      )}
```
And make the canvas size ratio depend on the lens: replace the two `Math.round(size * 0.58)` occurrences on the `<canvas>` style with `Math.round(size * (lens ? 0.58 : 0.94))` (no hexagon → the nebula fills the seal).

- [ ] **Step 4: Create ElementSeal**

```jsx
// src/terminal/mercury/ElementSeal.jsx — one element's living core (spec §5).
// Dry = mineral stillness: pure CSS, zero GPU. Wet = the eye's nebula in the
// house hue. Armed wet seals constrict toward miosis; holdProgress (0..1)
// drives the constriction the rest of the way under the visitor's finger.
import ObserverEye from '../components/ObserverEye';

export default function ElementSeal({ wet, tint, armed = false, holdProgress = 0, size = 72 }) {
  if (!wet) {
    return (
      <div
        aria-hidden="true"
        className="mx-auto rounded-full"
        style={{
          width: size, height: size,
          background: 'radial-gradient(circle at 38% 32%, #3f3f46 0%, #27272a 45%, #18181b 80%)',
          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.8)',
          opacity: 0.55,
        }}
      />
    );
  }
  return (
    <div className="mx-auto" style={{ width: size, height: size }}>
      <ObserverEye
        lens={false}
        state={armed ? 'compiling' : 'leaning'}
        tint={tint}
        pulse={armed}
        size={size}
        ariaLabel={undefined}
      />
    </div>
  );
}
```
Note: `armed` uses the `compiling` state purely for its high `focus` (0.86, the miosis) and slow-deep speed — but `compiling`'s palette is violet×lime, which would fight the house tint. `compiling` ignores `tint` (only `leaning` derives cols from tint), so instead: keep `state="leaning"` always and add a `constrict` prop to ObserverEye — see next step. Use:
```jsx
      <ObserverEye
        lens={false}
        state="leaning"
        tint={tint}
        pulse={armed}
        constrict={armed ? Math.max(0.58, 0.58 + 0.42 * holdProgress) : null}
        size={size}
      />
```

- [ ] **Step 5: Add the `constrict` prop to ObserverEye**

Signature gains `constrict = null` (number 0..1 or null). Add ref + sync in the shared effect (same pattern as `pulse`):
```js
  const constrictRef = useRef(constrict);
```
…and add `constrictRef.current = constrict;` inside the ref-sync effect, with `constrict` in its dependency array.

In `frame()` (and in the reduced-motion snap), the focus target becomes:
```js
      const focusTarget = constrictRef.current != null ? Math.max(tgt.focus, constrictRef.current) : tgt.focus;
      cur.focus = lerp(cur.focus, focusTarget, e);
```
(Replace the existing `cur.focus = lerp(cur.focus, tgt.focus, e);` line. In `snapRef.current`, replace `cur.focus = tgt.focus;` with the same `Math.max` expression.)

- [ ] **Step 6: Rebuild the altar's element grid**

In `QuintessenceAltar.jsx`:

1. Imports — add:
```js
import { getTotals, subscribe as subscribeBus } from '../../observatory/observatoryBus';
import ElementSeal from './ElementSeal';
```
2. Replace the `ELEMENTS` const:
```js
// Keystone (guidance spec §0): each element IS a house. Seal hue = house tab hue.
const ELEMENTS = [
  { id: 'FIRE',  sigil: '△', house: 'art',          tint: [255, 176, 32],  note: 'boson · force · the mask drops'   },
  { id: 'AIR',   sigil: '🜁', house: 'transmission', tint: [168, 85, 247],  note: 'boson · carrier · the mask drops' },
  { id: 'EARTH', sigil: '🜃', house: 'ecocide',      tint: [122, 184, 0],   note: 'fermion · structure · armor held' },
  { id: 'WATER', sigil: '▽', house: 'ledger',       tint: [20, 184, 166],  note: 'fermion · matter · armor held'    },
];
```
3. Component signature: `export default function QuintessenceAltar({ onDeposited, onNavigate })`.
4. Wet/dry state (inside the component, near the other hooks):
```js
  // The seals remember (spec §5): wet = house visited, read live off the witness.
  const readVisited = () => {
    try { return { ...getTotals().gaze.tabsVisited }; } catch (_) { return {}; } // dead bus → all dry
  };
  const [visited, setVisited] = useState(readVisited);
  useEffect(() => subscribeBus(evt => {
    if (evt.category === 'gaze' && evt.kind === 'tab_navigated') setVisited(readVisited());
  }), []);
```
5. Replace the incomplete-line block (the `{stage === -1 && missing.length > 0 && (…)}`) with:
```jsx
      {stage === -1 && (missing.length > 0 ? (
        <div className="text-[10px] font-mono tracking-[0.2em] text-red-400/70 uppercase">
          SPINE INCOMPLETE · {missing.join(' · ')}
        </div>
      ) : (
        <div role="status" className="text-[10px] font-mono tracking-[0.2em] text-amber-300/90 uppercase">
          [ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL]
        </div>
      ))}
```
6. Replace the element grid (the `{stage === -1 && (<div className="grid …`)} block) with:
```jsx
      {stage === -1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          {ELEMENTS.map(el => {
            const wet = (visited[el.house] || 0) > 0;
            return (
              <button key={el.id} type="button"
                data-wet={wet ? 'true' : 'false'}
                onClick={() => onNavigate?.(el.house)}
                className={`border p-4 text-center font-mono transition-colors cursor-pointer ${armed
                  ? 'border-amber-500/40 text-amber-200 hover:border-amber-300 hover:bg-amber-950/20'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900/30'}`}>
                <ElementSeal wet={wet} tint={el.tint} armed={armed} size={72} />
                <div className="text-[11px] tracking-[0.3em] mt-2">{el.id}</div>
                <div className="text-[8px] text-zinc-500 mt-1 lowercase">{el.note}</div>
              </button>
            );
          })}
        </div>
      )}
```
(The `sigil` stays in `ELEMENTS` for Task 6's confirm UI; the seal disc replaces it visually here. `ignite` is intentionally unreferenced by clicks now — Task 6 reattaches it to the hold gesture; if the linter flags `ignite` as unused in the interim, leave it — same-task-series churn.)

- [ ] **Step 7: Thread onNavigate**

`src/terminal/views/MercuryTab.jsx`: add `onNavigateTab` to the component's props (line ~top of the default export) and change line ~224:
```jsx
      <QuintessenceAltar onDeposited={revealSeal} onNavigate={onNavigateTab} />
```
`src/terminal/App.jsx` line ~1288:
```jsx
            <MercuryTab onNavigateTab={(tab) => handleNav('~/system/' + tab, tab)} />
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx`
Expected: PASS (4 tests). Note: WebGL is unavailable in jsdom — ObserverEye's `getContext('webgl')` returns null and the component renders an inert canvas; that's fine (tests assert `data-wet`, not pixels).

- [ ] **Step 9: Full suite + commit**

Run: `npm test` — expected: all pass (the old click-to-ignite expectations are gone with the rewrite).

```bash
git add src/terminal/mercury/ElementSeal.jsx src/terminal/mercury/QuintessenceAltar.jsx src/terminal/components/ObserverEye.jsx src/terminal/views/MercuryTab.jsx src/terminal/App.jsx src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx
git commit -m "feat(altar): living seals — wet/dry from the witness, click walks the house

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: The armed ritual — hold-to-seal

**Files:**
- Create: `src/terminal/mercury/useHoldToSeal.js`
- Test: `src/terminal/mercury/__tests__/useHoldToSeal.test.jsx`
- Modify: `src/terminal/mercury/QuintessenceAltar.jsx` (gesture wiring + keyboard confirm)

**Interfaces:**
- Consumes: React only.
- Produces: `useHoldToSeal(onComplete) → { holding: string|null, progress: number, start(id), cancel(), consumedClick(): boolean }`, `HOLD_MS = 1200`. Interval-driven (50ms ticks) — rAF is suppressed in the preview pane and must not gate the ritual.

- [ ] **Step 1: Write the failing hook test**

```jsx
// src/terminal/mercury/__tests__/useHoldToSeal.test.jsx — the ritual gesture (spec §6).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useHoldToSeal, HOLD_MS } from '../useHoldToSeal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container, root, api, completed;

function Probe() {
  api = useHoldToSeal(id => completed.push(id));
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  completed = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Probe />); });
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.useRealTimers();
});

describe('useHoldToSeal', () => {
  it('completes after HOLD_MS and reports the held id', () => {
    act(() => { api.start('FIRE'); });
    expect(api.holding).toBe('FIRE');
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(completed).toEqual(['FIRE']);
    expect(api.holding).toBeNull();
  });

  it('release before completion cancels cleanly — nothing fires', () => {
    act(() => { api.start('WATER'); });
    act(() => { vi.advanceTimersByTime(HOLD_MS - 100); });
    act(() => { api.cancel(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(completed).toEqual([]);
    expect(api.progress).toBe(0);
  });

  it('progress climbs monotonically toward 1 during the hold', () => {
    act(() => { api.start('AIR'); });
    act(() => { vi.advanceTimersByTime(600); });
    expect(api.progress).toBeGreaterThan(0.4);
    expect(api.progress).toBeLessThan(0.6);
  });

  it('consumedClick returns true exactly once after a completed hold (click suppression)', () => {
    act(() => { api.start('EARTH'); });
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(api.consumedClick()).toBe(true);
    expect(api.consumedClick()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/useHoldToSeal.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```js
// src/terminal/mercury/useHoldToSeal.js — press-and-hold ritual (spec §6).
// Interval-driven (50ms): rAF is suppressed in embedded preview panes, and a
// ritual that can't complete is a locked door. Uses Date-less relative ticks so
// fake timers drive it deterministically.
import { useCallback, useEffect, useRef, useState } from 'react';

export const HOLD_MS = 1200;
const TICK_MS = 50;

export function useHoldToSeal(onComplete) {
  const [holding, setHolding] = useState(null);
  const [progress, setProgress] = useState(0);
  const interval = useRef(0);
  const elapsed = useRef(0);
  const done = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const cancel = useCallback(() => {
    clearInterval(interval.current);
    elapsed.current = 0;
    setHolding(null);
    setProgress(0);
  }, []);

  const start = useCallback((id) => {
    clearInterval(interval.current);
    done.current = false;
    elapsed.current = 0;
    setHolding(id);
    setProgress(0);
    interval.current = setInterval(() => {
      elapsed.current += TICK_MS;
      const p = Math.min(1, elapsed.current / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        clearInterval(interval.current);
        done.current = true;
        setHolding(null);
        setProgress(0);
        onCompleteRef.current?.(id);
      }
    }, TICK_MS);
  }, []);

  // A completed hold must swallow the click that fires on pointer release.
  const consumedClick = useCallback(() => {
    const d = done.current;
    done.current = false;
    return d;
  }, []);

  useEffect(() => () => clearInterval(interval.current), []);

  return { holding, progress, start, cancel, consumedClick };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/__tests__/useHoldToSeal.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the gesture into the altar**

In `QuintessenceAltar.jsx`:

1. Import:
```js
import { useHoldToSeal } from './useHoldToSeal';
```
2. Inside the component:
```js
  const hold = useHoldToSeal(elId => ignite(elId));
  const [confirming, setConfirming] = useState(null); // element id — keyboard path
```
3. The seal button gains gesture handlers and hold visuals — replace the button from Task 5 step 6 with:
```jsx
              <button key={el.id} type="button"
                data-wet={wet ? 'true' : 'false'}
                onPointerDown={() => { if (armed) hold.start(el.id); }}
                onPointerUp={() => hold.cancel()}
                onPointerLeave={() => hold.cancel()}
                onPointerCancel={() => hold.cancel()}
                onClick={() => { if (hold.consumedClick()) return; onNavigate?.(el.house); }}
                onKeyDown={(e) => {
                  if (armed && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setConfirming(el.id);
                  }
                }}
                className={`border p-4 text-center font-mono transition-colors cursor-pointer relative ${armed
                  ? 'border-amber-500/40 text-amber-200 hover:border-amber-300 hover:bg-amber-950/20'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900/30'}`}>
                <ElementSeal wet={wet} tint={el.tint} armed={armed}
                  holdProgress={hold.holding === el.id ? hold.progress : 0} size={72} />
                {hold.holding === el.id && (
                  <div className="absolute inset-x-0 bottom-0 h-[3px] bg-amber-400/80"
                    style={{ width: `${Math.round(hold.progress * 100)}%` }} />
                )}
                <div className="text-[11px] tracking-[0.3em] mt-2">{el.id}</div>
                <div className="text-[8px] text-zinc-500 mt-1 lowercase">{el.note}</div>
              </button>
```
   Note: `cancel()` runs before the browser dispatches `click` on release — that is exactly why completion sets `done` BEFORE clearing state, and `consumedClick()` is checked in `onClick`. A completed hold cancels nothing (the interval already stopped); an early release cancels the ritual and the click falls through to navigation. This ordering is load-bearing — do not "simplify" it.
4. Keyboard confirm — render directly under the grid, inside the `stage === -1` block:
```jsx
          {confirming && (() => {
            const el = ELEMENTS.find(x => x.id === confirming);
            return (
              <div role="dialog" aria-label={`seal at ${el.id}?`}
                className="mt-3 border border-amber-500/40 p-3 font-mono text-[10px] tracking-[0.2em] uppercase flex items-center gap-4">
                <span className="text-amber-200">{el.sigil} {el.id} —</span>
                <button type="button" autoFocus
                  onClick={() => { setConfirming(null); ignite(el.id); }}
                  className="border border-amber-400/60 px-3 py-1 text-amber-200 hover:bg-amber-950/30">
                  seal the kernel here
                </button>
                <button type="button"
                  onClick={() => { setConfirming(null); onNavigate?.(el.house); }}
                  className="text-zinc-400 hover:text-zinc-200 lowercase">
                  walk the house →
                </button>
                <button type="button" onClick={() => setConfirming(null)}
                  className="ml-auto text-zinc-600 hover:text-zinc-400 lowercase">esc</button>
              </div>
            );
          })()}
```

- [ ] **Step 6: Extend the altar test file**

Append inside the existing `describe` block of `quintessenceAltar.test.jsx` (fake timers are needed here — wrap with `vi.useFakeTimers()`/`vi.useRealTimers()` inside the test):

```jsx
  it('armed: holding a seal for 1200ms starts the ignition (spine element written)', async () => {
    vi.useFakeTimers();
    completeSpine();
    const seal = sealFor('FIRE');
    act(() => { seal.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    act(() => { vi.advanceTimersByTime(1200); });
    // ignite() ran: the compile staging begins (grid unmounts into the stage list)
    expect(container.textContent).toContain('SPINE READ');
    vi.useRealTimers();
  });

  it('armed: releasing early cancels — grid intact, nothing ignites, click still walks', () => {
    vi.useFakeTimers();
    completeSpine();
    const seal = sealFor('AIR');
    act(() => { seal.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    act(() => { vi.advanceTimersByTime(600); });
    act(() => { seal.dispatchEvent(new Event('pointerup', { bubbles: true })); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(container.textContent).not.toContain('SPINE READ');
    act(() => { seal.click(); });
    expect(onNavigate).toHaveBeenCalledWith('transmission');
    vi.useRealTimers();
  });

  it('keyboard: Enter opens the confirm; "walk the house" navigates', () => {
    completeSpine();
    const seal = sealFor('WATER');
    act(() => { seal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    const walk = [...container.querySelectorAll('button')].find(b => b.textContent.includes('walk the house'));
    expect(walk).toBeTruthy();
    act(() => { walk.click(); });
    expect(onNavigate).toHaveBeenCalledWith('ledger');
  });
```
Note on React synthetic events: `onPointerDown` handlers receive native `pointerdown` via delegation — jsdom lacks `PointerEvent`, so plain `Event('pointerdown')` is used and works with React 18 delegation. If the ignite-path test proves flaky because `ignite`'s first await parks on a 650ms timeout, `vi.advanceTimersByTime(1200)` alone is enough for `SPINE READ` (stage 0 renders synchronously before the first await resolves — `setStage(0)` happens before the timeout).

- [ ] **Step 7: Run tests, full suite, commit**

Run: `npx vitest run src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx` — expected: PASS (7 tests).
Run: `npm test` — expected: all pass.

```bash
git add src/terminal/mercury/useHoldToSeal.js src/terminal/mercury/__tests__/useHoldToSeal.test.jsx src/terminal/mercury/QuintessenceAltar.jsx src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx
git commit -m "feat(altar): the armed ritual — hold-to-seal, keyboard confirm, doors stay open

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Perf gating, a11y, and end-to-end verification

**Files:**
- Create: `src/terminal/mercury/useInViewport.js`
- Modify: `src/terminal/mercury/ElementSeal.jsx` (viewport gating)

**Interfaces:**
- Consumes: `IntersectionObserver` (guard for its absence — jsdom).
- Produces: `useInViewport() → [ref, inView: boolean]` (inView defaults `true` where IO is unavailable, so tests and old browsers degrade to "always animate").

- [ ] **Step 1: The viewport hook**

```js
// src/terminal/mercury/useInViewport.js — GPU courtesy (spec §7): wet seals
// animate only while visible. No IntersectionObserver (jsdom, ancient UA) →
// treat as visible; the eye's watchdog already self-throttles when hidden.
import { useEffect, useRef, useState } from 'react';

export function useInViewport() {
  const ref = useRef(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}
```

- [ ] **Step 2: Gate the wet seal**

In `ElementSeal.jsx`, import the hook and gate the WebGL branch:
```jsx
import { useInViewport } from './useInViewport';
```
Inside the component, before the `if (!wet)` return: `const [ref, inView] = useInViewport();`
The dry branch is unchanged. The wet branch becomes:
```jsx
  return (
    <div ref={ref} className="mx-auto" style={{ width: size, height: size }}>
      {inView ? (
        <ObserverEye lens={false} state="leaning" tint={tint} pulse={armed}
          constrict={armed ? Math.max(0.58, 0.58 + 0.42 * holdProgress) : null} size={size} />
      ) : (
        <div aria-hidden="true" className="rounded-full" style={{
          width: size, height: size,
          background: `radial-gradient(circle at 42% 36%, rgba(${tint[0]},${tint[1]},${tint[2]},0.5) 0%, rgba(${tint[0]},${tint[1]},${tint[2]},0.15) 55%, transparent 80%)`,
        }} />
      )}
    </div>
  );
```
(Out-of-view wet seal = a static tinted glow: still reads wet, costs nothing.)

- [ ] **Step 3: Full suite**

Run: `npm test` — expected: all pass (jsdom takes the `inView: true` default; no test churn).

- [ ] **Step 4: End-to-end browser verification (pane toolkit)**

Dev server up, viewport ≥1024px, clean state (`localStorage.clear()` + reload):
1. **Ambient:** wait ≥15s → eye leans a house hue; matching tab breathes; readback pixel hue matches `NAV_TINTS`.
2. **Mirror:** click three different tabs → three distinct flash hues (readback), each decaying ≤2s.
3. **Seals:** navigate to Mercury → all four seals dry (CSS discs). Visit Chaos, return → FIRE seal wet, animating (drawArrays counter shows a second 64-ish px canvas drawing). Click WATER seal → lands on Ledger tab.
4. **Armed:** drive spine via `__quintessenceSpine` (trend+council+phase — valid phase from `lunarAccords`) → prompt appears verbatim; wet seals constrict + pulse; masthead eye armed-gold pulsing on the same beat (screenshot pair 1.2s apart: both at opposite phase together).
5. **Ritual:** press-and-hold FIRE 1.2s → stages run → seal completes → eye goes `complete` teal. Then clear (`localStorage.clear()`, reload) and confirm quick-click never ignites.
6. **Doors:** while armed, click every nav tab — all navigate normally.
7. Reduced-motion emulation → no tab pulse, seals static, eye static.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/useInViewport.js src/terminal/mercury/ElementSeal.jsx
git commit -m "feat(altar): viewport-gate the wet seals + reduced-motion sweep

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-review notes (completed)

- **Spec coverage:** §2 chain → Task 2; §3 picker → Task 1; §2/§3 wiring → Task 3; §4 pulse → Task 4; §5 seals → Task 5; §6 ritual → Task 6; §7 perf/a11y → Task 7 (+ reduced-motion touches in Tasks 4–6); §8 error handling → Task 1 (ping try/catch, eligibility try/catch), Task 5 (readVisited try/catch), Task 6 (pointercancel), Task 7 (IO absence); §9 tests → every task carries its own.
- **Type consistency:** `{ suggestion, flash }` shape identical across guidanceStore/resolveEyeState/MercuryEyeIndicator; `pulse`/`constrict`/`lens` prop names consistent across ObserverEye/ElementSeal/altar; `onNavigate(tab)` consistent altar→MercuryTab (`onNavigateTab`)→App.
- **Known judgment calls:** App-side pulse passes `sealed: false` (safe — sealing requires a complete spine, which already nulls `pulseTab`); `handleNav`-only flash (content-nav flows don't flash); dry seals are CSS, not frozen shaders (cheaper, same meaning).
