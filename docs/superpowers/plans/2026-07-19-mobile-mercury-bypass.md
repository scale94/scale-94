# Mobile Mercury Sphere + 7-Tap Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile kernel-tab's placeholder 2D-canvas sphere with the real WebGL `MercuryTerminator`, wired to the same 7-tap bypass gesture the desktop sphere already uses.

**Architecture:** `KernelTab.jsx` already builds one shared `mercuryTaps` gesture object and one shared `{ twilight, day, flare }` compile-frontier state, both currently consumed only by the desktop-gated `MercuryTerminator` instance. This plan adds a second `MercuryTerminator` instance gated on the mobile side of the same breakpoint check, wired to those same shared objects — no new state, no new hooks. It then deletes the now-orphaned 2D-canvas burst system (`useMiniSphere`, `sphereFireRef`, `sphereCanvasMobileRef`) that the new sphere makes obsolete.

**Tech Stack:** React (hooks), existing `MercuryTerminator` (WebGL canvas component), existing `useSevenTaps` / `MercuryTapToast`.

## Global Constraints

- Single file touched: `src/terminal/views/KernelTab.jsx`. No other file changes.
- Exactly one `MercuryTerminator` WebGL context may be mounted at a time (mobile XOR desktop), matching the existing `isDesktop &&` discipline already in the file.
- Reuse `mercuryTaps`, `twilight`, `day`, `flare` as already constructed at the top of the component — do not create second instances of any of these.
- No unit tests exist for this view and none are added — verification is manual, in-browser, per `docs/superpowers/specs/2026-07-19-mobile-mercury-bypass-design.md`.

---

### Task 1: Swap the mobile canvas for `MercuryTerminator` + wire the 7-tap gesture

**Files:**
- Modify: `src/terminal/views/KernelTab.jsx:589-592`

**Interfaces:**
- Consumes: `isDesktop` (bool, `KernelTab.jsx:201`), `twilight`/`day`/`flare` (from `useCompileFrontier`, `KernelTab.jsx:195`), `mercuryTaps` (`{ onTap, toast, clearToast }`, `KernelTab.jsx:235-238`), `MercuryTerminator` (imported `KernelTab.jsx:7`), `MercuryTapToast` (imported `KernelTab.jsx:8`).
- Produces: nothing consumed by later tasks — this is the terminal UI change. Task 2 only needs to know that after this task, `sphereCanvasMobileRef` and `sphereFireRef` are no longer referenced by the mobile render block.

The current block (`KernelTab.jsx:589-592`):

```jsx
        {/* Mobile sphere — sits below the title, hidden on desktop */}
        <canvas ref={sphereCanvasMobileRef} width={180} height={180}
          className="block md:hidden mt-3"
          style={{ width: 120, height: 120 }} />
```

- [ ] **Step 1: Replace the mobile canvas block with `MercuryTerminator` + `MercuryTapToast`**

Replace the block shown above with:

```jsx
        {/* Mobile Mercury — same compile-frontier state and tap gesture as
         * desktop's sphere, mounted only below the md breakpoint so exactly
         * one WebGL context ever exists. */}
        {!isDesktop && (
          <div className="relative mt-3" style={{ width: 120 }}>
            <MercuryTerminator
              twilight={twilight}
              day={day}
              flare={flare}
              size={120}
              onClick={mercuryTaps.onTap}
              title="☿ mercury — the compile frontier"
              ariaLabel="Mercury — the compile frontier; tap to open Mercury, 7 taps for hidden bypass"
            />
            <MercuryTapToast toast={mercuryTaps.toast} onDone={mercuryTaps.clearToast} />
          </div>
        )}
```

- [ ] **Step 2: Start the dev server and view the kernel tab at a mobile viewport width**

Use the project's preview tooling to run the dev server, then resize the
browser viewport to mobile (< 768px width) and navigate to the kernel tab.

Expected: a silvery WebGL sphere renders in the same position the old 2D
sphere used to occupy (under the "THEORY THAT CANNOT BE COMPILED..." text),
roughly 120px square.

- [ ] **Step 3: Verify single-tap navigation**

Tap the sphere once and wait ~300ms without tapping again.

Expected: the view navigates to Mercury (`onNavigateToMercury` fires — same
behavior as clicking the desktop sphere).

- [ ] **Step 4: Verify the 7-tap bypass**

Reload the kernel tab (mobile viewport). Tap the sphere 7 times within 3
seconds.

Expected: a countdown toast appears from the 3rd tap onward (dim amber text,
e.g. "3 · past the theme layer"), and the 7th tap shows the bright unlock
toast ("☿ compiled fairytale castle on mercury") and calls
`unlockMercuryKernel()`.

- [ ] **Step 5: Verify desktop is unaffected**

Widen the viewport back above 768px and reload. Confirm the desktop Mercury
sphere in the header (top-right) still renders and behaves exactly as
before — single tap navigates, 7 taps unlocks.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/KernelTab.jsx
git commit -m "feat(mercury): mount MercuryTerminator + 7-tap bypass on mobile kernel tab"
```

---

### Task 2: Remove the orphaned 2D-canvas burst system

**Files:**
- Modify: `src/terminal/views/KernelTab.jsx` (multiple locations, listed below)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks — this is cleanup only, no behavior change beyond removing dead code. After this task, `sphereCanvasMobileRef`, `sphereFireRef`, and `useMiniSphere` no longer exist anywhere in the file.

Before starting, re-run the search to confirm the exact current locations
(line numbers shift as you edit, so do each step's edit, then re-grep before
the next):

```bash
grep -n "sphereFireRef\|sphereCanvasMobileRef\|useMiniSphere" src/terminal/views/KernelTab.jsx
```

At the start of this task it reports these 9 lines (from the pre-Task-1
file; Task 1 already removed the line-590 canvas reference, so 8 remain):

```
15:function useMiniSphere(canvasRef, fireRef) {
191:  const sphereCanvasMobileRef  = useRef(null); // mobile
192:  // sphereFireRef: write { ts: Date.now() } to trigger a burst on both spheres
193:  const sphereFireRef = useRef(null);
194:  useMiniSphere(sphereCanvasMobileRef, sphereFireRef);
232:  const toMercury = () => { sphereFireRef.current = { ts: Date.now() }; onNavigateToMercury && onNavigateToMercury(); };
237:    onUnlock: () => { unlockMercuryKernel(); sphereFireRef.current = { ts: Date.now() }; },
267:      sphereFireRef.current = { ts: Date.now() };
732:                    sphereFireRef.current = { ts: Date.now() };
763:                      onClick={(e) => { e.stopPropagation(); setIsFading(true); sphereFireRef.current = { ts: Date.now() }; handleKernelClick && handleKernelClick(mod); }}
772:                        sphereFireRef.current = { ts: Date.now() };
982:                      onClick={() => { sphereFireRef.current = { ts: Date.now() }; mobileAutoRun && mobileAutoRun(l.btn.cmd); resetTtyFade(); }}
```

- [ ] **Step 1: Delete the `useMiniSphere` function (lines 14-142)**

Delete the entire function, from the comment line directly above it through
its closing brace:

```jsx
// ── Mini rotating sphere hero canvas ────────────────────────────────────────
function useMiniSphere(canvasRef, fireRef) {
  ... (full body) ...
}
```

- [ ] **Step 2: Remove the ref declarations and the hook call**

Delete:

```jsx
  const sphereCanvasMobileRef  = useRef(null); // mobile
  // sphereFireRef: write { ts: Date.now() } to trigger a burst on both spheres
  const sphereFireRef = useRef(null);
  useMiniSphere(sphereCanvasMobileRef, sphereFireRef);
```

- [ ] **Step 3: Simplify `toMercury`**

Change:

```jsx
  const toMercury = () => { sphereFireRef.current = { ts: Date.now() }; onNavigateToMercury && onNavigateToMercury(); };
```

to:

```jsx
  const toMercury = () => { onNavigateToMercury && onNavigateToMercury(); };
```

- [ ] **Step 4: Simplify the `mercuryTaps` `onUnlock` callback**

Change:

```jsx
    onUnlock: () => { unlockMercuryKernel(); sphereFireRef.current = { ts: Date.now() }; },
```

to:

```jsx
    onUnlock: () => { unlockMercuryKernel(); },
```

- [ ] **Step 5: Remove the remaining `sphereFireRef.current = { ts: Date.now() }` assignments**

There are five left, each a single standalone statement inside an existing
handler — delete just that statement, leaving the rest of each handler
intact:

1. Inside the `loadingKernel` effect (kernel-complete transition) — delete
   the line `sphereFireRef.current = { ts: Date.now() };` that appears right
   after `pendingStopRef.current = true;`.
2. Inside the pinned-module `<li onClick={...}>` handler — delete the
   standalone `sphereFireRef.current = { ts: Date.now() };` line (keep
   `setIsFading(true);` and the `handleKernelClick && handleKernelClick(mod);`
   call, and the `mobileAutoRun` block that follows).
3. Inside the `[load]` tag's inline `onClick` — change:
   ```jsx
   onClick={(e) => { e.stopPropagation(); setIsFading(true); sphereFireRef.current = { ts: Date.now() }; handleKernelClick && handleKernelClick(mod); }}
   ```
   to:
   ```jsx
   onClick={(e) => { e.stopPropagation(); setIsFading(true); handleKernelClick && handleKernelClick(mod); }}
   ```
4. Inside the `[run]` button's `onClick` — delete the standalone
   `sphereFireRef.current = { ts: Date.now() };` line (keep `mobileAutoRun`,
   `resetTtyFade()`, `setFiringKernelId(mod.id)`, and the lava-timer logic).
5. Inside the tty0 log-line button's `onClick` — change:
   ```jsx
   onClick={() => { sphereFireRef.current = { ts: Date.now() }; mobileAutoRun && mobileAutoRun(l.btn.cmd); resetTtyFade(); }}
   ```
   to:
   ```jsx
   onClick={() => { mobileAutoRun && mobileAutoRun(l.btn.cmd); resetTtyFade(); }}
   ```

- [ ] **Step 6: Confirm no references remain**

```bash
grep -n "sphereFireRef\|sphereCanvasMobileRef\|useMiniSphere" src/terminal/views/KernelTab.jsx
```

Expected: no output (empty match).

- [ ] **Step 7: Reload the dev server and re-verify Task 1's behavior still holds**

Reload the kernel tab in both mobile and desktop viewports. Confirm:
- Mobile Mercury sphere still renders and single-tap/7-tap still work
  (Task 1, Steps 2-5, repeated).
- Kernel `[load]` and `[run]` buttons still work (list item highlights,
  loading state, log output) — this confirms the surrounding handlers
  weren't broken by removing the `sphereFireRef` statements.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/views/KernelTab.jsx
git commit -m "refactor(mercury): remove orphaned 2D-canvas burst system"
```
