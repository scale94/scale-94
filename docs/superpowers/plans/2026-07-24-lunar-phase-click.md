# Lunar Phase-Click → Moon Travels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a moon-phase glyph animates the shared time-scrub to that phase's age, so the moon visibly travels — phasing, librating, swelling — and every readout follows.

**Architecture:** A phase click is an auto-performed scrub. A pure module computes the target age and the shortest wrapped path; a thin rAF hook eases `scrubAge` from the current age to the target over ~0.8s; `LunarTab` wires the glyph click to it. Nothing else changes, because the moon, readouts, and register already read `currentAge`.

**Tech Stack:** React 19, Vitest + jsdom, `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-07-24-lunar-phase-click-design.md`
**Branch:** `feature/lunar-shader-moon` (already checked out; spec committed at `d291d1b`)

## Global Constraints

- **Test command is `npm test`** (`vitest run`). Baseline before this plan: **712 passing / 78 files**, green. Tests live in `src/terminal/lunar/__tests__/`.
- **One clock only.** The tween drives `scrubAge` (the existing scrub state). Do NOT introduce a second moon age. The moon, illumination readout, env params, doctrine register, and scrub slider all already follow `currentAge` — leave that intact.
- **Do NOT modify `PhaseSelector`.** It already emits the phase id via `onSelectPhase(p.id)` on click and long-press. Only its consumer (`LunarTab`) changes.
- **Every React test that calls `render()` must call `cleanup()`.**
- **A passing test proves nothing until it has been watched to fail.** Each task includes an explicit mutation step; if a mutation does not turn its named test red, that test is a false negative — fix it and say so, do not proceed.
- **`SYNODIC_PERIOD` and `PHASES` come from `../synodic`** (values `29.53058770576` and the 8-entry `PHASES` array). Import them; never redefine.
- **Representative age = `phaseIndex * SYNODIC_PERIOD / 8`** — verified in the spec to satisfy `getPhase(repAge) === phaseId` for all eight phases.
- **Tween duration is `800` ms; easing is `easeInOutCubic`; ties in the shortest path resolve forward.**
- **`prefers-reduced-motion` → snap** (one setter call at the target, no rAF), consistent with `LunarShaderMoon`.

---

## File Structure

| file | responsibility | task |
| :--- | :--- | :--- |
| `src/terminal/lunar/phaseJump.js` | pure — `shortestWrappedDelta`, `repAgeForPhase`, `wrapAge`, `easeInOutCubic`, `JUMP_DURATION_MS` | 1 |
| `src/terminal/lunar/usePhaseJump.js` | thin hook — rAF tween of `scrubAge`, reduced-motion snap, unmount cancel | 2 |
| `src/terminal/views/LunarTab.jsx` | wire the glyph click to `jumpToPhase` | 2 |

---

## Task 1: `phaseJump.js` — the pure travel math

**Files:**
- Create: `src/terminal/lunar/phaseJump.js`
- Test: `src/terminal/lunar/__tests__/phaseJump.test.js`

**Interfaces:**
- Consumes: `SYNODIC_PERIOD`, `PHASES` from `../synodic` (the module); the test additionally imports `getPhase` from `../synodic` for the round-trip check
- Produces:
  - `JUMP_DURATION_MS = 800`
  - `shortestWrappedDelta(from: number, to: number, period: number): number` — signed, in `(-period/2, +period/2]`, ties forward
  - `repAgeForPhase(phaseId: string): number` — `index * SYNODIC_PERIOD / 8`; unknown id → `0`
  - `wrapAge(age: number, period: number): number` — normalises into `[0, period)`
  - `easeInOutCubic(t: number): number`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/lunar/__tests__/phaseJump.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { SYNODIC_PERIOD, PHASES, getPhase } from '../synodic';
import {
  JUMP_DURATION_MS,
  shortestWrappedDelta,
  repAgeForPhase,
  wrapAge,
  easeInOutCubic,
} from '../phaseJump';

describe('shortestWrappedDelta', () => {
  it('goes forward when forward is shorter', () => {
    expect(shortestWrappedDelta(1, 4, 12)).toBeCloseTo(3, 10);
  });

  it('goes backward when backward is shorter', () => {
    expect(shortestWrappedDelta(4, 1, 12)).toBeCloseTo(-3, 10);
  });

  it('crosses the seam forward when that is shorter', () => {
    // 11 -> 1 on a 12 wheel: forward +2 through the seam, not backward -10.
    expect(shortestWrappedDelta(11, 1, 12)).toBeCloseTo(2, 10);
  });

  it('crosses the seam backward when that is shorter', () => {
    // 1 -> 11: backward -2 through the seam, not forward +10.
    expect(shortestWrappedDelta(1, 11, 12)).toBeCloseTo(-2, 10);
  });

  it('resolves an exact half-turn forward, never backward', () => {
    expect(shortestWrappedDelta(0, 6, 12)).toBeCloseTo(6, 10);
  });

  it('is zero when already there', () => {
    expect(shortestWrappedDelta(5, 5, 12)).toBe(0);
  });
});

describe('repAgeForPhase', () => {
  it('round-trips through getPhase for all eight phases', () => {
    for (const phase of PHASES) {
      const age = repAgeForPhase(phase.id);
      expect(getPhase(age).id).toBe(phase.id);
    }
  });

  it('puts full at the synodic midpoint and new at zero', () => {
    expect(repAgeForPhase('new')).toBe(0);
    expect(repAgeForPhase('full')).toBeCloseTo(SYNODIC_PERIOD / 2, 6);
  });

  it('falls back to 0 for an unknown phase id', () => {
    expect(repAgeForPhase('not-a-phase')).toBe(0);
  });
});

describe('wrapAge', () => {
  it('leaves in-range ages untouched', () => {
    expect(wrapAge(5, SYNODIC_PERIOD)).toBeCloseTo(5, 10);
  });
  it('wraps past the period', () => {
    expect(wrapAge(SYNODIC_PERIOD + 0.47, SYNODIC_PERIOD)).toBeCloseTo(0.47, 6);
  });
  it('wraps negatives into range', () => {
    expect(wrapAge(-1, SYNODIC_PERIOD)).toBeCloseTo(SYNODIC_PERIOD - 1, 6);
  });
});

describe('easeInOutCubic', () => {
  it('pins the endpoints', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it('passes through 0.5 at the midpoint', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });
  it('is symmetric about the midpoint', () => {
    // ease(0.5 + x) - 0.5 === 0.5 - ease(0.5 - x)
    for (const x of [0.1, 0.25, 0.4]) {
      expect(easeInOutCubic(0.5 + x) - 0.5).toBeCloseTo(0.5 - easeInOutCubic(0.5 - x), 10);
    }
  });
  it('is monotonic across a sweep', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = easeInOutCubic(Math.min(t, 1));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('constants', () => {
  it('exposes the 800ms travel duration', () => {
    expect(JUMP_DURATION_MS).toBe(800);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- phaseJump`
Expected: FAIL — `Failed to resolve import "../phaseJump"`.

- [ ] **Step 3: Write the implementation**

Create `src/terminal/lunar/phaseJump.js`:

```js
// phaseJump.js — pure math for "click a phase, the moon travels there".
//
// A phase click is an auto-performed scrub: these helpers turn a phase id into
// a target age and give the shortest signed path around the 29.53-day wheel.
// No React, no DOM, no state — the tween lives in usePhaseJump.js.

import { SYNODIC_PERIOD, PHASES } from './synodic';

export const JUMP_DURATION_MS = 800;

/**
 * Signed distance on the wheel from `from` to `to`, in (-period/2, +period/2].
 * An exact half-turn resolves forward (+period/2), never backward, so ties are
 * deterministic. This is what makes "new" from day 27 wax forward through the
 * seam (+2.5d) rather than crawl backward 27 days.
 */
export function shortestWrappedDelta(from, to, period) {
  let d = (((to - from) % period) + period) % period; // [0, period)
  if (d > period / 2) d -= period;                     // (-period/2, +period/2]
  return d;
}

/** The illumination-defining age of a phase: index * SYNODIC / 8. */
export function repAgeForPhase(phaseId) {
  const i = PHASES.findIndex(p => p.id === phaseId);
  if (i < 0) return 0;
  return (i * SYNODIC_PERIOD) / 8;
}

/** Normalise an age into [0, period). */
export function wrapAge(age, period) {
  return ((age % period) + period) % period;
}

/** Standard easeInOutCubic on [0,1]. */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- phaseJump`
Expected: PASS, 16 tests.

The round-trip test is the load-bearing one: if any `repAgeForPhase` value drifted out of its `getPhase` band, it fails. Do not adjust it to pass — fix the formula.

- [ ] **Step 5: Watch the key tests fail on purpose**

Apply each mutation, run `npm test -- phaseJump`, confirm the named test goes red, then revert:

| mutation | test that must fail |
| :--- | :--- |
| `if (d > period / 2)` → `if (d >= period / 2)` | "resolves an exact half-turn forward, never backward" |
| `(i * SYNODIC_PERIOD) / 8` → `(i * SYNODIC_PERIOD) / 7` | "round-trips through getPhase for all eight phases" |
| `t < 0.5 ? 4*t*t*t : …` → `return t;` (linear) | "is symmetric about the midpoint" stays green (linear is symmetric) — so instead confirm this mutation fails NOTHING and note it; the symmetry test is about shape, not linearity. Then verify "passes through 0.5" also survives linear. This tells you easeInOutCubic's tests check symmetry/endpoints, not cubic-ness specifically. That is acceptable for an easing curve — record it, do not add a contrived test. |

If the first two mutations do not turn their named test red, that test is a false negative — report it and fix before committing.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/lunar/phaseJump.js src/terminal/lunar/__tests__/phaseJump.test.js
git commit -m "feat(lunar): pure phase-jump math (shortest path, rep ages, easing)"
```

---

## Task 2: `usePhaseJump.js` hook + `LunarTab` wiring

Deliverable: clicking any phase glyph animates the moon (and every readout) to that phase over ~0.8s.

**Files:**
- Create: `src/terminal/lunar/usePhaseJump.js`
- Modify: `src/terminal/views/LunarTab.jsx` (add ref, hook, combined click handler)
- Test: `src/terminal/lunar/__tests__/usePhaseJump.test.jsx`

**Interfaces:**
- Consumes: `repAgeForPhase`, `shortestWrappedDelta`, `wrapAge`, `easeInOutCubic`, `JUMP_DURATION_MS` (Task 1)
- Produces:
  - `usePhaseJump({ setScrubAge, currentAgeRef }) → (phaseId: string) => void`
    - `setScrubAge`: the `useState` setter for `scrubAge`
    - `currentAgeRef`: a ref whose `.current` always holds the live `currentAge`
    - returns a stable `jumpToPhase(phaseId)` callback
  - **Self-cancelling:** each frame the tween compares `currentAgeRef.current`
    against the value it last set. Any external write to `scrubAge` — the slider
    drag, a scrub-marker click, or `↺ return to now` (which sets `null` →
    `currentAge` becomes `liveAge`) — makes them diverge and aborts the tween, so
    the moon never fights a manual scrub. No wiring on those controls is needed.

- [ ] **Step 1: Write the failing hook test**

Create `src/terminal/lunar/__tests__/usePhaseJump.test.jsx`:

```jsx
import React, { useRef } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { usePhaseJump } from '../usePhaseJump';
import { repAgeForPhase } from '../phaseJump';

// Deterministic rAF: capture callbacks in a Map keyed by id, drive them by hand.
let rafMap;
let rafId;
let nowVal;

function flush(ms) {
  nowVal += ms;
  const cbs = [...rafMap.values()];
  rafMap.clear();
  cbs.forEach(cb => cb(nowVal));
}

function setReducedMotion(matches) {
  vi.stubGlobal('matchMedia', (q) => ({
    matches, media: q, addEventListener() {}, removeEventListener() {},
  }));
}

// Faithful harness: setScrubAge updates currentAgeRef, exactly as React state →
// currentAge → the ref does in LunarTab. This is required for the self-cancel
// check to behave correctly — a spy that left the ref stale would look like a
// permanent external divergence and abort every tween on frame 2.
function Harness({ hookRef, onSet, startAge }) {
  const currentAgeRef = useRef(startAge);
  const setScrubAge = React.useCallback((v) => {
    currentAgeRef.current = v;
    onSet(v);
  }, [onSet]);
  hookRef.current = usePhaseJump({ setScrubAge, currentAgeRef });
  hookRef.ageRef = currentAgeRef;   // exposed so a test can simulate a drag
  return null;
}

beforeEach(() => {
  rafMap = new Map();
  rafId = 0;
  nowVal = 0;
  vi.stubGlobal('requestAnimationFrame', (cb) => { rafId += 1; rafMap.set(rafId, cb); return rafId; });
  vi.stubGlobal('cancelAnimationFrame', (id) => { rafMap.delete(id); });
  vi.spyOn(performance, 'now').mockImplementation(() => nowVal);
  setReducedMotion(false);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('usePhaseJump — tween', () => {
  it('eases toward the target and lands exactly on it', () => {
    const onSet = vi.fn();
    const hookRef = { current: null };
    render(<Harness hookRef={hookRef} onSet={onSet} startAge={0} />);

    act(() => { hookRef.current('full'); });   // target ~14.765
    act(() => { flush(0); });                   // first frame, t=0
    expect(onSet.mock.calls[0][0]).toBeCloseTo(0, 1); // starts at the start age

    act(() => { flush(400); });                 // midway, t=0.5
    const mid = onSet.mock.calls.at(-1)[0];
    expect(mid).toBeGreaterThan(1);             // moved off the start
    expect(mid).toBeLessThan(repAgeForPhase('full')); // not yet arrived — proves it tweens

    act(() => { flush(400); });                 // t=1
    expect(onSet.mock.calls.at(-1)[0]).toBeCloseTo(repAgeForPhase('full'), 6); // lands exactly
  });

  it('takes the shortest wrapped path (new from day 27 waxes forward past the seam)', () => {
    const onSet = vi.fn();
    const hookRef = { current: null };
    render(<Harness hookRef={hookRef} onSet={onSet} startAge={27} />);

    act(() => { hookRef.current('new'); });     // target 0
    act(() => { flush(0); flush(400); });       // partway
    const mid = onSet.mock.calls.at(-1)[0];
    // Forward from 27 crosses the 29.53 seam: the value should be > 27 or wrapped
    // to a small age — never drifting down toward 14 (which would be backward).
    expect(mid > 27 || mid < 3).toBe(true);
    act(() => { flush(400); });
    expect(onSet.mock.calls.at(-1)[0]).toBeCloseTo(0, 6);
  });
});

describe('usePhaseJump — reduced motion', () => {
  it('snaps to the target with no rAF when reduced motion is set', () => {
    setReducedMotion(true);
    const onSet = vi.fn();
    const hookRef = { current: null };
    render(<Harness hookRef={hookRef} onSet={onSet} startAge={0} />);

    act(() => { hookRef.current('full'); });
    expect(onSet).toHaveBeenCalledTimes(1);
    expect(onSet).toHaveBeenCalledWith(repAgeForPhase('full'));
    expect(rafMap.size).toBe(0);   // no animation scheduled
  });
});

describe('usePhaseJump — retarget, external cancel, cleanup', () => {
  it('retargets from the current position when clicked mid-tween', () => {
    const onSet = vi.fn();
    const hookRef = { current: null };
    render(<Harness hookRef={hookRef} onSet={onSet} startAge={0} />);

    act(() => { hookRef.current('full'); });    // heading to ~14.765
    act(() => { flush(0); flush(400); });        // partway there
    act(() => { hookRef.current('new'); });      // change target to 0
    act(() => { flush(0); flush(400); flush(400); });
    expect(onSet.mock.calls.at(-1)[0]).toBeCloseTo(0, 6); // ended at new, not full
  });

  it('aborts when scrubAge is changed externally (a manual drag)', () => {
    const onSet = vi.fn();
    const hookRef = { current: null };
    render(<Harness hookRef={hookRef} onSet={onSet} startAge={0} />);

    act(() => { hookRef.current('full'); });
    act(() => { flush(0); flush(200); });
    const callsBeforeDrag = onSet.mock.calls.length;
    // Simulate a drag writing scrubAge directly, diverging from the tween's value:
    act(() => { hookRef.ageRef.current = 25; });
    act(() => { flush(200); flush(200); flush(200); });
    // The tween saw the divergence and stopped touching scrubAge:
    expect(onSet.mock.calls.length).toBe(callsBeforeDrag);
  });

  it('cancels the rAF on unmount (no setter calls after)', () => {
    const onSet = vi.fn();
    const hookRef = { current: null };
    const { unmount } = render(<Harness hookRef={hookRef} onSet={onSet} startAge={0} />);

    act(() => { hookRef.current('full'); });
    act(() => { flush(0); });
    const callsBefore = onSet.mock.calls.length;
    unmount();
    act(() => { flush(400); flush(400); });
    expect(onSet.mock.calls.length).toBe(callsBefore); // frozen after unmount
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- usePhaseJump`
Expected: FAIL — `Failed to resolve import "../usePhaseJump"`.

- [ ] **Step 3: Write the hook**

Create `src/terminal/lunar/usePhaseJump.js`:

```jsx
// usePhaseJump.js — animate the shared scrubAge to a phase's age.
//
// A phase click is an auto-performed scrub: this hook eases scrubAge from
// wherever it is now (currentAgeRef.current — liveAge when not scrubbing) to the
// clicked phase's representative age, along the shortest wrapped path. Because
// scrubAge is the tab's one clock, the moon, readouts, and register all follow.
// prefers-reduced-motion snaps instead. Re-clicking retargets from the current
// position; unmount cancels the frame.

import { useCallback, useEffect, useRef } from 'react';
import { SYNODIC_PERIOD } from './synodic';
import {
  JUMP_DURATION_MS,
  repAgeForPhase,
  shortestWrappedDelta,
  wrapAge,
  easeInOutCubic,
} from './phaseJump';

const EXTERNAL_WRITE_EPS = 1e-6;

export function usePhaseJump({ setScrubAge, currentAgeRef }) {
  const rafRef = useRef(0);
  const lastSetRef = useRef(null);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return useCallback((phaseId) => {
    cancelAnimationFrame(rafRef.current);

    const target = repAgeForPhase(phaseId);
    const start = currentAgeRef.current ?? 0;

    const reduced =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setScrubAge(target);
      return;
    }

    const delta = shortestWrappedDelta(start, target, SYNODIC_PERIOD);
    const t0 = performance.now();
    lastSetRef.current = start;

    const set = (v) => { setScrubAge(v); lastSetRef.current = v; };

    const frame = (now) => {
      // Self-cancel: if scrubAge no longer matches what we last wrote, an
      // external control took the wheel (slider drag, scrub marker, or return-
      // to-now) — abort so the moon never fights a manual scrub.
      if (Math.abs(currentAgeRef.current - lastSetRef.current) > EXTERNAL_WRITE_EPS) return;

      const t = Math.min((now - t0) / JUMP_DURATION_MS, 1);
      if (t >= 1) {
        set(target);               // land exactly, no float drift
        return;
      }
      set(wrapAge(start + easeInOutCubic(t) * delta, SYNODIC_PERIOD));
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [setScrubAge, currentAgeRef]);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- usePhaseJump`
Expected: PASS, 7 tests.

- [ ] **Step 5: Mutation check — watch four tests fail**

Apply each mutation, run `npm test -- usePhaseJump`, confirm the named test fails, revert:

| mutation | test that must fail |
| :--- | :--- |
| in the reduced branch, delete `return;` after `setScrubAge(target)` (let it fall through and tween) | "snaps to the target with no rAF when reduced motion is set" (rafMap.size would be > 0) |
| replace the frame body (after the abort check) with `set(target)` (snap always) | "eases toward the target and lands exactly on it" (the mid-tween `< repAgeForPhase('full')` assertion) |
| delete the self-cancel `if (Math.abs(...) > EXTERNAL_WRITE_EPS) return;` line | "aborts when scrubAge is changed externally (a manual drag)" |
| remove the unmount `useEffect` cleanup line | "cancels the rAF on unmount (no setter calls after)" |

If any mutation leaves its test green, that test does not discriminate — report and fix before committing.

- [ ] **Step 6: Wire into `LunarTab.jsx`**

Add the import near the other lunar imports (around `LunarTab.jsx:20-25`):

```jsx
import { usePhaseJump } from '../lunar/usePhaseJump';
```

Immediately after the effective-values block (after `LunarTab.jsx:794`, the line
`const envParams = isScrubbing ? getEnvironmentalParamsFallback(scrubAge) : liveEnvParams;`), add a ref that always holds the live `currentAge`, and the hook:

```jsx
  // Always-fresh currentAge for the phase-jump tween to start from.
  const currentAgeRef = useRef(currentAge);
  currentAgeRef.current = currentAge;
  const jumpToPhase = usePhaseJump({ setScrubAge, currentAgeRef });
```

(`useRef` is already imported at `LunarTab.jsx:16`.)

Find the `PhaseSelector` mount (around `LunarTab.jsx:962-966`) and change its
`onSelectPhase` from `setSelectedPhaseId` to a combined handler:

```jsx
          <PhaseSelector
            currentAge={currentAge}
            onSelectPhase={(id) => { setSelectedPhaseId(id); jumpToPhase(id); }}
            selectedPhaseId={selectedPhaseId}
          />
```

Leave everything else — the auto-sync effect at `LunarTab.jsx:799`, the accord
`useMemo`, `PhaseSelector` itself — untouched.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS. Record the count: 712 + 16 (Task 1) + 7 (Task 2) = **735 passing**. No pre-existing test may regress.

- [ ] **Step 8: Verify in the browser**

Start the dev server via `preview_start` (name `scale94-dev`; never `npm run dev` in Bash). Navigate to the LUNAR tab.

**Note the click-offset quirk:** the app renders under a `transform: scale()`, so `computer` clicks by coordinate miss the phase glyphs. Click programmatically instead, and read the illumination readout to confirm the whole chain moved. Use `javascript_tool`:

```js
(() => {
  const btns = [...document.querySelectorAll('button')];
  // phase glyphs carry the phase label as title/aria; match the full-moon glyph
  const full = btns.find(b => /full/i.test(b.getAttribute('title') || b.getAttribute('aria-label') || ''));
  return { found: !!full };
})();
```

If the glyph buttons are not identifiable by title/aria, read the page for the
phase-selector row and use its ref order (new … waning-crescent, 8 buttons).
Click the **full-moon** glyph, wait ~1s for the tween, then confirm:

```js
document.body.innerText.match(/([\d.]+)% illuminated · day ([\d.]+)/);
```

Expected after clicking full: `% illuminated` climbs toward ~100 and `day`
lands near 14.8; the phase label reads `FULL MOON`; the moon canvas shows a full
disc. Click the **new-moon** glyph and confirm it travels back to ~0% / day ~0.

Watch for: the readout should **change progressively** across ~0.8s (proof it
travels, not snaps) — sample it twice ~300ms apart and confirm the `day` value
differs between samples. Check `read_console_messages` for errors.

If the moon jumps instantly with no intermediate values, the tween isn't
driving React re-renders — confirm `setScrubAge` is the real state setter, not a
ref write.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/lunar/usePhaseJump.js src/terminal/lunar/__tests__/usePhaseJump.test.jsx src/terminal/views/LunarTab.jsx
git commit -m "feat(lunar): clicking a phase glyph travels the moon to that phase"
```

---

## Post-implementation

Do **not** merge, and do **not** push (author's standing rule; the shader-moon
branch is still awaiting his live look). Present:

1. A short capture or readout sequence showing the moon travelling on a click.
2. The final suite count (expect **735**).
3. Confirmation the mare/earthshine/corona work and the merge decision are
   unaffected — this rode on the same branch and changed only the phase click.
