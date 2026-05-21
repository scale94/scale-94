# Eye Observer — Kernel Signal + Color Realignment

**Date:** 2026-05-21
**Branch:** `nightly-20260520` (continuation)
**Status:** Spec — pending user review
**Scope:** Two-part polish to `MercuryEyeIndicator`: (1) color realignment to Fade Doctrine two-gold palette, (2) subtle observation behavior reacting to kernel runs.

---

## Problem

The ◉ eye glyph in the top-right corner of Mercury Terminal is visually and behaviorally inert:

1. **Color mismatch:** It uses `#FFD700` (pure CSS gold, fully saturated) while the header and ScalingTab's Fade Doctrine uses `#e8d28a` / `#d4a82a` (aged-gold, low saturation). The eye reads as a game-UI element rather than belonging to the site's typographic register.

2. **Mobile fade ignored:** The header fades out via `transition-opacity` + `opacity-0` on mobile (when `mobileChrome` is false). The eye is `fixed z-[80]` and stays fully visible — it floats over a blank screen rather than fading with the frame it belongs to.

3. **No observation:** The eye is static — it breathes on a fixed 11s cycle regardless of what the user does. The alien architect's eye should register that kernels are being run. Its comment even notes it "deliberately does NOT track… user input" — this spec changes that decision for kernel runs specifically.

## Goals

1. **Color alignment.** Eye uses Fade Doctrine palette throughout.
2. **Fade sync.** Eye participates in the header's mobile opacity transition.
3. **Kernel awareness.** Eye reacts subtly when the user submits a kernel command — a brief flare, then settles. After long quiet, dims to patient presence.

## Non-Goals

- No mouse tracking or cursor following.
- No reaction to tab switches, typing, or scrolling.
- No reaction to failed commands — only successful kernel runs (the `kernelRunHistoryRef` push path).
- No user-facing label or tooltip change.
- No structural repositioning of the eye (stays `fixed`).

## Architecture

### Color Realignment — `MercuryEyeIndicator.jsx`

Replace every `#FFD700` and `rgba(255,215,0,…)` occurrence with Fade Doctrine values:

| Usage | Before | After |
|---|---|---|
| Glyph color (default) | `#FFD700` | `#e8d28a` |
| Glyph color (active/Mercury) | `#FFD700` | `#d4a82a` |
| Glow shadow alpha base | `rgba(255,215,0,…)` | `rgba(232,210,138,…)` |
| Tooltip text color | `rgba(255,215,0,0.75)` | `rgba(232,210,138,0.75)` |
| Tooltip subtext color | `rgba(255,215,0,0.4)` | `rgba(232,210,138,0.4)` |

Updated keyframe values:

```css
@keyframes mei-breath {
  0%, 100% { opacity: 0.28; text-shadow: 0 0 6px rgba(232,210,138,0.20); }
  50%      { opacity: 0.58; text-shadow: 0 0 14px rgba(232,210,138,0.50), 0 0 4px rgba(232,210,138,0.35); }
}
@keyframes mei-breath-active {
  0%, 100% { opacity: 0.72; text-shadow: 0 0 18px rgba(212,168,42,0.65),  0 0 6px rgba(212,168,42,0.40); }
  50%      { opacity: 0.95; text-shadow: 0 0 30px rgba(212,168,42,0.90),  0 0 10px rgba(212,168,42,0.65); }
}
@keyframes mei-breath-deep {
  0%, 100% { opacity: 0.15; text-shadow: 0 0 4px rgba(232,210,138,0.12); }
  50%      { opacity: 0.38; text-shadow: 0 0 10px rgba(232,210,138,0.30); }
}
@keyframes mei-flare {
  0%   { opacity: 0.95; text-shadow: 0 0 28px rgba(232,210,138,0.85), 0 0 8px rgba(232,210,138,0.55); }
  35%  { opacity: 0.82; text-shadow: 0 0 20px rgba(232,210,138,0.65); }
  100% { opacity: 0.28; text-shadow: 0 0 6px rgba(232,210,138,0.20); }
}
```

(`mei-flare` animates to the breath-floor values so the transition into `mei-breath` is seamless.)

### Mobile Fade Sync — `App.jsx` + `MercuryEyeIndicator.jsx`

**App.jsx:** Pass `mobileChrome` to the eye:

```jsx
<MercuryEyeIndicator
  activeTab={activeTab}
  onNavigate={() => handleNav('~/system/mercury', 'mercury')}
  mobileChrome={mobileChrome}
  lastKernelAt={lastKernelAt}
/>
```

**MercuryEyeIndicator.jsx:** Accept `mobileChrome` prop. Apply same fade class to the outer wrapper:

```jsx
export default function MercuryEyeIndicator({ activeTab, onNavigate, mobileChrome, lastKernelAt }) {
  // ...
  return (
    <div
      className={`fixed top-3 right-3 sm:top-4 sm:right-4 z-[80] select-none cursor-pointer group transition-opacity duration-500 ${!mobileChrome ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : ''}`}
      // ...
    >
```

### Kernel Observation — Signal Threading

**App.jsx:**

Add state near other refs/state:

```js
const [lastKernelAt, setLastKernelAt] = useState(null);
```

Thread into the dispatch context alongside `kernelRunHistoryRef`:

```js
const dispatchCommand = useCommandDispatch({
  // ... existing context ...
  kernelRunHistoryRef,
  onKernelRun: setLastKernelAt,
});
```

**`useCommandDispatch.js`:**

Destructure `onKernelRun` from `ctxRef.current`. Immediately after each of the two `kernelRunHistoryRef?.current?.push(…)` calls, add:

```js
onKernelRun?.(Date.now());
```

(Both existing push call sites — one on the normal path, one on the alternate branch — get this addition.)

### Kernel Observation — Eye Component

**`MercuryEyeIndicator.jsx`:**

```jsx
import React, { useState, useEffect, useRef } from 'react';

export default function MercuryEyeIndicator({ activeTab, onNavigate, mobileChrome, lastKernelAt }) {
  const isOnMercury = activeTab === 'mercury';
  const [flaring, setFlaring] = useState(false);
  const [deepWatch, setDeepWatch] = useState(true); // starts in deep-watch (no runs yet)
  const prevKernelAt = useRef(null);

  // Flare on new kernel run
  useEffect(() => {
    if (!lastKernelAt || lastKernelAt === prevKernelAt.current) return;
    prevKernelAt.current = lastKernelAt;
    setFlaring(true);
    setDeepWatch(false);
    const t = setTimeout(() => setFlaring(false), 1800);
    return () => clearTimeout(t);
  }, [lastKernelAt]);

  // Deep-watch: 90s after last kernel run (or on first mount if no run yet)
  useEffect(() => {
    const elapsed = lastKernelAt ? Date.now() - lastKernelAt : Infinity;
    if (elapsed >= 90_000) { setDeepWatch(true); return; }
    const remaining = 90_000 - elapsed;
    const t = setTimeout(() => setDeepWatch(true), remaining);
    return () => clearTimeout(t);
  }, [lastKernelAt]);

  // Animation priority: flare > active > deep-watch > idle
  const animation = flaring
    ? 'mei-flare 1.8s ease-out forwards'
    : isOnMercury
      ? 'mei-breath-active 8s ease-in-out infinite'
      : deepWatch
        ? 'mei-breath-deep 14s ease-in-out infinite'
        : 'mei-breath 11s ease-in-out infinite';

  return (
    <div
      className={`fixed top-3 right-3 sm:top-4 sm:right-4 z-[80] select-none cursor-pointer group transition-opacity duration-500 ${!mobileChrome ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : ''}`}
      onClick={onNavigate}
      role="button"
      aria-label="Open Mercury — observer view"
      title="◉ OBSERVER :: alien architect engaged"
    >
      {/* ... keyframes ... */}
      <div
        className="text-[18px] sm:text-[20px] leading-none font-black transition-transform duration-300 group-hover:scale-110"
        style={{
          color: isOnMercury ? '#d4a82a' : '#e8d28a',
          animation,
        }}
      >
        ◉
      </div>
      {/* Tooltip unchanged except colors updated */}
    </div>
  );
}
```

**Initial state is `deepWatch: true`** — on first page load, before any kernel runs, the eye is already in patient-watching mode. This is intentional: the eye starts dim, observing before the visitor does anything.

### Animation State Summary

| State | Condition | Keyframe | Duration | Opacity range |
|---|---|---|---|---|
| `flare` | `lastKernelAt` just changed | `mei-flare` | 1.8s (forwards) | 0.95 → 0.28 |
| `active` | On Mercury tab | `mei-breath-active` | 8s infinite | 0.72 → 0.95 |
| `deep-watch` | >90s since last run | `mei-breath-deep` | 14s infinite | 0.15 → 0.38 |
| `idle` | Default (0–90s after run) | `mei-breath` | 11s infinite | 0.28 → 0.58 |

Priority (highest to lowest): flare → active → deep-watch → idle.

## Files Affected

| File | Status | Change |
|---|---|---|
| `src/terminal/components/MercuryEyeIndicator.jsx` | Modify | Color realignment, fade sync props, kernel observation state + animations |
| `src/terminal/App.jsx` | Modify | Add `lastKernelAt` state, pass `mobileChrome` + `lastKernelAt` + `onKernelRun` |
| `src/terminal/hooks/useCommandDispatch.js` | Modify | Destructure `onKernelRun`, call after each `kernelRunHistoryRef.current.push` |

## Edge Cases

| Case | Behavior |
|---|---|
| User opens terminal, never runs a kernel | Eye starts and stays in `deep-watch` (dim, 14s breath) — correct, it's patient |
| User runs kernel on Mercury tab | `flare` fires first (1.8s), then `active` (8s) takes over — correct priority |
| User runs many kernels in quick succession | Each new `lastKernelAt` restarts the flare + resets the 90s deep-watch timer |
| `mobileChrome` is undefined (future call sites) | Falsy → `opacity-0` applied — conservative default, same as header |
| `onKernelRun` not provided to dispatch | Optional chaining `onKernelRun?.(Date.now())` — silent no-op |

## Voice/Design Notes

The deep-watch state (opacity 0.15–0.38, 14s cycle) is deliberately near-invisible. It rewards visitors who notice the eye has dimmed since they last ran a kernel. The flare (opacity surge to 0.95) is the eye briefly sharpening focus — acknowledging the run — before returning to breath. Neither state announces itself. The observation is real but unhurried.
