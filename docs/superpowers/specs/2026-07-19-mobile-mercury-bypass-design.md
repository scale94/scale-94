# Mobile Mercury Sphere + 7-Tap Bypass

2026-07-19

## Problem

The mobile kernel tab has carried a placeholder since the Mercury WebGL sphere
and the 7-tap bypass egg were built: a 2D-canvas mini-sphere under the
axiomatic-law text ([KernelTab.jsx:589-592](../../../src/terminal/views/KernelTab.jsx#L589)),
driven by an ad hoc `sphereFireRef` burst system. It was deliberately kept
lightweight — two prior specs recorded this as a non-goal, not an oversight:

- [2026-07-17-mercury-terminator-design.md](2026-07-17-mercury-terminator-design.md):
  *"Desktop-exclusive... the WebGL planet doesn't even mount below 768px."*
- [2026-07-18-mercury-kernel-bypass-design.md](2026-07-18-mercury-kernel-bypass-design.md):
  *"No mobile trigger... Mobile keeps the ceremony."*

Both are reversed here, deliberately. The project has scaled well past what the
2D placeholder can carry, and the 7-tap bypass — the one hidden gesture that
hands a visitor a real, deployable system prompt — belongs on mobile as much as
desktop.

## Goal

Replace the mobile mini-sphere with the real `MercuryTerminator` (the same
WebGL day/night-terminator component the desktop Mercury already uses), and
wire the existing 7-tap bypass gesture to it, matching desktop behavior
exactly: one tap navigates to Mercury, seven taps inside a 3s window unlocks
the hidden kernel.

## Non-goals

- No new visual design for `MercuryTerminator` itself — reused as-is.
- No new gesture logic — `useSevenTaps` is reused as-is, same shared instance
  the desktop sphere already uses.
- No change to desktop behavior or layout.

## Design

### Component swap

In [KernelTab.jsx](../../../src/terminal/views/KernelTab.jsx), the mobile
canvas block is replaced with a second `MercuryTerminator` instance, gated
`!isDesktop &&` — the mirror image of the existing `isDesktop &&` gate on the
desktop instance (line 596). This preserves the single-mount discipline that
gate exists for: exactly one WebGL Mercury context is ever mounted, matching
the current viewport. Both instances read the same `twilight`, `day`, `flare`
already produced once by `useCompileFrontier(kernelBuilds.length)` at the top
of the component — there is only one compile-frontier state, rendered twice.

The mobile instance passes `onClick={mercuryTaps.onTap}` — the same
`mercuryTaps` object already constructed at line 235 for the desktop sphere.
Gesture state (tap counter, countdown, unlock) is shared across breakpoints;
since only one instance is ever mounted, there's no dual-gesture conflict to
resolve. `MercuryTapToast` renders beside the mobile sphere too, inside a
`position: relative` wrapper div (the toast is `absolute right-0 top-full`).

Default size: 120px, matching the current mini-sphere's rendered footprint
(`style={{ width: 120, height: 120 }}`). Not treated as final — sized by eye
once live in the browser.

### Deletion

The swap makes the following dead code, removed in the same change:

- `useMiniSphere` (the 2D canvas particle-burst renderer, ~130 lines)
- `sphereCanvasMobileRef`, `sphereFireRef`
- every `sphereFireRef.current = { ts: Date.now() }` call site (kernel-list
  item click, `[load]`, `[run]`, forge-anew, quintessence compile, and the
  `loadingKernel` spin-stop effect)

These existed solely to manually trigger the old canvas's burst on kernel
actions. `MercuryTerminator`'s `flare` prop already reacts to the same
`kernel_loaded` / `kernel_completed` observatory-bus events automatically
(via `useCompileFrontier`), so nothing needs to be re-plumbed to preserve that
reactivity — it transfers for free.

`toMercury()` (line 232) drops its `sphereFireRef` assignment and becomes a
direct call to `onNavigateToMercury`.

### Docs

This spec supersedes the "no mobile shader" non-goal in the mercury-terminator
spec and the "no mobile trigger" non-goal in the mercury-kernel-bypass spec.
Those files are left as historical record; this spec is the record of the
reversal.

## Testing

No existing unit tests cover `KernelTab.jsx` (it's a view, not a hook); the
hooks this change reuses (`useSevenTaps`, `useCompileFrontier`) already have
their own test coverage and are untouched. Verification is manual, in the
browser, per the project's standing art-project calibration (reasonable
confidence to ship, not exhaustive proof):

- Mobile viewport (< 768px): Mercury sphere renders in place of the old
  canvas, in the same document position.
- Single tap navigates to the Mercury tab (existing `onNavigateToMercury`
  behavior, unchanged).
- Seven taps inside 3s pops the countdown toast down to the bright unlock
  copy and calls `unlockMercuryKernel()`.
- Desktop viewport (≥ 768px): unchanged — only one `MercuryTerminator`
  mounts at a time, verified via network/WebGL-context inspection if needed.
