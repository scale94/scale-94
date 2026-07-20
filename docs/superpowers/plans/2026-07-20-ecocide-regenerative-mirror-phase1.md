# Ecocide Regenerative Mirror — Phase 1 (The Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the one-way collapse simulation into a bidirectional, degrowth-gated one — five levers, a signed vitality state, and an SVG map that heals in reverse when protection wins.

**Architecture:** Extract all new simulation math into a pure, unit-tested module `src/terminal/lib/ecocideEngine.js` (mirroring the existing `inverseEngine.js` pattern). `EcocideTab.jsx` then calls that engine each 10 Hz tick, derives `deadFrac` (collapse, unchanged consumers) and `bloomFrac` (new heal path) from the signed vitality `v`, adds four protection-lever sliders in a collapsible cluster, and runs the existing SVG country-cell system in reverse for `v > 0`.

**Tech Stack:** React (hooks), vitest, existing SVG world-map (`worldMapPolys`), no new dependencies. WebGL life-field is **Phase 2 — out of scope here.**

## Global Constraints

- **Backward-compat contract (hard):** Do NOT mutate the exported `PHASE_NAME` array (`['HOMEOSTASIS','EXTRACTION','OVERSHOOT','COLLAPSE','FINAL']`) or the `PH` enum in `EcocideTab.jsx`. `src/terminal/quintessence/__tests__/periphery.test.js` and the observatory gaze contract depend on those five names verbatim. New regen phases use a **separate** `REGEN_NAME` array.
- **Collapse identity is kept, not gutted:** the 13 paradoxes, viral timeline, error flood, and collapse map all stay. This phase is additive.
- **Existing collapse consumers read `deadFrac`.** The engine must derive `deadFrac = max(0, -v)` so every current display keeps working with zero changes to its own logic.
- **Tuning constants are starting values, tuned live in-browser later.** Tests assert *invariants and directions* (like `inverseEngine.test.js`), never exact magnitudes.
- **No push** without explicit user command. Commit freely on the `feature/ecocide-regenerative-mirror` branch.
- **Test runner:** `npx vitest run <path>` for a single file; `npm test` runs all.

---

### Task 1: Engine core — gate, forces, signed-vitality step

**Files:**
- Create: `src/terminal/lib/ecocideEngine.js`
- Test: `src/terminal/lib/__tests__/ecocideEngine.test.js`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  - `ECO_TUNING` — constants object.
  - `growthToGdp(growthRate: number, deadFrac: number): number` — moved verbatim from `EcocideTab.jsx`.
  - `degrowthGate(growth: number): number` → `[0,1]`, `1 − smoothstep(GATE_LOW, GATE_HIGH, growth)`.
  - `healingPower(gate: number, sanctuary: number, restoration: number): number`.
  - `toxicityLoad(extraction: number, toxicityCap: number): number`.
  - `stepVitality(prevV: number, levers: {growth, toxicityCap, sanctuary, restoration}, dt: number): {v, extraction, toxicity, gate, healing}`.
  - `deriveFracs(v: number): {deadFrac: number, bloomFrac: number}`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/lib/__tests__/ecocideEngine.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  ECO_TUNING, growthToGdp, degrowthGate, healingPower, toxicityLoad,
  stepVitality, deriveFracs,
} from '../ecocideEngine';

describe('degrowthGate — the degrowth key', () => {
  it('is fully closed at high growth, fully open at steady-state', () => {
    expect(degrowthGate(5)).toBeCloseTo(0, 5);
    expect(degrowthGate(3.0)).toBeCloseTo(0, 5);
    expect(degrowthGate(1.5)).toBeCloseTo(1, 5);
    expect(degrowthGate(0)).toBeCloseTo(1, 5);
  });
  it('is ~0.5 at the midpoint of the gate window', () => {
    expect(degrowthGate(2.25)).toBeCloseTo(0.5, 2);
  });
  it('decreases monotonically across the window', () => {
    expect(degrowthGate(1.8)).toBeGreaterThan(degrowthGate(2.4));
  });
});

describe('healingPower', () => {
  it('is zero whenever the gate is closed — the greenwash invariant', () => {
    expect(healingPower(0, 1, 1)).toBe(0);
  });
  it('weights restoration above sanctuary', () => {
    expect(healingPower(1, 0, 1)).toBeGreaterThan(healingPower(1, 1, 0));
  });
  it('sums the two weighted levers at full gate', () => {
    expect(healingPower(1, 1, 1)).toBeCloseTo(
      ECO_TUNING.W_SANCTUARY + ECO_TUNING.W_RESTORATION, 6);
  });
});

describe('toxicityLoad', () => {
  it('is throttled to zero by a full cap and passes extraction at no cap', () => {
    expect(toxicityLoad(2, 1)).toBe(0);
    expect(toxicityLoad(2, 0)).toBe(2);
  });
});

describe('stepVitality — bidirectional integrator', () => {
  const maxProt = { toxicityCap: 1, sanctuary: 1, restoration: 1 };
  const noProt  = { toxicityCap: 0, sanctuary: 0, restoration: 0 };
  const dt = 0.1;

  it('GREENWASH: max protection at 5% growth does NOT heal', () => {
    const { v } = stepVitality(0, { growth: 5, ...maxProt }, dt);
    expect(v).toBeLessThanOrEqual(0);
  });
  it('DEGROWTH KEY: max protection at 1% growth heals (v rises)', () => {
    const { v } = stepVitality(0, { growth: 1, ...maxProt }, dt);
    expect(v).toBeGreaterThan(0);
  });
  it('NAIVE GROWTH: 5% growth with no protection degrades (v falls)', () => {
    const { v } = stepVitality(0, { growth: 5, ...noProt }, dt);
    expect(v).toBeLessThan(0);
  });
  it('clamps to [-1, 1]', () => {
    expect(stepVitality(1, { growth: 0, ...maxProt }, dt).v).toBeLessThanOrEqual(1);
    expect(stepVitality(-1, { growth: 10, ...noProt }, dt).v).toBeGreaterThanOrEqual(-1);
  });
});

describe('deriveFracs — signed v split into the two display tracks', () => {
  it('negative v is collapse (deadFrac), positive v is bloom', () => {
    expect(deriveFracs(-0.5)).toEqual({ deadFrac: 0.5, bloomFrac: 0 });
    expect(deriveFracs(0.5)).toEqual({ deadFrac: 0, bloomFrac: 0.5 });
    expect(deriveFracs(0)).toEqual({ deadFrac: 0, bloomFrac: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/lib/__tests__/ecocideEngine.test.js`
Expected: FAIL — "Failed to resolve import '../ecocideEngine'".

- [ ] **Step 3: Write minimal implementation**

Create `src/terminal/lib/ecocideEngine.js`:

```js
// ─────────────────────────────────────────────────────────────────────────────
// ecocideEngine.js — bidirectional ecological simulation core
//
// Signed vitality v ∈ [−1, +1]:
//   −1 = void/dead (FINAL_STATE)   0 = HOMEOSTASIS (baseline)   +1 = FLOURISHING
//
// "Degrowth is the key": protection levers are inert until growth is tamed.
// See docs/superpowers/specs/2026-07-20-ecocide-regenerative-mirror-design.md
// ─────────────────────────────────────────────────────────────────────────────

export const ECO_TUNING = Object.freeze({
  GATE_LOW:      1.5,   // % growth — at/below, healing gate fully open
  GATE_HIGH:     3.0,   // % growth — at/above, healing gate fully closed
  W_SANCTUARY:   0.35,  // passive-recovery weight
  W_RESTORATION: 0.65,  // active-regeneration weight (the bloom driver)
  K_HEAL:        0.9,    // dv/dt healing coefficient
  K_EXTRACT:     0.6,    // dv/dt extraction-damage coefficient
  K_TOX:         0.4,    // dv/dt toxicity-damage coefficient
  V_MIN:        -1,
  V_MAX:         1,
});

// Smoothstep — 0 below edge0, 1 above edge1, Hermite in between.
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Growth mandate → extraction intensity for a biosphere at `deadFrac` degradation.
// Moved verbatim from EcocideTab.jsx (single source of truth).
export function growthToGdp(growthRate, deadFrac) {
  const bioCap = Math.max(0.05, 1.0 - deadFrac * 0.92);
  return Math.min(12.0, 1.0 + growthRate / bioCap);
}

// The degrowth gate: 1 (open) at steady-state, 0 (closed) at high growth.
export function degrowthGate(growth) {
  return 1 - smoothstep(ECO_TUNING.GATE_LOW, ECO_TUNING.GATE_HIGH, growth);
}

export function healingPower(gate, sanctuary, restoration) {
  return gate * (ECO_TUNING.W_SANCTUARY * sanctuary + ECO_TUNING.W_RESTORATION * restoration);
}

export function toxicityLoad(extraction, toxicityCap) {
  return Math.max(0, extraction) * (1 - toxicityCap);
}

// One integrator step. Reads the previous signed vitality, returns the next.
export function stepVitality(prevV, levers, dt) {
  const { growth, toxicityCap, sanctuary, restoration } = levers;
  const degradation = Math.max(0, -prevV);                 // = current deadFrac
  const extraction  = growthToGdp(growth, degradation) - 1.0;
  const toxicity    = toxicityLoad(extraction, toxicityCap);
  const gate        = degrowthGate(growth);
  const healing     = healingPower(gate, sanctuary, restoration);

  const dv = (ECO_TUNING.K_HEAL * healing
            - (ECO_TUNING.K_EXTRACT * extraction + ECO_TUNING.K_TOX * toxicity)) * dt;

  const v = clamp(prevV + dv, ECO_TUNING.V_MIN, ECO_TUNING.V_MAX);
  return { v, extraction, toxicity, gate, healing };
}

// Split signed vitality into the two display tracks the map consumes.
export function deriveFracs(v) {
  return { deadFrac: Math.max(0, -v), bloomFrac: Math.max(0, v) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/lib/__tests__/ecocideEngine.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/ecocideEngine.js src/terminal/lib/__tests__/ecocideEngine.test.js
git commit -m "feat(ecocide): signed-vitality engine core — degrowth gate + bidirectional step"
```

---

### Task 2: Social-penalty reframe (protection buys down the double-bind)

**Files:**
- Modify: `src/terminal/lib/ecocideEngine.js`
- Test: `src/terminal/lib/__tests__/ecocideEngine.test.js` (add a describe block)

**Interfaces:**
- Consumes: `ECO_TUNING`.
- Produces: `socialPenaltyLevel(growth: number, sanctuary: number, restoration: number, mandateActive: boolean): number` → integer `0..3`. `0` = no penalty.

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/lib/__tests__/ecocideEngine.test.js`:

```js
import { socialPenaltyLevel } from '../ecocideEngine';

describe('socialPenaltyLevel — the reframed double-bind', () => {
  it('is 0 when the mandate never engaged', () => {
    expect(socialPenaltyLevel(1.0, 0, 0, false)).toBe(0);
  });
  it('is 0 when growth is at/above the mandate line', () => {
    expect(socialPenaltyLevel(2.0, 0, 0, true)).toBe(0);
  });
  it('NAIVE degrowth (no protection funding) fires the full penalty', () => {
    expect(socialPenaltyLevel(0.5, 0, 0, true)).toBe(3);
    expect(socialPenaltyLevel(1.2, 0, 0, true)).toBe(2);
    expect(socialPenaltyLevel(1.8, 0, 0, true)).toBe(1);
  });
  it('JUST TRANSITION: funded protection buys the penalty down', () => {
    // same 0.5% growth that fired level 3 above, now with protection funded
    expect(socialPenaltyLevel(0.5, 1, 1, true)).toBeLessThan(3);
  });
  it('fully funded protection can neutralise the penalty entirely', () => {
    expect(socialPenaltyLevel(1.8, 1, 1, true)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/lib/__tests__/ecocideEngine.test.js -t "reframed double-bind"`
Expected: FAIL — "socialPenaltyLevel is not a function".

- [ ] **Step 3: Write minimal implementation**

Append to `src/terminal/lib/ecocideEngine.js`:

```js
// The double-bind, reframed. Dropping below the 2.0% mandate still fires social
// penalties (naive contraction = unemployment riots), but funded protection —
// a just transition — buys the penalty level down.
export function socialPenaltyLevel(growth, sanctuary, restoration, mandateActive) {
  if (!mandateActive || growth >= 2.0) return 0;
  const base = growth < 1.0 ? 3 : growth < 1.5 ? 2 : 1;
  const funding = Math.round((sanctuary + restoration) / 2);  // 0..1 → 0, 1
  return Math.max(0, base - funding * 2);                      // funding shaves up to 2 levels
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/lib/__tests__/ecocideEngine.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/ecocideEngine.js src/terminal/lib/__tests__/ecocideEngine.test.js
git commit -m "feat(ecocide): reframe double-bind — funded protection buys down the social penalty"
```

---

### Task 3: Regen phase ladder (positive mirror, without breaking the collapse contract)

**Files:**
- Modify: `src/terminal/lib/ecocideEngine.js`
- Test: `src/terminal/lib/__tests__/ecocideEngine.test.js` (add a describe block)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `REGEN_NAME: string[]` = `['HOMEOSTASIS','RECOVERY','REWILDING','FLOURISHING','ABUNDANCE']`.
  - `REGEN_COLOR: string[]` = green→gold ramp.
  - `bloomPhase(bloomFrac: number): number` → integer `0..4` index into `REGEN_NAME`/`REGEN_COLOR`.

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/lib/__tests__/ecocideEngine.test.js`:

```js
import { REGEN_NAME, REGEN_COLOR, bloomPhase } from '../ecocideEngine';

describe('regen phase ladder', () => {
  it('names mirror the collapse ladder around HOMEOSTASIS', () => {
    expect(REGEN_NAME[0]).toBe('HOMEOSTASIS');
    expect(REGEN_NAME).toHaveLength(5);
    expect(REGEN_COLOR).toHaveLength(5);
  });
  it('maps bloomFrac onto ascending phases', () => {
    expect(bloomPhase(0)).toBe(0);
    expect(bloomPhase(0.2)).toBe(1);
    expect(bloomPhase(0.45)).toBe(2);
    expect(bloomPhase(0.7)).toBe(3);
    expect(bloomPhase(0.9)).toBe(4);
  });
  it('is monotonic non-decreasing', () => {
    expect(bloomPhase(0.3)).toBeLessThanOrEqual(bloomPhase(0.6));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/lib/__tests__/ecocideEngine.test.js -t "regen phase ladder"`
Expected: FAIL — "REGEN_NAME is not defined" (import undefined).

- [ ] **Step 3: Write minimal implementation**

Append to `src/terminal/lib/ecocideEngine.js`:

```js
// Positive mirror of the collapse ladder. Index 0 = HOMEOSTASIS (shared pivot).
// NOTE: intentionally separate from EcocideTab's PHASE_NAME — that array is a
// frozen observatory contract and must not gain entries.
export const REGEN_NAME  = ['HOMEOSTASIS', 'RECOVERY', 'REWILDING', 'FLOURISHING', 'ABUNDANCE'];
export const REGEN_COLOR = ['#7ab800', '#5fbf3a', '#3fd06a', '#7fe08a', '#d8c85a'];

// bloomFrac (0..1) → regen phase index 0..4. Thresholds mirror the collapse
// phase cuts (0.10 / 0.30 / 0.55 / 0.85) used in EcocideTab's JS integrator.
export function bloomPhase(bloomFrac) {
  if (bloomFrac >= 0.85) return 4;
  if (bloomFrac >= 0.55) return 3;
  if (bloomFrac >= 0.30) return 2;
  if (bloomFrac >= 0.10) return 1;
  return 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/lib/__tests__/ecocideEngine.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/ecocideEngine.js src/terminal/lib/__tests__/ecocideEngine.test.js
git commit -m "feat(ecocide): regen phase ladder (RECOVERY→ABUNDANCE), separate from collapse contract"
```

---

### Task 4: Wire the four protection levers into EcocideTab state

**Files:**
- Modify: `src/terminal/views/EcocideTab.jsx`

**Interfaces:**
- Consumes: React `useState`/`useRef` (existing imports).
- Produces: state `toxicityCap, sanctuary, restoration, nativeBio` (each `0..1`) + matching refs `toxicityCapRef` etc., kept in sync exactly like `growthRateRef`.

- [ ] **Step 1: Add the lever state next to `growthRate`**

In `EcocideTab.jsx`, immediately after the `const [growthRate, setGrowthRate] = useState(2.5);` line (~line 316), add:

```jsx
  // ── Protection levers (0..1) — inert until the degrowth gate opens ──────────
  const [toxicityCap, setToxicityCap] = useState(0.0);
  const [sanctuary,   setSanctuary]   = useState(0.0);
  const [restoration, setRestoration] = useState(0.0);
  const [nativeBio,   setNativeBio]   = useState(0.0);
```

- [ ] **Step 2: Add refs + sync effect next to `growthRateRef`**

After the `useEffect(() => { growthRateRef.current = growthRate; }, [growthRate]);` line (~line 329), add:

```jsx
  const toxicityCapRef = useRef(0.0);
  const sanctuaryRef   = useRef(0.0);
  const restorationRef = useRef(0.0);
  const nativeBioRef   = useRef(0.0);
  useEffect(() => { toxicityCapRef.current = toxicityCap; }, [toxicityCap]);
  useEffect(() => { sanctuaryRef.current   = sanctuary;   }, [sanctuary]);
  useEffect(() => { restorationRef.current = restoration; }, [restoration]);
  useEffect(() => { nativeBioRef.current   = nativeBio;   }, [nativeBio]);
```

- [ ] **Step 3: Add a signed-vitality ref**

After `const deadFracRef = useRef(0);` (~line 302), add:

```jsx
  const vitalityRef = useRef(0);     // signed vitality v ∈ [−1, +1]
  const bloomFracRef = useRef(0);    // max(0, v) — the heal track
```

- [ ] **Step 4: Verify the app still builds and the tab renders unchanged**

Start the dev server and open the ecocide tab (the levers aren't used yet, so nothing should visually change).

Run (preview): `preview_start { name: <dev server> }`, navigate to the terminal, open the ECOCIDE tab.
Expected: tab renders exactly as before; console has no new errors (`read_console_messages`, `onlyErrors: true`).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/EcocideTab.jsx
git commit -m "feat(ecocide): add four protection-lever state + refs (unused wiring)"
```

---

### Task 5: Drive the tick from the engine (compute vitality, derive both fracs)

**Files:**
- Modify: `src/terminal/views/EcocideTab.jsx`

**Interfaces:**
- Consumes: `stepVitality`, `deriveFracs` from `../lib/ecocideEngine`; the refs from Task 4.
- Produces: `vitalityRef.current`, `bloomFracRef.current`, and a `deadFrac` that now originates from vitality; new `setMapState` field `bloomFrac`.

- [ ] **Step 1: Import the engine**

At the top of `EcocideTab.jsx`, alongside the existing `inverseEngine` import (~line 45), add:

```jsx
import { stepVitality, deriveFracs, socialPenaltyLevel, bloomPhase, REGEN_NAME } from '../lib/ecocideEngine';
```

Then delete the now-duplicated local `growthToGdp` function (~lines 223–226) and import it instead — change the same import line to:

```jsx
import { stepVitality, deriveFracs, socialPenaltyLevel, bloomPhase, REGEN_NAME, growthToGdp } from '../lib/ecocideEngine';
```

- [ ] **Step 2: Replace the collapse-only integration with an engine step**

Inside the 10 Hz `setInterval` tick, the block that currently computes `deadFrac`/`phase` (the WASM branch + the "JS ecological integrator" fallback, ~lines 364–431) is replaced by a single engine call driving vitality. Replace that whole span (from `let deadCount, deadFrac, ...` down to the closing of the `if (!wasmOk) { ... }` block) with:

```jsx
      // ── Bidirectional engine step (replaces the one-way WASM/JS integrator) ──
      const levers = {
        growth:      gr,
        toxicityCap: toxicityCapRef.current,
        sanctuary:   sanctuaryRef.current,
        restoration: restorationRef.current,
      };
      const stepped = stepVitality(vitalityRef.current, levers, WASM_DT);
      vitalityRef.current = stepped.v;
      const { deadFrac: _deadFrac, bloomFrac } = deriveFracs(stepped.v);
      bloomFracRef.current = bloomFrac;

      let deadFrac = _deadFrac;
      let deadCount = Math.round(deadFrac * DOT_COUNT);

      // Exergy/thermodynamic readouts derived from extraction (kept for the HUD).
      const rawExergyNorm = Math.min(1.0, stepped.extraction * 0.35 + deadFrac * 0.65);
      let exergyNorm = exergyNormRef.current + (rawExergyNorm - exergyNormRef.current) * 0.04;
      let dx_dt   = exergyNorm * X_SOLAR;
      let x_dest  = (statsRef.current.x_dest ?? 0) + dx_dt * WASM_DT;
      let metabolicFat = Math.min(1.0, deadFrac * deadFrac * 2.2);
      let s_gen   = dx_dt / 298.15;
      let capital = Math.max(0, 1.0 - deadFrac) * 100;

      // Collapse phase (unchanged thresholds → unchanged PH enum / PHASE_NAME contract)
      let phase;
      if      (deadFrac >= 0.85) phase = PH.FINAL;
      else if (deadFrac >= 0.55) phase = PH.COLLAPSE;
      else if (deadFrac >= 0.30) phase = PH.OVERSHOOT;
      else if (deadFrac >= 0.10) phase = PH.EXTRACTION;
      else                       phase = PH.HOMEOSTASIS;
```

> This removes the WASM `run_ecocide` dependency for the integrated state. Leave the `loadWasm()` effect and the first-tick probe in place for now (harmless); a later cleanup task can remove dead WASM plumbing.

- [ ] **Step 3: Feed `bloomFrac` into map state**

Find the `setMapState({ deadFrac, phase, exergyNorm, trophicV, metabolicFat });` call (~line 500) and add `bloomFrac`:

```jsx
      setMapState({ deadFrac, phase, exergyNorm, trophicV, metabolicFat, bloomFrac });
```

Also update the initial `useState` for `mapState` (~line 323) and the two `setMapState({ deadFrac: 0, ... })` resets (init + `handleReset`) to include `bloomFrac: 0`.

- [ ] **Step 4: Replace the penalty computation with the engine's**

Replace the double-bind penalty block (~lines 462–471, `let newPenalty = 0; ... if (mandateActiveRef.current && gr < 2.0 ...)`) with:

```jsx
      const newPenalty = socialPenaltyLevel(gr, sanctuaryRef.current, restorationRef.current, mandateActiveRef.current);
      const newPenaltyMsg = newPenalty > 0 ? DOUBLE_BIND[newPenalty - 1].msg : '';
```

- [ ] **Step 5: Reset vitality in `handleReset`**

In `handleReset` (~line 555), add alongside the other ref resets:

```jsx
    vitalityRef.current  = 0;
    bloomFracRef.current = 0;
```

- [ ] **Step 6: Browser-verify the bidirectional mechanic**

Reload the ecocide tab in the preview.
- Drag GROWTH to ~5% → the map should still collapse through EXTRACTION→…→FINAL exactly as before (deadFrac path intact).
- Reset. (Protection sliders don't exist in the UI yet — verify via console) run in `javascript_tool`: temporarily set growth low and confirm `v` climbs. Since sliders are Task 6, verify the collapse path only here; confirm no console errors and the SARG/paradox panels behave.

Expected: collapse trajectory visually unchanged from `main`; no console errors.

- [ ] **Step 7: Run the full test suite (regression gate)**

Run: `npm test`
Expected: PASS — especially `src/terminal/quintessence/__tests__/periphery.test.js` (phase-name contract) stays green.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/views/EcocideTab.jsx
git commit -m "feat(ecocide): drive tick from bidirectional engine; derive deadFrac+bloomFrac from vitality"
```

---

### Task 6: PROTECTION PROTOCOL slider cluster (collapsible)

**Files:**
- Modify: `src/terminal/views/EcocideTab.jsx`

**Interfaces:**
- Consumes: the lever state/setters from Task 4; the existing `GrowthSlider` component as the visual template.
- Produces: a generic `ProtocolSlider` sub-component + a collapsible cluster rendered directly under the `GROWTH_MANDATE` block.

- [ ] **Step 1: Add a generic 0..1 slider component**

Below the existing `GrowthSlider` component (after ~line 285), add a sibling that reuses its pointer logic over a `0..1` range:

```jsx
// ── ProtocolSlider — 0..1 protection lever, same pointer engine as GrowthSlider ─
function ProtocolSlider({ label, value, color, gated, onChange }) {
  const trackRef = useRef(null);
  const valueFromEvent = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);
  const handlePointer = useCallback((e) => {
    e.preventDefault();
    onChange(valueFromEvent(e));
    const move = (me) => { me.preventDefault(); onChange(valueFromEvent(me)); };
    const up   = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
  }, [onChange, valueFromEvent]);
  const pct = value * 100;
  return (
    <div className="flex items-center gap-2" style={{ opacity: gated ? 0.45 : 1, transition: 'opacity 0.4s' }}>
      <span className="shrink-0 tracking-widest uppercase" style={{ color, fontSize: '10px', fontWeight: 800, width: '104px' }}>{label}</span>
      <div ref={trackRef} onPointerDown={handlePointer}
        style={{ flex: 1, height: '4px', background: '#0d1a00', position: 'relative', cursor: 'pointer', touchAction: 'none', userSelect: 'none' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: color, transition: 'background 0.3s' }} />
        <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%,-50%)', width: '12px', height: '12px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}88` }} />
      </div>
      <span className="w-8 text-right shrink-0" style={{ color, fontSize: '11px', fontWeight: 800 }}>{Math.round(pct)}</span>
    </div>
  );
}
```

- [ ] **Step 2: Add cluster expand/collapse state**

Near the other `useState` calls (~line 316), add:

```jsx
  const [protocolOpen, setProtocolOpen] = useState(false);
```

- [ ] **Step 3: Render the cluster under GROWTH_MANDATE**

Immediately after the closing `</div>` of the `GROWTH_MANDATE` slider block (the `<div className="shrink-0 px-4 pt-3 pb-1 border-t ...">` that ends ~line 1016), insert:

```jsx
      {/* ── PROTECTION PROTOCOL — collapsible lever cluster ── */}
      <div className="shrink-0 px-4 pb-2 bg-black overflow-hidden">
        <button
          onClick={() => setProtocolOpen(o => !o)}
          className="flex items-center gap-2 tracking-widest uppercase"
          style={{ color: '#4a6a10', fontSize: '10px', fontWeight: 800 }}
        >
          <ChevronRight className="w-3 h-3" style={{ transform: protocolOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s' }} />
          PROTECTION_PROTOCOL {protocolOpen ? '' : '— [ expand ]'}
          {!protocolOpen && (sanctuary + restoration + toxicityCap + nativeBio) > 0 && (
            <span style={{ color: '#5fbf3a' }}>● armed</span>
          )}
        </button>
        {protocolOpen && (
          <div className="mt-2 flex flex-col gap-2">
            {growthRate >= 3.0 && (
              <div style={{ color: '#7a5a00', fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em' }}>
                ▶ GATE CLOSED — protections inert above 2.0% growth. Tame throughput to unlock healing.
              </div>
            )}
            <ProtocolSlider label="TOXICITY_CAP"  value={toxicityCap} color="#5a8ac0" gated={growthRate >= 3.0} onChange={setToxicityCap} />
            <ProtocolSlider label="SANCTUARY"     value={sanctuary}   color="#5fbf3a" gated={growthRate >= 3.0} onChange={setSanctuary} />
            <ProtocolSlider label="RESTORATION"   value={restoration} color="#3fd06a" gated={growthRate >= 3.0} onChange={setRestoration} />
            <ProtocolSlider label="NATIVE_BIODIV" value={nativeBio}   color="#7fe08a" gated={growthRate >= 3.0} onChange={setNativeBio} />
          </div>
        )}
      </div>
```

- [ ] **Step 4: Browser-verify the healing path end-to-end**

Reload the ecocide tab.
- Expand PROTECTION_PROTOCOL. Set GROWTH to ~1.0%, then drag SANCTUARY and RESTORATION up.
- Watch the map: `deadFrac` should stop rising and `bloomFrac` should climb (map behaviour comes in Task 7, but confirm no errors and the SARG number rises).
- Set GROWTH back to 5% with protections still maxed → confirm the "GATE CLOSED" note appears and the world degrades regardless (greenwash invariant, visible).

Screenshot both states (`computer { action: "screenshot" }`) to confirm the cluster renders cleanly on desktop; then `resize_window { preset: "mobile" }` and confirm the cluster doesn't overflow.

Expected: cluster expands/collapses; gate note toggles at 3%; no console errors; mobile layout holds.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/EcocideTab.jsx
git commit -m "feat(ecocide): PROTECTION PROTOCOL collapsible lever cluster (4 sliders + gate note)"
```

---

### Task 7: Run the SVG map in reverse — re-green, knit, flip hotspots

**Files:**
- Modify: `src/terminal/views/EcocideTab.jsx`

**Interfaces:**
- Consumes: `mapState.bloomFrac` (Task 5), `bloomPhase` (Task 3).
- Produces: `countryCells` that heal for `bloomFrac > 0`; hotspot markers that fade red→green as bloom rises; extended phase label showing the regen ladder.

- [ ] **Step 1: Extend `countryCells` with a bloom branch**

In the `countryCells` `useMemo` (~line 594), destructure `bloomFrac` and blend the fill toward vivid life when it is positive. Change the destructure line to:

```jsx
    const { deadFrac: df, phase, exergyNorm: en, trophicV: tv, bloomFrac: bf = 0 } = mapState;
```

Then, after the existing `fill` computation (the `if (localStress < 0.18) { ... } else { ... }` chain, ~lines 618–630), add a bloom override:

```jsx
      // ── Bloom branch: when vitality is positive, cells re-green past baseline ──
      // localBloom mirrors localStress but rewards protected/rich biomes first.
      if (bf > 0) {
        const localBloom = Math.min(1, bf * (0.6 + (1 - vuln) * 0.4 + seed * 0.15));
        // deep forest → vivid green → gold superbloom (nativeBio widens the palette later)
        let r, g, b;
        if (localBloom < 0.5) {
          const t2 = localBloom / 0.5;
          r = Math.round(8 + t2 * 40); g = Math.round(104 + t2 * 90); b = Math.round(8 + t2 * 20);
        } else {
          const t2 = (localBloom - 0.5) / 0.5;
          r = Math.round(48 + t2 * 150); g = Math.round(194 + t2 * 20); b = Math.round(28 + t2 * 40);
        }
        fill = `rgb(${r},${g},${b})`;
      }
```

Because `deriveFracs` guarantees `deadFrac` and `bloomFrac` are never both positive, the drift/scale (driven by `localStress` from `df`) is naturally zero while blooming — cells sit knit-together at their home positions and simply green. Add `mapState.bloomFrac` to the `useMemo` dependency array:

```jsx
  }, [mapState.deadFrac, mapState.phase, mapState.exergyNorm, mapState.trophicV, mapState.bloomFrac]);
```

- [ ] **Step 2: Flip the stress hotspots toward sanctuary-green as bloom rises**

In the `ECO_HOTSPOTS.map(...)` render inside the lower stress map (~line 1099), blend the marker color toward green by `mapState.bloomFrac`. Replace `const color = ECO_SEV_HEX[sev] || '#65a30d';` with:

```jsx
            const stressColor = ECO_SEV_HEX[sev] || '#65a30d';
            const bf = mapState.bloomFrac || 0;
            const color = bf > 0.05
              ? `rgb(${Math.round(0x3f * (1 - bf) + 0x3f * bf)}, ${Math.round(0x20 + bf * 0xb0)}, ${Math.round(0x20 + bf * 0x2a)})`
              : stressColor;
```

- [ ] **Step 3: Show the regen phase in the header when blooming**

In the derived UI values (~line 650), after `const phaseColor = ...`, add a bloom-aware label. Replace the header's `{PHASE_LABEL[uiPhase]}` (~line 707) usage by first computing near the other derived values:

```jsx
  const bloomFracUI = mapState.bloomFrac || 0;   // state-driven → re-renders correctly
  const ladderLabel = bloomFracUI > 0.02
    ? `${['3.3.3','4.4.4.4','5.5.5.5.5','6.6.6.6.6.6','7.7.7.7.7.7.7'][bloomPhase(bloomFracUI)]} ${REGEN_NAME[bloomPhase(bloomFracUI)]}`
    : PHASE_LABEL[uiPhase];
```

Then change the header span to render `{ladderLabel}` instead of `{PHASE_LABEL[uiPhase]}`, and make its color green when blooming:

```jsx
          style={{ color: bloomFracUI > 0.02 ? '#5fbf3a' : phaseColor, textShadow: `0 0 12px ${bloomFracUI > 0.02 ? '#5fbf3a' : phaseColor}60` }}
```

- [ ] **Step 4: Browser-verify the full reverse-heal**

Reload the ecocide tab.
- GROWTH ~1.0%, expand PROTECTION_PROTOCOL, ramp SANCTUARY + RESTORATION.
- Confirm: country cells shift from baseline green toward vivid green/gold; they do NOT drift/fracture; the header label climbs RECOVERY→REWILDING→FLOURISHING→ABUNDANCE in green; the lower-map hotspots fade from red toward green.
- Then push GROWTH to 5%: confirm blooming stops and (with sustained high growth) the collapse path re-engages.

Screenshot the FLOURISHING state and the COLLAPSE state side by side to confirm the bidirectional identity reads.

Expected: healing is unmistakably visible; collapse path unchanged; no console errors; `npm test` still green.

- [ ] **Step 5: Run the full suite + commit**

```bash
npm test
git add src/terminal/views/EcocideTab.jsx
git commit -m "feat(ecocide): SVG map heals in reverse — re-green cells, flip hotspots, regen ladder label"
```

---

## Phase 1 Definition of Done

- All engine unit tests green; `npm test` green (incl. `periphery.test.js` phase-name contract).
- On the ecocide tab: high growth still collapses the world exactly as before; low growth + funded protection visibly heals it (re-green, knit, hotspots flip, header climbs the regen ladder); maxed protection at 5% growth heals nothing (greenwash invariant visible via the GATE CLOSED note).
- PROTECTION_PROTOCOL cluster expands/collapses and holds on mobile.
- Browser-verified with screenshots of both the FLOURISHING and COLLAPSE states.
- **Out of scope (later phases):** WebGL Gray-Scott life-field (Phase 2); ATMOSPHERIC overhaul + degrowth doctrine text + GAIA chop + Regeneration Doctrine rail (Phase 3); removing dead WASM plumbing.

## Self-Review Notes

- **Spec coverage:** §3.1–3.2 signed vitality + gate → Tasks 1, 5. §3.3 double-bind reframe → Tasks 2, 5. §4.1 SVG reverse map → Task 7. §7 slider UX (hero growth + collapsible protections) → Task 6. §3.4 engine-is-new-code risk → Task 5 replaces the integrator wholesale. Phase-2 (§4.2) and Phase-3 (§5, §6) correctly excluded.
- **Contract safety:** `PHASE_NAME`/`PH` untouched (Task 5 keeps the collapse thresholds); regen names live in the separate `REGEN_NAME` (Task 3). `periphery.test.js` is an explicit regression gate in Tasks 5 and 7.
- **Type consistency:** `stepVitality`→`{v,extraction,...}`, `deriveFracs`→`{deadFrac,bloomFrac}`, `bloomPhase(bloomFrac)`→`0..4`, `socialPenaltyLevel(...)`→`0..3` used consistently across Tasks 1–3 and consumed as-defined in Tasks 5–7.
