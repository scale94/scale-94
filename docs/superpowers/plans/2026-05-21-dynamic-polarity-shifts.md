# Dynamic Polarity Shifts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After each LatentCollider collision, shift the terminal's ambient background glow to match the collision's polarity class (SOLAR / LUNAR / MERIDIAN / CHAOTIC).

**Architecture:** Lift a `lastPolarityClass` string state to `App.jsx` via a callback prop chain (`App → ScalingTab → LatentCollider`), identical to the existing `lastKernelAt` / `onKernelRun` pattern. A single fixed overlay `<div>` in `App.jsx` renders a radial gradient from a `POLARITY_GLOW` color map. `LatentCollider` adds a `CHAOTIC` state to its polarity config (fired when paradox count ≥ 2) and signals `onPolarity` once per collision after `setResult`.

**Tech Stack:** React 18, ES modules (Vite), inline CSS `radial-gradient`, CSS `transition`

---

## File Map

| File | Status | Role |
|---|---|---|
| `src/terminal/views/LatentCollider.jsx` | Modify | Add `CHAOTIC` to `POLARITY_CONFIG`; override in `classifyAccord`; accept `onPolarity` prop; fire after `setResult` |
| `src/terminal/views/ScalingTab.jsx` | Modify | Accept `onPolarity` prop, pass to `LatentCollider` |
| `src/terminal/App.jsx` | Modify | `POLARITY_GLOW` map; `lastPolarityClass` state; overlay `<div>`; pass `onPolarity` to `ScalingTab` |

---

### Task 1: LatentCollider — CHAOTIC state + onPolarity signal

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`

**Context:** `POLARITY_CONFIG` is at line 105. `classifyAccord()` is at line 122. The `paradoxCount` variable is already defined at line 124. The polarity assignment is at lines 192–193. Both WASM and JS fallback paths converge at `setResult(parsed)` at line 1431 (inside `runCollision`). The component signature is at line 1125: `export default function LatentCollider({ kernelRunHistoryRef } = {})`.

- [ ] **Step 1: Add `CHAOTIC` to `POLARITY_CONFIG`**

Find this block at line 105:

```js
const POLARITY_CONFIG = {
  SOLAR:    { label: 'SOLAR',    color: '#FFD700', accent: '#b8960a', desc: 'projective · radiant · angular · warm' },
  MERIDIAN: { label: 'MERIDIAN', color: '#06b6d4', accent: '#0891b2', desc: 'axial · balanced · transitional' },
  LUNAR:    { label: 'LUNAR',    color: '#c4b5ff', accent: '#8b7fcf', desc: 'receptive · reflective · curved · cool' },
};
```

Change it to:

```js
const POLARITY_CONFIG = {
  SOLAR:    { label: 'SOLAR',    color: '#FFD700', accent: '#b8960a', desc: 'projective · radiant · angular · warm' },
  MERIDIAN: { label: 'MERIDIAN', color: '#06b6d4', accent: '#0891b2', desc: 'axial · balanced · transitional' },
  LUNAR:    { label: 'LUNAR',    color: '#c4b5ff', accent: '#8b7fcf', desc: 'receptive · reflective · curved · cool' },
  CHAOTIC:  { label: 'CHAOTIC',  color: '#ff2850', accent: '#cc1133', desc: 'divergent · high-entropy · paradox-state' },
};
```

- [ ] **Step 2: Override polarity to CHAOTIC in `classifyAccord()` when paradoxCount ≥ 2**

Find this block at lines 191–193 inside `classifyAccord()`:

```js
  // v1.1.0 §9 — Polarity spectrum
  const polarity      = result.ockPolarity;
  const polarityClass = POLARITY_CONFIG[result.ockPolarityClass] || POLARITY_CONFIG.MERIDIAN;
```

Change it to:

```js
  // v1.1.0 §9 — Polarity spectrum
  const polarity          = result.ockPolarity;
  const basePolarityClass = POLARITY_CONFIG[result.ockPolarityClass] || POLARITY_CONFIG.MERIDIAN;
  // CHAOTIC override: high paradox count supersedes SOLAR/LUNAR/MERIDIAN
  const polarityClass     = paradoxCount >= 2 ? POLARITY_CONFIG.CHAOTIC : basePolarityClass;
```

- [ ] **Step 3: Accept `onPolarity` prop in component signature**

Find line 1125:

```js
export default function LatentCollider({ kernelRunHistoryRef } = {}) {
```

Change it to:

```js
export default function LatentCollider({ kernelRunHistoryRef, onPolarity } = {}) {
```

- [ ] **Step 4: Fire `onPolarity` after `setResult` in `runCollision`**

Find this block at lines 1430–1432:

```js
      metricsRef.current = parsed;
      setResult(parsed);
      setPhase('colliding');
```

Change it to:

```js
      metricsRef.current = parsed;
      setResult(parsed);
      onPolarity?.(parsed.accord?.polarityClass?.label ?? null);
      setPhase('colliding');
```

- [ ] **Step 5: Verify**

Read lines 105–110 and lines 191–196 and lines 1430–1433 of `src/terminal/views/LatentCollider.jsx` and confirm:
- `CHAOTIC` entry is present in `POLARITY_CONFIG`
- `basePolarityClass` / `polarityClass` pattern is correct
- `onPolarity?.()` appears between `setResult` and `setPhase`

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): add CHAOTIC polarity state + fire onPolarity after collision"
```

---

### Task 2: ScalingTab — pass `onPolarity` through to LatentCollider

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx`

**Context:** `ScalingTab`'s function signature is at line 71. `LatentCollider` is rendered at line 236 with only `kernelRunHistoryRef` prop.

- [ ] **Step 1: Add `onPolarity` to ScalingTab's prop signature**

Find line 71:

```js
const ScalingTab = ({ setArchitectThesis, setCurrentPath, setOriginTab, loadKernel, kernelRunHistoryRef }) => {
```

Change it to:

```js
const ScalingTab = ({ setArchitectThesis, setCurrentPath, setOriginTab, loadKernel, kernelRunHistoryRef, onPolarity }) => {
```

- [ ] **Step 2: Pass `onPolarity` to LatentCollider**

Find line 236:

```jsx
      <LatentCollider kernelRunHistoryRef={kernelRunHistoryRef} />
```

Change it to:

```jsx
      <LatentCollider kernelRunHistoryRef={kernelRunHistoryRef} onPolarity={onPolarity} />
```

- [ ] **Step 3: Verify**

Read lines 71 and 234–238 of `src/terminal/views/ScalingTab.jsx` and confirm `onPolarity` is in both the signature and the JSX prop.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "feat(scaling): thread onPolarity prop through to LatentCollider"
```

---

### Task 3: App.jsx — state, glow map, overlay div, prop

**Files:**
- Modify: `src/terminal/App.jsx`

**Context:**
- `const App = () => {` begins at line 91.
- `lastKernelAt` state is at line 292: `const [lastKernelAt, setLastKernelAt] = useState(null);`
- CRT overlay div is at line 948: `<div className={`crt-overlay...`} aria-hidden="true" />`
- `ScalingTab` is rendered at line 1344–1351 with these props: `setArchitectThesis`, `setCurrentPath`, `setOriginTab`, `loadKernel`, `kernelRunHistoryRef`.

- [ ] **Step 1: Add `POLARITY_GLOW` constant before the component**

Find this comment at line 89:

```js
// formatKernelHelp, formatRunHelp, CMD_MANIFEST → src/terminal/commands/runHelpers.js
```

Add after it (before `const App = () => {`):

```js
// ── Polarity ambient glow — color map for terminal background overlay ─────────
const POLARITY_GLOW = {
  SOLAR:    'rgba(255,215,0,0.13)',
  LUNAR:    'rgba(196,181,255,0.12)',
  MERIDIAN: 'rgba(6,182,212,0.10)',
  CHAOTIC:  'rgba(255,40,80,0.14)',
};
```

- [ ] **Step 2: Add `lastPolarityClass` state**

Find line 292:

```js
  const [lastKernelAt, setLastKernelAt] = useState(null);
```

Add immediately after it:

```js
  const [lastPolarityClass, setLastPolarityClass] = useState(null);
```

- [ ] **Step 3: Add polarity overlay div after the CRT overlay**

Find line 948:

```jsx
      <div className={`crt-overlay${isCritical ? ' crt-critical' : isWarning ? ' crt-warning' : ''}`} aria-hidden="true" />
```

Add immediately after it:

```jsx
      {/* ── Polarity ambient glow — radial overlay, shifts on each collision ── */}
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

- [ ] **Step 4: Pass `onPolarity` to `ScalingTab`**

Find lines 1344–1351:

```jsx
              <ScalingTab
                setArchitectThesis={setArchitectThesis}
                setCurrentPath={setCurrentPath}
                setOriginTab={setOriginTab}
                loadKernel={handleNeuralLink}
                kernelRunHistoryRef={kernelRunHistoryRef}
              />
```

Change it to:

```jsx
              <ScalingTab
                setArchitectThesis={setArchitectThesis}
                setCurrentPath={setCurrentPath}
                setOriginTab={setOriginTab}
                loadKernel={handleNeuralLink}
                kernelRunHistoryRef={kernelRunHistoryRef}
                onPolarity={setLastPolarityClass}
              />
```

- [ ] **Step 5: Verify**

Read lines 89–92 (POLARITY_GLOW), lines 292–294 (state), lines 948–965 (overlay div), and lines 1344–1352 (ScalingTab props) of `src/terminal/App.jsx` and confirm all four changes are present.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/App.jsx
git commit -m "feat(app): polarity ambient glow overlay — SOLAR/LUNAR/MERIDIAN/CHAOTIC"
```
