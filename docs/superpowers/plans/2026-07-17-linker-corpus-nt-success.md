# THE LINKER — Corpus Wiring + nt success Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 43-entry kernel corpus (`kernelBuilds.js`) into the quintessence compiler as THE LINKER block, with **nt success** as TARGET 0 — the default build target the compiler never links.

**Architecture:** Two witness verbs ride existing bus events (`kernel_loaded` = consulted; `kernel_completed` joined via `resolveWasmAlias` = linked) plus one new emit (`kernel_consulted` on article nav). `periphery.js` snapshots a nullable `corpus` field (hashed witness data). `compileKernel.js` renders THE LINKER between the peripheral witness and the panic handler. The taxonomy registry gains its sixteenth discipline, SOCIOLOGY ⇄ ECONOMICS, owning the `linker` lens.

**Tech Stack:** Vanilla JS modules, React (App.jsx only), vitest.

**Spec:** `docs/superpowers/specs/2026-07-17-linker-corpus-nt-success-design.md`

## Global Constraints

- **nt success** terminology: defined in the spec; docs use lowercase "nt success"; artifact renders `nt_success` / `TARGET 0`.
- Determinism: no `Math.random()`; only the artifact-seeded `mulberry32` rng, fixed call order (spec §4).
- `corpus` is hashed witness data; lenses are voice only (spec §3).
- The linker is an organ, not a house: `filledHouses` and anthropology's "of 9 houses" stay untouched (spec §3).
- Session-scoped, in-memory witness; no persistence; no KernelTab UI changes (spec §2).
- Never push to origin.
- All test runs: `npx vitest run <path>` from `F:\scale_9.4`.

---

### Task 1: Bus reducer — three accumulators

**Files:**
- Modify: `src/observatory/observatoryBus.js` (`makeTotals` ~line 14, `updateTotals` transmissions ~line 65, gaze ~line 92)
- Test: `src/observatory/__tests__/observatoryBus.test.js`

**Interfaces:**
- Produces: `getTotals().transmissions.kernelsLoaded: {[buildId]: count}`, `getTotals().transmissions.ranAliases: {[wasmId]: count}`, `getTotals().gaze.kernelsConsulted: {[articleId]: count}`. Placeholder id `'—'` is never recorded.

- [ ] **Step 1: Write the failing tests** — append to `observatoryBus.test.js`:

```js
describe('THE LINKER accumulators (spec 2026-07-17)', () => {
  beforeEach(() => _resetForTests());

  it('kernel_loaded accumulates build ids and skips the placeholder', () => {
    emit('transmissions', 'kernel_loaded', { kernelId: 'BOSONIC-KERNEL-3.0.0' });
    emit('transmissions', 'kernel_loaded', { kernelId: 'BOSONIC-KERNEL-3.0.0' });
    emit('transmissions', 'kernel_loaded', { kernelId: '—' });
    emit('transmissions', 'kernel_loaded', {});
    expect(getTotals().transmissions.kernelsLoaded).toEqual({ 'BOSONIC-KERNEL-3.0.0': 2 });
  });

  it('kernel_completed also records the wasm alias', () => {
    emit('transmissions', 'kernel_completed', { kernelId: 'bosonic' });
    expect(getTotals().transmissions.ranAliases).toEqual({ bosonic: 1 });
    expect(getTotals().transmissions.count).toBe(1); // existing counter untouched
  });

  it('gaze kernel_consulted accumulates articleIds', () => {
    emit('gaze', 'kernel_consulted', { articleId: 'SOMA-KERNEL-5.5.0' });
    expect(getTotals().gaze.kernelsConsulted).toEqual({ 'SOMA-KERNEL-5.5.0': 1 });
  });
});
```

(The file already imports `emit`, `getTotals`, `_resetForTests`, and `beforeEach` — the new describe is self-contained.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/observatory/__tests__/observatoryBus.test.js`
Expected: 3 new tests FAIL (`kernelsLoaded` undefined).

- [ ] **Step 3: Implement.** In `makeTotals()` change the two lines:

```js
    transmissions: { count: 0, ledgerDepth: 0, verdict: null, lastSignal: null, kernelsLoaded: {}, ranAliases: {}, last: null, lastTs: 0 },
```

```js
    gaze:          { sphereClicks: 0, lastLunar: null, lastScaling: null, tabsVisited: {}, kernelsConsulted: {}, art: null, lastEcocide: null, lastManifestoFragment: null, last: null, lastTs: 0 },
```

In `updateTotals`, transmissions case — replace the `kernel_completed` line and add `kernel_loaded`:

```js
      if (evt.kind === 'kernel_completed') {
        t.count++;
        const alias = evt.payload.kernelId;
        if (alias && alias !== '—') t.ranAliases[alias] = (t.ranAliases[alias] || 0) + 1;
      }
      if (evt.kind === 'kernel_loaded') {
        const id = evt.payload.kernelId;
        if (id && id !== '—') t.kernelsLoaded[id] = (t.kernelsLoaded[id] || 0) + 1;
      }
```

In the gaze case add:

```js
      if (evt.kind === 'kernel_consulted' && evt.payload.articleId)
        t.kernelsConsulted[evt.payload.articleId] = (t.kernelsConsulted[evt.payload.articleId] || 0) + 1;
```

- [ ] **Step 4: Run the whole bus suite** — if any pre-existing test asserts totals shape with exact `toEqual`, extend its expected object with `kernelsLoaded: {}` / `ranAliases: {}` / `kernelsConsulted: {}` as appropriate.

Run: `npx vitest run src/observatory/__tests__/observatoryBus.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/observatory/observatoryBus.js src/observatory/__tests__/observatoryBus.test.js
git commit -m "feat(observatory): linker accumulators — kernelsLoaded, ranAliases, kernelsConsulted"
```

---

### Task 2: App.jsx — the one new emit

**Files:**
- Modify: `src/terminal/App.jsx` (handleNav, directly after `emitObs('gaze', 'tab_navigated', { tab });` at ~line 654)

**Interfaces:**
- Consumes: Task 1's `kernel_consulted` reducer.
- Produces: `gaze / kernel_consulted { articleId }` on every article opened into the kernel tab.

- [ ] **Step 1: Edit.** After the `tab_navigated` emit inside `handleNav` (line ~654 — the one inside the callback that computes `const tab = isFiction ? 'transmission' : isEco ? 'ecocide' : 'kernel';`), add:

```js
    if (tab === 'kernel' && article?.id)
      emitObs('gaze', 'kernel_consulted', { articleId: article.id }); // THE LINKER: consult witness
```

Notes for the implementer: this intentionally fires for ANY article routed to the kernel tab; periphery resolves articleIds against `kernelBuilds` and silently drops non-corpus ids. Terminal `cat`/`open` command paths bypass `handleNav` — accepted gap per spec (§2 covers UI navigation + `handleKernelClick`'s existing `kernel_loaded`).

- [ ] **Step 2: Sanity-run the app's existing test suite for App-adjacent regressions** (there is no direct unit test for handleNav; wiring is verified end-to-end in Task 6):

Run: `npx vitest run src/terminal/quintessence src/observatory`
Expected: PASS (unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/terminal/App.jsx
git commit -m "feat(terminal): emit kernel_consulted on kernel-tab article nav"
```

---

### Task 3: Periphery — the corpus snapshot

**Files:**
- Modify: `src/terminal/quintessence/periphery.js`
- Test: `src/terminal/quintessence/__tests__/periphery.test.js`

**Interfaces:**
- Consumes: Task 1 totals; `kernelBuilds` (default export, `{id, articleId, name, status, lore?}`); `resolveWasmAlias(id)` from `../data/mobileWasmMap`.
- Produces: `snapshotPeriphery().corpus` = `{ linked: string[], consulted: string[], total: number } | null` — build ids in `kernelBuilds` order, linked wins ties, `total = kernelBuilds.length`.

- [ ] **Step 1: Write the failing tests** — append to `periphery.test.js`:

```js
import kernelBuilds from '../../data/kernelBuilds';

describe('corpus (THE LINKER, spec 2026-07-17)', () => {
  beforeEach(() => _resetForTests());

  it('kernel_loaded consults a corpus build', () => {
    emit('transmissions', 'kernel_loaded', { kernelId: 'BOSONIC-KERNEL-3.0.0' });
    const p = snapshotPeriphery();
    expect(p.corpus).toEqual({ linked: [], consulted: ['BOSONIC-KERNEL-3.0.0'], total: kernelBuilds.length });
  });

  it('kernel_consulted resolves via articleId', () => {
    emit('gaze', 'kernel_consulted', { articleId: 'SOMA-KERNEL-5.5.0' });
    expect(snapshotPeriphery().corpus.consulted).toEqual(['SOMA-KERNEL-5.5.0']);
  });

  it('consult + completed alias → linked (linked wins ties)', () => {
    emit('transmissions', 'kernel_loaded', { kernelId: 'BOSONIC-KERNEL-3.0.0' });
    emit('transmissions', 'kernel_completed', { kernelId: 'bosonic' });
    const c = snapshotPeriphery().corpus;
    expect(c.linked).toEqual(['BOSONIC-KERNEL-3.0.0']);
    expect(c.consulted).toEqual([]);
  });

  it('a run without a consult does not conjure the corpus', () => {
    emit('transmissions', 'kernel_completed', { kernelId: 'bosonic' });
    expect(snapshotPeriphery().corpus).toBeNull();
  });

  it('non-corpus ids are ignored', () => {
    emit('transmissions', 'kernel_loaded', { kernelId: 'kuramoto' });
    emit('gaze', 'kernel_consulted', { articleId: 'not-a-kernel-article' });
    expect(snapshotPeriphery().corpus).toBeNull();
  });

  it('ordering follows kernelBuilds order', () => {
    emit('transmissions', 'kernel_loaded', { kernelId: 'SOMA-KERNEL-5.5.0' });
    emit('transmissions', 'kernel_loaded', { kernelId: 'BOSONIC-KERNEL-3.0.0' });
    expect(snapshotPeriphery().corpus.consulted).toEqual(['BOSONIC-KERNEL-3.0.0', 'SOMA-KERNEL-5.5.0']);
  });
});
```

Also extend the existing `an untouched session yields all-None houses` exact-equality object with `corpus: null`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/terminal/quintessence/__tests__/periphery.test.js`
Expected: new tests FAIL (`corpus` undefined); untouched-session test FAILS until field added.

- [ ] **Step 3: Implement.** In `periphery.js` add imports:

```js
import kernelBuilds from '../data/kernelBuilds';
import { resolveWasmAlias } from '../data/mobileWasmMap';
```

Add above `snapshotPeriphery`:

```js
// THE LINKER (spec 2026-07-17): the corpus witness. A build is consulted when
// its documentation was opened (kernel_loaded build id, or kernel_consulted
// articleId); linked when, additionally, its resolved wasm alias completed a
// run this session. Linked wins ties. Ids outside the corpus resolve to
// nothing — sphere kernels are already witnessed in house_chaos.
function snapshotCorpus(tr, g) {
  const loaded    = tr?.kernelsLoaded    ? Object.keys(tr.kernelsLoaded)    : [];
  const articles  = g?.kernelsConsulted  ? Object.keys(g.kernelsConsulted)  : [];
  if (!loaded.length && !articles.length) return null;
  const ran = new Set(tr?.ranAliases ? Object.keys(tr.ranAliases) : []);
  const loadedSet = new Set(loaded), articleSet = new Set(articles);
  const linked = [], consulted = [];
  for (const b of kernelBuilds) {                    // registry order = render order
    if (!loadedSet.has(b.id) && !articleSet.has(b.articleId)) continue;
    (ran.has(resolveWasmAlias(b.id)) ? linked : consulted).push(b.id);
  }
  if (!linked.length && !consulted.length) return null;
  return { linked, consulted, total: kernelBuilds.length };
}
```

In the return object of `snapshotPeriphery`, after `manifestoFragment`, add:

```js
    corpus: snapshotCorpus(tr, g),
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/periphery.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/periphery.js src/terminal/quintessence/__tests__/periphery.test.js
git commit -m "feat(quintessence): periphery witnesses the kernel corpus (consulted/linked)"
```

---

### Task 4: Taxonomy — the sixteenth discipline

**Files:**
- Modify: `src/terminal/quintessence/taxonomyRegistry.js` (header comment lines 3–5; new entry after `linguistics_hermetics`, before the closing `];`)
- Test: `src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`

**Interfaces:**
- Consumes: `ctx.periphery.corpus` (Task 3 shape).
- Produces: `lensFor('linker', ctx, rng)` → tagged line `⟨SOCIOLOGY ⇄ ECONOMICS⟩ …`; `ownerOf('linker')` → `'SOCIOLOGY ⇄ ECONOMICS'`.

- [ ] **Step 1: Write the failing tests.** In `taxonomyRegistry.test.js`, update the completeness test: `toHaveLength(15)` → `toHaveLength(16)`, `byTier.OVERLAP_MATRIX` `4` → `5`, and the describe title text `15 disciplines … 4 overlap pairs` → `16 disciplines … 5 overlap pairs`. Then append:

```js
describe('sociology_economics — THE LINKER lens (spec 2026-07-17)', () => {
  const entry = TAXONOMY.find(d => d.id === 'sociology_economics');

  it('owns the linker slot', () => {
    expect(ownerOf('linker')).toBe('SOCIOLOGY ⇄ ECONOMICS');
  });

  it('bands unopened → consulted → linked', () => {
    expect(entry.band({ periphery: {} })).toBe('unopened');
    expect(entry.band({ periphery: { corpus: { linked: [], consulted: ['X'], total: 43 } } })).toBe('consulted');
    expect(entry.band({ periphery: { corpus: { linked: ['X'], consulted: [], total: 43 } } })).toBe('linked');
  });

  it('detail prices the contact', () => {
    expect(entry.detail({ periphery: { corpus: { linked: ['A'], consulted: ['B', 'C'], total: 43 } } }))
      .toBe('1 linked · 2 consulted · of 43');
    expect(entry.detail({ periphery: {} })).toBeNull();
  });

  it('lensFor renders the double tag', () => {
    const line = lensFor('linker', { spine: { element: 'FIRE' }, periphery: {} }, mulberry32(7));
    expect(line).toMatch(/^⟨SOCIOLOGY ⇄ ECONOMICS⟩ /);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: completeness test FAILS (15 ≠ 16); new describe FAILS (entry undefined).

- [ ] **Step 3: Implement.** Update the file header comment: `Fifteen disciplines — five humanities, six soft sciences, four ⇄ overlap pairs` → `Sixteen disciplines — five humanities, six soft sciences, five ⇄ overlap pairs (the registry completes to the council's sixteen)`. Append the entry after `linguistics_hermetics` (inside the array):

```js
  {
    id: 'sociology_economics',
    tier: 'OVERLAP_MATRIX',
    tag: 'SOCIOLOGY ⇄ ECONOMICS',
    // THE LINKER (spec 2026-07-17): the discipline that reads normative tracks
    // and prices them. TARGET 0 = nt_success, the default build fixed at
    // eighteen; the corpus is the library of documented divergences.
    owns: ['linker'],
    band: (ctx) => {
      const c = ctx?.periphery?.corpus;
      return !c ? 'unopened' : (c.linked?.length ? 'linked' : 'consulted');
    },
    detail: (ctx) => {
      const c = ctx?.periphery?.corpus;
      return c ? `${c.linked?.length ?? 0} linked · ${c.consulted?.length ?? 0} consulted · of ${c.total}` : null;
    },
    pools: {
      unopened: {
        FIRE:  ['the archive unentered · the default track holds its heat unchallenged',
                'no divergence consulted · TARGET 0 warms itself on silence'],
        WATER: ['the corpus unopened · the mainstream runs without a fork in sight',
                'no divergence tasted · the default current carries what floats'],
        AIR:   ['the shelf unread · the norm circulates at face value',
                'no divergence surveyed · TARGET 0 clears without an audit'],
        EARTH: ['the strata unopened · the paved track shows no survey marks',
                'no divergence dug · the default settles into bedrock'],
      },
      consulted: {
        FIRE:  ['divergences read by firelight · none yet taken to the forge',
                'the archive entered warm · documentation touched, engines cold'],
        WATER: ['divergences sampled · the fork tasted but not swum',
                'documentation dissolved on the tongue · no current changed'],
        AIR:   ['the divergence catalog surveyed · linkage still hypothetical',
                'norms priced against alternatives · no contract signed'],
        EARTH: ['the strata cored and read · no foundation moved',
                'divergence documents unearthed · the track still paved beneath'],
      },
      linked: {
        FIRE:  ['divergence linked at heat · the default target loses a customer',
                'engines fired against TARGET 0 · the fork carries flame now'],
        WATER: ['the fork entered and swum · the mainstream loses a tributary',
                'divergence bound in solution · the default current runs thinner'],
        AIR:   ['linkage on record · the norm audited and declined',
                'extern crates in open air · the default target priced and passed over'],
        EARTH: ['divergence load-bearing now · the paved track cracks at the join',
                'foundations moved to forked ground · TARGET 0 keeps only its pavement'],
      },
    },
  },
```

- [ ] **Step 4: Run to verify pass** (pool-completeness loops in the existing suite cover the four tints × ≥2 fragments automatically)

Run: `npx vitest run src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/taxonomyRegistry.js src/terminal/quintessence/__tests__/taxonomyRegistry.test.js
git commit -m "feat(quintessence): sixteenth discipline — SOCIOLOGY ⇄ ECONOMICS owns the linker lens"
```

---

### Task 5: Compiler — THE LINKER block

**Files:**
- Modify: `src/terminal/quintessence/compileKernel.js`
- Test: `src/terminal/quintessence/__tests__/compileKernel.test.js`

**Interfaces:**
- Consumes: `periphery.corpus` (Task 3 shape, may be `undefined` on old fixtures — treat as `null`); `doctrineFor(id)` from `../data/kernelDoctrines`; `kernelBuilds`; `lensFor('linker', ctx, rng)` (Task 4).
- Produces: THE LINKER section in `source`, rendered between the WITNESS const and the panic handler; `const TARGET_LINKED: Option<&'static str> = None;` present in every artifact.

- [ ] **Step 1: Write the failing tests** — append to `compileKernel.test.js`:

```js
describe('THE LINKER (spec 2026-07-17)', () => {
  const CORPUS_PERIPHERY = { ...FULL_PERIPHERY, corpus: {
    linked: ['BOSONIC-KERNEL-3.0.0', 'SURVEILLANCE-TRACKER'],
    consulted: ['SOMA-KERNEL-5.5.0'],
    total: 43,
  } };

  it('renders linked crates with doctrine comments and the corpus header', async () => {
    const { source } = await compileKernel(FULL_SPINE, CORPUS_PERIPHERY, ENGINE, OPTS);
    expect(source).toContain('**THE LINKER**');
    expect(source).toContain('TARGET 0: nt_success · fixed at eighteen · ships without documentation.');
    expect(source).toContain('corpus: 43 documented divergences from TARGET 0 · linked 2 · consulted 1');
    expect(source).toContain('extern crate bosonic_kernel_3_0_0;');
    expect(source).toContain('trust is a condensate');
    expect(source).toContain('extern crate surveillance_tracker;');
    expect(source).toContain('// consulted, never linked: SOMA-KERNEL-5.5.0');
    expect(source).toContain('⟨SOCIOLOGY ⇄ ECONOMICS⟩');
  });

  it('TARGET_LINKED is None in every variant', async () => {
    const withCorpus = await compileKernel(FULL_SPINE, CORPUS_PERIPHERY, ENGINE, OPTS);
    const without    = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    for (const { source } of [withCorpus, without])
      expect(source).toContain("const TARGET_LINKED: Option<&'static str> = None; // nt_success — NEVER LINKED HERE");
  });

  it('no corpus → the archive-unentered render', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source).toContain('THE ARCHIVE UNENTERED');
    expect(source).toContain('and this artifact is already not it');
    expect(source).not.toContain('extern crate');
  });

  it('annotates DEPRECATED and lore builds', async () => {
    const p = { ...FULL_PERIPHERY, corpus: {
      linked: ['SOMA-4.4-GENESIS-DEC2025', 'ROSSIGNOL-ANDALIB-5.5.5.5'],
      consulted: [], total: 43 } };
    const { source } = await compileKernel(FULL_SPINE, p, ENGINE, OPTS);
    expect(source).toContain('DEPRECATED — a divergence later abandoned');
    expect(source).toContain('genome chapter — ancestry, not divergence');
  });

  it('caps extern lines at 7 with an overflow comment', async () => {
    const nine = ['ATMOSPHERIC-SIM-KERNEL-3.0.0', 'BIODIVERSITY-PROMPT-1.0.1',
      'BOSONIC-KERNEL-3.0.0', 'CEEI-SIM-KERNEL-1.0.0', 'CHRONOS-KERNEL-2.1.0',
      'COMPANION-KERNEL-2.0.0', 'DALY-SIM-KERNEL-1.0.0',
      'DISSIPATIVE-SOVEREIGNTY-KERNEL-5.0.0', 'EMPATHY-KERNEL-2.0.0'];
    const p = { ...FULL_PERIPHERY, corpus: { linked: nine, consulted: [], total: 43 } };
    const { source } = await compileKernel(FULL_SPINE, p, ENGINE, OPTS);
    expect((source.match(/extern crate /g) || []).length).toBe(7);
    expect(source).toContain('// +2 more linked');
  });

  it('unmatched ids fall back to the undoctrined gloss', async () => {
    const p = { ...FULL_PERIPHERY, corpus: { linked: ['SCALE94-ENCYCLOPEDIA'], consulted: [], total: 43 } };
    const { source } = await compileKernel(FULL_SPINE, p, ENGINE, OPTS);
    expect(source).toContain('undoctrined · the divergence is its own gloss');
  });

  it('deterministic with corpus present', async () => {
    const a = await compileKernel(FULL_SPINE, CORPUS_PERIPHERY, ENGINE, OPTS);
    const b = await compileKernel(FULL_SPINE, CORPUS_PERIPHERY, ENGINE, OPTS);
    expect(a.source).toBe(b.source);
    expect(a.hash).toBe(b.hash);
  });
});
```

Note: `SCALE94-ENCYCLOPEDIA` matches no `kernelDoctrines` pattern (verified: `ID_PATTERNS` has no ENCYCLOPEDIA entry — that pattern lives only in `mobileWasmMap`). If the fallback test fails because a pattern DOES match, pick another unmatched id (e.g. `HIGH-TOWER-LOG` matches nothing in `ID_PATTERNS` either) — do not add doctrine entries.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/terminal/quintessence/__tests__/compileKernel.test.js`
Expected: new describe FAILS (no LINKER in source); pre-existing tests PASS.

- [ ] **Step 3: Implement.** In `compileKernel.js` add imports:

```js
import { doctrineFor } from '../data/kernelDoctrines';
import kernelBuilds from '../data/kernelBuilds';
```

Add after `houseLine` (before the main function):

```js
// ── THE LINKER (spec 2026-07-17) ─────────────────────────────────────────────
// TARGET 0: nt_success — the default build, fixed at eighteen, never linked.
// The corpus is the library of documented divergences; the artifact links only
// what the visitor touched. Seeded cap keeps the vial pocket-sized: picks are
// drawn by rng, rendered in registry order.
const BUILD_BY_ID = new Map(kernelBuilds.map(b => [b.id, b]));
const EXTERN_CAP = 7;

function seededPick(ids, cap, rng) {
  if (ids.length <= cap) return { picks: ids, overflow: 0 };
  const pool = ids.slice();
  const drawn = new Set();
  for (let i = 0; i < cap; i++) drawn.add(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return { picks: ids.filter(id => drawn.has(id)), overflow: ids.length - cap };
}

function crateFlags(build) {
  const flags = [];
  if (build.lore) flags.push('genome chapter — ancestry, not divergence');
  if (build.status === 'DEPRECATED') flags.push('DEPRECATED — a divergence later abandoned');
  return flags;
}

function linkerBlock(corpus, ctx, rng) {
  const head = `/// **THE LINKER** — every build forks from the same fork point.
/// TARGET 0: nt_success · fixed at eighteen · ships without documentation.
/// ${lensFor('linker', ctx, rng)}`;
  const tail = `const TARGET_LINKED: Option<&'static str> = None; // nt_success — NEVER LINKED HERE`;
  if (!corpus) {
    return `${head}
// THE ARCHIVE UNENTERED — ${kernelBuilds.length} divergences unread · only TARGET 0 remains —
// and this artifact is already not it
${tail}`;
  }
  const lines = [];
  const linked = seededPick(corpus.linked, EXTERN_CAP, rng);
  for (const id of linked.picks) {
    const b = BUILD_BY_ID.get(id);
    if (!b) continue;
    const doctrine = doctrineFor(b.id) ?? 'undoctrined · the divergence is its own gloss';
    lines.push(`extern crate ${b.name.toLowerCase()};  // ${[doctrine, ...crateFlags(b)].join(' · ')}`);
  }
  if (linked.overflow) lines.push(`// +${linked.overflow} more linked`);
  const consulted = seededPick(corpus.consulted, EXTERN_CAP, rng);
  for (const id of consulted.picks) {
    const b = BUILD_BY_ID.get(id);
    if (!b) continue;
    const flags = crateFlags(b);
    lines.push(`// consulted, never linked: ${b.id}${flags.length ? ' · ' + flags.join(' · ') : ''}`);
  }
  if (consulted.overflow) lines.push(`// +${consulted.overflow} more consulted`);
  return `${head}
/// corpus: ${corpus.total} documented divergences from TARGET 0 · linked ${corpus.linked.length} · consulted ${corpus.consulted.length}
${lines.join('\n')}
${tail}`;
}
```

In the `source` template, between the WITNESS const's closing `};` and the PANIC HANDLER doc-comment, insert (keeping one blank line on each side):

```js
};

${linkerBlock(periphery.corpus ?? null, ctx, rng)}

/// **PANIC HANDLER** — inherited verbatim from the genome.
```

(The `${linkerBlock(...)}` call sits inline at its document position so the rng draw order of all earlier lenses is unchanged.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/compileKernel.test.js`
Expected: PASS, all tests (pre-existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/compileKernel.js src/terminal/quintessence/__tests__/compileKernel.test.js
git commit -m "feat(quintessence): THE LINKER — corpus lineage block, nt_success as TARGET 0"
```

---

### Task 6: Full verification

**Files:** none new.

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run`
Expected: PASS across all suites. Fix any incidental exact-shape assertions the new fields broke (bus totals shape is the likely candidate; the fix is always to add the new empty accumulators to the expected object, never to weaken the assertion).

- [ ] **Step 2: Browser smoke (bounded).** Start the dev server via the browser pane (launch config in `.claude/launch.json`), open the terminal app, and verify: (a) site boots with no new console errors; (b) clicking a pinned module in the KERNEL tab logs `Initializing …` (fires `kernel_loaded`); (c) navigating to a kernel article emits no errors. Full altar compile ceremony is NOT required (art-project calibration: unit determinism + boot smoke is enough; the compile path is exhaustively unit-tested).

- [ ] **Step 3: Commit any assertion fixes**

```bash
git add -A && git commit -m "test: align shape assertions with linker accumulators"
```

(Skip if Step 1 needed no fixes.)
