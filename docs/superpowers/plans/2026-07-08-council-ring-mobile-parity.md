# Council Ring Mobile Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile "crosshair wheel" (cropped, rotate-to-browse, dossier-only) in the Council Ring with the same tap-to-arm/fire interaction, full uncropped torus, and synthesis panel that desktop already has.

**Architecture:** Delete the `isMobile` early-return branch and its rotation-drag state in `CouncilRing.jsx` so mobile falls into the same render path desktop uses; add an invisible ≥44×44px touch target to each `Node` without changing its visible dot size; keep `isMobile` only to suppress inline SVG labels (names/dims surface via the ARMED banner and panel header instead). No changes to the state machine, ledger, or synthesis engine — this is a rendering/layout change confined to `CouncilRing.jsx` and `councilRingMath.js` (dead-code removal).

**Tech Stack:** React 19, Vite, Vitest, `@testing-library/react` (unused by this feature — no component tests exist for `CouncilRing.jsx` in this codebase; verification is via the existing pure-logic test suites plus manual browser check, matching the design spec's testing section).

**Spec:** `docs/superpowers/specs/2026-07-08-council-ring-mobile-parity-design.md`

---

### Task 1: Remove the mobile crosshair-wheel branch and its dead state

**Files:**
- Modify: `src/terminal/views/manifesto/CouncilRing.jsx`

- [ ] **Step 1: Remove the now-unused `angleToNearestSeatIndex` import**

In `src/terminal/views/manifesto/CouncilRing.jsx`, change line 3:

```jsx
import { seatAngle, polarToXY, angleToNearestSeatIndex } from './councilRingMath';
```

to:

```jsx
import { seatAngle, polarToXY } from './councilRingMath';
```

- [ ] **Step 2: Drop the now-unused `useRef` import**

Change line 1:

```jsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
```

to:

```jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
```

(`useRef` is only used today by the mobile drag state removed in Step 4 — `useCouncilCollider`'s own `canvasRef`/`simRef` live in that hook's file, not here.)

- [ ] **Step 3: Make the collider always enabled**

Change:

```jsx
  const collider = useCouncilCollider({ seated, enabled: !isMobile });
```

to:

```jsx
  const collider = useCouncilCollider({ seated, enabled: true });
```

The RAF loop and canvas already gate themselves on `prefers-reduced-motion` and viewport intersection inside `useCouncilCollider` (`src/terminal/views/manifesto/useCouncilCollider.js:121-130`) — `enabled` only needs to reflect "this device supports the interaction," which is now true everywhere.

- [ ] **Step 4: Delete the mobile rotation state block and touch handlers**

Delete this entire block (currently right after the `alertDismissed` effect, before the `if (isMobile)` branch):

```jsx
  // Mobile rotation state
  const [rotation, setRotation] = useState(0);
  const dragRef = useRef({ dragging: false, startAngle: 0, startRotation: 0 });

  const seatAngles = useMemo(() => seated.map(m => m.angle), [seated]);
  const activeIndex = useMemo(
    () => (isMobile ? angleToNearestSeatIndex(rotation, seatAngles) : -1),
    [isMobile, rotation, seatAngles]
  );
  const activeMind = activeIndex >= 0 ? seated[activeIndex] : null;

  const pointerAngle = useCallback((touch, rect) => {
    const px = touch.clientX - rect.left - rect.width / 2;
    const py = touch.clientY - rect.top - rect.height / 2;
    return (Math.atan2(py, px) * 180) / Math.PI;
  }, []);

  const onTouchStart = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      dragging: true,
      startAngle: pointerAngle(e.touches[0], rect),
      startRotation: rotation,
    };
  }, [rotation, pointerAngle]);

  const onTouchMove = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const now = pointerAngle(e.touches[0], rect);
    setRotation(dragRef.current.startRotation + (now - dragRef.current.startAngle));
  }, [pointerAngle]);

  const onTouchEnd = useCallback(() => {
    dragRef.current.dragging = false;
    // Snap so the nearest seat sits exactly under the crosshair (0°).
    const idx = angleToNearestSeatIndex(rotation, seatAngles);
    const target = -seatAngles[idx];
    setRotation(((target % 360) + 360) % 360);
  }, [rotation, seatAngles]);
```

- [ ] **Step 5: Delete the mobile early-return branch**

Delete this entire block (immediately following what Step 4 removed):

```jsx
  if (isMobile) {
    return (
      <div>
        {/* Crosshair-visible upper segment */}
        <div style={{ height: 360, overflow: 'hidden', position: 'relative', background: '#04040a', border: '1px solid rgba(120,140,200,0.12)', borderRadius: 4, padding: '0 6px' }}>
          {/* Gold crosshair at 12 o'clock */}
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 3, color: '#FFD700', fontFamily: MONO, fontSize: 14 }}>▼</div>
          <svg
            viewBox="0 0 640 640"
            style={{ width: '200%', marginLeft: '-50%', display: 'block', touchAction: 'none' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <g transform={`rotate(${rotation} ${CX} ${CY})`}>
              <RingScaffold />
              {seated.map((m, i) => (
                <g key={m.dimIndex} transform={`rotate(${-rotation} ${polarToXY(m.angle, R_SEAT, CX, CY).x} ${polarToXY(m.angle, R_SEAT, CX, CY).y})`}>
                  <Node mind={m} active={i === activeIndex} onSelect={setSelected} showLabel={false} />
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Fixed-height telemetry panel — no layout shift, no keyboard */}
        <div
          onClick={() => activeMind && setSelected(activeMind)}
          style={{ minHeight: 132, height: 132, marginTop: 10, padding: '12px 14px', background: '#04040a', border: `1px solid ${activeMind ? (activeMind.caste === 'canon' ? '#FFD700' : '#00FFAA') : 'rgba(120,140,200,0.12)'}33`, borderRadius: 4, fontFamily: MONO, cursor: 'pointer', overflow: 'hidden' }}
        >
          {activeMind && (
            <>
              <div style={{ fontSize: 10, color: activeMind.hue, letterSpacing: '0.2em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>[dim:{String(activeMind.dimIndex).padStart(2, '0')}] {activeMind.dimName}</div>
              <div style={{ fontSize: 'clamp(13px, 4vw, 16px)', color: activeMind.caste === 'canon' ? '#FFD700' : '#00FFAA', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeMind.anchorName}</div>
              <div style={{ fontSize: 'clamp(11px, 3.5vw, 14px)', color: '#FFD700', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeMind.coreEquation}</div>
              <div style={{ fontSize: 9, color: 'rgba(0,255,170,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>▸ {activeMind.systemDirective}</div>
            </>
          )}
        </div>

        {selected && <SixteenPanel mind={selected} onClose={() => setSelected(null)} />}
      </div>
    );
  }

```

After this deletion, `CouncilRing()` falls straight through from the `alertDismissed` effect into the `// Desktop — 3-column grid` comment and the `showSidebars` line — i.e. every viewport now renders that one JSX tree. `isMobile` is still declared (`const isMobile = useIsMobile();`, untouched) — it is consumed in Task 2.

- [ ] **Step 6: Verify no leftover references**

Run:

```bash
grep -n "rotation\|dragRef\|activeIndex\|activeMind\|pointerAngle\|onTouchStart\|onTouchMove\|onTouchEnd\|angleToNearestSeatIndex" src/terminal/views/manifesto/CouncilRing.jsx
```

Expected: no output (all removed).

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/manifesto/CouncilRing.jsx
git commit -m "feat(council-ring): remove mobile crosshair-wheel, unify on desktop render path"
```

---

### Task 2: Add a 44×44px touch target to `Node` and suppress labels on mobile

**Files:**
- Modify: `src/terminal/views/manifesto/CouncilRing.jsx`

- [ ] **Step 1: Add the invisible hit-circle to `Node`**

In `src/terminal/views/manifesto/CouncilRing.jsx`, find the `Node` function:

```jsx
function Node({ mind, active, onSelect, showLabel = true }) {
  const { x, y } = polarToXY(mind.angle, R_SEAT, CX, CY);
  const labelSide = mind.angle > 180 ? 'end' : 'start';
  const dx = mind.angle > 180 ? -12 : 12;
  const fill = active ? '#FFD700' : mind.hue;
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(mind)}
      data-testid={`node-${mind.dimIndex}`}
    >
      <circle cx={x} cy={y} r={active ? 9 : 6} fill={fill} stroke={mind.casteStroke} strokeWidth={active ? 2.5 : 1.5}
        style={{ transition: 'r 160ms, fill 80ms' }} />
      {/* Mobile's crosshair window crops horizontally by design (a porthole
          reveal, not a bug) — SVG <text> has no ellipsis, so any label near
          the crop edge hard-clips mid-glyph. Labels are desktop-only; the
          fixed telemetry panel below the wheel is mobile's full-text readout. */}
      {showLabel && (
```

Replace the whole function with:

```jsx
function Node({ mind, active, onSelect, showLabel = true }) {
  const { x, y } = polarToXY(mind.angle, R_SEAT, CX, CY);
  const labelSide = mind.angle > 180 ? 'end' : 'start';
  const dx = mind.angle > 180 ? -12 : 12;
  const fill = active ? '#FFD700' : mind.hue;
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(mind)}
      data-testid={`node-${mind.dimIndex}`}
    >
      {/* Invisible touch target — 44px diameter, independent of the visible
          dot's radius (6/9px), so mobile taps satisfy WCAG 2.5.5 without
          growing the ring's visual density. */}
      <circle cx={x} cy={y} r={22} fill="transparent" />
      <circle cx={x} cy={y} r={active ? 9 : 6} fill={fill} stroke={mind.casteStroke} strokeWidth={active ? 2.5 : 1.5}
        style={{ transition: 'r 160ms, fill 80ms', pointerEvents: 'none' }} />
      {/* Labels are suppressed on mobile widths (showLabel=false, passed by
          the caller) — 8-9px SVG text has no ellipsis and would clip or
          overlap between closely-spaced touch targets. Full name/dim surface
          via the ARMED banner and the synthesis panel's pair header instead. */}
      {showLabel && (
```

(The rest of the function — the two `<text>` elements, the closing `)}`, `</g>`, `);`, `}` — is unchanged.)

Note the visible dot circle gains `pointerEvents: 'none'` so clicks always resolve against the hit-circle underneath it, keeping a single consistent hit-test target instead of two overlapping ones.

- [ ] **Step 2: Pass `showLabel={!isMobile}` at the Node call site**

Find the `<Node>` usage inside the (now-unified) return:

```jsx
              {seated.map(m => (
                <Node
                  key={m.dimIndex}
                  mind={m}
                  active={
                    collider.mode === 'ARMED'
                      ? collider.armedMind?.dimIndex === m.dimIndex
                      : collider.activePairIds.includes(m.dimIndex)
                  }
                  onSelect={handleSelect}
                />
              ))}
```

Change to:

```jsx
              {seated.map(m => (
                <Node
                  key={m.dimIndex}
                  mind={m}
                  active={
                    collider.mode === 'ARMED'
                      ? collider.armedMind?.dimIndex === m.dimIndex
                      : collider.activePairIds.includes(m.dimIndex)
                  }
                  onSelect={handleSelect}
                  showLabel={!isMobile}
                />
              ))}
```

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/manifesto/CouncilRing.jsx
git commit -m "feat(council-ring): 44px touch targets on ring nodes, suppress labels on mobile"
```

---

### Task 3: Remove now-dead `angleToNearestSeatIndex` from `councilRingMath.js`

**Files:**
- Modify: `src/terminal/views/manifesto/councilRingMath.js`
- Modify: `tests/councilRingMath.test.js`

> **Amendment (found during Task 1 code review):** the plan's original Step 1 grepped only `src/`, but `tests/councilRingMath.test.js` — outside `src/` — imports and directly unit-tests `angleToNearestSeatIndex`. Deleting the function without updating this test file would break `npm test`. This task now covers both files.

- [ ] **Step 1: Confirm no remaining callers outside the test file**

Run:

```bash
grep -rn "angleToNearestSeatIndex" --include="*.js" --include="*.jsx" . | grep -v node_modules
```

Expected: exactly one match, in `tests/councilRingMath.test.js` (Task 1 Step 1 already removed the only production import/call site in `src/`). If anything else turns up, stop and report it — the plan didn't anticipate it.

- [ ] **Step 2: Remove the `angleToNearestSeatIndex` tests and import**

In `tests/councilRingMath.test.js`, change the import (currently):

```js
import {
  seatAngle,
  polarToXY,
  angleToNearestSeatIndex,
} from '../src/terminal/views/manifesto/councilRingMath.js';
```

to:

```js
import {
  seatAngle,
  polarToXY,
} from '../src/terminal/views/manifesto/councilRingMath.js';
```

Then delete this entire block from the end of the file:

```js
describe('angleToNearestSeatIndex', () => {
  const seats = [10, 40, 90, 200, 340];
  it('returns the seat under the crosshair with zero rotation', () => {
    expect(angleToNearestSeatIndex(0, seats)).toBe(0);
  });

  it('accounts for ring rotation', () => {
    expect(angleToNearestSeatIndex(80, seats)).toBe(4);
  });
});
```

The `seatAngle` and `polarToXY` describe blocks above it in the same file are untouched.

- [ ] **Step 3: Delete the dead function and its private helper from the source file**

In `src/terminal/views/manifesto/councilRingMath.js`, delete:

```js
function angularDistance(a, b) {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return Math.min(d, 360 - d);
}

export function angleToNearestSeatIndex(rotationDeg, seatAngles) {
  let best = 0;
  let bestDist = Infinity;
  seatAngles.forEach((seat, i) => {
    const effective = ((seat + rotationDeg) % 360 + 360) % 360;
    const dist = angularDistance(effective, 0);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}
```

`angularDistance` has no other callers (only used by `angleToNearestSeatIndex`), so it is removed too. The file's remaining exports (`seatAngle`, `polarToXY`) are unaffected.

- [ ] **Step 4: Run the test suite to confirm the deletion is clean**

```bash
npm test
```

Expected: 351 tests passing (353 minus the 2 removed `angleToNearestSeatIndex` tests) — no import errors, no failures. The file's `seatAngle`/`polarToXY` describe blocks (5 tests) still run.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/councilRingMath.js tests/councilRingMath.test.js
git commit -m "chore(council-ring): remove dead angleToNearestSeatIndex/angularDistance"
```

---

### Task 4: Verify — test suite, lint, and browser check across breakpoints

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all existing suites pass unchanged, including `src/terminal/views/manifesto/__tests__/{councilBus,councilCollider,councilLedger,councilStateMachine,councilSynthesis}.test.js` — none of these test files touch `CouncilRing.jsx` or `councilRingMath.js`'s deleted function, so none should need edits.

- [ ] **Step 2: Run lint to catch dead imports**

```bash
npm run lint
```

Expected: no new warnings/errors in `src/terminal/views/manifesto/CouncilRing.jsx` or `councilRingMath.js` (in particular, no `no-unused-vars` on `useRef`, `angleToNearestSeatIndex`, `rotation`, `dragRef`, etc. — confirms Task 1/2/3 left no dead references).

- [ ] **Step 3: Start the dev server and open the manifesto tab**

Use the project's dev server (`npm run dev` via the preview tooling) and navigate to the manifesto tab's Council Ring section.

- [ ] **Step 4: Resize to 375×812 (mobile) and check the torus**

Confirm: both scaffold rings (`BIOPHYSICAL CEILING`, `SOCIAL FOUNDATION`), the center `◉`, and all 16 nodes are visible with no horizontal cropping and no horizontal page scroll.

- [ ] **Step 5: At 375×812, tap two different nodes**

Confirm: first tap arms the node (gold pulse, `⌖ ARMED: <SURNAME>` banner appears); second tap on a different node fires the collision (particle animation runs); after the animation completes, `CouncilSynthesisPanel` mounts below the ring showing all four sections (`SHARED GROUND & INNOVATION FRONTIER`, `SEMANTIC VECTORS & OPEN QUESTIONS`, `SANCTUARIES & PROMPT FRAGMENTS`, `SYNTHESIS DIRECTIVE`).

- [ ] **Step 6: At 375×812, inspect a node's hit target**

Using the browser inspector, confirm the transparent hit-circle (`r=22`, 44px diameter) is present around at least one node and that tapping within it (not just on the small visible dot) registers the click.

- [ ] **Step 7: Repeat Steps 4-5 at 768×1024 (tablet) and confirm sidebars stack**

Confirm `MindSidebar` cards for both minds render stacked below the ring (the existing `isNarrow` — `<1200px` — branch), not flanking it, and no clipping occurs.

- [ ] **Step 8: Regression-check desktop at 1400×1000 and 1100×800**

Confirm click-to-arm/fire, flanking sidebars (at 1400×1000) or stacked sidebars (at 1100×800), and the synthesis panel all behave exactly as before this change — no visual or behavioral regression.

- [ ] **Step 9: `/RESET` check**

At any width, after a synthesis completes, click `/RESET` in the panel header; confirm the panel clears and the ring returns to `AMBIENT` (ticker resumes ambient collisions).
