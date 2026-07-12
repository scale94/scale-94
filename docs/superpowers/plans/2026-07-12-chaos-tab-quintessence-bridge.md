# CHAOS Tab / Quintessence Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the Feigenbaum Fade surface to CHAOS, make the sphere's live cascade (r, λ, regime) a witnessed house in the quintessence kernel with a Δr twin-cascade line, add the twin-cascade HUD strip + doctrine log lines + altar echo, and give the KernelTab a break-the-seal `[compile]` path.

**Architecture:** The sphere's Hopfield field already computes r/λ/regime and fires `onPhaseTransition`; we forward that to the observatory bus (`art_regime` event), snapshot it in `periphery.art`, and compile it into `house_chaos` plus a Δr comparison against the trend-driven engine r. All UI changes are chrome around the canvas — **the canvas draw loop, node density, physics, and audio are never touched.**

**Tech Stack:** React 18 (Vite), vitest (jsdom), plain JS modules for the quintessence chain. Spec: `docs/superpowers/specs/2026-07-12-chaos-tab-quintessence-bridge-design.md`.

**Test command:** `npm test` (vitest run). Single file: `npx vitest run <path>`.

**Frozen internal keys (never rename):** route `~/system/art`, `activeTab: 'art'`, event kinds `art_*`, `periphery.art`, `gaze.tabsVisited.art`.

---

### Task 1: Surface rename — CHAOS on every visitor-facing label

**Files:**
- Modify: `src/terminal/components/BootSequence.jsx:18`
- Modify: `src/terminal/App.jsx:1531` and `src/terminal/App.jsx:1572`
- Modify: `src/terminal/hooks/useCommandDispatch.js:31`

No unit tests — pure display strings. Verified by grep + browser pass in Task 10.

- [ ] **Step 1: BootSequence field label**

In `src/terminal/components/BootSequence.jsx` line 18, replace:

```js
  { name: 'feigenbaum_fade', field: 'art',          status: 'rendering', variant: 'normal'      },
```

with:

```js
  { name: 'feigenbaum_fade', field: 'chaos',        status: 'rendering', variant: 'normal'      },
```

- [ ] **Step 2: Nav aria-label**

In `src/terminal/App.jsx` line 1531, change only the aria-label (all handlers and keys stay `'art'`):

```jsx
        <button onClick={() => handleNav('~/system/art', 'art')} aria-label="Chaos" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'art' ? 'text-amber-400' : 'text-amber-400/40'}`}>
```

- [ ] **Step 3: Keyboard hint row**

In `src/terminal/App.jsx` line 1572, replace `['a','art']` with `['a','chaos']` (the `a` key binding is display-adjacent; the hint text is what changes):

```js
              ['n','kernel'], ['a','chaos'], ['e','eco'], ['s','surv'],
```

- [ ] **Step 4: `chaos` command alias**

In `src/terminal/hooks/useCommandDispatch.js` line 31 (the `LOAD_TAB_MAP`), add `chaos: 'art'`:

```js
  art: 'art', graph: 'art', fade: 'art', 'fade_doctrine': 'art', 'feigenbaum_fade': 'art', visual: 'art', chaos: 'art',
```

- [ ] **Step 5: Verify no stray visitor-facing "art" labels were missed**

Run: `npx vitest run` (nothing should break — these are display strings)
Run: `git grep -n "aria-label=\"Art\"" src/` → expect no matches.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/components/BootSequence.jsx src/terminal/App.jsx src/terminal/hooks/useCommandDispatch.js
git commit -m "feat(chaos): the surface says CHAOS — boot line, nav, hints, command alias"
```

---

### Task 2: Seal storage module — STORAGE_KEY moves home + clearSealedArtifact

The seal's storage key currently lives in `QuintessenceAltar.jsx` (a React component) and `sealedArtifact.js` imports it from there. Flip the dependency so the storage module owns its key, then add the clear function Task 9 needs.

**Files:**
- Modify: `src/terminal/quintessence/sealedArtifact.js`
- Modify: `src/terminal/mercury/QuintessenceAltar.jsx:8,20`
- Test: `src/terminal/quintessence/__tests__/sealedArtifact.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `src/terminal/quintessence/__tests__/sealedArtifact.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSealedArtifact, clearSealedArtifact, STORAGE_KEY } from '../sealedArtifact';
import { holdVolatile, _resetVolatileForTests } from '../volatileHold';

describe('sealedArtifact', () => {
  beforeEach(() => {
    _resetVolatileForTests();
    localStorage.removeItem(STORAGE_KEY);
  });

  it('exports the canonical storage key', () => {
    expect(STORAGE_KEY).toBe('quintessence_kernel_v1');
  });

  it('prefers the volatile hold over the persisted seal', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: 'persisted' }));
    holdVolatile({ hash: 'volatile' });
    expect(loadSealedArtifact().hash).toBe('volatile');
  });

  it('reads the persisted seal when nothing is held', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: 'persisted' }));
    expect(loadSealedArtifact().hash).toBe('persisted');
  });

  it('clearSealedArtifact breaks the seal: hold and storage both gone', () => {
    holdVolatile({ hash: 'volatile' });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: 'persisted' }));
    clearSealedArtifact();
    expect(loadSealedArtifact()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/sealedArtifact.test.js`
Expected: FAIL — `clearSealedArtifact` and `STORAGE_KEY` are not exported from `../sealedArtifact`.

- [ ] **Step 3: Implement — sealedArtifact.js owns the key and the clear**

Replace the full contents of `src/terminal/quintessence/sealedArtifact.js`:

```js
// src/terminal/quintessence/sealedArtifact.js — the one read path to the seal.
// The volatile hold first: it can only exist in THIS session, so when present
// it is always the most recent compile (covers quota-exceeded recompiles over
// an older persisted seal). Otherwise the sealed vial from storage (spec §7).
// Four consumers touch the seal — the reliquary panel, the kernel dashboard's
// reserved slot, the Mercury altar, and the break-the-seal ceremony — so both
// the read and the break live here, once. The storage key lives here too:
// storage concerns belong to the storage module, not to a React component.
import { heldVolatile, holdVolatile } from './volatileHold';

export const STORAGE_KEY = 'quintessence_kernel_v1';

export function loadSealedArtifact() {
  const held = heldVolatile();
  if (held) return held;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* unwitnessed */ }
  return null;
}

// Break the seal (spec §7): the vial is destroyed, the altar re-arms.
export function clearSealedArtifact() {
  holdVolatile(null);
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* unwitnessed */ }
}
```

Then in `src/terminal/mercury/QuintessenceAltar.jsx`:

1. Delete line 20: `export const STORAGE_KEY = 'quintessence_kernel_v1';`
2. Add to the existing quintessence imports (near line 5-8): `import { STORAGE_KEY } from '../quintessence/sealedArtifact';`

(Only `sealedArtifact.js` imported `STORAGE_KEY` from the altar — verified by grep — so no other import sites change. The flip removes the JSX import from the storage module and breaks no cycle.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/quintessence/`
Expected: all PASS, including the existing `quintessenceAltar.test.jsx`.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/sealedArtifact.js src/terminal/mercury/QuintessenceAltar.jsx src/terminal/quintessence/__tests__/sealedArtifact.test.js
git commit -m "refactor(quintessence): the seal owns its key — clearSealedArtifact joins the storage module"
```

---

### Task 3: The sphere testifies — `art_regime` event + periphery cascade fields

**Files:**
- Modify: `src/observatory/observatoryBus.js:52-55,94`
- Modify: `src/terminal/quintessence/periphery.js:49-52`
- Test: `src/terminal/quintessence/__tests__/periphery.test.js`

- [ ] **Step 1: Write the failing tests**

In `src/terminal/quintessence/__tests__/periphery.test.js`, first update the existing expectation (line 67) — the art snapshot gains three nullable fields:

```js
    expect(snapshotPeriphery().art).toEqual({
      resonances: 1, lastSim: 0.83, bifurcations: 14, chimeras: 1,
      lastR: null, lyapunov: null, regime: null,
    });
```

Then add a new test after it:

```js
  it('witnesses the sphere cascade: art_regime → lastR / lyapunov / regime', () => {
    emit('gaze', 'art_regime', { r: 3.72, lyapunov: 0.021, regime: 'CHAOS' });
    const p = snapshotPeriphery();
    expect(p.art.lastR).toBe(3.72);
    expect(p.art.lyapunov).toBe(0.021);
    expect(p.art.regime).toBe('CHAOS');
    // a later transition overwrites — the seal reads the LAST witnessed state
    emit('gaze', 'art_regime', { r: 2.91, lyapunov: -0.4, regime: 'STABLE' });
    expect(snapshotPeriphery().art.regime).toBe('STABLE');
  });
```

(The file already resets the bus per test via `_resetForTests` — follow its existing pattern.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/quintessence/__tests__/periphery.test.js`
Expected: FAIL — `art_regime` is not handled; snapshot lacks `lastR`.

- [ ] **Step 3: Implement bus + periphery**

In `src/observatory/observatoryBus.js`, extend `ensureArt` (line 52-55):

```js
function ensureArt(t) {
  if (!t.art) t.art = { resonances: 0, lastSim: null, bifurcations: 0, chimeras: 0,
                        lastR: null, lyapunov: null, regime: null };
  return t.art;
}
```

And in `updateTotals`'s `case 'gaze':` block, after the `art_chimera` line (line 94):

```js
      if (evt.kind === 'art_regime') {
        const a = ensureArt(t);
        if (typeof evt.payload.r === 'number')        a.lastR    = evt.payload.r;
        if (typeof evt.payload.lyapunov === 'number') a.lyapunov = evt.payload.lyapunov;
        if (evt.payload.regime)                       a.regime   = evt.payload.regime;
      }
```

In `src/terminal/quintessence/periphery.js`, extend the art mapping (lines 49-52):

```js
    art: g?.art
      ? { resonances: g.art.resonances || 0, lastSim: g.art.lastSim ?? null,
          bifurcations: g.art.bifurcations || 0, chimeras: g.art.chimeras || 0,
          lastR: g.art.lastR ?? null, lyapunov: g.art.lyapunov ?? null, regime: g.art.regime ?? null }
      : ((g?.tabsVisited?.art || 0) > 0 ? { visits: g.tabsVisited.art } : null),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/periphery.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/observatory/observatoryBus.js src/terminal/quintessence/periphery.js src/terminal/quintessence/__tests__/periphery.test.js
git commit -m "feat(chaos): art_regime witness — the sphere's r, lyapunov, regime reach the periphery"
```

---

### Task 4: The vial adopts the name — `house_chaos` + sphere testimony + Δr line

**Files:**
- Modify: `src/terminal/quintessence/compileKernel.js:100-107,192,205`
- Test: `src/terminal/quintessence/__tests__/compileKernel.test.js`

- [ ] **Step 1: Update + add failing tests**

In `src/terminal/quintessence/__tests__/compileKernel.test.js`:

1. Extend the `FULL_PERIPHERY.art` fixture (line 19):

```js
  art: { resonances: 1, lastSim: 0.83, bifurcations: 14, chimeras: 1,
         lastR: 3.72, lyapunov: 0.021, regime: 'CHAOS' },
```

2. Line 84: `expect(source).toContain('house_art: None');` → `expect(source).toContain('house_chaos: None');`

3. Rewrite the deep-periphery test (lines 125-130) — the header renames and the testimony grows the sphere state:

```js
  it('deep periphery: house_chaos compiles all three states (spec §5.2 + chaos spec §3)', async () => {
    const a = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(a.source).toContain('house_chaos: Some("chimera fused ×1 · 14 bifurcations · resonance 0.83 · sphere r 3.72 λ +0.021 CHAOS")');
    const visitsOnly = { ...FULL_PERIPHERY, art: { visits: 2 } };
    const b = await compileKernel(FULL_SPINE, visitsOnly, ENGINE, OPTS);
    expect(b.source).toContain('house_chaos: Some("entered 2× · the sphere untouched")');
    const never = { ...FULL_PERIPHERY, art: null };
    const c = await compileKernel(FULL_SPINE, never, ENGINE, OPTS);
    expect(c.source).toContain('house_chaos: None');
  });
```

4. Add a new Δr test block:

```js
  it('twin cascade: Δr line compares sphere r against the trend-driven engine r (chaos spec §3)', async () => {
    // trendToPressure(0.9) = 2.8 + 1.2·0.9 = 3.88 · sphere r 3.72 → trailed by 0.16
    const trailed = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(trailed.source).toContain('the sphere trailed the world by Δr 0.16');

    const ahead = await compileKernel(FULL_SPINE,
      { ...FULL_PERIPHERY, art: { ...FULL_PERIPHERY.art, lastR: 3.95 } }, ENGINE, OPTS);
    expect(ahead.source).toContain('the sphere ran ahead of the world by Δr +0.07');

    // sphere never phase-witnessed → the absence is named
    const silent = await compileKernel(FULL_SPINE,
      { ...FULL_PERIPHERY, art: { resonances: 1, lastSim: 0.83, bifurcations: 14, chimeras: 1,
                                  lastR: null, lyapunov: null, regime: null } }, ENGINE, OPTS);
    expect(silent.source).toContain('the twin cascade never spoke');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/quintessence/__tests__/compileKernel.test.js`
Expected: FAIL — source still says `house_art`, no Δr line.

- [ ] **Step 3: Implement in compileKernel.js**

Replace the `artDesc` block (lines 100-107) with:

```js
  const artDesc = periphery.art
    ? (periphery.art.visits != null
        ? `entered ${periphery.art.visits}× · the sphere untouched`
        : [periphery.art.chimeras ? `chimera fused ×${periphery.art.chimeras}` : null,
           periphery.art.bifurcations ? `${periphery.art.bifurcations} bifurcation${periphery.art.bifurcations === 1 ? '' : 's'}` : null,
           periphery.art.lastSim != null ? `resonance ${Number(periphery.art.lastSim).toFixed(2)}` : null,
           periphery.art.lastR != null
             ? `sphere r ${Number(periphery.art.lastR).toFixed(2)} λ ${Number(periphery.art.lyapunov ?? 0) >= 0 ? '+' : ''}${Number(periphery.art.lyapunov ?? 0).toFixed(3)} ${periphery.art.regime ?? 'UNCLASSIFIED'}`
             : null,
          ].filter(Boolean).join(' · ') || 'the sphere touched')
    : null;

  // Twin cascade (chaos spec §3): the sphere's witnessed r vs the trend-driven
  // engine r — the same logistic map, run by two hands. Absence is data.
  const sphereR = periphery.art?.lastR;
  const twinCascade = (typeof sphereR === 'number')
    ? (sphereR - r >= 0
        ? `the sphere ran ahead of the world by Δr +${Math.abs(sphereR - r).toFixed(2)} — the visitor's hand outpaced the network`
        : `the sphere trailed the world by Δr ${Math.abs(sphereR - r).toFixed(2)} — the network burned faster than the visitor`)
    : `the twin cascade never spoke — the sphere's r was never witnessed`;
```

In the `PeripheralWitness` struct (line 192), rename the field:

```
    house_chaos: Option<&'static str>,
```

And at the render line (line 205), rename and attach the Δr comment on the following line:

```
${houseLine('house_chaos', periphery.art, artDesc)}
    // ${twinCascade}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/compileKernel.test.js`
Expected: PASS — including the untouched determinism tests (the new fields flow through the canonical hash automatically; no `Math.random()` was introduced).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/compileKernel.js src/terminal/quintessence/__tests__/compileKernel.test.js
git commit -m "feat(chaos): house_chaos in the vial — sphere testimony + the Δr twin-cascade line"
```

---

### Task 5: AESTHETICS reads the cascade — registry ownership + regime detail

**Files:**
- Modify: `src/terminal/quintessence/taxonomyRegistry.js:82,85-99`
- Test: `src/terminal/quintessence/__tests__/taxonomyRegistry.test.js:131-142`

- [ ] **Step 1: Update + add failing tests**

In `src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`, rewrite the ownership test (lines 131-132):

```js
  it('aesthetics owns house_chaos and reads art OR essences as witnessed', () => {
    expect(ownerOf('house_chaos')).toBe('AESTHETICS');
```

(the rest of that test body stays as-is). Then add after the existing detail test (~line 142):

```js
  it('aesthetics detail speaks cascade vocabulary when the regime was witnessed', () => {
    expect(aesthetics.detail(withPeriphery({
      art: { resonances: 1, lastSim: 0.83, bifurcations: 0, chimeras: 1,
             lastR: 3.72, lyapunov: 0.021, regime: 'CHAOS' },
    }))).toBe('1 chimera · resonance 0.83 · regime CHAOS');
  });
```

(Use the same `aesthetics` / `withPeriphery` helpers the surrounding tests already use in that file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: FAIL — `ownerOf('house_chaos')` is undefined/null; detail lacks the regime part.

- [ ] **Step 3: Implement in taxonomyRegistry.js**

Line 82: `owns: ['house_essences', 'house_art'],` → `owns: ['house_essences', 'house_chaos'],`

In the `detail` function's parts array (lines 89-93), append the regime part after the `lastSim` entry:

```js
        const parts = [
          a.chimeras ? `${a.chimeras} chimera${a.chimeras === 1 ? '' : 's'}` : null,
          a.bifurcations ? `${a.bifurcations} bifurcation${a.bifurcations === 1 ? '' : 's'}` : null,
          a.lastSim != null ? `resonance ${Number(a.lastSim).toFixed(2)}` : null,
          a.regime ? `regime ${a.regime}` : null,
        ].filter(Boolean);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/taxonomyRegistry.js src/terminal/quintessence/__tests__/taxonomyRegistry.test.js
git commit -m "feat(chaos): AESTHETICS owns house_chaos — chaos is the method, beauty reads it"
```

---

### Task 6: Altar-side echo — the reliquary's `house: chaos` slot shows the waiting Δr

**Files:**
- Modify: `src/terminal/quintessence/ReliquaryView.jsx:119` (+ one import)
- Test: `src/terminal/quintessence/__tests__/reliquaryView.test.jsx:49-52`

- [ ] **Step 1: Update + add failing tests**

In `src/terminal/quintessence/__tests__/reliquaryView.test.jsx`, rewrite the art-house test (lines 49-52):

```js
  it('the chaos house appears with its reader', () => {
    // (keep the existing render/arrange lines of this test exactly as they are)
    expect(text).toContain('house: chaos');
    expect(text.match(/read by ⟨AESTHETICS⟩/g)).toHaveLength(2); // essences + chaos
  });
```

Add a new test following the file's existing render pattern (same helpers/emits the file already uses):

```js
  it('the chaos slot shows the waiting testimony: sphere r and Δr pre-compile', () => {
    // arrange like the surrounding tests, plus:
    emit('gaze', 'art_regime', { r: 3.72, lyapunov: 0.021, regime: 'CHAOS' });
    setTrend({ label: 'degrowth', velocity: 0.9 });   // engine r = 3.88
    // ...render ReliquaryView the same way the file's other tests do...
    expect(text).toContain('sphere r 3.72');
    expect(text).toContain('Δr -0.16');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/quintessence/__tests__/reliquaryView.test.jsx`
Expected: FAIL — slot still labeled `house: art`, no Δr detail.

- [ ] **Step 3: Implement in ReliquaryView.jsx**

Add `trendToPressure` to the existing engineWitness import (or add the import if absent):

```js
import { trendToPressure } from './engineWitness';
```

Replace the slot at line 119:

```js
    slot('house_chaos',         'house: chaos',                  !!p.art,
      p.art && (p.art.visits != null
        ? `entered ${p.art.visits}×`
        : (p.art.lastR != null
            ? `sphere r ${Number(p.art.lastR).toFixed(2)}${spine.trend
                ? ` · Δr ${p.art.lastR - trendToPressure(spine.trend.velocity) >= 0 ? '+' : '-'}${Math.abs(p.art.lastR - trendToPressure(spine.trend.velocity)).toFixed(2)}`
                : ''}`
            : (p.art.chimeras ? `${p.art.chimeras} chimera${p.art.chimeras === 1 ? '' : 's'}` : 'touched')))),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/reliquaryView.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/ReliquaryView.jsx src/terminal/quintessence/__tests__/reliquaryView.test.jsx
git commit -m "feat(chaos): altar-side echo — the reliquary shows the sphere's waiting Δr testimony"
```

---

### Task 7: The tab speaks — `art_regime` emit + twin-cascade HUD strip

Chrome only. The canvas draw loop is not touched.

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx` — imports (~line 38), phase-transition handler (~line 2127), FEIGENBAUM_DYNAMICS panel (~line 2778)

No new unit tests (React chrome wired to live refs); covered by the Task 10 browser pass.

- [ ] **Step 1: Add imports**

Near the existing quintessence-adjacent imports at the top of `src/terminal/views/ArtTab.jsx` (after line 38, `import { emit as emitObs } ...`), add:

```js
import { getSpine } from '../quintessence/spineStore';
import { trendToPressure, R_CHAOS } from '../quintessence/engineWitness';
```

- [ ] **Step 2: Emit the witness on phase transition**

In the phase-transition callback (line 2127-2141), after `setPhaseLyap(event.lyapunov);` add:

```js
      // Quintessence witness (chaos spec §3) — the sphere's cascade testifies
      emitObs('gaze', 'art_regime', { r: event.r, lyapunov: event.lyapunov, regime: event.to });
```

- [ ] **Step 3: Add the twin-cascade strip to the dynamics panel**

Inside the `[FEIGENBAUM_DYNAMICS]` readout (the bordered div at lines 2746-2791), insert a new row after the `δ = 4.669201609` row's closing `</div>` (line 2778) and before the `── Hopfield associative memory …` caption:

```jsx
        {/* Twin cascade (chaos spec §4) — sphere r vs the trend-driven engine r.
          * Reads getSpine() at render: the tab remounts on every tab switch,
          * so the armed trend is always fresh. No subscription needed. */}
        {(() => {
          const trend   = getSpine().trend;
          const engineR = trend ? trendToPressure(trend.velocity) : null;
          const dr      = engineR != null ? phaseR - engineR : null;
          return (
            <div className="mt-1 flex gap-4 flex-wrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <span>{'CASCADE ∷ sphere r='}<span style={{ color: 'rgba(255,215,0,0.85)' }}>{phaseR.toFixed(3)}</span></span>
              <span>{'engine r='}
                {engineR != null
                  ? <span style={{ color: 'rgba(212,168,42,0.9)' }}>{engineR.toFixed(3)}</span>
                  : <span style={{ color: 'rgba(255,255,255,0.25)' }}>∅ unwitnessed</span>}
              </span>
              {dr != null && (
                <span>{'Δr='}<span style={{ color: dr >= 0 ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.8)' }}>
                  {(dr >= 0 ? '+' : '') + dr.toFixed(3)}
                </span></span>
              )}
              <span>{'r∞='}<span style={{ color: 'rgba(255,215,0,0.5)' }}>{R_CHAOS.toFixed(4)}</span></span>
            </div>
          );
        })()}
```

- [ ] **Step 4: Sanity-check the suite + dev build**

Run: `npx vitest run`
Expected: all PASS.
Run: `npx vite build 2>&1 | Select-Object -Last 5`
Expected: build succeeds (catches any import path typo in the lazy-loaded ArtTab).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/ArtTab.jsx
git commit -m "feat(chaos): the sphere testifies — art_regime witness + twin-cascade HUD strip"
```

---

### Task 8: The mythic register — kernelDoctrines.js + log wiring

**Files:**
- Create: `src/terminal/data/kernelDoctrines.js`
- Modify: `src/terminal/hooks/useCommandDispatch.js:308-343` (both log branches)
- Modify: `src/terminal/hooks/useTerminalCommands.js:318-324,396-402` (hardwire + main site)
- Test: `src/terminal/data/__tests__/kernelDoctrines.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `src/terminal/data/__tests__/kernelDoctrines.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { doctrineFor, doctrineLogLines } from '../kernelDoctrines';

describe('kernelDoctrines', () => {
  it('the hopfield kernel carries the séance doctrine (spec §5 example)', () => {
    expect(doctrineFor('ASSOCIATIVE-FIELD-1.0'))
      .toBe('the cue is a summons · the basin is a séance · memory is a place the field falls into');
  });

  it('matches sphere kernels by registry-id substring', () => {
    expect(doctrineFor('FEIGENBAUM-CASCADE-1.0')).toBeTruthy();
    expect(doctrineFor('FSF-12.1.0')).toBe(doctrineFor('FEIGENBAUM-CASCADE-1.0'));
    expect(doctrineFor('FISH-SCALE-KERNEL11.1.1')).toBeTruthy(); // necromantic family
    expect(doctrineFor('SOMA-9.1-GAIA')).toBeTruthy();
    expect(doctrineFor('BIODIVERSITY-PROMPT-1.0.1')).toBeTruthy();
    expect(doctrineFor('LEVIATHAN')).toBeTruthy();
  });

  it('non-sphere kernels stay untranslated', () => {
    expect(doctrineFor('BELLARD-BAUDRILLARD_KERNEL-V1_0_0')).toBeNull();
    expect(doctrineFor('')).toBeNull();
    expect(doctrineFor(undefined)).toBeNull();
  });

  it('doctrineLogLines yields the two-line block, or nothing', () => {
    const lines = doctrineLogLines('ASSOCIATIVE-FIELD-1.0', '12:00:00');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ time: '12:00:00', msg: '  doctrine:', rust: true });
    expect(lines[1].msg).toContain('séance');
    expect(doctrineLogLines('BELLARD-BAUDRILLARD_KERNEL-V1_0_0', '12:00:00')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/data/__tests__/kernelDoctrines.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create kernelDoctrines.js**

Create `src/terminal/data/kernelDoctrines.js`. The 26 doctrine lines below are **drafts staged for the operator's voice pass** (chaos spec §5) — implement verbatim; the operator refines afterwards:

```js
// src/terminal/data/kernelDoctrines.js — the mythic register (chaos spec §5).
// Every KERNEL OUTPUT keeps its theory: citations untouched; the sphere's 25
// kernels (plus the hopfield field that binds them) gain one paired doctrine
// line — the alchemy to the theory's chemistry, astrology to its astronomy.
// Scope v1: sphere kernels only. Non-sphere kernels return null: untranslated.
//
// Matching mirrors mobileWasmMap.js: ordered UPPERCASE substring patterns over
// the WASM registry id. First match wins — specific before generic.

const DOCTRINES = {
  associative:  'the cue is a summons · the basin is a séance · memory is a place the field falls into',
  biocoenosis:  'every species is a rumor the forest tells about itself · extinction is the forest forgetting',
  atmospheric:  'the sky is a ledger written in pressure · weather is the debt collector',
  chrono:       'time is an actuary with a séance license · every premium is paid in futures',
  daly:         'the economy is a candle that believes it is the sun · steady state is the wick learning its length',
  replicator:   'what copies itself owns the future · fitness is a prophecy that grades itself',
  grayscott:    'two chemicals argue and the argument grows spots · form is a quarrel that reached equilibrium',
  kuramoto:     'fireflies do not agree to flash together · agreement is what flashing together is called afterward',
  ceei:         'fairness is an auction where every wallet holds the same coin · envy is the proof of failure',
  soma91:       'the system banner is a heartbeat wearing a uniform',
  soma_plus:    'the dose that heals and the dose that kills share a bottle · the label is the only alchemy',
  leviathan:    'the state is a cellular automaton that dreams it has a face',
  cynic:        'the lamp is lit in daylight · honesty is entropy given a walking stick',
  feigenbaum:   'one butterfly · one constant · every route to chaos climbs the same staircase',
  ising:        'opinion is a magnet cooling · consensus is just the temperature dropping',
  bosonic:      'particles that share a state without jealousy · trust is a condensate',
  seraphine:    'reason kneels in the machine and calls it prayer · the angel is an inference rule',
  fusion:       'two nuclei overcome their hatred and light appears · the sun is reconciliation at pressure',
  classified:   'the lattice keeps a secret the way stone keeps a fossil · quantum patience cannot dig it out',
  pqhash:       'the hash is a fingerprint of a ghost · grover halves the haystack and still finds no needle',
  dh_ec:        'two strangers mix colors in public and share a secret no watcher can unmix',
  pragmatic:    'every task resolves to heat eventually · the type system just names the flame',
  soma_kernel:  'the drug is a schedule · the schedule is a state machine · euphoria compiles',
  strangler:    'the fig embraces the tree it replaces · migration is a slow-motion mercy',
  surveillance: 'the tower sees you the moment you imagine the tower · the gaze compiles to self-discipline',
  necromantic:  'the engine runs on friction between the dead and the living · perpetual, never resolved',
};

// Ordered: specific before generic (SOMA-PLUS before SOMA-KERNEL before SOMA-9.1;
// no bare SOMA pattern exists, so the three cannot shadow each other).
const ID_PATTERNS = [
  ['ASSOCIATIVE-FIELD', 'associative'],
  ['SOMA-PLUS', 'soma_plus'],   ['SOMA_PLUS', 'soma_plus'],
  ['SOMA-KERNEL', 'soma_kernel'], ['SOMA_KERNEL', 'soma_kernel'], ['SOMA-5', 'soma_kernel'],
  ['SOMA-9.1', 'soma91'],
  ['BIODIVERSITY', 'biocoenosis'], ['BIOCOENOSIS', 'biocoenosis'],
  ['ATMOSPHERIC', 'atmospheric'],  ['THERMOSPHERE', 'atmospheric'],
  ['CHRONO', 'chrono'],            ['ACTUARY', 'chrono'],
  ['DALY', 'daly'],
  ['REPLICATOR', 'replicator'],
  ['GRAY', 'grayscott'],           ['REACTION-DIFFUSION', 'grayscott'],
  ['KURAMOTO', 'kuramoto'],
  ['CEEI', 'ceei'],                ['ALLOCATION-ENGINE', 'ceei'],
  ['LEVIATHAN', 'leviathan'],      ['VCACHE', 'leviathan'], ['V-CACHE', 'leviathan'],
  ['CYNIC', 'cynic'],
  ['FEIGENBAUM', 'feigenbaum'],    ['BIFURCATION', 'feigenbaum'], ['FSF-', 'feigenbaum'],
  ['ISING', 'ising'],
  ['BOSONIC', 'bosonic'],
  ['SERAPHINE', 'seraphine'],
  ['FUSION', 'fusion'],            ['PLASMA', 'fusion'],
  ['CLASSIFIED', 'classified'],    ['ML-KEM', 'classified'],
  ['PQHASH', 'pqhash'],            ['HASH-AUDIT', 'pqhash'],
  ['DH-EC', 'dh_ec'],              ['DH_EC', 'dh_ec'],
  ['PRAGMATIC', 'pragmatic'],
  ['STRANGLER', 'strangler'],
  ['SURVEILLANCE', 'surveillance'], ['PANOPTICON', 'surveillance'],
  ['NECRO', 'necromantic'],        ['FISH', 'necromantic'],
];

export function doctrineFor(wasmId) {
  if (!wasmId) return null;
  const id = String(wasmId).toUpperCase();
  for (const [pattern, key] of ID_PATTERNS) {
    if (id.includes(pattern)) return DOCTRINES[key] ?? null;
  }
  return null;
}

// Log-entry block for the tty pipelines. Empty array = kernel stays untranslated.
export function doctrineLogLines(wasmId, time) {
  const d = doctrineFor(wasmId);
  if (!d) return [];
  return [
    { time, msg: '  doctrine:', rust: true },
    { time, msg: `  ${d}`, rust: true },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/data/__tests__/kernelDoctrines.test.js`
Expected: PASS.

- [ ] **Step 5: Wire the four log sites**

Add to imports in **both** `src/terminal/hooks/useCommandDispatch.js` and `src/terminal/hooks/useTerminalCommands.js`:

```js
import { doctrineLogLines } from '../data/kernelDoctrines';
```

**Site 1 — useCommandDispatch.js non-streaming branch (lines 332-338).** Insert the doctrine spread between the kernel lines and the closing rule:

```js
              setSystemLogs(prev => [
                ...prev,
                { time: now,      msg: `  ── KERNEL OUTPUT ─────────────────────────`, rust: true },
                ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
                ...doctrineLogLines(wasmEntry.id, now),
                { time: now,      msg: `  ──────────────────────────────────────────`, rust: true },
                { time: doneTime, msg: `SYSTEM_KERNEL_LOG: CALCULATION COMPLETE  ·  EXEC_TIME: ${elapsed}ms`, rust: true },
              ].slice(-2000));
```

**Site 2 — useCommandDispatch.js streaming branch (lines 314-330).** In the `if (i === lines.length - 1)` completion block, prepend the doctrine before the closing rule:

```js
                  if (i === lines.length - 1) {
                    setSystemLogs(prev => [
                      ...prev,
                      ...doctrineLogLines(wasmEntry.id, t),
                      { time: t, msg: `  ──────────────────────────────────────────`, rust: true },
                      { time: t, msg: `SYSTEM_KERNEL_LOG: CALCULATION COMPLETE  ·  EXEC_TIME: ${elapsed}ms`, rust: true },
                    ].slice(-2000));
```

(only the `...doctrineLogLines(...)` line is new; everything after stays exactly as-is).

**Site 3 — useTerminalCommands.js main site (lines 396-402).** Same shape as Site 1:

```js
              setSystemLogs(prev => [
                ...prev,
                { time: now,      msg: `  ── KERNEL OUTPUT ─────────────────────────`, rust: true },
                ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
                ...doctrineLogLines(wasmEntry.id, now),
                { time: now,      msg: `  ──────────────────────────────────────────`, rust: true },
                { time: doneTime, msg: `SYSTEM_KERNEL_LOG: CALCULATION COMPLETE`, rust: true },
              ].slice(-2000));
```

**Site 4 — useTerminalCommands.js vcache_burn hardwire (lines 318-324).** The hardwired Leviathan call has no `wasmEntry`; pass the literal family id:

```js
              setSystemLogs(prev => [
                ...prev,
                { time: now,      msg: `  ── KERNEL OUTPUT ─────────────────────────`, rust: true },
                ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
                ...doctrineLogLines('LEVIATHAN', now),
                { time: now,      msg: `  ──────────────────────────────────────────`, rust: true },
                { time: doneTime, msg: `SYSTEM_KERNEL_LOG: CALCULATION COMPLETE`, rust: true },
              ].slice(-2000));
```

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/data/kernelDoctrines.js src/terminal/data/__tests__/kernelDoctrines.test.js src/terminal/hooks/useCommandDispatch.js src/terminal/hooks/useTerminalCommands.js
git commit -m "feat(chaos): the mythic register — doctrine lines pair every sphere kernel's theory block"
```

---

### Task 9: Break the seal — `[compile]` joins `[load ↗]` in the fifth slot

**Files:**
- Modify: `src/terminal/views/KernelTab.jsx` — import (line 6), state (~line 267), sealed branch (lines 810-832)

No new unit tests (interaction chrome); covered by the Task 10 browser pass. `clearSealedArtifact` itself was tested in Task 2.

- [ ] **Step 1: Import and state**

Line 6, extend the import:

```js
import { loadSealedArtifact, clearSealedArtifact } from '../quintessence/sealedArtifact';
```

Near the other UI state hooks (after line 267, `const lavaTimerRef = useRef(null);`), add:

```js
  const [breakingSeal, setBreakingSeal] = useState(false);
```

- [ ] **Step 2: Rewrite the sealed branch**

Replace the sealed-artifact `<li>` (lines 810-832) with a two-state branch — normal (with the new `[compile]` button) and the one-beat confirm:

```jsx
            {artifact ? (
              breakingSeal ? (
                <li
                  className="flex flex-wrap justify-between items-center gap-y-2 border-b border-l-2 pb-3 mb-1 p-2 pl-3 rounded gap-2 border-red-900/40 border-l-red-500/60 bg-red-950/10"
                  style={{ animation: 'sk-kernelModuleIn 0.22s ease-out both' }}
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="font-bold text-sm mb-0.5 truncate" style={{ color: '#f87171', textShadow: '0 0 8px rgba(239,68,68,0.25)' }}>
                      break seal 0x{artifact.hash.slice(0, 8).toUpperCase()}?
                    </div>
                    <div className="text-[11px] font-bold tracking-wide truncate" style={{ color: 'rgba(248,113,113,0.6)' }}>
                      the vial is destroyed · the altar re-arms · this cannot be undone
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <button
                      onClick={() => { clearSealedArtifact(); setBreakingSeal(false); toMercury(); }}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all cursor-pointer border-red-500/70 text-red-300 hover:bg-red-500/10 hover:border-red-300"
                    >
                      [forge anew]
                    </button>
                    <button
                      onClick={() => setBreakingSeal(false)}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all cursor-pointer border-zinc-600/60 text-zinc-400 hover:bg-zinc-800/40"
                    >
                      [keep]
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  onClick={toMercury}
                  className="flex flex-wrap justify-between items-center gap-y-2 border-b border-l-2 pb-3 mb-1 cursor-pointer p-2 pl-3 rounded transition-all group gap-2 border-amber-900/30 border-l-amber-500/50 hover:bg-amber-950/20"
                  style={{ animation: 'sk-kernelModuleIn 0.22s ease-out 40ms both' }}
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="font-bold text-sm mb-0.5 truncate" style={{ color: '#e8d28a', textShadow: '0 0 8px rgba(212,168,42,0.25)' }}>
                      QUINTESSENCE_KERNEL_0x{artifact.hash.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="text-xs font-bold tracking-wide truncate" style={{ color: 'rgba(212,168,42,0.78)' }}>
                      the fifth essence · {(artifact.meta.element || 'sealed').toLowerCase()} · verdict {artifact.meta.verdict}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <div
                      onClick={(e) => { e.stopPropagation(); setBreakingSeal(true); }}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all cursor-pointer border-zinc-600/50 text-zinc-400 hover:bg-red-950/30 hover:border-red-500/50 hover:text-red-300"
                    >
                      [compile]
                    </div>
                    <div
                      onClick={(e) => { e.stopPropagation(); toMercury(); }}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all cursor-pointer border-amber-500/60 text-amber-300 hover:bg-amber-500/10 hover:border-amber-300"
                    >
                      [load ↗]
                    </div>
                  </div>
                </li>
              )
            ) : (
```

(The empty-slot `) : (` branch that follows stays exactly as-is.)

Flow notes for the implementer: `artifact` is re-read via `loadSealedArtifact()` on every render, so after `[forge anew]` clears the seal the slot naturally falls back to the empty/vertebrae branch on the next render; the spine is untouched, so the altar arrives already armed, and the altar's own `window.confirm` overwrite guard (`QuintessenceAltar.jsx:38`) stays silent because storage is already empty.

- [ ] **Step 3: Run the suite + build**

Run: `npx vitest run`
Expected: all PASS.
Run: `npx vite build 2>&1 | Select-Object -Last 5`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/KernelTab.jsx
git commit -m "feat(chaos): break the seal — [compile] joins [load ↗], one confirm beat guards the vial"
```

---

### Task 10: Full verification — suite + browser pass

Calibration (operator's standing rule): this is an art project — reasonable confidence ships, no over-verification. One pass through each new surface, screenshots as proof.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 2: Browser pass — chaos tab**

Start the dev server via the Browser pane (preview_start with the project's launch config; create `.claude/launch.json` with `npm run dev` if absent). Then verify:

1. Boot sequence shows `feigenbaum_fade` with field `chaos`.
2. Navigate to the tab (nav button / `a` key): sphere renders **exactly as before** — nodes, density, particles untouched.
3. `[FEIGENBAUM_DYNAMICS]` panel shows the new `CASCADE ∷` row with `engine r=∅ unwitnessed` (no trend armed) and `r∞=3.5699`.
4. Click nodes / scroll until a phase transition fires; confirm the regime label updates and no console errors (`read_console_messages`).
5. Run a sphere kernel from the tab (left-click a node) → tty shows `KERNEL OUTPUT` with `theory:` block followed by `doctrine:` line.

- [ ] **Step 3: Browser pass — compile round-trip**

1. Arm the spine (DEV escape hatch if needed: `window.__quintessenceSpine.setTrend({label:'test-butterfly', velocity:0.9}); ...setCouncil(...); ...setPhase(...)` per `spineStore.js:88`).
2. Back on the chaos tab: `engine r=3.880` now shows, `Δr` appears.
3. Mercury altar → reliquary schematic shows `house: chaos` slot with `sphere r … · Δr …`.
4. Compile at the altar → vial source contains `house_chaos: Some(…sphere r…)` and the Δr comment line (or `the twin cascade never spoke` if the sphere was never phase-witnessed this session).
5. Kernel tab fifth slot: sealed entry shows `[compile]` + `[load ↗]`. Click `[compile]` → confirm beat appears; `[keep]` restores; `[compile]` → `[forge anew]` → seal cleared, navigated to Mercury, altar armed, vertebrae meter intact.

- [ ] **Step 4: Screenshot proof**

Capture: the CASCADE strip with Δr live, the doctrine line in the tty, the `house: chaos` reliquary slot, and the break-seal confirm beat.

- [ ] **Step 5: Final commit (if any fixes landed during verification)**

```bash
git add -A
git commit -m "fix(chaos): browser-pass corrections"
```

---

## Self-review notes

- **Spec coverage:** §2 rename → Tasks 1, 4, 5, 6; §3 resonance ceremony → Tasks 3, 4, 7; §4 HUD strip → Task 7; §5 doctrine → Task 8; §6 altar echo → Task 6; §7 break-the-seal → Tasks 2, 9; §8 verification → Task 10. §1/§9 (canvas untouched, no deep rename) are constraints honored throughout — no task touches the draw loop or internal keys.
- **Type consistency:** `periphery.art.{lastR,lyapunov,regime}` (Tasks 3→4→5→6→7), `clearSealedArtifact`/`STORAGE_KEY` (Tasks 2→9), `doctrineFor`/`doctrineLogLines(wasmId, time)` (Task 8) — names match across all uses.
- **Determinism guard:** compileKernel additions use only periphery values already inside the canonical hash; no randomness introduced.
