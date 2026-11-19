# /SOL Delay Stack + Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every /SOL cloud shows five true-clock messengers (neutrinos, light/X-ray, protons, cloud, core photon), and each one's fusion-equivalent offerings (He delivered; C, O dated at the helium flash; Au never) reach the HUD and the compiled Vial.

**Architecture:** Everything is derived by pure functions from the facts `sol_clouds_v1` already stores (`launchedAt`, `energyErg`), with an injected `now`. One small new store, `sol_forge_v1`, keeps forge totals for clouds that `cloudStore` sweeps or drops. The HUD gains a CLOCKS / FORGE toggle. `compileKernel` gains messenger fields and a forge block.

**Tech Stack:** React 18, Vite, Vitest + Testing Library, Tailwind, plain JS modules under `src/terminal/sol/`.

**Spec:** `docs/superpowers/specs/2026-11-19-sol-delay-stack-forge-design.md` (on top of `docs/superpowers/specs/2026-11-15-sol-design.md`)

## Global Constraints

- Branch `feature/sol`. Commit after each task. **Never push.**
- Do not touch `src/terminal/mercury/elements.js`, `QuintessenceAltar.jsx`, the shader, the aurora, transit physics, coupling, or the `sol_clouds_v1` schema.
- Years beyond the present are plain Numbers computed by arithmetic: never `new Date(...)` and never epoch ms (the `Date` range ends in year 275 760; 7.59e9 yr in ms overflows u64). They compile as integer years.
- The kernel and the HUD never know more than the visitor: a messenger's reading is `null` / `None` until its arrival moment.
- Every time function takes `now` as an argument. A non-finite `now`, or one before launch, is read as the launch moment (the same rule as `cloudStatus`).
- Every storage call is wrapped in try/catch; refused storage gives a volatile store, never a throw.
- HUD voice: numbers and one-line states, no sentence of meaning. The Au row has no value, date, title or hover text.
- Constants (all in `solPhysics.js`): `NEUTRINO_DELAY_S = LIGHT_DELAY_S` (499), `PROTON_ONSET_SLOW_MS = 2 h`, `PROTON_ONSET_FAST_MS = 15 min`, `XRAY_LOG_FLUX_MIN = -6`, `XRAY_LOG_FLUX_MAX = Math.log10(4.5e-3)`, `PROTON_PFU_LOG_MIN = 0`, `PROTON_PFU_LOG_MAX = 5`, `CORE_PHOTON_YEARS = 170000` (Mitalas & Sills 1992), `HELIUM_FLASH_YEARS = 7.59e9`, `HE_BURN_END_YEARS = 7.70e9` (Schröder & Smith 2008). Mark the X-ray, proton and pfu ones `// tune`.
- Lint gate: `npm run lint` passes (0 errors, `--max-warnings 143` as in package.json). Do not raise the ratchet.

## Review Focus

1. **Two site tabs open, both sweeping the same landed cloud.** Each tab folds it into `sol_forge_v1`, so the forge would count it twice. Expected: counted once. Test in Task 4 (`foldIntoArchive` is idempotent per cloud id, via a bounded `foldedIds` list).
2. **The device clock is behind a cloud's launch** (manual clock change, a synced tab with a skewed clock). Expected: no messenger arrived, no negative ETA, no NaN. Test in Task 2.
3. **A corrupt or foreign `sol_forge_v1` payload** (strings, NaN, negative masses, wrong shape). Expected: the archive starts empty, and neither the HUD nor the kernel shows NaN. Test in Task 4.
4. **Clouds stored before this layer**, some landed days ago. Expected: their stacks read as arrived, and their helium is counted as delivered. Test in Task 3.
5. **The selected cloud is swept or dropped while selected.** Expected: the stack falls back to the newest cloud, with no crash and no empty stack. Test in Task 6 (`pickStackId`).

---

### Task 1: Messenger physics

**Files:**
- Modify: `src/terminal/sol/solPhysics.js` (constants block at top; new functions after `stormMs`)
- Test: `src/terminal/sol/__tests__/solPhysics.test.js`

**Interfaces:**
- Produces: the Global Constraints constants; `xrayFluxWm2(erg: number): number`; `goesClass(fluxWm2: number): string`; `xrayClass(erg: number): string`; `protonOnsetMs(erg: number): number`; `protonPeakPfu(erg: number): number`; `sScale(pfu: number): 'below S1'|'S1'|'S2'|'S3'|'S4'|'S5'`.

- [ ] **Step 1: Write the failing tests** (new `describe('messengers physics')`)

```js
it('X-ray flux spans C1.0 at E_MIN to X45 at E_MAX', () => {
  expect(xrayClass(1e29)).toBe('C1.0');
  expect(xrayClass(5e32)).toBe('X45');
  expect(xrayClass(3.1e32)).toBe('X28');
  expect(xrayFluxWm2(1e29)).toBeCloseTo(1e-6, 12);
});
it('goesClass picks the letter after rounding, so nothing reads C10.0', () => {
  expect(goesClass(3.2e-5)).toBe('M3.2');
  expect(goesClass(9.96e-6)).toBe('M1.0');
  expect(goesClass(1.2e-3)).toBe('X12');   // X10 and above: integer
  expect(goesClass(4.0e-4)).toBe('X4.0');
  expect(goesClass(2e-7)).toBe('B2.0');
});
it('proton onset runs 2 h (weak) to 15 min (strong), log-interpolated', () => {
  expect(protonOnsetMs(1e29)).toBeCloseTo(2 * 3600e3, 3);
  expect(protonOnsetMs(5e32)).toBeCloseTo(15 * 60e3, 3);
  const mid = protonOnsetMs(10 ** ((29 + Math.log10(5e32)) / 2));
  expect(mid).toBeCloseTo(Math.sqrt(2 * 3600e3 * 15 * 60e3), 0);
});
it('S-scale from peak pfu', () => {
  expect(protonPeakPfu(1e29)).toBeCloseTo(1, 9);
  expect(protonPeakPfu(5e32)).toBeCloseTo(1e5, 3);
  expect(sScale(9.99)).toBe('below S1');
  expect(sScale(10)).toBe('S1');
  expect(sScale(1e3)).toBe('S3');
  expect(sScale(1e5)).toBe('S5');
});
it('bad energy reads as the weakest, never NaN', () => {
  expect(xrayClass(NaN)).toBe('C1.0');
  expect(Number.isFinite(protonOnsetMs(-1))).toBe(true);
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/terminal/sol/__tests__/solPhysics.test.js`
Expected: FAIL, `xrayClass is not a function` (or similar).

- [ ] **Step 3: Implement the constants and functions in `solPhysics.js`**

All are driven by the existing `strength01(erg)`. Flux is `10 ** lerp(XRAY_LOG_FLUX_MIN, XRAY_LOG_FLUX_MAX, s)`; onset and pfu are log-lerped the same way. `goesClass`: letters A 1e-8, B 1e-7, C 1e-6, M 1e-5, X 1e-4. Round the flux to 0.1 of its class unit first, then pick the letter from the rounded value. Format one decimal below 10, an integer at 10 or above (X only). `sScale` thresholds are 10, 1e2, 1e3, 1e4, 1e5 pfu.

- [ ] **Step 4: Run, expect PASS** (same command; the whole file, so the old tests still pass)

- [ ] **Step 5: Commit**

```bash
git add src/terminal/sol/solPhysics.js src/terminal/sol/__tests__/solPhysics.test.js
git commit -m "feat(sol): messenger physics — X-ray class, proton onset, S-scale, deep-time constants"
```

---

### Task 2: The Delay Stack

**Files:**
- Create: `src/terminal/sol/delayStack.js`
- Test: `src/terminal/sol/__tests__/delayStack.test.js`

**Interfaces:**
- Consumes: Task 1; `cloudStatus(cloud, now)` from `cloudClock.js`; `LIGHT_DELAY_S`.
- Produces:
  - `yearOf(ms: number): number`: UTC calendar year of an in-range epoch ms.
  - `messengers(cloud, now): Messenger[]`, always 5, in order `neutrinos, light, protons, cloud, core`.
  - `Messenger = { key, arrivesAt: number|null /* ms */, arrivesYear: number|null, arrived: boolean, etaMs: number|null, reading: object|null }`
  - Readings: neutrinos `{ detected: false }`; light `{ ageS: 499, xray: 'X28' }`; protons `{ pfu: number, s: 'S5' }`; cloud `{ phase, orientation, fate, nT }`, present from launch, with orientation, fate and nT already null-guarded by `cloudStatus` (`nT` is `stormNt` only when it isn't null and `fate !== 'passed'`); core `null` always.
  - `protonsArriveAt(cloud): number` = `launchedAt + LIGHT_DELAY_S*1000 + protonOnsetMs(energyErg)`, reused by Task 3.

- [ ] **Step 1: Write the failing tests**

```js
const t0 = Date.UTC(2026, 10, 19, 12, 0, 0);
const cloud = { id: 'a', launchedAt: t0, energyErg: 5e32, transitMs: 17.6 * 3600e3, handedness: 'cw', origin: 'hand', witnessed: false };

it('five messengers in order', () => {
  expect(messengers(cloud, t0).map((m) => m.key)).toEqual(['neutrinos', 'light', 'protons', 'cloud', 'core']);
});
it('neutrinos and light arrive together at +499 s; reading null before', () => {
  const before = messengers(cloud, t0 + 498e3);
  expect(before[0]).toMatchObject({ arrived: false, reading: null, etaMs: 1e3 });
  expect(before[1]).toMatchObject({ arrived: false, reading: null });
  const after = messengers(cloud, t0 + 499e3);
  expect(after[0]).toMatchObject({ arrived: true, reading: { detected: false }, etaMs: 0 });
  expect(after[1].reading).toEqual({ ageS: 499, xray: 'X45' });
});
it('protons arrive at +499 s + onset with an S reading', () => {
  const at = protonsArriveAt(cloud);
  expect(at).toBeCloseTo(t0 + 499e3 + 15 * 60e3, 0);
  expect(messengers(cloud, at - 1)[2].reading).toBeNull();
  expect(messengers(cloud, at)[2].reading.s).toBe('S5');
});
it('the cloud entry mirrors cloudStatus', () => {
  const m = messengers(cloud, t0 + 18 * 3600e3)[3];
  expect(m.arrived).toBe(true);
  expect(m.reading.orientation).toBe('southward');
});
it('the core photon surfaces 170 000 years after the launch year, never arrives', () => {
  const core = messengers(cloud, t0 + 1e12)[4];
  expect(core).toEqual({ key: 'core', arrivesAt: null, arrivesYear: 172026, arrived: false, etaMs: null, reading: null });
});
it('a clock behind the launch reads as the launch moment (Review Focus 2)', () => {
  for (const now of [t0 - 3600e3, NaN, -Infinity]) {
    const ms = messengers(cloud, now);
    expect(ms.some((m) => m.arrived)).toBe(false);
    for (const m of ms) if (m.etaMs != null) { expect(m.etaMs).toBeGreaterThan(0); expect(Number.isFinite(m.etaMs)).toBe(true); }
  }
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/terminal/sol/__tests__/delayStack.test.js`
Expected: FAIL, cannot resolve `../delayStack`.

- [ ] **Step 3: Implement `delayStack.js`**: pure, no React, no storage. `yearOf` uses `new Date(ms).getUTCFullYear()`, which is safe because launch ms is in range. The core year is `yearOf(launchedAt) + CORE_PHOTON_YEARS`.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/terminal/sol/delayStack.js src/terminal/sol/__tests__/delayStack.test.js
git commit -m "feat(sol): the Delay Stack — five messengers on the true clock"
```

---

### Task 3: The Forge table and ledger

**Files:**
- Create: `src/terminal/sol/forge.js`
- Test: `src/terminal/sol/__tests__/forge.test.js`

**Interfaces:**
- Consumes: `protonsArriveAt`, `yearOf` (Task 2); `HELIUM_FLASH_YEARS`, `HE_BURN_END_YEARS` (Task 1).
- Produces:
  - `FORGE_TABLE`: `[{ symbol:'H', z:1, role:'spent' }, { symbol:'He', z:2, role:'delivered' }, { symbol:'C', z:6, role:'dated' }, { symbol:'O', z:8, role:'dated' }, { symbol:'Au', z:79, role:null }]`, frozen.
  - `J_PER_KG = { He, C, O }`, derived in code from atomic masses H 1.007825, ⁴He 4.002603, ¹²C 12, ¹⁶O 15.994915 u (Δm/m × c², c = 299792458): He 6.444e14, C 5.849e13, O 4.320e13. `H_PER_HE = 4*1.007825/4.002603` (≈1.00717).
  - `offerings(cloud): { H:{kg,deliveredAt}, He:{kg,deliveredAt}, C:{kg,year}, O:{kg,year} }`, with energy J = erg × 1e-7, `deliveredAt = protonsArriveAt(cloud)`, `year = yearOf(launchedAt) + HELIUM_FLASH_YEARS` (C) or `+ HE_BURN_END_YEARS` (O).
  - `EMPTY_ARCHIVE = { H:0, He:0, C:0, O:0, cYear:null, oYear:null, foldedIds:[] }`.
  - `forgeLedger(clouds, archive, now): Ledger`, where `Ledger = { H, He, heOwed, C, O, cYear, oYear, any }` in kg. `He`/`H` sum the archive plus clouds with `now >= deliveredAt`. `heOwed` sums clouds still before `deliveredAt`. `C`/`O` sum the archive plus all clouds. Years are the max over the archive and clouds (null when none). `any` = at least one cloud or a non-zero archive.

- [ ] **Step 1: Write the failing tests**

```js
const rel = (a, b) => Math.abs(a - b) / b;
const t0 = Date.UTC(2026, 10, 19, 12);
const mk = (erg, launchedAt = t0, id = 'x') => ({ id, launchedAt, energyErg: erg, transitMs: 20 * 3600e3, handedness: 'cw', origin: 'hand', witnessed: false });

it('J per kg from mass defects', () => {
  expect(rel(J_PER_KG.He, 6.444e14)).toBeLessThan(1e-3);
  expect(rel(J_PER_KG.C, 5.849e13)).toBeLessThan(1e-3);
  expect(rel(J_PER_KG.O, 4.320e13)).toBeLessThan(1e-3);
});
it('offerings at E_MAX and E_MIN match spec §3.3', () => {
  const o = offerings(mk(5e32));
  expect(rel(o.He.kg, 7.76e10)).toBeLessThan(2e-3);
  expect(rel(o.H.kg, 7.815e10)).toBeLessThan(2e-3);
  expect(rel(o.C.kg, 8.55e11)).toBeLessThan(2e-3);
  expect(rel(o.O.kg, 1.157e12)).toBeLessThan(2e-3);
  const w = offerings(mk(1e29));
  expect(rel(w.He.kg, 1.552e7)).toBeLessThan(2e-3);
  expect(rel(w.C.kg, 1.71e8)).toBeLessThan(3e-3);
  expect(rel(w.O.kg, 2.315e8)).toBeLessThan(3e-3);
});
it('dated years are arithmetic, past the Date range', () => {
  const o = offerings(mk(5e32));
  expect(o.C.year).toBe(7590002026);
  expect(o.O.year).toBe(7700002026);
});
it('gold is a row with no role', () => {
  expect(FORGE_TABLE.at(-1)).toEqual({ symbol: 'Au', z: 79, role: null });
});
it('helium is owed until the protons arrive, then delivered; C/O count from the snap', () => {
  const c = mk(5e32);
  const before = forgeLedger([c], EMPTY_ARCHIVE, t0 + 1);
  expect(before.He).toBe(0);
  expect(before.heOwed).toBeGreaterThan(0);
  expect(before.C).toBeGreaterThan(0);
  const after = forgeLedger([c], EMPTY_ARCHIVE, t0 + 3 * 3600e3);
  expect(after.He).toBeCloseTo(offerings(c).He.kg, -3);
  expect(after.heOwed).toBe(0);
});
it('old clouds stored before this layer count as delivered (Review Focus 4)', () => {
  const old = mk(1e31, t0 - 30 * 24 * 3600e3, 'old');
  expect(forgeLedger([old], EMPTY_ARCHIVE, t0).He).toBeGreaterThan(0);
});
it('archive totals add in; empty input gives any=false and null years', () => {
  expect(forgeLedger([], EMPTY_ARCHIVE, t0)).toMatchObject({ He: 0, C: 0, any: false, cYear: null });
  const a = { ...EMPTY_ARCHIVE, He: 5, H: 5, C: 7, O: 9, cYear: 7590002025, oYear: 7700002025 };
  expect(forgeLedger([], a, t0)).toMatchObject({ He: 5, C: 7, any: true, cYear: 7590002025 });
});
```

- [ ] **Step 2: Run, expect FAIL** (`npx vitest run src/terminal/sol/__tests__/forge.test.js`, module not found)

- [ ] **Step 3: Implement `forge.js`** to the Interfaces block. Pure; no storage.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/terminal/sol/forge.js src/terminal/sol/__tests__/forge.test.js
git commit -m "feat(sol): the forge — fusion-equivalent offerings, gold never"
```

---

### Task 4: The forge archive, folded on sweep and cap

**Files:**
- Create: `src/terminal/sol/forgeArchive.js`
- Modify: `src/terminal/sol/cloudStore.js` (`launchCloud` cap branch, `sweep`, `snapshotSol` untouched here)
- Test: `src/terminal/sol/__tests__/forgeArchive.test.js`, `src/terminal/sol/__tests__/cloudStore.test.js`

**Interfaces:**
- Consumes: `offerings`, `EMPTY_ARCHIVE` (Task 3).
- Produces:
  - `FORGE_STORAGE_KEY = 'sol_forge_v1'`, `MAX_FOLDED_IDS = 64`.
  - `getForgeArchive(): Archive` (a copy).
  - `foldIntoArchive(cloud, now): void`. Adds C, O and the years always. Adds He and H only when `now >= offerings(cloud).He.deliveredAt`. A no-op when `cloud.id` is already in `foldedIds`; `foldedIds` keeps the newest 64.
  - `subscribeForgeArchive(fn): () => void`; `_resetForgeArchiveForTests(opts?: { keepStorage?: boolean })`.
  - The same `storage`-event reload as `cloudStore` (key `sol_forge_v1` or `null`).
  - `cloudStore`: every cloud removed by `sweep` or by the in-flight cap is passed to `foldIntoArchive(cloud, now)` **before** the `commit` that removes it.

- [ ] **Step 1: Write the failing tests**

`forgeArchive.test.js`:

```js
it('fold adds C/O always and He/H only after the protons', () => {
  foldIntoArchive(mk(5e32), t0 + 1);
  const a = getForgeArchive();
  expect(a.He).toBe(0); expect(a.C).toBeGreaterThan(0); expect(a.cYear).toBe(7590002026);
});
it('the same cloud folds once, across tabs (Review Focus 1)', () => {
  const c = mk(5e32);
  foldIntoArchive(c, t0 + 3 * 3600e3);
  _resetForgeArchiveForTests({ keepStorage: true });   // the other tab reloads from storage
  foldIntoArchive(c, t0 + 3 * 3600e3);
  expect(getForgeArchive().He).toBeCloseTo(offerings(c).He.kg, -3);
});
it('foldedIds keep the newest 64', () => {
  for (let i = 0; i < 70; i++) foldIntoArchive(mk(1e30, t0, `c${i}`), t0);
  expect(getForgeArchive().foldedIds).toHaveLength(64);
  expect(getForgeArchive().foldedIds.at(-1)).toBe('c69');
});
it('a corrupt payload restores as empty, never NaN (Review Focus 3)', () => {
  for (const raw of ['{', '"x"', JSON.stringify({ He: 'a', C: NaN, O: -5, foldedIds: 3 }), JSON.stringify(null)]) {
    localStorage.setItem(FORGE_STORAGE_KEY, raw);
    _resetForgeArchiveForTests({ keepStorage: true });
    expect(getForgeArchive()).toEqual(EMPTY_ARCHIVE);
  }
});
it('refused storage keeps a volatile archive', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  foldIntoArchive(mk(5e32), t0);
  expect(getForgeArchive().C).toBeGreaterThan(0);
});
```

(The restore rule is all-or-nothing: if any field is invalid, the archive restores as empty. Masses must be finite and ≥ 0; years finite or null; `foldedIds` an array of strings.)

Add to `cloudStore.test.js`:

```js
it('sweep folds each removed landed cloud into the forge archive', () => {
  for (let i = 0; i < 40; i++) launchCloud(cw(), t0 + i * 40 * H);
  sweep(t0 + 2000 * H);
  expect(getForgeArchive().foldedIds).toHaveLength(8);
  expect(getForgeArchive().He).toBeGreaterThan(0);
});
it('a cap-dropped cloud folds C/O, and He only if its protons had arrived', () => {
  for (let i = 0; i < 16; i++) launchCloud(cw(1e31 + i * 1e30), t0);
  launchCloud(cw(5e32), t0 + 20);           // drops the 1e31 cloud seconds after launch
  const a = getForgeArchive();
  expect(a.C).toBeGreaterThan(0);
  expect(a.He).toBe(0);
});
```

(Reset both stores in `beforeEach`.)

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/terminal/sol/__tests__/forgeArchive.test.js src/terminal/sol/__tests__/cloudStore.test.js`

- [ ] **Step 3: Implement `forgeArchive.js`** in `cloudStore`'s discipline (listeners in a Set, isolated per listener, persist the whole object). **Wire the fold calls into `cloudStore.js`.**

- [ ] **Step 4: Run, expect PASS**, then run the whole sol suite: `npx vitest run src/terminal/sol`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/sol/forgeArchive.js src/terminal/sol/cloudStore.js src/terminal/sol/__tests__/forgeArchive.test.js src/terminal/sol/__tests__/cloudStore.test.js
git commit -m "feat(sol): forge archive — swept and dropped clouds keep their offerings"
```

---

### Task 5: The Vial: snapshot and compiled kernel

**Files:**
- Modify: `src/terminal/sol/cloudStore.js` (`snapshotSol`)
- Modify: `src/terminal/quintessence/compileKernel.js:55-97` (`solDescribe`, `solTelemetryBlock`)
- Test: `src/terminal/sol/__tests__/cloudStore.test.js`, `src/terminal/quintessence/__tests__/compileKernel.test.js`

**Interfaces:**
- Consumes: `messengers` (Task 2), `forgeLedger` (Task 3), `getForgeArchive` (Task 4), `yearOf`, `CORE_PHOTON_YEARS`, `HELIUM_FLASH_YEARS`.
- Produces: `snapshotSol(now)` entries (both `inFlight` and `landings`) gain `neutrinos: 'undetected'|null`, `xray: string|null`, `protons: string|null` (the S reading). The snapshot gains `forge: Ledger`. Kernel strings as below.

- [ ] **Step 1: Write the failing tests**

`cloudStore.test.js`:

```js
it('snapshot carries messenger readings only after arrival, and the forge', () => {
  launchCloud(cw(5e32), t0);
  const early = snapshotSol(t0 + 1);
  expect(early.inFlight[0]).toMatchObject({ neutrinos: null, xray: null, protons: null });
  expect(early.forge.He).toBe(0);
  const later = snapshotSol(t0 + 3 * H);
  expect(later.inFlight[0]).toMatchObject({ neutrinos: 'undetected', xray: 'X45', protons: 'S5' });
  expect(later.forge.He).toBeGreaterThan(0);
});
```

`compileKernel.test.js`, in the existing `house_sol and sol_telemetry` describe:
- **Update deliberately:** the pinned `SolCloud { … nt: None },` strings. New fields go after `nt`, in this order: `neutrinos: None, xray: None, protons: None, core_light_year: <yearOf(L)+170000> },`. Fixtures without the fields compile them as `None`. `core_light_year` is computed in `compileKernel` from `launched`.
- Unchanged and still passing: the null-sol and visits-only strings, and `house_sol: Some("1 in flight · last release 5.0e32 erg")` for a fixture **without** `forge` (no forge suffix when `sol.forge` is absent).
- New:

```js
it('forge: He delivered, C/O dated, AU None, and the house line', async () => {
  const forge = { H: 7.82e10, He: 7.76e10, heOwed: 0, C: 8.55e11, O: 1.16e12, cYear: 7590002026, oYear: 7700002026, any: true };
  const { source } = await compileKernel(FULL_SPINE, { ...FULL_PERIPHERY, sol: { ...FLYING_UNREAD, forge } }, ENGINE, OPTS);
  expect(source).toContain('struct Offering { symbol: &\'static str, z: u8, kg: f64, delivered: bool, year: Option<i64> }');
  expect(source).toContain('    Offering { symbol: "He", z: 2, kg: 7.76e10, delivered: true, year: None },');
  expect(source).toContain('    Offering { symbol: "C", z: 6, kg: 8.55e11, delivered: false, year: Some(7590002026) },');
  expect(source).toContain('    Offering { symbol: "O", z: 8, kg: 1.16e12, delivered: false, year: Some(7700002026) },');
  expect(source).toContain('const AU: Option<Offering> = None;');
  expect(source).not.toMatch(/AU: Option<Offering> = None;\s*\/\//);   // no comment beside it
  expect(source).toContain('house_sol: Some("1 in flight · last release 5.0e32 erg · He 7.8e10 kg delivered · C, O dated 7.59 Gyr"),');
});
it('helium still owed compiles delivered: false and the house says owed', async () => {
  const forge = { H: 0, He: 0, heOwed: 7.76e10, C: 8.55e11, O: 1.16e12, cYear: 7590002026, oYear: 7700002026, any: true };
  const { source } = await compileKernel(FULL_SPINE, { ...FULL_PERIPHERY, sol: { ...FLYING_UNREAD, forge } }, ENGINE, OPTS);
  expect(source).toContain('Offering { symbol: "He", z: 2, kg: 7.76e10, delivered: false, year: None },');
  expect(source).toContain('· He owed · C, O dated 7.59 Gyr');
});
it('visits-only compiles no forge and no AU', async () => {
  const { source } = await compileKernel(FULL_SPINE, { ...FULL_PERIPHERY, sol: { visits: 3 } }, ENGINE, OPTS);
  expect(source).not.toContain('SOL_FORGE');
  expect(source).not.toContain('const AU');
});
```

Block layout: `/// FORGE — what the core paid.`, the struct, then `const SOL_FORGE: &[Offering] = &[` with rows He delivered (if `He > 0`), He owed (if `heOwed > 0`), C, O, then `];`, then the `AU` line. Masses use the existing `rustErg` (3 significant figures). The house-line mass uses 2 significant figures (`toExponential(1)`). The Gyr figure is `(HELIUM_FLASH_YEARS / 1e9).toFixed(2)`.

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/terminal/sol/__tests__/cloudStore.test.js src/terminal/quintessence/__tests__/compileKernel.test.js`

- [ ] **Step 3: Implement** `snapshotSol` (use `messengers` and the archive) and the `compileKernel` changes. `periphery.js` passes `sol` through unchanged; confirm by running its test.

- [ ] **Step 4: Run, expect PASS**: `npx vitest run src/terminal/sol src/terminal/quintessence`

- [ ] **Step 5: Commit**

```bash
git add src/terminal/sol/cloudStore.js src/terminal/quintessence/compileKernel.js src/terminal/sol/__tests__/cloudStore.test.js src/terminal/quintessence/__tests__/compileKernel.test.js
git commit -m "feat(sol): the Vial receives the messengers and the forge; AU stays None"
```

---

### Task 6: HUD, CLOCKS view

**Files:**
- Modify: `src/terminal/sol/hudFormat.js`, `src/terminal/sol/SolHud.jsx`, `src/terminal/views/SolTab.jsx` (clouds block ~182-226, HUD props ~272-278, `lightOn`/`LIGHT_LINE_MS` removal)
- Test: `src/terminal/sol/__tests__/hudFormat.test.js` (create), `src/terminal/sol/__tests__/SolHud.test.jsx`, `src/terminal/sol/__tests__/SolTab.wiring.test.jsx`, `src/terminal/sol/__tests__/SolTab.clouds.test.jsx`

**Interfaces:**
- Consumes: `messengers` (Task 2); `cloudStatus`; existing `formatEta`, `landingLine`, `formatErg`.
- Produces:
  - `hudFormat.js`: `MESSENGER_LABEL = { neutrinos:'NEUTRINOS', light:'LIGHT', protons:'PROTONS', cloud:'CLOUD', core:'CORE LIGHT' }`; `formatYear(y): string` (`'CE 172 026'`, groups joined by U+2009 thin space); `formatClock(ms): string` (local `HH:MM:SS`); `messengerValue(m: Messenger): string`; `pickStackId(clouds: {id, launchedAt}[], selectedId: string|null): string|null`.
  - `messengerValue`: unarrived with an eta → `formatEta(etaMs)`; neutrinos arrived → `'arrived · undetected'`; light arrived → `` `arrived · 8 min 19 s old · ${xray}` ``; protons arrived → `` `arrived · ${s}` ``; cloud in flight → `` `${formatEta} · ${orientation || 'unread'}` ``, cloud landed → `landingLine({ fate, nT })`; core → `` `surfaces ${formatYear(arrivesYear)}` ``.
  - `pickStackId`: returns `selectedId` if it is still among `clouds`, else the id with the greatest `launchedAt`, else `null`.
  - `SolHud` props replace `lightDelayVisible` with `stack: { launchedAt: number, rows: Messenger[] } | null`, `selectedId`, `onSelect(id)`. `clouds` stays the compact list but excludes the stacked cloud. Each compact row is a `<button>` (`data-testid="sol-cloud"`) that calls `onSelect(id)`.

- [ ] **Step 1: Write the failing tests**

`hudFormat.test.js`:

```js
it('formatYear groups with thin spaces', () => {
  expect(formatYear(172026)).toBe('CE 172 026');
  expect(formatYear(7590002026)).toBe('CE 7 590 002 026');
});
it('messengerValue per state', () => {
  expect(messengerValue({ key: 'neutrinos', arrived: true, reading: { detected: false } })).toBe('arrived · undetected');
  expect(messengerValue({ key: 'light', arrived: true, reading: { ageS: 499, xray: 'X28' } })).toBe('arrived · 8 min 19 s old · X28');
  expect(messengerValue({ key: 'protons', arrived: false, etaMs: 401e3, reading: null })).toBe('00:06:41');
  expect(messengerValue({ key: 'core', arrivesYear: 172026, arrived: false, reading: null })).toBe('surfaces CE 172 026');
});
it('pickStackId falls back to the newest when the selection is gone (Review Focus 5)', () => {
  const cs = [{ id: 'a', launchedAt: 1 }, { id: 'b', launchedAt: 3 }, { id: 'c', launchedAt: 2 }];
  expect(pickStackId(cs, 'c')).toBe('c');
  expect(pickStackId(cs, 'gone')).toBe('b');
  expect(pickStackId(cs, null)).toBe('b');
  expect(pickStackId([], 'gone')).toBeNull();
});
```

`SolHud.test.jsx`: **replace** the "light line only while visible" test with: a `stack` prop renders five rows (`data-testid="sol-stack-row"`) labelled NEUTRINOS, LIGHT, PROTONS, CLOUD, CORE LIGHT, and `formatClock(launchedAt)` appears in the header; clicking a compact `sol-cloud` row calls `onSelect` with its id; `stack: null` renders no stack rows.

`SolTab.wiring.test.jsx` / `SolTab.clouds.test.jsx`: **update** the `'LIGHT · 8 min 19 s OLD'` / `'8 min 19 s'` assertions. After an Earth-directed snap, the HUD shows `NEUTRINOS` and `LIGHT` rows with `00:08:19`. Advancing the mocked clock 499 s shows `arrived · 8 min 19 s old`. A snap that launches no cloud shows no stack. Delete the 20 s light-line timer tests.

- [ ] **Step 2: Run, expect FAIL**: `npx vitest run src/terminal/sol`

- [ ] **Step 3: Implement.** In `SolTab`, `refreshClouds` keeps each raw cloud next to its status. Add `selectedId` state. `stack = { launchedAt, rows: messengers(cloud, now) }` for `pickStackId(...)`, recomputed on the existing 1 s `CLOCK_TICK_MS` tick. Remove `lightOn`, `LIGHT_LINE_MS`, `lightTimerRef` and `LIGHT_LINE` / `lightDelayVisible`.

- [ ] **Step 4: Run, expect PASS**: `npx vitest run src/terminal/sol src/terminal/quintessence`

- [ ] **Step 5: Commit**

```bash
git add src/terminal/sol/hudFormat.js src/terminal/sol/SolHud.jsx src/terminal/views/SolTab.jsx src/terminal/sol/__tests__/
git commit -m "feat(sol): CLOCKS — the selected cloud's five messengers in the HUD"
```

---

### Task 7: HUD, FORGE view and the toggle

**Files:**
- Modify: `src/terminal/sol/SolHud.jsx`, `src/terminal/sol/hudFormat.js`, `src/terminal/views/SolTab.jsx`
- Test: `src/terminal/sol/__tests__/SolHud.test.jsx`, `src/terminal/sol/__tests__/hudFormat.test.js`

**Interfaces:**
- Consumes: `FORGE_TABLE` (Task 3), `forgeLedger` (Task 3), `getForgeArchive`, `subscribeForgeArchive` (Task 4).
- Produces:
  - `hudFormat.js`: `formatKg(kg): string` (`'7.8e10 kg'`, 2 significant figures; non-positive or non-finite → `'—'`); `forgeRows(ledger | null): { symbol, z, value: string, year: string|null, dark: boolean }[]`, 5 rows in `FORGE_TABLE` order. H shows `ledger.H`, He `ledger.He`, C/O their kg + `formatYear`. Au is `{ value: '', year: null, dark: true }`.
  - `HUD_VIEW_KEY = 'sol_hud_view_v1'`; `readHudView(): 'clocks'|'forge'` and `writeHudView(v)`, both try/catch, default `'clocks'`.
  - `SolHud` props add `view`, `onView(v)`, `forge: Ledger|null`. The toggle is two `<button aria-pressed>`s, `CLOCKS` / `FORGE`, with the active one rendered as `[ CLOCKS ]`.

- [ ] **Step 1: Write the failing tests**

```js
it('forgeRows before any snap: five rows, dashes, Au dark and empty', () => {
  const rows = forgeRows(null);
  expect(rows.map((r) => r.symbol)).toEqual(['H', 'He', 'C', 'O', 'Au']);
  expect(rows[1].value).toBe('—');
  expect(rows[4]).toEqual({ symbol: 'Au', z: 79, value: '', year: null, dark: true });
});
it('forgeRows with a ledger', () => {
  const rows = forgeRows({ H: 7.82e10, He: 7.76e10, heOwed: 0, C: 8.55e11, O: 1.16e12, cYear: 7590002026, oYear: 7700002026, any: true });
  expect(rows[1].value).toBe('7.8e10 kg');
  expect(rows[2]).toMatchObject({ value: '8.6e11 kg', year: 'CE 7 590 002 026' });
});
```

`SolHud.test.jsx`: `view="forge"` renders `sol-forge-row` ×5; the Au row has no `title` attribute and its text content is exactly `Au79` once whitespace is stripped. Clicking `FORGE` calls `onView('forge')`. `readHudView` returns `'clocks'` when `localStorage.getItem` throws.

- [ ] **Step 2: Run, expect FAIL**: `npx vitest run src/terminal/sol/__tests__/SolHud.test.jsx src/terminal/sol/__tests__/hudFormat.test.js`

- [ ] **Step 3: Implement.** Draw the Au row at about the border's luminance (`text-yellow-100/20`). `SolTab` computes `forgeLedger(getClouds(), getForgeArchive(), now)` inside `refreshClouds`, subscribes to the archive, and stores `view` from `readHudView()`. The panel must not scroll horizontally at 375 px; long years may wrap (`break-words`).

- [ ] **Step 4: Run, expect PASS**: `npx vitest run src/terminal/sol src/terminal/quintessence`, then `npm run lint`. Expected: 0 errors, within the ratchet.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/sol/ src/terminal/views/SolTab.jsx
git commit -m "feat(sol): FORGE — the ledger, the toggle, and the dark gold row"
```

---

### Task 8: Live verification and Gate 4

**Files:** none changed unless a defect is found (fix in the owning task's files, with a test).

- [ ] **Step 1: Full suite and lint.** Run `npm test` and `npm run lint`. Expected: all pass, 0 lint errors.
- [ ] **Step 2: Live render.** Start the preview (`preview_start` with the project's launch config). First confirm the server is fresh (`preview_list` and `preview_logs`, and that a module URL returns JS; stale servers on :5174 have lied before). Open /SOL. With the DEV hatch, set up four stages: `window.__sol.launchCloud({energyErg:5e32,handedness:'cw',origin:'hand'}, Date.now()-60e3)` (neutrinos/light pending), `…Date.now()-10*60e3` (light arrived, protons pending), `…Date.now()-3*3600e3` (protons arrived), and one with `transitMs:1000` 2 h back (landed). Screenshot CLOCKS for the newest cloud, select an older one, then switch to FORGE. Check the console for errors, noting that the console keeps stale HMR errors across reloads, so check the `?t=` stamp.
- [ ] **Step 3: Phone width.** `resize_window` mobile preset: no horizontal scroll, years wrap cleanly, toggle tappable. Reset to desktop.
- [ ] **Step 4: Vial.** On /MERCURY, seal a kernel at the Altar and confirm the source contains `SOL_FORGE` and `const AU: Option<Offering> = None;`.
- [ ] **Step 5: Privacy line.** Read the /SOL clause in `src/terminal/data/content.js:71` ("the solar transit clocks and cloud telemetry on /SOL") and report to the author whether it covers the forge totals and the view preference. **Do not reword it.**
- [ ] **Step 6: Gate 4 (author).** Hand over the screenshots and stop. The author judges the wording, the dark Au row, whether it reads as a dashboard, and a real phone. Nothing is pushed.
