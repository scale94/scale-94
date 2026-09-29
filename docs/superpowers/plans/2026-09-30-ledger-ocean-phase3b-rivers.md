# Ledger Ocean — Phase 3b (Rivers, Presets, Ghost, Seal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish spec phase 3: river-stage particles with a DO_MIN tick on every course, the four new presets (Yangtze, Ganges/Meghna, Citarum, Danube) with sourced river data, the live dashed `PROVISIONAL` ghost driven by the form, and the seal sequence (clock eases to near-stop, flare along the course, clock eases back). Also closes the 3a deferrals that fit: lagoon snap, the reduced-motion idle loop, the reduced-motion archive double warm-up, and ring tab stops.

**Architecture:** Pure core first (`landMask` basin sizes, `sources` river-stage fields, new `riverStage.js`), then GL: the parcels are drawn as GL points in the ocean's own context by a small `particleLayer` (its own program/VAO/buffer, built in `onInit`, released in `onDispose`), with every position and colour computed on the CPU by the exact kinetics. The ghost never joins `sources`/`sourceData`: it is written into the source texture by row bands (`texSubImage2D`, at most 11 rows per splat). Under reduced motion the harness loop is halted and `LedgerOcean` asks for frames on demand. The seal's clock ease is a wall-time smoothstep integrated exactly over each frame interval, so it is frame-rate independent.

**Tech Stack:** React 19, WebGL2 / GLSL ES 3.00, vitest 4 + jsdom 29 + @testing-library/react 16, the recording GL stub (`src/terminal/gl/__tests__/recordingGL.js`), `scripts/cdp.mjs` headless Chrome (`--enable-unsafe-swiftshader`), Vite 8 programmatic `createServer`.

**Spec:** `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md` — §3 Rivers and sources (all), §4 Seal / Form / HUD sources, §6 Testing, §7 Phases (3a/3b split). **Previous plan (style, what exists):** `docs/superpowers/plans/2026-09-29-ledger-ocean-phase3a-tab.md`. **Deferred items:** `.superpowers/sdd/progress.md` (phase 2, 3a, 3b sections) and `.superpowers/sdd/p3a-final-review.md` ("3b readiness", Minors 2–6).

## Plan decisions that refine the spec (flag to the user at hand-off)

1. **The four new presets live in a new export, `EXTRA_PRESETS`, appended to `auditPresets.js`, with `ALL_AUDIT_PRESETS = [...AUDIT_PRESETS, ...EXTRA_PRESETS]`.** Spec §6 requires `auditPresets.test.js` to pass *unchanged*, and that test pins `AUDIT_PRESETS` to exactly five keys and looks up `EXPECTED_TIERS[preset.key]` for every entry — it cannot pass with nine entries in `AUDIT_PRESETS`. §3 ("the file stays byte-identical") and §5 ("auditPresets.js gains the 4 new presets") also conflict; append-only satisfies both readings as far as possible: the existing bytes are untouched (the phase gate checks the diff has no `-` lines). Every consumer (form preset row, ambient sources, HUD names, river tests) switches to `ALL_AUDIT_PRESETS`.
2. **Ganges audit site = the Lower Meghna at Chandpur** (Padma–Meghna confluence, candidate 23.23°N 90.65°E), course to the Meghna estuary mouth, with the combined G–B–M Q (user decision). Chandpur is on the channel that carries the combined flow, so site, course and Q describe the same water. The old Sundarbans site is dropped (its distributaries do not carry that Q). The preset keeps key `ganges` / label `GANGES`; its `siteName` says what the site is.
3. **Yangtze audit site candidate moves to Wusongkou** (Huangpu–Yangtze confluence, ~31.39°N 121.50°E). The spec's 31.23°N 121.47°E is central Shanghai, on the Huangpu, not the Yangtze. Task 3's research confirms or corrects this and records the source.
4. **Danube river kilometres come from a sourced `riverKm` field** (candidate 2135 at Linz, chained from Sulina = km 0). When a `RIVERS` entry has `riverKm`, `buildSource` uses it as the channel length for travel time and `rkm`; the waypoint polyline (≈ 1,660 km, city to city) is drawing geometry only, and the tick is placed at the same *fraction* of it. Only the Danube sets `riverKm`; the other eight keep polyline lengths (unchanged behaviour).
5. **Danube tone = `safe`** (the spec says "safe/stress"): every parameter safe, nitrate 19 mg/L just under the 20 mg/L stress line — the repaid debt that is not gone. Worked example with the candidate data: travel 23.1 d, 2.5 % of BOD and 68 % of nitrate reach Sulina, `DO_MIN 9.9 mg/L @ rkm 1776` (spec: ~25 d, ~2 %, ~66 %).
6. **Lagoon rule = `MIN_SNAP_BASIN_CELLS = 40`, applied to every source.** Measured on the real 512×256 grid (37 basins): world ocean 77,939 cells, Mediterranean 511 (Gibraltar is sub-grid), Black Sea 98, Caspian 91, Red Sea 81 (Bab-el-Mandeb is sub-grid); then White Sea 20, an Arctic-Canada basin 18, and 30 basins of 1–6 cells (82 ocean cells in basins < 40). 40 sits between 20 and 81. All nine preset mouths snap into basins ≥ 81, so preset snaps are provably unchanged (tested). Consequence to flag: a White Sea site (Arkhangelsk) now drains to the open ocean 3 cells (235 km) away.
7. **Particles: GL points in the ocean's context, positions/colours on the CPU.** ~9 × 256 = 2,304 parcels (+256 per verdict): the CPU cost is a few thousand `exp` calls per simulated step, so no GPU sim is needed; drawing them in the same GL context keeps one canvas, the ocean's lifecycle (resize in place, context loss, hidden pane) and the tested composite order. A second 2D canvas would need its own DPR sizing, its own resize path and cannot be tested in jsdom (no 2D context). The harness files stay frozen; the layer is a new file built with the exported `buildProgram`.
8. **Parcels advance on the stepped simulated clock** (`driver.simDays()`, 0.25 d steps), exactly the ocean's time. At 9 d/s short rivers (Mississippi 1.6 d, Rhine 3.3 d of travel) cycle in well under a second; the Danube takes ~2.6 s. That is the physics on the compressed clock; the visual review decides whether it reads.
9. **Reduced motion: the harness loop is halted (`haltOnReducedMotion: true`) and `LedgerOcean` requests frames on demand** (warm-up chain, resize, new source, ghost, probe, archive ready). This fixes the 3a "idle rAF loop at 360 Hz" deferral without touching `frameLoop`/`useShaderCanvas`.
10. **Reduced-motion archive warm-up:** `LedgerOcean` gains `sourcesReady` (default `true`); `LedgerTab` passes `false` until `getAllVerdicts()` has settled. The warm-up waits for it, so a first visit with an archive reads `T+ 200.00 d`, not up to 400.
11. **Seal timings (spec says "~0.6 s", nothing else):** smoothstep ease over `SEAL_EASE_MS = 600` to `HOLD_FACTOR = 0.02` of the chosen compression (9 d/s → 0.18 d/s); flare lasts `SEAL_FLARE_MS = 1200` ms of wall time; the clock eases back when the flare reports done. Under reduced motion, or without a drawable river stage, the seal completes at once with no flare.
12. **Ghost colour `#cbd5e1`, dash `4 3`, label `PROVISIONAL`**; parcels at half alpha. The ghost is shown only while the Submit view is open and until the seal (the sealed verdict replaces it in the same render).
13. **Kernel `flow` of the new presets is the narrative kernel input (range 0–100), not the river discharge** — e.g. Yangtze kernel flow 15 (critical) beside `RIVERS.yangtze.dischargeM3s` ≈ 30,000. Same convention as the first five (Mississippi kernel flow 30 vs Q 16,570).

## Global Constraints

- Branch `feature/ledger-advection`, base commit `1308af70`. Never push. Never run `vitest -u`.
- Commits end with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The working tree has unrelated dirty and untracked files (`.import-cache.json`, `baseline/…`, a council spec and snapshot): **stage only the paths named in the task** (`git add <path>…`, never `git add -A` / `git add .`).
- **Mutation rule:** every new test (and each gate script) must be shown to FAIL against a deliberate break of the implementation, then the break is reverted exactly (`git diff` shows only the intended change). Each task lists its mutations. Record every mutation that did NOT fail in the task report. This repo shipped vacuous GL tests three times.
- **Never loosen** an assertion, tolerance or threshold to get green. Measure, report BLOCKED, let the controller decide.
- **Never claim a visual result without a screenshot** you have opened (Read tool on the PNG). SwiftShader `mountTaskMs` and frame gaps are weak evidence (CPU rasteriser); never cite them as real-GPU performance.
- Known unrelated failure: `src/terminal/art/__tests__/artComposite.test.js` (coarse-pointer DPR case). Ignore it in full-suite runs; any other failure blocks.
- Commands (Git Bash): single file `npx vitest run <path>`; suite `npm test`; lint `npm run lint` must report **0 errors and ≤ 137 warnings**. The `package.json` cap is `--max-warnings 143`, but the count at `1308af70` is 137 and must not grow: fix any new warning in new code, never raise the ratchet.
- **Frozen (no diff at all vs `1308af70`):** `src/terminal/gl/glHost.js`, `src/terminal/gl/frameLoop.js`, `src/terminal/gl/useShaderCanvas.js`, `src/terminal/gl/__tests__/__snapshots__/`, `src/terminal/ledger/ocean/gpu/shaders.js`, `src/terminal/ledger/ocean/referenceStep.js`, `src/terminal/ledger/__tests__/auditPresets.test.js`, `src/terminal/ledger/verdictModel.js`, `src/terminal/ledger/verdictStore.js`, `src/terminal/ledger/ledgerBus.js`, `src/terminal/views/ledger/AuditCascade.jsx`, `src/terminal/views/ledger/CoordinatePicker.jsx`.
- **Append-only (the diff has no removed lines):** `src/terminal/ledger/auditPresets.js` (the five existing presets stay byte-identical), `src/terminal/gl/pingPong.js` (`uploadFloatRows`), `src/terminal/gl/__tests__/recordingGL.js` (a `DYNAMIC_DRAW` constant line and a `'texSubImage2D',` method line; neither changes any existing call log). `oceanGpu.js`: only its `pingPong` import line and a new `setSourceRows` method change; `step()` is byte-identical.
- `ledgerBus` `VERDICT_ISSUED` and the observatory `emit('transmissions', 'verdict_issued', …)` keep their exact payloads.
- The sim never writes to the ledger: nothing under `src/terminal/ledger/ocean/` or `src/terminal/views/ledger/ocean/` imports `verdictStore` or `ledgerBus`.
- **The ghost never goes through `verdicts` → `sources` → `sourceData`** (that path re-uploads the full 512×256×4 float source texture and resets a reduced-motion warm-up). Tests prove ghost edits make zero full-size `texImage2D` calls and leave the warm-up clock alone.
- Nothing is frame-counted: simulated time only from the step clock (wall ms × days/s × the ease's exact mean factor); the flare and the ease run on the frame's `now` (wall ms); the reduced-motion warm-up is a fixed 800 steps.
- Exact values:
  - Grid 512×256, Δt = 0.25 d (`DT_DAYS`), hero 2:1, compact HUD below 640 px hero width (`COMPACT_BELOW_PX`; jsdom tests at width 512 are compact — use 1024 for desktop HUD assertions).
  - `MIN_SNAP_BASIN_CELLS = 40` (measured basin sizes in decision 6).
  - `PARTICLES_PER_RIVER = 256`, `FLOATS_PER_PARTICLE = 6` (clip x, clip y, r, g, b, a), `GHOST_ALPHA = 0.5`, `PARTICLE_PX = 2`, `FLARE_PX = 7` (CSS px; multiplied by canvas px / CSS px).
  - `RIVER_PALETTE = { crimson: [1, 0.09, 0.2], amber: [1, 0.62, 0], green: [0.22, 1, 0.08], ref: [2, 10, 10], deficitDim: 0.8, minAlpha: 0.25 }`.
  - Ghost: splat radius `ceil(3 × SPLAT_SIGMA_CELLS) = 5` → at most 11 rows per splat; `GHOST_COLOR = '#cbd5e1'`, `GHOST_DASH = '4 3'`, `GHOST_LABEL = 'PROVISIONAL'`.
  - Seal: `SEAL_EASE_MS = 600`, `HOLD_FACTOR = 0.02`, `SEAL_FLARE_MS = 1200`; dash-close animation `ocean-seal-dash` 400 ms.
  - DO_MIN tick: 1 px × 7 px bar (5 px compact), perpendicular to the course.
- Copy, verbatim: `PROVISIONAL`; ghost name fallback `PROVISIONAL SITE`; ring group label `Audit sites`; notes toggle label `Legend notes`; tooltip fallback `DO_MIN — mg/L @ rkm —`.
- jsdom facts the tests rely on: `window.devicePixelRatio` is 1; `document.hidden` is false; `window.matchMedia` is undefined unless stubbed; `PointerEvent` exists; vitest fake timers fake `requestAnimationFrame`; jsdom has no 2D canvas context (mock `RiverPulse` when rendering `SubmissionForm`); jsdom's CSSStyleDeclaration parses `border`, `transform` and `animation`.
- **Web research (Task 3 only):** every number that is not a planner assumption carries a cited source (title, URL, retrieval date) in its `sources` note, or its note starts with `UNVERIFIED`. Never present a planner candidate as sourced.

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/ledger/ocean/landMask.js` (modify) | `basinSize` per ocean basin; `snapToOcean(..., accept)` filter |
| `src/terminal/ledger/ocean/sources.js` (modify) | `MIN_SNAP_BASIN_CELLS`; river-stage fields on built sources (`kernel`, `velocityMs`, `depthM`, `courseKm`, `critical.courseKm`); optional `riverKm`; presets from `ALL_AUDIT_PRESETS` |
| `src/terminal/ledger/ocean/riverStage.js` (new) | parcels: course geometry, travel times, colours, buffer fill, DO_MIN tick geometry, flare vertex |
| `src/terminal/ledger/ocean/gpu/palette.js` (modify, additive) | `RIVER_PALETTE` |
| `src/terminal/ledger/ocean/gpu/particleShaders.js` (new) | point VS/FS sources (import-free, so the Node gate script can load them) |
| `src/terminal/ledger/ocean/gpu/particleLayer.js` (new) | program + VAO + buffer; `upload`, `draw`, `dispose` |
| `src/terminal/ledger/ocean/gpu/gpuData.js` (modify, additive) | `sourceRowBands`, `packSourceRows` |
| `src/terminal/ledger/ocean/gpu/oceanGpu.js` (modify, additive) | `setSourceRows(j0, rows, data)` |
| `src/terminal/gl/pingPong.js` (append) | `uploadFloatRows` |
| `src/terminal/gl/__tests__/recordingGL.js` (append lines) | `DYNAMIC_DRAW`, `texSubImage2D` |
| `src/terminal/ledger/auditPresets.js` (append) | `EXTRA_PRESETS`, `ALL_AUDIT_PRESETS` |
| `src/terminal/ledger/ocean/riverCourses.js` (modify) | 4 new sourced `RIVERS` entries |
| `src/terminal/views/ledger/ocean/clockEase.js` (new) | seal ease + timing constants |
| `src/terminal/views/ledger/ocean/hudFormat.js` (modify) | particle sizes, ghost copy/colour, `describeSites` course/tick/ghost, `keyStep`, NaN guard |
| `src/terminal/views/ledger/ocean/OceanHud.jsx` (modify) | DO_MIN ticks, ghost ring/line/label, seal dash animation, roving tabindex, notes toggle a11y |
| `src/terminal/views/ledger/ocean/LedgerOcean.jsx` (modify) | particles, on-demand reduced-motion frames, `sourcesReady`, ghost band path, seal (ease + flare), `role="img"` |
| `src/terminal/views/ledger/draft.js` (new) | `validDraft(form)`, `createFrameCoalescer` |
| `src/terminal/views/ledger/SubmissionForm.jsx` (modify) | 9-preset row; `onDraftChange` |
| `src/terminal/views/LedgerTab.jsx` (modify) | draft/ghost state, `sourcesReady`, seal wiring |
| `src/terminal/ledger/ocean/gpu/parityProbe.js` (modify) | real-case name only (`nine preset sources`) |
| `scripts/oceanShaders.mjs` (modify) | also compiles the particle program |
| `scripts/ledgerTabShots.mjs` (modify) | river zooms, ghost, seal mid-flare, desktop + phone |
| `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md` (modify) | §3 table and notes, §4 seal timings, phase-1 carry-over annotations |
| tests | see each task |

## Still deferred (not in 3b)

| Item | Reason |
|---|---|
| Hidden-tab watchdog frames (harness fires every 40 ms while rAF is suspended) | Harness behaviour in frozen `frameLoop.js`; background timers are throttled to ~1 Hz; no correctness impact. |
| Runtime reduced-motion flip | Unreachable: `useShaderCanvas` snapshots `reducedMotion` at host build (3a final review). |
| Mercury audit site ~15 km W of the real Blue Eye (lon 20.0088 vs ~20.19) | `AUDIT_PRESETS` must stay byte-identical (spec §3 / §6). Needs a user decision to unfreeze. |
| Zoom loupe for short rivers (Citarum ≈ 21 km, Mercury ≈ 10 km, Hamhung — parcels are sub-pixel) | Spec "Out of scope (phase-2 backlog)". |
| Continuous parcel motion between 0.25 d steps | Would need the clock's sub-step accumulator exposed; parcels move with the ocean's own stepped time (decision 8). |
| `aria-describedby` from ring to tooltip | Harmless per the 3a review: the ring's `aria-label` already carries every tooltip line. |
| No hysteresis on the 20 ms load cap; `frameMs === 0` sentinel; test-name wording | 3a final review: no-ops. |
| `oceanGpu` labels every construction throw `SIM SHADERS FAILED` | Still true: only program builds throw there (3b adds no throwing step to it; the particle layer has its own catch). |
| DO_SAT salinity term | Legend note shipped in 3a instead (spec phase-1 carry-over). |
| Seasonal currents, per-channel toggles, globe | Spec backlog. |

---

### Task 1: Lagoon snap — user sites skip tiny basins

`snapToOcean` takes the nearest ocean cell in any of 37 basins, so a verdict at Suez lands in a 1-cell lagoon and one at Arkhangelsk in the 20-cell White Sea. 3a made verdicts live sources, so this is now visible (3a final review Minor 6).

**Files:**
- Modify: `src/terminal/ledger/ocean/landMask.js:120-176`
- Modify: `src/terminal/ledger/ocean/sources.js:1-95`
- Modify: `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md` (phase-1 carry-over line 493)
- Test: `src/terminal/ledger/ocean/__tests__/landMask.test.js`, `src/terminal/ledger/ocean/__tests__/sources.test.js`

**Interfaces:**
- Consumes: `labelComponents`, `analyzeLand(grid, land)` → `{ land, comp, compCount, basin, basinCount, dist, nearest }`; `snapToOcean(grid, land, lon, lat, maxR = 64)` → `{ i, j, k, distCells, lon, lat } | null`.
- Produces: `analyzeLand(...)` also returns `basinSize: Int32Array(basinCount)` (ocean cells per basin). `snapToOcean(grid, land, lon, lat, maxR = 64, accept = null)` — `accept(k) → boolean` rejects ocean cells. `sources.js` exports `MIN_SNAP_BASIN_CELLS = 40`; `buildSource` snaps with `accept = (k) => mask.basinSize[mask.basin[k]] >= MIN_SNAP_BASIN_CELLS` whenever `mask.basinSize` exists (every mask from `analyzeLand`).

- [ ] **Step 1: Write the failing tests**

Append to `src/terminal/ledger/ocean/__tests__/landMask.test.js`, inside `describe('labelComponents and analyzeLand (synthetic)', …)`:

```js
  it('counts the ocean cells of every basin', () => {
    const land = new Uint8Array(g.n);
    for (let j = 0; j < g.ny; j++) land[g.idx(3, j)] = 1;   // one wall: the wrap joins both sides
    land[g.idx(6, 1)] = 1;
    const m = analyzeLand(g, land);
    expect(m.basinCount).toBe(1);
    expect(Array.from(m.basinSize)).toEqual([g.n - g.ny - 1]);
  });

  it('snaps past cells the accept filter rejects', () => {
    const land = new Uint8Array(g.n);
    const near = snapToOcean(g, land, g.lonOf(2), g.latOf(1), 4);
    expect(near.k).toBe(g.idx(2, 1));
    const far = snapToOcean(g, land, g.lonOf(2), g.latOf(1), 4, (k) => k !== g.idx(2, 1));
    expect(far.k).not.toBe(g.idx(2, 1));
    expect(far.distCells).toBe(1);
    expect(snapToOcean(g, land, g.lonOf(2), g.latOf(1), 4, () => false)).toBeNull();
  });
```

Append to `src/terminal/ledger/ocean/__tests__/sources.test.js` (add `snapToOcean` to the `../landMask` import and `MIN_SNAP_BASIN_CELLS, ambientSources` to the `../sources` import):

```js
describe('lagoon rule: sites skip basins below MIN_SNAP_BASIN_CELLS', () => {
  const cell = (lon, lat) => {
    const { i, j } = grid.lonLatToCell(lon, lat);
    return grid.idx(i, j);
  };
  const basinAt = (lon, lat) => mask.basin[cell(lon, lat)];
  const sizeAt = (lon, lat) => mask.basinSize[basinAt(lon, lat)];
  const sizeOf = (k) => mask.basinSize[mask.basin[k]];
  const verdictAt = (lat, lon) =>
    buildSource(verdictSourceSpec({ hash: 'x', coordinates: { lat, lon }, input: { ...kernel } }), grid, mask);

  it('sits between the largest skipped basin and the smallest kept sea (measured on the real grid)', () => {
    expect(MIN_SNAP_BASIN_CELLS).toBe(40);
    expect(sizeAt(18, 35)).toBe(511);                        // Mediterranean (Gibraltar is sub-grid)
    expect(sizeAt(34, 43.5)).toBe(98);                       // Black Sea
    expect(sizeAt(51, 42)).toBe(91);                         // Caspian
    expect(sizeAt(38, 20)).toBe(81);                         // Red Sea (Bab-el-Mandeb is sub-grid)
    const white = snapToOcean(grid, mask.land, 40.54, 64.54, 8);
    expect(sizeOf(white.k)).toBe(20);                        // White Sea
    expect(sizeOf(white.k)).toBeLessThan(MIN_SNAP_BASIN_CELLS);
    expect(sizeAt(38, 20)).toBeGreaterThanOrEqual(MIN_SNAP_BASIN_CELLS);
  });

  it('moves a Suez verdict out of its 1-cell lagoon into the Mediterranean', () => {
    expect(sizeOf(snapToOcean(grid, mask.land, 32.55, 29.97, 64).k)).toBe(1);
    const s = verdictAt(29.97, 32.55);
    expect(mask.basin[s.snap.k]).toBe(basinAt(18, 35));
    expect(s.snap.distCells).toBe(2);
  });

  it('drains an Arkhangelsk verdict to the open ocean, not the 20-cell White Sea', () => {
    const s = verdictAt(64.54, 40.54);
    expect(mask.basin[s.snap.k]).toBe(basinAt(-150, 0));
    expect(s.snap.distCells).toBe(3);
  });

  it('still drains into the Caspian, the Black Sea and the Red Sea', () => {
    expect(mask.basin[verdictAt(40.41, 49.87).snap.k]).toBe(basinAt(51, 42));   // Baku
    expect(mask.basin[verdictAt(46.48, 30.73).snap.k]).toBe(basinAt(34, 43.5)); // Odesa
    const jeddah = verdictAt(21.49, 39.17);
    expect(mask.basin[jeddah.snap.k]).toBe(basinAt(38, 20));
    expect(jeddah.snap.distCells).toBe(0);
  });

  it('leaves every preset snap exactly where the unfiltered snap put it', () => {
    const built = ambientSources(grid, mask);
    expect(built.length).toBeGreaterThanOrEqual(5);
    for (const s of built) {
      const [lon, lat] = s.course.at(-1);
      expect(s.snap.k, s.id).toBe(snapToOcean(grid, mask.land, lon, lat, 8).k);
    }
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/landMask.test.js src/terminal/ledger/ocean/__tests__/sources.test.js`
Expected: FAIL — `basinSize` undefined, the accept filter ignored (`far.k` equals the near cell), `MIN_SNAP_BASIN_CELLS` undefined, Suez snaps into the 1-cell basin. The preset-snap test passes (it pins today's behaviour; mutation 5 proves it bites).

- [ ] **Step 3: Implement**

In `landMask.js`, replace the last line of `analyzeLand` (`return { land, comp, compCount, basin, basinCount, dist, nearest };`) with:

```js
  const basinSize = new Int32Array(basinCount);
  for (let k = 0; k < n; k++) if (basin[k] >= 0) basinSize[basin[k]]++;
  return { land, comp, compCount, basin, basinCount, basinSize, dist, nearest };
```

Replace `snapToOcean` (the comment and function, lines 159–176) with:

```js
// Nearest ocean cell (Euclidean, in cells) within maxR; ties resolve to the
// first found scanning south→north, west→east, so results are deterministic.
// accept(k), when given, rejects ocean cells (sources.js: basins too small to
// drain into — the lagoon rule).
export function snapToOcean(grid, land, lon, lat, maxR = 64, accept = null) {
  const { i: ci, j: cj } = grid.lonLatToCell(lon, lat);
  let best = null;
  for (let dj = -maxR; dj <= maxR; dj++) {
    const j = cj + dj;
    if (j < 0 || j >= grid.ny) continue;
    for (let di = -maxR; di <= maxR; di++) {
      const k = grid.idx(ci + di, j);
      if (land[k] || (accept && !accept(k))) continue;
      const d = Math.hypot(di, dj);
      if (d <= maxR && (!best || d < best.distCells)) best = { i: grid.wrapI(ci + di), j, k, distCells: d };
    }
  }
  if (!best) return null;
  return { ...best, lon: grid.lonOf(best.i), lat: grid.latOf(best.j) };
}
```

In `sources.js`, after `export const USER_SNAP_RADIUS_CELLS = 64;` add:

```js
// Lagoon rule (spec phase-1 carry-over): a source never drains into an ocean
// basin smaller than this. Measured on the 512×256 grid (37 basins): world
// ocean 77,939 cells, Mediterranean 511, Black Sea 98, Caspian 91, Red Sea 81;
// then White Sea 20, an Arctic-Canada basin 18 and 30 basins of 1–6 cells.
// 40 keeps every real sea above and skips everything below. All nine preset
// mouths snap into basins of ≥ 81 cells, so presets are unaffected (tested).
export const MIN_SNAP_BASIN_CELLS = 40;

const snapFilter = (mask) =>
  mask.basinSize ? (k) => mask.basinSize[mask.basin[k]] >= MIN_SNAP_BASIN_CELLS : null;
```

and in `buildSource` replace `const snap = snapToOcean(grid, mask.land, end[0], end[1], snapRadius);` with:

```js
  const snap = snapToOcean(grid, mask.land, end[0], end[1], snapRadius, snapFilter(mask));
```

- [ ] **Step 4: Annotate the spec carry-over**

In the spec, replace the three lines starting `- \`snapToOcean\` does not prefer the main basin: 41 ocean basins exist at this` (through `Caspian case is intentional; tiny lagoons are not).`) with:

```markdown
- `snapToOcean` does not prefer the main basin: 41 ocean basins exist at this
  resolution (37 after the antimeridian fix), so a user verdict could snap into
  a tiny enclosed lagoon (the Caspian case is intentional; tiny lagoons are
  not). **Done in 3b:** `MIN_SNAP_BASIN_CELLS = 40` — basins of 20 cells and
  fewer (White Sea, lagoons) are skipped; the Mediterranean (511), Black Sea
  (98), Caspian (91) and Red Sea (81) are kept; preset snaps unchanged.
```

and in the bullet that starts `- \`riverCourses.js\` and the preset \`river\` blocks for the existing 5 presets`, change its last sentence `The phase-1 plan did not include them.` to `The phase-1 plan did not include them. Done in phase 2.` (3a final-review stale-line Minor).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/landMask.test.js src/terminal/ledger/ocean/__tests__/sources.test.js src/terminal/ledger/ocean/__tests__/riverCourses.test.js src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js`
Expected: PASS (existing snap/verdict tests unchanged: Linz still snaps into the Adriatic, basin 511).

- [ ] **Step 6: Mutation checks**

1. `buildSource`: pass no filter (`snapToOcean(grid, mask.land, end[0], end[1], snapRadius)`) → Suez and Arkhangelsk tests fail.
2. `MIN_SNAP_BASIN_CELLS = 100` → the Caspian/Black/Red Sea tests fail.
3. `MIN_SNAP_BASIN_CELLS = 10` → Arkhangelsk test fails (stays in the White Sea).
4. `snapToOcean`: drop `|| (accept && !accept(k))` → synthetic accept test fails.
5. `snapFilter`: `(k) => k % 2 === 0 && …` → the preset-snap test fails.
6. `analyzeLand`: count `basinSize` only for `k < n / 2` → the synthetic count test fails.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/ledger/ocean/landMask.js src/terminal/ledger/ocean/sources.js src/terminal/ledger/ocean/__tests__/landMask.test.js src/terminal/ledger/ocean/__tests__/sources.test.js docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md
git commit -m "feat(ledger-ocean): sources skip basins under 40 cells (lagoon rule); presets unchanged

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: River-stage core — source fields, `riverKm`, parcels, tick geometry

**Files:**
- Modify: `src/terminal/ledger/ocean/sources.js` (`buildSource`, `presetSourceSpec`)
- Modify: `src/terminal/ledger/ocean/gpu/palette.js` (append)
- Create: `src/terminal/ledger/ocean/riverStage.js`
- Test: `src/terminal/ledger/ocean/__tests__/sources.test.js`, `src/terminal/ledger/ocean/__tests__/riverStage.test.js` (new)

**Interfaces:**
- Consumes: `riverState(kernel, tDays, { velocityMs, depthM })` → `{ dT, L, N, D }`; `doSat(tempC)`; `haversineKm`; `courseLengthKm`.
- Produces:
  - `buildSource(spec)` accepts optional `spec.riverKm` (> 0, else the source is rejected with `null`). Returned object gains `kernel` (`{ temp, do, bod, dt, nitrate }`, numbers), `velocityMs`, `depthM`, `courseKm` (drawn polyline length), and `critical.courseKm` (km along the polyline of the critical point). `lengthKm` = `riverKm` when given, else `courseKm`; `travelDays`, `critical.rkm`, `critical.kmFromSite` use `lengthKm`.
  - `presetSourceSpec(preset, river)` passes `riverKm: river.riverKm ?? null`.
  - `riverStage.js`: `PARTICLES_PER_RIVER = 256`, `FLOATS_PER_PARTICLE = 6`, `GHOST_ALPHA = 0.5`, `cumulativeKm(course) → Float64Array`, `coursePoint(course, cum, s) → [lon, lat]`, `courseTick(course, cum, s) → { lon, lat, angleDeg } | null`, `prepareRiver(src, { alpha = 1 } = {}) → River | null`, `parcelTime(p, simDays, travelDays, n = 256) → days`, `particleColor(state, sat, alpha = 1, out = new Float32Array(4), off = 0) → out`, `fillParticles(rivers, simDays, out) → count`.
  - `palette.js`: `RIVER_PALETTE` (Global Constraints).

- [ ] **Step 1: Write the failing tests**

Append to `src/terminal/ledger/ocean/__tests__/sources.test.js`:

```js
describe('river-stage fields', () => {
  const danube = {
    id: 'danube-test', kind: 'preset',
    kernel: { temp: 12, do: 10.5, bod: 3, dt: 1.5, nitrate: 19 },
    course: [[14.29, 48.31], [16.37, 48.21], [29.75, 45.15]],
    dischargeM3s: 6500, velocityMs: 1, depthM: 5, riverKm: 2135, snapRadius: 8,
  };

  it('carries the kernel and the hydraulics the parcels need', () => {
    const s = buildSource(danube, grid, mask);
    expect(s.kernel).toEqual({ temp: 12, do: 10.5, bod: 3, dt: 1.5, nitrate: 19 });
    expect(s.velocityMs).toBe(1);
    expect(s.depthM).toBe(5);
  });

  it('uses the channel length for travel time and river km, the drawn polyline for position', () => {
    const s = buildSource(danube, grid, mask);
    expect(s.lengthKm).toBe(2135);
    expect(s.courseKm).toBeCloseTo(courseLengthKm(danube.course), 9);
    expect(s.courseKm).toBeLessThan(s.lengthKm);
    expect(s.travelDays).toBeCloseTo(2135 / 86.4, 9);
    expect(s.critical.rkm).toBeCloseTo(2135 - s.critical.kmFromSite, 9);
    expect(s.critical.courseKm).toBeCloseTo((s.critical.kmFromSite / 2135) * s.courseKm, 9);
  });

  it('reproduces the spec worked example: ~2% of BOD and ~2/3 of nitrate reach the delta', () => {
    const s = buildSource(danube, grid, mask);
    expect(s.mouth.L / 3).toBeLessThan(0.03);
    expect(s.mouth.N / 19).toBeGreaterThan(0.6);
    expect(s.mouth.N / 19).toBeLessThan(0.72);
  });

  it('without riverKm, the polyline is the channel', () => {
    const s = buildSource({ ...danube, riverKm: null }, grid, mask);
    expect(s.lengthKm).toBeCloseTo(s.courseKm, 9);
    expect(s.critical.courseKm).toBeCloseTo(s.critical.kmFromSite, 9);
  });

  it('rejects a non-positive river length', () => {
    expect(buildSource({ ...danube, riverKm: 0 }, grid, mask)).toBeNull();
    expect(buildSource({ ...danube, riverKm: NaN }, grid, mask)).toBeNull();
  });
});
```

Create `src/terminal/ledger/ocean/__tests__/riverStage.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { riverState, doSat } from '../kinetics';
import { haversineKm } from '../sources';
import { RIVER_PALETTE } from '../gpu/palette';
import {
  PARTICLES_PER_RIVER, FLOATS_PER_PARTICLE, cumulativeKm, coursePoint, courseTick,
  prepareRiver, parcelTime, particleColor, fillParticles,
} from '../riverStage';

const L_COURSE = [[0, 0], [10, 0], [10, 10]];

describe('course geometry', () => {
  const cum = cumulativeKm(L_COURSE);

  it('accumulates great-circle km per vertex', () => {
    expect(cum[0]).toBe(0);
    expect(cum[1]).toBeCloseTo(haversineKm([0, 0], [10, 0]), 9);
    expect(cum[2]).toBeCloseTo(cum[1] + haversineKm([10, 0], [10, 10]), 9);
  });

  it('walks the course by arc length, clamped to its ends', () => {
    expect(coursePoint(L_COURSE, cum, 0)).toEqual([0, 0]);
    expect(coursePoint(L_COURSE, cum, cum[1] / 2)).toEqual([5, 0]);
    const mid2 = coursePoint(L_COURSE, cum, (cum[1] + cum[2]) / 2);
    expect(mid2[0]).toBeCloseTo(10, 9);
    expect(mid2[1]).toBeCloseTo(5, 9);
    expect(coursePoint(L_COURSE, cum, cum[2] + 50)).toEqual([10, 10]);
    expect(coursePoint(L_COURSE, cum, -5)).toEqual([0, 0]);
  });

  it('gives the tick a screen angle perpendicular-ready: 0° heading east, −90° heading north', () => {
    const east = courseTick(L_COURSE, cum, cum[1] / 2);
    expect(east.lon).toBeCloseTo(5, 9);
    expect(east.angleDeg).toBeCloseTo(0, 9);
    const north = courseTick(L_COURSE, cum, (cum[1] + cum[2]) / 2);
    expect(north.angleDeg).toBeCloseTo(-90, 9);
    expect(courseTick([[3, 3]], cumulativeKm([[3, 3]]), 0)).toBeNull();
    expect(courseTick(L_COURSE, cum, NaN)).toBeNull();
  });
});

describe('parcels', () => {
  it('spaces parcels evenly in travel time and wraps them at the mouth', () => {
    const T = 10;
    const ts = Array.from({ length: PARTICLES_PER_RIVER }, (_, p) => parcelTime(p, 3.3, T));
    for (const t of ts) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(T);
    }
    const sorted = [...ts].sort((a, b) => a - b);
    for (let p = 1; p < sorted.length; p++) expect(sorted[p] - sorted[p - 1]).toBeCloseTo(T / PARTICLES_PER_RIVER, 9);
    expect(parcelTime(7, 3.3 + T, T)).toBeCloseTo(parcelTime(7, 3.3, T), 9);
    expect(parcelTime(0, 0, T)).toBeCloseTo((0.5 / PARTICLES_PER_RIVER) * T, 12);
  });

  it('colours a parcel by the §1 palette, deficit as absence of light', () => {
    const sat = doSat(20);
    const zero = particleColor({ dT: 0, L: 0, N: 0, D: 0 }, sat, 1);
    expect(Array.from(zero.slice(0, 3))).toEqual([0, 0, 0]);
    expect(zero[3]).toBeCloseTo(RIVER_PALETTE.minAlpha, 6);
    const heat = particleColor({ dT: 1000, L: 0, N: 0, D: 0 }, sat, 1);
    RIVER_PALETTE.crimson.forEach((c, i) => expect(heat[i]).toBeCloseTo(c, 5));
    expect(heat[3]).toBeCloseTo(1, 5);
    const nitrate = particleColor({ dT: 0, L: 0, N: 1e4, D: 0 }, sat, 0.5);
    RIVER_PALETTE.green.forEach((c, i) => expect(nitrate[i]).toBeCloseTo(c, 5));
    expect(nitrate[3]).toBeCloseTo(0.5, 5);
    const bod = particleColor({ dT: 0, L: 1e4, N: 0, D: 0 }, sat, 1);
    RIVER_PALETTE.amber.forEach((c, i) => expect(bod[i]).toBeCloseTo(c, 5));
    const anoxic = particleColor({ dT: 1000, L: 0, N: 0, D: sat }, sat, 1);
    RIVER_PALETTE.crimson.forEach((c, i) => expect(anoxic[i]).toBeCloseTo(c * (1 - RIVER_PALETTE.deficitDim), 5));
    const bad = particleColor({ dT: NaN, L: -3, N: NaN, D: NaN }, sat, 1);
    expect(Array.from(bad).every(Number.isFinite)).toBe(true);
  });

  const src = {
    id: 'r', course: [[0, 0], [10, 0]], courseKm: haversineKm([0, 0], [10, 0]), travelDays: 10,
    kernel: { temp: 20, do: 6, bod: 20, dt: 4, nitrate: 10 }, velocityMs: 1, depthM: 4,
  };

  it('fills 256 parcels per river from the exact kinetics at each travel time', () => {
    const river = prepareRiver(src);
    const out = new Float32Array(PARTICLES_PER_RIVER * FLOATS_PER_PARTICLE);
    expect(fillParticles([river], 3.3, out)).toBe(PARTICLES_PER_RIVER);
    for (const p of [0, 100, 255]) {
      const t = parcelTime(p, 3.3, 10);
      const [lon, lat] = coursePoint(src.course, river.cum, (t / 10) * src.courseKm);
      const c = particleColor(riverState(src.kernel, t, { velocityMs: 1, depthM: 4 }), doSat(20), 1);
      const o = p * FLOATS_PER_PARTICLE;
      expect(out[o]).toBeCloseTo(lon / 180, 6);
      expect(out[o + 1]).toBeCloseTo(lat / 90, 6);
      for (let i = 0; i < 4; i++) expect(out[o + 2 + i]).toBeCloseTo(c[i], 6);
    }
  });

  it('has no river stage for a zero-length course or one that crosses the date line', () => {
    expect(prepareRiver({ ...src, travelDays: 0 })).toBeNull();
    expect(prepareRiver({ ...src, courseKm: 0 })).toBeNull();
    expect(prepareRiver({ ...src, course: [[179.5, 0], [-179.5, 0]] })).toBeNull();
    expect(prepareRiver(src, { alpha: 0.5 }).alpha).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/sources.test.js src/terminal/ledger/ocean/__tests__/riverStage.test.js`
Expected: FAIL — `riverStage` module not found; `s.kernel` undefined; `lengthKm` is the polyline length.

- [ ] **Step 3: Implement `buildSource` / `presetSourceSpec`**

In `sources.js`, replace `buildSource` with:

```js
export function buildSource(spec, grid, mask) {
  const {
    id, kind, course, dischargeM3s, velocityMs, depthM,
    snapRadius = USER_SNAP_RADIUS_CELLS, riverKm = null,
  } = spec;
  if (!(velocityMs > 0)) throw new Error(`buildSource(${id}): velocityMs must be > 0`);
  const kernel = {
    temp: Number(spec.kernel.temp),
    do: Number(spec.kernel.do),
    bod: Number(spec.kernel.bod),
    dt: Number(spec.kernel.dt),
    nitrate: Number(spec.kernel.nitrate),
  };
  const finite = (v) => Number.isFinite(v);
  if (!Object.values(kernel).every(finite) || !finite(dischargeM3s) || !finite(depthM)) return null;
  if (dischargeM3s < 0 || depthM <= 0) return null;
  if (riverKm !== null && !(riverKm > 0 && finite(riverKm))) return null;
  if (!course.every((p) => p.every(finite))) return null;
  const end = course[course.length - 1];
  const snap = snapToOcean(grid, mask.land, end[0], end[1], snapRadius, snapFilter(mask));
  if (!snap) return null;

  const fullCourse = course.length === 1 ? [course[0], [snap.lon, snap.lat]] : course;
  // courseKm: the drawn polyline (city waypoints). lengthKm: the channel the
  // water travels — a sourced riverKm when the RIVERS entry has one (Danube),
  // else the polyline. Travel time and river km use the channel; positions
  // on the drawn course use the same fraction of the polyline.
  const courseKm = courseLengthKm(fullCourse);
  const lengthKm = riverKm !== null ? riverKm : courseKm;
  const kmPerDay = velocityMs * 86.4;
  const travelDays = lengthKm / kmPerDay;
  const hyd = { velocityMs, depthM };
  const mouth = riverState(kernel, travelDays, hyd);

  const D0 = Math.max(0, doSat(kernel.temp) - kernel.do);
  const tc = Math.min(criticalTime(kernel.bod, D0, kd(kernel.temp), kaRiver(velocityMs, depthM, kernel.temp)), travelDays);
  const atC = riverState(kernel, tc, hyd);
  const kmFromSite = tc * kmPerDay;
  const critical = {
    tDays: tc,
    kmFromSite,
    rkm: Math.max(0, lengthKm - kmFromSite),
    doMin: Math.max(0, doSat(kernel.temp) - atC.D),
    courseKm: lengthKm > 0 ? (kmFromSite / lengthKm) * courseKm : 0,
  };

  return {
    id, kind, snap, course: fullCourse, lengthKm, courseKm, travelDays, mouth,
    conc: [mouth.dT, mouth.L, mouth.N, mouth.D],
    cells: splatCells(grid, mask.land, snap, dischargeM3s),
    critical, dischargeM3s, kernel, velocityMs, depthM,
  };
}
```

In `presetSourceSpec`, add `riverKm: river.riverKm ?? null,` after `snapRadius: 8,`.

- [ ] **Step 4: Implement the palette and `riverStage.js`**

Append to `src/terminal/ledger/ocean/gpu/palette.js`:

```js

// River-stage parcel colours: the composite's crimson / amber / green (the
// legend swatches, spec §1). ref: concentration at which a channel reaches
// 1 − 1/e of its colour — river concentrations are ~1e3× the ocean's, so these
// are not OCEAN_EXPOSURE's refs. deficitDim: brightness a fully deoxygenated
// parcel loses (deficit is absence of light). minAlpha: a clean parcel stays
// faintly visible.
export const RIVER_PALETTE = {
  crimson: [1, 0.09, 0.2],
  amber: [1, 0.62, 0],
  green: [0.22, 1, 0.08],
  ref: [2, 10, 10],
  deficitDim: 0.8,
  minAlpha: 0.25,
};
```

Create `src/terminal/ledger/ocean/riverStage.js`:

```js
// riverStage.js — the Lagrangian river stage (spec §3). PARTICLES_PER_RIVER
// parcels per river, evenly spaced in travel time, advanced along the course by
// arc length at the river's velocity on the ocean's simulated clock. A parcel's
// state is the exact kinetics at its travel time (riverState), so its colour
// encodes time since discharge the way the ocean's does. Pure: no GL, no React.

import { riverState, doSat } from './kinetics';
import { haversineKm } from './sources';
import { RIVER_PALETTE } from './gpu/palette';

export const PARTICLES_PER_RIVER = 256;
export const FLOATS_PER_PARTICLE = 6; // clip x, clip y, r, g, b, a
export const GHOST_ALPHA = 0.5;

export function cumulativeKm(course) {
  const cum = new Float64Array(course.length);
  for (let p = 1; p < course.length; p++) cum[p] = cum[p - 1] + haversineKm(course[p - 1], course[p]);
  return cum;
}

// Index p (≥ 1) of the segment [p − 1, p] that holds arc length x.
function segmentAt(cum, x) {
  let p = 1;
  while (p < cum.length - 1 && cum[p] < x) p++;
  return p;
}

// [lon, lat] at arc length s (km), linear in lon/lat within a segment
// (segments are city-to-city, short on the globe). Clamped to the ends.
export function coursePoint(course, cum, s) {
  const total = cum[cum.length - 1];
  if (course.length < 2 || !(total > 0)) return [course[0][0], course[0][1]];
  const x = Math.min(Math.max(s, 0), total);
  const p = segmentAt(cum, x);
  const seg = cum[p] - cum[p - 1];
  const f = seg > 0 ? (x - cum[p - 1]) / seg : 0;
  const a = course[p - 1];
  const b = course[p];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

// The DO_MIN tick: where it sits and the screen angle of the course there
// (0° = heading east, −90° = heading north; screen y points down). A vertical
// bar rotated by angleDeg is perpendicular to the course.
export function courseTick(course, cum, s) {
  const total = cum[cum.length - 1];
  if (course.length < 2 || !(total > 0) || !Number.isFinite(s)) return null;
  const x = Math.min(Math.max(s, 0), total);
  const p = segmentAt(cum, x);
  const [lon, lat] = coursePoint(course, cum, x);
  const a = course[p - 1];
  const b = course[p];
  return { lon, lat, angleDeg: (Math.atan2(-(b[1] - a[1]), b[0] - a[0]) * 180) / Math.PI };
}

// Per-source constants for the fill. null when there is no river stage to draw
// (zero travel time or length) or the course crosses the date line (a straight
// user line to a wrapped snap cell; the HUD skips those lines too).
export function prepareRiver(src, { alpha = 1 } = {}) {
  if (!(src.travelDays > 0) || !(src.courseKm > 0)) return null;
  for (let p = 1; p < src.course.length; p++) {
    if (Math.abs(src.course[p][0] - src.course[p - 1][0]) > 180) return null;
  }
  return {
    id: src.id,
    course: src.course,
    cum: cumulativeKm(src.course),
    courseKm: src.courseKm,
    travelDays: src.travelDays,
    kernel: src.kernel,
    hyd: { velocityMs: src.velocityMs, depthM: src.depthM },
    sat: doSat(src.kernel.temp),
    alpha,
  };
}

// Travel time of parcel p at simulated day simDays: evenly spaced over the
// course, wrapping at the mouth (a parcel reaching the sea respawns at the site).
export function parcelTime(p, simDays, travelDays, n = PARTICLES_PER_RIVER) {
  const t = ((p + 0.5) / n) * travelDays + simDays;
  return t - Math.floor(t / travelDays) * travelDays;
}

const pos = (x) => (x > 0 ? x : 0); // NaN and negatives → 0

export function particleColor(state, sat, alpha = 1, out = new Float32Array(4), off = 0) {
  const { crimson, amber, green, ref, deficitDim, minAlpha } = RIVER_PALETTE;
  const e0 = 1 - Math.exp(-pos(state.dT) / ref[0]);
  const e1 = 1 - Math.exp(-pos(state.L) / ref[1]);
  const e2 = 1 - Math.exp(-pos(state.N) / ref[2]);
  const dim = 1 - deficitDim * (sat > 0 ? Math.min(1, pos(state.D) / sat) : 0);
  for (let c = 0; c < 3; c++) {
    out[off + c] = Math.min(1, e0 * crimson[c] + e1 * amber[c] + e2 * green[c]) * dim;
  }
  out[off + 3] = alpha * (minAlpha + (1 - minAlpha) * Math.max(e0, e1, e2));
  return out;
}

// Writes FLOATS_PER_PARTICLE floats per parcel (clip-space position of the
// full equirectangular world, then RGBA) into out; returns the parcel count.
export function fillParticles(rivers, simDays, out) {
  let n = 0;
  for (const r of rivers) {
    for (let p = 0; p < PARTICLES_PER_RIVER; p++) {
      const t = parcelTime(p, simDays, r.travelDays);
      const [lon, lat] = coursePoint(r.course, r.cum, (t / r.travelDays) * r.courseKm);
      const o = n * FLOATS_PER_PARTICLE;
      out[o] = lon / 180;
      out[o + 1] = lat / 90;
      particleColor(riverState(r.kernel, t, r.hyd), r.sat, r.alpha, out, o + 2);
      n++;
    }
  }
  return n;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/ src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js`
Expected: PASS (all existing `buildSource` tests unchanged: without `riverKm`, `lengthKm` equals the polyline length).

- [ ] **Step 6: Mutation checks**

1. `coursePoint`: `const f = 0;` → arc-length test fails.
2. `parcelTime`: return `t` without the wrap → range and wrap tests fail.
3. `particleColor`: swap `amber` and `green` → nitrate and BOD colour tests fail.
4. `particleColor`: drop `* dim` → anoxic test fails.
5. `buildSource`: `const lengthKm = courseKm;` → channel-length and worked-example tests fail.
6. `fillParticles`: pass `0` as the travel time to `riverState` → the parcel-state test fails.
7. `courseTick`: drop the minus in `-(b[1] - a[1])` → the north angle test fails (+90).
8. `prepareRiver`: remove the date-line loop → the date-line case fails.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/ledger/ocean/sources.js src/terminal/ledger/ocean/gpu/palette.js src/terminal/ledger/ocean/riverStage.js src/terminal/ledger/ocean/__tests__/sources.test.js src/terminal/ledger/ocean/__tests__/riverStage.test.js
git commit -m "feat(ledger-ocean): river-stage core — parcels by exact kinetics, riverKm channel length, tick geometry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The four new presets — research, sourced river data, preset row 5 → 9

**WEB LOOKUP REQUIRED.** This task needs WebSearch/WebFetch. Every number in the four new `RIVERS` entries gets a cited source (title, URL, retrieval date) in its `sources` note, or the note starts with `UNVERIFIED`. Two numbers MUST be sourced (tests enforce it): the Ganges combined Q and the Danube `riverKm` at Linz. If either cannot be sourced, report BLOCKED — do not weaken the test.

Kernel values are **not** research: they are derived below by the 2026-07-19 method (tuned against `severityEngine.js` thresholds toward each tone) and are committed exactly as given.

**Files:**
- Modify (append only): `src/terminal/ledger/auditPresets.js`
- Modify: `src/terminal/ledger/ocean/riverCourses.js`
- Modify: `src/terminal/ledger/ocean/sources.js` (`ambientSources` uses `ALL_AUDIT_PRESETS`)
- Modify: `src/terminal/views/ledger/ocean/hudFormat.js` (`PRESET_BY_ID`)
- Modify: `src/terminal/views/ledger/SubmissionForm.jsx` (preset row)
- Modify: `src/terminal/ledger/ocean/gpu/parityProbe.js` (real-case name)
- Modify: `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md` (§3)
- Test: `src/terminal/ledger/__tests__/extraPresets.test.js` (new), `src/terminal/ledger/ocean/__tests__/riverCourses.test.js`, `src/terminal/views/ledger/__tests__/SubmissionForm.test.jsx` (new), `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx` (ring count 5 → 9)

**Interfaces:**
- Consumes: `buildSource`/`presetSourceSpec` with `riverKm` (Task 2); `MIN_SNAP_BASIN_CELLS` (Task 1); `paramSeverity`, `discreteSeverity`; `validateSubmission`.
- Produces: `EXTRA_PRESETS` (4 entries, same shape as `AUDIT_PRESETS`), `ALL_AUDIT_PRESETS` (9: the five, then yangtze, ganges, citarum, danube). `RIVERS` has 9 keys; `RIVERS.danube.riverKm` and `RIVERS.danube.sources.riverKm`.

#### Kernel derivation (2026-07-19 method)

Thresholds (`severityEngine.js`, `do`/`flow` inverted): temp safe < 18, stress < 31.5; do safe > 8.4, critical ≤ 4.2; bod safe < 24, stress < 42; dt safe < 4, stress < 7; epi safe < 3.2, stress < 5.6; nitrate safe < 20, stress < 35; flow safe > 36, critical ≤ 18. Every value keeps a margin from its tier line.

| | YANGTZE (critical) | GANGES (critical) | CITARUM (critical) | DANUBE (safe) |
|---|---|---|---|---|
| temp | 29 — stress (0.64): summer estuary water | 30 — stress (0.67): Bengal delta water | 32 — critical (0.71): tropical + textile effluent heat | 12 — safe (0.27): the spec's worked-example temperature |
| do | 3.5 — critical (0.75): the Changjiang-plume hypoxia | 3.8 — critical (0.73): sewage oxygen demand | 2.5 — critical (0.82) | 10.5 — safe (0.25) |
| bod | 45 — critical (0.75) | 48 — critical (0.80): the basin's untreated sewage | 58 — critical (0.97): the "most polluted river" narrative | 3 — safe (0.05): the repaid debt |
| dt | 5.5 — stress (0.55): riverside power plants | 3 — safe (0.30): no large thermal load | 7.5 — critical (0.75): dye-house hot effluent | 1.5 — safe (0.15) |
| epi | 6 — critical (0.75) | 5.8 — critical (0.73) | 6 — critical (0.75) | 2.8 — safe (0.35) |
| nitrate | 38 — critical (0.76): fertiliser load | 36 — critical (0.72) | 44 — critical (0.88) | 19 — safe (0.38): just under stress — the legacy nitrate that still reaches the Black Sea |
| flow (kernel, 0–100) | 15 — critical (0.75) | 14 — critical (0.77) | 10 — critical (0.83) | 44 — safe (0.27) |

- [ ] **Step 1: Research (web) and record**

For each item below, find a source, and write down value + source (title, URL, retrieval date) in the task report. Candidates are the planner's, **unverified**.

1. **Yangtze.** (a) Audit-site coordinate: is 31.23°N 121.47°E (spec) on the Yangtze? (It is central Shanghai, on the Huangpu.) Candidate replacement: Wusongkou, the Huangpu–Yangtze confluence, ~31.39°N 121.50°E — confirm its coordinate. (b) Mean discharge (candidate 30,166 m³/s; record the gauge, e.g. Datong). (c) Estuary waypoints: South Channel past Changxing/Hengsha islands to the outer estuary (candidate end 31.10°N 122.25°E).
2. **Ganges (Meghna estuary, user decision).** (a) Chandpur coordinate (candidate 23.23°N 90.65°E) and a source saying the Padma (Ganges+Brahmaputra) joins the Meghna there. (b) Combined Ganges–Brahmaputra–Meghna mean discharge (candidate ~38,000 m³/s; record exactly what the source's figure covers). **MUST be sourced.** (c) Estuary mouth between Bhola and Hatiya (candidate 22.25°N 91.00°E).
3. **Citarum.** (a) Is 6.12°S 107.03°E (spec) on the lower Citarum? If not, the nearest point on the lower Citarum, with its source. (b) Mouth (Muara Gembong area; candidate 5.93°S 107.00°E). (c) Mean discharge (no candidate). If none is found, write an order-of-magnitude assumption with an `UNVERIFIED —` note.
4. **Danube.** (a) **River kilometre at Linz — MUST be sourced.** How to verify: Danube kilometres are chained upstream from Sulina (km 0). Search `Linz Donau-Kilometer`, `Linz Stromkilometer`, `Nibelungenbrücke Donau km`, and the Danube Commission's kilometre reference / viadonau navigation pages. Use a source that states the km mark at Linz city centre (Nibelungenbrücke / Linz harbour); if two sources differ by more than 5 km, use the one tied to the city centre and name both in the note. Candidate 2135. (b) Mean discharge at the delta (candidate 6,500 m³/s). (c) Slope: Linz elevation (cited) ÷ `riverKm` (candidate S = 1.2e-4); if no elevation source, keep S with `UNVERIFIED`. (d) Waypoint city coordinates (Vienna, Bratislava, Komárno, Budapest, Mohács, Vukovar, Novi Sad, Belgrade, Drobeta-Turnu Severin, Vidin, Ruse, Silistra, Brăila, Galați, Tulcea, Sulina) — one note naming the source of the city coordinates suffices, like the Rhine entry.

Rules: a planner candidate never goes into a note as if sourced. Manning `n` and `R` stay assumptions (`UNVERIFIED — assumed …`), as for the first five rivers. If research moves an audit site, change **both** the preset's `lat`/`lon` and `course[0]` (a test pins them equal).

- [ ] **Step 2: Write the failing tests**

Create `src/terminal/ledger/__tests__/extraPresets.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { AUDIT_PRESETS, EXTRA_PRESETS, ALL_AUDIT_PRESETS } from '../auditPresets';
import { PARAM_RANGES, validateSubmission } from '../verdictModel';
import { paramSeverity, discreteSeverity } from '../../views/ledger/severityEngine';

const PARAM_KEYS = ['temp', 'do', 'bod', 'dt', 'epi', 'nitrate', 'flow'];

// Hand-computed against severityEngine.js (plan 2026-09-30 Task 3 table).
const EXPECTED_TIERS = {
  yangtze: { temp: 'stress', do: 'critical', bod: 'critical', dt: 'stress', epi: 'critical', nitrate: 'critical', flow: 'critical' },
  ganges:  { temp: 'stress', do: 'critical', bod: 'critical', dt: 'safe',   epi: 'critical', nitrate: 'critical', flow: 'critical' },
  citarum: { temp: 'critical', do: 'critical', bod: 'critical', dt: 'critical', epi: 'critical', nitrate: 'critical', flow: 'critical' },
  danube:  { temp: 'safe', do: 'safe', bod: 'safe', dt: 'safe', epi: 'safe', nitrate: 'safe', flow: 'safe' },
};

describe('EXTRA_PRESETS', () => {
  it('adds yangtze, ganges, citarum, danube after the untouched five', () => {
    expect(EXTRA_PRESETS.map((p) => p.key)).toEqual(['yangtze', 'ganges', 'citarum', 'danube']);
    expect(ALL_AUDIT_PRESETS).toHaveLength(9);
    expect(ALL_AUDIT_PRESETS.slice(0, 5)).toEqual(AUDIT_PRESETS);
    expect(new Set(ALL_AUDIT_PRESETS.map((p) => p.key)).size).toBe(9);
    expect(EXTRA_PRESETS.map((p) => p.tone)).toEqual(['critical', 'critical', 'critical', 'safe']);
  });

  it('keeps every param inside PARAM_RANGES and produces the intended tiers', () => {
    for (const p of EXTRA_PRESETS) {
      for (const key of PARAM_KEYS) {
        expect(p[key], `${p.key}.${key}`).toBeGreaterThanOrEqual(PARAM_RANGES[key].min);
        expect(p[key], `${p.key}.${key}`).toBeLessThanOrEqual(PARAM_RANGES[key].max);
        expect(discreteSeverity(paramSeverity(key, p[key])), `${p.key}.${key}`).toBe(EXPECTED_TIERS[p.key][key]);
      }
      expect(typeof p.lat).toBe('number');
      expect(typeof p.lon).toBe('number');
      expect(p.siteName.length).toBeGreaterThan(0);
    }
  });

  it('all nine presets pass validateSubmission (spec §6)', () => {
    for (const p of ALL_AUDIT_PRESETS) expect(validateSubmission(p), p.key).toEqual([]);
  });
});
```

In `src/terminal/ledger/ocean/__tests__/riverCourses.test.js`: change the import to `import { ALL_AUDIT_PRESETS } from '../../auditPresets';`, replace every `AUDIT_PRESETS` with `ALL_AUDIT_PRESETS`, rename the test `'builds all five ambient sources'` to `'builds all nine ambient sources'`, and append:

```js
describe('phase-3b rivers', () => {
  const basinAt = (lon, lat) => {
    const { i, j } = grid.lonLatToCell(lon, lat);
    return mask.basin[grid.idx(i, j)];
  };
  const built = (key) => buildSource(presetSourceSpec(ALL_AUDIT_PRESETS.find((p) => p.key === key)), grid, mask);

  it('drains the Ganges preset at the Meghna estuary with the combined G–B–M flow, sourced', () => {
    const r = RIVERS.ganges;
    expect(r.course.at(-1)[0]).toBeGreaterThan(90.5);      // east of the Sundarbans (~89.2°E)
    expect(r.dischargeM3s).toBeGreaterThanOrEqual(30000);
    expect(r.dischargeM3s).toBeLessThanOrEqual(45000);
    expect(r.sources.dischargeM3s.startsWith('UNVERIFIED')).toBe(false);
    expect(mask.basin[built('ganges').snap.k]).toBe(basinAt(-150, 0));
  });

  it('counts Danube river kilometres from Linz (sourced) and drains into the Black Sea', () => {
    const r = RIVERS.danube;
    expect(r.riverKm).toBeGreaterThanOrEqual(2100);
    expect(r.riverKm).toBeLessThanOrEqual(2170);
    expect(hasNote(r.sources.riverKm)).toBe(true);
    expect(r.sources.riverKm.startsWith('UNVERIFIED')).toBe(false);
    const s = built('danube');
    expect(s.lengthKm).toBe(r.riverKm);
    expect(s.critical.rkm).toBeGreaterThan(0);
    expect(s.critical.rkm).toBeLessThanOrEqual(r.riverKm);
    expect(mask.basin[s.snap.k]).toBe(basinAt(34, 43.5));
  });

  it('delivers the Danube plume almost entirely as nitrate (spec §3 worked example)', () => {
    const p = ALL_AUDIT_PRESETS.find((x) => x.key === 'danube');
    const s = built('danube');
    expect(s.travelDays).toBeGreaterThan(15);
    expect(s.travelDays).toBeLessThan(40);
    expect(s.mouth.L / p.bod).toBeLessThan(0.05);
    expect(s.mouth.N / p.nitrate).toBeGreaterThan(0.55);
    expect(s.mouth.N / p.nitrate).toBeLessThan(0.8);
  });

  it('drains the Yangtze and the Citarum into the open ocean', () => {
    expect(mask.basin[built('yangtze').snap.k]).toBe(basinAt(-150, 0));
    expect(mask.basin[built('citarum').snap.k]).toBe(basinAt(-150, 0));
  });
});
```

Create `src/terminal/views/ledger/__tests__/SubmissionForm.test.jsx`:

```jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// RiverPulse draws on a 2D canvas, which jsdom does not have.
vi.mock('../RiverPulse', () => ({ default: () => null }));

import SubmissionForm from '../SubmissionForm';
import { ALL_AUDIT_PRESETS } from '../../../ledger/auditPresets';

afterEach(cleanup);

describe('SubmissionForm presets', () => {
  it('offers all nine presets, in order', () => {
    render(<SubmissionForm onSubmit={() => {}} loading={false} />);
    const labels = ALL_AUDIT_PRESETS.map((p) => p.label);
    expect(labels).toEqual(['MERCURY', 'GERMANY', 'USA', 'BRAZIL', 'NORTH KOREA', 'YANGTZE', 'GANGES', 'CITARUM', 'DANUBE']);
    const row = screen.getAllByRole('button').map((b) => b.textContent).filter((t) => labels.includes(t));
    expect(row).toEqual(labels);
  });
});
```

In `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx`, in `'adds an archived verdict as a source once, and rings its site'`, change `.toHaveLength(5)` to `.toHaveLength(9)`.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/terminal/ledger/__tests__/extraPresets.test.js src/terminal/ledger/ocean/__tests__/riverCourses.test.js src/terminal/views/ledger/__tests__/SubmissionForm.test.jsx`
Expected: FAIL — `EXTRA_PRESETS` undefined; `RIVERS` lacks the new keys; the row has five buttons.

- [ ] **Step 4: Append the presets**

Append to `src/terminal/ledger/auditPresets.js` (after the closing `];` — nothing above it changes):

```js

// Phase-3b presets (spec 2026-09-29 §3). Kernel values tuned by the same
// 2026-07-19 method against severityEngine.js thresholds toward each tone; the
// per-param tiers and reasons are in
// docs/superpowers/plans/2026-09-30-ledger-ocean-phase3b-rivers.md (Task 3).
// Like the first five they are narrative-tuned kernel inputs, not measurements;
// river course and discharge live in ocean/riverCourses.js. AUDIT_PRESETS above
// stays exactly as it was: its test pins those five.
export const EXTRA_PRESETS = [
  {
    key: 'yangtze',
    label: 'YANGTZE',
    tone: 'critical',
    siteName: 'Yangtze estuary at Wusongkou, Shanghai, China',
    lat: 31.39, lon: 121.5,
    temp: 29, do: 3.5, bod: 45, dt: 5.5, epi: 6, nitrate: 38, flow: 15,
  },
  {
    key: 'ganges',
    label: 'GANGES',
    tone: 'critical',
    // The Padma (Ganges + Brahmaputra) joins the Meghna at Chandpur: the site
    // is on the channel that carries the combined flow drained at the estuary.
    siteName: 'Lower Meghna at Chandpur, Bangladesh (combined Ganges–Brahmaputra–Meghna flow)',
    lat: 23.23, lon: 90.65,
    temp: 30, do: 3.8, bod: 48, dt: 3, epi: 5.8, nitrate: 36, flow: 14,
  },
  {
    key: 'citarum',
    label: 'CITARUM',
    tone: 'critical',
    siteName: 'Lower Citarum, West Java, Indonesia',
    lat: -6.12, lon: 107.03,
    temp: 32, do: 2.5, bod: 58, dt: 7.5, epi: 6, nitrate: 44, flow: 10,
  },
  {
    key: 'danube',
    label: 'DANUBE',
    tone: 'safe',
    // Present-day conditions: the NW Black Sea hypoxia of the 1970s–80s largely
    // recovered after nutrient loads fell — the set's one repaid debt. Nitrate
    // sits just under the stress line: the legacy load still reaches the sea.
    siteName: 'Danube at Linz, Austria',
    lat: 48.31, lon: 14.29,
    temp: 12, do: 10.5, bod: 3, dt: 1.5, epi: 2.8, nitrate: 19, flow: 44,
  },
];

export const ALL_AUDIT_PRESETS = [...AUDIT_PRESETS, ...EXTRA_PRESETS];
```

If Step 1 moved a site, use the researched `lat`/`lon` (and a matching `siteName`) here and in `course[0]` below.

- [ ] **Step 5: Add the `RIVERS` entries**

In `riverCourses.js`, change the header line `// Manning parameters. Keyed by AUDIT_PRESETS key; auditPresets.js itself is` to `// Manning parameters. Keyed by ALL_AUDIT_PRESETS key; auditPresets.js itself is`, add `// An optional riverKm (sourced channel length, site → sea) overrides the polyline for travel time and river km.` as a new line after `// Courses are city/landmark waypoints, not surveyed thalwegs.`, and insert before the closing `};` of `RIVERS`:

```js
  yangtze: {
    course: [[121.5, 31.39], [121.8, 31.3], [122.05, 31.2], [122.25, 31.1]],
    dischargeM3s: 30166,
    manning: { n: 0.025, R: 10, S: 0.00001 },
    sources: {
      course: 'UNVERIFIED — planner candidate: Wusongkou (Huangpu–Yangtze confluence) → South Channel → outer estuary',
      dischargeM3s: 'UNVERIFIED — planner candidate 30,166 m³/s Yangtze mean discharge',
      manning: 'UNVERIFIED — assumed tidal lower-Yangtze values (n 0.025, R 10 m, S 1e-5)',
    },
  },
  ganges: {
    course: [[90.65, 23.23], [90.72, 22.95], [90.8, 22.6], [91.0, 22.25]],
    dischargeM3s: 38000,
    manning: { n: 0.025, R: 12, S: 0.00002 },
    sources: {
      course: 'UNVERIFIED — planner candidate: Chandpur (Padma–Meghna confluence) → Lower Meghna → estuary mouth between Bhola and Hatiya',
      dischargeM3s: 'UNVERIFIED — planner candidate ~38,000 m³/s combined Ganges–Brahmaputra–Meghna (user decision 2026-09-29)',
      manning: 'UNVERIFIED — assumed large deltaic channel values (n 0.025, R 12 m, S 2e-5)',
    },
  },
  citarum: {
    course: [[107.03, -6.12], [107.02, -6.02], [107.0, -5.93]],
    dischargeM3s: 180,
    manning: { n: 0.035, R: 2, S: 0.0003 },
    sources: {
      course: 'UNVERIFIED — planner candidate: lower Citarum → mouth near Muara Gembong',
      dischargeM3s: 'UNVERIFIED — order-of-magnitude assumption (180 m³/s); no source found yet',
      manning: 'UNVERIFIED — assumed small lowland river values (n 0.035, R 2 m, S 3e-4)',
    },
  },
  danube: {
    course: [
      [14.29, 48.31], [16.3738, 48.2082], [17.1077, 48.1486], [18.12, 47.76], [19.0402, 47.4979],
      [18.68, 45.99], [19.0, 45.35], [19.8335, 45.2671], [20.4489, 44.7866], [22.6567, 44.6319],
      [22.8826, 43.9962], [25.9657, 43.8356], [27.26, 44.1171], [27.9575, 45.2692], [28.008, 45.4353],
      [28.8051, 45.1716], [29.6533, 45.1553], [29.75, 45.15],
    ],
    riverKm: 2135,
    dischargeM3s: 6500,
    manning: { n: 0.03, R: 5, S: 0.00012 },
    sources: {
      course: 'UNVERIFIED — planner candidate: Linz → Vienna → Bratislava → Komárno → Budapest → Mohács → Vukovar → Novi Sad → Belgrade → Drobeta-Turnu Severin → Vidin → Ruse → Silistra → Brăila → Galați → Tulcea → Sulina; city coordinates',
      riverKm: 'UNVERIFIED — planner candidate rkm 2135 at Linz (chained from Sulina = km 0)',
      dischargeM3s: 'UNVERIFIED — planner candidate ~6,500 m³/s at the delta',
      manning: 'UNVERIFIED — assumed large regulated river values (n 0.03, R 5 m); S 1.2e-4 ≈ Linz elevation / riverKm, both unverified',
    },
  },
```

Then replace every value and note with the Step 1 results: sourced numbers get notes of the form `'<what the number is> (<source title>, <URL>, retrieved <YYYY-MM-DD>)'`; unsourced ones keep an `UNVERIFIED —` note that says what was assumed. The Ganges `dischargeM3s` note and the Danube `riverKm` note must not start with `UNVERIFIED`.

- [ ] **Step 6: Switch the consumers to `ALL_AUDIT_PRESETS`**

- `sources.js`: `import { ALL_AUDIT_PRESETS } from '../auditPresets';` (replacing the `AUDIT_PRESETS` import) and `return ALL_AUDIT_PRESETS` in `ambientSources`.
- `hudFormat.js`: `import { ALL_AUDIT_PRESETS } from '../../../ledger/auditPresets';` and `const PRESET_BY_ID = new Map(ALL_AUDIT_PRESETS.map((p) => [\`preset:${p.key}\`, p]));`.
- `SubmissionForm.jsx`: `import { ALL_AUDIT_PRESETS } from '../../ledger/auditPresets';` and `{ALL_AUDIT_PRESETS.map(preset => (` in the preset row.
- `parityProbe.js`: `name: 'real 512x256, nine preset sources',`.

- [ ] **Step 7: Update spec §3**

Replace the four table rows (`yangtze` … `danube`) under "New 4" with the committed values, in this form (fill every value from `riverCourses.js`/`auditPresets.js` as committed):

```markdown
| `yangtze` | <siteName> (<lat>°N, <lon>°E) → East China Sea | critical | <dischargeM3s> (<source or UNVERIFIED>) |
| `ganges` | Lower Meghna at Chandpur (<lat>°N, <lon>°E) → Meghna estuary | critical | <dischargeM3s>, combined G–B–M (<source>) |
| `citarum` | <siteName> (<lat>°S, <lon>°E) → Java Sea | critical | <dischargeM3s> (<source or UNVERIFIED>) |
| `danube` | **Linz** (48.31°N, 14.29°E), rkm <riverKm> → Sulina mouth (45.15°N, 29.75°E) | safe | <dischargeM3s> (<source or UNVERIFIED>) |
```

Below the table, replace the Ganges bullet's last sentence (`**Decided (user, 2026-09-29): …** (implemented in phase 3b).`) with `**Decided (user, 2026-09-29), implemented in 3b:** the audit site moves to the Lower Meghna at Chandpur, where the Padma (Ganges + Brahmaputra) joins the Meghna, so the site, the course and the combined Q describe the same water.`, and the Danube rkm bullet with `- Danube: HUD counts river kilometres from Linz (rkm <riverKm>, <source>) to 0 at the sea. The waypoint polyline (~1,660 km) is drawing geometry; travel time and rkm use riverKm (3b).` Add one bullet: `- 3b: the new presets live in \`EXTRA_PRESETS\` appended to auditPresets.js (\`ALL_AUDIT_PRESETS\` = 9); \`AUDIT_PRESETS\` and its test are untouched.`

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/terminal/ledger/ src/terminal/views/ledger/`
Expected: PASS. `auditPresets.test.js` passes untouched. If the Danube worked-example bounds fail with the researched Manning slope, report BLOCKED with the numbers (do not change the bounds).

- [ ] **Step 9: Mutation checks**

1. Set `EXTRA_PRESETS` Danube `nitrate: 21` → tier test fails.
2. Remove the Citarum entry from `RIVERS` → "covers exactly the audit presets" and "nine ambient sources" fail.
3. Put `UNVERIFIED — x` back into the Ganges discharge note → Ganges test fails.
4. Set Ganges `course` end to `[89.18, 21.95]` (Sundarbans) → Ganges test fails.
5. Delete `riverKm` from the Danube entry → Danube tests fail (`lengthKm` = polyline).
6. `SubmissionForm`: map over `AUDIT_PRESETS` again → the nine-button test fails.
7. Give the Danube preset `do: 20.5` → `validateSubmission` test fails.

- [ ] **Step 10: Commit**

```bash
git add src/terminal/ledger/auditPresets.js src/terminal/ledger/ocean/riverCourses.js src/terminal/ledger/ocean/sources.js src/terminal/views/ledger/ocean/hudFormat.js src/terminal/views/ledger/SubmissionForm.jsx src/terminal/ledger/ocean/gpu/parityProbe.js src/terminal/ledger/__tests__/extraPresets.test.js src/terminal/ledger/ocean/__tests__/riverCourses.test.js src/terminal/views/ledger/__tests__/SubmissionForm.test.jsx src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md
git commit -m "feat(ledger): Yangtze, Ganges (Meghna), Citarum and Danube presets with sourced river data

<one line per number: value — source, or UNVERIFIED>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: River-stage parcels on the GPU — particle layer in the ocean's context

**Files:**
- Create: `src/terminal/ledger/ocean/gpu/particleShaders.js`, `src/terminal/ledger/ocean/gpu/particleLayer.js`
- Modify (append line): `src/terminal/gl/__tests__/recordingGL.js`
- Modify: `src/terminal/views/ledger/ocean/hudFormat.js` (constants), `src/terminal/views/ledger/ocean/LedgerOcean.jsx`
- Modify: `scripts/oceanShaders.mjs`
- Test: `src/terminal/ledger/ocean/__tests__/particleLayer.test.js` (new), `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx`

**Interfaces:**
- Consumes: `buildProgram(gl, vs, fs, { label })` (glHost, throws on failure after deleting the failed program); `prepareRiver`, `fillParticles`, `PARTICLES_PER_RIVER`, `FLOATS_PER_PARTICLE` (Task 2); host `{ gl, prog, U, vao }`.
- Produces: `createParticleLayer(gl)` → `{ upload(data: Float32Array, count), draw(first, count, sizePx), dispose() }` (throws if the program fails to build, having allocated nothing). `PARTICLE_VS`, `PARTICLE_FS`. `hudFormat.js`: `PARTICLE_PX = 2`, `FLARE_PX = 7`. `LedgerOcean` draws `drawArrays(POINTS, 0, rivers × 256)` after every composite paint; builds the layer only when the sim exists; a layer build failure logs and runs the ocean without parcels.

- [ ] **Step 1: Write the failing tests**

Add a new line `  DYNAMIC_DRAW: 0x88e8,` to `CONSTANTS` in `recordingGL.js`, directly after the line `  R8: 0x8229, R16F: 0x822d, RED: 0x1903,` (a pure addition; no existing line changes).

Create `src/terminal/ledger/ocean/__tests__/particleLayer.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRecordingGL } from '../../../gl/__tests__/recordingGL';
import { createParticleLayer } from '../gpu/particleLayer';
import { PARTICLE_VS, PARTICLE_FS } from '../gpu/particleShaders';

describe('createParticleLayer', () => {
  it('declares the parcel layout the buffer fill writes (clip xy at 0, RGBA at 1)', () => {
    expect(PARTICLE_VS).toMatch(/layout\(location = 0\) in vec2 aPos;/);
    expect(PARTICLE_VS).toMatch(/layout\(location = 1\) in vec4 aColor;/);
    expect(PARTICLE_VS).toMatch(/gl_PointSize = uSize;/);
    expect(PARTICLE_FS).toMatch(/gl_PointCoord/);
  });

  it('owns a VAO with two interleaved attributes (stride 24 bytes) and draws blended points', () => {
    const gl = createRecordingGL({ version: 2 });
    const layer = createParticleLayer(gl);
    expect(gl.__log).toContainEqual(['vertexAttribPointer', 0, 2, gl.FLOAT, false, 24, 0]);
    expect(gl.__log).toContainEqual(['vertexAttribPointer', 1, 4, gl.FLOAT, false, 24, 8]);
    const data = new Float32Array(3 * 6).fill(0.5);
    layer.upload(data, 2);
    expect(gl.__log.at(-1)).toEqual(['bufferData', gl.ARRAY_BUFFER, Array.from(data.subarray(0, 12)), gl.DYNAMIC_DRAW]);
    const mark = gl.__log.length;
    layer.draw(0, 2, 3);
    const calls = gl.__log.slice(mark).map((e) => e[0]);
    expect(calls).toEqual([
      'bindFramebuffer', 'useProgram', 'bindVertexArray', 'uniform1f', 'enable', 'blendFunc',
      'drawArrays', 'disable', 'bindVertexArray',
    ]);
    expect(gl.__log.find((e, i) => i >= mark && e[0] === 'drawArrays')).toEqual(['drawArrays', gl.POINTS, 0, 2]);
    const n = gl.__log.length;
    layer.draw(0, 0, 3);
    expect(gl.__log.length).toBe(n);   // nothing to draw: no GL calls
  });

  it('releases its program, VAO and buffer', () => {
    const gl = createRecordingGL({ version: 2 });
    createParticleLayer(gl).dispose();
    const count = (name) => gl.__log.filter((e) => e[0] === name).length;
    expect(count('deleteProgram')).toBe(count('createProgram'));
    expect(count('deleteVertexArray')).toBe(count('createVertexArray'));
    expect(count('deleteBuffer')).toBe(count('createBuffer'));
  });

  it('throws on a failed link having allocated nothing that outlives it', () => {
    const gl = createRecordingGL({ version: 2 });
    gl.getProgramParameter = () => false;
    expect(() => createParticleLayer(gl)).toThrow(/failed to link/);
    expect(gl.__log.filter((e) => e[0] === 'createVertexArray')).toHaveLength(0);
    expect(gl.__log.filter((e) => e[0] === 'createBuffer')).toHaveLength(0);
  });
});
```

In `LedgerOcean.test.jsx`:
- Add imports: `import { prepareRiver, fillParticles, PARTICLES_PER_RIVER, FLOATS_PER_PARTICLE } from '../../../../ledger/ocean/riverStage';` and add `PARTICLE_PX` to the `../hudFormat` import.
- After `const paints = …`, add:

```js
const quads = () => rec.log.filter((e) => e[0] === 'drawArrays' && e[1] === rec.gl.TRIANGLE_STRIP).length;
const pointDraws = () => rec.log.filter((e) => e[0] === 'drawArrays' && e[1] === rec.gl.POINTS);
const particleUploads = () => rec.log.filter((e) => e[0] === 'bufferData' && Array.isArray(e[2]) && e[2].length > 8);
```

- In `'steps the sim on the frame loop by wall time, not frame count'`: change `const drawsAtMount = count('drawArrays');` to `const drawsAtMount = quads();` and `expect(count('drawArrays') - drawsAtMount)` to `expect(quads() - drawsAtMount)` (the parcel draws are POINTS; this test counts sim and composite passes).
- Append:

```js
describe('LedgerOcean river stage', () => {
  it('draws 256 parcels per river after each composite, filled from the exact kinetics', () => {
    const days = [];
    const m = mountLive(<LedgerOcean width={1024} height={512} onFrame={(d) => days.push(d)} />);
    m.frames(5);
    const rivers = getOceanWorld().sources.map((s) => prepareRiver(s)).filter(Boolean);
    expect(rivers.length).toBeGreaterThanOrEqual(5);
    const n = rivers.length * PARTICLES_PER_RIVER;
    expect(pointDraws()).toHaveLength(paints());                 // one parcel draw per composite
    expect(pointDraws().at(-1)).toEqual(['drawArrays', rec.gl.POINTS, 0, n]);
    const expected = new Float32Array(n * FLOATS_PER_PARTICLE);
    fillParticles(rivers, days.at(-1), expected);
    expect(particleUploads().at(-1)[2]).toEqual(Array.from(expected));
    expect(rec.log).toContainEqual(['uniform1f', expect.stringMatching(/:uSize$/), PARTICLE_PX]);
  });

  it('re-fills parcels only when the simulated day changes', () => {
    const m = mountLive(<LedgerOcean width={1024} height={512} daysPerSecond={1} />);
    const before = particleUploads().length;
    m.frames(10);   // 160 ms at 1 d/s = 0.16 d: no 0.25 d step yet
    expect(particleUploads()).toHaveLength(before);
    expect(pointDraws().length).toBeGreaterThanOrEqual(10);
  });

  it('runs the ocean without parcels when the particle program fails to build', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout', 'Date'] });
    rec = installRecordingGL({ version: 2, extensions: FLOAT });
    let links = 0;
    // link 1 = display program, 2..6 = the five sim programs, 7 = particles.
    rec.gl.getProgramParameter = () => { links += 1; return links !== 7; };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LedgerOcean width={1024} height={512} />);
    act(() => { vi.advanceTimersByTime(48); });
    expect(err).toHaveBeenCalled();
    expect(pointDraws()).toHaveLength(0);
    expect(quads()).toBeGreaterThan(1);                         // the sim still steps and paints
    expect(screen.queryByText(MODE_LABEL['static-shader'])).toBeNull();
    expect(count('createProgram') - count('deleteProgram')).toBe(6);
  });

  it('releases the parcel program, VAO and buffer on unmount', () => {
    const m = mountLive(<LedgerOcean width={1024} height={512} />);
    m.unmount();
    expect(count('deleteProgram')).toBe(count('createProgram'));
    expect(count('deleteVertexArray')).toBe(count('createVertexArray'));
    expect(count('deleteBuffer')).toBe(count('createBuffer'));
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/particleLayer.test.js src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx`
Expected: FAIL — modules not found; no POINTS draws.

- [ ] **Step 3: Implement the shaders and the layer**

Create `src/terminal/ledger/ocean/gpu/particleShaders.js`:

```js
// particleShaders.js — river-stage parcels as round GL points. No imports, so
// scripts/oceanShaders.mjs can load it in Node and compile it in real Chrome.
// Position is already clip space (lon/180, lat/90); colour is computed on the
// CPU by riverStage.particleColor.

export const PARTICLE_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aColor;
uniform float uSize;
out vec4 vColor;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  gl_PointSize = uSize;
  vColor = aColor;
}`;

export const PARTICLE_FS = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  if (dot(d, d) > 0.25) discard;
  outColor = vColor;
}`;
```

Create `src/terminal/ledger/ocean/gpu/particleLayer.js`:

```js
// particleLayer.js — draws the river-stage parcels over the composite, in the
// ocean's own GL context (one canvas, the ocean's lifecycle). The CPU writes
// every parcel's position and colour (riverStage.fillParticles); this layer
// only rasterises them. Owns its program, VAO and buffer; the host's quad VAO
// is never touched (paint and step bind their own VAO every time).

import { buildProgram } from '../../../gl/glHost';
import { PARTICLE_VS, PARTICLE_FS } from './particleShaders';
import { FLOATS_PER_PARTICLE } from '../riverStage';

export function createParticleLayer(gl) {
  // First, so a failed build has allocated nothing else.
  const prog = buildProgram(gl, PARTICLE_VS, PARTICLE_FS, { label: 'ocean:particles' });
  const uSize = gl.getUniformLocation(prog, 'uSize');
  const vao = gl.createVertexArray();
  const buf = gl.createBuffer();
  const stride = FLOATS_PER_PARTICLE * 4;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 8);
  gl.bindVertexArray(null);
  return {
    upload(data, count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * FLOATS_PER_PARTICLE), gl.DYNAMIC_DRAW);
    },
    draw(first, count, sizePx) {
      if (!(count > 0)) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniform1f(uSize, sizePx);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS, first, count);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
    },
  };
}
```

- [ ] **Step 4: Wire it into `LedgerOcean`**

`hudFormat.js`, after `export const RING_TAP_RADIUS_PX = 6; …` add:

```js
export const PARTICLE_PX = 2;                   // river-stage parcel size, css px
export const FLARE_PX = 7;                      // the seal flare, css px
```

`LedgerOcean.jsx`:
1. Imports — add after the `oceanGpu` import:

```js
import { createParticleLayer } from '../../../ledger/ocean/gpu/particleLayer';
import {
  prepareRiver, fillParticles, PARTICLES_PER_RIVER, FLOATS_PER_PARTICLE,
} from '../../../ledger/ocean/riverStage';
```

and add `PARTICLE_PX,` to the `./hudFormat` import list.
2. After `const dirtyRef = useRef(true);` add:

```js
  const particlesRef = useRef(null);
  const fillRef = useRef({ days: NaN, rivers: null, n: 0 });
```

3. After `sourceDataRef.current = sourceData;` add:

```js
  // River stage: one prepared river per source with a course to walk.
  const riverBuf = useMemo(() => {
    const rivers = sources.map((s) => prepareRiver(s)).filter(Boolean);
    return { rivers, buf: new Float32Array((rivers.length * PARTICLES_PER_RIVER + 1) * FLOATS_PER_PARTICLE) };
  }, [sources]);
  const riverBufRef = useRef(riverBuf);
  riverBufRef.current = riverBuf;
```

4. Before `const { hostRef } = useShaderCanvas(canvasRef, {` add:

```js
  // River stage (spec §3): PARTICLES_PER_RIVER parcels per river, positions and
  // colours from the exact kinetics, drawn as GL points over the composite.
  // Re-filled only when the simulated day or the river set changes, so a
  // 360 Hz display redraws the same buffer between steps.
  const drawParticles = (gl) => {
    const layer = particlesRef.current;
    const driver = driverRef.current;
    if (!layer || !driver) return;
    const { rivers, buf } = riverBufRef.current;
    const days = driver.simDays();
    const fill = fillRef.current;
    if (days !== fill.days || rivers !== fill.rivers) {
      const n = fillParticles(rivers, days, buf);
      layer.upload(buf, n);
      fillRef.current = { days, rivers, n };
    }
    const scale = gl.canvas.width / Math.max(1, sizeRef.current.width);
    layer.draw(0, fillRef.current.n, PARTICLE_PX * scale);
  };
```

5. In `onInit`, after `texRef.current = { static: sim.staticTexture(), zero: null };` add:

```js
        fillRef.current = { days: NaN, rivers: null, n: 0 };
        try {
          particlesRef.current = createParticleLayer(gl);
        } catch (err) {
          // The river stage draws over the ocean; without it the sim runs on.
          console.error(err);
          particlesRef.current = null;
        }
```

6. In `onDispose`, make the first two lines of the body:

```js
      particlesRef.current?.dispose();
      particlesRef.current = null;
```

7. In `draw`, replace

```js
      if (paintNow) {
        paint(host, world.grid, texRef.current, sim, tsec);
        dirtyRef.current = false;
      }
```

with

```js
      if (paintNow) {
        paint(host, world.grid, texRef.current, sim, tsec);
        drawParticles(host.gl);
        dirtyRef.current = false;
      }
```

- [ ] **Step 5: Extend the shader gate**

In `scripts/oceanShaders.mjs`, add `import { PARTICLE_VS, PARTICLE_FS } from '../src/terminal/ledger/ocean/gpu/particleShaders.js';` after the `shaders.js` import, and change `const programs = { composite: [SIM_VS, COMPOSITE_FS] };` to `const programs = { composite: [SIM_VS, COMPOSITE_FS], particles: [PARTICLE_VS, PARTICLE_FS] };`. Update the header comment's first line to `// Compiles and links every Ledger ocean program (sim, composite, river parcels) in real headless Chrome`.

- [ ] **Step 6: Run**

Run: `npx vitest run src/terminal/ledger/ocean/ src/terminal/views/ledger/ocean/ src/terminal/gl/`
Expected: PASS, GL snapshots unchanged.
Run: `node scripts/oceanShaders.mjs`
Expected: exit 0; the JSON has `"particles": { "ok": true, … }`.

- [ ] **Step 7: Mutation checks**

1. `fillParticles(rivers, 0, buf)` in `drawParticles` → the parcel-content test fails.
2. Drop the `days !== fill.days || rivers !== fill.rivers` guard (fill every frame) → re-fill test fails.
3. Remove the `try`/`catch` around `createParticleLayer` → the build-failure test fails (host throws → `OCEAN UNAVAILABLE`).
4. Remove `particlesRef.current?.dispose();` → unmount test fails.
5. `particleLayer.draw`: remove `if (!(count > 0)) return;` → the zero-count assertion fails.
6. `vertexAttribPointer(1, 4, …, stride, 0)` → layout test fails.
7. `PARTICLE_FS`: `outColor = vColour;` → `node scripts/oceanShaders.mjs` exits 1.
8. `PARTICLE_PX * scale` → `PARTICLE_PX * 2`: the uSize test fails. (DPR scaling itself cannot be distinguished in jsdom, where devicePixelRatio is 1; the phone screenshots at 3× in Task 11 are its check. Record this.)

- [ ] **Step 8: Commit**

```bash
git add src/terminal/ledger/ocean/gpu/particleShaders.js src/terminal/ledger/ocean/gpu/particleLayer.js src/terminal/gl/__tests__/recordingGL.js src/terminal/views/ledger/ocean/hudFormat.js src/terminal/views/ledger/ocean/LedgerOcean.jsx scripts/oceanShaders.mjs src/terminal/ledger/ocean/__tests__/particleLayer.test.js src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx
git commit -m "feat(ledger-ocean): river-stage parcels as GL points over the composite, 256 per river

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The DO_MIN tick on every course

**Files:**
- Modify: `src/terminal/views/ledger/ocean/hudFormat.js` (`describeSites`, `tooltipLines`)
- Modify: `src/terminal/views/ledger/ocean/OceanHud.jsx`
- Test: `src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js`, `OceanHud.test.jsx`, `LedgerOcean.test.jsx`

**Interfaces:**
- Consumes: `cumulativeKm`, `courseTick` (Task 2); `source.critical.courseKm`.
- Produces: each described site gains `course` and `tick: { lon, lat, angleDeg } | null`. `OceanHud` renders one `span[data-hud="domin-tick"][data-tick=<id>]` per site with a tick. `tooltipLines` prints `DO_MIN — mg/L @ rkm —` when `doMin` or `rkm` is not finite.

- [ ] **Step 1: Write the failing tests**

`hudFormat.test.js` — add `import { cumulativeKm, courseTick } from '../../../../ledger/ocean/riverStage';` and, inside `describe('sites', …)`:

```js
  it('places each DO_MIN tick at the critical point along the drawn course', () => {
    for (const s of [...world.sources, ...userSrc]) {
      const d = sites.find((x) => x.id === s.id);
      expect(d.course).toBe(s.course);
      expect(d.tick).toEqual(courseTick(s.course, cumulativeKm(s.course), s.critical.courseKm));
      expect(d.tick).not.toBeNull();
    }
  });

  it('prints a dash, not NaN, when the DO minimum is unknown', () => {
    const lines = tooltipLines({
      id: 'x', kind: 'verdict', name: 'Z', status: 'APPROVED', color: '#22c55e',
      site: [0, 0], snap: [0, 0], snapKm: 1, dischargeM3s: 1, doMin: NaN, rkm: NaN,
    });
    expect(lines[3]).toBe('DO_MIN — mg/L @ rkm —');
  });
```

`OceanHud.test.jsx` — append inside `describe('OceanHud', …)`:

```js
  it('draws a DO_MIN tick across the course where a site has one', () => {
    const withTick = [{ ...SITES[1], tick: { lon: 0, lat: 0, angleDeg: -90 } }, SITES[0]];
    const { container } = hud({ sites: withTick });
    const ticks = container.querySelectorAll('[data-hud="domin-tick"]');
    expect(ticks).toHaveLength(1);
    expect(ticks[0].getAttribute('data-tick')).toBe('h1');
    expect(ticks[0].style.left).toBe('50%');
    expect(ticks[0].style.top).toBe('50%');
    expect(ticks[0].style.transform).toBe('translate(-50%, -50%) rotate(-90deg)');
    expect(ticks[0].style.height).toBe('7px');
    expect(ticks[0].getAttribute('aria-hidden')).toBe('true');
  });
```

`LedgerOcean.test.jsx` — add `describeSites` to the `../hudFormat` import, `import { verdictSources } from '../../../../ledger/ocean/sources';`, and append inside `describe('LedgerOcean HUD integration', …)`:

```js
  it('ticks the DO minimum on every drawn course', () => {
    const m = mountLive(<LedgerOcean width={1024} height={512} verdicts={[V]} />);
    const { grid, mask, sources } = getOceanWorld();
    const expected = describeSites([...sources, ...verdictSources([V], grid, mask)], [V]).filter((s) => s.tick);
    expect(expected.length).toBeGreaterThanOrEqual(10);
    expect(m.container.querySelectorAll('[data-hud="domin-tick"]')).toHaveLength(expected.length);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/views/ledger/ocean/`
Expected: FAIL — `d.course` undefined, no tick elements, `DO_MIN NaN`.

- [ ] **Step 3: Implement**

`hudFormat.js`: add `import { cumulativeKm, courseTick } from '../../../ledger/ocean/riverStage';` and in `describeSites` replace the `base` object with:

```js
    const base = {
      id: s.id, kind: s.kind, site, snap, course: s.course,
      tick: courseTick(s.course, cumulativeKm(s.course), s.critical.courseKm),
      dischargeM3s: s.dischargeM3s, doMin: s.critical.doMin, rkm: s.critical.rkm,
    };
```

In `tooltipLines`, replace the line `` `DO_MIN ${site.doMin.toFixed(1)} mg/L @ rkm ${Math.round(site.rkm)}`, `` with:

```js
    Number.isFinite(site.doMin) && Number.isFinite(site.rkm)
      ? `DO_MIN ${site.doMin.toFixed(1)} mg/L @ rkm ${Math.round(site.rkm)}`
      : 'DO_MIN — mg/L @ rkm —',
```

`OceanHud.jsx`: add constants after `const TIP_MARGIN_PX = 4;`:

```js
const TICK_PX = 7;
const TICK_PX_COMPACT = 5;
```

Insert between the closing `</svg>` and `{sites.map((s) => {`:

```jsx
      {sites.filter((s) => s.tick).map((s) => {
        const { left, top } = lonLatToPct(s.tick.lon, s.tick.lat);
        return (
          <span
            key={`tick:${s.id}`}
            data-hud="domin-tick"
            data-tick={s.id}
            aria-hidden="true"
            style={{
              position: 'absolute', left: `${left}%`, top: `${top}%`,
              width: 1, height: compact ? TICK_PX_COMPACT : TICK_PX, background: s.color, opacity: 0.9,
              transform: `translate(-50%, -50%) rotate(${s.tick.angleDeg}deg)`, pointerEvents: 'none',
            }}
          />
        );
      })}
```

- [ ] **Step 4: Run**

Run: `npx vitest run src/terminal/views/ledger/ocean/`
Expected: PASS.

- [ ] **Step 5: Mutation checks**

1. `courseTick(…, s.critical.kmFromSite)` in `describeSites` → the placement test fails for the Danube (its polyline is shorter than `riverKm`).
2. Render ticks for every site (drop `.filter((s) => s.tick)` and guard inside with `s.tick?.lon ?? 0`) → the one-tick HUD test fails.
3. `rotate(${-s.tick.angleDeg}deg)` → transform test fails.
4. Remove the `Number.isFinite` guard → NaN test fails.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/ledger/ocean/hudFormat.js src/terminal/views/ledger/ocean/OceanHud.jsx src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js src/terminal/views/ledger/ocean/__tests__/OceanHud.test.jsx src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx
git commit -m "feat(ledger-ocean): DO_MIN tick across every course at its critical point

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Reduced motion — frames on demand; the warm-up waits for the archive

Fixes two 3a deferrals: the reduced-motion loop keeps firing rAF (360 Hz on the user's panel) after the ocean is held; and an archive that loads after mount resets the warm-up, so the held clock can read up to `T+ 400 d`.

**Files:**
- Modify: `src/terminal/views/ledger/ocean/LedgerOcean.jsx`
- Modify: `src/terminal/views/LedgerTab.jsx`
- Test: `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx`, `src/terminal/views/__tests__/LedgerTab.test.jsx`

**Interfaces:**
- Consumes: `useShaderCanvas` option `haltOnReducedMotion` (when `true` and reduced motion, the loop never starts; `initialDraw` still runs once at `now = 0`); `hostRef.current = { gl, prog, U, vao, resize, dispose }`.
- Produces: `LedgerOcean` prop `sourcesReady = true`. Internal `requestFrame()` (no-op unless reduced motion; at most one pending rAF). `LedgerTab` passes `sourcesReady={verdictsLoaded}`, true once `getAllVerdicts()` has settled (in the same render as the loaded verdicts).

- [ ] **Step 1: Write the failing tests**

Append inside `describe('LedgerOcean HUD integration', …)` in `LedgerOcean.test.jsx` (after `V` and `oceanCanvas` exist):

```js
  it('stops asking for frames once the reduced-motion ocean is settled', () => {
    reduceMotion();
    const days = [];
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={(d) => days.push(d)} />);
    m.frames(WARM_FRAMES + 5);
    expect(days.at(-1)).toBeCloseTo(REDUCED_MOTION_DAYS, 9);
    expect(days).toHaveLength(WARM_FRAMES);          // mount chunk + one frame per remaining chunk, no idling
    m.frames(30);
    expect(days).toHaveLength(WARM_FRAMES);
  });

  it('probes a held reduced-motion ocean on demand', () => {
    reduceMotion();
    const m = mountLive(<LedgerOcean width={1024} height={512} />);
    m.frames(WARM_FRAMES + 2);
    rec.gl.readPixels = (...a) => { rec.log.push(['readPixels', ...a.slice(0, 6)]); a[6].set([0.02, 0.14, 0.8, 0.3]); };
    act(() => { fireEvent.pointerMove(oceanCanvas(), { pointerType: 'mouse', clientX: 256, clientY: 128 }); });
    m.frames(1);
    expect(count('readPixels')).toBe(1);
    expect(screen.getByText(/ΔT 0\.02 °C/)).toBeTruthy();
  });

  it('holds the reduced-motion warm-up until the archive has loaded, then warms once', () => {
    reduceMotion();
    const days = [];
    const onFrame = (d) => days.push(d);
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={onFrame} sourcesReady={false} />);
    m.frames(10);
    expect(days.every((d) => d === 0)).toBe(true);
    expect(paints()).toBe(0);
    m.rerender(<LedgerOcean width={512} height={256} onFrame={onFrame} sourcesReady verdicts={[V]} />);
    m.frames(WARM_FRAMES + 2);
    expect(days.at(-1)).toBeCloseTo(REDUCED_MOTION_DAYS, 9);   // T+ 200 d with the archive, not 400
    expect(paints()).toBe(1);
  });
```

In `LedgerTab.test.jsx`, add `import { getAllVerdicts } from '../../ledger/verdictStore';` and append inside the `describe`:

```js
  it('marks the ocean sources ready only together with the loaded archive', async () => {
    const V0 = { hash: 'h-old', status: 'APPROVED', coordinates: { lat: 31.3, lon: 120.6 }, input: h.INPUT };
    getAllVerdicts.mockResolvedValueOnce([V0]);
    render(<LedgerTab />);
    await waitFor(() => expect(h.oceanProps.at(-1).sourcesReady).toBe(true));
    for (const p of h.oceanProps) if (p.sourcesReady) expect(p.verdicts).toEqual([V0]);
    expect(h.oceanProps.some((p) => p.sourcesReady === false)).toBe(true);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx src/terminal/views/__tests__/LedgerTab.test.jsx`
Expected: FAIL — `days` keeps growing after warm-up (idle loop); warm-up starts before `sourcesReady` and ends at 400 d; `sourcesReady` undefined in LedgerTab.

- [ ] **Step 3: Implement in `LedgerOcean.jsx`**

1. Add `sourcesReady = true,` to the props (after `latestHash = null,`).
2. After `const fillRef = …` (Task 4) add:

```js
  const rafRef = useRef(0);
  const drawRef = useRef(null);
  const requestFrameRef = useRef(() => {});
  const readyRef = useRef(sourcesReady);
  readyRef.current = sourcesReady;
```

3. Replace everything from `const readProbe = (now, sim) => {` through the closing `});` of the `useShaderCanvas(...)` call with:

```js
  const readProbe = (now, sim) => {
    const p = probeRef.current;
    if (!p) return;
    // Throttled. A held reduced-motion ocean has no loop, so ask for the frame
    // that will read it (a no-op while the loop runs).
    if (now - probeAtRef.current < PROBE_INTERVAL_MS) {
      requestFrameRef.current();
      return;
    }
    probeAtRef.current = now;
    const land = !!world.mask.land[p.k];
    const v = land || !sim ? null : sim.readCell(p.i, p.j);
    hudRef.current?.setProbe(formatProbe(p.lon, p.lat, v, land));
  };

  // River stage (spec §3): PARTICLES_PER_RIVER parcels per river, positions and
  // colours from the exact kinetics, drawn as GL points over the composite.
  // Re-filled only when the simulated day or the river set changes, so a
  // 360 Hz display redraws the same buffer between steps.
  const drawParticles = (gl) => {
    const layer = particlesRef.current;
    const driver = driverRef.current;
    if (!layer || !driver) return;
    const { rivers, buf } = riverBufRef.current;
    const days = driver.simDays();
    const fill = fillRef.current;
    if (days !== fill.days || rivers !== fill.rivers) {
      const n = fillParticles(rivers, days, buf);
      layer.upload(buf, n);
      fillRef.current = { days, rivers, n };
    }
    const scale = gl.canvas.width / Math.max(1, sizeRef.current.width);
    layer.draw(0, fillRef.current.n, PARTICLE_PX * scale);
  };

  const draw = (host, { now, dt, tsec, hidden, reducedMotion: rm }) => {
    if (lostRef.current) return;
    const sim = simRef.current;
    const driver = driverRef.current;
    if (sim && uploadedRef.current !== sourceDataRef.current) {
      sim.setSources(sourceDataRef.current);
      uploadedRef.current = sourceDataRef.current;
      if (rm) {
        driver.resetWarmup();
        warmRef.current = false;
      }
    }
    let paintNow = true;
    if (rm) {
      if (driver && !warmRef.current) {
        // The warm-up waits for the archive (sourcesReady), so the held clock
        // reads one warm-up with every source in it; then it chains frames.
        if (readyRef.current) {
          warmRef.current = driver.warmupChunk(REDUCED_MOTION_DAYS);
          if (!warmRef.current) requestFrameRef.current();
        }
        paintNow = warmRef.current;
      } else {
        paintNow = dirtyRef.current;
      }
    } else if (driver && !hidden) {
      driver.advance(dt, dpsRef.current);
    }
    readProbe(now, sim);
    if (paintNow) {
      paint(host, world.grid, texRef.current, sim, tsec);
      drawParticles(host.gl);
      dirtyRef.current = false;
    }
    const simDays = driver ? driver.simDays() : 0;
    hudRef.current?.setFrame({ simDays, frameMs: driver ? driver.frameMs() : 0, now });
    onFrameRef.current?.(simDays);
  };
  drawRef.current = draw;

  const { hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    strategy: 'lunar',
    vs: SIM_VS,
    fs: COMPOSITE_FS,
    uniforms: COMPOSITE_UNIFORMS,
    pixelSize: { w: width, h: height },
    setStyleSize: true,
    blend: 'none',
    contextOptions: CONTEXT_OPTIONS,
    label: 'LedgerOcean',
    trackVisibility: true,
    // Reduced motion: no running loop. The mount draw starts the warm-up and
    // requestFrame chains it; after that frames come only on demand (resize,
    // new source, ghost, probe, archive ready), so a held ocean costs nothing.
    haltOnReducedMotion: true,
    onInit: (gl, { vao }) => {
      const { grid } = world;
      lostRef.current = false;
      warmRef.current = false;
      dirtyRef.current = true;
      let sim = null;
      let failed = false;
      try {
        sim = createOceanGpu(gl, { grid, staticData: world.staticData, rowData: world.rowData, vao });
      } catch (err) {
        // createOceanGpu has released everything it built; the host itself
        // (display program + quad) is fine, so draw the static coastline.
        console.error(err);
        failed = true;
      }
      if (sim) {
        sim.setSources(sourceDataRef.current);
        uploadedRef.current = sourceDataRef.current;
        simRef.current = sim;
        driverRef.current = createOceanDriver({ clock: createStepClock(), step: () => sim.step() });
        texRef.current = { static: sim.staticTexture(), zero: null };
        fillRef.current = { days: NaN, rivers: null, n: 0 };
        try {
          particlesRef.current = createParticleLayer(gl);
        } catch (err) {
          // The river stage draws over the ocean; without it the sim runs on.
          console.error(err);
          particlesRef.current = null;
        }
      } else {
        texRef.current = {
          static: createFloatTexture(gl, grid.nx, grid.ny, world.staticData),
          zero: createFloatTexture(gl, grid.nx, grid.ny, new Float32Array(grid.n * 4)),
        };
        setMode(failed ? 'static-shader' : 'static');
      }
    },
    onDispose: (gl) => {
      particlesRef.current?.dispose();
      particlesRef.current = null;
      simRef.current?.dispose();
      if (texRef.current?.zero) {
        gl.deleteTexture(texRef.current.zero);
        gl.deleteTexture(texRef.current.static);
      }
      simRef.current = null;
      driverRef.current = null;
      texRef.current = null;
      uploadedRef.current = null;
    },
    draw,
    onUnsupported: () => setMode('unsupported'),
    deps: [generation],
  });

  // One frame on demand under reduced motion (at most one pending); a no-op
  // while the loop runs.
  const requestFrame = useCallback(() => {
    if (!reducedMotion || rafRef.current) return;
    rafRef.current = requestAnimationFrame((t) => {
      rafRef.current = 0;
      const host = hostRef.current;
      if (host) drawRef.current(host, { now: t, dt: 0, tsec: t / 1000, hidden: document.hidden, reducedMotion: true });
    });
  }, [reducedMotion, hostRef]);
  requestFrameRef.current = requestFrame;

  useEffect(() => {
    const raf = rafRef; // alias: no ref-in-cleanup lint warning (count must stay ≤ 137)
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, []);

  // A new source set, or the archive arriving, needs a frame under reduced motion.
  useEffect(() => {
    requestFrameRef.current();
  }, [sourceData, sourcesReady]);
```

4. In the resize effect, after `dirtyRef.current = true;` add `requestFrameRef.current();`.
5. In `onPointerMove`, replace `if (!probeAt(e.clientX, e.clientY)) clearProbe();` with:

```js
    if (!probeAt(e.clientX, e.clientY)) clearProbe();
    else requestFrameRef.current();
```

6. In `onPointerUp`, after `if (!probeAt(e.clientX, e.clientY)) return;` add `requestFrameRef.current();`.
7. Update the header comment's reduced-motion bullet to: `// - Reduced motion: no running loop. The warm-up (800 steps, 16 per frame) starts once sourcesReady and chains its own frames; then one frame is held and repainted only on demand (resize, new source, ghost), never idled.`

- [ ] **Step 4: Implement in `LedgerTab.jsx`**

After `const [verdicts, setVerdicts] = useState([]);` add `const [verdictsLoaded, setVerdictsLoaded] = useState(false);`, replace `getAllVerdicts().then(setVerdicts);` with:

```js
    // The ocean's reduced-motion warm-up waits for this, so it runs once with
    // the archive in it. The verdicts land before `ready`, so any render with
    // sourcesReady true already carries the archive.
    getAllVerdicts().then(setVerdicts).finally(() => setVerdictsLoaded(true));
```

and add `sourcesReady={verdictsLoaded}` to the `<LedgerOcean …>` props.

- [ ] **Step 5: Run**

Run: `npx vitest run src/terminal/views/`
Expected: PASS (including the 3a reduced-motion tests: spread warm-up, resize repaint, re-settle on a new verdict).

- [ ] **Step 6: Mutation checks**

1. `haltOnReducedMotion: false` → "stops asking for frames" fails.
2. Drop the `if (readyRef.current)` gate (always warm) → "holds the warm-up" fails.
3. Remove `requestFrameRef.current()` from `onPointerMove` → the on-demand probe test fails.
4. Remove it from the resize effect → the 3a "repaints a held reduced-motion frame once after a resize" test fails.
5. Remove the `[sourceData, sourcesReady]` effect → "re-settles … when a verdict adds a source" and "holds the warm-up" fail.
6. `LedgerTab`: call `setVerdictsLoaded(true)` synchronously in the effect instead of after the load → the LedgerTab test fails.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/ledger/ocean/LedgerOcean.jsx src/terminal/views/LedgerTab.jsx src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx src/terminal/views/__tests__/LedgerTab.test.jsx
git commit -m "fix(ledger-ocean): reduced motion draws on demand, never idles; warm-up waits for the archive

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The ghost in the ocean — row-band source updates, dashed PROVISIONAL site

**HARD REQUIREMENT (3a final review):** the ghost must not go through `verdicts` → `sources` → `sourceData`. It is written into the source texture by row bands; ghost edits never reset the reduced-motion warm-up and never re-upload the full texture.

**Files:**
- Modify (append): `src/terminal/gl/pingPong.js`
- Modify (append line): `src/terminal/gl/__tests__/recordingGL.js`
- Modify: `src/terminal/ledger/ocean/gpu/oceanGpu.js` (import line + `setSourceRows`)
- Modify: `src/terminal/ledger/ocean/gpu/gpuData.js` (append)
- Modify: `src/terminal/views/ledger/ocean/hudFormat.js`, `OceanHud.jsx`, `LedgerOcean.jsx`
- Test: `src/terminal/gl/__tests__/pingPong.test.js`, `src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`, `src/terminal/ledger/ocean/__tests__/gpuData.test.js`, `src/terminal/views/ledger/ocean/__tests__/{hudFormat.test.js,OceanHud.test.jsx,LedgerOcean.test.jsx}`

**Interfaces:**
- Consumes: `ghostSourceSpec(params)` (phase 1: `lat`, `lon`, the seven kernel fields, `siteName`), `buildSource`, `packSources`, `SPLAT_SIGMA_CELLS`, `requestFrameRef` (Task 6), `prepareRiver`/`GHOST_ALPHA` (Task 2).
- Produces:
  - `uploadFloatRows(gl, tex, w, y, h, data)` → `bindTexture` + `texSubImage2D(TEXTURE_2D, 0, 0, y, w, h, RGBA, FLOAT, data)`.
  - `oceanGpu.setSourceRows(j0, rows, data)` (writes rows `j0 … j0+rows−1` of the source texture).
  - `sourceRowBands(grid, ...cellLists) → [[j0, rows], …]` (contiguous row runs touched by any list, ascending); `packSourceRows(grid, land, base, extra, j0, rows) → Float32Array(rows × nx × 4)` = `base` rows + Σ `conc · f` of `extra` sources in those rows.
  - `hudFormat.js`: `GHOST_COLOR = '#cbd5e1'`, `GHOST_DASH = '4 3'`, `GHOST_LABEL = 'PROVISIONAL'`; `describeSites(sources, verdicts = [], ghostParams = null)` describes `kind: 'ghost'` (name `ghostParams.siteName || 'PROVISIONAL SITE'`, `status: null`, `color: GHOST_COLOR`, `snapKm` from the site); `tooltipLines` second line `PROVISIONAL` for the ghost, Q line with `% OF MISSISSIPPI`.
  - `LedgerOcean` prop `ghost = null` (draft params). HUD: ring `[data-site="ghost"]` with a dashed border, `line[data-line="ghost"]` with `stroke-dasharray="4 3"`, `span[data-hud="ghost-label"]` = `PROVISIONAL`. Every snap line carries `data-line=<id>`.

- [ ] **Step 1: Write the failing tests (plumbing)**

Add a new line `  'texSubImage2D',` to `V1_METHODS` in `recordingGL.js`, directly after the line `  'deleteFramebuffer',`.

`pingPong.test.js` — add `uploadFloatRows` to the import and append:

```js
describe('uploadFloatRows', () => {
  it('writes whole rows y..y+h-1 of a float texture in place', () => {
    const gl = withFloat();
    const tex = { __tag: 'texture:t' };
    const data = new Float32Array(4 * 2 * 4).fill(1);
    uploadFloatRows(gl, tex, 4, 3, 2, data);
    expect(gl.__log).toEqual([
      ['bindTexture', gl.TEXTURE_2D, 'texture:t'],
      ['texSubImage2D', gl.TEXTURE_2D, 0, 0, 3, 4, 2, gl.RGBA, gl.FLOAT, Array.from(data)],
    ]);
  });
});
```

`oceanGpu.test.js` — append inside `describe('createOceanGpu', …)`:

```js
  it('writes source rows into the same texture setSources fills, without a full upload', () => {
    const gl = withFloat();
    const gpu = make(gl);
    gpu.setSources(new Float32Array(grid.n * 4));
    const srcTex = gl.__log.filter((e) => e[0] === 'bindTexture').at(-1)[2];
    const mark = gl.__log.length;
    const rows = new Float32Array(grid.nx * 2 * 4).fill(2);
    gpu.setSourceRows(1, 2, rows);
    const tail = gl.__log.slice(mark);
    expect(tail).toEqual([
      ['bindTexture', gl.TEXTURE_2D, srcTex],
      ['texSubImage2D', gl.TEXTURE_2D, 0, 0, 1, grid.nx, 2, gl.RGBA, gl.FLOAT, Array.from(rows)],
    ]);
  });
```

`gpuData.test.js` — add `packSourceRows, sourceRowBands` to the `../gpu/gpuData` import and append:

```js
describe('ghost row bands', () => {
  const at = (i, j) => grid.idx(i, j);
  const perm = { cells: [{ k: at(3, 5), f: 0.25 }, { k: at(9, 20), f: 0.5 }], conc: [1, 2, 3, 4] };
  const ghostA = { cells: [{ k: at(10, 6), f: 0.125 }, { k: at(11, 7), f: 0.5 }, { k: at(12, 9), f: 1 }], conc: [0.5, 1, 1.5, 2] };
  const ghostB = { cells: [{ k: at(30, 8), f: 0.75 }], conc: [2, 2, 2, 2] };

  it('merges the rows two cell lists touch into ascending contiguous runs', () => {
    expect(sourceRowBands(grid, ghostA.cells, [])).toEqual([[6, 2], [9, 1]]);
    expect(sourceRowBands(grid, ghostA.cells, ghostB.cells)).toEqual([[6, 4]]);
    expect(sourceRowBands(grid, [], [])).toEqual([]);
  });

  it('rebuilds a row band exactly as packSources would with the ghost as the last source', () => {
    const base = packSources(grid, mask.land, [perm]);
    const full = packSources(grid, mask.land, [perm, ghostA]);
    for (const [j0, rows] of sourceRowBands(grid, ghostA.cells)) {
      const band = packSourceRows(grid, mask.land, base, [ghostA], j0, rows);
      expect(band).toEqual(full.slice(j0 * grid.nx * 4, (j0 + rows) * grid.nx * 4));
    }
    // No ghost: the band is the permanent rows, untouched.
    expect(packSourceRows(grid, mask.land, base, [], 5, 1)).toEqual(base.slice(5 * grid.nx * 4, 6 * grid.nx * 4));
  });
});
```

(`gpuData.test.js` already has `grid` and `mask` from `syntheticWorld()`; cell (10, 6)… (30, 8) are ocean there — the island is i 40..44, j 14..17.)

- [ ] **Step 2: Implement the plumbing**

Append to `pingPong.js`:

```js

// Whole rows y..y+h-1 of a w-wide float texture, in place (texSubImage2D).
// The ghost source uses this so a form edit rewrites ~11 rows, not the whole
// 2 MB source texture.
export function uploadFloatRows(gl, tex, w, y, h, data) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, w, h, gl.RGBA, gl.FLOAT, data);
}
```

`oceanGpu.js`: change the pingPong import's second line from `  disposeTarget, readTarget, readTexel, uploadFloatTexture,` to `  disposeTarget, readTarget, readTexel, uploadFloatTexture, uploadFloatRows,`, and after the `setSources(data) { … },` method add:

```js
    // Rows j0..j0+rows-1 of the source texture (the ghost's row bands).
    setSourceRows(j0, rows, data) {
      uploadFloatRows(gl, sourcesTex, nx, j0, rows, data);
    },
```

Append to `gpuData.js`:

```js

// Contiguous row runs [j0, rows], ascending, covering every row that any of
// the cell lists touches (the ghost's old and new splats).
export function sourceRowBands(grid, ...cellLists) {
  const touched = new Set();
  for (const cells of cellLists) for (const { k } of cells) touched.add(Math.floor(k / grid.nx));
  const out = [];
  for (const j of [...touched].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[0] + last[1] === j) last[1]++;
    else out.push([j, 1]);
  }
  return out;
}

// Rows j0..j0+rows-1 of `base` (a packSources array of the permanent sources)
// plus Σ conc·f of the `extra` sources in those rows — identical, bit for bit,
// to packSources([...permanent, ...extra]) over the same rows.
export function packSourceRows(grid, land, base, extra, j0, rows) {
  const { nx } = grid;
  const out = base.slice(j0 * nx * 4, (j0 + rows) * nx * 4);
  for (const src of extra) {
    for (const { k, f } of src.cells) {
      const j = Math.floor(k / nx);
      if (j < j0 || j >= j0 + rows || land[k]) continue;
      const o = (k - j0 * nx) * 4;
      for (let c = 0; c < 4; c++) out[o + c] += src.conc[c] * f;
    }
  }
  return out;
}
```

Run: `npx vitest run src/terminal/gl/__tests__/pingPong.test.js src/terminal/ledger/ocean/__tests__/oceanGpu.test.js src/terminal/ledger/ocean/__tests__/gpuData.test.js`
Expected: PASS.

- [ ] **Step 3: Write the failing tests (view)**

`hudFormat.test.js` — add `GHOST_COLOR, GHOST_LABEL` to the `../hudFormat` import, `ghostSourceSpec, buildSource` to the sources import, and append inside `describe('sites', …)`:

```js
  it('describes the ghost as a provisional user site', () => {
    const G = { ...V.input, lat: 30.59, lon: 114.3, siteName: 'Ghost site' };
    const g = buildSource(ghostSourceSpec(G), world.grid, world.mask);
    const [d] = describeSites([g], [], G);
    expect(d).toMatchObject({ id: 'ghost', kind: 'ghost', name: 'Ghost site', status: null, color: GHOST_COLOR, dischargeM3s: 42 });
    expect(d.snapKm).toBeCloseTo(haversineKm([114.3, 30.59], d.snap), 9);
    expect(describeSites([g], [], { ...G, siteName: '' })[0].name).toBe('PROVISIONAL SITE');
    const lines = tooltipLines(d);
    expect(lines[1]).toBe(GHOST_LABEL);
    expect(lines[2]).toBe('Q 42 m³/s · 0.25% OF MISSISSIPPI');
  });
```

`OceanHud.test.jsx` — add `GHOST_COLOR` to the `../hudFormat` import and append:

```js
  it('draws the ghost dashed and labelled PROVISIONAL; sealed lines stay solid', () => {
    const ghost = { id: 'ghost', kind: 'ghost', name: 'Ghost site', status: null, color: GHOST_COLOR,
      site: [114.3, 30.59], snap: [121.5, 30.5], snapKm: 700, dischargeM3s: 42, doMin: 3, rkm: 0 };
    const { container, q } = hud({ sites: [...SITES, ghost] });
    expect(q('ghost-label').textContent).toBe('PROVISIONAL');
    expect(container.querySelector('[data-site="ghost"] span').style.borderStyle).toBe('dashed');
    expect(container.querySelector('[data-site="h1"] span').style.borderStyle).toBe('solid');
    expect(container.querySelector('line[data-line="ghost"]').getAttribute('stroke-dasharray')).toBe('4 3');
    expect(container.querySelector('line[data-line="h1"]').getAttribute('stroke-dasharray')).toBeNull();
  });
```

`LedgerOcean.test.jsx` — add imports `import { buildSource, ghostSourceSpec, SPLAT_SIGMA_CELLS } from '../../../../ledger/ocean/sources';` (merge with the Task 5 `verdictSources` import) and `import { packSourceRows } from '../../../../ledger/ocean/gpu/gpuData';`, then append after the HUD-integration describe:

```js
const G = { lat: 30.59, lon: 114.3, siteName: 'Ghost site', temp: 20, do: 6, bod: 10, dt: 2, epi: 3, nitrate: 5, flow: 42 };
const subUploads = () => rec.log.filter((e) => e[0] === 'texSubImage2D');
const fullUploads = () => rec.log.filter((e) => e[0] === 'texImage2D' && e[4] === 512 && e[5] === 256).length;
const SPLAT_ROWS = 2 * Math.ceil(3 * SPLAT_SIGMA_CELLS) + 1;

describe('LedgerOcean ghost', () => {
  it('writes the ghost into the source texture by row bands, never by a full upload', () => {
    const m = mountLive(<LedgerOcean width={1024} height={512} />);
    m.frames(2);
    const full = fullUploads();
    const { grid, mask, ambientSourceData } = getOceanWorld();
    m.rerender(<LedgerOcean width={1024} height={512} ghost={G} />);
    m.frames(1);
    const first = subUploads();
    expect(first.length).toBeGreaterThan(0);
    const ghostSrc = buildSource(ghostSourceSpec(G), grid, mask);
    let rows = 0;
    for (const e of first) {
      const [, , level, x, y, w, h] = e;
      expect([level, x, w]).toEqual([0, 0, 512]);
      rows += h;
      expect(e[9]).toEqual(Array.from(packSourceRows(grid, mask.land, ambientSourceData, [ghostSrc], y, h)));
    }
    expect(rows).toBeLessThanOrEqual(SPLAT_ROWS);
    expect(fullUploads()).toBe(full);
    expect(m.container.querySelector('[data-site="ghost"]')).toBeTruthy();

    // Moving the ghost rewrites its old and new rows; clearing it restores the permanent rows.
    const moved = { ...G, lat: 22.3, lon: 113.9 };
    m.rerender(<LedgerOcean width={1024} height={512} ghost={moved} />);
    m.frames(1);
    const afterMove = subUploads().length;
    expect(afterMove).toBeGreaterThan(first.length);
    m.rerender(<LedgerOcean width={1024} height={512} ghost={null} />);
    m.frames(1);
    const cleared = subUploads().slice(afterMove);
    expect(cleared.length).toBeGreaterThan(0);
    for (const e of cleared) {
      const y = e[4];
      const h = e[6];
      expect(e[9]).toEqual(Array.from(ambientSourceData.slice(y * 512 * 4, (y + h) * 512 * 4)));
    }
    expect(fullUploads()).toBe(full);
    expect(m.container.querySelector('[data-site="ghost"]')).toBeNull();
  });

  it('never restarts a held reduced-motion warm-up', () => {
    reduceMotion();
    const days = [];
    const onFrame = (d) => days.push(d);
    const m = mountLive(<LedgerOcean width={1024} height={512} onFrame={onFrame} />);
    m.frames(WARM_FRAMES + 2);
    expect(paints()).toBe(1);
    const full = fullUploads();
    m.rerender(<LedgerOcean width={1024} height={512} onFrame={onFrame} ghost={G} />);
    m.frames(3);
    m.rerender(<LedgerOcean width={1024} height={512} onFrame={onFrame} ghost={{ ...G, bod: 30 }} />);
    m.frames(3);
    expect(days.at(-1)).toBeCloseTo(REDUCED_MOTION_DAYS, 9);
    expect(fullUploads()).toBe(full);
    expect(subUploads().length).toBeGreaterThan(0);
    expect(paints()).toBe(3);   // the held frame repaints once per ghost change (its parcels), no more
  });

  it('re-adds the ghost after a full upload of the permanent sources', () => {
    const m = mountLive(<LedgerOcean width={1024} height={512} ghost={G} />);
    m.frames(1);
    m.rerender(<LedgerOcean width={1024} height={512} ghost={G} verdicts={[V]} />);
    m.frames(1);
    const lastFull = rec.log.findLastIndex((e) => e[0] === 'texImage2D' && e[4] === 512 && e[5] === 256);
    const lastSub = rec.log.findLastIndex((e) => e[0] === 'texSubImage2D');
    expect(lastSub).toBeGreaterThan(lastFull);
  });
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `npx vitest run src/terminal/views/ledger/ocean/`
Expected: FAIL — no ghost ring/label, no `texSubImage2D`, `describeSites` treats the ghost as a verdict.

- [ ] **Step 5: Implement the HUD side**

`hudFormat.js` — after `export const PRESET_COLOR = '#14b8a6';` add:

```js
export const GHOST_COLOR = '#cbd5e1';
export const GHOST_DASH = '4 3';
export const GHOST_LABEL = 'PROVISIONAL';
```

Change `describeSites` to take `ghostParams` and describe the ghost — replace the signature line with `export function describeSites(sources, verdicts = [], ghostParams = null) {` and insert before `const v = byHash.get(s.id);`:

```js
    if (s.kind === 'ghost') {
      return {
        ...base,
        snapKm: haversineKm(site, snap),
        name: ghostParams?.siteName || 'PROVISIONAL SITE',
        status: null,
        color: GHOST_COLOR,
      };
    }
```

Update its comment's first line to `// Ring + tooltip data per built source (presets, verdicts, and the ghost). Snap distance: presets from the last`. In `tooltipLines`, replace the two `site.kind === 'preset' ? …` lines with:

```js
    site.kind === 'preset' ? 'AMBIENT PRESET' : site.kind === 'ghost' ? GHOST_LABEL : statusLabel(site.status),
    site.kind === 'preset' ? q : `${q} · ${pct}% OF MISSISSIPPI`,
```

`OceanHud.jsx` — add `GHOST_DASH, GHOST_LABEL,` to the `./hudFormat` import. Replace the `<svg>` children block (`{sites.filter((s) => s.kind === 'verdict' && …).map(…)}`) with:

```jsx
        {sites
          .filter((s) => (s.kind === 'verdict' || s.kind === 'ghost') && Math.abs(s.snap[0] - s.site[0]) <= 180)
          .map((s) => (
            <line
              key={s.id}
              data-line={s.id}
              x1={s.site[0] + 180} y1={90 - s.site[1]} x2={s.snap[0] + 180} y2={90 - s.snap[1]}
              stroke={s.color} strokeOpacity="0.6" strokeWidth="1" vectorEffect="non-scaling-stroke"
              strokeDasharray={s.kind === 'ghost' ? GHOST_DASH : undefined}
            />
          ))}
```

In the ring's inner `<span>`, replace `` border: `${latest ? 2 : 1.5}px solid ${s.color}`, `` with `` border: `${latest ? 2 : 1.5}px ${s.kind === 'ghost' ? 'dashed' : 'solid'} ${s.color}`, ``. After the rings' `})}` (before `<div style={{ position: 'absolute', left: 8, top: 6 }}>`) insert:

```jsx
      {sites.filter((s) => s.kind === 'ghost').map((s) => {
        const { left, top } = lonLatToPct(s.site[0], s.site[1]);
        return (
          <span
            key="ghost-label"
            data-hud="ghost-label"
            aria-hidden="true"
            style={{
              position: 'absolute', left: `calc(${left}% + ${ringPx / 2 + 3}px)`, top: `${top}%`,
              transform: 'translateY(-50%)', color: s.color, whiteSpace: 'nowrap', pointerEvents: 'none',
            }}
          >
            {GHOST_LABEL}
          </span>
        );
      })}
```

- [ ] **Step 6: Implement the ocean side (`LedgerOcean.jsx`)**

1. Props: add `ghost = null,` after `sourcesReady = true,`.
2. Imports: `import { verdictSources, buildSource, ghostSourceSpec } from '../../../ledger/ocean/sources';` (replacing the `verdictSources`-only import); `import { packSources, packSourceRows, sourceRowBands } from '../../../ledger/ocean/gpu/gpuData';`; add `GHOST_ALPHA,` to the `riverStage` import.
3. After `const uploadedRef = useRef(null);` add `const ghostUploadedRef = useRef(null);`.
4. After the `sourceData` memo add:

```js
  // The ghost (spec §3, §4 Form): the unsubmitted draft as a provisional
  // source. It never joins `sources`/`sourceData` — that path re-uploads the
  // whole 2 MB source texture and restarts a reduced-motion warm-up. `draw`
  // writes it into the source texture by row bands instead.
  const ghostSource = useMemo(
    () => (ghost ? buildSource(ghostSourceSpec(ghost), world.grid, world.mask) : null),
    [world, ghost],
  );
  const ghostRef = useRef(ghostSource);
  ghostRef.current = ghostSource;
```

5. Replace the `sites` memo with:

```js
  const sites = useMemo(
    () => describeSites(ghostSource ? [...sources, ghostSource] : sources, verdicts, ghost),
    [sources, verdicts, ghostSource, ghost],
  );
```

6. Replace the `riverBuf` memo with:

```js
  const riverBuf = useMemo(() => {
    const rivers = sources.map((s) => prepareRiver(s));
    if (ghostSource) rivers.push(prepareRiver(ghostSource, { alpha: GHOST_ALPHA }));
    const drawn = rivers.filter(Boolean);
    return { rivers: drawn, buf: new Float32Array((drawn.length * PARTICLES_PER_RIVER + 1) * FLOATS_PER_PARTICLE) };
  }, [sources, ghostSource]);
```

7. In `draw`, replace the source-upload block

```js
    if (sim && uploadedRef.current !== sourceDataRef.current) {
      sim.setSources(sourceDataRef.current);
      uploadedRef.current = sourceDataRef.current;
      if (rm) {
        driver.resetWarmup();
        warmRef.current = false;
      }
    }
```

with

```js
    if (sim && uploadedRef.current !== sourceDataRef.current) {
      sim.setSources(sourceDataRef.current);
      uploadedRef.current = sourceDataRef.current;
      ghostUploadedRef.current = null; // the full upload holds permanent sources only
      if (rm) {
        driver.resetWarmup();
        warmRef.current = false;
      }
    }
    // Ghost: rewrite only the rows its old and new splats touch (≤ 11 each),
    // from the permanent rows plus the new ghost. No warm-up reset.
    if (sim && ghostUploadedRef.current !== ghostRef.current) {
      const prev = ghostUploadedRef.current;
      const next = ghostRef.current;
      const extra = next ? [next] : [];
      for (const [j0, rows] of sourceRowBands(world.grid, prev ? prev.cells : [], next ? next.cells : [])) {
        sim.setSourceRows(j0, rows, packSourceRows(world.grid, world.mask.land, sourceDataRef.current, extra, j0, rows));
      }
      ghostUploadedRef.current = next;
    }
```

8. In `onInit`, after `uploadedRef.current = sourceDataRef.current;` add `ghostUploadedRef.current = null;`; in `onDispose`, after `uploadedRef.current = null;` add `ghostUploadedRef.current = null;`.
9. After the `[sourceData, sourcesReady]` effect add:

```js
  // A ghost change needs its band upload, and a held reduced-motion frame
  // repaints once to show its parcels.
  useEffect(() => {
    dirtyRef.current = true;
    requestFrameRef.current();
  }, [ghostSource]);
```

10. Header comment: add a bullet `// - Ghost: the form draft as a provisional source, written into the source texture by row bands (never a full upload, never a warm-up reset); dashed and labelled PROVISIONAL in the HUD.`

- [ ] **Step 7: Run**

Run: `npx vitest run src/terminal/views/ledger/ src/terminal/ledger/ocean/ src/terminal/gl/`
Expected: PASS; GL snapshots unchanged.

- [ ] **Step 8: Mutation checks**

1. Route the ghost through the permanent path: in the `sources` memo use `[...world.sources, ...userSources, ...(ghostSource ? [ghostSource] : [])]` and delete the band block → row-band test fails (full upload count grows) and the reduced-motion test fails (400 d).
2. Delete `ghostUploadedRef.current = null;` after `sim.setSources(...)` in `draw` → "re-adds the ghost after a full upload" fails.
3. `sourceRowBands(world.grid, next ? next.cells : [])` (forget the old rows) → the clear step fails (no upload when cleared).
4. `packSourceRows`: skip the `j < j0` check → the band-equality test fails.
5. `uploadFloatRows`: pass `(0, 0, …)` as offsets → pingPong and oceanGpu tests fail.
6. Remove the `[ghostSource]` effect → the reduced-motion test fails (no frame, no band upload).
7. `tooltipLines`: drop the ghost branch → the hudFormat ghost test fails (`UNKNOWN`).
8. OceanHud: always `'solid'` → the dashed test fails.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/gl/pingPong.js src/terminal/gl/__tests__/recordingGL.js src/terminal/gl/__tests__/pingPong.test.js src/terminal/ledger/ocean/gpu/oceanGpu.js src/terminal/ledger/ocean/gpu/gpuData.js src/terminal/ledger/ocean/__tests__/oceanGpu.test.js src/terminal/ledger/ocean/__tests__/gpuData.test.js src/terminal/views/ledger/ocean/hudFormat.js src/terminal/views/ledger/ocean/OceanHud.jsx src/terminal/views/ledger/ocean/LedgerOcean.jsx src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js src/terminal/views/ledger/ocean/__tests__/OceanHud.test.jsx src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx
git commit -m "feat(ledger-ocean): the PROVISIONAL ghost — row-band source updates, no full upload, no warm-up reset

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The form drives the ghost — `onDraftChange`, coalesced per frame

**Files:**
- Create: `src/terminal/views/ledger/draft.js`
- Modify: `src/terminal/views/ledger/SubmissionForm.jsx`, `src/terminal/views/LedgerTab.jsx`
- Test: `src/terminal/views/ledger/__tests__/draft.test.js` (new), `src/terminal/views/ledger/__tests__/SubmissionForm.test.jsx`, `src/terminal/views/__tests__/LedgerTab.test.jsx`

**Interfaces:**
- Consumes: `PARAM_RANGES`, `validateSubmission` (verdictModel, unchanged); `LedgerOcean` prop `ghost` (Task 7).
- Produces: `validDraft(form) → { lat, lon, siteName, temp, do, bod, dt, epi, nitrate, flow } (numbers) | null`; `createFrameCoalescer(fn, raf?, caf?) → { push(value), cancel() }` (calls `fn` once per animation frame with the latest value). `SubmissionForm` prop `onDraftChange(params)`, called after every render whose form is a valid draft; never for an invalid one (the ghost freezes). `LedgerTab` state `draft`; passes `ghost={view === 'submit' ? draft : null}`; clears the draft (and any pending frame) when switching to the archive view and when the verdict seals.

- [ ] **Step 1: Write the failing tests**

Create `src/terminal/views/ledger/__tests__/draft.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { validDraft, createFrameCoalescer } from '../draft';

const FORM = {
  lat: '48.31', lon: '14.29', siteName: 'Linz', temp: '12', do: '10.5', bod: '3', dt: '1.5',
  epi: '2.8', nitrate: '19', flow: '44', dependency: 'sovereign', notes: '',
};

describe('validDraft', () => {
  it('returns numeric params for a complete, in-range form', () => {
    expect(validDraft(FORM)).toEqual({
      lat: 48.31, lon: 14.29, siteName: 'Linz', temp: 12, do: 10.5, bod: 3, dt: 1.5, epi: 2.8, nitrate: 19, flow: 44,
    });
  });

  it('is null for a blank, non-numeric, out-of-range or off-globe field', () => {
    expect(validDraft({ ...FORM, bod: '' })).toBeNull();
    expect(validDraft({ ...FORM, lat: '' })).toBeNull();
    expect(validDraft({ ...FORM, flow: 'abc' })).toBeNull();
    expect(validDraft({ ...FORM, bod: '500' })).toBeNull();
    expect(validDraft({ ...FORM, lat: '95' })).toBeNull();
    expect(validDraft({ ...FORM, lon: '-181' })).toBeNull();
  });
});

describe('createFrameCoalescer', () => {
  it('delivers only the latest value, once per animation frame', () => {
    const frames = [];
    const raf = (cb) => { frames.push(cb); return frames.length; };
    const caf = (id) => { frames[id - 1] = null; };
    const fn = vi.fn();
    const c = createFrameCoalescer(fn, raf, caf);
    c.push(1);
    c.push(2);
    c.push(3);
    expect(frames).toHaveLength(1);
    expect(fn).not.toHaveBeenCalled();
    frames[0]();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
    c.push(4);
    expect(frames).toHaveLength(2);
    c.cancel();
    expect(frames[1]).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
    c.push(5);
    frames[2]();
    expect(fn).toHaveBeenLastCalledWith(5);
  });
});
```

Append to `src/terminal/views/ledger/__tests__/SubmissionForm.test.jsx` (`vi` is already imported; add `fireEvent` to the `@testing-library/react` import):

```jsx
describe('SubmissionForm draft', () => {
  it('reports every valid edit as numeric params and freezes on invalid ones', () => {
    const onDraftChange = vi.fn();
    const { container } = render(<SubmissionForm onSubmit={() => {}} loading={false} onDraftChange={onDraftChange} />);
    expect(onDraftChange).not.toHaveBeenCalled();                    // an empty form is not a draft
    const p = ALL_AUDIT_PRESETS.find((x) => x.key === 'danube');
    fireEvent.click(screen.getByText('DANUBE'));
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      lat: p.lat, lon: p.lon, temp: p.temp, do: p.do, bod: p.bod, dt: p.dt, epi: p.epi, nitrate: p.nitrate, flow: p.flow,
    }));
    const calls = onDraftChange.mock.calls.length;
    const bod = container.querySelector('[data-field="bod"] input');
    fireEvent.change(bod, { target: { value: '500' } });              // out of range: the ghost freezes
    fireEvent.change(bod, { target: { value: '' } });                 // blank: still frozen
    expect(onDraftChange).toHaveBeenCalledTimes(calls);
    fireEvent.change(bod, { target: { value: '4' } });
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ bod: 4 }));
    const n = onDraftChange.mock.calls.length;
    fireEvent.change(container.querySelector('[data-field="lat"] input'), { target: { value: '95' } });
    expect(onDraftChange).toHaveBeenCalledTimes(n);
  });
});
```

In `LedgerTab.test.jsx`, replace the `SubmissionForm` mock with:

```js
vi.mock('../ledger/SubmissionForm', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    default: ({ onSubmit, onDraftChange }) => createElement(Fragment, null,
      createElement('button', { type: 'button', onClick: () => onSubmit(h.INPUT) }, 'stub-submit'),
      createElement('button', {
        type: 'button',
        onClick: () => { onDraftChange?.({ ...h.INPUT, bod: 1 }); onDraftChange?.(h.INPUT); },
      }, 'stub-draft'),
    ),
  };
});
```

and append inside the `describe`:

```js
  it('hands the latest valid draft to the ocean as the ghost, and clears it for the archive view', async () => {
    render(<LedgerTab />);
    fireEvent.click(screen.getByText('stub-draft'));
    await waitFor(() => expect(h.oceanProps.at(-1).ghost).toEqual(h.INPUT));
    fireEvent.click(screen.getByText(/Verdict Archive/));
    expect(h.oceanProps.at(-1).ghost).toBeNull();
    fireEvent.click(screen.getByText('Submit Audit'));
    expect(h.oceanProps.at(-1).ghost).toBeNull();                    // the remounted form is not a draft
  });

  it('keeps the ghost while the kernel rules, and drops it when the verdict seals', async () => {
    render(<LedgerTab />);
    fireEvent.click(screen.getByText('stub-draft'));
    await waitFor(() => expect(h.oceanProps.at(-1).ghost).toEqual(h.INPUT));
    fireEvent.click(screen.getByText('stub-submit'));
    const complete = await screen.findByText('stub-complete');
    expect(h.oceanProps.at(-1).ghost).toEqual(h.INPUT);
    act(() => { fireEvent.click(complete); });
    await waitFor(() => expect(h.oceanProps.at(-1).verdicts.map((v) => v.hash)).toEqual(['h-new']));
    expect(h.oceanProps.at(-1).ghost).toBeNull();
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/views/ledger/__tests__/ src/terminal/views/__tests__/LedgerTab.test.jsx`
Expected: FAIL — `../draft` not found; `onDraftChange` never called; `ghost` prop undefined.

- [ ] **Step 3: Implement `draft.js`**

Create `src/terminal/views/ledger/draft.js`:

```js
// draft.js — the audit form as a provisional ocean source (spec §4 Form).
// validDraft: the form's numeric params when every field is present, numeric,
// in PARAM_RANGES and on the globe; else null (the ghost freezes at its last
// valid state). createFrameCoalescer: at most one delivery per animation
// frame, carrying the latest value.

import { PARAM_RANGES, validateSubmission } from '../../ledger/verdictModel';

const blank = (v) => v === '' || v === undefined || v === null;

export function validDraft(form) {
  if (blank(form.lat) || blank(form.lon)) return null;
  for (const key of Object.keys(PARAM_RANGES)) if (blank(form[key])) return null;
  const lat = Number(form.lat);
  const lon = Number(form.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const out = { lat, lon, siteName: form.siteName ?? '' };
  for (const key of Object.keys(PARAM_RANGES)) out[key] = Number(form[key]);
  return validateSubmission(out).length ? null : out;
}

export function createFrameCoalescer(
  fn,
  raf = (cb) => requestAnimationFrame(cb),
  caf = (id) => cancelAnimationFrame(id),
) {
  let id = 0;
  let latest;
  return {
    push(value) {
      latest = value;
      if (!id) {
        id = raf(() => {
          id = 0;
          fn(latest);
        });
      }
    },
    cancel() {
      if (id) caf(id);
      id = 0;
    },
  };
}
```

- [ ] **Step 4: Implement the form and the tab**

`SubmissionForm.jsx`: add `import { validDraft } from './draft';`, add `onDraftChange = null` to the props destructuring (after `verdicts = []`), and after `const formRef = useRef(null);` add:

```js
  // Spec §4 Form: every valid edit updates the ocean's ghost; an invalid one
  // is not reported, so the ghost freezes at its last valid state.
  const onDraftRef = useRef(onDraftChange);
  onDraftRef.current = onDraftChange;
  useEffect(() => {
    const d = validDraft(form);
    if (d) onDraftRef.current?.(d);
  }, [form]);
```

`LedgerTab.jsx`:
1. `import { useState, useCallback, useEffect, useMemo, useRef } from 'react';` and `import { createFrameCoalescer } from './ledger/draft';`.
2. After the audit-cascade state lines add:

```js
  // The form's latest valid draft = the ocean's PROVISIONAL ghost, delivered
  // at most once per animation frame (spec §4 Form).
  const [draft, setDraft] = useState(null);
  const draftCoalescer = useMemo(() => createFrameCoalescer(setDraft), []);
  useEffect(() => () => draftCoalescer.cancel(), [draftCoalescer]);
  const handleDraftChange = useCallback((params) => draftCoalescer.push(params), [draftCoalescer]);
  const clearDraft = useCallback(() => {
    draftCoalescer.cancel();
    setDraft(null);
  }, [draftCoalescer]);
```

3. In `handleCascadeComplete`, after `setLatestHash(cascadeVerdict.hash);` add `clearDraft();` (the sealed verdict replaces the ghost in the same render), and add `clearDraft` to its dependency array (`[cascadeVerdict, clearDraft]`).
4. The archive toggle: `onClick={() => { setView('archive'); clearDraft(); }}`.
5. `<SubmissionForm … onDraftChange={handleDraftChange} />`.
6. `<LedgerOcean … ghost={view === 'submit' ? draft : null} />`.

- [ ] **Step 5: Run**

Run: `npx vitest run src/terminal/views/`
Expected: PASS.

- [ ] **Step 6: Mutation checks**

1. `validDraft`: drop the `Math.abs(lat) > 90` check → off-globe tests fail.
2. `validDraft`: drop `validateSubmission` → the `bod: '500'` cases fail (draft and form tests).
3. Coalescer: call `fn(value)` directly in `push` → the coalescer test fails. (At the `LedgerTab` level React batches the two stub calls into one render, so the coalescer test is the one that bites; record this.)
4. Coalescer `cancel`: don't call `caf` → coalescer test fails.
5. `LedgerTab`: remove `clearDraft()` from `handleCascadeComplete` → the seal test fails.
6. `LedgerTab`: pass `ghost={draft}` → the archive-view test fails.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/ledger/draft.js src/terminal/views/ledger/SubmissionForm.jsx src/terminal/views/LedgerTab.jsx src/terminal/views/ledger/__tests__/draft.test.js src/terminal/views/ledger/__tests__/SubmissionForm.test.jsx src/terminal/views/__tests__/LedgerTab.test.jsx
git commit -m "feat(ledger): the form's valid draft drives the ocean ghost, coalesced per frame; invalid edits freeze it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The seal — clock ease on wall time, flare along the course, dashes close

**Files:**
- Create: `src/terminal/views/ledger/ocean/clockEase.js`
- Modify: `src/terminal/ledger/ocean/riverStage.js` (append `writeFlare`)
- Modify: `src/terminal/views/ledger/ocean/LedgerOcean.jsx`, `OceanHud.jsx`
- Modify: `src/terminal/views/LedgerTab.jsx`
- Modify: `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md` (§4 Seal)
- Test: `src/terminal/views/ledger/ocean/__tests__/clockEase.test.js` (new), `src/terminal/ledger/ocean/__tests__/riverStage.test.js`, `LedgerOcean.test.jsx`, `OceanHud.test.jsx`, `src/terminal/views/__tests__/LedgerTab.test.jsx`

**Interfaces:**
- Consumes: `createOceanDriver({ clock, step })`, `createStepClock()`, `DT_DAYS`; `prepareRiver`, `coursePoint`; particle layer `draw(first, count, sizePx)`; `requestFrameRef` (Task 6).
- Produces:
  - `clockEase.js`: `SEAL_EASE_MS = 600`, `HOLD_FACTOR = 0.02`, `SEAL_FLARE_MS = 1200`; `createClockEase({ durationMs = SEAL_EASE_MS, floor = HOLD_FACTOR } = {})` → `{ hold(on: boolean, nowMs), held() → boolean, value(nowMs) → factor, meanFactor(aMs, bMs) → exact mean of the factor over [a, b] }`.
  - `writeFlare(river, frac, out, index)` — one white vertex at `frac` (clamped 0..1) of the course.
  - `LedgerOcean` props `holdClock = false`, `sealHash = null`, `onSealDone = null`. While `holdClock`, the clock eases to `HOLD_FACTOR`; when `sealHash` names a built source with a river stage, one flare vertex (`FLARE_PX`) runs site → mouth over `SEAL_FLARE_MS`, then `onSealDone()` is called once. Reduced motion, a static ocean or no river stage: `onSealDone()` at once, no flare.
  - `OceanHud` prop `sealId`: the matching snap line gets `data-sealing="true"` and, unless reduced motion, `animation: ocean-seal-dash 400ms ease-out both` (dashes `4 3` → `4 0`).
  - `LedgerTab`: `sealHash` state set on cascade completion; `holdClock={cascadeVisible || sealHash !== null}`; `onSealDone` clears `sealHash`.

- [ ] **Step 1: Write the failing tests**

Create `src/terminal/views/ledger/ocean/__tests__/clockEase.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createStepClock } from '../../../../ledger/ocean/clock';
import { DT_DAYS } from '../../../../ledger/ocean/grid';
import { createOceanDriver } from '../oceanDriver';
import { createClockEase, SEAL_EASE_MS, HOLD_FACTOR } from '../clockEase';

const riemann = (ease, a, b, n = 200000) => {
  let s = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) s += ease.value(a + (i + 0.5) * h) * h;
  return s / (b - a);
};

describe('createClockEase', () => {
  it('eases from 1 to the hold factor over SEAL_EASE_MS (smoothstep) and stays there', () => {
    const e = createClockEase();
    expect(e.value(0)).toBe(1);
    expect(e.meanFactor(0, 100)).toBe(1);
    e.hold(true, 1000);
    expect(e.held()).toBe(true);
    expect(e.value(1000)).toBeCloseTo(1, 12);
    expect(e.value(1000 + SEAL_EASE_MS / 2)).toBeCloseTo((1 + HOLD_FACTOR) / 2, 12);
    expect(e.value(1000 + SEAL_EASE_MS)).toBeCloseTo(HOLD_FACTOR, 12);
    expect(e.value(9000)).toBeCloseTo(HOLD_FACTOR, 12);
    expect(e.value(900)).toBe(1);
  });

  it('integrates the factor exactly over any interval, including across the ease ends', () => {
    const e = createClockEase();
    e.hold(true, 1000);
    for (const [a, b] of [[900, 1100], [1100, 1400], [1500, 1700], [950, 2000], [1600, 1601]]) {
      expect(e.meanFactor(a, b)).toBeCloseTo(riemann(e, a, b), 7);
    }
  });

  it('releases from wherever it is, continuously, and ignores a repeated hold', () => {
    const e = createClockEase();
    e.hold(true, 0);
    e.hold(true, 200);                          // no restart
    expect(e.value(300)).toBeCloseTo((1 + HOLD_FACTOR) / 2, 12);
    e.hold(false, 300);
    expect(e.held()).toBe(false);
    expect(e.value(300)).toBeCloseTo((1 + HOLD_FACTOR) / 2, 12);
    expect(e.value(300 + SEAL_EASE_MS)).toBeCloseTo(1, 12);
  });

  it('advances the same simulated time at 60 Hz and 360 Hz (nothing frame-counted)', () => {
    const run = (hz) => {
      const e = createClockEase();
      let steps = 0;
      const d = createOceanDriver({ clock: createStepClock(), step: () => { steps++; } });
      let dayWeight = 0;
      const frameMs = 1000 / hz;
      for (let f = 1; f <= 3 * hz; f++) {
        const now = f * frameMs;
        if (!e.held() && now > 500 && now - frameMs < 1700) e.hold(true, 500);
        if (e.held() && now > 1700) e.hold(false, 1700);
        const m = e.meanFactor(now - frameMs, now);
        dayWeight += (frameMs / 1000) * 9 * m;
        d.advance(frameMs / 1000, 9 * m);
      }
      return { steps, dayWeight };
    };
    // ∫ factor dt over 3 s = 0.5 + 0.306 + 0.012 + 0.306 + 0.7 = 1.824 s → 16.416 d at 9 d/s.
    const a = run(60);
    const b = run(360);
    expect(a.dayWeight).toBeCloseTo(16.416, 9);
    expect(b.dayWeight).toBeCloseTo(16.416, 9);
    expect(a.steps).toBe(Math.floor(16.416 / DT_DAYS));
    expect(b.steps).toBe(a.steps);
  });
});
```

`riverStage.test.js` — add `writeFlare` to the import and append inside `describe('parcels', …)`:

```js
  it('writes one white flare vertex at a fraction of the course', () => {
    const river = prepareRiver(src);
    const out = new Float32Array(3 * FLOATS_PER_PARTICLE);
    writeFlare(river, 0.5, out, 2);
    const o = 2 * FLOATS_PER_PARTICLE;
    expect(out[o]).toBeCloseTo(5 / 180, 6);
    expect(out[o + 1]).toBeCloseTo(0, 6);
    expect(Array.from(out.slice(o + 2, o + 6))).toEqual([1, 1, 1, 1]);
    writeFlare(river, 7, out, 0);
    expect(out[0]).toBeCloseTo(10 / 180, 6);    // clamped to the mouth
  });
```

`OceanHud.test.jsx` — append:

```js
  it('closes the sealed verdict line's dashes (not under reduced motion)', () => {
    const { container } = hud({ sealId: 'h1' });
    const line = container.querySelector('line[data-line="h1"]');
    expect(line.getAttribute('data-sealing')).toBe('true');
    expect(line.style.animation).toContain('ocean-seal-dash');
    expect(container.querySelector('style').textContent).toContain('@keyframes ocean-seal-dash');
    const still = hud({ sealId: 'h1', reducedMotion: true });
    expect(still.container.querySelector('line[data-line="h1"]').style.animation).toBe('');
  });
```

`LedgerOcean.test.jsx` — add `FLARE_PX` to the `../hudFormat` import, `import { SEAL_FLARE_MS } from '../clockEase';`, `verdictSourceSpec` to the sources import, and append:

```js
const flareDraws = () => pointDraws().filter((e) => e[3] === 1);
const lastFlareVertex = () => particleUploads().at(-1)[2].slice(-FLOATS_PER_PARTICLE);

describe('LedgerOcean seal', () => {
  it('eases the clock to a near-stop while held and back when released, on wall time', () => {
    const days = [];
    const onFrame = (d) => days.push(d);
    const m = mountLive(<LedgerOcean width={1024} height={512} onFrame={onFrame} />);
    m.frames(10);
    m.rerender(<LedgerOcean width={1024} height={512} onFrame={onFrame} holdClock />);
    m.frames(40);                                        // 640 ms: the 600 ms ease is done
    const held = days.at(-1);
    m.frames(30);                                        // 480 ms at 2% of 9 d/s ≈ 0.09 d
    expect(days.at(-1) - held).toBeLessThanOrEqual(DT_DAYS);
    m.rerender(<LedgerOcean width={1024} height={512} onFrame={onFrame} />);
    m.frames(40);
    const released = days.at(-1);
    m.frames(30);                                        // 480 ms at 9 d/s = 4.32 d
    expect(days.at(-1) - released).toBeGreaterThanOrEqual(4);
    expect(days.at(-1) - released).toBeLessThanOrEqual(4.5);
  });

  it('flares the sealed verdict from its site towards its mouth over SEAL_FLARE_MS, then reports done once', () => {
    const done = vi.fn();
    const m = mountLive(<LedgerOcean width={1024} height={512} holdClock />);
    m.frames(2);
    m.rerender(<LedgerOcean width={1024} height={512} holdClock verdicts={[V]} sealHash="h1" onSealDone={done} />);
    m.frames(1);
    expect(flareDraws()).toHaveLength(1);
    expect(rec.log).toContainEqual(['uniform1f', expect.stringMatching(/:uSize$/), FLARE_PX]);
    const src = buildSource(verdictSourceSpec(V), getOceanWorld().grid, getOceanWorld().mask);
    const x0 = lastFlareVertex()[0];
    expect(x0).toBeCloseTo(src.course[0][0] / 180, 4);  // starts at the audit site
    m.frames(Math.ceil(SEAL_FLARE_MS / FRAME_MS / 2));
    expect(lastFlareVertex()[0]).toBeGreaterThan(x0);   // V drains east to the East China Sea
    expect(done).not.toHaveBeenCalled();
    m.frames(Math.ceil(SEAL_FLARE_MS / FRAME_MS));
    expect(done).toHaveBeenCalledTimes(1);
    const after = flareDraws().length;
    m.frames(3);
    expect(flareDraws()).toHaveLength(after);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('seals at once, with no flare, under reduced motion', () => {
    reduceMotion();
    const done = vi.fn();
    const m = mountLive(<LedgerOcean width={1024} height={512} />);
    m.frames(WARM_FRAMES + 2);
    m.rerender(<LedgerOcean width={1024} height={512} verdicts={[V]} sealHash="h1" onSealDone={done} />);
    expect(done).toHaveBeenCalledTimes(1);
    m.frames(WARM_FRAMES + 2);
    expect(flareDraws()).toHaveLength(0);
  });

  it('seals at once without float targets (no river stage to flare on)', () => {
    const done = vi.fn();
    const m = mountLive(<LedgerOcean width={1024} height={512} />, { extensions: [] });
    m.rerender(<LedgerOcean width={1024} height={512} verdicts={[V]} sealHash="h1" onSealDone={done} />);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
```

`LedgerTab.test.jsx` — append inside the `describe`:

```js
  it('holds the ocean clock from submit until the flare is done, and names the sealed verdict', async () => {
    render(<LedgerTab />);
    expect(h.oceanProps.at(-1).holdClock).toBe(false);
    fireEvent.click(screen.getByText('stub-submit'));
    const complete = await screen.findByText('stub-complete');
    expect(h.oceanProps.at(-1).holdClock).toBe(true);
    act(() => { fireEvent.click(complete); });
    await waitFor(() => expect(h.oceanProps.at(-1).sealHash).toBe('h-new'));
    // The cascade hides itself 600 ms after completing; the clock stays held
    // until the flare reports done, not until the cascade is gone.
    await waitFor(() => expect(screen.queryByText('stub-complete')).toBeNull(), { timeout: 2000 });
    expect(h.oceanProps.at(-1).holdClock).toBe(true);
    act(() => { h.oceanProps.at(-1).onSealDone(); });
    expect(h.oceanProps.at(-1).sealHash).toBeNull();
    expect(h.oceanProps.at(-1).holdClock).toBe(false);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/views/ src/terminal/ledger/ocean/__tests__/riverStage.test.js`
Expected: FAIL — `clockEase` not found, `writeFlare` undefined, no hold, no flare, `holdClock` undefined in LedgerTab.

- [ ] **Step 3: Implement `clockEase.js` and `writeFlare`**

Create `src/terminal/views/ledger/ocean/clockEase.js`:

```js
// clockEase.js — the seal's clock ease (spec §4 Seal). While AuditCascade
// runs, the ocean eases to a near-stop; after the flare it eases back. The
// factor is a smoothstep in WALL time, and the driver is fed its exact mean
// over each frame's interval (closed-form integral), so 60 Hz and 360 Hz
// frames accumulate identical simulated time. Nothing is frame-counted.

export const SEAL_EASE_MS = 600;
export const HOLD_FACTOR = 0.02;    // of the chosen compression: 9 d/s → 0.18 d/s
export const SEAL_FLARE_MS = 1200;  // wall time for the flare, site → mouth

const S1 = 0.5; // ∫₀¹ smoothstep

export function createClockEase({ durationMs = SEAL_EASE_MS, floor = HOLD_FACTOR } = {}) {
  let from = 1;
  let to = 1;
  let t0 = 0;
  let isHeld = false;
  const x = (t) => Math.min(1, Math.max(0, (t - t0) / durationMs));
  const value = (t) => (from === to ? to : from + (to - from) * x(t) * x(t) * (3 - 2 * x(t)));
  // G(t) = ∫_{t0}^{t} smoothstep(x(τ)) dτ, 0 before t0.
  const G = (t) => {
    if (t <= t0) return 0;
    if (t >= t0 + durationMs) return durationMs * S1 + (t - t0 - durationMs);
    const u = x(t);
    return durationMs * (u ** 3 - u ** 4 / 2);
  };
  return {
    hold(on, now) {
      if (on === isHeld) return;
      from = value(now);
      to = on ? floor : 1;
      t0 = now;
      isHeld = on;
    },
    held() {
      return isHeld;
    },
    value,
    meanFactor(a, b) {
      if (from === to) return to;
      if (!(b > a)) return value(b);
      return from + ((to - from) * (G(b) - G(a))) / (b - a);
    },
  };
}
```

Append to `riverStage.js`:

```js

// The seal flare: one white vertex at `frac` (clamped to 0..1) of the course,
// written at parcel index `index`.
export function writeFlare(river, frac, out, index) {
  const f = Math.min(1, Math.max(0, frac));
  const [lon, lat] = coursePoint(river.course, river.cum, f * river.courseKm);
  const o = index * FLOATS_PER_PARTICLE;
  out[o] = lon / 180;
  out[o + 1] = lat / 90;
  out[o + 2] = 1;
  out[o + 3] = 1;
  out[o + 4] = 1;
  out[o + 5] = 1;
}
```

- [ ] **Step 4: Implement in `LedgerOcean.jsx`**

1. Props: add `holdClock = false, sealHash = null, onSealDone = null,` after `ghost = null,`.
2. Imports: `import { createClockEase, SEAL_FLARE_MS } from './clockEase';`; add `writeFlare,` to the `riverStage` import and `FLARE_PX,` to the `./hudFormat` import.
3. After `readyRef.current = sourcesReady;` add:

```js
  const easeRef = useRef(null);
  if (easeRef.current === null) easeRef.current = createClockEase();
  const holdRef = useRef(holdClock);
  holdRef.current = holdClock;
  const flareRef = useRef(null);
  const onSealDoneRef = useRef(onSealDone);
  onSealDoneRef.current = onSealDone;
```

and after `sourceDataRef.current = sourceData;` add:

```js
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
```

4. Replace `drawParticles` with:

```js
  // River stage (spec §3) plus the seal flare (spec §4): parcels re-filled only
  // when the simulated day or the river set changes; while a flare runs, every
  // frame, with the flare as one extra vertex after the parcels.
  const drawParticles = (gl, now) => {
    const layer = particlesRef.current;
    const driver = driverRef.current;
    if (!layer || !driver) return;
    const { rivers, buf } = riverBufRef.current;
    const days = driver.simDays();
    const flare = flareRef.current;
    let frac = null;
    if (flare) {
      if (flare.t0 === null) flare.t0 = now;
      frac = (now - flare.t0) / SEAL_FLARE_MS;
      if (frac >= 1) {
        flareRef.current = null;
        frac = null;
        onSealDoneRef.current?.();
      }
    }
    const fill = fillRef.current;
    if (frac !== null || days !== fill.days || rivers !== fill.rivers) {
      const n = fillParticles(rivers, days, buf);
      if (frac !== null) writeFlare(flare.river, frac, buf, n);
      layer.upload(buf, n + (frac !== null ? 1 : 0));
      fillRef.current = { days, rivers, n };
    }
    const scale = gl.canvas.width / Math.max(1, sizeRef.current.width);
    layer.draw(0, fillRef.current.n, PARTICLE_PX * scale);
    if (frac !== null) layer.draw(fillRef.current.n, 1, FLARE_PX * scale);
  };
```

5. In `draw`, replace

```js
    } else if (driver && !hidden) {
      driver.advance(dt, dpsRef.current);
    }
```

with

```js
    } else if (driver && !hidden) {
      // Seal: ease the clock on wall time; feed the driver the exact mean
      // factor over this frame's interval (frame-rate independent).
      const ease = easeRef.current;
      if (ease.held() !== holdRef.current) ease.hold(holdRef.current, now);
      driver.advance(dt, dpsRef.current * ease.meanFactor(now - dt * 1000, now));
    }
```

and `drawParticles(host.gl);` with `drawParticles(host.gl, now);`.

6. After the `[ghostSource]` effect add:

```js
  // Seal (spec §4): flare the sealed verdict's course, site → mouth, then
  // report done so LedgerTab releases the clock. Nothing to flare on (reduced
  // motion, static ocean, no river stage): done at once.
  useEffect(() => {
    if (!sealHash) {
      flareRef.current = null;
      return;
    }
    const src = sourcesRef.current.find((s) => s.id === sealHash);
    const river = src ? prepareRiver(src) : null;
    if (!river || !particlesRef.current || reducedMotion || lostRef.current) {
      onSealDoneRef.current?.();
      return;
    }
    flareRef.current = { river, t0: null };
  }, [sealHash, reducedMotion]);
```

7. Pass `sealId={sealHash}` to `<OceanHud …>`.
8. Header comment: add `// - Seal: holdClock eases the clock to 2 % over 600 ms of wall time (exact per-frame mean); sealHash flares its course over 1.2 s, then onSealDone.`

- [ ] **Step 5: Implement in `OceanHud.jsx`**

Add `sealId = null,` to the props (after `verdicts = [],`), add after `const TIP_MARGIN_PX = 4;`:

```js
const SEAL_KEYFRAMES = '@keyframes ocean-seal-dash { from { stroke-dasharray: 4 3; } to { stroke-dasharray: 4 0; } }';
const SEAL_ANIMATION = 'ocean-seal-dash 400ms ease-out both';
```

insert `<style>{SEAL_KEYFRAMES}</style>` as the first child of the root `<div ref={rootRef} …>`, and in the `<line …>` element (Task 7 form) add:

```jsx
              data-sealing={s.id === sealId ? 'true' : undefined}
              style={s.id === sealId && !reducedMotion ? { animation: SEAL_ANIMATION } : undefined}
```

- [ ] **Step 6: Implement in `LedgerTab.jsx`**

1. After `const [latestHash, setLatestHash] = useState(null);` add `const [sealHash, setSealHash] = useState(null);`.
2. In `handleCascadeComplete`, after `clearDraft();` add `setSealHash(cascadeVerdict.hash);`. Update its comment block to: `// Seal (spec §4): the sealed verdict joins \`verdicts\` (a permanent source, ringed, latestHash); the ghost is dropped in the same render; LedgerOcean flares the course and calls onSealDone, which releases the clock. Emits unchanged.`
3. Add `const handleSealDone = useCallback(() => setSealHash(null), []);`.
4. `<LedgerOcean … holdClock={cascadeVisible || sealHash !== null} sealHash={sealHash} onSealDone={handleSealDone} />`.

- [ ] **Step 7: Spec §4 Seal**

After item `3. The clock eases back; the new plume starts entering the ocean.` add:

```markdown

3b values: the ease is a smoothstep over 600 ms of wall time to 2 % of the
chosen compression, fed to the clock as its exact mean over each frame's
interval (60 Hz and 360 Hz advance identically); the flare is one white point
running site → mouth over 1.2 s; the clock eases back when the flare is done.
Under reduced motion, or with no river stage to draw, the seal completes at
once without a flare.
```

- [ ] **Step 8: Run**

Run: `npx vitest run src/terminal/views/ src/terminal/ledger/`
Expected: PASS. The `ledgerBus` / observatory emit test is unchanged and passes.

- [ ] **Step 9: Mutation checks**

1. `meanFactor` → `return value(b);` → the 60/360 Hz test fails (`dayWeight` off by ~0.07 d at 60 Hz) and the integral test fails.
2. `hold`: `from = on ? 1 : floor;` (restart instead of continuing) → the release-continuity test fails.
3. `hold`: remove `if (on === isHeld) return;` → the repeated-hold test fails.
4. `LedgerOcean` draw: `driver.advance(dt, dpsRef.current)` (ignore the ease) → the hold test fails (≈ 4.3 d during the held window).
5. `drawParticles`: never call `onSealDoneRef.current?.()` → the flare test fails.
6. `writeFlare`: `f * river.courseKm` → `0` → the flare-moves test fails.
7. Seal effect: drop `reducedMotion ||` → the reduced-motion seal test fails.
8. OceanHud: animate even under reduced motion → the HUD seal test fails.
9. `LedgerTab`: `holdClock={cascadeVisible}` → the LedgerTab hold test fails (after the cascade's 600 ms reset the clock must still be held while `sealHash` is set).
10. `LedgerTab`: `holdClock={sealHash !== null}` → the same test fails at the first `holdClock` true (during the cascade).

- [ ] **Step 10: Commit**

```bash
git add src/terminal/views/ledger/ocean/clockEase.js src/terminal/ledger/ocean/riverStage.js src/terminal/views/ledger/ocean/LedgerOcean.jsx src/terminal/views/ledger/ocean/OceanHud.jsx src/terminal/views/LedgerTab.jsx docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md src/terminal/views/ledger/ocean/__tests__/clockEase.test.js src/terminal/ledger/ocean/__tests__/riverStage.test.js src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx src/terminal/views/ledger/ocean/__tests__/OceanHud.test.jsx src/terminal/views/__tests__/LedgerTab.test.jsx
git commit -m "feat(ledger): the seal — clock eases on wall time, flare runs the course, dashes close

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Rings are one tab stop; a11y polish

3a final review Minors 2, 3 and the ring-label memo (3a Task 5 Minor). With 9 presets, a ghost and the archive, each ring is currently its own tab stop ahead of the form.

**Files:**
- Modify: `src/terminal/views/ledger/ocean/hudFormat.js` (`keyStep`, labels), `OceanHud.jsx`, `LedgerOcean.jsx` (`role="img"`)
- Test: `src/terminal/views/ledger/ocean/__tests__/{hudFormat.test.js,OceanHud.test.jsx,LedgerOcean.test.jsx}`

**Interfaces:**
- Produces: `keyStep(key, i, n) → next index | null` (ArrowRight/ArrowDown +1, ArrowLeft/ArrowUp −1, both wrapping; Home 0; End n−1; else null). `SITES_GROUP_LABEL = 'Audit sites'`, `NOTES_TOGGLE_LABEL = 'Legend notes'`. Rings sit in `<div role="group" aria-label="Audit sites">`; exactly one ring has `tabIndex 0`. The notes toggle keeps one `aria-label`, carries `aria-expanded` and `aria-controls` (the notes' id). The ocean canvas has `role="img"`.

- [ ] **Step 1: Write the failing tests**

`hudFormat.test.js` — add `keyStep` to the import and append:

```js
describe('keyStep', () => {
  it('roves with arrows (wrapping), Home and End; other keys do nothing', () => {
    expect(keyStep('ArrowRight', 0, 3)).toBe(1);
    expect(keyStep('ArrowDown', 2, 3)).toBe(0);
    expect(keyStep('ArrowLeft', 0, 3)).toBe(2);
    expect(keyStep('ArrowUp', 1, 3)).toBe(0);
    expect(keyStep('Home', 2, 3)).toBe(0);
    expect(keyStep('End', 0, 3)).toBe(2);
    expect(keyStep('Enter', 0, 3)).toBeNull();
    expect(keyStep('ArrowRight', 0, 0)).toBeNull();
  });
});
```

`OceanHud.test.jsx` — append:

```js
  it('is one tab stop: arrow keys, Home and End rove between the rings', () => {
    const { container } = hud();
    expect(screen.getByRole('group', { name: 'Audit sites' })).toBeTruthy();
    const rings = [...container.querySelectorAll('[data-site]')];
    expect(rings.map((r) => r.tabIndex)).toEqual([0, -1]);
    rings[0].focus();
    fireEvent.keyDown(rings[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(rings[1]);
    expect(rings.map((r) => r.tabIndex)).toEqual([-1, 0]);
    fireEvent.keyDown(rings[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(rings[0]);
    fireEvent.keyDown(rings[0], { key: 'End' });
    expect(document.activeElement).toBe(rings[1]);
    fireEvent.keyDown(rings[1], { key: 'Home' });
    expect(document.activeElement).toBe(rings[0]);
  });

  it('gives the notes toggle one stable label, its state, and what it controls', () => {
    const { q } = hud({ compact: true });
    const toggle = q('notes-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Legend notes');
    fireEvent.click(toggle);
    expect(q('notes-toggle').getAttribute('aria-label')).toBe('Legend notes');
    expect(q('notes-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(q('notes').id).toBeTruthy();
    expect(q('notes-toggle').getAttribute('aria-controls')).toBe(q('notes').id);
  });
```

`LedgerOcean.test.jsx` — append inside `describe('LedgerOcean', …)`:

```js
  it('exposes the canvas as an image with its description', () => {
    rec = installRecordingGL({ version: 2, extensions: FLOAT });
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByRole('img', { name: /Ledger ocean/ })).toBeTruthy();
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/views/ledger/ocean/`
Expected: FAIL — `keyStep` undefined; every ring has tabIndex 0; toggle label switches; no `role="img"`.

- [ ] **Step 3: Implement**

`hudFormat.js` — append:

```js
export const SITES_GROUP_LABEL = 'Audit sites';
export const NOTES_TOGGLE_LABEL = 'Legend notes';

// Roving tabindex over the source rings: the next ring index for a key, or null.
export function keyStep(key, i, n) {
  if (!(n > 0)) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (i + 1) % n;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (i - 1 + n) % n;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return null;
}
```

`OceanHud.jsx`:
1. `import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';` and add `NOTES_TOGGLE_LABEL, SITES_GROUP_LABEL, keyStep,` to the `./hudFormat` import.
2. After `const tipRef = useRef(null);` add:

```js
  const [rove, setRove] = useState(0);
  const ringEls = useRef([]);
  const notesId = useId();
  // Ring labels change with the sites, not with the 10 Hz probe re-render.
  const ringLabels = useMemo(() => sites.map((s) => tooltipLines(s).join(' · ')), [sites]);
  const roveIdx = Math.min(rove, Math.max(0, sites.length - 1));
```

3. Replace the whole rings block (`{sites.map((s) => { const { left, top } = lonLatToPct(s.site[0], s.site[1]); const latest = …` through its closing `})}`) with:

```jsx
      <div role="group" aria-label={SITES_GROUP_LABEL}>
        {sites.map((s, i) => {
          const { left, top } = lonLatToPct(s.site[0], s.site[1]);
          const latest = s.id === latestHash;
          return (
            <button
              key={s.id}
              ref={(el) => { ringEls.current[i] = el; }}
              type="button"
              data-site={s.id}
              aria-label={ringLabels[i]}
              // One tab stop for all rings (roving tabindex); arrows move between them.
              tabIndex={i === roveIdx ? 0 : -1}
              onKeyDown={(e) => {
                const next = keyStep(e.key, i, sites.length);
                if (next === null) return;
                e.preventDefault();
                setRove(next);
                ringEls.current[next]?.focus();
              }}
              onMouseEnter={() => setFocus(s.id)}
              onMouseLeave={() => setFocus((f) => (f === s.id ? null : f))}
              onFocus={() => { setFocus(s.id); setRove(i); }}
              onBlur={() => setFocus((f) => (f === s.id ? null : f))}
              // Set, never toggle: a real tap/click arrives as mouseenter →
              // focus → click, and a toggle would clear what enter just opened.
              // Dismissal: blur or mouseleave (tapping elsewhere does both).
              onClick={() => setFocus(s.id)}
              style={{
                position: 'absolute', left: `${left}%`, top: `${top}%`, width: ringPx, height: ringPx,
                transform: 'translate(-50%, -50%)', padding: 0, border: 'none', background: 'transparent',
                // Phone: no pointer events, so Chrome's touch adjustment has
                // nothing to snap a tap to; still focusable from the keyboard.
                cursor: 'pointer', pointerEvents: compact ? 'none' : 'auto',
              }}
            >
              <span
                style={{
                  position: 'absolute', inset: compact ? (latest ? 0 : 1) : (latest ? 2 : 4), borderRadius: '50%',
                  border: `${latest ? 2 : 1.5}px ${s.kind === 'ghost' ? 'dashed' : 'solid'} ${s.color}`,
                  opacity: s.kind === 'preset' ? 0.6 : 0.95,
                }}
              />
            </button>
          );
        })}
      </div>
```

(The group `div` is not positioned, so the rings still position against the HUD root.)
4. Notes: give the notes panel `id={notesId}` (`<div data-hud="notes" id={notesId} …>`), and replace the toggle's `aria-label={notesOpen ? 'Hide legend notes' : 'Show legend notes'}` with `aria-label={NOTES_TOGGLE_LABEL}` plus `aria-controls={notesId}` (keep `aria-expanded={notesOpen}`).

`LedgerOcean.jsx` — add `role="img"` to the `<canvas …>` element.

- [ ] **Step 4: Run**

Run: `npx vitest run src/terminal/views/`
Expected: PASS (existing ring/tooltip/focus tests unchanged).

- [ ] **Step 5: Mutation checks**

1. `tabIndex={0}` for every ring → the roving test fails.
2. `onKeyDown`: drop `ringEls.current[next]?.focus();` → activeElement assertions fail.
3. `keyStep`: no wrap on ArrowRight (`Math.min(i + 1, n - 1)`) → keyStep and roving tests fail.
4. Restore the switching toggle label → notes test fails.
5. Remove `role="img"` → canvas test fails.
(The `ringLabels` memo is a performance change with no behaviour to assert; record it as untested.)

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/ledger/ocean/hudFormat.js src/terminal/views/ledger/ocean/OceanHud.jsx src/terminal/views/ledger/ocean/LedgerOcean.jsx src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js src/terminal/views/ledger/ocean/__tests__/OceanHud.test.jsx src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx
git commit -m "fix(ledger-ocean): rings are one roving tab stop; stable notes-toggle label; canvas role img

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Screenshots — river stage, ghost while typing, seal mid-flare — and the user's visual review

**Files:**
- Modify: `scripts/ledgerTabShots.mjs`

**Interfaces:**
- Consumes: the 3a script (`VIEWS`, `shot`, `at`, `clip`, `page.eval`, `page.waitFor`); preset buttons by label text; inputs `[data-field="<key>"] input`; `RUN AUDIT` button; sealed line `[data-sealing="true"]` (Task 9).
- Produces: per view, in addition to the 3a PNGs: `<view>-river-danube.png`, `<view>-river-bengal.png`, `<view>-river-yangtze.png`, `<view>-ghost.png`, `<view>-ghost-zoom.png`, `<view>-seal-flare.png`, `<view>-seal-flare-zoom.png`.

- [ ] **Step 1: Extend the script**

Update the header comment: after the 3a description add `// 3b, both views: zooms on the Danube, the Bay of Bengal and the Yangtze\n// (river-stage parcels, DO_MIN ticks); the USA preset moved inland to Wuhan\n// (the PROVISIONAL ghost while typing); then RUN AUDIT and a shot ~450 ms into\n// the seal flare. Submitting writes one verdict into the throwaway profile.`

Add after `const OPEN_WATER_AT = …;`:

```js
const GHOST_SITE = { lat: 30.59, lon: 114.3 };   // Wuhan: a user site ~9 cells inland
const ZOOMS = [
  ['river-danube', [12, 50], [31, 42]],
  ['river-bengal', [86, 26], [95, 19]],
  ['river-yangtze', [118, 34], [126, 28]],
];
const EAST_CHINA = [[110, 36], [126, 26]];
```

Insert immediately before `const errors = page.consoleErrors();`:

```js
      // ── 3b ──────────────────────────────────────────────────────────────
      const zoom = async (name, [lon0, lat1], [lon1, lat0]) => {
        const [x0, y0] = at([lon0, lat1]);
        const [x1, y1] = at([lon1, lat0]);
        await shot(page, name, {
          x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0),
          scale: v.mobile ? 2 : 3,
        });
      };
      await page.eval('window.scrollTo(0, 0)');
      for (const [name, a, b] of ZOOMS) await zoom(`${v.name}-${name}.png`, a, b);

      const clickText = (text) => page.eval(`(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)});
        if (b) b.click();
        return !!b;
      })()`);
      const setField = (field, value) => page.eval(`(() => {
        const el = document.querySelector('[data-field="${field}"] input');
        if (!el) return false;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(String(value))});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      if (!(await clickText('USA'))) throw new Error('USA preset button not found');
      if (!(await setField('lat', GHOST_SITE.lat)) || !(await setField('lon', GHOST_SITE.lon))) {
        throw new Error('coordinate inputs not found');
      }
      await sleep(600);
      await page.eval('window.scrollTo(0, 0)');
      await shot(page, `${v.name}-ghost.png`, clip);
      await zoom(`${v.name}-ghost-zoom.png`, ...EAST_CHINA);

      if (!(await clickText('RUN AUDIT'))) throw new Error('RUN AUDIT button not found');
      await page.waitFor(`!!document.querySelector('[data-sealing="true"]')`, { timeoutMs: 30000, label: 'seal' });
      await sleep(450);
      await page.eval('window.scrollTo(0, 0)');
      await shot(page, `${v.name}-seal-flare.png`, clip);
      await zoom(`${v.name}-seal-flare-zoom.png`, ...EAST_CHINA);
```

- [ ] **Step 2: Capture**

Run: `node scripts/ledgerTabShots.mjs`
Expected: 25 PNG paths (desktop 11, phone 14) and no console-error line. On a timeout or a thrown "not found", report BLOCKED with the message after opening the latest viewport PNG — do not change selectors blind.

- [ ] **Step 3: Look at every new PNG and describe it factually**

Open each PNG (Read tool). Report only what the pixels show:
- River zooms: parcels visible along the Danube (Linz → Sulina), the Lower Meghna and the Yangtze estuary; their colours (crimson/amber/green mix, dimming where deficit is high); one DO_MIN tick per course and where it sits (Danube tick near rkm 1776 ≈ a quarter of the way from Linz with candidate data); the preset rings (9) at the right sites; whether short courses (Citarum, Mercury, Hamhung) show anything.
- Ghost: dashed ring and dashed line Wuhan → coast, the `PROVISIONAL` label, half-alpha parcels on the line; no overlap problems with other rings/labels.
- Seal: the flare's position on the Wuhan line, the line solid (dashes closed), the latest-verdict ring; clock text and whether it reads as held.
- Phone (3×): the same at compact sizes; label and tick legibility; parcel size.

- [ ] **Step 4: Commit**

```bash
git add scripts/ledgerTabShots.mjs
git commit -m "chore(ledger): screenshots of the river stage, the ghost while typing and the seal mid-flare

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: STOP — the user's visual review**

The controller shows the PNGs to the user. Parcel size/alpha (`PARTICLE_PX`, `RIVER_PALETTE`), the flare size/duration, the ghost colour/dash/label and the tick size change only on the user's direction, in follow-up commits (re-captured with `node scripts/ledgerTabShots.mjs`, each change's tests re-run). The phase gate runs after the user signs off.

---

### Task 12: Phase gate

**Files:** none (verification only).

- [ ] **Step 1: Suite and lint**

Run: `npm test`
Expected: all green except the known `src/terminal/art/__tests__/artComposite.test.js` coarse-DPR failure. Record the pass/fail counts.
Run: `npm run lint`
Expected: `0 errors`, **≤ 137 warnings** (the script's cap is 143; the count at `1308af70` is 137 and must not grow). New warnings from 3b files are fixed in those files and their tests re-run.

- [ ] **Step 2: Real-GPU gates**

Run: `node scripts/oceanShaders.mjs` — exit 0, `particles.ok` true.
Run: `node scripts/oceanParity.mjs` — exit 0; record the per-channel final-step relative errors (the real case now has nine preset sources; no shader or oracle changed).
Run: `node scripts/oceanWarmup.mjs` — exit 0 (`laterTasks` empty, observer error null); record `warmWallMs`. (It measures the preview page with no archive, so `sourcesReady` defaults to true.)

- [ ] **Step 3: Boundary checks**

Run: `git diff --stat 1308af70..HEAD -- src/terminal/gl/glHost.js src/terminal/gl/frameLoop.js src/terminal/gl/useShaderCanvas.js src/terminal/gl/__tests__/__snapshots__ src/terminal/ledger/ocean/gpu/shaders.js src/terminal/ledger/ocean/referenceStep.js src/terminal/ledger/__tests__/auditPresets.test.js src/terminal/ledger/verdictModel.js src/terminal/ledger/verdictStore.js src/terminal/ledger/ledgerBus.js src/terminal/views/ledger/AuditCascade.jsx src/terminal/views/ledger/CoordinatePicker.jsx`
Expected: empty output.
Run: `git diff 1308af70..HEAD -- src/terminal/ledger/auditPresets.js src/terminal/gl/pingPong.js src/terminal/gl/__tests__/recordingGL.js | grep -E '^-[^-]'`
Expected: empty output (append-only).
Run: `diff <(git show 1308af70:src/terminal/ledger/ocean/gpu/oceanGpu.js | sed -n '/step({ reactions/,/^    },/p') <(sed -n '/step({ reactions/,/^    },/p' src/terminal/ledger/ocean/gpu/oceanGpu.js)`
Expected: empty output (`step()` byte-identical).
Run: `grep -rln "verdictStore\|ledgerBus" src/terminal/ledger/ocean src/terminal/views/ledger/ocean`
Expected: empty output.
Run: `git diff 1308af70..HEAD -- src/terminal/views/LedgerTab.jsx | grep -nE "^[-+].*(VERDICT_ISSUED|verdict_issued)"`
Expected: empty output (both emits are unchanged context).
Run: `git status --short -- docs src scripts`
Expected: only the pre-existing unrelated entries (`docs/superpowers/specs/2026-09-25-council-field-accretion-design.md`, `src/terminal/views/manifesto/__tests__/__snapshots__/councilField.test.jsx.snap`); nothing from 3b left unstaged.

- [ ] **Step 4: Visual confirmation**

Re-run `node scripts/ledgerTabShots.mjs` on the final HEAD and open the desktop and phone hero, river-zoom, ghost and seal PNGs; confirm they match what the user signed off in Task 11 (state any difference).

- [ ] **Step 5: Report**

Report: test counts, lint warning count, parity numbers, shader-check result, the warm-up measurement, the Task 3 research table (every number with its source or UNVERIFIED), the user's visual sign-off, and every mutation (all tasks) that did NOT fail. Do not push.
