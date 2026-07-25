# Mercury Retrograde — Reading Witness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reward a visitor who genuinely reads all five pinned lore kernels with an unbidden, one-time retrograde-Sun event — the existing compile-frontier terminator halts, walks backward (the double-sunrise), and eases back to its true position.

**Architecture:** A silent App-level hook (`useReadingWitness`) accumulates focus-gated reading time per kernel article, keyed by `selectedArticle.id`, watching the shared scroll container `mainRef`. When all five pinned article IDs cross their per-kernel reading thresholds, it calls `onWitnessed` once; App flips a `retrograde` token that threads through `KernelTab` into `MercuryTerminator`, which runs a one-shot pure `retrogradeCurve` over its terminator uniforms and then re-attaches to the live `twilight`/`day` gauge. No new geometry, no bus changes, no writes to compile state.

**Tech Stack:** React (hooks), Vite, Vitest + @testing-library/react, WebGL fragment shader (existing `MercuryTerminator`).

## Global Constraints

- Reading speed baseline: **WPM = 200** (intensive technical prose). Threshold leniency: **0.55** of expected time. Both live in `readingThresholds.js` as defaults; do not hardcode elsewhere.
- Per-kernel thresholds are **proportional to each kernel's own live word count** (measured from the reading pane's text), never a flat corpus time.
- Active time accrues **only** while `document.visibilityState === 'visible'` **and** `document.hasFocus()`. Leaving pauses accrual; it never resets.
- **No permanent cross-tab lockout.** Reading may be interrupted and resumed within the session.
- The event fires **once per session** (in-memory `firedRef` guard); telemetry is in-memory only (no persistence).
- **Decoupled** from the quintessence compile and from vitrification. This feature never writes `useCompileFrontier` state.
- The terminator **returns to truth** after the event (eases back to live `twilight`/`day`).
- `prefers-reduced-motion` → the retrograde is a **no-op** (the reader still earned it; we honor the setting).
- Any debug logging is **`import.meta.env.DEV`-gated only**.
- Test command: `npx vitest run <path>` for a file; full suite `npm test`.

---

### Task 1: Reading thresholds (pure)

**Files:**
- Create: `src/terminal/mercury/readingThresholds.js`
- Test: `src/terminal/mercury/__tests__/readingThresholds.test.js`

**Interfaces:**
- Produces: `countWords(text: string) -> number`; `requiredSeconds(words: number, opts?: { wpm?: number, leniency?: number }) -> number` (defaults `wpm=200`, `leniency=0.55`).

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/__tests__/readingThresholds.test.js
import { describe, it, expect } from 'vitest';
import { countWords, requiredSeconds } from '../readingThresholds';

describe('countWords', () => {
  it('counts whitespace-separated tokens', () => {
    expect(countWords('the quick brown fox')).toBe(4);
  });
  it('collapses irregular whitespace and newlines', () => {
    expect(countWords('  a\n\n b   c\t d ')).toBe(4);
  });
  it('returns 0 for empty / nullish', () => {
    expect(countWords('')).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords(undefined)).toBe(0);
  });
});

describe('requiredSeconds', () => {
  it('is words / wpm * 60 * leniency', () => {
    // 200 words at 200 wpm = 1 min = 60s; * 0.55 leniency = 33s
    expect(requiredSeconds(200)).toBeCloseTo(33, 5);
  });
  it('honors overrides', () => {
    expect(requiredSeconds(100, { wpm: 100, leniency: 1 })).toBeCloseTo(60, 5);
  });
  it('returns 0 for non-positive words', () => {
    expect(requiredSeconds(0)).toBe(0);
    expect(requiredSeconds(-5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/readingThresholds.test.js`
Expected: FAIL — `Failed to resolve import '../readingThresholds'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/terminal/mercury/readingThresholds.js
// Pure reading-time math for the retrograde reading witness.
export function countWords(text) {
  if (!text) return 0;
  const m = String(text).trim().match(/\S+/g);
  return m ? m.length : 0;
}

// Expected active reading seconds for a body of `words`, discounted by leniency
// so we reward genuine reading without punishing fast technical readers.
export function requiredSeconds(words, { wpm = 200, leniency = 0.55 } = {}) {
  if (!words || words <= 0) return 0;
  return (words / wpm) * 60 * leniency;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/__tests__/readingThresholds.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/readingThresholds.js src/terminal/mercury/__tests__/readingThresholds.test.js
git commit -m "feat(mercury): reading-threshold math (pure)"
```

---

### Task 2: Absorption predicates (pure)

**Files:**
- Create: `src/terminal/mercury/readingWitness.js`
- Test: `src/terminal/mercury/__tests__/readingWitness.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `isAbsorbed({ activeSeconds, requiredSeconds, reachedBottom, scrollEvents }) -> boolean`; `allWitnessed(completedIds: Set<string>, requiredIds: string[]) -> boolean`.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/__tests__/readingWitness.test.js
import { describe, it, expect } from 'vitest';
import { isAbsorbed, allWitnessed } from '../readingWitness';

const base = { activeSeconds: 40, requiredSeconds: 30, reachedBottom: true, scrollEvents: 5 };

describe('isAbsorbed', () => {
  it('true when time, bottom, and genuine scrolling all satisfied', () => {
    expect(isAbsorbed(base)).toBe(true);
  });
  it('false when under the time threshold', () => {
    expect(isAbsorbed({ ...base, activeSeconds: 10 })).toBe(false);
  });
  it('false when the bottom was never reached', () => {
    expect(isAbsorbed({ ...base, reachedBottom: false })).toBe(false);
  });
  it('false on a single instantaneous jump (too few scroll events)', () => {
    expect(isAbsorbed({ ...base, scrollEvents: 1 })).toBe(false);
  });
});

describe('allWitnessed', () => {
  it('true only when every required id is complete', () => {
    const req = ['a', 'b', 'c'];
    expect(allWitnessed(new Set(['a', 'b']), req)).toBe(false);
    expect(allWitnessed(new Set(['a', 'b', 'c']), req)).toBe(true);
    expect(allWitnessed(new Set(['a', 'b', 'c', 'x']), req)).toBe(true);
  });
  it('false for an empty required set (never fires with no kernels)', () => {
    expect(allWitnessed(new Set(['a']), [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/readingWitness.test.js`
Expected: FAIL — `Failed to resolve import '../readingWitness'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/terminal/mercury/readingWitness.js
// Pure predicates deciding whether a single kernel was truly read, and whether
// the whole pinned corpus has been witnessed.
const MIN_SCROLL_EVENTS = 3; // guards against one instantaneous jump-to-bottom

export function isAbsorbed({ activeSeconds, requiredSeconds, reachedBottom, scrollEvents }) {
  return (
    activeSeconds >= requiredSeconds &&
    reachedBottom === true &&
    scrollEvents >= MIN_SCROLL_EVENTS
  );
}

export function allWitnessed(completedIds, requiredIds) {
  if (!requiredIds || requiredIds.length === 0) return false;
  return requiredIds.every((id) => completedIds.has(id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/__tests__/readingWitness.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/readingWitness.js src/terminal/mercury/__tests__/readingWitness.test.js
git commit -m "feat(mercury): absorption predicates (pure)"
```

---

### Task 3: Pinned-kernel article IDs (pure helper)

**Files:**
- Create: `src/terminal/mercury/pinnedKernels.js`
- Test: `src/terminal/mercury/__tests__/pinnedKernels.test.js`

**Interfaces:**
- Produces: `FISH_SCALE_ARTICLE_ID: string`; `pinnedKernelArticleIds(kernelBuilds: Array<{ lore?: boolean, articleId?: string }>) -> string[]`.

**Context:** Mirrors the pinned rule in `src/terminal/views/KernelTab.jsx:109` — the fish-scale genome plus every lore kernel. The fish-scale fallback in KernelTab uses `articleId: 'FISH-SCALE-KERNEL11.1.1'` (KernelTab.jsx:107); keep this constant in sync.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/__tests__/pinnedKernels.test.js
import { describe, it, expect } from 'vitest';
import { pinnedKernelArticleIds, FISH_SCALE_ARTICLE_ID } from '../pinnedKernels';

describe('pinnedKernelArticleIds', () => {
  it('always includes the fish-scale genome', () => {
    expect(pinnedKernelArticleIds([])).toEqual([FISH_SCALE_ARTICLE_ID]);
  });
  it('adds every lore kernel with an articleId', () => {
    const builds = [
      { lore: true, articleId: 'HUDELSCHUBLADE-ROUTING-KERNEL-1.0.0' },
      { lore: true, articleId: 'BLACK-HOLE-TAXONOMY-KERNEL-1.0.0' },
      { lore: false, articleId: 'SOME-NON-LORE-KERNEL' },
      { lore: true },                       // no articleId → skipped
    ];
    const ids = pinnedKernelArticleIds(builds);
    expect(ids).toContain(FISH_SCALE_ARTICLE_ID);
    expect(ids).toContain('HUDELSCHUBLADE-ROUTING-KERNEL-1.0.0');
    expect(ids).toContain('BLACK-HOLE-TAXONOMY-KERNEL-1.0.0');
    expect(ids).not.toContain('SOME-NON-LORE-KERNEL');
    expect(ids.length).toBe(3);
  });
  it('dedupes if a lore build repeats the fish-scale id', () => {
    const ids = pinnedKernelArticleIds([{ lore: true, articleId: FISH_SCALE_ARTICLE_ID }]);
    expect(ids).toEqual([FISH_SCALE_ARTICLE_ID]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/pinnedKernels.test.js`
Expected: FAIL — `Failed to resolve import '../pinnedKernels'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/terminal/mercury/pinnedKernels.js
// The five exhibition kernels the reading witness watches. Mirrors the pinned
// rule in KernelTab (fish-scale genome + every lore kernel), reduced to the set
// of their article IDs (which equal `selectedArticle.id` at read time).
export const FISH_SCALE_ARTICLE_ID = 'FISH-SCALE-KERNEL11.1.1';

export function pinnedKernelArticleIds(kernelBuilds = []) {
  const ids = new Set([FISH_SCALE_ARTICLE_ID]);
  for (const k of kernelBuilds) {
    if (k && k.lore && k.articleId) ids.add(k.articleId);
  }
  return [...ids];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/__tests__/pinnedKernels.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/pinnedKernels.js src/terminal/mercury/__tests__/pinnedKernels.test.js
git commit -m "feat(mercury): pinned-kernel article id helper"
```

---

### Task 4: The retrograde curve (pure)

**Files:**
- Create: `src/terminal/components/retrogradeCurve.js`
- Test: `src/terminal/components/__tests__/retrogradeCurve.test.js`

**Interfaces:**
- Produces: `retrogradeCurve(t01: number) -> { delta: number, tint: number }`. `delta` is the terminator's signed offset from its resting position; `tint` is the violet "impossible" cue intensity (0→1→0). `RETROGRADE_MS: number` (event duration).

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/components/__tests__/retrogradeCurve.test.js
import { describe, it, expect } from 'vitest';
import { retrogradeCurve, RETROGRADE_MS } from '../retrogradeCurve';

describe('retrogradeCurve', () => {
  it('pins both ends to the true terminator (delta 0)', () => {
    expect(retrogradeCurve(0).delta).toBeCloseTo(0, 6);
    expect(retrogradeCurve(1).delta).toBeCloseTo(0, 6);
  });
  it('clamps t outside [0,1] to the endpoints', () => {
    expect(retrogradeCurve(-1).delta).toBeCloseTo(0, 6);
    expect(retrogradeCurve(2).delta).toBeCloseTo(0, 6);
  });

  // Sample the whole event to assert the double-sunrise signature.
  const samples = Array.from({ length: 201 }, (_, i) => retrogradeCurve(i / 200).delta);
  const min = Math.min(...samples);
  const max = Math.max(...samples);

  it('recedes hard (the sun walks back)', () => {
    expect(min).toBeLessThan(-0.3);
  });
  it('also rises (the second sunrise) — a real up-swing exists', () => {
    expect(max).toBeGreaterThan(0.2);
  });
  it('stays bounded', () => {
    expect(min).toBeGreaterThan(-1);
    expect(max).toBeLessThan(1);
  });
  it('tint peaks mid-event and vanishes at the ends', () => {
    expect(retrogradeCurve(0).tint).toBeCloseTo(0, 6);
    expect(retrogradeCurve(1).tint).toBeCloseTo(0, 6);
    expect(retrogradeCurve(0.5).tint).toBeGreaterThan(0.9);
  });
  it('exposes a multi-second duration', () => {
    expect(RETROGRADE_MS).toBeGreaterThanOrEqual(4000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/components/__tests__/retrogradeCurve.test.js`
Expected: FAIL — `Failed to resolve import '../retrogradeCurve'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/terminal/components/retrogradeCurve.js
// The double-sunrise excursion of Mercury's terminator during the retrograde
// event. Pure: t01 in [0,1] over the event → the terminator's signed offset
// from its true resting position, plus a violet "impossible" cue that peaks
// mid-event. A sine envelope pins both ends to zero so the event begins and
// ends exactly on the true terminator (position stays meaning).
export const RETROGRADE_MS = 5200;

export function retrogradeCurve(t01) {
  const t = Math.max(0, Math.min(1, t01));
  const env = Math.sin(Math.PI * t); // 0 → 1 → 0, pins the endpoints
  const walk =
    0.15 * Math.sin(Math.PI * t) -        // a brief forward nudge (dawn continues)
    0.62 * Math.sin(2 * Math.PI * t) -    // the primary reversal swing (recede/advance)
    0.10 * Math.sin(4 * Math.PI * t);     // the double-sunrise ripple
  return { delta: env * walk, tint: env };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/components/__tests__/retrogradeCurve.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/components/retrogradeCurve.js src/terminal/components/__tests__/retrogradeCurve.test.js
git commit -m "feat(mercury): retrograde double-sunrise curve (pure)"
```

---

### Task 5: The reading-witness hook

**Files:**
- Create: `src/terminal/mercury/useReadingWitness.js`
- Test: `src/terminal/mercury/__tests__/useReadingWitness.test.jsx`

**Interfaces:**
- Consumes: `countWords`, `requiredSeconds` (Task 1); `isAbsorbed`, `allWitnessed` (Task 2).
- Produces: `useReadingWitness({ mainRef, selectedArticle, activeTab, requiredArticleIds, onWitnessed }) -> void`.
  - `mainRef`: React ref to the scrollable main element (the reading pane container).
  - `selectedArticle`: `{ id: string } | null`.
  - `activeTab`: string (must be `'kernel'` for a kernel read to count).
  - `requiredArticleIds`: `string[]` from `pinnedKernelArticleIds`.
  - `onWitnessed`: called exactly once when the last required id is absorbed.

**Behavior notes for the implementer:**
- Accrual runs on a 1000ms `setInterval`; each tick adds 1s to the *current* pinned article's `activeSeconds` **only if** `document.visibilityState === 'visible'` and `document.hasFocus()`.
- The "current pinned article" is `selectedArticle.id` when `activeTab === 'kernel'`, `selectedArticle` is set, and its id is in `requiredArticleIds`; otherwise none.
- When a pinned article becomes current, measure its word count once from `mainRef.current.innerText` → store `requiredSeconds`. If the content fits without scrolling (`scrollHeight <= clientHeight + BOTTOM_SLOP`), mark `reachedBottom = true` and seed `scrollEvents` to the minimum so short articles pass on time alone (no false negative when there's nothing to scroll).
- A `scroll` listener on `mainRef.current` (while a pinned article is current) increments `scrollEvents` and sets `reachedBottom` once `scrollTop + clientHeight >= scrollHeight - BOTTOM_SLOP`.
- After any accrual or scroll update, re-check `isAbsorbed`; on pass, add the id to a `completedRef` Set. When `!firedRef.current && allWitnessed(completedRef.current, requiredArticleIds)`, set `firedRef.current = true` and call `onWitnessed()`.
- DEV-only: `console.debug('[witness]', id, state)` after updates to aid verification.

- [ ] **Step 1: Write the failing test**

```jsx
// src/terminal/mercury/__tests__/useReadingWitness.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useReadingWitness from '../useReadingWitness';

// A fake scroll container whose innerText and scroll geometry we control.
function makeEl({ words = 40, scrollable = true } = {}) {
  const listeners = {};
  const el = {
    innerText: Array.from({ length: words }, (_, i) => `w${i}`).join(' '),
    clientHeight: 500,
    scrollHeight: scrollable ? 2000 : 400, // scrollable => overflows
    scrollTop: 0,
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter((f) => f !== fn); },
    _fire: (t) => (listeners[t] || []).forEach((fn) => fn()),
  };
  return el;
}

function setFocus(visible, focused) {
  Object.defineProperty(document, 'visibilityState', { value: visible ? 'visible' : 'hidden', configurable: true });
  vi.spyOn(document, 'hasFocus').mockReturnValue(focused);
}

beforeEach(() => { vi.useFakeTimers(); setFocus(true, true); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// Read one kernel to completion: scroll to bottom + accrue enough active seconds.
function readToBottom(el, seconds) {
  el.scrollTop = el.scrollHeight - el.clientHeight; // at bottom
  act(() => { for (let i = 0; i < 5; i++) el._fire('scroll'); });       // genuine scrolling
  act(() => { vi.advanceTimersByTime(seconds * 1000); });               // active dwell
}

describe('useReadingWitness', () => {
  const required = ['K1', 'K2'];

  it('fires once after all required kernels are read', () => {
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 40 }); // requiredSeconds(40) = (40/200)*60*0.55 = 6.6s
    const mainRef = { current: el };
    let article = { id: 'K1' };
    const { rerender } = renderHook(
      ({ a }) => useReadingWitness({ mainRef, selectedArticle: a, activeTab: 'kernel', requiredArticleIds: required, onWitnessed }),
      { initialProps: { a: article } }
    );

    readToBottom(el, 8);
    expect(onWitnessed).not.toHaveBeenCalled(); // K2 still unread

    article = { id: 'K2' };
    rerender({ a: article });
    readToBottom(el, 8);

    expect(onWitnessed).toHaveBeenCalledTimes(1);

    // Keep reading — must not fire again.
    readToBottom(el, 8);
    expect(onWitnessed).toHaveBeenCalledTimes(1);
  });

  it('does not accrue while the tab is hidden/blurred', () => {
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 40 });
    const mainRef = { current: el };
    renderHook(() => useReadingWitness({ mainRef, selectedArticle: { id: 'K1' }, activeTab: 'kernel', requiredArticleIds: ['K1'], onWitnessed }));

    el.scrollTop = el.scrollHeight - el.clientHeight;
    act(() => { for (let i = 0; i < 5; i++) el._fire('scroll'); });
    setFocus(false, false);                          // away
    act(() => { vi.advanceTimersByTime(60_000); });  // a full minute away
    expect(onWitnessed).not.toHaveBeenCalled();

    setFocus(true, true);                            // back
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(onWitnessed).toHaveBeenCalledTimes(1);
  });

  it('ignores reads while another tab is active', () => {
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 40 });
    const mainRef = { current: el };
    renderHook(() => useReadingWitness({ mainRef, selectedArticle: { id: 'K1' }, activeTab: 'lunar', requiredArticleIds: ['K1'], onWitnessed }));
    readToBottom(el, 20);
    expect(onWitnessed).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/useReadingWitness.test.jsx`
Expected: FAIL — `Failed to resolve import '../useReadingWitness'`.

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/terminal/mercury/useReadingWitness.js
// Silent, App-level reading witness. Accrues focus-gated active reading time per
// pinned kernel article (keyed by selectedArticle.id) and fires onWitnessed once
// when every required kernel has been genuinely read. No UI, no persistence.
import { useEffect, useRef } from 'react';
import { countWords, requiredSeconds } from './readingThresholds';
import { isAbsorbed, allWitnessed } from './readingWitness';

const BOTTOM_SLOP = 24;   // px tolerance for "reached bottom"
const MIN_SCROLL_EVENTS = 3;
const DEV = !!import.meta.env?.DEV;

export default function useReadingWitness({ mainRef, selectedArticle, activeTab, requiredArticleIds, onWitnessed }) {
  const statsRef = useRef(new Map());   // id -> { activeSeconds, requiredSeconds, reachedBottom, scrollEvents, measured }
  const completedRef = useRef(new Set());
  const firedRef = useRef(false);
  const cbRef = useRef(onWitnessed);
  cbRef.current = onWitnessed;

  const currentId =
    activeTab === 'kernel' && selectedArticle && requiredArticleIds.includes(selectedArticle.id)
      ? selectedArticle.id
      : null;

  // Per-article measurement + scroll wiring, re-run when the shown kernel changes.
  useEffect(() => {
    if (!currentId) return;
    const el = mainRef.current;
    const stats = statsRef.current.get(currentId) || { activeSeconds: 0, requiredSeconds: Infinity, reachedBottom: false, scrollEvents: 0, measured: false };
    statsRef.current.set(currentId, stats);

    const measure = () => {
      if (!el || stats.measured) return;
      const words = countWords(el.innerText);
      if (words <= 0) return;               // content not rendered yet; try again on scroll/tick
      stats.requiredSeconds = requiredSeconds(words);
      // Short article that fits without scrolling: nothing to scroll, so credit
      // the bottom and waive the scroll-event floor (time alone decides).
      if (el.scrollHeight <= el.clientHeight + BOTTOM_SLOP) {
        stats.reachedBottom = true;
        stats.scrollEvents = Math.max(stats.scrollEvents, MIN_SCROLL_EVENTS);
      }
      stats.measured = true;
    };
    measure();

    const check = () => {
      if (!stats.measured) measure();
      if (isAbsorbed(stats)) completedRef.current.add(currentId);
      if (!firedRef.current && allWitnessed(completedRef.current, requiredArticleIds)) {
        firedRef.current = true;
        cbRef.current?.();
      }
      if (DEV) console.debug('[witness]', currentId, { ...stats, done: [...completedRef.current] });
    };

    const onScroll = () => {
      if (!el) return;
      stats.scrollEvents += 1;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_SLOP) stats.reachedBottom = true;
      check();
    };

    el?.addEventListener('scroll', onScroll, { passive: true });
    return () => el?.removeEventListener('scroll', onScroll);
  }, [currentId, mainRef, requiredArticleIds]);

  // Focus-gated active-time accrual (1s cadence).
  useEffect(() => {
    if (!currentId) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const stats = statsRef.current.get(currentId);
      if (!stats) return;
      if (!stats.measured) {
        const el = mainRef.current;
        const words = countWords(el?.innerText);
        if (words > 0) {
          stats.requiredSeconds = requiredSeconds(words);
          if (el && el.scrollHeight <= el.clientHeight + BOTTOM_SLOP) {
            stats.reachedBottom = true;
            stats.scrollEvents = Math.max(stats.scrollEvents, MIN_SCROLL_EVENTS);
          }
          stats.measured = true;
        }
      }
      stats.activeSeconds += 1;
      if (isAbsorbed(stats)) completedRef.current.add(currentId);
      if (!firedRef.current && allWitnessed(completedRef.current, requiredArticleIds)) {
        firedRef.current = true;
        cbRef.current?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [currentId, mainRef, requiredArticleIds]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/__tests__/useReadingWitness.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/useReadingWitness.js src/terminal/mercury/__tests__/useReadingWitness.test.jsx
git commit -m "feat(mercury): silent reading-witness hook"
```

---

### Task 6: MercuryTerminator retrograde branch

**Files:**
- Modify: `src/terminal/components/MercuryTerminator.jsx`
- Test: `src/terminal/components/__tests__/MercuryTerminator.test.jsx`

**Interfaces:**
- Consumes: `retrogradeCurve`, `RETROGRADE_MS` (Task 4).
- Produces: `MercuryTerminator` gains prop `retrograde: { ts: number } | null`. A new `ts` arms a one-shot retrograde animation; while active the effective `tw`/`day` follow `base + delta` (clamped [0,1]) and a `u_retro` uniform carries the violet tint; when it ends the terminator resumes easing to the true `tw`/`day`. `prefers-reduced-motion` → no-op.

- [ ] **Step 1: Write the failing test** (append to the existing describe block)

```jsx
  it('accepts a retrograde token without throwing (jsdom, no WebGL)', () => {
    const { container, rerender } = render(
      <MercuryTerminator twilight={0.3} day={0.1} flare={null} retrograde={null} size={180} />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
    // Arming the event on a re-render must not throw when GL is unavailable.
    rerender(<MercuryTerminator twilight={0.3} day={0.1} flare={null} retrograde={{ ts: 123 }} size={180} />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/components/__tests__/MercuryTerminator.test.jsx`
Expected: The new test currently PASSES trivially (prop ignored) — so first prove the wiring is real by asserting the prop is consumed. Instead, verify failure by adding the import assertion below to Step 1 before implementing:

Add to the top of the new test:
```jsx
import { RETROGRADE_MS } from '../retrogradeCurve';
expect(RETROGRADE_MS).toBeGreaterThan(0); // guards the dependency exists
```
Run again; if `retrogradeCurve` wiring is missing in the component the render-with-token path is still exercised. (This component is smoke-tested; the behavioral guarantees live in Task 4's pure tests.)

- [ ] **Step 3: Write the implementation**

In `MercuryTerminator.jsx`:

1. Add the import near the top:
```jsx
import { retrogradeCurve, RETROGRADE_MS } from './retrogradeCurve';
```

2. Add `retrograde = null` to the destructured props:
```jsx
export default function MercuryTerminator({ twilight = 0, day = 0, flare = null, retrograde = null, size = 180, onClick, title, className = '', ariaLabel }) {
```

3. Add a ref beside the others and keep it fresh from the prop:
```jsx
  const retroRef = useRef(retrograde);
```
and in the existing sync effect that already tracks `twilight, day, flare`, extend it:
```jsx
  useEffect(() => {
    twRef.current = twilight; dayRef.current = day; flareRef.current = flare;
    retroRef.current = retrograde;
    snapRef.current?.();
  }, [twilight, day, flare, retrograde]);
```

4. Add the `u_retro` uniform name to the uniform list:
```jsx
    ['u_t','u_tw','u_day','u_bloom','u_flareCol','u_retro'].forEach(k => { U[k] = gl.getUniformLocation(prog, k); });
```

5. In the `cur` object add retrograde run-state, then drive it inside `frame`:
```jsx
    const cur = { tw: twRef.current, day: dayRef.current, bloom: 0, col: CYAN.slice(), lastFlareTs: 0, retroTs: 0, retroStart: 0, retroTint: 0 };
```
Inside `frame(now)`, after the flare handling and before `render(now/1000)`, add:
```jsx
      // Retrograde event: a new token arms a one-shot double-sunrise. While it
      // runs, the terminator follows base + curve delta; then it re-attaches to
      // the true tw/day (which `cur` is already easing toward every other frame).
      const r = retroRef.current;
      if (r && r.ts !== cur.retroTs && !reduce) { cur.retroTs = r.ts; cur.retroStart = now; }
      if (cur.retroStart) {
        const p = (now - cur.retroStart) / RETROGRADE_MS;
        if (p >= 1) { cur.retroStart = 0; cur.retroTint = 0; }
        else {
          const { delta, tint } = retrogradeCurve(p);
          cur.tw  = Math.max(0, Math.min(1, twRef.current + delta));
          cur.day = Math.max(0, Math.min(1, dayRef.current + delta));
          cur.retroTint = tint;
        }
      }
```
Note: place this block so it overrides the earlier `cur.tw`/`cur.day` easing lines for the duration of the event. Then in `render`, upload the uniform:
```jsx
      gl.uniform1f(U.u_retro, cur.retroTint);
```

6. In the fragment shader source (`FS`), declare the uniform and blend the violet cue. Change the uniform line:
```
'uniform float u_t,u_tw,u_day,u_bloom,u_retro;uniform vec3 u_flareCol;',
```
and just before `float rim=...`, add the impossible-tint mix:
```
' vec3 retroCol=vec3(0.62,0.40,0.95);',            // cool violet-white "impossible" cue
' col=mix(col,retroCol,u_retro*0.45*(0.4+twMask));',
' col+=u_retro*0.10*vec3(0.9,0.85,1.0);',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/components/__tests__/MercuryTerminator.test.jsx src/terminal/components/__tests__/retrogradeCurve.test.js`
Expected: PASS (existing 2 + new smoke test; curve tests green).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/components/MercuryTerminator.jsx src/terminal/components/__tests__/MercuryTerminator.test.jsx
git commit -m "feat(mercury): retrograde one-shot branch in the terminator shader"
```

---

### Task 7: Wire the witness into App and thread the token to the terminator

**Files:**
- Modify: `src/terminal/App.jsx`
- Modify: `src/terminal/views/KernelTab.jsx`

**Interfaces:**
- Consumes: `useReadingWitness` (Task 5), `pinnedKernelArticleIds` (Task 3), and the `retrograde` prop on `MercuryTerminator` (Task 6).
- Produces: App owns `retrograde` state; `KernelTab` gains a `retrograde` prop forwarded to both `MercuryTerminator` instances.

**Context — the pieces already exist in App:** `mainRef` (the scroll container, used at App.jsx:466), `selectedArticle` state (App.jsx:103), `activeTab`, and `kernelBuilds`. `KernelTab` renders `MercuryTerminator` twice (mobile at KernelTab.jsx:458, desktop at KernelTab.jsx:474) using `twilight`/`day`/`flare` from its own `useCompileFrontier`.

- [ ] **Step 1: App — imports, state, hook wiring**

Add imports near the other `mercury` imports in `App.jsx`:
```jsx
import useReadingWitness from './mercury/useReadingWitness';
import { pinnedKernelArticleIds } from './mercury/pinnedKernels';
```
Add state beside `selectedArticle` (App.jsx:103 area):
```jsx
  const [retrograde, setRetrograde] = useState(null);
```
Near the other `useMemo`s / derived values, add the required-id set and the witness (place after `kernelBuilds` and `mainRef` are defined):
```jsx
  const requiredArticleIds = useMemo(() => pinnedKernelArticleIds(kernelBuilds), [kernelBuilds]);
  const onWitnessed = useCallback(() => setRetrograde({ ts: Date.now() }), []);
  useReadingWitness({ mainRef, selectedArticle, activeTab, requiredArticleIds, onWitnessed });
```
(If `useMemo`/`useCallback` are not already imported from `react` in App.jsx, add them to the import.)

- [ ] **Step 2: App — pass the token to KernelTab**

Find where `<KernelTab ... />` is rendered (around App.jsx:1197) and add the prop:
```jsx
              retrograde={retrograde}
```

- [ ] **Step 3: KernelTab — accept and forward the prop**

In `KernelTab.jsx`, add `retrograde` to the destructured props (the `const KernelTab = ({ ... }) =>` signature at KernelTab.jsx:58), then add `retrograde={retrograde}` to **both** `MercuryTerminator` usages (mobile ~KernelTab.jsx:458 and desktop ~KernelTab.jsx:474):
```jsx
            <MercuryTerminator
              twilight={twilight}
              day={day}
              flare={flare}
              retrograde={retrograde}
              size={120}
              ...
```
(and the same `retrograde={retrograde}` line added to the desktop `size={180}` instance).

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus Tasks 1–6. No test asserts App internals here; correctness of the wiring is verified in the browser next.

- [ ] **Step 5: Browser verification (dev threshold override)**

The real threshold is ~8–9 minutes; to verify quickly, temporarily shorten it:

1. In `readingThresholds.js`, temporarily change the default `leniency = 0.55` to `leniency = 0.01` (makes each kernel absorb in ~1–2s). **Revert before committing.**
2. Start the dev server (via the preview tool / `.claude/launch.json`), open the Kernel tab.
3. Open each of the five pinned kernels in turn; scroll each to the bottom and pause ~2s. Watch the DEV console for `[witness] … done: [...]` growing to all five ids.
4. On the fifth, confirm the Mercury terminator **halts its forward march, recedes (walks backward) with a brief second-sunrise, tints violet, then eases back** to its true position. Capture a screenshot mid-recede.
5. Confirm it fires only once (keep reading; it must not replay).
6. **Revert** the `readingThresholds.js` leniency back to `0.55`. Re-run `npx vitest run src/terminal/mercury/__tests__/readingThresholds.test.js` (must be green again).

- [ ] **Step 6: Commit**

```bash
git add src/terminal/App.jsx src/terminal/views/KernelTab.jsx
git commit -m "feat(mercury): wire reading witness → retrograde terminator"
```

---

## Self-Review

**Spec coverage:**
- Retrograde event rendered as terminator recede → Tasks 4, 6. ✔
- Unbidden trigger, decoupled from quintessence/vitrification → Task 5 (`onWitnessed`) + Task 7 (`setRetrograde`); nothing touches `useCompileFrontier`. ✔
- Per-article reading surface, survives navigation → Task 5 (App-level refs keyed by id). ✔
- Real per-kernel proportional thresholds from live word count → Tasks 1, 5. ✔
- Focus-gated active time, pause-not-reset → Task 5 (interval gated on visibility+focus). ✔
- Reached-bottom + genuine progression, short-article waiver → Tasks 2, 5. ✔
- Fires once per session → Task 5 (`firedRef`). ✔
- Purity gate lenient (no cross-tab lockout) → Task 5 accrues per current kernel; interruptions pause, never reset. ✔
- Terminator returns to truth → Task 6 (curve pins ends to 0; `cur` eases to true after). ✔
- Reduced-motion no-op → Task 6 (`!reduce` guard on arming). ✔
- Dead-frame guard → Task 6 (event is motion; return is an ease, never a snap). ✔
- Tests across pure logic + hook + component smoke → Tasks 1–6. ✔

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `requiredSeconds`/`countWords`, `isAbsorbed`/`allWitnessed`, `pinnedKernelArticleIds`, `retrogradeCurve`/`RETROGRADE_MS`, and the `retrograde={{ ts }}` token shape are used identically across the tasks that produce and consume them.
