# Council Ring — Mobile Interaction Parity — Design Spec

**Date:** 2026-07-08
**Branch:** new branch off main (`feat/council-ring-mobile-parity`)
**Status:** Approved; ready for implementation planning
**Predecessor:** `2026-07-06-council-synthesis-engine-design.md` (shipped, merged to main)
**Supersedes:** predecessor's Non-goal #2 — *"No mobile selection/synthesis interactions — mobile keeps the crosshair wheel; only the §7 clipping fixes apply to mobile."* That decision is reversed by this spec.

## Overview

Mobile's Council Ring currently renders a different interaction entirely from desktop: a "crosshair wheel" where the user drags to rotate the full torus under a fixed crosshair, with a telemetry panel below showing whichever mind is currently under it. The torus itself is intentionally cropped left/right (`width: 200%; margin-left: -50%` inside `overflow: hidden` — a "porthole reveal" per the existing code comment at `CouncilRing.jsx:72`), and tapping the telemetry panel only opens a read-only dossier. There is no arm/fire, no collision, and no synthesis panel on mobile.

This spec replaces that mobile-only interaction with the same tap-to-arm/fire mechanic, full state machine, and synthesis panel that desktop already has — scaled and adapted for touch and narrow viewports, not reimplemented. The torus renders uncropped at any viewport width.

## Goals

1. Mobile users can tap two minds to arm and fire a collision, identical in mechanic to desktop's click-to-arm/click-to-fire.
2. The full torus (ring scaffold + all 16 nodes) is visible without horizontal cropping at any mobile viewport width.
3. Touch targets on ring nodes are at least 44×44px, without enlarging the visible node dot.
4. The full synthesis breakdown (`CouncilSynthesisPanel`, all four sections) renders below the ring on mobile, in the same scroll — not a separate view or takeover.
5. Reuse the existing state machine (`useCouncilCollider`), ledger (`councilLedger`), and synthesis engine (`councilSynthesis`) unchanged — this is a rendering/layout change on the mobile branch of `CouncilRing.jsx`, not a new pipeline.

## Non-goals (this phase)

- No changes to `councilSynthesis.js`, `councilLedger.js`, or the state machine's transition logic — all viewport-agnostic already, confirmed by the predecessor spec.
- No new content or copy in `CouncilSynthesisPanel.jsx` — its four sections already match this feature's requirements; only its container layout is affected (by removing any desktop-only assumptions, of which none were found).
- No mode toggle between "wheel" and "select" (the rotate-wheel interaction is removed outright, not preserved as an option).
- No changes to desktop layout, breakpoints, or the `isNarrow` (<1200px) stacked-sidebar behavior — mobile now simply falls into that existing branch rather than getting its own.

---

## 1 · Mobile ring rendering

- Remove the `isMobile` early-return branch in `CouncilRing.jsx` (current lines 168–211) — the rotation-drag state (`rotation`, `dragRef`, `onTouchStart/Move/End`), the crosshair overlay, and the fixed-height telemetry panel all go with it.
- Remove the `useIsMobile()` gate on the collider (`enabled: !isMobile` at `CouncilRing.jsx:107`) — the state machine runs on all viewports.
- Mobile now renders the same JSX the desktop branch does today: canvas (particle layer) under an SVG with `viewBox="-170 0 980 640"`, `width: 100%; height: auto`, containing `RingScaffold` and the mapped `Node` list.
- Because the viewBox is fixed and the SVG scales via `width: 100%`, the full torus fits any container width — this is what eliminates the crop; no new scaling logic is needed beyond what desktop already does.
- `useIsMobile()` itself is deleted if nothing else references it (confirm via grep during implementation); `useIsNarrow()` (<1200px) stays and now governs mobile too, since mobile is always narrow.

## 2 · Touch targets

- `Node` (`CouncilRing.jsx:59-88`) gains a transparent sibling hit-target: a `<circle r="22" fill="transparent" />` at the same `(x, y)`, rendered before the visible dot, handling the `onClick`. The visible dot (r=6/9) is unchanged so the ring's visual density is preserved.
- `showLabel` stays governed by the existing per-branch prop — desktop passes `true` (default), mobile passes `false`, same as today. Node identity on mobile surfaces through the ARMED banner (`⌖ ARMED: <SURNAME>`) and the pair header in `CouncilSynthesisPanel`, not inline SVG text — this avoids fitting 8–9px labels between closely-spaced touch targets.

## 3 · Layout

- Sidebars (`MindSidebar`): no new mobile-specific code. `isNarrow` is `window.innerWidth < 1200`, which is always true on mobile, so mobile automatically renders the existing stacked-below-ring layout (`CouncilRing.jsx:267-273`) once the `isMobile` branch is removed.
- ARMED banner, ticker strip, and the `SYSTEM_OUTPUT_READY` scroll alert render unchanged — all three already use `whiteSpace: nowrap` + `textOverflow: ellipsis` or fixed heights, so they degrade gracefully on narrow widths without modification.
- `CouncilSynthesisPanel` mounts below the ring container exactly as on desktop (`CouncilRing.jsx:307-314`) — full-width block, no desktop-only CSS assumptions found in the component. Confirms the "below canvas, same scroll" layout: canvas stays in place, panel expands beneath it as the user scrolls down.

## 4 · Acceptance criteria

Browser-verified at 375×812 (mobile) and one tablet width (e.g. 768×1024), in addition to the existing desktop breakpoints from the predecessor spec:

- Full torus (both radii, both scaffold labels, all 16 nodes) visible with no horizontal cropping.
- Tapping an unarmed node arms it (gold pulse, ARMED banner appears); tapping a second, different node fires the collision.
- Each node's effective touch target is ≥44×44px (verified via DOM inspection of the transparent hit-circle, not the visible dot).
- After the animation gate completes, `CouncilSynthesisPanel` renders below the ring with all four sections, identical in content structure to desktop.
- `/RESET` and re-arming behave identically to desktop.
- No new horizontal scroll is introduced at any tested width.

## 5 · Testing

- No changes to unit-testable logic (state machine, ledger, synthesis engine) — existing test suites for those stay green unchanged.
- Browser verification (manual, via dev server) replaces unit tests here since the change is rendering/layout: torus visibility, touch-target hit area, arm/fire flow, and panel mount, each at the viewport widths in §4.
- Regression check: desktop behavior (click mechanics, flanking/stacked sidebars, breakout width) unaffected — re-verify at 1400×1000 and 1100×800 per the predecessor spec's §7 acceptance widths.

## Module summary

| File | Status | Responsibility |
|---|---|---|
| `manifesto/CouncilRing.jsx` | modify | Remove mobile-specific branch and rotate-wheel state; add touch hit-circles to `Node`; mobile falls into existing desktop/narrow rendering path |
| `manifesto/useCouncilCollider.js` | touch | Remove `enabled` gate tied to `isMobile` (collider now always enabled) |
| `manifesto/CouncilSynthesisPanel.jsx` | none | No changes expected; verify no desktop-only assumptions during implementation |
| `manifesto/MindSidebar.jsx` | none | No changes; already rendered via `isNarrow` path |
