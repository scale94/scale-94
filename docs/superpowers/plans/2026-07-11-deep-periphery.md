# Deep Periphery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge the four underrepresented tabs' richest signals onto `observatoryBus` and compile them into the kernel — a new `house_art`, enriched ecocide/ledger house testimony, and the dead `scaling_visit` channel finally wired.

**Architecture:** Direct one-line emits at the tabs' existing event sites → four new bus kinds under existing categories → three additive `snapshotPeriphery()` fields → enriched `PeripheralWitness` lines + registry band/detail updates → one new reliquary row. Spec: `docs/superpowers/specs/2026-07-11-deep-periphery-design.md`.

**Tech Stack:** Vite/React, vitest (`npx vitest run <path>`). Component tests: `react-dom/client` `createRoot` + `act` (no testing-library). Voice rules: quintessence register, no alien, `compile/seal/deposit/witness/read` vocabulary.

---

## Shared vocabulary

New bus kinds: `gaze/art_resonance {sim}`, `gaze/art_bifurcation {count}` (delta, reducer accumulates), `gaze/art_chimera {}`, `gaze/ecocide_phase {phase, metabolicRift, exergyRate}`, `gaze/scaling_visit {}` (reducer already exists), `transmissions/verdict_issued {verdict}` (verdict = the compact status enum APPROVED/CONDITIONAL/REJECTED/EMERGENCY_VETO).

New periphery fields (all nullable): `art` (`{resonances, lastSim, bifurcations, chimeras}` or visits-only `{visits}`), `ecocideSim` (`{phase, rift}`), `ledgerVerdict` (string).

New slot id: `house_art` (owned by AESTHETICS, grouped with `house_essences` — no new lens call in the compiler; the grouped AESTHETICS lens above `essences` covers both).

---

### Task 1: Bus vocabulary — reducer + totals shape

**Files:**
- Modify: `src/observatory/observatoryBus.js` (makeTotals + updateTotals)
- Test: `src/observatory/__tests__/observatoryBus.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('observatoryBus', …)` block:

```js
  it('gaze.art accumulates resonance, bifurcation deltas, chimera', () => {
    expect(getTotals().gaze.art).toBeNull();
    emit('gaze', 'art_resonance', { sim: 0.83 });
    emit('gaze', 'art_bifurcation', { count: 3 });
    emit('gaze', 'art_bifurcation', { count: 1 });
    emit('gaze', 'art_chimera', {});
    expect(getTotals().gaze.art).toEqual({ resonances: 1, lastSim: 0.83, bifurcations: 4, chimeras: 1 });
  });

  it('art events lazily initialize gaze.art in any order', () => {
    emit('gaze', 'art_chimera', {});
    expect(getTotals().gaze.art).toEqual({ resonances: 0, lastSim: null, bifurcations: 0, chimeras: 1 });
  });

  it('art_resonance without a numeric sim keeps the prior lastSim', () => {
    emit('gaze', 'art_resonance', { sim: 0.5 });
    emit('gaze', 'art_resonance', {});
    expect(getTotals().gaze.art.resonances).toBe(2);
    expect(getTotals().gaze.art.lastSim).toBe(0.5);
  });

  it('gaze.lastEcocide stores the latest phase payload', () => {
    expect(getTotals().gaze.lastEcocide).toBeNull();
    emit('gaze', 'ecocide_phase', { phase: 'OVERSHOOT', metabolicRift: 0.41, exergyRate: 0.2 });
    emit('gaze', 'ecocide_phase', { phase: 'COLLAPSE', metabolicRift: 0.72, exergyRate: 0.1 });
    expect(getTotals().gaze.lastEcocide.phase).toBe('COLLAPSE');
    expect(getTotals().gaze.lastEcocide.metabolicRift).toBe(0.72);
  });

  it('transmissions.verdict stores the latest cascade ruling', () => {
    expect(getTotals().transmissions.verdict).toBeNull();
    emit('transmissions', 'verdict_issued', { verdict: 'REJECTED' });
    expect(getTotals().transmissions.verdict).toBe('REJECTED');
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/observatory/__tests__/observatoryBus.test.js`
Expected: the 5 new tests FAIL (`gaze.art` is `undefined`, not `null`; kinds unreduced); all pre-existing tests still PASS.

- [ ] **Step 3: Implement the reducer**

In `src/observatory/observatoryBus.js`:

**(a)** In `makeTotals()`, replace the `transmissions` and `gaze` lines:

```js
    transmissions: { count: 0, ledgerDepth: 0, last: null, lastTs: 0 },
```
```js
    gaze:          { sphereClicks: 0, lastLunar: null, lastScaling: null, tabsVisited: {}, last: null, lastTs: 0 },
```

with:

```js
    transmissions: { count: 0, ledgerDepth: 0, verdict: null, last: null, lastTs: 0 },
```
```js
    gaze:          { sphereClicks: 0, lastLunar: null, lastScaling: null, tabsVisited: {}, art: null, lastEcocide: null, last: null, lastTs: 0 },
```

**(b)** Add a module-level helper above `updateTotals`:

```js
// gaze.art initializes lazily on the first art event, whatever kind arrives first.
function ensureArt(t) {
  if (!t.art) t.art = { resonances: 0, lastSim: null, bifurcations: 0, chimeras: 0 };
  return t.art;
}
```

**(c)** In `updateTotals`, extend the `case 'transmissions':` block with:

```js
      if (evt.kind === 'verdict_issued') t.verdict = evt.payload.verdict ?? t.verdict;
```

and the `case 'gaze':` block with:

```js
      if (evt.kind === 'art_resonance') {
        const a = ensureArt(t);
        a.resonances++;
        if (typeof evt.payload.sim === 'number') a.lastSim = evt.payload.sim;
      }
      if (evt.kind === 'art_bifurcation') ensureArt(t).bifurcations += evt.payload.count ?? 1;
      if (evt.kind === 'art_chimera')     ensureArt(t).chimeras++;
      if (evt.kind === 'ecocide_phase')   t.lastEcocide = evt.payload;
```

- [ ] **Step 4: Run to verify all pass**

Run: `npx vitest run src/observatory/__tests__/observatoryBus.test.js`
Expected: PASS (all pre-existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/observatory/observatoryBus.js src/observatory/__tests__/observatoryBus.test.js
git commit -m "feat(observatory): deep periphery vocabulary — art, ecocide phase, cascade verdict"
```

---

### Task 2: Periphery snapshot — three additive fields

**Files:**
- Modify: `src/terminal/quintessence/periphery.js`
- Test: `src/terminal/quintessence/__tests__/periphery.test.js`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('snapshotPeriphery', …)` block:

```js
  it('deep periphery: art witnesses interactions, falls back to visits, else null', () => {
    expect(snapshotPeriphery().art).toBeNull();
    emit('gaze', 'tab_navigated', { tab: 'art' });
    expect(snapshotPeriphery().art).toEqual({ visits: 1 });
    emit('gaze', 'art_resonance', { sim: 0.83 });
    emit('gaze', 'art_bifurcation', { count: 14 });
    emit('gaze', 'art_chimera', {});
    expect(snapshotPeriphery().art).toEqual({ resonances: 1, lastSim: 0.83, bifurcations: 14, chimeras: 1 });
  });

  it('deep periphery: ecocideSim and ledgerVerdict witness the signals', () => {
    let p = snapshotPeriphery();
    expect(p.ecocideSim).toBeNull();
    expect(p.ledgerVerdict).toBeNull();
    emit('gaze', 'ecocide_phase', { phase: 'COLLAPSE', metabolicRift: 0.72, exergyRate: 0.1 });
    emit('transmissions', 'verdict_issued', { verdict: 'REJECTED' });
    p = snapshotPeriphery();
    expect(p.ecocideSim).toEqual({ phase: 'COLLAPSE', rift: 0.72 });
    expect(p.ledgerVerdict).toBe('REJECTED');
  });

  it('deep periphery: malformed rift compiles as null, phase still witnessed', () => {
    emit('gaze', 'ecocide_phase', { phase: 'OVERSHOOT', metabolicRift: 'not-a-number' });
    expect(snapshotPeriphery().ecocideSim).toEqual({ phase: 'OVERSHOOT', rift: null });
  });
```

Also update the two whole-snapshot `toEqual` assertions (the "untouched session" test and the "throwing bus" test) — each expected object gains three keys:

```js
      ciphers: null, transmissions: null, essences: null,
      lunarRead: null, houses: { ecocide: null, ledger: null, privacy: null, surveillance: null },
      art: null, ecocideSim: null, ledgerVerdict: null,
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/terminal/quintessence/__tests__/periphery.test.js`
Expected: the 3 new tests FAIL (fields `undefined`); the 2 updated whole-snapshot tests FAIL until Step 3 lands.

- [ ] **Step 3: Extend the snapshot**

In `src/terminal/quintessence/periphery.js`, replace the `return { … }` block's closing fields. The current return ends with:

```js
    lunarRead: g?.lastLunar
      ? { phase: g.lastLunar.phase ?? null, illum: g.lastLunar.illum ?? null } : null,
    houses,
  };
```

Replace with:

```js
    lunarRead: g?.lastLunar
      ? { phase: g.lastLunar.phase ?? null, illum: g.lastLunar.illum ?? null } : null,
    houses,
    // Deep periphery (spec 2026-07-11): the four houses learn to speak.
    // art distinguishes "entered but never touched" (visits-only) from "never came" (null).
    art: g?.art
      ? { resonances: g.art.resonances || 0, lastSim: g.art.lastSim ?? null,
          bifurcations: g.art.bifurcations || 0, chimeras: g.art.chimeras || 0 }
      : ((g?.tabsVisited?.art || 0) > 0 ? { visits: g.tabsVisited.art } : null),
    ecocideSim: g?.lastEcocide && g.lastEcocide.phase != null
      ? { phase: g.lastEcocide.phase,
          rift: typeof g.lastEcocide.metabolicRift === 'number' ? g.lastEcocide.metabolicRift : null }
      : null,
    ledgerVerdict: tr?.verdict ?? null,
  };
```

- [ ] **Step 4: Run to verify all pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/periphery.test.js`
Expected: PASS (4 pre-existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/periphery.js src/terminal/quintessence/__tests__/periphery.test.js
git commit -m "feat(quintessence): periphery witnesses art, ecocide sim, cascade verdict"
```

---

### Task 3: Registry — aesthetics adopts the sphere; sociology and history learn detail

**Files:**
- Modify: `src/terminal/quintessence/taxonomyRegistry.js` (aesthetics, sociology, history, anthropology entries)
- Test: `src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`

- [ ] **Step 1: Write the failing tests**

**(a)** In the existing band-edges test (`'band edges land as documented (spec §5)'`), replace the anthropology block:

```js
    const withFilled = n => ({ ...CTX, meta: { ...CTX.meta, filledHouses: n } });
    expect(at('witness_intro', withFilled(2))).toBe('sparse');
    expect(at('witness_intro', withFilled(3))).toBe('attended');
    expect(at('witness_intro', withFilled(6))).toBe('dense');
```

with:

```js
    const withFilled = n => ({ ...CTX, meta: { ...CTX.meta, filledHouses: n } });
    expect(at('witness_intro', withFilled(2))).toBe('sparse');
    expect(at('witness_intro', withFilled(3))).toBe('attended');
    expect(at('witness_intro', withFilled(6))).toBe('attended'); // shifted: 9 houses now
    expect(at('witness_intro', withFilled(7))).toBe('dense');
```

**(b)** Append a new describe block at the end of the file:

```js
describe('deep periphery — enriched readings', () => {
  const entry = slot => TAXONOMY.find(d => d.owns.includes(slot));
  const withPeriphery = patch => ({ ...CTX, periphery: { ...CTX.periphery, ...patch } });
  const BARE_HOUSES = { ecocide: null, ledger: null, privacy: null, surveillance: null };

  it('aesthetics owns house_art and reads art OR essences as witnessed', () => {
    expect(ownerOf('house_art')).toBe('AESTHETICS');
    const aesthetics = entry('house_essences');
    expect(aesthetics.band(withPeriphery({ essences: null, art: null }))).toBe('absent');
    expect(aesthetics.band(withPeriphery({ essences: null, art: { visits: 2 } }))).toBe('witnessed');
    expect(aesthetics.band(withPeriphery({ art: null }))).toBe('witnessed'); // essences present in CTX
  });

  it('aesthetics detail: art interactions → essences → visits-only → null', () => {
    const aesthetics = entry('house_essences');
    expect(aesthetics.detail(withPeriphery({ art: { resonances: 1, lastSim: 0.83, bifurcations: 0, chimeras: 1 } })))
      .toBe('1 chimera · resonance 0.83');
    expect(aesthetics.detail(withPeriphery({ art: null }))).toBe('1 crystallized');
    expect(aesthetics.detail(withPeriphery({ essences: null, art: { visits: 2 } })))
      .toBe('the sphere seen, unengaged');
    expect(aesthetics.detail(withPeriphery({ essences: null, art: null }))).toBeNull();
  });

  it('sociology: band counts ecocideSim, detail interpolates the rift', () => {
    const sociology = entry('house_ecocide');
    expect(sociology.band(withPeriphery({ houses: BARE_HOUSES, ecocideSim: null }))).toBe('absent');
    expect(sociology.band(withPeriphery({ houses: BARE_HOUSES, ecocideSim: { phase: 'COLLAPSE', rift: 0.72 } }))).toBe('witnessed');
    expect(sociology.detail(withPeriphery({ ecocideSim: { phase: 'COLLAPSE', rift: 0.72 } })))
      .toBe('metabolic rift 0.72 at COLLAPSE');
    expect(sociology.detail(withPeriphery({ ecocideSim: { phase: 'COLLAPSE', rift: null } })))
      .toBe('phase COLLAPSE witnessed');
    expect(sociology.detail(withPeriphery({ ecocideSim: null }))).toBeNull();
  });

  it('history: band counts ledgerVerdict, detail names the ruling', () => {
    const history = entry('house_ledger');
    expect(history.band(withPeriphery({ transmissions: null, houses: BARE_HOUSES, ledgerVerdict: null }))).toBe('absent');
    expect(history.band(withPeriphery({ transmissions: null, houses: BARE_HOUSES, ledgerVerdict: 'REJECTED' }))).toBe('witnessed');
    expect(history.detail(withPeriphery({ ledgerVerdict: 'REJECTED' }))).toBe('the cascade ruled REJECTED');
    expect(history.detail(withPeriphery({ ledgerVerdict: null }))).toBeNull();
  });

  it('anthropology denominator is 9', () => {
    const anthro = entry('witness_intro');
    expect(anthro.detail({ ...CTX, meta: { ...CTX.meta, filledHouses: 6 } })).toBe('6 of 9 houses witnessed');
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: the new describe block FAILS (`ownerOf('house_art')` null, details null/undefined, `of 8`); the edited anthropology edge lines FAIL (`6` still dense).

- [ ] **Step 3: Update the four registry entries**

In `src/terminal/quintessence/taxonomyRegistry.js`:

**(a) aesthetics** — replace its `owns`/`band`/`detail` lines:

```js
    owns: ['house_essences'],
    band: (ctx) => (ctx?.periphery?.essences ? 'witnessed' : 'absent'),
    detail: null,
```

with:

```js
    owns: ['house_essences', 'house_art'],
    // Entering the sphere counts as witnessing form, even untouched (deep-periphery spec §5.3).
    band: (ctx) => ((ctx?.periphery?.essences || ctx?.periphery?.art) ? 'witnessed' : 'absent'),
    detail: (ctx) => {
      const a = ctx?.periphery?.art;
      const e = ctx?.periphery?.essences;
      if (a && a.visits == null) {
        const parts = [
          a.chimeras ? `${a.chimeras} chimera${a.chimeras === 1 ? '' : 's'}` : null,
          a.bifurcations ? `${a.bifurcations} bifurcation${a.bifurcations === 1 ? '' : 's'}` : null,
          a.lastSim != null ? `resonance ${Number(a.lastSim).toFixed(2)}` : null,
        ].filter(Boolean);
        if (parts.length) return parts.join(' · ');
      }
      if (e) return `${e.crystallized ?? 0} crystallized`;
      if (a) return 'the sphere seen, unengaged';
      return null;
    },
```

**(b) sociology** — replace its `band`/`detail` lines:

```js
    band: (ctx) => {
      const h = ctx?.periphery?.houses ?? {};
      return (h.ecocide || h.privacy || h.surveillance) ? 'witnessed' : 'absent';
    },
    detail: null,
```

with:

```js
    band: (ctx) => {
      const h = ctx?.periphery?.houses ?? {};
      return (h.ecocide || h.privacy || h.surveillance || ctx?.periphery?.ecocideSim) ? 'witnessed' : 'absent';
    },
    detail: (ctx) => {
      const s = ctx?.periphery?.ecocideSim;
      if (!s) return null;
      return s.rift != null ? `metabolic rift ${Number(s.rift).toFixed(2)} at ${s.phase}` : `phase ${s.phase} witnessed`;
    },
```

**(c) history** — replace its `band`/`detail` lines:

```js
    band: (ctx) =>
      (ctx?.periphery?.transmissions || ctx?.periphery?.houses?.ledger) ? 'witnessed' : 'absent',
    detail: null,
```

with:

```js
    band: (ctx) =>
      (ctx?.periphery?.transmissions || ctx?.periphery?.houses?.ledger || ctx?.periphery?.ledgerVerdict) ? 'witnessed' : 'absent',
    detail: (ctx) =>
      (ctx?.periphery?.ledgerVerdict ? `the cascade ruled ${ctx.periphery.ledgerVerdict}` : null),
```

**(d) anthropology** — replace its `band`/`detail` lines:

```js
    band: (ctx) => {
      const n = ctx?.meta?.filledHouses ?? 0;
      return n < 3 ? 'sparse' : n < 6 ? 'attended' : 'dense';
    },
    detail: (ctx) => `${ctx?.meta?.filledHouses ?? 0} of 8 houses witnessed`,
```

with:

```js
    band: (ctx) => {
      const n = ctx?.meta?.filledHouses ?? 0;
      return n < 3 ? 'sparse' : n < 7 ? 'attended' : 'dense'; // 9 houses since deep periphery
    },
    detail: (ctx) => `${ctx?.meta?.filledHouses ?? 0} of 9 houses witnessed`,
```

- [ ] **Step 4: Run to verify all pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: PASS (10 pre-existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/taxonomyRegistry.js src/terminal/quintessence/__tests__/taxonomyRegistry.test.js
git commit -m "feat(quintessence): aesthetics adopts the sphere; sociology and history learn detail"
```

---

### Task 4: Compiler — house_art and enriched house testimony

**Files:**
- Modify: `src/terminal/quintessence/compileKernel.js`
- Test: `src/terminal/quintessence/__tests__/compileKernel.test.js`

- [ ] **Step 1: Write the failing tests**

**(a)** In `compileKernel.test.js`, extend `FULL_PERIPHERY` with the three new fields (after `houses`):

```js
  houses: { ecocide: 1, ledger: null, privacy: 3, surveillance: null },
  art: { resonances: 1, lastSim: 0.83, bifurcations: 14, chimeras: 1 },
  ecocideSim: { phase: 'COLLAPSE', rift: 0.72 },
  ledgerVerdict: 'REJECTED',
```

**(b)** In the existing `'empty houses compile as None with the witness comment'` test, extend the `bare` fixture with the three keys and one assertion:

```js
    const bare = { ciphers: null, transmissions: null, essences: null, lunarRead: null,
                   houses: { ecocide: null, ledger: null, privacy: null, surveillance: null },
                   art: null, ecocideSim: null, ledgerVerdict: null };
```

and add after the `ciphers: None` assertion:

```js
    expect(source).toContain('house_art: None');
```

**(c)** Append two tests inside the `describe('compileKernel', …)` block:

```js
  it('deep periphery: house_art compiles all three states (spec §5.2)', async () => {
    const a = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(a.source).toContain('house_art: Some("chimera fused ×1 · 14 bifurcations · resonance 0.83")');
    const visitsOnly = { ...FULL_PERIPHERY, art: { visits: 2 } };
    const b = await compileKernel(FULL_SPINE, visitsOnly, ENGINE, OPTS);
    expect(b.source).toContain('house_art: Some("entered 2× · the sphere untouched")');
  });

  it('deep periphery: ledger and ecocide houses carry their testimony', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source).toContain('house_ledger: Some("verdict REJECTED")'); // verdict alone fills the house
    expect(source).toContain('house_ecocide: Some("entered 1× · phase COLLAPSE · metabolic rift 0.72")');
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/terminal/quintessence/__tests__/compileKernel.test.js`
Expected: the 2 new tests and the extended empty-house assertion FAIL (no `house_art` in the artifact); all others still PASS.

- [ ] **Step 3: Extend the compiler**

In `src/terminal/quintessence/compileKernel.js`:

**(a)** In the `filledHouses` computation, add `periphery.art` to the group array:

```js
  const filledHouses =
    [periphery.ciphers, periphery.transmissions, periphery.essences, periphery.lunarRead, periphery.art]
      .filter(Boolean).length +
    Object.values(periphery.houses).filter(Boolean).length;
```

**(b)** Immediately before `const source = ...`, add the house-testimony builders:

```js
  // Deep periphery (spec 2026-07-11 §5.2): enriched house testimony.
  // A missing part is omitted; a witnessed house never renders an empty line.
  const artDesc = periphery.art
    ? (periphery.art.visits != null
        ? `entered ${periphery.art.visits}× · the sphere untouched`
        : [periphery.art.chimeras ? `chimera fused ×${periphery.art.chimeras}` : null,
           periphery.art.bifurcations ? `${periphery.art.bifurcations} bifurcation${periphery.art.bifurcations === 1 ? '' : 's'}` : null,
           periphery.art.lastSim != null ? `resonance ${Number(periphery.art.lastSim).toFixed(2)}` : null,
          ].filter(Boolean).join(' · ') || 'the sphere touched')
    : null;
  const ledgerValue = periphery.houses.ledger ?? periphery.ledgerVerdict ?? null;
  const ledgerDesc = [
    periphery.houses.ledger ? `entered ${periphery.houses.ledger}×` : null,
    periphery.ledgerVerdict ? `verdict ${periphery.ledgerVerdict}` : null,
  ].filter(Boolean).join(' · ');
  const ecocideValue = periphery.houses.ecocide ?? periphery.ecocideSim ?? null;
  const ecocideDesc = [
    periphery.houses.ecocide ? `entered ${periphery.houses.ecocide}×` : null,
    periphery.ecocideSim ? `phase ${periphery.ecocideSim.phase}` : null,
    periphery.ecocideSim?.rift != null ? `metabolic rift ${Number(periphery.ecocideSim.rift).toFixed(2)}` : null,
  ].filter(Boolean).join(' · ');
```

**(c)** In the `PeripheralWitness` struct definition inside the template, add `house_art` after `essences`:

```
struct PeripheralWitness {
    ciphers: Option<&'static str>,
    transmissions: Option<&'static str>,
    house_ledger: Option<&'static str>,
    essences: Option<&'static str>,
    house_art: Option<&'static str>,
    house_ecocide: Option<&'static str>,
    house_privacy: Option<&'static str>,
    house_surveillance: Option<&'static str>,
}
```

**(d)** In the const literal, replace the `house_ledger`, and `house_ecocide` lines and add `house_art` after the essences line. The three changed/added `houseLine` calls:

```
${houseLine('house_ledger', ledgerValue, ledgerDesc)}
```

(replacing `${houseLine('house_ledger', periphery.houses.ledger, \`entered ${periphery.houses.ledger}×\`)}`)

```
${houseLine('house_art', periphery.art, artDesc)}
```

(new line, directly after the `${houseLine('essences', …)}` line — inside the AESTHETICS group, no new lens comment)

```
${houseLine('house_ecocide', ecocideValue, ecocideDesc)}
```

(replacing `${houseLine('house_ecocide', periphery.houses.ecocide, \`entered ${periphery.houses.ecocide}×\`)}`)

The `// ${lensFor(...)}` group-lens comment lines and all other houseLine calls stay exactly where they are.

- [ ] **Step 4: Run the compiler and registry suites**

Run: `npx vitest run src/terminal/quintessence/__tests__/compileKernel.test.js src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: all PASS (14 compileKernel + 15 registry).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/compileKernel.js src/terminal/quintessence/__tests__/compileKernel.test.js
git commit -m "feat(quintessence): house_art + enriched ledger/ecocide testimony in the artifact"
```

---

### Task 5: Tab emits — the four houses start speaking

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx` (import + 1 ref + 4 emit sites)
- Modify: `src/terminal/views/EcocideTab.jsx` (import + 1 ref + 1 guarded emit)
- Modify: `src/terminal/views/LedgerTab.jsx` (import + 1 emit)
- Modify: `src/terminal/views/ScalingTab.jsx` (imports + mount effect)

No unit tests for the 3k-line canvas tabs (spec §8) — the bus reducer tests already pin the contract. Verification is suite-green + build + a grep audit.

- [ ] **Step 1: ArtTab**

**(a)** Add the import next to the other top-level imports:

```js
import { emit as emitObs } from '../../observatory/observatoryBus';
```

**(b)** Next to `const [chimeraActive, setChimeraActive] = useState(false);` (~line 190) add:

```js
  const chimeraWitnessedRef = useRef(false); // observatory: witness the first chimera only
```

**(c)** Bifurcation site 1 (~line 544). After:

```js
    setBifurcCount(c => c + spawned.length);
```

add:

```js
    emitObs('gaze', 'art_bifurcation', { count: spawned.length });
```

**(d)** Bifurcation site 2 (~line 2239). After:

```js
      setBifurcCount(c => c + 1);
```

add:

```js
      emitObs('gaze', 'art_bifurcation', { count: 1 });
```

**(e)** Resonance site (~line 1895). After:

```js
            setResonanceResult(result);
```

add:

```js
            emitObs('gaze', 'art_resonance', { sim: result?.sim ?? null });
```

**(f)** Chimera site — the throttled reasoning-state push (~line 664). Replace:

```js
        setChimeraActive(_cz);
```

with:

```js
        setChimeraActive(_cz);
        if (_cz && !chimeraWitnessedRef.current) {
          chimeraWitnessedRef.current = true;
          emitObs('gaze', 'art_chimera', {});
        }
```

- [ ] **Step 2: EcocideTab**

**(a)** Add the import next to the other top-level imports:

```js
import { emit as emitObs } from '../../observatory/observatoryBus';
```

**(b)** Add a ref next to the component's existing refs (e.g. beside `sargHistoryRef`):

```js
  const obsPhaseRef = useRef(null); // observatory: witness phase transitions, not the 10 Hz tick
```

(`useRef` is already imported in this file; verify, and add it to the React import if somehow absent.)

**(c)** At line ~484, directly after:

```js
      ecocideBus.emit({ type: 'ECOCIDE_PHASE', phase, metabolicRift: metabolicFat, exergyRate: exergyNorm });
```

add:

```js
      if (phase !== obsPhaseRef.current) {
        obsPhaseRef.current = phase;
        emitObs('gaze', 'ecocide_phase', { phase, metabolicRift: metabolicFat, exergyRate: exergyNorm });
      }
```

- [ ] **Step 3: LedgerTab**

**(a)** Add the import next to the other top-level imports:

```js
import { emit as emitObs } from '../../observatory/observatoryBus';
```

**(b)** In `handleCascadeComplete` (~line 179), directly after:

```js
    ledgerBus.emit({ type: 'VERDICT_ISSUED', verdict: cascadeVerdict });
```

add:

```js
    emitObs('transmissions', 'verdict_issued', { verdict: cascadeVerdict.status ?? 'UNKNOWN' });
```

- [ ] **Step 4: ScalingTab**

Replace the first line:

```js
import React from 'react';
```

with:

```js
import React, { useEffect } from 'react';
import { emit as emitObs } from '../../observatory/observatoryBus';
```

(keep the existing `Hexagon`/`LatentCollider` imports as they are) and add as the first statement inside the component body:

```js
  // Observatory witness: the saponification arc was approached (dead channel, now wired).
  useEffect(() => { emitObs('gaze', 'scaling_visit', {}); }, []);
```

- [ ] **Step 5: Verify — suite, build, audit**

Run: `npx vitest run`
Expected: full suite PASS, no regressions.

Run: `npm run build`
Expected: clean build.

Run: `grep -c "emitObs(" src/terminal/views/ArtTab.jsx src/terminal/views/EcocideTab.jsx src/terminal/views/LedgerTab.jsx src/terminal/views/ScalingTab.jsx`
Expected: `4`, `1`, `1`, `1` (import lines don't match the call pattern).

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/ArtTab.jsx src/terminal/views/EcocideTab.jsx src/terminal/views/LedgerTab.jsx src/terminal/views/ScalingTab.jsx
git commit -m "feat(observatory): the four houses speak — art, ecocide, ledger, scaling emit witnesses"
```

---

### Task 6: Reliquary — the art house appears

**Files:**
- Modify: `src/terminal/quintessence/ReliquaryView.jsx` (slot list)
- Test: `src/terminal/quintessence/__tests__/reliquaryView.test.jsx`

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('ReliquaryView — the faculty roster on the schematic', …)` block:

```js
  it('the art house appears with its reader', () => {
    const text = container.textContent;
    expect(text).toContain('house: art');
    expect(text.match(/read by ⟨AESTHETICS⟩/g)).toHaveLength(2); // essences + art
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/reliquaryView.test.jsx`
Expected: the new test FAILS (`house: art` absent, AESTHETICS ×1); the 2 pre-existing tests still PASS.

- [ ] **Step 3: Extend the slot list**

In `ReliquaryView.jsx`, replace these three lines of the `slots` array:

```js
    slot('house_essences',      'house: essences',               !!p.essences,    p.essences && `${p.essences.collisions} collisions`),
    slot('house_ecocide',       'house: ecocide',                !!p.houses.ecocide, p.houses.ecocide && `entered ${p.houses.ecocide}×`),
    slot('house_ledger',        'house: ledger',                 !!p.houses.ledger, p.houses.ledger && `entered ${p.houses.ledger}×`),
```

with:

```js
    slot('house_essences',      'house: essences',               !!p.essences,    p.essences && `${p.essences.collisions} collisions`),
    slot('house_art',           'house: art',                    !!p.art,         p.art && (p.art.visits != null ? `entered ${p.art.visits}×` : (p.art.chimeras ? `${p.art.chimeras} chimera${p.art.chimeras === 1 ? '' : 's'}` : 'touched'))),
    slot('house_ecocide',       'house: ecocide',                !!(p.houses.ecocide || p.ecocideSim), p.ecocideSim?.phase ?? (p.houses.ecocide && `entered ${p.houses.ecocide}×`)),
    slot('house_ledger',        'house: ledger',                 !!(p.houses.ledger || p.ledgerVerdict), p.ledgerVerdict ?? (p.houses.ledger && `entered ${p.houses.ledger}×`)),
```

(The `house: privacy` / `house: surveillance` / all other slot lines stay untouched. `ownerOf('house_art')` already resolves to AESTHETICS from Task 3 — no render-code changes needed.)

- [ ] **Step 4: Run to verify all pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/reliquaryView.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/ReliquaryView.jsx src/terminal/quintessence/__tests__/reliquaryView.test.jsx
git commit -m "feat(quintessence): the art house joins the reliquary schematic"
```

---

### Task 7: Full verification

**Files:** none new.

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all files PASS (430+ tests), no regressions.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Voice audit**

```bash
grep -inE "alien|generate|submit|\bsave\b|analyze" src/terminal/quintessence/taxonomyRegistry.js src/terminal/quintessence/compileKernel.js src/terminal/quintessence/periphery.js
```

Expected: no matches (exit code 1).

- [ ] **Step 4: Tree check**

Run: `git status --short`
Expected: clean.

---

## Self-review notes (plan ↔ spec)

- Spec §3 bus vocabulary → Task 1 (reducer, delta semantics, lazy `gaze.art`, declared shapes) + Task 5 (emit sites, ref guards for the rAF/10 Hz loops, `cascadeVerdict.status`, ScalingTab mount effect). §4 periphery → Task 2 (three additive fields, visits-only fallback, defensive rift). §5.1–5.2 artifact → Task 4 (struct order with `house_art` after `essences`, testimony builders, verdict-alone fills the house). §5.3 registry → Task 3 (aesthetics owns/band/detail with the ordered fallback, sociology/history bands + details, anthropology 9-house notches). §5.4 witness depth → Task 4(a) + Task 3(d). §6 reliquary → Task 6. §7 error handling → never-throw paths tested in Tasks 1–2; bus try/catch untouched. §8 testing → mirrored per task; tab components untested by design. §9 voice → new copy in Tasks 3–4 follows houseLine idiom; §10 non-goals → no tab UI, no exergy compiled, no new pools, no Rust, no rich scaling house, `sphere_clicked` TODO untouched.
- Type consistency: `art {resonances, lastSim, bifurcations, chimeras}` / `{visits}`, `ecocideSim {phase, rift}`, `ledgerVerdict` string — identical across bus (Task 1), periphery (Task 2), registry ctx reads (Task 3), compiler (Task 4), reliquary previews (Task 6).
- Determinism: no new rng consumption; hash inputs gain the new periphery fields naturally (richer identity, unchanged discipline).
