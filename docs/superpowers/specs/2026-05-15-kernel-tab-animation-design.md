# KernelTab Animation Pass — Design Spec
**Date:** 2026-05-15
**Scope:** KernelTab only. Two targeted effects.

---

## Overview

Two CSS-only animation effects added to KernelTab. No new dependencies. No layout shifts. No JS animation loops. Both effects are GPU-composited (opacity + filter + border-color + box-shadow).

---

## Effect 1 — Log Line Entry: White Flash → Color Resolve

### What
Every new line appended to the tty0 log panel fires a brief white-flash entry animation and resolves to its signal color.

### Why this approach
`filter: brightness()` is used instead of `color: #fff` so the keyframe is color-agnostic — it works identically for green (`#39ff14`) and rust (`#34d399`) lines without branching. `brightness(8)` on neon green renders visually as white. This satisfies the Fade Doctrine: white is a transition state, never a resting state.

### Keyframe

```css
@keyframes sk-logFlashIn {
  0%   { opacity: 0; filter: brightness(8); }
  12%  { opacity: 1; filter: brightness(5); }
  100% { opacity: 1; filter: brightness(1); }
}
```

**Duration:** `280ms ease-out both`

### Implementation

Add `style={{ animation: 'sk-logFlashIn 280ms ease-out both' }}` to the log entry `div` in `visibleLogs.map()` (KernelTab.jsx ~line 770).

No state changes needed. The existing `key={\`${l.time}-${i}\`}` guarantees each new entry is a fresh DOM node — React remounts it, the animation fires automatically.

### Touch points
- `KernelTab.jsx` — one `style` prop on the log entry `div`
- `KernelTab.jsx` — one new `@keyframes sk-logFlashIn` block in the inline `<style>` tag

---

## Effect 2 — Kernel Completion: Instant Cyan Snap → Green Settle

### What
When a kernel finishes running, its card border fires an instant bright-cyan flash and settles permanently to a resting green — providing at-a-glance completion state legible via peripheral vision without reading any text.

### Timing (user-specified)
- **Pulse in:** 0ms — instant, no ease-in. Electrical, not cinematic.
- **Settle:** 120ms linear to resting green.
- **Fill mode:** `forwards` — green border persists permanently after animation ends.

### Keyframe

```css
@keyframes sk-completionPulse {
  0% {
    border-color: rgba(6,182,212,1);
    box-shadow: 0 0 22px rgba(6,182,212,0.5), inset 0 0 20px rgba(6,182,212,0.08);
  }
  100% {
    border-color: rgba(57,255,20,0.35);
    box-shadow: 0 0 6px rgba(57,255,20,0.12);
  }
}
```

**Duration:** `120ms linear forwards`

### State tracking

Add `completedKernels` — a `Set<string>` held in React state — alongside the existing `loadingKernel` effect. When `loadingKernel` transitions from a kernel → `null`, the departing kernel's `id` is added to `completedKernels`. This fires alongside the already-existing `sphereFireRef` particle burst trigger.

```js
// Inside the existing loadingKernel useEffect, in the else-if branch:
setCompletedKernels(prev => new Set(prev).add(prevKernelRef.current.id));
```

Each kernel card checks `completedKernels.has(kernel.id)` and applies the animation:

```jsx
style={{
  animation: completedKernels.has(kernel.id)
    ? 'sk-completionPulse 120ms linear forwards'
    : undefined,
}}
```

Because `forwards` holds the final keyframe values, the green border persists as long as the card is rendered. The `completedKernels` Set grows monotonically — kernels don't leave it unless a full reset occurs.

### Touch points
- `KernelTab.jsx` — `useState` for `completedKernels`
- `KernelTab.jsx` — one `setCompletedKernels` call in the existing `loadingKernel` `useEffect`
- `KernelTab.jsx` — one conditional `animation` style on each kernel card
- `KernelTab.jsx` — one new `@keyframes sk-completionPulse` block in the inline `<style>` tag

---

## Performance contract

| Property animated | Compositor-only? | Layout? | Paint? |
|-------------------|-----------------|---------|--------|
| `filter: brightness()` | Yes | No | No |
| `opacity` | Yes | No | No |
| `border-color` | Yes (color only) | No | No |
| `box-shadow` | Yes | No | No |

All four properties are handled by the GPU compositor. Zero layout shifts. Zero expensive repaints.

---

## Files changed

| File | Change |
|------|--------|
| `src/terminal/views/KernelTab.jsx` | Add `completedKernels` state; update `loadingKernel` effect; add `style` to log entry div; add `style` to kernel card; add 2 keyframes to inline `<style>` |

No other files touched.
