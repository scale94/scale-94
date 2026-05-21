# Dynamic Polarity Shifts

**Date:** 2026-05-21
**Branch:** `main`
**Status:** Spec — approved
**Scope:** After each LatentCollider collision, shift the terminal's ambient background glow to match the collision's polarity class (SOLAR / LUNAR / MERIDIAN / CHAOTIC).

---

## Problem

The terminal is a static black field. Collision results carry a rich polarity signal — SOLAR (warm, projective), LUNAR (cool, reflective), MERIDIAN (balanced), CHAOTIC (high-paradox, divergent) — but nothing in the environment responds to it. The atmosphere should change when the field classifies.

## Goals

1. **Ambient glow on collision.** Each collision result shifts the terminal's background to a subtle radial gradient matching the polarity class. Barely perceptible — environmental, not a UI element.
2. **CHAOTIC as a real state.** When `paradoxCount >= 2`, polarity is overridden to `CHAOTIC` (crimson). Overrides SOLAR/LUNAR/MERIDIAN regardless of top/base intensity comparison.
3. **Persists until next collision.** The terminal holds the ambient state — no auto-fade, no reset on tab switch.
4. **Single overlay div.** One fixed, pointer-events-none `<div>` in App.jsx root. No new components.

## Non-Goals

- No glow on non-Scaling tabs (glow only fires from LatentCollider, but persists globally once set)
- No animation beyond CSS `transition` — no keyframes, no JS timers
- No glow reset when navigating away from Scaling tab
- No glow on failed/invalid collisions

---

## Architecture

### Data Flow

```
LatentCollider.jsx  →  ScalingTab.jsx  →  App.jsx
  fires onPolarity()     passes through     holds lastPolarityClass state
  on each collision                         renders overlay div
```

Same prop-lift pattern as `lastKernelAt` (eye observer).

### Polarity Glow Map — `POLARITY_GLOW` constant in `App.jsx`

```js
const POLARITY_GLOW = {
  SOLAR:    'rgba(255,215,0,0.13)',
  LUNAR:    'rgba(196,181,255,0.12)',
  MERIDIAN: 'rgba(6,182,212,0.10)',
  CHAOTIC:  'rgba(255,40,80,0.14)',
};
```

Defined in App.jsx only — not imported from LatentCollider, no cross-file coupling.

### Overlay Div — in `App.jsx` return, after CRT overlay

```jsx
{/* ── Polarity ambient glow ────────────────────────────────────────────── */}
<div
  aria-hidden="true"
  style={{
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1,
    background: lastPolarityClass
      ? `radial-gradient(ellipse 80% 60% at 50% 100%, ${POLARITY_GLOW[lastPolarityClass]} 0%, transparent 70%)`
      : 'none',
    opacity: lastPolarityClass ? 1 : 0,
    transition: 'opacity 1.5s ease, background 1.5s ease',
  }}
/>
```

Always in the DOM. `opacity: 0` until first collision. `zIndex: 1` — above the solid black background, below all content.

### State in `App.jsx`

```js
const [lastPolarityClass, setLastPolarityClass] = useState(null);
```

Added after `lastKernelAt`.

Passed to ScalingTab:
```jsx
<ScalingTab
  ...
  onPolarity={setLastPolarityClass}
/>
```

### ScalingTab.jsx — pass-through

```jsx
// Destructure new prop:
function ScalingTab({ ..., onPolarity }) {

// Pass to LatentCollider:
<LatentCollider
  ...
  onPolarity={onPolarity}
/>
```

### LatentCollider.jsx — two changes

**1. CHAOTIC override in `classifyAccord()`** (after `paradoxCount` is computed, before the SOLAR/LUNAR/MERIDIAN ternary):

```js
function classifyAccord(result) {
  if (!result) return null;
  const paradoxCount = result.paradoxes?.length || 0;

  const topIntensity   = result.ockTop;
  const heartIntensity = result.ockHeart;
  const baseIntensity  = result.ockBase;

  // ...existing OCK classification...

  // CHAOTIC override: high paradox count supersedes SOLAR/LUNAR/MERIDIAN
  let ockPolarityClass = topIntensity > baseIntensity ? 'SOLAR'
    : baseIntensity > topIntensity ? 'LUNAR'
    : 'MERIDIAN';
  if (paradoxCount >= 2) ockPolarityClass = 'CHAOTIC';

  // ...rest of classifyAccord...
}
```

**2. Fire `onPolarity` after accord is resolved** — two call sites, mirroring where `onKernelRun` fires:

*WASM path* (after `parsed.accord` is destructured):
```js
onPolarity?.(parsed.accord.polarityClass);
```

*JS fallback path* (after `ockPolarityClass` is assigned inline):
```js
onPolarity?.(ockPolarityClass);
```

`onPolarity` is optional-chained (`?.`) so LatentCollider doesn't break if the prop is absent.

---

## Files Affected

| File | Status | Change |
|---|---|---|
| `src/terminal/App.jsx` | Modify | `lastPolarityClass` state + `POLARITY_GLOW` map + overlay div + `onPolarity` prop on `ScalingTab` |
| `src/terminal/views/ScalingTab.jsx` | Modify | Accept `onPolarity` prop, pass to `LatentCollider` |
| `src/terminal/views/LatentCollider.jsx` | Modify | `CHAOTIC` override in `classifyAccord()` + `onPolarity?.()` at two call sites |

---

## Visual Spec

| State | Color | Radial opacity | Meaning |
|---|---|---|---|
| SOLAR | `rgba(255,215,0,0.13)` | 13% | Top-notes dominate; warm, projective |
| LUNAR | `rgba(196,181,255,0.12)` | 12% | Base-notes dominate; cool, reflective |
| MERIDIAN | `rgba(6,182,212,0.10)` | 10% | Balanced; axial, transitional |
| CHAOTIC | `rgba(255,40,80,0.14)` | 14% | paradoxCount ≥ 2; unstable, divergent |

**Shape:** `radial-gradient(ellipse 80% 60% at 50% 100%)` — wide ellipse, bottom-center origin, fades to transparent at 70%.

**Transition:** `opacity 1.5s ease, background 1.5s ease` — smooth crossfade between states.

**z-index:** `1` — above black background, below all content layers.

---

## Edge Cases

| Case | Behavior |
|---|---|
| First load, no collision yet | `lastPolarityClass = null`, overlay `opacity: 0` — no glow |
| Two collisions in rapid succession | Second `onPolarity` call overwrites state; CSS transition handles crossfade |
| `paradoxCount = 1` | Normal SOLAR/LUNAR/MERIDIAN — CHAOTIC threshold not met |
| `paradoxCount >= 2` with SOLAR dominance | CHAOTIC overrides SOLAR |
| Tab switch away from Scaling | Glow persists — last state holds |
| `onPolarity` prop missing | Optional-chain `?.()` — no throw, no glow |
