# Mercury neutral state Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /mercury boots into a held-liquid planet with no gas; an element is a mode entered by tapping its node and left by tapping it again; every switch passes fadeOut → neutral → spinUp; the idle ghost copies are gone.

**Architecture:** A pure state machine (`transitionMachine.js`) owns the beats and per-element fades. `usePhaseTransition` becomes a thin rAF wrapper around it. The canvas maps fades to flow opacity, `visible`, sky weights and the planet's `holdLiquid` flag; `mercuryBody` floors heat while held and melts 3× faster.

**Tech Stack:** React 18, @react-three/fiber, three, vitest (`npx vitest run <file>`), eslint (`npm run lint`).

Spec: `docs/superpowers/specs/2026-10-07-mercury-neutral-state-design.md`.

## Global Constraints

- `state ∈ { neutral, fluid, thermal, earth, air }`; the tab **boots into neutral**; tapping the **lit** node returns to neutral. No new controls.
- Durations: `FADE_OUT_MS 400`, `NEUTRAL_MS 300`, `SPIN_UP_MS 600`. Fades are linear in time with eased output: easeIn for fadeOut, easeOut for spinUp.
- Retarget: fades continue from their current values at the same rates, no jumps. Reversal (target = element fading out, or already fading in) goes straight to / stays in spinUp, no neutral beat.
- Invariants: at most two fades non-zero (this design keeps ≤ 1); in neutral state and neutral beat all fades are 0; steady element e: f[e] = 1, others 0.
- One `advance(dt)` with a large dt resolves the whole remaining sequence in that call and lands on the target's steady state.
- "Active element" (lit node, thread line, FPS reporter, gas counts, `onPhaseChange`) = element whose fade is rising or at 1; none (`null`) in neutral and during a fadeOut.
- `advance(m, dtMs)` mutates `m` and allocates nothing.
- `holdLiquid(m)` is true while `state === 'neutral'` or `beat === 'neutral'`.
- Body: `holdLiquid` floors `heatK` at `MELT_HEAT_K` in `stepBody` and `coolBody`; spin heating still adds above the floor; `TRANSMUTE_HOLD_S = 1`; clearing the flag changes nothing else.
- Canvas: `opacityFor(e) = fades[e] × 0.45`; no ghost floor; `visible={fades[e] > 0}` per flow; full tier gas counts always; `GHOST_DENSITY` and the ghost branch removed; `condense` 0 for all flows (props/uniforms stay).
- Sky: weight for e is `fades[e]`, normalised if sum > 1; all zero in neutral.
- Out of scope: thread look (sub-project B), phone gate, condense plumbing removal.
- Repo idiom: tests are vitest; source pins read files with `?raw` imports or `readFileSync`; comments are terse and say why. Lint gate: 0 errors, warnings must not rise above the current count (run `npm run lint` before and after).

---

### Task 1: `transitionMachine.js` — pure lifecycle machine

**Files:**
- Create: `src/terminal/mercury/transitionMachine.js`
- Test: `src/terminal/mercury/__tests__/transitionMachine.test.js`

**Interfaces:**
- Produces: `ELEMENTS`, `FADE_OUT_MS`, `NEUTRAL_MS`, `SPIN_UP_MS`, `createMachine()`, `request(m, element)`, `advance(m, dtMs)`, `holdLiquid(m)`, `activeElement(m)` (element string or `null`), `isSteady(m)`.
- Machine shape: `{ state, target, beat, p, beatMs, fade: { fluid, thermal, earth, air } }`. `beat ∈ 'idle' | 'fadeOut' | 'neutral' | 'spinUp'`. During fadeOut/spinUp `state` is the element moving; during the neutral beat `state === 'neutral'`.

Design note (why fades never jump on retarget): the machine stores the fade **output** `f`, and on entering a beat recomputes the beat's linear progress `p` by inverting that beat's curve. fadeOut: `f = 1 − p²` ⇒ `p = √(1 − f)`. spinUp: `f = 1 − (1 − p)²` ⇒ `p = 1 − √(1 − f)`. `p` advances at `dt / duration`, so rates are the beats' own.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import {
  ELEMENTS, FADE_OUT_MS, NEUTRAL_MS, SPIN_UP_MS,
  createMachine, request, advance, holdLiquid, activeElement, isSteady,
} from '../transitionMachine';

const nonZero = (m) => ELEMENTS.filter((e) => m.fade[e] > 0);
const steadyOn = (m, e) => {
  expect(m.beat).toBe('idle');
  expect(m.state).toBe(e);
  for (const x of ELEMENTS) expect(m.fade[x]).toBe(x === e ? 1 : 0);
};
const steadyNeutral = (m) => {
  expect(m.beat).toBe('idle');
  expect(m.state).toBe('neutral');
  for (const x of ELEMENTS) expect(m.fade[x]).toBe(0);
};
// steps dt until `ms` has passed, checking invariants at every step
function run(m, ms, dt = 1) {
  for (let t = 0; t < ms - 1e-9; t += dt) {
    advance(m, Math.min(dt, ms - t));
    expect(nonZero(m).length).toBeLessThanOrEqual(2);
    if (m.state === 'neutral' || m.beat === 'neutral') expect(nonZero(m)).toEqual([]);
    if (m.beat === 'idle' && m.state !== 'neutral') steadyOn(m, m.state);
  }
}
const on = (e) => { const m = createMachine(); request(m, e); advance(m, SPIN_UP_MS); return m; };

describe('transitionMachine — boot and constants', () => {
  it('boots into neutral, all fades 0, no active element', () => {
    const m = createMachine();
    expect(m).toMatchObject({ state: 'neutral', target: 'neutral', beat: 'idle' });
    steadyNeutral(m);
    expect(activeElement(m)).toBe(null);
    expect(isSteady(m)).toBe(true);
  });
  it('durations are the ruled values', () => {
    expect([FADE_OUT_MS, NEUTRAL_MS, SPIN_UP_MS]).toEqual([400, 300, 600]);
    expect(ELEMENTS).toEqual(['fluid', 'thermal', 'earth', 'air']);
  });
});

describe('transitionMachine — beats table', () => {
  it('neutral → e: spinUp over exactly 600 ms, easeOut', () => {
    const m = createMachine();
    request(m, 'earth');
    expect(m.beat).toBe('spinUp');
    expect(activeElement(m)).toBe('earth');
    advance(m, SPIN_UP_MS / 2);
    expect(m.fade.earth).toBeCloseTo(0.75, 9); // 1 − (1 − .5)²
    advance(m, SPIN_UP_MS / 2 - 0.001);
    expect(m.beat).toBe('spinUp');
    advance(m, 0.001);
    steadyOn(m, 'earth');
  });
  it('e → neutral (tap lit node): fadeOut over exactly 400 ms, easeIn, then rest', () => {
    const m = on('air');
    request(m, 'air');
    expect(m.target).toBe('neutral');
    expect(m.beat).toBe('fadeOut');
    expect(activeElement(m)).toBe(null);
    advance(m, FADE_OUT_MS / 2);
    expect(m.fade.air).toBeCloseTo(0.75, 9); // 1 − .5²
    advance(m, FADE_OUT_MS / 2 - 0.001);
    expect(m.beat).toBe('fadeOut');
    advance(m, 0.001);
    steadyNeutral(m);
  });
  it('e → e′: fadeOut 400, neutral 300, spinUp 600', () => {
    const m = on('fluid');
    request(m, 'thermal');
    expect(m.target).toBe('thermal');
    advance(m, FADE_OUT_MS - 0.001);
    expect(m.beat).toBe('fadeOut');
    advance(m, 0.001);
    expect(m.beat).toBe('neutral');
    expect(m.state).toBe('neutral');
    advance(m, NEUTRAL_MS - 0.001);
    expect(m.beat).toBe('neutral');
    advance(m, 0.001);
    expect(m.beat).toBe('spinUp');
    expect(m.state).toBe('thermal');
    advance(m, SPIN_UP_MS);
    steadyOn(m, 'thermal');
  });
  it('invariants hold on a 1 ms grid through every row', () => {
    const m = createMachine();
    request(m, 'fluid'); run(m, 700);
    request(m, 'earth'); run(m, 1400);
    request(m, 'earth'); run(m, 500);
    steadyNeutral(m);
  });
  it('tapping the element spinning up toggles to neutral without moving its fade', () => {
    const m = createMachine();
    request(m, 'fluid'); advance(m, 100);
    const f = m.fade.fluid;
    request(m, 'fluid'); // fluid is lit while it spins up
    expect(m.target).toBe('neutral');
    expect(m.fade.fluid).toBe(f);
  });
});

describe('transitionMachine — retarget', () => {
  it('reversal: tapping the element fading out goes straight into spinUp, no jump, spinUp rate', () => {
    const m = on('fluid');
    request(m, 'fluid');        // → neutral
    advance(m, 200);            // f = .75
    request(m, 'fluid');        // reverse
    expect(m.beat).toBe('spinUp');
    expect(m.fade.fluid).toBeCloseTo(0.75, 9);
    // spinUp from .75 is p = .5 → 300 ms remain
    advance(m, 299);
    expect(m.beat).toBe('spinUp');
    advance(m, 1);
    steadyOn(m, 'fluid');
  });
  it('reversal during spinUp → neutral fades out from the current value at the fadeOut rate', () => {
    const m = createMachine();
    request(m, 'air'); advance(m, 300); // f = .75
    request(m, 'air');                  // lit → neutral
    expect(m.beat).toBe('fadeOut');
    expect(m.fade.air).toBeCloseTo(0.75, 9);
    // fadeOut from .75 is p = .5 → 200 ms remain
    advance(m, 199); expect(m.beat).toBe('fadeOut');
    advance(m, 1); steadyNeutral(m);
  });
  it('another element during spinUp: current fades out from its value, then neutral beat, then spinUp', () => {
    const m = createMachine();
    request(m, 'air'); advance(m, 300);
    request(m, 'earth');
    expect(m.beat).toBe('fadeOut');
    expect(m.state).toBe('air');
    advance(m, 200); expect(m.beat).toBe('neutral');
    advance(m, NEUTRAL_MS); expect(m.beat).toBe('spinUp'); expect(m.state).toBe('earth');
    advance(m, SPIN_UP_MS); steadyOn(m, 'earth');
  });
  it('another element during fadeOut keeps the fadeOut and retargets the spinUp', () => {
    const m = on('fluid');
    request(m, 'thermal'); advance(m, 100);
    const f = m.fade.fluid;
    request(m, 'air');
    expect(m.beat).toBe('fadeOut');
    expect(m.fade.fluid).toBe(f);
    advance(m, 300 + NEUTRAL_MS + SPIN_UP_MS);
    steadyOn(m, 'air');
  });
  it('during the neutral beat: a new element retargets without restarting the beat', () => {
    const m = on('fluid');
    request(m, 'thermal'); advance(m, FADE_OUT_MS + 100);
    request(m, 'earth');
    expect(m.beat).toBe('neutral');
    advance(m, 199); expect(m.beat).toBe('neutral');
    advance(m, 1); expect(m.state).toBe('earth'); expect(m.beat).toBe('spinUp');
  });
  it('during the neutral beat: tapping the element that just left returns it (spinUp from 0 after the beat)', () => {
    const m = on('fluid');
    request(m, 'thermal'); advance(m, FADE_OUT_MS + 100);
    request(m, 'fluid');
    expect(m.target).toBe('fluid');
    advance(m, 200 + SPIN_UP_MS);
    steadyOn(m, 'fluid');
  });
});

describe('transitionMachine — large dt', () => {
  const starts = {
    'idle neutral → e': () => { const m = createMachine(); request(m, 'air'); return [m, 'air']; },
    'mid fadeOut → e′': () => { const m = on('fluid'); request(m, 'earth'); advance(m, 100); return [m, 'earth']; },
    'mid neutral beat → e′': () => { const m = on('fluid'); request(m, 'earth'); advance(m, 500); return [m, 'earth']; },
    'mid spinUp → e′': () => { const m = on('fluid'); request(m, 'earth'); advance(m, 900); return [m, 'earth']; },
    'mid fadeOut → neutral': () => { const m = on('fluid'); request(m, 'fluid'); advance(m, 100); return [m, 'neutral']; },
  };
  for (const [name, mk] of Object.entries(starts)) {
    it(`${name}: one advance(1e6) lands on the steady target`, () => {
      const [m, target] = mk();
      advance(m, 1e6);
      if (target === 'neutral') steadyNeutral(m); else steadyOn(m, target);
      expect(isSteady(m)).toBe(true);
    });
  }
});

describe('transitionMachine — holdLiquid', () => {
  it('true in neutral and the neutral beat, false during fadeOut, spinUp and steady element', () => {
    const m = createMachine();
    expect(holdLiquid(m)).toBe(true);                  // idle neutral
    request(m, 'fluid');
    expect(holdLiquid(m)).toBe(false);                 // spinUp
    advance(m, SPIN_UP_MS);
    expect(holdLiquid(m)).toBe(false);                 // steady fluid
    request(m, 'air');
    expect(holdLiquid(m)).toBe(false);                 // fadeOut
    advance(m, FADE_OUT_MS);
    expect(holdLiquid(m)).toBe(true);                  // neutral beat
    advance(m, NEUTRAL_MS);
    expect(holdLiquid(m)).toBe(false);                 // spinUp air
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/transitionMachine.test.js`
Expected: FAIL — cannot resolve `../transitionMachine`.

- [ ] **Step 3: Write the implementation**

```js
// The /mercury element lifecycle (spec 2026-10-07 neutral state): neutral is a fifth state — the held-liquid planet,
// no gas. Every switch passes fadeOut → neutral beat → spinUp. Pure, allocation-free in advance(); the hook drives it.
export const ELEMENTS = ['fluid', 'thermal', 'earth', 'air'];
export const FADE_OUT_MS = 400;
export const NEUTRAL_MS = 300;
export const SPIN_UP_MS = 600;
const EPS_MS = 1e-6; // a beat whose remainder is float dust ends now, not on a later frame

// Fades store the eased OUTPUT; entering a beat inverts that beat's curve for its linear progress p, so a retarget
// continues from the current value with no jump. fadeOut f = 1 − p² (easeIn), spinUp f = 1 − (1 − p)² (easeOut).
const fadeOutP = (f) => Math.sqrt(Math.max(0, 1 - f));
const spinUpP = (f) => 1 - Math.sqrt(Math.max(0, 1 - f));

export function createMachine() {
  return { state: 'neutral', target: 'neutral', beat: 'idle', p: 0, beatMs: 0, fade: { fluid: 0, thermal: 0, earth: 0, air: 0 } };
}

// The element whose fade is rising or at 1 — the lit node. None in neutral or while one fades out.
export function activeElement(m) {
  if (m.beat === 'spinUp') return m.state;
  if (m.beat === 'idle' && m.state !== 'neutral') return m.state;
  return null;
}

export function holdLiquid(m) {
  return m.state === 'neutral' || m.beat === 'neutral';
}

export function isSteady(m) {
  return m.beat === 'idle';
}

function enterFadeOut(m) { m.beat = 'fadeOut'; m.p = fadeOutP(m.fade[m.state]); }
function enterSpinUp(m, e) { m.state = e; m.beat = 'spinUp'; m.p = spinUpP(m.fade[e]); }

// A node tap. Tapping the lit element means "go to neutral".
export function request(m, element) {
  m.target = element === activeElement(m) ? 'neutral' : element;
  if (m.beat === 'idle') {
    if (m.state === 'neutral') { if (m.target !== 'neutral') enterSpinUp(m, m.target); }
    else if (m.target !== m.state) enterFadeOut(m);
  } else if (m.beat === 'fadeOut') {
    if (m.target === m.state) enterSpinUp(m, m.state); // reversal: no neutral beat
  } else if (m.beat === 'neutral') {
    if (m.target === 'neutral') { m.beat = 'idle'; m.beatMs = 0; }
  } else if (m.beat === 'spinUp') {
    if (m.target !== m.state) enterFadeOut(m);
  }
  return m;
}

// Mutates m; one call with a large dt resolves every remaining beat and lands on the target's steady state.
export function advance(m, dtMs) {
  let dt = dtMs > 0 ? dtMs : 0;
  while (dt > 0 && m.beat !== 'idle') {
    if (m.beat === 'fadeOut') {
      const left = (1 - m.p) * FADE_OUT_MS;
      if (dt < left - EPS_MS) { m.p += dt / FADE_OUT_MS; m.fade[m.state] = 1 - m.p * m.p; dt = 0; }
      else {
        dt = Math.max(0, dt - left);
        m.fade[m.state] = 0;
        m.state = 'neutral';
        if (m.target === 'neutral') m.beat = 'idle';
        else { m.beat = 'neutral'; m.beatMs = 0; }
      }
    } else if (m.beat === 'neutral') {
      const left = NEUTRAL_MS - m.beatMs;
      if (dt < left - EPS_MS) { m.beatMs += dt; dt = 0; }
      else { dt = Math.max(0, dt - left); m.beatMs = 0; enterSpinUp(m, m.target); }
    } else { // spinUp
      const left = (1 - m.p) * SPIN_UP_MS;
      if (dt < left - EPS_MS) { m.p += dt / SPIN_UP_MS; const q = 1 - m.p; m.fade[m.state] = 1 - q * q; dt = 0; }
      else { dt = 0; m.fade[m.state] = 1; m.beat = 'idle'; }
    }
  }
  return m;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/__tests__/transitionMachine.test.js`
Expected: PASS. If a duration boundary test still fails by float error, fix the arithmetic in the machine, never loosen the test's durations.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/transitionMachine.js src/terminal/mercury/__tests__/transitionMachine.test.js
git commit -m "feat(mercury): transition machine — neutral is a fifth state; fadeOut 400 / neutral 300 / spinUp 600, retarget without jumps"
```

---

### Task 2: `usePhaseTransition` — thin rAF wrapper around the machine

**Files:**
- Modify (rewrite): `src/terminal/mercury/usePhaseTransition.js`
- Modify (rewrite): `tests/mercury/usePhaseTransition.test.js`
- Delete: `src/terminal/mercury/__tests__/condenseEnvelope.test.js` (tests the removed breath envelope)
- Modify: `src/terminal/mercury/mercuryTuning.js` — remove `duckActive`/`duckGhost` only if nothing else reads them (`grep -rn "duckActive\|duckGhost" src`); `condenseBite`/`condenseSizeBite` stay (the canvas still passes them).

**Interfaces:**
- Consumes (Task 1): `createMachine, request, advance, holdLiquid, activeElement, ELEMENTS` from `./transitionMachine`.
- Produces: `export const PHASES = ['fluid','thermal','earth','air']` (re-export of `ELEMENTS`); default export `usePhaseTransition()` (no argument) returning `{ activePhase, fades, transitionState, holdLiquid, triggerTransition }` where `activePhase` is an element or `null`, `fades` is `{fluid,thermal,earth,air}` numbers (a fresh object each render is fine), `transitionState` is the beat string, `holdLiquid` a boolean, `triggerTransition(element)`.

- [ ] **Step 1: Write the failing test** (replace the whole file; keep its rAF/performance stubs)

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePhaseTransition, { PHASES } from '../../src/terminal/mercury/usePhaseTransition';
import { FADE_OUT_MS, NEUTRAL_MS, SPIN_UP_MS } from '../../src/terminal/mercury/transitionMachine';

let rafCallbacks = [];
let nowMs = 0;
beforeEach(() => {
  rafCallbacks = [];
  nowMs = 1000;
  vi.stubGlobal('requestAnimationFrame', (cb) => { rafCallbacks.push(cb); return rafCallbacks.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn(() => {}));
  vi.stubGlobal('performance', { now: () => nowMs });
});
afterEach(() => { vi.unstubAllGlobals(); });
function flush(ms) { nowMs += ms; const cbs = rafCallbacks.splice(0); cbs.forEach((cb) => cb(nowMs)); }

describe('usePhaseTransition — neutral boot', () => {
  it('boots into neutral: no active phase, all fades 0, holding liquid', () => {
    const { result } = renderHook(() => usePhaseTransition());
    expect(result.current.activePhase).toBe(null);
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.holdLiquid).toBe(true);
    for (const p of PHASES) expect(result.current.fades[p]).toBe(0);
    expect(rafCallbacks.length).toBe(0); // no animation at rest
  });
});

describe('usePhaseTransition — driving the machine', () => {
  it('a tap spins the element up over SPIN_UP_MS and the rAF stops at rest', () => {
    const { result } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('earth'); });
    expect(result.current.activePhase).toBe('earth');
    expect(result.current.transitionState).toBe('spinUp');
    expect(result.current.holdLiquid).toBe(false);
    act(() => { flush(SPIN_UP_MS / 2); });
    expect(result.current.fades.earth).toBeCloseTo(0.75, 6);
    act(() => { flush(SPIN_UP_MS / 2); });
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.fades.earth).toBe(1);
    expect(rafCallbacks.length).toBe(0);
  });
  it('tapping the lit element returns to neutral', () => {
    const { result } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('air'); flush(SPIN_UP_MS); });
    act(() => { result.current.triggerTransition('air'); });
    expect(result.current.activePhase).toBe(null);
    expect(result.current.transitionState).toBe('fadeOut');
    act(() => { flush(FADE_OUT_MS); });
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.holdLiquid).toBe(true);
    expect(result.current.fades.air).toBe(0);
  });
  it('element → element passes through the neutral beat', () => {
    const { result } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('fluid'); flush(SPIN_UP_MS); });
    act(() => { result.current.triggerTransition('thermal'); flush(FADE_OUT_MS + 10); });
    expect(result.current.transitionState).toBe('neutral');
    expect(result.current.holdLiquid).toBe(true);
    for (const p of PHASES) expect(result.current.fades[p]).toBe(0);
    act(() => { flush(NEUTRAL_MS + SPIN_UP_MS); });
    expect(result.current.activePhase).toBe('thermal');
    expect(result.current.fades.thermal).toBe(1);
  });
  it('a hidden tab (one huge frame gap) lands on the steady target in one frame', () => {
    const { result } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('fluid'); flush(SPIN_UP_MS); });
    act(() => { result.current.triggerTransition('earth'); flush(50); });
    act(() => { flush(60_000); });
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.activePhase).toBe('earth');
    expect(result.current.fades).toEqual({ fluid: 0, thermal: 0, earth: 1, air: 0 });
  });
  it('the first frame after a tap measures from the tap, not from the last transition', () => {
    const { result } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('fluid'); flush(SPIN_UP_MS); });
    nowMs += 10_000; // long idle
    act(() => { result.current.triggerTransition('fluid'); flush(FADE_OUT_MS / 2); });
    expect(result.current.transitionState).toBe('fadeOut');
    expect(result.current.fades.fluid).toBeCloseTo(0.75, 6);
  });
  it('cancels its rAF on unmount', () => {
    const { result, unmount } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('fluid'); });
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mercury/usePhaseTransition.test.js`
Expected: FAIL (old hook boots into fluid, has no `fades`).

- [ ] **Step 3: Write the implementation** (replace the whole file)

```js
import { useRef, useReducer, useCallback, useEffect } from 'react';
import { ELEMENTS, createMachine, request, advance, holdLiquid, activeElement } from './transitionMachine';

export const PHASES = ELEMENTS;

// Thin rAF driver for transitionMachine: re-renders once per animated frame while a transition runs, never at rest.
export default function usePhaseTransition() {
  const machine = useRef(null);
  if (machine.current === null) machine.current = createMachine();
  const lastRef = useRef(0);
  const rafRef = useRef(null);
  const [, forceRender] = useReducer((n) => n + 1, 0);

  const stop = useCallback(() => {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const frame = useCallback(() => {
    const now = performance.now();
    advance(machine.current, now - lastRef.current); // a hidden tab's huge gap resolves the whole sequence here
    lastRef.current = now;
    rafRef.current = machine.current.beat === 'idle' ? null : requestAnimationFrame(frame);
    forceRender();
  }, []);

  const triggerTransition = useCallback((element) => {
    request(machine.current, element);
    if (rafRef.current == null && machine.current.beat !== 'idle') {
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(frame);
    }
    forceRender();
  }, [frame]);

  useEffect(() => stop, [stop]);

  const m = machine.current;
  return {
    activePhase: activeElement(m),
    fades: { ...m.fade },
    transitionState: m.beat,
    holdLiquid: holdLiquid(m),
    triggerTransition,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/mercury/usePhaseTransition.test.js src/terminal/mercury/__tests__/transitionMachine.test.js`
Expected: PASS. Delete `src/terminal/mercury/__tests__/condenseEnvelope.test.js`. The app will not build-consistently until Task 5 rewires the canvas — that is expected; do NOT touch `MercuryCanvas.jsx` here. Run `npx vitest run` and report which failures (if any) are canvas/planet source pins awaiting Task 5; there should be none from this hook's own tests.

- [ ] **Step 5: Commit**

```bash
git add -A src/terminal/mercury/usePhaseTransition.js tests/mercury/usePhaseTransition.test.js src/terminal/mercury/__tests__/condenseEnvelope.test.js src/terminal/mercury/mercuryTuning.js
git commit -m "feat(mercury): usePhaseTransition drives the transition machine — boots neutral, the breath beats are gone"
```

---

### Task 3: planet units — held melt in `mercuryBody`, fade-driven `skyWeights`

**Files:**
- Modify: `src/terminal/mercury/planet/mercuryBody.js` (constants near line 30; `substep` heat/τ block ~lines 128-135; `coolBody` ~140-145; `createBody` ~41-50)
- Modify: `src/terminal/mercury/planet/aetherClock.js:67-85` (`GHOST_OPACITY`, `skyWeights`)
- Test: `src/terminal/mercury/planet/__tests__/mercuryBody.test.js` (append), `src/terminal/mercury/planet/__tests__/aetherClock.test.js` (replace the `skyWeights` describe and the `GHOST_OPACITY` import)

**Interfaces:**
- Produces: `TRANSMUTE_HOLD_S = 1` exported from `mercuryBody.js`; `b.holdLiquid` boolean field (default `false` from `createBody`); `skyWeights(fades, out = [0,0,0,0])` where `fades` is `{fluid,thermal,earth,air}` (missing/undefined `fades` → all 0); `GHOST_OPACITY` export removed.

- [ ] **Step 1: Write the failing tests**

Append to `mercuryBody.test.js` (use its existing imports style; add `MELT_HEAT_K, FREEZE_HEAT_K, TRANSMUTE_HOLD_S, HEAT_LEAK_PER_S, coolBody` to the import if missing):

```js
describe('held liquid (neutral state)', () => {
  const still = (b) => ({ dragging: false, omegaPtr: [0, 0, 0], target: b.q.clone() });
  it('createBody does not hold', () => {
    expect(createBody().holdLiquid).toBe(false);
    expect(TRANSMUTE_HOLD_S).toBe(1);
  });
  it('while held, heat is floored at MELT_HEAT_K and the body stays liquid through a 600 s cool', () => {
    const b = createBody();
    b.holdLiquid = true;
    stepBody(b, 1 / 60, still(b));
    expect(b.heatK).toBeGreaterThanOrEqual(MELT_HEAT_K);
    expect(b.liquid).toBe(true);
    coolBody(b, 600);
    expect(b.heatK).toBeGreaterThanOrEqual(MELT_HEAT_K);
    expect(b.liquid).toBe(true);
  });
  it('the held melt takes τ 0 → 1 in 1 s ± one step', () => {
    const b = createBody();
    b.holdLiquid = true;
    const dt = 1 / 60;
    let t = 0;
    while (b.tau < 1 && t < 5) { stepBody(b, dt, still(b)); t += dt; }
    expect(Math.abs(t - TRANSMUTE_HOLD_S)).toBeLessThanOrEqual(dt + 1e-9);
  });
  it('spin heating still adds heat above the floor while held', () => {
    const b = createBody();
    b.holdLiquid = true;
    b.omega.set(0, 10, 0); // well above HEAT_OMEGA_FLOOR
    stepBody(b, 0.1, { dragging: false, omegaPtr: [0, 0, 0], target: b.q.clone() });
    expect(b.heatK).toBeGreaterThan(MELT_HEAT_K);
  });
  it('released, the heat leaks normally from where it was', () => {
    const b = createBody();
    b.holdLiquid = true;
    stepBody(b, 1 / 60, still(b));
    b.holdLiquid = false;
    const h0 = b.heatK;
    coolBody(b, 10);
    expect(b.heatK).toBeCloseTo(h0 * Math.exp(-HEAT_LEAK_PER_S * 10), 9);
  });
});
```

(Check `createBody`'s body shape first — if angular velocity is not `b.omega` as a THREE.Vector3, use the field the file actually has; read lines 41-60.)

Replace the `skyWeights` describe in `aetherClock.test.js`, and drop `GHOST_OPACITY` from its import:

```js
describe('skyWeights — the mirror shows each element by its fade', () => {
  it('weights equal the fades in CLOCK_PHASES order', () => {
    expect(skyWeights({ fluid: 0, thermal: 0, earth: 1, air: 0 })).toEqual([0, 0, 1, 0]);
    expect(skyWeights({ fluid: 0.3, thermal: 0, earth: 0, air: 0 })).toEqual([0.3, 0, 0, 0]);
  });
  it('neutral (all fades 0) is the quiet dark sky: all weights 0', () => {
    expect(skyWeights({ fluid: 0, thermal: 0, earth: 0, air: 0 })).toEqual([0, 0, 0, 0]);
    expect(skyWeights(null)).toEqual([0, 0, 0, 0]);
  });
  it('normalises when the fades sum above 1', () => {
    const w = skyWeights({ fluid: 1, thermal: 1, earth: 0, air: 0 });
    expect(w).toEqual([0.5, 0.5, 0, 0]);
  });
  it('writes into the out array it is given', () => {
    const out = [9, 9, 9, 9];
    expect(skyWeights({ fluid: 0, thermal: 0, earth: 0, air: 1 }, out)).toBe(out);
    expect(out).toEqual([0, 0, 0, 1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryBody.test.js src/terminal/mercury/planet/__tests__/aetherClock.test.js`
Expected: FAIL (`TRANSMUTE_HOLD_S` undefined; `skyWeights` signature).

- [ ] **Step 3: Implement**

`mercuryBody.js`: after `TRANSMUTE_S`:

```js
export const TRANSMUTE_HOLD_S = 1;     // τ 0 → 1 while neutral holds the planet liquid (3× the spun melt)
```

In `createBody`'s returned object add `holdLiquid: false,` beside `liquid`. In `substep`, replace the heat/τ block with:

```js
  const over = Math.max(0, Math.min(len, MAX_OMEGA) - HEAT_OMEGA_FLOOR);
  b.heatK += (HEAT_GAIN * over * over - HEAT_LEAK_PER_S * b.heatK) * h;
  if (b.heatK > HEAT_CAP_K) b.heatK = HEAT_CAP_K;
  if (b.holdLiquid && b.heatK < MELT_HEAT_K) b.heatK = MELT_HEAT_K; // neutral: held at the melt, spin still heats above it
  if (b.heatK >= MELT_HEAT_K) b.liquid = true;
  else if (b.heatK <= FREEZE_HEAT_K) b.liquid = false;
  const goal = b.liquid ? 1 : 0;
  const stepTau = h / (b.holdLiquid ? TRANSMUTE_HOLD_S : TRANSMUTE_S);
  b.tau = goal > b.tau ? Math.min(goal, b.tau + stepTau) : Math.max(goal, b.tau - stepTau);
```

In `coolBody`, after the decay line:

```js
  if (b.holdLiquid && b.heatK < MELT_HEAT_K) { b.heatK = MELT_HEAT_K; b.liquid = true; }
```

(keep the freeze check after it so a held body never freezes). Update the file's header comment block if it claims liquid only comes from spin — one clause: "or while neutral holds it (holdLiquid)".

`aetherClock.js`: delete `GHOST_OPACITY` and its comment; replace `skyWeights` with:

```js
// Mirror weights in CLOCK_PHASES order: each element by its fade (transitionMachine). Neutral → all 0, the quiet dark
// sky (Sun glint + base mirror). Normalised if a cross-fade ever sums above 1.
export function skyWeights(fades, out = [0, 0, 0, 0]) {
  let sum = 0;
  for (let i = 0; i < CLOCK_PHASES.length; i++) {
    const w = Math.min(Math.max(fades?.[CLOCK_PHASES[i]] ?? 0, 0), 1);
    out[i] = w;
    sum += w;
  }
  if (sum > 1) for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryBody.test.js src/terminal/mercury/planet/__tests__/aetherClock.test.js`
Expected: PASS. `MercuryPlanet.jsx` still calls the old `skyWeights` signature — leave it for Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/mercuryBody.js src/terminal/mercury/planet/aetherClock.js src/terminal/mercury/planet/__tests__/mercuryBody.test.js src/terminal/mercury/planet/__tests__/aetherClock.test.js
git commit -m "feat(mercury): neutral holds the planet liquid (heat floored at the melt, τ in 1 s); mirror sky weights are the fades"
```

---

### Task 4: flows accept `visible` — no draw call, no uniform work when hidden

**Files:**
- Modify: `src/terminal/fluid/ParticleFlow.jsx`, `src/terminal/thermal/ThermalFlow.jsx`, `src/terminal/earth/SedimentFlow.jsx`, `src/terminal/air/AtmosphericFlow.jsx`
- Test: create `src/terminal/mercury/__tests__/flowVisibility.test.js`

**Interfaces:**
- Produces: each flow takes `visible = true` (prop default keeps standalone pages unchanged). `<points … visible={visible}>`. In `useFrame`, immediately after `tickAetherClock(...)`: `if (!visible) return;` — the shared clock still ticks (it is idempotent per frame stamp), but no uniform writes and no FPS counting.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import fluidSrc from '../../fluid/ParticleFlow.jsx?raw';
import thermalSrc from '../../thermal/ThermalFlow.jsx?raw';
import earthSrc from '../../earth/SedimentFlow.jsx?raw';
import airSrc from '../../air/AtmosphericFlow.jsx?raw';

// Neutral state spec: a flow at fade 0 does not draw (three's object visibility) and does no per-frame uniform work
// beyond the shared clock.
describe.each([['ParticleFlow', fluidSrc], ['ThermalFlow', thermalSrc], ['SedimentFlow', earthSrc], ['AtmosphericFlow', airSrc]])('%s visibility', (_, src) => {
  it('takes a visible prop defaulting to true', () => {
    expect(src).toMatch(/\bvisible = true,/);
  });
  it('puts it on the points object', () => {
    expect(src).toMatch(/<points[^>]*visible=\{visible\}/);
  });
  it('skips uniform work right after the clock tick when hidden', () => {
    expect(src).toMatch(/tickAetherClock\([^)]*\);\s*\n\s*if \(!visible\) return;/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/flowVisibility.test.js`
Expected: FAIL ×12.

- [ ] **Step 3: Implement** — in each of the four files: add `visible = true,` to the props destructuring (next to `aetherClock = null,`), add `if (!visible) return;` on the line after `tickAetherClock(clk, state.clock.elapsedTime, delta);` inside `useFrame`, and add `visible={visible}` to the root `<points …>` element (ParticleFlow's root is `<points ref={pointsRef} frustumCulled={false}>`).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/terminal/mercury/__tests__/flowVisibility.test.js src/terminal/fluid src/terminal/thermal src/terminal/earth src/terminal/air src/terminal/mercury/planet/__tests__/flowClock.test.js src/terminal/mercury/planet/__tests__/flowStreak.test.js`
Expected: the new file PASSES; report any pre-existing failures in the others verbatim (only `flowStreak.test.js:76` GHOST_DENSITY pin is expected to change, in Task 5 — it should still pass here).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/fluid/ParticleFlow.jsx src/terminal/thermal/ThermalFlow.jsx src/terminal/earth/SedimentFlow.jsx src/terminal/air/AtmosphericFlow.jsx src/terminal/mercury/__tests__/flowVisibility.test.js
git commit -m "feat(mercury): flows take visible — hidden means no draw call and no uniform work beyond the shared clock"
```

---

### Task 5: wire the canvas, planet, sphere and tab to the fades

**Files:**
- Modify: `src/terminal/mercury/MercuryCanvas.jsx`
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (signature line 279; sky weights ~line 683; body step ~line 503; new FPS counter)
- Modify: `src/terminal/mercury/MercurySphere.jsx` (props, `litPhase`, thread line, node colour)
- Modify: `src/terminal/views/MercuryTab.jsx` (initial `activePhase`, neutral label)
- Modify: `src/terminal/mercury/MercuryControls.jsx` (`PHASE_LABEL` neutral fallback)
- Tests: `src/terminal/mercury/__tests__/neutralWiring.test.js` (create); update pins in `src/terminal/mercury/planet/__tests__/flowStreak.test.js:76` and `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js:49`

**Interfaces:**
- Consumes: Task 2 hook `{ activePhase, fades, transitionState, holdLiquid, triggerTransition }`; Task 3 `skyWeights(fades, out)`, `b.holdLiquid`; Task 4 flow `visible` prop.
- Produces:
  - `MercuryCanvas`: `const { activePhase, fades, holdLiquid, triggerTransition } = usePhaseTransition();`. `onPhaseChange` is called from a `useEffect` on `activePhase` with the element or `null` (NOT from the tap handler — a tap on the lit node now means neutral). `handleNodeTap = (phase) => triggerTransition(phase)`.
  - `const gasFor = (phase) => gasCounts(gasBase, TIERS[TIER].gasDensity, phase === 'thermal');` (no ghost branch; delete `GHOST_DENSITY`).
  - `const opacityFor = (phase) => fades[phase] * ACTIVE_OPACITY;` with `const ACTIVE_OPACITY = 0.45;` (comment: additive blending accumulates fast, the planet must stay legible).
  - Each flow: `visible={fades.<phase> > 0}`, `condense={0}`; delete `condenseFor`; `condenseSizeBite` prop stays. Remove the now-unused `TUNE` import only if nothing else in the file uses it.
  - `MercuryPlanet` new signature: `export default function MercuryPlanet({ isMobile = false, tier = 'full', calm = false, emitters = {}, strikes = null, overlay = false, activePhase = null, aetherClock = null, fades = null, holdLiquid = false, onFps = null }) {` — canvas passes `activePhase`, `fades`, `holdLiquid`, and `onFps={activePhase ? null : onFps}`. Each flow gets `onFps={activePhase === '<phase>' ? onFps : null}` as today.
  - In `MercuryPlanet`'s frame: `body.holdLiquid = holdLiquid;` immediately before `stepBody(...)`; `skyWeights(fades, skyW);`; and an FPS counter in the same shape as ParticleFlow's (two refs, report `Math.round(frames / time)` once per second) when `onFps` is set. `beadCtx.phase = activePhase;` stays — hgBeads' `flowVel` gives zero flow for `null`.
  - `MercurySphere` props become `{ activePhase, activeFade = 0, onNodeTap, onElementFired = null, isMobile = false }`; `litPhase = activePhase` (null → no node lit); node colour = the node's own colour (the `nodeChrome` lerp is removed); the thread line is drawn when `litPhase && activeFade > 0`, full length (`ORBIT_RADIUS`) to the lit node, `opacity={0.7 * activeFade}`. Canvas passes `activeFade={activePhase ? fades[activePhase] : 0}`. Drop `pendingPhase`/`sphereState` everywhere.
  - `MercuryTab`: `useState(null)` for `activePhase`; the header line renders `{activePhase ?? 'neutral'} :: phase active …`. `MercuryControls`: header renders `PHASE_LABEL[activePhase] ?? '// neutral :: liquid'`. Check `CastleGrid`, `ObservationMatrix` and `observationLog.generateEntry` with `activePhase === null` (read them; `PHASE_GLYPHS[null] ?? '◉'` already copes) and add the smallest null fallback only where a `null` would render the literal text "null" or throw.

- [ ] **Step 1: Write the failing tests**

`src/terminal/mercury/__tests__/neutralWiring.test.js`:

```js
import { describe, it, expect } from 'vitest';
import canvasSrc from '../MercuryCanvas.jsx?raw';
import planetSrc from '../MercuryPlanet.jsx?raw';
import sphereSrc from '../MercurySphere.jsx?raw';
import tabSrc from '../../views/MercuryTab.jsx?raw';

describe('MercuryCanvas — neutral state wiring', () => {
  it('has no ghosts: no GHOST_DENSITY, every flow gets the tier counts', () => {
    expect(canvasSrc).not.toMatch(/GHOST_DENSITY/);
    expect(canvasSrc).toContain("const gasFor = (phase) => gasCounts(gasBase, TIERS[TIER].gasDensity, phase === 'thermal');");
  });
  it('opacity is the fade times the active cap, no ghost floor', () => {
    expect(canvasSrc).toContain('const ACTIVE_OPACITY = 0.45;');
    expect(canvasSrc).toContain('const opacityFor = (phase) => fades[phase] * ACTIVE_OPACITY;');
    expect(canvasSrc).not.toMatch(/0\.12/);
  });
  it('every flow is visible only while its fade is above 0, and condenses nothing', () => {
    for (const p of ['fluid', 'thermal', 'earth', 'air']) expect(canvasSrc).toContain(`visible={fades.${p} > 0}`);
    expect(canvasSrc.match(/condense=\{0\}/g)?.length).toBe(4);
    expect(canvasSrc).not.toMatch(/condenseFor|phaseCondense|sphereState|pendingPhase/);
  });
  it('reports the phase from the machine, not from the tap', () => {
    expect(canvasSrc).toMatch(/useEffect\(\(\) => \{\s*onPhaseChange\?\.\(activePhase\);\s*\}, \[activePhase, onPhaseChange\]\);/);
    expect(canvasSrc).toMatch(/const handleNodeTap = useCallback\(\(phase\) => \{\s*triggerTransition\(phase\);\s*\}, \[triggerTransition\]\);/);
  });
  it('hands the planet the fades, the hold and the neutral FPS', () => {
    expect(canvasSrc).toContain('fades={fades}');
    expect(canvasSrc).toContain('holdLiquid={holdLiquid}');
    expect(canvasSrc).toContain('onFps={activePhase ? null : onFps}');
  });
});

describe('MercuryPlanet — neutral state wiring', () => {
  it('sets the hold on the body before stepping it', () => {
    expect(planetSrc).toMatch(/body\.holdLiquid = holdLiquid;\s*\n\s*stepBody\(body,/);
  });
  it('mirror sky weights come from the fades', () => {
    expect(planetSrc).toContain('skyWeights(fades, skyW);');
  });
});

describe('MercurySphere — lit node and thread follow the active element', () => {
  it('lights the active element only and fades the thread with it', () => {
    expect(sphereSrc).toContain('const litPhase = activePhase;');
    expect(sphereSrc).toContain('opacity={0.7 * activeFade}');
    expect(sphereSrc).not.toMatch(/sphereState|pendingPhase|nodeChrome/);
  });
});

describe('MercuryTab — boots neutral', () => {
  it('starts with no active phase and labels it neutral', () => {
    expect(tabSrc).toContain("const [activePhase, setActivePhase] = useState(null);");
    expect(tabSrc).toContain("{activePhase ?? 'neutral'} :: phase active");
  });
});
```

Update the two existing pins to the new code: `flowStreak.test.js:76` → `expect(canvasSrc).toContain("const gasFor = (phase) => gasCounts(gasBase, TIERS[TIER].gasDensity, phase === 'thermal');");` (rename the `it` title if it mentions ghosts), and `mercuryPlanetUniforms.test.js:49` → the new signature line above, verbatim.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/mercury/__tests__/neutralWiring.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement** per the Interfaces block above. Keep comments terse and in the file's voice; remove the comments that describe the deleted ghost/condense/breath behaviour.

- [ ] **Step 4: Run the full suite and lint**

Run: `npx vitest run` then `npm run lint`
Expected: all tests pass; lint 0 errors and warnings ≤ the count before this task. Report both numbers.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/MercurySphere.jsx src/terminal/views/MercuryTab.jsx src/terminal/mercury/MercuryControls.jsx src/terminal/mercury/__tests__/neutralWiring.test.js src/terminal/mercury/planet/__tests__/flowStreak.test.js src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js
git commit -m "feat(mercury): the tab boots neutral — flows follow their fades (no ghosts, hidden at 0), the planet holds liquid, the mirror goes quiet"
```

(Add any other file you had to touch for a null fallback.)

---

### Task 6: live verification + look check (controller)

Run by the controller against the dev server on CDP :5175 (repo's existing live-probe recipe; `window.__mercury` exposes the r3f state). Not a subagent implementation task unless a fix is needed.

- [ ] Boot: gas flows' draw calls are 0 (`__mercury.gl.info.render.calls` vs planet-only baseline; or every flow `points.visible === false`); console errors `[]`.
- [ ] Neutral beat mid-switch (fluid → thermal, sample at ~550 ms): no flow visible.
- [ ] Crust → switch: let the planet freeze (or force τ 0 via dev overrides), tap an element then another; τ reaches 1 within ~1.1 s of the neutral beat starting.
- [ ] Calm still freezes motion (`?calm` / calm toggle) in neutral and with an element.
- [ ] Hide the tab mid-switch (`Page.setWebLifecycleState frozen` or background tab), return: steady target state, no burst.
- [ ] Shots: neutral, mid-fadeOut, neutral beat, mid-spinUp — view them before the author look. If the neutral mirror reads as dead black, add tune `neutralSky` (faint, colourless, slow aether term; 0 allowed) as a follow-up fix task and pick its default in the look check.
