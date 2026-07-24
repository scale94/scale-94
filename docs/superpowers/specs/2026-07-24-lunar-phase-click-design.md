# Lunar phase-click → moon travels to that phase — design

**Date:** 2026-07-24
**Status:** approved, not started
**Branch:** `feature/lunar-shader-moon` (rides on the shader moon; nothing merged yet)
**Depends on:** the Phase 2 shader moon (this is what makes the travel worth watching)

---

## 1. What this is

Clicking one of the eight moon-phase glyphs under the moon makes the moon
**travel** to that phase — visibly waxing/waning, librating, and swelling across
the arc — instead of only selecting a fragrance accord as it does today.

## 2. The one idea

The moon already renders `currentAge`, and
`currentAge = isScrubbing ? scrubAge : liveAge`. Everything else on the tab —
the shader's `uAge`, the libration/perigee `moonTimestamp`, the illumination
readout, the environmental params, the doctrine register, and the scrub slider
thumb — already follows `currentAge`.

So "click a phase → moon travels there" is nothing more than **animating
`scrubAge` from its current value to the clicked phase's age.** One clock moves,
and the whole tab moves with it, exactly as a fast scrub-drag already does. No
new age state, no second clock, no decoupling.

This was chosen over two rejected alternatives:
- *Move only the moon's `uAge`* — the moon would then disagree with the readout
  beside it (moon full, readout "day 3.2, 12% illuminated"). Adds a second age.
- *Move the moon + readouts but not the register* — splits the shared clock in
  two; the moon and the register would tell different times.

## 3. Data flow

1. Click a glyph → `PhaseSelector` calls `onSelectPhase(phaseId)` (unchanged).
2. A combined handler in `LunarTab` sets `selectedPhaseId` (the accord follows,
   as today) **and** starts a tween toward that phase's representative age.
3. `usePhaseJump` eases `scrubAge` from the current age to the target over
   **~0.8 s** along the **shortest wrapped path**, `requestAnimationFrame`-driven,
   `easeInOutCubic`, wrapping each frame into `[0, SYNODIC_PERIOD)`.
4. On the way the moon phases, librates, and swells; the readout counts; the
   register recomputes — all live off `currentAge`, identical to a scrub-drag.
5. Lands exactly on the target age. `↺ return to now` (already present while
   scrubbing) resets to live time.

## 4. Representative age per phase

`repAge(phaseIndex) = phaseIndex * SYNODIC_PERIOD / 8`.

These are the illumination-defining points of each phase, and every one lands
inside its own `getPhase` band (verified against `synodic.js` PHASES), so
`getPhase(repAge(i)) === PHASES[i].id` for all eight:

| phase | index | repAge (d) | getPhase band | lit |
| :--- | :--- | ---: | :--- | :--- |
| new | 0 | 0.000 | [0, 1.11] | 0% |
| waxing-crescent | 1 | 3.691 | [1.11, 6.38] | ~25% |
| first-quarter | 2 | 7.383 | [6.38, 8.77] | 50% |
| waxing-gibbous | 3 | 11.074 | [8.77, 13.65] | ~75% |
| full | 4 | 14.765 | [13.65, 15.88] | 100% |
| waning-gibbous | 5 | 18.457 | [15.88, 20.76] | ~75% |
| last-quarter | 6 | 22.148 | [20.76, 23.15] | 50% |
| waning-crescent | 7 | 25.839 | [23.15, 29.53] | ~25% |

Because `getPhase(repAge) === phaseId`, the auto-sync effect at
`LunarTab.jsx:798` (which pulls `selectedPhaseId` toward `currentPhase.id`) never
fights the click — the age and the selection agree on arrival.

## 5. Shortest wrapped path

`shortestWrappedDelta(from, to, period)` returns the signed delta in
`[-period/2, +period/2]`. The tween interpolates `from + t·delta` and wraps into
`[0, period)`.

Consequence: clicking "new" from day 27 waxes **forward** through 29.53 → 0
(2.5 days of travel), not backward across 27 days. Clicking the opposite side of
the wheel (~half a cycle away) may go either direction; ties resolve forward.

## 6. Edge cases

- **Re-click mid-travel:** cancel the running tween and start a new one from the
  current interpolated age — no snap, no queue.
- **Click the phase the moon is already at:** delta ≈ 0, no visible motion; the
  accord/info still update.
- **`prefers-reduced-motion`:** snap `scrubAge` straight to the target, no tween
  — consistent with the shader moon's own reduced-motion handling.
- **Unmount / tab-away during a tween:** cancel the rAF in cleanup.
- **Interaction with a live drag:** starting a tween sets `scrubAge` (enters
  scrub mode); a subsequent manual drag cancels any in-flight tween (the drag
  owns `scrubAge` from that point).

## 7. Files

| file | role |
| :--- | :--- |
| `lunar/phaseJump.js` | pure — `shortestWrappedDelta`, `repAgeForPhase`, `easeInOutCubic` |
| `lunar/usePhaseJump.js` | thin hook — runs the rAF tween, honors reduced-motion, cancels on unmount |

`LunarTab.jsx` gains: the `usePhaseJump` hook wired to `setScrubAge`, and a
combined `onSelectPhase` handler that sets `selectedPhaseId` and calls
`jumpToPhase(phaseId)`. `PhaseSelector` is **unchanged** — it already emits the
phase id on click and long-press.

The pure module holds everything testable; the hook stays thin so `LunarTab`
(already large) grows by only a wire-up.

## 8. Testing

`phaseJump.test.js` (pure)
- `shortestWrappedDelta`: forward-shorter, backward-shorter, exact-half (ties
  forward), across the 0/period seam, `from === to` → 0
- `repAgeForPhase`: `getPhase(repAgeForPhase(id)) === id` for all eight phases
- `easeInOutCubic`: `f(0)===0`, `f(1)===1`, monotonic, symmetric about 0.5

`usePhaseJump.test.jsx` (hook, jsdom + fake timers / rAF stub)
- calling `jumpToPhase` drives the setter toward the target and reaches it
- `prefers-reduced-motion` → one setter call at the exact target, no tween
- re-invoking mid-tween retargets from the current value (no snap-back)
- unmount cancels the rAF (no setter calls after unmount)

Browser (GPU-CDP, per the shader-moon recipe)
- click each of the eight glyphs; confirm the moon animates to the correct
  phase and the illumination readout + register land consistently
- confirm the scrub slider thumb animates along, and `↺ return to now` resets

## 9. Out of scope

- Changing what the accord selection or the info popover do (unchanged).
- Any new decoupled moon age (rejected in §2).
- Reworking `PhaseSelector` (untouched).
- The mare-shape sub-branch and the earthshine/corona tuning (separate work).
