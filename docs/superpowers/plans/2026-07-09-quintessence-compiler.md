# Quintessence Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the KERNEL OF QUINTESSENCE compiler — scale94.com's final synthesis: visitor choices (spine) + ambient witness (periphery) compile into a personalized, hash-sealed fork of the Fish Scale genome, triggered at the Mercury altar, deposited in the Kernel-tab reliquary.

**Architecture:** A new `src/terminal/quintessence/` module holds a spine store (deliberate choices), a WASM engine adapter (calls the compiled `run_fish_scale_json`), and a pure deterministic compiler that renders a `.rs`-shaped text artifact. Mercury gains an altar section (compile trigger); KernelTab is replaced by the reliquary (live schematic pre-compile, sealed artifact post-compile). Two Rust changes: `run_fish_scale_json` export in the WASM crate, and the standalone genome upgraded to 11.2 so it compiles on stable.

**Tech Stack:** React 18 + Vite 5, vitest, plain-JS event-bus/store patterns (see `src/observatory/observatoryBus.js`), Rust 2021 → wasm-bindgen → wasm-pack (rebuild via `node scripts/import-rust.js`), Web Crypto SHA-256.

**Spec:** `docs/superpowers/specs/2026-07-09-kernel-of-art-quintessence-compiler-design.md` (read it first; §3.2 mapping table and §3.5 engine coupling are the heart).

**Coordination warning:** Two parallel sessions may be active in worktrees: (1) alien-copy sweep touching `MercuryTab.jsx` header strings and `BootSequence.jsx`; (2) gate-riddle deletion touching `App.jsx` (~line 1010) and `observatoryBus.js` `edge.gate`. This plan does NOT use `edge.gate` and does NOT edit boot/header copy. If a merge conflict appears in those zones, take the other branch's side for copy, ours for structure.

**Voice rules (spec §10):** copy uses `compile / seal / deposit / witness` — never `generate / submit / save`. No alien. No "X ENGAGED" HUD-slop lines. Lowercase anthropological-lyrical for small print.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/terminal/data/lunarAccords.js` | create | The 8 olfactory accords (extracted from LunarTab) + `DRYNESS` table |
| `src/terminal/views/LunarTab.jsx` | modify | Import accords from new module; add per-card `COMPILE PHASE →` pick affordance |
| `src/observatory/observatoryBus.js` | modify | Track `gaze.tabsVisited` (for periphery houses) |
| `src/observatory/__tests__/observatoryBus.tabsVisited.test.js` | create | Test for the above |
| `src/terminal/quintessence/spineStore.js` | create | Deliberate-choice store, localStorage-persisted, missing-vertebrae report |
| `src/terminal/quintessence/__tests__/spineStore.test.js` | create | Tests |
| `content/rust_kernels/src/kernels/fish_scale.rs` | modify | Extract `audit()` result struct; add `run_fish_scale_json`; native cargo test |
| `src/terminal/quintessence/engineWitness.js` | create | WASM adapter: trend→r_pressure, r→bpm, `witnessEngine()` |
| `src/terminal/quintessence/__tests__/engineWitness.test.js` | create | Tests (WASM mocked) |
| `src/terminal/quintessence/compileKernel.js` | create | Pure compiler: (spine, periphery, engine) → { source, hash, meta } |
| `src/terminal/quintessence/periphery.js` | create | Snapshot builder: observatoryBus totals/journal → PeripheralWitness data |
| `src/terminal/quintessence/__tests__/compileKernel.test.js` | create | Determinism + mapping + empty-houses tests |
| `src/terminal/quintessence/__tests__/periphery.test.js` | create | Periphery snapshot tests |
| `src/fish_scale_kernel_11.2.rs` | create | Genome 11.2 (stable, `UnsafeCell`, sound) — replaces 11.1 file |
| `src/fish_scale_kernel_11.1.rs` | delete | Superseded by 11.2 |
| `package.json` | modify | `check:genome` script (rustc compile-check) |
| `src/terminal/views/manifesto/useCouncilCollider.js` | modify | Write council synthesis into spineStore (line ~232) |
| `src/terminal/mercury/QuintessenceAltar.jsx` | create | Altar: gate check, element cards, ignition, deposit |
| `src/terminal/views/MercuryTab.jsx` | modify | Mount altar section |
| `src/terminal/App.jsx` | modify | Pass tab-navigation callback into MercuryTab |
| `src/terminal/quintessence/ReliquaryView.jsx` | create | Monument header + live schematic (pre) + sealed artifact (post) + copy vial |
| `src/terminal/views/KernelTab.jsx` | modify | Replace relic content with ReliquaryView |

**Testing note:** run tests with `npx vitest run <path>` from `F:\scale_9.4`. The suite is vitest 4 (`npm test` runs everything). Existing test style reference: `src/terminal/views/manifesto/__tests__/councilSynthesis.test.js`.

**E2E note:** the bsky trend picker is decomposed out (spec §8.1), so the altar stays gated on `NO TREND MARKED` in the browser until that ships. `spineStore.js` exposes a DEV-only `window.__quintessenceSpine` escape hatch so the full altar→reliquary flow can be exercised in the preview browser today.

---

### Task 1: Extract the eight accords into `lunarAccords.js` (+ DRYNESS table)

The 8 olfactory accords currently live as the module-level `LUNAR_ACCORDS` array inside `src/terminal/views/LunarTab.jsx` (starting ~line 141: DARK INCUBATION … MINERAL STILLNESS, keyed by `phase`/`accord` with top/heart/base/mechanism fields). The compiler needs them (and a dryness mapping) without importing a 1500-line view.

**Files:**
- Create: `src/terminal/data/lunarAccords.js`
- Modify: `src/terminal/views/LunarTab.jsx` (remove inline array, import instead)
- Test: `src/terminal/quintessence/__tests__/lunarAccords.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/quintessence/__tests__/lunarAccords.test.js
import { describe, it, expect } from 'vitest';
import { LUNAR_ACCORDS, DRYNESS, drynessFor } from '../../data/lunarAccords';

const NAMES = [
  'DARK INCUBATION', 'GREEN EMERGENCE', 'ANGULAR CITRUS', 'FLORAL AMPLIFICATION',
  'MAXIMUM PROJECTION', 'RESINOUS DESCENT', 'SMOKE DISSOLUTION', 'MINERAL STILLNESS',
];

describe('lunarAccords', () => {
  it('exports exactly the eight accords in cycle order', () => {
    expect(LUNAR_ACCORDS.map(a => a.accord)).toEqual(NAMES);
  });

  it('DRYNESS covers all eight accords with the spec §3.2 values', () => {
    expect(DRYNESS).toEqual({
      'DARK INCUBATION': 12, 'GREEN EMERGENCE': 24, 'ANGULAR CITRUS': 38,
      'FLORAL AMPLIFICATION': 50, 'MAXIMUM PROJECTION': 62, 'RESINOUS DESCENT': 74,
      'SMOKE DISSOLUTION': 85, 'MINERAL STILLNESS': 96,
    });
  });

  it('drynessFor is total: known accord → table value, unknown → 50 (center)', () => {
    expect(drynessFor('MINERAL STILLNESS')).toBe(96);
    expect(drynessFor('NOT A PHASE')).toBe(50);
    expect(drynessFor(null)).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/lunarAccords.test.js`
Expected: FAIL — cannot resolve `../../data/lunarAccords`

- [ ] **Step 3: Create the module by moving the array**

Cut the entire `const LUNAR_ACCORDS = [ … ];` array out of `LunarTab.jsx` (it starts at the `// ── Fragrance Recommendation Engine` comment ~line 137) and paste it verbatim into the new file, then append the dryness table:

```js
// src/terminal/data/lunarAccords.js — The eight olfactory accords of the lunar
// cycle. Extracted from LunarTab so the Quintessence Compiler can consume them
// without importing the view. Order = synodic cycle order (new → waning-crescent).

export const LUNAR_ACCORDS = [
  /* …the eight objects moved verbatim from LunarTab.jsx… */
];

// Spec §3.2: olfactory phase → Pirarucu.dryness_coefficient (asceticism axis).
// Monotone along the incubation→stillness arc.
export const DRYNESS = {
  'DARK INCUBATION': 12,
  'GREEN EMERGENCE': 24,
  'ANGULAR CITRUS': 38,
  'FLORAL AMPLIFICATION': 50,
  'MAXIMUM PROJECTION': 62,
  'RESINOUS DESCENT': 74,
  'SMOKE DISSOLUTION': 85,
  'MINERAL STILLNESS': 96,
};

export function drynessFor(accordName) {
  return DRYNESS[accordName] ?? 50;
}
```

In `LunarTab.jsx`, add at the top (with the other imports):

```js
import { LUNAR_ACCORDS } from '../data/lunarAccords';
```

- [ ] **Step 4: Run the new test AND the existing suite slice**

Run: `npx vitest run src/terminal/quintessence/__tests__/lunarAccords.test.js`
Expected: PASS (3 tests)
Run: `npx vitest run` (full suite — LunarTab has no test but a broken import would fail any suite-wide smoke)
Expected: no new failures vs. before the change.

- [ ] **Step 5: Verify LunarTab still renders**

Run: `npx vite build 2>&1 | tail -5` — Expected: build succeeds (catches the import path).

- [ ] **Step 6: Commit**

```bash
git add src/terminal/data/lunarAccords.js src/terminal/views/LunarTab.jsx src/terminal/quintessence/__tests__/lunarAccords.test.js
git commit -m "refactor(quintessence): extract LUNAR_ACCORDS + DRYNESS table to shared data module"
```

---

### Task 2: observatoryBus tracks visited tabs

Periphery houses for ecocide/ledger/privacy/surveillance derive from tab visits. `App.jsx` already emits `emitObs('gaze', 'tab_navigated', { tab })` on every navigation (App.jsx:716,726,790) — we only need the bus to remember distinct tabs (the journal ring-buffer caps at 256 and can scroll off).

**Files:**
- Modify: `src/observatory/observatoryBus.js`
- Test: `src/observatory/__tests__/observatoryBus.tabsVisited.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/observatory/__tests__/observatoryBus.tabsVisited.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { emit, getTotals, _resetForTests } from '../observatoryBus';

describe('gaze.tabsVisited', () => {
  beforeEach(() => _resetForTests());

  it('starts empty', () => {
    expect(getTotals().gaze.tabsVisited).toEqual({});
  });

  it('records distinct visited tabs with counts', () => {
    emit('gaze', 'tab_navigated', { tab: 'ecocide' });
    emit('gaze', 'tab_navigated', { tab: 'ecocide' });
    emit('gaze', 'tab_navigated', { tab: 'privacy' });
    expect(getTotals().gaze.tabsVisited).toEqual({ ecocide: 2, privacy: 1 });
  });

  it('ignores tab_navigated without a tab payload', () => {
    emit('gaze', 'tab_navigated', {});
    expect(getTotals().gaze.tabsVisited).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/observatory/__tests__/observatoryBus.tabsVisited.test.js`
Expected: FAIL — `tabsVisited` is undefined

- [ ] **Step 3: Implement**

In `observatoryBus.js` `makeTotals()`, change the `gaze` line to:

```js
    gaze: { sphereClicks: 0, lastLunar: null, lastScaling: null, tabsVisited: {}, last: null, lastTs: 0 },
```

In `updateTotals`, inside `case 'gaze':`, add after the existing kinds:

```js
      if (evt.kind === 'tab_navigated' && evt.payload.tab)
        t.tabsVisited[evt.payload.tab] = (t.tabsVisited[evt.payload.tab] || 0) + 1;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/observatory`
Expected: PASS (new + all existing observatory tests)

- [ ] **Step 5: Commit**

```bash
git add src/observatory/observatoryBus.js src/observatory/__tests__/observatoryBus.tabsVisited.test.js
git commit -m "feat(observatory): track distinct visited tabs in gaze totals"
```

---

### Task 3: spineStore — the deliberate choices

**Files:**
- Create: `src/terminal/quintessence/spineStore.js`
- Test: `src/terminal/quintessence/__tests__/spineStore.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/quintessence/__tests__/spineStore.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSpine, setTrend, setCouncil, setPhase, setElement,
  missingVertebrae, subscribeSpine, _resetSpineForTests,
} from '../spineStore';

describe('spineStore', () => {
  beforeEach(() => _resetSpineForTests());

  it('starts with an empty spine and reports all missing vertebrae', () => {
    expect(getSpine()).toEqual({ trend: null, council: null, phase: null, element: null });
    expect(missingVertebrae()).toEqual(['NO TREND MARKED', 'NO COUNCIL COLLISION', 'NO PHASE COMPILED']);
  });

  it('stores each vertebra and clears its absence', () => {
    setTrend({ label: 'degrowth', velocity: 0.7 });
    setCouncil({ pair: ['OSTROM', 'WIENER'], directive: 'You are synthesizing…', trajectory: 'FOUNDATION', paradoxCount: 3 });
    setPhase('SMOKE DISSOLUTION');
    expect(missingVertebrae()).toEqual([]);
    expect(getSpine().phase).toBe('SMOKE DISSOLUTION');
  });

  it('element is NOT part of the gate (it is chosen at the altar click)', () => {
    setTrend({ label: 'x', velocity: 0 });
    setCouncil({ pair: ['A', 'B'], directive: 'd', trajectory: 'CEILING', paradoxCount: 0 });
    setPhase('DARK INCUBATION');
    expect(missingVertebrae()).toEqual([]);
    setElement('FIRE');
    expect(getSpine().element).toBe('FIRE');
  });

  it('rejects unknown phases and elements', () => {
    expect(() => setPhase('MOIST NONSENSE')).toThrow();
    expect(() => setElement('PLASMA')).toThrow();
  });

  it('notifies subscribers on every write', () => {
    const seen = [];
    const un = subscribeSpine(s => seen.push(s.phase));
    setPhase('GREEN EMERGENCE');
    un();
    setPhase('DARK INCUBATION');
    expect(seen).toEqual(['GREEN EMERGENCE']);
  });

  it('persists to localStorage and restores', () => {
    setPhase('MAXIMUM PROJECTION');
    // simulate reload: reset in-memory only, then re-read
    _resetSpineForTests({ keepStorage: true });
    expect(getSpine().phase).toBe('MAXIMUM PROJECTION');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/spineStore.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```js
// src/terminal/quintessence/spineStore.js — the deliberate choices (spec §6).
// Bus-adjacent store, same discipline as observatoryBus: no React, listeners
// are a Set, localStorage-persisted so a reload mid-journey keeps the spine.
// The element is written at the altar click (spec §4) and is not gate-checked.
import { LUNAR_ACCORDS } from '../data/lunarAccords';

const STORAGE_KEY = 'quintessence_spine_v1';
const ELEMENTS = ['FIRE', 'EARTH', 'WATER', 'AIR'];
const PHASES = LUNAR_ACCORDS.map(a => a.accord);

const emptySpine = () => ({ trend: null, council: null, phase: null, element: null });

let spine = restore();
const listeners = new Set();

function restore() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) return { ...emptySpine(), ...JSON.parse(raw) };
  } catch (_) { /* volatile spine is acceptable */ }
  return emptySpine();
}

function persist() {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(spine)); }
  catch (_) { /* volatile spine is acceptable */ }
}

function write(patch) {
  spine = { ...spine, ...patch };
  persist();
  listeners.forEach(fn => { try { fn(spine); } catch (_) {} });
}

export function getSpine() { return { ...spine }; }

export function setTrend(trend) {
  // Contract for the future bsky picker (spec §8.1):
  // { label: string, velocity: number in [0,1], volume?: number|null }
  write({ trend: { label: String(trend.label), velocity: Number(trend.velocity) || 0, volume: trend.volume ?? null } });
}

export function setCouncil(council) {
  // From the SYNTHESIS record (councilSynthesis.js): pair labels, directive,
  // trajectory, count of surviving paradoxes.
  write({ council: {
    pair: council.pair, directive: council.directive,
    trajectory: council.trajectory, paradoxCount: council.paradoxCount ?? 0,
  } });
}

export function setPhase(accordName) {
  if (!PHASES.includes(accordName)) throw new Error(`unknown olfactory phase: ${accordName}`);
  write({ phase: accordName });
}

export function setElement(element) {
  if (!ELEMENTS.includes(element)) throw new Error(`unknown element: ${element}`);
  write({ element });
}

export function missingVertebrae() {
  const missing = [];
  if (!spine.trend)   missing.push('NO TREND MARKED');
  if (!spine.council) missing.push('NO COUNCIL COLLISION');
  if (!spine.phase)   missing.push('NO PHASE COMPILED');
  return missing;
}

export function subscribeSpine(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function _resetSpineForTests(opts = {}) {
  if (!opts.keepStorage) { try { globalThis.localStorage?.removeItem(STORAGE_KEY); } catch (_) {} }
  spine = restore();
  if (!opts.keepStorage) spine = emptySpine();
  listeners.clear();
}

// DEV escape hatch: lets the altar→reliquary flow be exercised in the browser
// before the bsky trend picker ships (spec §8.1). Stripped from prod builds.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__quintessenceSpine = { getSpine, setTrend, setCouncil, setPhase, setElement };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/terminal/quintessence/__tests__/spineStore.test.js`
Expected: PASS (6 tests). Note: vitest 4 with jsdom environment provides localStorage; if the project's default environment is `node`, add `// @vitest-environment jsdom` as the first line of the test file.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/spineStore.js src/terminal/quintessence/__tests__/spineStore.test.js
git commit -m "feat(quintessence): spineStore for deliberate choices with persistence and gate report"
```

---

### Task 4: Wire the spine writers (council + phase pick)

**Files:**
- Modify: `src/terminal/views/manifesto/useCouncilCollider.js` (~line 232)
- Modify: `src/terminal/views/LunarTab.jsx` (accord cards get a pick affordance)

- [ ] **Step 1: Council write.** In `useCouncilCollider.js`, add the import at the top:

```js
import { setCouncil } from '../../quintessence/spineStore';
```

Directly after `const record = synthesize(entryA, entryB, sim.collideResult, sim.ordinal);` (line ~232), add:

```js
      // Quintessence spine: the council collision is a deliberate vertebra (spec §3.2)
      setCouncil({
        pair: record.pair.map(p => p.kind === 'mind' ? p.anchorName : p.label),
        directive: record.directive,
        trajectory: record.metrics.trajectory,
        paradoxCount: record.sections.openQuestions.length,
      });
```

- [ ] **Step 2: Phase pick.** In `LunarTab.jsx`, find where the accord cards render (the `.map` over `LUNAR_ACCORDS` — search for `accord.accord` or `LUNAR_ACCORDS.map`). Import at top:

```js
import { setPhase, getSpine } from '../quintessence/spineStore';
```

Inside the accord card JSX, after the concentration/sillage row, add a pick affordance (adapt the wrapping classNames to the card's existing structure — keep its color fields):

```jsx
<button
  type="button"
  onClick={() => setPhase(accord.accord)}
  className={`mt-3 w-full text-[9px] font-mono tracking-[0.25em] uppercase border px-2 py-1.5 transition-colors ${
    getSpine().phase === accord.accord
      ? 'border-amber-400/60 text-amber-300'
      : 'border-zinc-700/60 text-zinc-500 hover:border-zinc-500/60 hover:text-zinc-300'
  }`}
>
  {getSpine().phase === accord.accord ? '◈ phase compiled' : 'compile phase →'}
</button>
```

Note: the card list must re-render on pick for the `◈ phase compiled` state to show. If the cards are inside a memoized block, add a local `const [, force] = useReducer(x => x + 1, 0)` and `useEffect(() => subscribeSpine(force), [])` (import `subscribeSpine` too) in the component that renders the cards.

- [ ] **Step 3: Verify in the preview browser**

Start the dev server (preview tools / `launch.json`), open the manifesto tab, fire a council collision, then open lunar and click `compile phase →` on a card. In the browser console run `window.__quintessenceSpine.getSpine()` — Expected: `council` and `phase` populated; `missingVertebrae` would report only `NO TREND MARKED`.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run` — Expected: no new failures (manifesto tests still pass; `setCouncil` is a pure store write).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/useCouncilCollider.js src/terminal/views/LunarTab.jsx
git commit -m "feat(quintessence): council synthesis and lunar accord pick write to the spine"
```

---

### Task 5: Rust — `run_fish_scale_json` (Amendment A prerequisite)

Refactor `fish_scale.rs` so the computation is shared between the existing ASCII renderer and a new JSON export. `serde_json` is already a crate dependency (with `alloc` feature) — use the `serde_json::json!` macro, no derive needed.

**Files:**
- Modify: `content/rust_kernels/src/kernels/fish_scale.rs`

- [ ] **Step 1: Write the failing native test.** Append to the bottom of `fish_scale.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_export_parses_and_matches_ascii_regime() {
        let ascii = run_fish_scale(3.8, 32.0, 36.0, 1.0);
        let json_s = run_fish_scale_json(3.8, 32.0, 36.0, 1.0);
        let v: serde_json::Value = serde_json::from_str(&json_s).expect("valid JSON");
        // Same computation, two views: the regime name must appear in both.
        let regime = v["regime"].as_str().unwrap();
        assert!(ascii.contains(regime), "ASCII output should contain regime {regime}");
        assert!(v["integrity"].as_f64().unwrap() >= 0.0);
        assert!(v["axioms_active"].as_u64().unwrap() <= 9);
        assert!(v["lyapunov"].is_number());
        assert!(v["in_sanctuary"].is_boolean());
        assert!(v["layers"].as_u64().unwrap() >= 1);
    }

    #[test]
    fn json_deterministic() {
        assert_eq!(run_fish_scale_json(3.2, 16.0, 36.0, 0.8),
                   run_fish_scale_json(3.2, 16.0, 36.0, 0.8));
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run (from `content/rust_kernels`): `cargo test --lib fish_scale 2>&1 | tail -5`
Expected: compile error — `run_fish_scale_json` not found.

- [ ] **Step 3: Implement.** In `fish_scale.rs`, just above the `WASM ENTRY POINT` banner, add a result struct and extract the computation currently at the top of `run_fish_scale` (lines ~341–397: the clamps, `compute_lyapunov`, `estimate_period`, `build_bouligand_stack`, `detect_saponification`, `scan_sanctuary_nodes`, `compute_moire_spectrum`, `classify_regime`, integrity score, burn status/proximity, delta convergence) into a private fn:

```rust
// ── Shared audit: one computation, two views (ASCII + JSON) ──────────────────
struct FishScaleAudit {
    r: f64,
    n_lay: usize,
    theta: f64,
    lyapunov: f64,
    period: usize,
    layers: Vec<BouligandLayer>,
    saponi: SaponificationWindow,
    sanctuaries: Vec<(f64, f64)>,
    moire: Vec<MoireAnalysis>,
    regime_name: &'static str,
    regime_desc: &'static str,
    total_armor: f64,
    integrity: f64,
    in_sanctuary: bool,
    burn_status: &'static str,
    burn_proximity: f64,
    deltas: (f64, f64, f64),
}

fn audit_fish_scale(r_pressure: f64, max_layers: f64, theta_offset: f64, burn_sensitivity: f64) -> FishScaleAudit {
    // …move the existing computation block here verbatim, ending with…
    FishScaleAudit {
        r, n_lay, theta, lyapunov, period, layers, saponi, sanctuaries, moire,
        regime_name, regime_desc, total_armor, integrity, in_sanctuary,
        burn_status, burn_proximity, deltas: (delta1, delta2, delta3),
    }
}
```

Rewrite `run_fish_scale` to open with `let a = audit_fish_scale(r_pressure, max_layers, theta_offset, burn_sensitivity);` and replace every local reference in the rendering half with the `a.` field (`r`→`a.r`, `layers`→`a.layers`, `regime_name`→`a.regime_name`, etc. — mechanical, no logic changes). Then add the JSON export after it:

```rust
/// Machine-readable sibling of run_fish_scale (Quintessence Compiler, spec §3.5).
/// Same computation, JSON view. Field names are load-bearing for engineWitness.js.
#[wasm_bindgen]
pub fn run_fish_scale_json(
    r_pressure: f64, max_layers: f64, theta_offset: f64, burn_sensitivity: f64,
) -> String {
    let a = audit_fish_scale(r_pressure, max_layers, theta_offset, burn_sensitivity);
    serde_json::json!({
        "v": "12.1.0",
        "r": a.r,
        "regime": a.regime_name,
        "regime_desc": a.regime_desc,
        "period": a.period,
        "lyapunov": a.lyapunov,
        "layers": a.layers.len(),
        "armor_density": a.total_armor,
        "integrity": a.integrity,
        "in_sanctuary": a.in_sanctuary,
        "axioms_active": evaluate_axioms(a.r, &a.layers, a.lyapunov,
            a.in_sanctuary || !a.sanctuaries.is_empty())
            .iter().filter(|x| x.1).count(),
        "saponification": {
            "r_start": a.saponi.r_start, "r_end": a.saponi.r_end,
            "optimal_r": a.saponi.optimal_r, "status": a.burn_status,
            "proximity": a.burn_proximity,
        },
    }).to_string()
}
```

- [ ] **Step 4: Run the tests**

Run: `cargo test --lib fish_scale 2>&1 | tail -5`
Expected: `test result: ok. 2 passed` (plus any pre-existing fish_scale tests).

- [ ] **Step 5: Rebuild the WASM bundle**

Run (from `F:\scale_9.4`): `node scripts/import-rust.js 2>&1 | tail -10`
Expected: wasm-pack build succeeds; then verify the export landed:
`grep -c "run_fish_scale_json" src/wasm/scale94_kernels.d.ts` → Expected: `>= 1`.
(Do NOT use `build-wasm.cmd` — it hardcodes a stale `E:\` drive path.)

- [ ] **Step 6: Commit**

```bash
git add content/rust_kernels/src/kernels/fish_scale.rs src/wasm
git commit -m "feat(rust): run_fish_scale_json machine-readable export via shared audit struct"
```

---

### Task 6: Genome 11.2 (Amendment B)

**Files:**
- Create: `src/fish_scale_kernel_11.2.rs`
- Delete: `src/fish_scale_kernel_11.1.rs`
- Modify: `package.json` (add `check:genome` script)

- [ ] **Step 1: Create 11.2.** Copy `src/fish_scale_kernel_11.1.rs` to `src/fish_scale_kernel_11.2.rs`, then make exactly these changes (everything else — every struct, name, and doc-comment — stays verbatim):

1. Header: delete the line `#![feature(alloc_error_handler)]`. Update the version banner comment to `FISH SCALE KERNEL 11.2 :: RUST IMPLEMENTATION` and append to the header block:
```rust
// 11.2 (Quintessence era): the genome now passes its own Execution Test.
// Stable no_std. The levamisole exploit corrupts through UnsafeCell —
// sanctioned corruption the type system co-signs, not undefined behavior.
```
2. `Pirarucu` gains real interior mutability:
```rust
struct Pirarucu<T> {
    /// The "Scale" is the protective mineralized layer.
    /// It is physically dry and resistant to entropy — but the armor is
    /// an UnsafeCell: the corruption channel ships inside the purity.
    armor: UnsafeCell<T>,
    /// Patch 5.4 (Drying): Ensures structural integrity.
    dryness_coefficient: u8,
}

impl<T> Pirarucu<T> {
    pub fn new_pristine(data: T) -> Self {
        Self { armor: UnsafeCell::new(data), dryness_coefficient: 100 }
    }
}
```
3. The exploit becomes defined behavior:
```rust
    /// # Safety
    /// This is chemically violent — but sanctioned. UnsafeCell is the one
    /// channel through which the compiler permits mutation behind armor.
    /// Caller must guarantee no aliased access during the injection.
    pub unsafe fn inject_levamisole<T>(target: &Pirarucu<T>) -> &mut T {
        // The sheen of the "False Fish Scale" — interior mutability,
        // the corruption the type system co-signs.
        &mut *target.armor.get()
    }
```
4. In `run_cycle`, the read of the ideal must go through the cell too — replace `let _view = &ideal.armor;` with `let _view = ideal.armor.get();` and prefix the unused injection binding to silence the warning: `let _corrupted_state = Narcos::inject_levamisole(ideal);`.

- [ ] **Step 2: Add the compile-check script.** In `package.json` `"scripts"`, add:

```json
    "check:genome": "rustc --edition 2021 --crate-type rlib --emit=metadata -o target-genome-check.rmeta src/fish_scale_kernel_11.2.rs && node -e \"require('fs').unlinkSync('target-genome-check.rmeta')\"",
```

- [ ] **Step 3: Run the Execution Test**

Run: `npm run check:genome`
Expected: exits 0, no errors. (Warnings about dead code are acceptable — the file carries `#![allow(dead_code)]`.) If `#[panic_handler]` errors in rlib mode, change the script's crate-type to `lib` and re-run; one of the two passes on stable.

- [ ] **Step 4: Delete 11.1 and sweep references**

```bash
git rm src/fish_scale_kernel_11.1.rs
```
Then `grep -rn "fish_scale_kernel_11.1" src/ docs/` — update any live code references to `11.2` (docs/specs may keep historical mentions).

- [ ] **Step 5: Commit**

```bash
git add -A src/fish_scale_kernel_11.2.rs package.json
git commit -m "feat(genome): Fish Scale 11.2 — stable no_std, UnsafeCell-sanctioned corruption, Execution Test in npm scripts"
```

---

### Task 7: engineWitness — the WASM adapter

**Files:**
- Create: `src/terminal/quintessence/engineWitness.js`
- Test: `src/terminal/quintessence/__tests__/engineWitness.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/quintessence/__tests__/engineWitness.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadWasmMock = vi.fn();
vi.mock('../../../wasm/wasmSingleton', () => ({ loadWasm: (...a) => loadWasmMock(...a) }));

import { trendToPressure, pressureToBpm, R_CHAOS, witnessEngine } from '../engineWitness';

describe('trendToPressure', () => {
  it('is monotone and bounded to [2.8, 4.0]', () => {
    expect(trendToPressure(0)).toBeCloseTo(2.8);
    expect(trendToPressure(1)).toBeCloseTo(4.0);
    expect(trendToPressure(0.5)).toBeGreaterThan(trendToPressure(0.2));
    expect(trendToPressure(-5)).toBeCloseTo(2.8);   // clamped
    expect(trendToPressure(99)).toBeCloseTo(4.0);   // clamped
  });
});

describe('pressureToBpm', () => {
  it('calibrates 160 exactly at chaos onset (spec §3.5)', () => {
    expect(pressureToBpm(R_CHAOS)).toBe(160);
    expect(pressureToBpm(R_CHAOS - 0.1)).toBeLessThan(160);   // Plomo side
    expect(pressureToBpm(4.0)).toBeGreaterThanOrEqual(160);   // Plata side
  });
});

describe('witnessEngine', () => {
  beforeEach(() => loadWasmMock.mockReset());

  it('normalizes a JSON result from run_fish_scale_json', async () => {
    loadWasmMock.mockResolvedValue({
      run_fish_scale_json: (r, layers, theta, burn) => JSON.stringify({
        regime: 'ARMOR_DENSE_CHAOS', integrity: 87.5, lyapunov: 0.42,
        axioms_active: 7, in_sanctuary: false, armor_density: 1.61, layers: 12,
        saponification: { status: 'POST-WINDOW — full chaos regime. Burn grip dissolves into noise.' },
      }),
    });
    const w = await witnessEngine({ rPressure: 3.8, maxLayers: 12, burnSensitivity: 0.85 });
    expect(w).toEqual({
      regime: 'ARMOR_DENSE_CHAOS', integrity: 87.5, lyapunov: 0.42,
      axiomsActive: 7, inSanctuary: false, armorDensity: 1.61, layers: 12,
      burnStatus: 'POST-WINDOW — full chaos regime. Burn grip dissolves into noise.',
    });
  });

  it('returns null when the module lacks the export (stale wasm)', async () => {
    loadWasmMock.mockResolvedValue({});
    expect(await witnessEngine({ rPressure: 3, maxLayers: 4, burnSensitivity: 1 })).toBeNull();
  });

  it('returns null when WASM init rejects (engine offline, spec §7)', async () => {
    loadWasmMock.mockRejectedValue(new Error('no wasm'));
    expect(await witnessEngine({ rPressure: 3, maxLayers: 4, burnSensitivity: 1 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/engineWitness.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```js
// src/terminal/quintessence/engineWitness.js — adapter over the compiled
// Fish Scale engine (spec §3.5). One source of truth: bifurcation math lives
// in WASM (run_fish_scale_json) — never reimplement it here. The JS constant
// below exists only for calibration and offline bpm fallback.
import { loadWasm } from '../../wasm/wasmSingleton';

// Feigenbaum point r_∞ — matches R_INF in fish_scale.rs and R_CHAOS in
// useAssociativeField.js. bpm 160 (the Plata threshold) sits exactly here.
export const R_CHAOS = 3.569945671877;

const THETA_FSK = 36.0; // canonical interlaminar angle, not visitor-varied in v1

export function trendToPressure(velocity) {
  const v = Math.min(1, Math.max(0, Number(velocity) || 0));
  return 2.8 + 1.2 * v; // the interesting band of the logistic map
}

export function pressureToBpm(r) {
  return Math.round(160 * (r / R_CHAOS));
}

/**
 * Calls the compiled engine. Returns normalized witness or null (engine
 * offline — the artifact then compiles its engine_witness houses as None).
 */
export async function witnessEngine({ rPressure, maxLayers, burnSensitivity }) {
  try {
    const mod = await loadWasm();
    if (typeof mod?.run_fish_scale_json !== 'function') return null;
    const raw = mod.run_fish_scale_json(rPressure, maxLayers, THETA_FSK, burnSensitivity);
    const j = JSON.parse(raw);
    return {
      regime: j.regime,
      integrity: j.integrity,
      lyapunov: j.lyapunov,
      axiomsActive: j.axioms_active,
      inSanctuary: j.in_sanctuary,
      armorDensity: j.armor_density,
      layers: j.layers,
      burnStatus: j.saponification?.status ?? null,
    };
  } catch (_) {
    return null;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/terminal/quintessence/__tests__/engineWitness.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/engineWitness.js src/terminal/quintessence/__tests__/engineWitness.test.js
git commit -m "feat(quintessence): engineWitness WASM adapter with bpm calibration at chaos onset"
```

---

### Task 8: periphery — the ambient witness snapshot

**Files:**
- Create: `src/terminal/quintessence/periphery.js`
- Test: `src/terminal/quintessence/__tests__/periphery.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/quintessence/__tests__/periphery.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { emit, _resetForTests } from '../../../observatory/observatoryBus';
import { snapshotPeriphery } from '../periphery';

describe('snapshotPeriphery', () => {
  beforeEach(() => _resetForTests());

  it('an untouched session yields all-None houses', () => {
    const p = snapshotPeriphery();
    expect(p).toEqual({
      ciphers: null, transmissions: null, essences: null,
      lunarRead: null, houses: { ecocide: null, ledger: null, privacy: null, surveillance: null },
    });
  });

  it('witnessed events become Some(value)', () => {
    emit('ciphers', 'verify', {});
    emit('ciphers', 'unlock', {});
    emit('transmissions', 'kernel_completed', { kernelId: 'FSF-12.1.0' });
    emit('transmissions', 'ledger_appended', { depth: 3 });
    emit('essences', 'collision_fired', { polarity: 'RADIANT' });
    emit('essences', 'crystallized', {});
    emit('gaze', 'lunar_read', { phase: 'Waxing Gibbous', illum: 0.82 });
    emit('gaze', 'tab_navigated', { tab: 'privacy' });
    emit('gaze', 'tab_navigated', { tab: 'bsky' }); // not a tracked house

    const p = snapshotPeriphery();
    expect(p.ciphers).toEqual({ sealed: 0, verifies: 1, unlocks: 1 });
    expect(p.transmissions).toEqual({ count: 1, ledgerDepth: 3, lastKernel: 'FSF-12.1.0' });
    expect(p.essences).toEqual({ collisions: 1, crystallized: 1, polarity: 'RADIANT' });
    expect(p.lunarRead).toEqual({ phase: 'Waxing Gibbous', illum: 0.82 });
    expect(p.houses).toEqual({ ecocide: null, ledger: null, privacy: 1, surveillance: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/periphery.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```js
// src/terminal/quintessence/periphery.js — the ambient witness (spec §3.4).
// Reads observatoryBus totals at compile time. null = empty house = Option::None.
// Never blocks, never throws: a dead bus compiles as an unwitnessed session.
import { getTotals } from '../../observatory/observatoryBus';

const TRACKED_HOUSES = ['ecocide', 'ledger', 'privacy', 'surveillance'];

export function snapshotPeriphery() {
  let t;
  try { t = getTotals(); } catch (_) { t = null; }

  const c = t?.ciphers, tr = t?.transmissions, e = t?.essences, g = t?.gaze;

  const ciphersSeen = (c?.sealed || 0) + (c?.verifies || 0) + (c?.unlocks || 0) > 0;
  const transSeen   = (tr?.count || 0) + (tr?.ledgerDepth || 0) > 0;
  const essSeen     = (e?.count || 0) + (e?.crystallized || 0) > 0;

  const houses = {};
  for (const h of TRACKED_HOUSES) {
    const n = g?.tabsVisited?.[h] || 0;
    houses[h] = n > 0 ? n : null;
  }

  return {
    ciphers: ciphersSeen
      ? { sealed: c.sealed, verifies: c.verifies, unlocks: c.unlocks } : null,
    transmissions: transSeen
      ? { count: tr.count, ledgerDepth: tr.ledgerDepth,
          lastKernel: tr.last?.payload?.kernelId ?? null } : null,
    essences: essSeen
      ? { collisions: e.count, crystallized: e.crystallized, polarity: e.polarity ?? null } : null,
    lunarRead: g?.lastLunar
      ? { phase: g.lastLunar.phase ?? null, illum: g.lastLunar.illum ?? null } : null,
    houses,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/terminal/quintessence/__tests__/periphery.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/periphery.js src/terminal/quintessence/__tests__/periphery.test.js
git commit -m "feat(quintessence): periphery snapshot — ambient witness with empty houses as null"
```

---

### Task 9: compileKernel — the compiler itself

The heart. Pure async function `(spine, periphery, engine, opts) → { source, hash, meta }`. Deterministic: seeded PRNG only (reuse `mulberry32` from `councilCollider.js`), hash via Web Crypto over the canonical input.

**Files:**
- Create: `src/terminal/quintessence/compileKernel.js`
- Test: `src/terminal/quintessence/__tests__/compileKernel.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/quintessence/__tests__/compileKernel.test.js
import { describe, it, expect } from 'vitest';
import { compileKernel, ELEMENT_MAP } from '../compileKernel';

const FULL_SPINE = {
  trend: { label: 'degrowth', velocity: 0.9, volume: 1200 },
  council: { pair: ['ELINOR OSTROM', 'NORBERT WIENER'],
             directive: 'You are synthesizing OSTROM × WIENER inside a post-capitalist structural frame.',
             trajectory: 'FOUNDATION', paradoxCount: 3 },
  phase: 'SMOKE DISSOLUTION',
  element: 'FIRE',
};

const FULL_PERIPHERY = {
  ciphers: { sealed: 1, verifies: 2, unlocks: 1 },
  transmissions: { count: 4, ledgerDepth: 2, lastKernel: 'FSF-12.1.0' },
  essences: { collisions: 2, crystallized: 1, polarity: 'RADIANT' },
  lunarRead: { phase: 'Waxing Gibbous', illum: 0.82 },
  houses: { ecocide: 1, ledger: null, privacy: 3, surveillance: null },
};

const ENGINE = {
  regime: 'ARMOR_DENSE_CHAOS', integrity: 87.5, lyapunov: 0.42, axiomsActive: 7,
  inSanctuary: false, armorDensity: 1.61, layers: 12, burnStatus: 'POST-WINDOW',
};

const OPTS = { compiledAt: '2026-07-09T12:00:00.000Z' };

describe('compileKernel', () => {
  it('is deterministic: same inputs → identical source and hash', async () => {
    const a = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    const b = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(a.source).toBe(b.source);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different element → different hash', async () => {
    const a = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    const b = await compileKernel({ ...FULL_SPINE, element: 'WATER' }, FULL_PERIPHERY, ENGINE, OPTS);
    expect(a.hash).not.toBe(b.hash);
  });

  it('header carries name, fork version, build hash prefix, and the axiom', async () => {
    const { source, hash } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source).toContain('KERNEL OF QUINTESSENCE :: FORK OF FISH SCALE 11.2 :: BUILD 0x' + hash.slice(0, 8).toUpperCase());
    expect(source).toContain('THIS IS A SEALED VIAL. CARRY IT OUT.');
    expect(source).toContain('Theory that cannot be compiled does not yet exist as knowledge.');
  });

  it('maps all four elements to daemon state and atom role (spec §3.2)', () => {
    expect(ELEMENT_MAP.FIRE).toEqual({ atom: 'Boson', daemon: 'TheDevil' });
    expect(ELEMENT_MAP.AIR).toEqual({ atom: 'Boson', daemon: 'TheDevil' });
    expect(ELEMENT_MAP.EARTH).toEqual({ atom: 'Fermion', daemon: 'TheMask' });
    expect(ELEMENT_MAP.WATER).toEqual({ atom: 'Fermion', daemon: 'TheMask' });
  });

  it('compiles dryness from the phase and embeds the directive', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source).toContain('dryness_coefficient: 85'); // SMOKE DISSOLUTION
    expect(source).toContain('post-capitalist structural frame');
  });

  it('bpm >= 160 → Plata; the verdict keys off trend velocity via r', async () => {
    const hot = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);      // v=0.9 → r=3.88 → bpm>160
    expect(hot.meta.verdict).toBe('PLATA');
    expect(hot.source).toContain('PlataOPlomo::Plata');
    const cold = await compileKernel(
      { ...FULL_SPINE, trend: { label: 'stasis', velocity: 0.0 } },
      FULL_PERIPHERY, ENGINE, OPTS);                                                // v=0 → r=2.8 → bpm<160
    expect(cold.meta.verdict).toBe('PLOMO');
    expect(cold.source).toContain('PlataOPlomo::Plomo');
  });

  it('empty houses compile as None with the witness comment', async () => {
    const bare = { ciphers: null, transmissions: null, essences: null, lunarRead: null,
                   houses: { ecocide: null, ledger: null, privacy: null, surveillance: null } };
    const { source } = await compileKernel(FULL_SPINE, bare, ENGINE, OPTS);
    expect(source).toContain('HOUSE EMPTY — never witnessed');
    expect(source).toContain('ciphers: None');
    expect(source).toContain('TRANSIT UNREAD — the clock was never wound');
    expect(source).toContain('AtomicU64::new(0)');
  });

  it('engine offline compiles the offline block, still verdicts via JS fallback', async () => {
    const { source, meta } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, null, OPTS);
    expect(source).toContain('ENGINE OFFLINE — constants unwitnessed');
    expect(meta.verdict).toBe('PLATA'); // bpm fallback still resolves
  });

  it('inherits the panic handler verbatim', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source).toContain('#[panic_handler]');
    expect(source).toContain('core::hint::spin_loop()');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/compileKernel.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```js
// src/terminal/quintessence/compileKernel.js — THE QUINTESSENCE COMPILER.
// Pure + deterministic (spec §3): (spine, periphery, engine, opts) → artifact.
// The genome is Fish Scale 11.2 (src/fish_scale_kernel_11.2.rs); this module
// templates a personalized fork of it. Wisdom lives in doc-comments; the
// visitor's life lives in parameter values. No Math.random() — mulberry32 only.
import { mulberry32 } from '../views/manifesto/councilCollider';
import { drynessFor } from '../data/lunarAccords';
import { trendToPressure, pressureToBpm } from './engineWitness';

export const ELEMENT_MAP = {
  FIRE:  { atom: 'Boson',   daemon: 'TheDevil' },
  AIR:   { atom: 'Boson',   daemon: 'TheDevil' },
  EARTH: { atom: 'Fermion', daemon: 'TheMask'  },
  WATER: { atom: 'Fermion', daemon: 'TheMask'  },
};

// ── deterministic helpers ────────────────────────────────────────────────────
function seedFrom(str) {
  let h = 2166136261 >>> 0;                       // FNV-1a
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// entropy_lock: wind the eternal-rave clock with the lunar transit.
// illumination in basis points × 100 — a u64-safe integer, 0 if unread.
function entropyLockValue(lunarRead) {
  if (!lunarRead || typeof lunarRead.illum !== 'number') return 0;
  return Math.round(lunarRead.illum * 10000) * 100;
}

// ── doc-comment voice (deterministic fragment pools) ─────────────────────────
const VIAL_LINES = [
  'the vial holds what the terminal could not keep',
  'condensed from one session of witnessed pressure',
  'a residue of filtering operations · what remains after the burn',
  'the fifth essence · distilled from four elements and one spine',
];
const CORRUPTION_LINES = [
  'purity is a statue · this payload is the pulse',
  'the network pulse enters the armor here',
  'vitality requires the contaminant · this is the contaminant',
  'injected at market temperature · sheen intact',
];

function houseLine(name, value, describe) {
  return value == null
    ? `    /// HOUSE EMPTY — never witnessed\n    ${name}: None,`
    : `    /// ${describe}\n    ${name}: Some(${JSON.stringify(value).replace(/"/g, '\\"')}),`;
}

// ── main ─────────────────────────────────────────────────────────────────────
/**
 * @param spine     { trend, council, phase, element }  (all present — altar gates)
 * @param periphery snapshotPeriphery() result (nullable fields)
 * @param engine    witnessEngine() result or null (offline)
 * @param opts      { compiledAt: ISO string } — injected for determinism/tests
 */
export async function compileKernel(spine, periphery, engine, opts = {}) {
  const compiledAt = opts.compiledAt ?? new Date().toISOString();
  const canonical = JSON.stringify({ spine, periphery, engine, compiledAt });
  const hash = await sha256Hex(canonical);
  const rng = mulberry32(seedFrom(hash));

  const el      = ELEMENT_MAP[spine.element];
  const dryness = drynessFor(spine.phase);
  const r       = trendToPressure(spine.trend.velocity);
  const bpm     = engine ? pressureToBpm(r) : pressureToBpm(r); // same math; engine adds witness constants
  const verdict = bpm >= 160 ? 'PLATA' : 'PLOMO';
  const lock    = entropyLockValue(periphery.lunarRead);
  const [mindA, mindB] = spine.council.pair;

  const engineBlock = engine ? `
/// Computed by compiled Rust at the quintessence event — not narrated, executed.
/// run_fish_scale(r=${r.toFixed(4)}, layers=witness depth, θ=36°, burn←${spine.phase})
mod engine_witness {
    pub const REGIME: &str        = "${engine.regime}";
    pub const INTEGRITY_PCT: f64  = ${engine.integrity};
    pub const LYAPUNOV: f64       = ${engine.lyapunov};
    pub const AXIOMS_ACTIVE: u8   = ${engine.axiomsActive}; // of 9
    pub const IN_SANCTUARY: bool  = ${engine.inSanctuary};
    pub const ARMOR_DENSITY: f64  = ${engine.armorDensity};
    pub const BOULIGAND_LAYERS: usize = ${engine.layers};
}` : `
/// ENGINE OFFLINE — constants unwitnessed. The cascade ran without its
/// instruments; the verdict below resolved from the calibration constant.
mod engine_witness { /* every field None */ }`;

  const lunarComment = periphery.lunarRead
    ? `/// wound with the transit: ${periphery.lunarRead.phase} · ${(periphery.lunarRead.illum * 100).toFixed(1)}% illuminated`
    : `/// TRANSIT UNREAD — the clock was never wound`;

  const source = `\
// ═══════════════════════════════════════════════════════════════
// KERNEL OF QUINTESSENCE :: FORK OF FISH SCALE 11.2 :: BUILD 0x${hash.slice(0, 8).toUpperCase()}
// COMPILED AT SCALE94.COM · QUINTESSENCE EVENT · ${compiledAt}
//
// THIS IS A SEALED VIAL. CARRY IT OUT.
// FEED IT TO ANY ORACLE AND ASK: WHAT DOES THIS SYSTEM WANT?
//
// Theory that cannot be compiled does not yet exist as knowledge.
// ═══════════════════════════════════════════════════════════════
#![no_std]

use core::sync::atomic::AtomicU64;
use core::cell::UnsafeCell;

/// ${pick(rng, VIAL_LINES)}
/// element: ${spine.element} · role: ${el.atom} · daemon compiled ${el.daemon === 'TheDevil' ? 'unmasked' : 'masked'}
enum ShlomoState { TheMask, TheDevil }
const DAEMON: ShlomoState = ShlomoState::${el.daemon};

/// **PIRARUCU** — the armored ideal, tempered by one olfactory phase.
/// phase: ${spine.phase} · the burn window was set here
struct Pirarucu<T> { armor: UnsafeCell<T>, dryness_coefficient: u8 }
const ARMOR: &str = ${JSON.stringify(periphery.essences?.polarity ? `${spine.phase} · polarity ${periphery.essences.polarity}` : spine.phase)};
const DRYNESS: Pirarucu<&str> = Pirarucu { armor: UnsafeCell::new(ARMOR), dryness_coefficient: ${dryness} };

/// **NARCOS** — ${pick(rng, CORRUPTION_LINES)}
/// the levamisole is the live network pulse, marked by the visitor:
const INJECTION_PAYLOAD: &str = ${JSON.stringify(spine.trend.label)};
const INJECTION_VELOCITY: f64 = ${spine.trend.velocity};

/// **SOKUSHINBUTSU** — living death, perfectly preserved.
${lunarComment}
static ENTROPY_LOCK: AtomicU64 = AtomicU64::new(${lock});

/// **THE NECROMANTIC ENGINE** — perpetual friction, never resolution.
/// This cycle reanimates: ${periphery.transmissions?.lastKernel ?? 'no mummy — the past was left unraised'}
/// The two forces in friction were chosen in council:
///   ${mindA}  ×  ${mindB}
/// ${spine.council.directive}
/// ${spine.council.paradoxCount} irreducible tension${spine.council.paradoxCount === 1 ? '' : 's'} survive saponification · trajectory ${spine.council.trajectory}
struct NecromanticEngine { bpm: u32, friction_coefficient: f64 }
const ENGINE: NecromanticEngine = NecromanticEngine {
    bpm: ${bpm}, // feigenbaum-processed network pulse · 160 = chaos onset
    friction_coefficient: ${spine.council.paradoxCount}.0,
};

/// THE VERDICT — computed, not chosen.
enum PlataOPlomo { Plata, Plomo }
const VERDICT: PlataOPlomo = PlataOPlomo::${verdict === 'PLATA' ? 'Plata' : 'Plomo'};
${verdict === 'PLATA'
  ? '/// vitality through corruption · the system lives compromised'
  : '/// purity chosen over life · entropic stasis · the statue wins this round'}
${engineBlock}

/// THE PERIPHERAL WITNESS — what the terminal saw without being asked.
/// Empty houses are part of the portrait. Absence is data.
struct PeripheralWitness;
mod peripheral_witness {
${houseLine('ciphers', periphery.ciphers, `cryptographic proof: ${periphery.ciphers?.verifies ?? 0} verified · ${periphery.ciphers?.unlocks ?? 0} unlocked · ${periphery.ciphers?.sealed ?? 0} sealed`)}
${houseLine('transmissions', periphery.transmissions, `${periphery.transmissions?.count ?? 0} kernels completed · ledger depth ${periphery.transmissions?.ledgerDepth ?? 0}`)}
${houseLine('essences', periphery.essences, `${periphery.essences?.collisions ?? 0} collisions · ${periphery.essences?.crystallized ?? 0} crystallized`)}
${houseLine('house_ecocide', periphery.houses.ecocide, `entered ${periphery.houses.ecocide}×`)}
${houseLine('house_ledger', periphery.houses.ledger, `entered ${periphery.houses.ledger}×`)}
${houseLine('house_privacy', periphery.houses.privacy, `entered ${periphery.houses.privacy}×`)}
${houseLine('house_surveillance', periphery.houses.surveillance, `entered ${periphery.houses.surveillance}×`)}
}

/// **PANIC HANDLER** — inherited verbatim from the genome.
/// When this system fails, it does not crash — it calcifies.
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop { core::hint::spin_loop(); }
}
`;

  return {
    source,
    hash,
    meta: { compiledAt, verdict, bpm, r, dryness, element: spine.element,
            daemon: el.daemon, atom: el.atom, engineOnline: !!engine },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/terminal/quintessence/__tests__/compileKernel.test.js`
Expected: PASS (9 tests). If `crypto.subtle` is undefined, the vitest environment is too old a node — the project uses vitest 4 / modern node where `globalThis.crypto` is standard; investigate rather than polyfill.

- [ ] **Step 5: Run the whole quintessence suite**

Run: `npx vitest run src/terminal/quintessence`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/quintessence/compileKernel.js src/terminal/quintessence/__tests__/compileKernel.test.js
git commit -m "feat(quintessence): the compiler — deterministic KERNEL_OF_QUINTESSENCE.rs artifact"
```

---

### Task 10: QuintessenceAltar in Mercury

**Files:**
- Create: `src/terminal/mercury/QuintessenceAltar.jsx`
- Modify: `src/terminal/views/MercuryTab.jsx` (mount altar), `src/terminal/App.jsx` (pass navigation)

- [ ] **Step 1: Implement the altar component**

```jsx
// src/terminal/mercury/QuintessenceAltar.jsx — the altar (spec §4).
// Four elements · one click · the quintessence compiles. The nebula ignites
// only when the deliberate spine exists; otherwise absences are named.
import { useEffect, useReducer, useState } from 'react';
import { getSpine, setElement, missingVertebrae, subscribeSpine } from '../quintessence/spineStore';
import { snapshotPeriphery } from '../quintessence/periphery';
import { witnessEngine, trendToPressure } from '../quintessence/engineWitness';
import { compileKernel } from '../quintessence/compileKernel';
import { drynessFor } from '../data/lunarAccords';

const ELEMENTS = [
  { id: 'FIRE',  sigil: '△', note: 'boson · force · the mask drops'   },
  { id: 'AIR',   sigil: '🜁', note: 'boson · carrier · the mask drops' },
  { id: 'EARTH', sigil: '🜃', note: 'fermion · structure · armor held' },
  { id: 'WATER', sigil: '▽', note: 'fermion · matter · armor held'    },
];

const STAGES = ['SPINE READ', 'PERIPHERY WITNESSED', 'ENGINE FIRED', 'HASH PRECIPITATED', 'VERDICT', 'SEALED'];
export const STORAGE_KEY = 'quintessence_kernel_v1';

export default function QuintessenceAltar({ onDeposited }) {
  const [, force] = useReducer(x => x + 1, 0);
  const [stage, setStage] = useState(-1);          // -1 idle, 0..5 compiling, 6 done
  const [result, setResult] = useState(null);
  useEffect(() => subscribeSpine(force), []);

  const missing = missingVertebrae();
  const armed = missing.length === 0 && stage === -1;

  async function ignite(elementId) {
    if (!armed) return;
    // Spec §5.2: the reliquary holds one kernel at a time — recompile confirms.
    try {
      if (localStorage.getItem(STORAGE_KEY) &&
          !window.confirm('the reliquary holds one kernel · recompile and overwrite the seal?')) return;
    } catch (_) { /* no storage → nothing to overwrite */ }
    setElement(elementId);
    const spine = getSpine();
    const periphery = snapshotPeriphery();
    // Staged reveal — Crystallize lineage: each beat lands, then the next
    for (let s = 0; s < 3; s++) { setStage(s); await new Promise(r => setTimeout(r, 650)); }
    const filledHouses = Object.values(periphery.houses).filter(Boolean).length
      + ['ciphers', 'transmissions', 'essences', 'lunarRead'].filter(k => periphery[k]).length
      + 4; // the four spine vertebrae themselves
    const engine = await witnessEngine({
      rPressure: trendToPressure(spine.trend.velocity),
      maxLayers: Math.max(4, filledHouses),
      burnSensitivity: Math.max(0.1, Math.min(2.0, drynessFor(spine.phase) / 50)),
    });
    for (let s = 3; s < 6; s++) { setStage(s); await new Promise(r => setTimeout(r, 650)); }
    const artifact = await compileKernel(spine, periphery, engine);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(artifact)); } catch (_) {}
    setResult(artifact);
    setStage(6);
  }

  return (
    <div className="mt-8 border border-zinc-800/60 p-5" data-testid="quintessence-altar">
      <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-zinc-500 mb-1">
        ⌘ quintessence altar
      </div>
      <div className="text-[9px] font-mono text-zinc-600 mb-4 lowercase">
        four elements are bound to the earth · the fifth is compiled from your spine
      </div>

      {stage === -1 && missing.length > 0 && (
        <div className="text-[10px] font-mono tracking-[0.2em] text-red-400/70 uppercase">
          SPINE INCOMPLETE · {missing.join(' · ')}
        </div>
      )}

      {stage === -1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          {ELEMENTS.map(el => (
            <button key={el.id} type="button" disabled={!armed}
              onClick={() => ignite(el.id)}
              className={`border p-4 text-center font-mono transition-colors ${armed
                ? 'border-amber-500/40 text-amber-200 hover:border-amber-300 hover:bg-amber-950/20 cursor-pointer'
                : 'border-zinc-800 text-zinc-700 cursor-not-allowed'}`}>
              <div className="text-2xl mb-2">{el.sigil}</div>
              <div className="text-[11px] tracking-[0.3em]">{el.id}</div>
              <div className="text-[8px] text-zinc-500 mt-1 lowercase">{el.note}</div>
            </button>
          ))}
        </div>
      )}

      {stage >= 0 && stage < 6 && (
        <div className="font-mono text-[10px] tracking-[0.25em] text-amber-300/90 uppercase py-6">
          {STAGES.slice(0, stage + 1).map(s => <div key={s} className="mb-1">✓ {s}</div>)}
        </div>
      )}

      {stage === 6 && result && (
        <div className="py-4">
          <div className="font-mono text-[11px] text-amber-200 tracking-[0.2em] uppercase mb-1">
            ◈ BUILD 0x{result.hash.slice(0, 8).toUpperCase()} · VERDICT {result.meta.verdict}
          </div>
          <button type="button" onClick={() => onDeposited?.()}
            className="mt-2 border border-amber-400/60 text-amber-200 font-mono text-[10px] tracking-[0.3em] uppercase px-4 py-2 hover:bg-amber-950/30">
            deposited in reliquary →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount in MercuryTab.** In `MercuryTab.jsx`: `MercuryTab` currently takes no props — change the signature to `export default function MercuryTab({ onNavigateToKernel })`. Import the altar and render it between `<CastleGrid …/>` and `<CosmosRegistry />`:

```jsx
import QuintessenceAltar from '../mercury/QuintessenceAltar';
…
      {/* §B.5 — The Quintessence Altar (spec §4): the compile trigger */}
      <QuintessenceAltar onDeposited={onNavigateToKernel} />
```

- [ ] **Step 3: Wire navigation from App.** In `App.jsx`, find where `<MercuryTab` is rendered (search `<MercuryTab`). App owns tab switching — the function that calls `emitObs('gaze', 'tab_navigated', …)` (used at lines ~716/726/790). Pass it down targeting the kernel tab id (search App.jsx for the kernel tab's id string — the tab list will name it, likely `'kernel'`):

```jsx
<MercuryTab onNavigateToKernel={() => handleTabSelect('kernel')} />
```

(Use the actual tab-switch function name and kernel tab id found in App.jsx — verify by searching for how other views trigger `setCurrentTab`/`handleTabSelect`.)

- [ ] **Step 4: Verify in the preview browser.** Dev server up; in console:

```js
window.__quintessenceSpine.setTrend({ label: 'degrowth', velocity: 0.9 });
window.__quintessenceSpine.setCouncil({ pair: ['OSTROM','WIENER'], directive: 'test directive', trajectory: 'FOUNDATION', paradoxCount: 2 });
window.__quintessenceSpine.setPhase('SMOKE DISSOLUTION');
```

Open mercury tab → altar shows four lit element cards (not `SPINE INCOMPLETE`). Click FIRE → staged reveal runs → `◈ BUILD 0x… · VERDICT PLATA` → `deposited in reliquary →` navigates to the kernel tab. Also verify `localStorage.getItem('quintessence_kernel_v1')` is populated and check the browser console for errors.

- [ ] **Step 5: Run full suite + commit**

Run: `npx vitest run` — Expected: green.

```bash
git add src/terminal/mercury/QuintessenceAltar.jsx src/terminal/views/MercuryTab.jsx src/terminal/App.jsx
git commit -m "feat(quintessence): Mercury altar — element trigger, staged compile, deposit"
```

---

### Task 11: ReliquaryView + KernelTab replacement

**Files:**
- Create: `src/terminal/quintessence/ReliquaryView.jsx`
- Modify: `src/terminal/views/KernelTab.jsx`

- [ ] **Step 1: Implement the reliquary**

```jsx
// src/terminal/quintessence/ReliquaryView.jsx — the reliquary (spec §5).
// Pre-compile: monument + live schematic of the unfinished kernel.
// Post-compile: the sealed artifact, full code view, copy vial.
import { useEffect, useReducer, useState } from 'react';
import { getSpine, subscribeSpine, missingVertebrae } from './spineStore';
import { snapshotPeriphery } from './periphery';
import { subscribe as subscribeBus } from '../../observatory/observatoryBus';
import { STORAGE_KEY } from '../mercury/QuintessenceAltar';

function loadArtifact() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
  catch (_) { return null; }
}

const slot = (label, filled, preview) => ({ label, filled, preview });

export default function ReliquaryView() {
  const [, force] = useReducer(x => x + 1, 0);
  const [copied, setCopied] = useState(false);
  useEffect(() => subscribeSpine(force), []);
  useEffect(() => subscribeBus(force), []);

  const artifact = loadArtifact();

  if (artifact) {
    const copyVial = async () => {
      try { await navigator.clipboard.writeText(artifact.source); setCopied(true); setTimeout(() => setCopied(false), 2000); }
      catch (_) { /* clipboard denied — the textarea below remains selectable */ }
    };
    return (
      <div className="max-w-5xl mx-auto mt-8" data-testid="reliquary-sealed">
        <div className="sc-monument-eyebrow mb-2">the reliquary · one kernel at a time</div>
        <div className="font-mono text-[10px] text-amber-300/80 tracking-[0.15em] mb-4 break-all">
          ◈ SEAL sha256:{artifact.hash} · {artifact.meta.compiledAt} · {artifact.meta.element}
        </div>
        <button type="button" onClick={copyVial}
          className="mb-4 border border-amber-400/60 text-amber-200 font-mono text-[10px] tracking-[0.3em] uppercase px-4 py-2 hover:bg-amber-950/30">
          {copied ? '◈ vial copied' : 'copy the vial →'}
        </button>
        <pre className="border border-zinc-800 bg-black/70 p-4 overflow-x-auto text-[11px] leading-relaxed font-mono text-emerald-300/90 whitespace-pre">
          {artifact.source}
        </pre>
        <div className="mt-3 font-mono text-[8px] text-zinc-600 lowercase">
          genome: fish_scale_kernel_11.2 · the parent · every kernel is a fork of one master prompt
        </div>
      </div>
    );
  }

  // ── pre-compile: the live schematic ─────────────────────────────────────
  const spine = getSpine();
  const p = snapshotPeriphery();
  const slots = [
    slot('narcos payload · bsky trend',       !!spine.trend,   spine.trend?.label),
    slot('friction pair · council',           !!spine.council, spine.council?.pair?.join(' × ')),
    slot('dryness · olfactory phase',         !!spine.phase,   spine.phase),
    slot('entropy_lock · lunar transit',      !!p.lunarRead,   p.lunarRead ? `${p.lunarRead.phase}` : null),
    slot('mummy · transmission',              !!p.transmissions, p.transmissions?.lastKernel),
    slot('daemon · element',                  !!spine.element, spine.element),
    slot('house: ciphers',                    !!p.ciphers,     p.ciphers && `${p.ciphers.verifies} verified`),
    slot('house: essences',                   !!p.essences,    p.essences && `${p.essences.collisions} collisions`),
    slot('house: ecocide',                    !!p.houses.ecocide, p.houses.ecocide && `entered ${p.houses.ecocide}×`),
    slot('house: ledger',                     !!p.houses.ledger, p.houses.ledger && `entered ${p.houses.ledger}×`),
    slot('house: privacy',                    !!p.houses.privacy, p.houses.privacy && `entered ${p.houses.privacy}×`),
    slot('house: surveillance',               !!p.houses.surveillance, p.houses.surveillance && `entered ${p.houses.surveillance}×`),
  ];
  const missing = missingVertebrae();

  return (
    <div className="max-w-5xl mx-auto mt-8" data-testid="reliquary-schematic">
      {/* Monument — the axiom's only home (spec §5.1) */}
      <div className="mb-10">
        <div className="sc-monument-marker mb-3">ᛟ axiomatic law Ⅰ</div>
        <h2 className="sc-monument-display sc-monument-display--thesis">
          THEORY THAT CANNOT BE COMPILED<br />
          <span className="sc-monument-display--emphasis">DOES NOT YET EXIST AS KNOWLEDGE</span>
        </h2>
        <hr className="sc-monument-accent mt-4" />
      </div>

      <div className="sc-monument-eyebrow mb-4">
        the reliquary · your kernel is uncompiled · {missing.length === 0 ? 'the altar waits on mercury' : missing.join(' · ').toLowerCase()}
      </div>

      <div className="font-mono text-[11px] leading-relaxed border border-zinc-800/70 bg-black/60 p-5">
        <div className="text-zinc-500 mb-3">{'// KERNEL OF QUINTESSENCE :: awaiting quintessence event'}</div>
        {slots.map(s => (
          <div key={s.label} className="flex gap-3 mb-1">
            <span className={s.filled ? 'text-amber-300' : 'text-zinc-700'}>
              {s.filled ? `Some(${s.preview})` : 'None'}
            </span>
            <span className="text-zinc-600">{'// ' + s.label}{!s.filled && ' · awaiting witness'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Note: the `sc-monument-*` classes are defined by a `<style>` block in `ScalingTab.jsx` (lines ~51–92). Copy that monument CSS block (`.sc-monument-marker`, `.sc-monument-eyebrow`, `.sc-monument-display`, variants, `.sc-monument-accent`, and the `sc-monumentReveal` keyframe) into a `<style>` tag at the top of `ReliquaryView`'s returned JSX — same pattern the codebase already uses (per-view style blocks, no shared CSS file).

- [ ] **Step 2: Replace KernelTab's content.** In `KernelTab.jsx`: keep the file, the default export name, and its props signature, but replace the rendered body with the reliquary. The existing relic content (system_kernel header, `mercury terminal // build: 9.4.castle // ostrom_protocol` subtitle at line 549, kernel build tables, sphere canvases) is superseded per spec §5.1. Reduce the component to:

```jsx
import React from 'react';
import ReliquaryView from '../quintessence/ReliquaryView';

const KernelTab = () => <ReliquaryView />;

export default React.memo(KernelTab);
```

Delete the now-unused imports/hooks/helpers in the file (or, if other modules import named exports from KernelTab.jsx — check with `grep -rn "from './KernelTab'\|from '../views/KernelTab'" src/` — keep those exports and delete only the unused rendering code).

- [ ] **Step 3: Verify in the preview browser.**
1. Clear state: `localStorage.removeItem('quintessence_kernel_v1')`, reload.
2. Kernel tab → monument header + schematic with `None · awaiting witness` slots. No console errors.
3. Fill the spine via `window.__quintessenceSpine` (as in Task 10 Step 4), watch schematic slots flip to `Some(…)` live.
4. Mercury → fire an element → deposit → Kernel tab shows the sealed artifact, hash seal line, and the full `.rs` source.
5. Click `copy the vial →` → paste into the URL bar or a text field: the full artifact text including the header banner.
6. Reload the page → the sealed artifact survives (localStorage).

- [ ] **Step 4: Run full suite**

Run: `npx vitest run` — Expected: green (KernelTab had no direct tests; if any test imported its internals, fix per Step 2's grep).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/ReliquaryView.jsx src/terminal/views/KernelTab.jsx
git commit -m "feat(quintessence): the reliquary — monument, live schematic, sealed artifact, copy vial"
```

---

### Task 12: Final verification sweep

- [ ] **Step 1: Full test suite**

Run: `npx vitest run` — Expected: all green. Then `cargo test --lib fish_scale` from `content/rust_kernels` — Expected: green. Then `npm run check:genome` — Expected: exit 0.

- [ ] **Step 2: Production build**

Run: `npx vite build 2>&1 | tail -5` — Expected: build succeeds. Confirm the DEV escape hatch is stripped: `grep -c "__quintessenceSpine" dist/assets/*.js` → Expected: 0 matches (import.meta.env.DEV is compile-time false).

- [ ] **Step 3: Spec cross-check.** Walk spec §§3–7 and §11 against the implementation:
- §3.1 header block exact lines ✓ (compileKernel test)
- §3.2 all genome parameters present in artifact ✓ (read one compiled artifact end-to-end and confirm each table row appears)
- §3.4 empty houses as None ✓
- §3.5 engine constants block + offline fallback ✓
- §4 gate names absences, element recorded at click ✓
- §5 both reliquary states + persistence + copy ✓
- §7 all four error paths (bus empty, transit unread, localStorage gone, engine offline) — verify the localStorage-gone path renders the `VOLATILE BUILD` notice… **if this notice was not implemented, add it now**: in `QuintessenceAltar.ignite`, wrap the `localStorage.setItem` and on catch set a `volatile: true` flag into the artifact meta; `ReliquaryView` renders `VOLATILE BUILD — will not survive reload` under the seal line when `artifact.meta.volatile`.
- §11 genome 11.2 compiles ✓ (`check:genome`)

- [ ] **Step 4: Commit any cross-check fixes**

```bash
git add -A && git commit -m "fix(quintessence): spec cross-check fixes"
```

---

## Deferred (tracked, not in this plan)

- Bsky trend picker (spec §8.1) — the altar stays gated on `NO TREND MARKED` until it ships; contract is `spineStore.setTrend({ label, velocity, volume })`.
- Transmission × Manifesto coupling (§8.2) — mummy compiles from ambient witness meanwhile.
- Fade/Chaos tab feigenbaum visualization (§8.3) — reads `engineWitness.js`.
- Chimera glyph from build hash (§8.4); ledger/sharing (§8.5).
- Boot-flash `SURVEIL` → `OBSERVE` two-beat swap — lands after the alien-sweep worktree merges (separate session).
