# Ledger Ocean — Phase 3a (The Tab) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the phase-2 GL ocean into the live `/system/ledger` tab as the hero, with the spec §4 HUD and header, after fixing the phase-2 lifecycle hazards (resize, context loss, program-build leak, reduced-motion jank), and delete the old SVG map, particle burst and eclipse.

**Architecture:** `LedgerOcean` stays the orchestrator on `useShaderCanvas` (strategy `'lunar'`, WebGL2), but the host is built once per GL context (`deps: [generation]`) and resized in place through `hostRef.resize`, exactly like `CouncilField`. A new pure module `hudFormat.js` owns every HUD string and every lon/lat↔pixel mapping; `OceanHud.jsx` renders them and takes per-frame text through an imperative handle (no React re-render at display rate). Archived verdicts become ocean sources through phase-1 `verdictSourceSpec`/`buildSource`; the probe is a 1-texel float `readPixels` of the state texture.

**Tech Stack:** React 19, WebGL2 / GLSL ES 3.00, vitest 4 + jsdom 29 + @testing-library/react 16, the recording GL stub (`src/terminal/gl/__tests__/recordingGL.js`), `scripts/cdp.mjs` headless Chrome (`--enable-unsafe-swiftshader`), Vite 8 programmatic `createServer`.

**Spec:** `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md` — §2 Clock and Fallbacks, §3 honesty notes, §4 The tab, §5 Modules, §6 Testing, §7 Phases. **Phase-2 plan (what exists):** `docs/superpowers/plans/2026-09-29-ledger-ocean-phase2-gl.md`. **Reference for a resize-safe host:** `src/terminal/views/manifesto/CouncilField.jsx` (`deps: []` + `hostRef.resize` from a size effect; `webglcontextlost` listener).

## Plan decisions that refine the spec (flag to the user at hand-off)

1. **Phase 3 is split.** 3a = this plan (hazards, hero swap, HUD, header, deletions). 3b = river-stage particles + DO_MIN tick, the 4 new presets, form ghost / `onDraftChange`, seal sequence. See "Deferred to 3b".
2. **Verdicts become sources in 3a.** Phase 1 already ships `verdictSourceSpec` (straight-line course, `flow` taken literally in m³/s, v = 0.5 m/s). On `AuditCascade` `onComplete` the sealed verdict joins `verdicts`, `LedgerOcean` adds it as a permanent source and rings its site. No eclipse, no burst, no clock ease (the seal is 3b). Q is literal, as §3 says; decision 2's word "brighter" is not implemented (a user plume at ≤ 100 m³/s will be faint beside the Mississippi at 16,570 m³/s).
3. **Preset rings are neutral teal (`#14b8a6`), labelled `AMBIENT PRESET`.** Presets have no kernel ruling, so there is no status to colour them by. Verdict rings use `STATUS_COLOR` (moved verbatim from `LedgerMap.jsx`).
4. **A failed sim-program build falls back to the static coastline** with `STATIC · SIM SHADERS FAILED`, after releasing every GL object it created.
5. **A lost context suspends the ocean** (`OCEAN SUSPENDED · GPU CONTEXT LOST`); on `webglcontextrestored` the canvas is remounted and the ocean restarts from T+0 (the state lived in GPU memory).
6. **Reduced motion:** the 200-day warm-up is spread at 16 steps per frame (50 frames), nothing is painted until it is done, then one frame is held; it repaints only on resize. A new verdict under reduced motion re-runs the warm-up, then repaints once.
7. **Step cap under load** (spec §2, §4 Mobile) is implemented in the driver on all devices: rolling frame interval (EMA, τ = 0.5 s) > 20 ms ⇒ cap 4, else 8.
8. **Mobile** = hero width < 640 px. The HUD keeps the clock *and* the compression control top-left (the control is part of the clock), the legend bottom-left; the tapped probe replaces the legend for 5 s.
9. **DO_sat carry-over:** instead of a salinity term, the legend states `DO_SAT FRESHWATER FIT · ~20% HIGH AT SEA` (phase-1 carry-over "add a salinity term or a legend note").
10. **Spec §3/§5/§6 text is corrected** to say river data lives in `riverCourses.js` (phase 2's refinement), and §3 records the user's Ganges decision (Meghna estuary, combined G–B–M Q ≈ 38,000 m³/s — applied in 3b).

## Global Constraints

- Branch `feature/ledger-advection`, base commit `cdf3e864`. Never push. Never run `vitest -u`.
- Commits end with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The working tree has unrelated dirty and untracked files (`.import-cache.json`, `baseline/…`, a council spec and snapshot): **stage only the paths named in the task** (`git add <path>…`, never `git add -A` / `git add .`).
- **Mutation rule:** every new test (and each gate script) must be shown to FAIL against a deliberate break of the implementation, then the break is reverted exactly (`git diff` shows only the intended change). Each task lists its mutations. Record every mutation that did NOT fail in the task report. This repo shipped vacuous GL tests three times.
- **Never loosen** an assertion, tolerance or threshold to get green. Measure, report BLOCKED, let the controller decide.
- **Never claim a visual result without a screenshot** you have opened (Read tool on the PNG).
- Known unrelated failure: `src/terminal/art/__tests__/artComposite.test.js` (coarse-pointer DPR case). Ignore it in full-suite runs; any other failure blocks.
- Commands (Git Bash): single file `npx vitest run <path>`; suite `npm test`; lint `npm run lint` must report **0 errors and ≤ 143 warnings** (`--max-warnings 143` in `package.json`; fix new warnings in new code, never raise the ratchet).
- Existing GL call-log snapshots under `src/terminal/gl/__tests__/__snapshots__/` stay byte-identical. `glHost.js`, `frameLoop.js`, `useShaderCanvas.js`, `shaders.js`, `referenceStep.js` are not modified in 3a; the `pingPong.js` change is additive (`readTexel`); `oceanGpu.js` changes are limited to the release path (Task 1) and `readCell` (Task 4), with `step()` untouched.
- Untouched in 3a: `src/terminal/ledger/auditPresets.js`, `src/terminal/ledger/verdictStore.js`, `src/terminal/ledger/ledgerBus.js`, `src/terminal/views/ledger/AuditCascade.jsx`, `src/terminal/views/ledger/SubmissionForm.jsx`, `src/terminal/views/ledger/CoordinatePicker.jsx`. `ledgerBus` `VERDICT_ISSUED` and the observatory `emit('transmissions', 'verdict_issued', …)` keep their exact payloads.
- The sim never writes to the ledger: nothing under `src/terminal/ledger/ocean/` or `src/terminal/views/ledger/ocean/` imports `verdictStore` or `ledgerBus`.
- Nothing is frame-counted: simulated time only from `createStepClock` (wall ms × days/s). The reduced-motion warm-up is a fixed total of steps (800) scheduled across frames; its end state does not depend on frame rate.
- Exact values:
  - Grid 512×256, Δt = 0.25 d (`DT_DAYS`), hero aspect 2:1, `height = Math.round(width / 2)`.
  - Compression presets `[1, 3, 9, 30]` d per wall second, default 9; control text `1 s = 9 d`.
  - Step cap 8 (`STEP_CAP`), 4 (`STEP_CAP_LOADED`) when the rolling frame interval > 20 ms (`LOAD_FRAME_MS`), EMA time constant 0.5 s (`FRAME_TAU_S`).
  - Reduced motion: `REDUCED_MOTION_DAYS = 200` (800 steps), `WARMUP_STEPS_PER_FRAME = 16`.
  - Probe: 1-px `readPixels(i, j, 1, 1, RGBA, FLOAT)` of the state texture, at most every 100 ms of frame time (`PROBE_INTERVAL_MS`); tap readout held 5000 ms (`PROBE_TAP_HOLD_MS`).
  - Frame-monitor text refresh ≥ 250 ms apart; clock text written whenever it changes.
  - Mobile/compact: hero width < 640 px (`COMPACT_BELOW_PX`).
  - `STATUS_COLOR = { APPROVED: '#22c55e', CONDITIONAL: '#eab308', REJECTED: '#ef4444', EMERGENCY_VETO: '#ef4444' }`, `DEFAULT_COLOR = '#38bdf8'`, `PRESET_COLOR = '#14b8a6'`.
- Copy, verbatim:
  - Header eyebrow `The Open Ledger` + version tag `v2.0`; h1 `HYDROLOGICAL AUDIT & OUTFALL DISPERSION`; subtitle keeps its current text ending "The equations are the authority." and adds the closing line `Every verdict drains somewhere. The ocean keeps the account.`
  - HUD title `THE OPEN LEDGER v2.0`.
  - Legend notes: `MODEL KINETICS · LITERATURE RANGES`, `PRESET LOADS NARRATIVE-TUNED · NOT MEASURED`, `CLIMATOLOGICAL CURRENTS · NOT FORECAST`, `POINT SOURCE · PLUG FLOW · NO TRIBUTARIES`, `USER SITES · STRAIGHT-LINE APPROX`, `DO_SAT FRESHWATER FIT · ~20% HIGH AT SEA`; probe note `MODEL VALUES · NOT MEASURED`; probe hint `HOVER TO PROBE`.
  - Mode labels: `STATIC · NO FLOAT TARGETS`, `STATIC · SIM SHADERS FAILED`, `OCEAN UNAVAILABLE · NO WEBGL2`, `OCEAN SUSPENDED · GPU CONTEXT LOST`.
- jsdom facts the tests rely on: `window.devicePixelRatio` is 1; `document.hidden` is false (vitest's jsdom uses `pretendToBeVisual: true`); `window.matchMedia` is undefined unless stubbed; `PointerEvent` exists (jsdom 29).

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/ledger/ocean/gpu/oceanGpu.js` (modify) | release every GL object if a program build throws; `readCell(i, j)` |
| `src/terminal/gl/pingPong.js` (modify, additive) | `readTexel(gl, target, x, y)` |
| `src/terminal/ledger/ocean/sources.js` (modify, additive) | `verdictSources(verdicts, grid, mask)` |
| `src/terminal/views/ledger/ocean/oceanDriver.js` (modify) | spread warm-up, `resetWarmup`, rolling frame time, load step cap |
| `src/terminal/views/ledger/ocean/hudFormat.js` (new) | mode labels, HUD copy, colours, all HUD strings and lon/lat↔px maths |
| `src/terminal/views/ledger/ocean/OceanHud.jsx` (new) | HUD overlay: clock, compression, frame monitor, title, summary, legend, probe, source rings + tooltip |
| `src/terminal/views/ledger/ocean/LedgerOcean.jsx` (modify) | lifecycle fixes, verdict sources, probe, compression state, HUD mount |
| `src/terminal/views/ledger/ocean/previewMain.jsx` (modify) | publish `readyAt` / `warmAt` for the warm-up measurement |
| `scripts/oceanWarmup.mjs` (new) | measures the reduced-motion warm-up in headless Chrome |
| `scripts/ledgerTabShots.mjs` (new) | desktop + phone screenshots of the live tab |
| `src/terminal/views/LedgerTab.jsx` (modify) | ocean hero, header v2.0, no map/particles/eclipse |
| `src/terminal/views/ledger/LedgerMap.jsx`, `LedgerParticles.jsx` (delete) | — |
| `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md` (modify) | river-block drift, Ganges decision, phase-3 split |
| tests: `src/terminal/ledger/ocean/__tests__/{oceanGpu,sources}.test.js`, `src/terminal/gl/__tests__/pingPong.test.js`, `src/terminal/views/ledger/ocean/__tests__/{oceanDriver.test.js,LedgerOcean.test.jsx,hudFormat.test.js,OceanHud.test.jsx}`, `src/terminal/views/__tests__/LedgerTab.test.jsx` (new) | |

## Deferred to 3b

- River-stage Lagrangian particles (~256 per river, Manning velocity, §1 palette) and the **DO_MIN tick** on each course with its `DO_MIN … @ rkm …` HUD readout. (3a shows the DO_MIN *value* in the ring tooltip only; there is no tick.)
- The 4 new presets (`yangtze`, `ganges`, `citarum`, `danube`) with sourced `RIVERS` entries; **Ganges = Meghna estuary with the combined G–B–M Q ≈ 38,000 m³/s** (user decision); Danube rkm from Linz verified; preset row 5 → 9; the §6 "All 9 presets pass `validateSubmission`" test.
- `SubmissionForm` `onDraftChange(params)` and the dashed `PROVISIONAL` ghost source (coalesced to one update per animation frame; invalid values freeze the ghost).
- The seal sequence: clock eases to near-stop over ~0.6 s while `AuditCascade` runs, ghost seals on `onComplete` (dashes close, one flare along the course), clock eases back.

---

### Task 1: Release GL objects when a sim program fails to build

The phase-2 runner builds five programs in a loop after allocating 7 textures and 4 framebuffers. If program 3 fails to compile/link, `buildProgram` throws and everything already allocated leaks; the throw also escapes `onInit`, so the whole host fails and the view reports `OCEAN UNAVAILABLE · NO WEBGL2`, which is false.

**Files:**
- Modify: `src/terminal/ledger/ocean/gpu/oceanGpu.js:35-55, 135-141`
- Create: `src/terminal/views/ledger/ocean/hudFormat.js`
- Modify: `src/terminal/views/ledger/ocean/LedgerOcean.jsx:42-57, 108-114`
- Test: `src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`, `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx`

**Interfaces:**
- Consumes: `buildProgram(gl, vs, fs, { label })` throws `Error('[label] program failed to link: …')` after deleting the failed program (`src/terminal/gl/glHost.js:145-160`).
- Produces: `createOceanGpu` throws the original error after deleting every program, texture and framebuffer it created. `MODE_LABEL` in `hudFormat.js`: `{ static, 'static-shader', unsupported, lost }` → the four mode-label strings in Global Constraints. `LedgerOcean` mode values: `'live' | 'static' | 'static-shader' | 'unsupported'` (Task 3 adds `'lost'`).

- [ ] **Step 1: Write the failing runner test**

Append inside `describe('createOceanGpu', …)` in `src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`:

```js
  it('releases every GL object when a sim program fails to build, then rethrows', () => {
    const gl = withFloat();
    let links = 0;
    gl.getProgramParameter = () => { links += 1; return links !== 3; }; // the 3rd sim program fails to link
    expect(() => make(gl)).toThrow(/failed to link/);
    const n = (name) => gl.__log.filter((e) => e[0] === name).length;
    expect(n('createTexture')).toBe(7);
    expect(n('deleteTexture')).toBe(n('createTexture'));
    expect(n('createFramebuffer')).toBe(4);
    expect(n('deleteFramebuffer')).toBe(n('createFramebuffer'));
    expect(n('createProgram')).toBe(3);
    expect(n('deleteProgram')).toBe(n('createProgram'));
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`
Expected: FAIL — `deleteTexture` count 0 vs 7 (the throw escapes with nothing released).

- [ ] **Step 3: Implement the cleanup in `oceanGpu.js`**

Replace lines 34–55 (from `const textures = …` through the closing `}` of the program loop) with:

```js
  const textures = [staticTex, rowsTex, sourcesTex];
  const P = {};
  // One release path for construction failure and for dispose(): programs,
  // ping-pong, scratch targets, then the plain textures.
  const release = () => {
    for (const { prog } of Object.values(P)) gl.deleteProgram(prog);
    state?.dispose();
    disposeTarget(gl, fwd);
    disposeTarget(gl, corr);
    for (const t of textures) gl.deleteTexture(t);
  };
  if (!state || !fwd || !corr) {
    release();
    return null;
  }

  try {
    for (const [name, def] of Object.entries(SIM_PROGRAMS)) {
      const prog = buildProgram(gl, SIM_VS, def.fs, { label: `ocean:${name}` });
      const U = {};
      for (const u of [...SHARED_UNIFORMS, ...def.uniforms]) U[u] = gl.getUniformLocation(prog, u);
      gl.useProgram(prog);
      gl.uniform1i(U.uStatic, UNIT.static);
      gl.uniform1i(U.uRows, UNIT.rows);
      gl.uniform2f(U.uGrid, nx, ny);
      gl.uniform1f(U.uCellKm, grid.cellKm);
      for (const u of def.uniforms) if (u in SAMPLER_UNITS) gl.uniform1i(U[u], SAMPLER_UNITS[u]);
      P[name] = { prog, U };
    }
  } catch (err) {
    // A program that fails mid-loop must not strand the 7 textures, 4
    // framebuffers and the programs already built. buildProgram has already
    // deleted the failed program itself.
    release();
    throw err;
  }
```

and replace the `dispose()` method body (old lines 135–141) with:

```js
    dispose() {
      release();
    },
```

- [ ] **Step 4: Run the runner tests**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`
Expected: PASS (all tests, including the existing four).

- [ ] **Step 5: Write the failing view test**

Create `src/terminal/views/ledger/ocean/hudFormat.js`:

```js
// hudFormat.js — pure text and geometry for the Ledger ocean HUD (spec §4).
// No React and no GL, so every string the HUD shows is unit-tested.

export const MODE_LABEL = {
  static: 'STATIC · NO FLOAT TARGETS',
  'static-shader': 'STATIC · SIM SHADERS FAILED',
  unsupported: 'OCEAN UNAVAILABLE · NO WEBGL2',
  lost: 'OCEAN SUSPENDED · GPU CONTEXT LOST',
};
```

Append to `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx` inside `describe('LedgerOcean', …)`:

```js
  it('falls back to the static coastline, with nothing leaked, when a sim program fails to build', () => {
    rec = installRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
    let links = 0;
    // link 1 = the host's display program; 2..6 = the five sim programs. Fail the 3rd sim program.
    rec.gl.getProgramParameter = () => { links += 1; return links !== 4; };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LedgerOcean width={512} height={256} />);
    const n = (name) => rec.log.filter((e) => e[0] === name).length;
    expect(screen.getByText('STATIC · SIM SHADERS FAILED')).toBeTruthy();
    expect(screen.queryByText('OCEAN UNAVAILABLE · NO WEBGL2')).toBeNull();
    expect(n('createProgram')).toBe(n('deleteProgram') + 1);   // only the display program lives
    expect(n('createFramebuffer')).toBe(n('deleteFramebuffer'));
    expect(n('createTexture')).toBe(n('deleteTexture') + 2);   // the static fallback's two textures
    expect(n('drawArrays')).toBe(1);                           // the static frame was painted
  });
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx`
Expected: FAIL — `STATIC · SIM SHADERS FAILED` not found (the throw escapes `onInit`; the view says `OCEAN UNAVAILABLE · NO WEBGL2`).

- [ ] **Step 7: Implement the fallback in `LedgerOcean.jsx`**

Add the import after the `oceanDriver` import:

```js
import { MODE_LABEL } from './hudFormat';
```

Change the mode comment on line 28 to `// 'live' | 'static' | 'static-shader' | 'unsupported'`.

Replace the `onInit` body (lines 42–57) with:

```js
    onInit: (gl, { vao }) => {
      const { grid } = world;
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
        sim.setSources(world.ambientSourceData);
        simRef.current = sim;
        driverRef.current = createOceanDriver({ clock: createStepClock(), step: () => sim.step() });
        texRef.current = { static: sim.staticTexture(), zero: null };
      } else {
        texRef.current = {
          static: createFloatTexture(gl, grid.nx, grid.ny, world.staticData),
          zero: createFloatTexture(gl, grid.nx, grid.ny, new Float32Array(grid.n * 4)),
        };
        setMode(failed ? 'static-shader' : 'static');
      }
    },
```

Replace the label ternary on line 112 with `{MODE_LABEL[mode]}`.

- [ ] **Step 8: Run the view tests**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`
Expected: PASS (4 view tests, 5 runner tests).

- [ ] **Step 9: Mutation checks**

Each break must make the named test FAIL; revert each exactly before the next.
1. In `oceanGpu.js` catch block, delete the `release();` line → runner test fails (deleteTexture 0).
2. In `release`, delete the `for (const { prog } of Object.values(P)) …` line → runner test fails on deleteProgram.
3. In `LedgerOcean.jsx` onInit, change `setMode(failed ? 'static-shader' : 'static')` to `setMode('static')` → view test fails.
4. Remove the `try`/`catch` around `createOceanGpu` in `LedgerOcean.jsx` (call it directly) → view test fails.

- [ ] **Step 10: Commit**

```bash
git add src/terminal/ledger/ocean/gpu/oceanGpu.js src/terminal/ledger/ocean/__tests__/oceanGpu.test.js src/terminal/views/ledger/ocean/hudFormat.js src/terminal/views/ledger/ocean/LedgerOcean.jsx src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx
git commit -m "fix(ledger-ocean): release GL objects when a sim program fails; fall back to the static coastline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Driver — spread warm-up, load step cap; measure the current warm-up

Today `warmupOnce(200)` runs 800 steps synchronously in the mount frame under `prefers-reduced-motion`. This task first **measures** that, then adds the driver API that spreads it. `warmupOnce` stays until Task 3 switches the view over.

**Files:**
- Modify: `src/terminal/views/ledger/ocean/previewMain.jsx` (whole file)
- Create: `scripts/oceanWarmup.mjs`
- Modify: `src/terminal/views/ledger/ocean/oceanDriver.js` (whole file)
- Test: `src/terminal/views/ledger/ocean/__tests__/oceanDriver.test.js`

**Interfaces:**
- Consumes: `createStepClock()` → `{ advance(wallMs, daysPerSecond) → steps, setMaxSteps(m), reset() }` (default cap 8); `launch({ url, width, height })` → page with `send(method, params)`, `goto(url)`, `eval(expr)`, `waitFor(expr, { timeoutMs, label })`, `close()`.
- Produces (`oceanDriver.js`): constants `REDUCED_MOTION_DAYS = 200`, `WARMUP_STEPS_PER_FRAME = 16`, `STEP_CAP = 8`, `STEP_CAP_LOADED = 4`, `LOAD_FRAME_MS = 20`, `FRAME_TAU_S = 0.5`; `createOceanDriver({ clock, step, dtDays })` → `{ advance(dtSec, daysPerSecond) → steps, warmupOnce(targetDays) → steps` (kept until Task 3), `warmupChunk(targetDays, perFrame = WARMUP_STEPS_PER_FRAME) → boolean done, resetWarmup(), simDays() → number, frameMs() → number }`.
- Produces (preview): `window.__ocean = { ready, readyAt, simDays, warmAt }` (`performance.now()` stamps of the first frame and of the first frame at ≥ 200 simulated days).

- [ ] **Step 1: Instrument the preview page**

Replace `src/terminal/views/ledger/ocean/previewMain.jsx` with:

```jsx
// Dev-only preview for the Ledger ocean (ledger-ocean-preview.html).
// Query: ?w=1024 (canvas CSS width; height = w/2) &dps=9 (simulated days per second).
// Publishes window.__ocean = { ready, readyAt, simDays, warmAt } for the CDP
// scripts (readyAt / warmAt are performance.now() stamps).
import { createRoot } from 'react-dom/client';
import LedgerOcean from './LedgerOcean';
import { REDUCED_MOTION_DAYS } from './oceanDriver';

const q = new URLSearchParams(window.location.search);
const w = Number(q.get('w') || 1024);
const dps = Number(q.get('dps') || 9);
window.__ocean = { ready: false, readyAt: null, simDays: 0, warmAt: null };

function onFrame(d) {
  const o = window.__ocean;
  if (!o.ready) {
    o.ready = true;
    o.readyAt = performance.now();
  }
  o.simDays = d;
  if (o.warmAt === null && d >= REDUCED_MOTION_DAYS - 1e-6) o.warmAt = performance.now();
}

createRoot(document.getElementById('root')).render(
  <LedgerOcean width={w} height={w / 2} daysPerSecond={dps} onFrame={onFrame} />,
);
```

- [ ] **Step 2: Create `scripts/oceanWarmup.mjs`**

```js
// Reduced-motion warm-up cost on the Ledger ocean preview (headless Chrome,
// SwiftShader). Emulates prefers-reduced-motion, records main-thread long
// tasks (≥ 50 ms) and rAF timestamps, and prints:
//   mountTaskMs   — the long task containing the first ocean frame (0 = none ≥ 50 ms)
//   laterTasks    — durations of long tasks after it (a spread warm-up leaves none)
//   maxFrameGapMs — largest rAF interval between first frame and warm. INFO ONLY:
//                   SwiftShader rasterises on the CPU, so this is not a real-GPU figure.
//   warmWallMs    — first frame → 200 simulated days
//
//   node scripts/oceanWarmup.mjs
import { createServer } from 'vite';
import { launch } from './cdp.mjs';

const RECORDER = `(() => {
  window.__lt = [];
  window.__raf = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lt.push([e.startTime, e.duration]);
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) { window.__ltError = String(e); }
  const tick = (t) => { window.__raf.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

const REPORT = `JSON.stringify((() => {
  const o = window.__ocean;
  const lt = window.__lt;
  const mount = lt.find(([s, d]) => s <= o.readyAt && o.readyAt <= s + d);
  const later = lt.filter(([s]) => s > o.readyAt).map(([, d]) => Math.round(d));
  const raf = window.__raf.filter((t) => t >= o.readyAt && t <= o.warmAt);
  let gap = 0;
  for (let i = 1; i < raf.length; i++) gap = Math.max(gap, raf[i] - raf[i - 1]);
  return {
    mountTaskMs: mount ? Math.round(mount[1]) : 0,
    laterTasks: later,
    maxFrameGapMs: Math.round(gap),
    warmWallMs: Math.round(o.warmAt - o.readyAt),
    simDays: o.simDays,
    longTaskObserverError: window.__ltError ?? null,
  };
})())`;

const server = await createServer({
  server: { port: 5197, strictPort: false, host: '127.0.0.1' },
  logLevel: 'error',
});
await server.listen();
const base = server.resolvedUrls.local[0];
let out = null;
let page;
try {
  page = await launch({ url: 'about:blank', width: 1056, height: 560 });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER });
  await page.goto(`${base}ledger-ocean-preview.html?w=1024&dps=9`);
  await page.waitFor('window.__ocean && window.__ocean.warmAt !== null', { timeoutMs: 180000, label: 'warm-up' });
  await new Promise((r) => setTimeout(r, 500));
  out = JSON.parse(await page.eval(REPORT));
} finally {
  if (page) await page.close();
  await server.close();
}
console.log(JSON.stringify(out, null, 2));
process.exit(out && out.simDays >= 199.99 ? 0 : 1);
```

- [ ] **Step 3: Measure the current (synchronous) warm-up — the baseline**

Run: `node scripts/oceanWarmup.mjs`
Expected: exit 0; `warmWallMs` 0 (all 800 steps in the mount frame) and `mountTaskMs` > 0. Record the full JSON in the task report and in the commit message body. If `longTaskObserverError` is non-null, report BLOCKED (the measurement is void).

- [ ] **Step 4: Write the failing driver tests**

Replace `src/terminal/views/ledger/ocean/__tests__/oceanDriver.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import { createStepClock } from '../../../../ledger/ocean/clock';
import {
  createOceanDriver, REDUCED_MOTION_DAYS, WARMUP_STEPS_PER_FRAME, LOAD_FRAME_MS,
  STEP_CAP, STEP_CAP_LOADED,
} from '../oceanDriver';

const counting = () => {
  let n = 0;
  return { step: () => { n++; }, count: () => n };
};

describe('createOceanDriver', () => {
  it('turns wall seconds into clock steps and counts simulated days', () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    let total = 0;
    for (let f = 0; f < 60; f++) total += d.advance(1 / 60, 9);
    expect(total).toBe(36);
    expect(s.count()).toBe(36);
    expect(d.simDays()).toBeCloseTo(9, 9);
  });

  it('warms up once for reduced motion', () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    expect(d.warmupOnce(REDUCED_MOTION_DAYS)).toBe(800);
    expect(d.warmupOnce(REDUCED_MOTION_DAYS)).toBe(0);
    expect(s.count()).toBe(800);
    expect(d.simDays()).toBeCloseTo(200, 9);
  });

  it('spreads the reduced-motion warm-up over frames, a fixed number of steps each', () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    let calls = 0;
    let done = false;
    while (!done) {
      const before = s.count();
      done = d.warmupChunk(REDUCED_MOTION_DAYS);
      expect(s.count() - before).toBeLessThanOrEqual(WARMUP_STEPS_PER_FRAME);
      calls++;
      expect(calls).toBeLessThan(1000);
    }
    expect(s.count()).toBe(800);
    expect(calls).toBe(Math.ceil(800 / WARMUP_STEPS_PER_FRAME));
    expect(d.simDays()).toBeCloseTo(200, 9);
    expect(d.warmupChunk(REDUCED_MOTION_DAYS)).toBe(true);
    expect(s.count()).toBe(800);
  });

  it('runs a full second warm-up after resetWarmup', () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    while (!d.warmupChunk(REDUCED_MOTION_DAYS));
    d.resetWarmup();
    expect(d.warmupChunk(REDUCED_MOTION_DAYS)).toBe(false);
    while (!d.warmupChunk(REDUCED_MOTION_DAYS));
    expect(s.count()).toBe(1600);
    expect(d.simDays()).toBeCloseTo(400, 9);
  });

  it(`drops the step cap to ${STEP_CAP_LOADED} while the rolling frame time exceeds ${LOAD_FRAME_MS} ms, and restores ${STEP_CAP}`, () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    for (let f = 0; f < 60; f++) d.advance(0.05, 30);   // 50 ms frames owe 6 steps each
    expect(d.frameMs()).toBeGreaterThan(LOAD_FRAME_MS);
    expect(d.advance(0.05, 30)).toBe(STEP_CAP_LOADED);
    for (let f = 0; f < 120; f++) d.advance(0.016, 200); // 16 ms frames owe 12.8 steps each
    expect(d.frameMs()).toBeLessThan(LOAD_FRAME_MS);
    expect(d.advance(0.016, 200)).toBe(STEP_CAP);
  });

  it('reports a rolling frame time of 0 before any frame and ignores dt = 0', () => {
    const d = createOceanDriver({ clock: createStepClock(), step: () => {} });
    expect(d.frameMs()).toBe(0);
    d.advance(0, 9);
    expect(d.frameMs()).toBe(0);
    d.advance(0.016, 9);
    expect(d.frameMs()).toBeCloseTo(16, 9);
  });
});
```

- [ ] **Step 5: Run to verify they fail**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/oceanDriver.test.js`
Expected: FAIL — `d.warmupChunk is not a function`, `d.frameMs is not a function`; the first two tests pass.

- [ ] **Step 6: Implement the driver**

Replace `src/terminal/views/ledger/ocean/oceanDriver.js` with:

```js
// oceanDriver.js — turns frame time into ocean steps. Wall time only (via the
// step clock), never frame counts. Reduced motion runs a warm-up spread over
// frames (a fixed number of steps per frame, the same 800-step total at any
// frame rate) so the held frame shows a settled ocean without one long
// main-thread block. Under load — rolling frame interval above 20 ms — the
// per-frame step cap drops from 8 to 4 (spec §2 Clock, §4 Mobile).

import { DT_DAYS } from '../../../ledger/ocean/grid';

export const REDUCED_MOTION_DAYS = 200;
export const WARMUP_STEPS_PER_FRAME = 16;
export const STEP_CAP = 8;
export const STEP_CAP_LOADED = 4;
export const LOAD_FRAME_MS = 20;
export const FRAME_TAU_S = 0.5;

export function createOceanDriver({ clock, step, dtDays = DT_DAYS }) {
  let days = 0;
  let warmed = false;
  let warmSteps = 0;
  let frameMs = 0;
  const run = (n) => {
    for (let s = 0; s < n; s++) step();
    days += n * dtDays;
    return n;
  };
  return {
    advance(dtSec, daysPerSecond) {
      if (dtSec > 0 && Number.isFinite(dtSec)) {
        const ms = dtSec * 1000;
        frameMs = frameMs === 0 ? ms : frameMs + (1 - Math.exp(-dtSec / FRAME_TAU_S)) * (ms - frameMs);
        clock.setMaxSteps(frameMs > LOAD_FRAME_MS ? STEP_CAP_LOADED : STEP_CAP);
      }
      return run(clock.advance(dtSec * 1000, daysPerSecond));
    },
    // Phase-2 API; LedgerOcean stops using it in phase 3a Task 3, which deletes it.
    warmupOnce(targetDays) {
      if (warmed) return 0;
      warmed = true;
      return run(Math.round(targetDays / dtDays));
    },
    warmupChunk(targetDays, perFrame = WARMUP_STEPS_PER_FRAME) {
      const total = Math.round(targetDays / dtDays);
      const n = Math.max(0, Math.min(perFrame, total - warmSteps));
      run(n);
      warmSteps += n;
      return warmSteps >= total;
    },
    resetWarmup() {
      warmSteps = 0;
    },
    simDays() {
      return days;
    },
    frameMs() {
      return frameMs;
    },
  };
}
```

- [ ] **Step 7: Run the driver tests**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/oceanDriver.test.js`
Expected: PASS (6 tests).

- [ ] **Step 8: Mutation checks**

1. `warmupChunk`: replace `Math.min(perFrame, total - warmSteps)` with `total - warmSteps` → the spread test fails.
2. `resetWarmup`: make the body empty → the reset test fails.
3. `advance`: delete the `clock.setMaxSteps(…)` line → the cap test fails (returns 6).
4. `advance`: change the cap line to `if (frameMs > LOAD_FRAME_MS) clock.setMaxSteps(STEP_CAP_LOADED);` → the cap test fails on the restore (returns 4).
5. `advance`: remove the `dtSec > 0 &&` guard → the dt = 0 test fails.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/views/ledger/ocean/previewMain.jsx scripts/oceanWarmup.mjs src/terminal/views/ledger/ocean/oceanDriver.js src/terminal/views/ledger/ocean/__tests__/oceanDriver.test.js
git commit -m "feat(ledger-ocean): driver spreads the reduced-motion warm-up and caps steps under load

Baseline (synchronous warm-up), node scripts/oceanWarmup.mjs:
<paste the Step 3 JSON here>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: LedgerOcean lifecycle — resize in place, context loss, live frames, reduced motion

Phase-2 hazards fixed here: (a) `deps: [width, height]` + `loseContextOnDispose` (glHost default) means any size change disposes the host, calls `loseContext()`, and the rebuilt host gets the same, now dead, context from `getContext()` → permanent `OCEAN UNAVAILABLE`; (b) no `webglcontextlost`/`webglcontextrestored` handling; (c) the only view tests run the mount draw (`dt = 0`), never the per-frame path; (d) the synchronous 800-step warm-up. Then the spec text drift is corrected.

**Files:**
- Modify: `src/terminal/views/ledger/ocean/LedgerOcean.jsx` (whole file)
- Modify: `src/terminal/views/ledger/ocean/oceanDriver.js` (delete `warmupOnce` and `warmed`)
- Test: `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx` (whole file), `src/terminal/views/ledger/ocean/__tests__/oceanDriver.test.js` (delete the `warmupOnce` test)
- Modify: `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md`

**Interfaces:**
- Consumes: `useShaderCanvas(canvasRef, opts)` → `{ snap, hostRef }` with `hostRef.current = { gl, prog, U, vao, buf, resize(w, h), dispose() }` (null when unsupported); options used: `version, strategy, vs, fs, uniforms, pixelSize, setStyleSize, blend, contextOptions, label, trackVisibility, haltOnReducedMotion, onInit(gl, { vao }), onDispose(gl), draw(host, { now, dt, tsec, hidden, reducedMotion }), onUnsupported, deps`. Driver API from Task 2. `MODE_LABEL` from Task 1.
- Produces: `LedgerOcean({ width, height, daysPerSecond = 9, onFrame = null })` (props unchanged); `onFrame(simDays)` is called once per non-lost draw; mode `'lost'` added. The canvas is remounted (`key = generation`) on context restore.

- [ ] **Step 1: Write the failing tests**

Replace `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx` with:

```jsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { installRecordingGL } from '../../../../gl/__tests__/recordingGL';
import { OCEAN_GRID, DT_DAYS } from '../../../../ledger/ocean/grid';
import { diffusionSchedule, EDDY_DIFFUSIVITY_KM2_DAY } from '../../../../ledger/ocean/referenceStep';
import { createStepClock } from '../../../../ledger/ocean/clock';
import { REDUCED_MOTION_DAYS, WARMUP_STEPS_PER_FRAME } from '../oceanDriver';
import { MODE_LABEL } from '../hudFormat';
import LedgerOcean from '../LedgerOcean';

const FRAME_MS = 16;
const FLOAT = ['EXT_color_buffer_float'];
const WARM_FRAMES = Math.ceil(REDUCED_MOTION_DAYS / DT_DAYS / WARMUP_STEPS_PER_FRAME);

let rec = null;
afterEach(() => {
  cleanup();
  rec?.restore();
  rec = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const count = (name) => rec.log.filter((e) => e[0] === name).length;
// One composite paint = one uRes upload (no sim program has uRes).
const paints = () => rec.log.filter(([n, loc]) => n === 'uniform2f' && /:uRes$/.test(String(loc))).length;
const reduceMotion = () => vi.stubGlobal('matchMedia', (q) => ({
  matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {},
}));

// Fake rAF/performance/timers on one clock, the recording GL stub, and a
// frame pump. Every frame is FRAME_MS of wall time.
function mountLive(ui, { extensions = FLOAT } = {}) {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout', 'Date'],
  });
  rec = installRecordingGL({ version: 2, extensions });
  const out = render(ui);
  const frames = (n) => {
    for (let f = 0; f < n; f++) act(() => { vi.advanceTimersByTime(FRAME_MS); });
  };
  return { ...out, frames };
}

describe('LedgerOcean', () => {
  it('runs the GPU ocean when float targets exist', () => {
    rec = installRecordingGL({ version: 2, extensions: FLOAT });
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByLabelText(/Ledger ocean/)).toBeTruthy();
    expect(screen.queryByText(MODE_LABEL.static)).toBeNull();
    expect(rec.log.some((e) => e[0] === 'framebufferTexture2D')).toBe(true);
    expect(rec.log.some((e) => e[0] === 'drawArrays')).toBe(true);
  });

  it('falls back to a static coastline without float targets', () => {
    rec = installRecordingGL({ version: 2 });
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByText(MODE_LABEL.static)).toBeTruthy();
    expect(rec.log.some((e) => e[0] === 'framebufferTexture2D')).toBe(false);
    expect(rec.log.some((e) => e[0] === 'drawArrays')).toBe(true);
  });

  it('says so when there is no WebGL2 at all', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByText(MODE_LABEL.unsupported)).toBeTruthy();
  });

  it('falls back to the static coastline, with nothing leaked, when a sim program fails to build', () => {
    rec = installRecordingGL({ version: 2, extensions: FLOAT });
    let links = 0;
    // link 1 = the host's display program; 2..6 = the five sim programs. Fail the 3rd sim program.
    rec.gl.getProgramParameter = () => { links += 1; return links !== 4; };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByText(MODE_LABEL['static-shader'])).toBeTruthy();
    expect(screen.queryByText(MODE_LABEL.unsupported)).toBeNull();
    expect(count('createProgram')).toBe(count('deleteProgram') + 1);
    expect(count('createFramebuffer')).toBe(count('deleteFramebuffer'));
    expect(count('createTexture')).toBe(count('deleteTexture') + 2);
    expect(count('drawArrays')).toBe(1);
  });
});

describe('LedgerOcean lifecycle', () => {
  it('steps the sim on the frame loop by wall time, not frame count', () => {
    const days = [];
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={(d) => days.push(d)} />);
    const drawsAtMount = count('drawArrays');
    const FRAMES = 60;
    m.frames(FRAMES);
    const clock = createStepClock();
    let expected = 0;
    for (let f = 0; f < FRAMES; f++) expected += clock.advance(Math.min(FRAME_MS / 1000, 0.05) * 1000, 9);
    expect(expected).toBeGreaterThanOrEqual(30);
    expect(days).toHaveLength(FRAMES + 1);            // mount draw + one per frame
    expect(days.at(-1)).toBeCloseTo(expected * DT_DAYS, 9);
    const { sub } = diffusionSchedule(OCEAN_GRID, DT_DAYS, EDDY_DIFFUSIVITY_KM2_DAY);
    // Each step: advect, correct, final, `sub` diffusion passes, react. Plus one composite per frame.
    expect(count('drawArrays') - drawsAtMount).toBe(expected * (4 + sub) + FRAMES);
    expect(paints()).toBe(FRAMES + 1);
  });

  it('resizes in place: no teardown, no lost context, no second program build', () => {
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    const programsAtMount = count('createProgram');
    m.rerender(<LedgerOcean width={300} height={150} />);
    m.frames(2);
    const canvas = screen.getByLabelText(/Ledger ocean/);
    expect(count('loseContext')).toBe(0);
    expect(count('createProgram')).toBe(programsAtMount);
    expect(canvas.width).toBe(300);   // jsdom devicePixelRatio = 1
    expect(canvas.height).toBe(150);
    expect(rec.log).toContainEqual(['viewport', 0, 0, 300, 150]);
    expect(screen.queryByText(MODE_LABEL.unsupported)).toBeNull();
  });

  it('suspends on a lost context and rebuilds on a fresh canvas when it is restored', () => {
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    const first = screen.getByLabelText(/Ledger ocean/);
    const programs = count('createProgram');
    const lost = new Event('webglcontextlost', { cancelable: true });
    act(() => { first.dispatchEvent(lost); });
    expect(lost.defaultPrevented).toBe(true);          // required for the browser to ever restore
    expect(screen.getByText(MODE_LABEL.lost)).toBeTruthy();
    const drawsWhileLost = count('drawArrays');
    m.frames(5);
    expect(count('drawArrays')).toBe(drawsWhileLost);   // nothing is drawn into a dead context
    act(() => { first.dispatchEvent(new Event('webglcontextrestored')); });
    const second = screen.getByLabelText(/Ledger ocean/);
    expect(second).not.toBe(first);
    expect(count('createProgram')).toBe(2 * programs);
    expect(screen.queryByText(MODE_LABEL.lost)).toBeNull();
    m.frames(2);
    expect(count('drawArrays')).toBeGreaterThan(drawsWhileLost);
  });

  it('spreads the reduced-motion warm-up over frames and paints once it is settled', () => {
    reduceMotion();
    const days = [];
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={(d) => days.push(d)} />);
    expect(days[0]).toBeCloseTo(WARMUP_STEPS_PER_FRAME * DT_DAYS, 9); // the mount draw ran one chunk
    expect(paints()).toBe(0);
    m.frames(WARM_FRAMES + 5);
    expect(days.at(-1)).toBeCloseTo(REDUCED_MOTION_DAYS, 9);
    expect(paints()).toBe(1);
    m.frames(10);
    expect(paints()).toBe(1);                                         // held: no repaint without a reason
    expect(days.at(-1)).toBeCloseTo(REDUCED_MOTION_DAYS, 9);
  });

  it('repaints a held reduced-motion frame once after a resize', () => {
    reduceMotion();
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    m.frames(WARM_FRAMES + 2);
    expect(paints()).toBe(1);
    m.rerender(<LedgerOcean width={300} height={150} />);
    m.frames(3);
    expect(paints()).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx`
Expected: the first four pass; the lifecycle tests FAIL — resize logs `loseContext` and doubles `createProgram`; lost context: `defaultPrevented` false; reduced motion: `days[0]` is 200 and the loop never runs (`haltOnReducedMotion` default). The live-frames test may already pass (it pins existing behaviour; its mutations in Step 7 prove it is not vacuous).

- [ ] **Step 3: Rewrite `LedgerOcean.jsx`**

Replace `src/terminal/views/ledger/ocean/LedgerOcean.jsx` with:

```jsx
// LedgerOcean.jsx — the Ledger ocean: WebGL2 advection of audited discharge,
// composited on the shared harness. The sim runs inside onInit/draw; the
// ledger is never written. Without float render targets (or if a sim program
// fails to build) it draws the static coastline only; without WebGL2 it says so.
//
// Lifecycle:
// - Size changes resize the canvas in place (hostRef.resize). The host is
//   built once per GL context, never per size: a rebuild would loseContext()
//   on dispose, and the next getContext() on the same canvas returns that
//   dead context (CouncilField pattern).
// - A lost context suspends drawing. On restore the canvas is remounted
//   (key = generation) and the host rebuilt; the ocean restarts from T+0,
//   because its state lived in GPU memory.
// - Reduced motion: the warm-up is spread over frames (nothing is painted
//   meanwhile), then one frame is held and repainted only when resized.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useShaderCanvas } from '../../../gl/useShaderCanvas';
import { createFloatTexture } from '../../../gl/pingPong';
import { getOceanWorld } from '../../../ledger/ocean/oceanWorld';
import { createOceanGpu } from '../../../ledger/ocean/gpu/oceanGpu';
import { SIM_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS } from '../../../ledger/ocean/gpu/shaders';
import { OCEAN_EXPOSURE } from '../../../ledger/ocean/gpu/palette';
import { createStepClock } from '../../../ledger/ocean/clock';
import { createOceanDriver, REDUCED_MOTION_DAYS } from './oceanDriver';
import { MODE_LABEL } from './hudFormat';

const CONTEXT_OPTIONS = { alpha: false, antialias: false, premultipliedAlpha: false };

function paint({ gl, prog, U, vao }, grid, tex, sim, tsec) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.useProgram(prog);
  gl.bindVertexArray(vao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sim ? sim.stateTexture() : tex.zero);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, tex.static);
  gl.uniform1i(U.uState, 0);
  gl.uniform1i(U.uStatic, 1);
  gl.uniform2f(U.uGrid, grid.nx, grid.ny);
  gl.uniform2f(U.uRes, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(U.uTime, tsec);
  const { ref, gain, rim, aberration } = OCEAN_EXPOSURE;
  gl.uniform4f(U.uRef, ref[0], ref[1], ref[2], ref[3]);
  gl.uniform4f(U.uGain, gain[0], gain[1], gain[2], gain[3]);
  gl.uniform1f(U.uRim, rim);
  gl.uniform1f(U.uAberration, aberration);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export default function LedgerOcean({ width, height, daysPerSecond = 9, onFrame = null }) {
  const canvasRef = useRef(null);
  const world = useMemo(() => getOceanWorld(), []);
  const simRef = useRef(null);
  const driverRef = useRef(null);
  const texRef = useRef(null);
  const lostRef = useRef(false);
  const warmRef = useRef(false);
  const dirtyRef = useRef(true);
  const sizeRef = useRef({ width, height });
  const dpsRef = useRef(daysPerSecond);
  dpsRef.current = daysPerSecond;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const [mode, setMode] = useState('live'); // 'live' | 'static' | 'static-shader' | 'unsupported' | 'lost'
  const [generation, setGeneration] = useState(0);

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
    // The loop must run under reduced motion: it carries the spread warm-up,
    // then idles (draw returns without painting) until a resize.
    haltOnReducedMotion: false,
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
        sim.setSources(world.ambientSourceData);
        simRef.current = sim;
        driverRef.current = createOceanDriver({ clock: createStepClock(), step: () => sim.step() });
        texRef.current = { static: sim.staticTexture(), zero: null };
      } else {
        texRef.current = {
          static: createFloatTexture(gl, grid.nx, grid.ny, world.staticData),
          zero: createFloatTexture(gl, grid.nx, grid.ny, new Float32Array(grid.n * 4)),
        };
        setMode(failed ? 'static-shader' : 'static');
      }
    },
    onDispose: (gl) => {
      simRef.current?.dispose();
      if (texRef.current?.zero) {
        gl.deleteTexture(texRef.current.zero);
        gl.deleteTexture(texRef.current.static);
      }
      simRef.current = null;
      driverRef.current = null;
      texRef.current = null;
    },
    draw: (host, { dt, tsec, hidden, reducedMotion }) => {
      if (lostRef.current) return;
      const driver = driverRef.current;
      let paintNow = true;
      if (reducedMotion) {
        if (driver && !warmRef.current) {
          warmRef.current = driver.warmupChunk(REDUCED_MOTION_DAYS);
          paintNow = warmRef.current;
        } else {
          paintNow = dirtyRef.current;
        }
      } else if (driver && !hidden) {
        driver.advance(dt, dpsRef.current);
      }
      if (paintNow) {
        paint(host, world.grid, texRef.current, simRef.current, tsec);
        dirtyRef.current = false;
      }
      onFrameRef.current?.(driver ? driver.simDays() : 0);
    },
    onUnsupported: () => setMode('unsupported'),
    deps: [generation],
  });

  // Resize in place. Skips the mount pass (the host was just built at this
  // size): assigning canvas.width clears the drawing buffer even when the
  // value is unchanged.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (sizeRef.current.width === width && sizeRef.current.height === height) return;
    sizeRef.current = { width, height };
    host.resize(width, height);
    dirtyRef.current = true;
  }, [hostRef, width, height]);

  // Context loss (GPU reset, driver eviction, too many contexts). The listener
  // must preventDefault() or the browser never fires webglcontextrestored.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const onLost = (e) => {
      e.preventDefault();
      lostRef.current = true;
      setMode('lost');
    };
    const onRestored = () => {
      setMode('live');
      setGeneration((g) => g + 1);
    };
    el.addEventListener('webglcontextlost', onLost);
    el.addEventListener('webglcontextrestored', onRestored);
    return () => {
      el.removeEventListener('webglcontextlost', onLost);
      el.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [generation]);

  return (
    <div style={{ position: 'relative', width, height, background: '#050505' }}>
      <canvas
        key={generation}
        ref={canvasRef}
        aria-label="Ledger ocean: advection of audited discharge"
        style={{ display: mode === 'unsupported' ? 'none' : 'block', width, height }}
      />
      {mode !== 'live' && (
        <div
          style={{ position: 'absolute', left: 8, bottom: 6, font: '9px monospace', letterSpacing: '0.2em', color: 'rgba(20,184,166,0.55)' }}
        >
          {MODE_LABEL[mode]}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Delete `warmupOnce`**

In `oceanDriver.js` delete the `let warmed = false;` line and the whole `warmupOnce` method with its comment. In `oceanDriver.test.js` delete the `it('warms up once for reduced motion', …)` test.

- [ ] **Step 5: Run the view and driver tests**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/`
Expected: PASS (LedgerOcean 9 tests, oceanDriver 5 tests).

- [ ] **Step 6: Measure the spread warm-up**

Run: `node scripts/oceanWarmup.mjs`
Expected: exit 0; `warmWallMs` > 0; `laterTasks` is empty (the long-task API only reports tasks ≥ 50 ms). Compare `mountTaskMs` with the Task 2 baseline and report both JSONs. If `laterTasks` is not empty, set `WARMUP_STEPS_PER_FRAME = 8`, re-run the unit tests and the script once, and report both measurements; if it is still ≥ 50 ms, report BLOCKED.

- [ ] **Step 7: Mutation checks**

1. `deps: [generation]` → `deps: [generation, width, height]` → the resize test fails (`loseContext` 1, programs doubled).
2. Delete the `host.resize(width, height);` line → the resize test fails (canvas stays 512).
3. Delete `e.preventDefault();` → the lost-context test fails.
4. Delete `key={generation}` from the canvas → the lost-context test fails (`second` is `first`).
5. Delete `if (lostRef.current) return;` → the lost-context test fails (draws while lost).
6. Replace `driver.advance(dt, dpsRef.current);` with `driver.advance(1 / 60, dpsRef.current);` (frame-counted) → the live-frames test fails.
7. Delete the `else if (driver && !hidden) { … }` branch → the live-frames test fails.
8. `haltOnReducedMotion: false` → `true` → the reduced-motion test fails (never warms past one chunk).
9. Replace `paintNow = warmRef.current;` with `paintNow = true;` → the reduced-motion test fails (paints during warm-up).
10. Delete `dirtyRef.current = true;` from the resize effect → the reduced-motion resize test fails.

- [ ] **Step 8: Commit the code**

```bash
git add src/terminal/views/ledger/ocean/LedgerOcean.jsx src/terminal/views/ledger/ocean/oceanDriver.js src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx src/terminal/views/ledger/ocean/__tests__/oceanDriver.test.js
git commit -m "fix(ledger-ocean): resize in place, survive context loss, spread the reduced-motion warm-up

Spread warm-up, node scripts/oceanWarmup.mjs:
<paste the Step 6 JSON here>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Correct the spec text**

In `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md` make these exact replacements (Edit tool, one at a time).

(a) §3 Preset data. Replace:

~~~text
The existing kernel fields in `auditPresets.js` stay **byte-identical**. Each
preset gains a `river` block:

```js
river: {
  course: [[lon, lat], ...],   // audit site → mouth, ~15–40 vertices
  dischargeM3s: 6500,          // real mean discharge at the mouth
  manning: { n: 0.03, R: 6, S: 0.00007 },  // reach-averaged
  sources: { course: '…', dischargeM3s: '…', manning: '…' }, // or 'UNVERIFIED'
}
```
~~~

with:

~~~text
The existing kernel fields in `auditPresets.js` stay **byte-identical**, and so
does the file: river data lives beside it in
`src/terminal/ledger/ocean/riverCourses.js`, keyed by preset key (phase 2):

```js
RIVERS[key] = {
  course: [[lon, lat], ...],   // audit site → mouth, city/landmark waypoints
  dischargeM3s: 6500,          // real mean discharge at the mouth
  manning: { n: 0.03, R: 6, S: 0.00007 },  // reach-averaged
  sources: { course: '…', dischargeM3s: '…', manning: '…' }, // or 'UNVERIFIED'
}
```
~~~

(b) Replace `Existing 5 (kernel values unchanged; \`river\` block added):` with `Existing 5 (kernel values unchanged; \`RIVERS\` entry added):`.

(c) In the Ganges note, replace `  use the combined Q. It will not pair the Sundarbans site with the combined Q.` with:

~~~text
  use the combined Q. It will not pair the Sundarbans site with the combined Q.
  **Decided (user, 2026-09-29): the Meghna estuary with the combined
  G–B–M Q ≈ 38,000 m³/s** (implemented in phase 3b).
~~~

(d) §5: replace `` `auditPresets.js` gains the `river` blocks and 4 presets. `` with `` `auditPresets.js` gains the 4 new presets (kernel fields only); their river data goes in `riverCourses.js`. ``

(e) §6 Presets: replace `  - Every \`river\` numeric field has a source note or \`'UNVERIFIED'\`.` with `  - Every \`RIVERS\` numeric field has a source note or \`'UNVERIFIED'\`.`

(f) §7: replace

~~~text
3. **Integration:**
   - River-stage particles.
   - The 4 new presets with sourced data.
   - HUD, form ghost, seal, header.
   - Delete `LedgerMap` / `LedgerParticles` / eclipse.
~~~

with:

~~~text
3. **Integration**, in two plans:
   - **3a** (`docs/superpowers/plans/2026-09-29-ledger-ocean-phase3a-tab.md`):
     phase-2 lifecycle hazards (resize in place, context loss/restore,
     program-build leak, reduced-motion warm-up spread over frames), the hero
     swap, HUD, header; delete `LedgerMap` / `LedgerParticles` / eclipse.
     Archived verdicts become sources in 3a (no seal yet). Preset rings are
     neutral (`AMBIENT PRESET`: presets have no kernel ruling). The DO_sat
     carry-over is met with a legend note, not a salinity term.
   - **3b:** river-stage particles and the DO_MIN tick, the 4 new presets
     with sourced data, form ghost, seal.
~~~

- [ ] **Step 10: Commit the spec**

```bash
git add docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md
git commit -m "docs(ledger): spec records riverCourses.js, the Ganges decision and the phase-3 split

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: HUD maths and data — formatters, verdict sources, 1-texel readback

Pure pieces the HUD and probe need, tested in isolation before any UI.

**Files:**
- Modify: `src/terminal/views/ledger/ocean/hudFormat.js` (whole file)
- Modify: `src/terminal/ledger/ocean/sources.js` (append `verdictSources`)
- Modify: `src/terminal/gl/pingPong.js` (append `readTexel`)
- Modify: `src/terminal/ledger/ocean/gpu/oceanGpu.js` (import `readTexel`; add `readCell`)
- Test: `src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js` (new), `src/terminal/ledger/ocean/__tests__/sources.test.js`, `src/terminal/gl/__tests__/pingPong.test.js`, `src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`

**Interfaces:**
- Consumes: `verdictSourceSpec(verdict)`, `buildSource(spec, grid, mask)` → source `{ id, kind, snap: { i, j, k, distCells, lon, lat }, course, lengthKm, travelDays, mouth, conc, cells, critical: { tDays, kmFromSite, rkm, doMin }, dischargeM3s }` or null; `haversineKm([lon, lat], [lon, lat])`; `RIVERS[key].course`, `RIVERS.usa.dischargeM3s` (16570); `AUDIT_PRESETS[i].{ key, siteName }`; `grid.lonLatToCell(lon, lat) → { i, j }`, `grid.idx(i, j)`.
- Produces:
  - `readTexel(gl, target, x, y, out = new Float32Array(4)) → Float32Array(4)` (binds `target.fbo`, `readPixels(x, y, 1, 1, RGBA, FLOAT, out)`, unbinds).
  - `oceanGpu.readCell(i, j) → Float32Array(4)` `[ΔT, BOD, NO₃, D]` of the current state.
  - `verdictSources(verdicts, grid, mask) → source[]` (skips verdicts without finite coordinates or without `input`).
  - `hudFormat.js` exports: `MODE_LABEL`, `HUD_TITLE`, `COMPRESSIONS`, `DEFAULT_COMPRESSION`, `PROBE_INTERVAL_MS`, `PROBE_TAP_HOLD_MS`, `COMPACT_BELOW_PX`, `PROBE_HINT`, `PROBE_NOTE`, `LEGEND_NOTES`, `LEGEND_SWATCHES`, `STATUS_COLOR`, `DEFAULT_COLOR`, `PRESET_COLOR`, `nextCompression(dps)`, `statusLabel(status)`, `summaryLine(verdicts)`, `formatClock(days)`, `formatFrame(ms)`, `fmtValue(x)`, `formatProbe(lon, lat, rgba | null, isLand)`, `pointerToLonLat(x, y, w, h) → { lon, lat } | null`, `lonLatToPct(lon, lat) → { left, top }` (percent), `describeSites(sources, verdicts) → site[]` with site = `{ id, kind, name, status, color, site: [lon, lat], snap: [lon, lat], snapKm, dischargeM3s, doMin, rkm }`, `tooltipLines(site) → string[5]`.

- [ ] **Step 1: Write the failing formatter tests**

Create `src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getOceanWorld } from '../../../../ledger/ocean/oceanWorld';
import { verdictSources, haversineKm } from '../../../../ledger/ocean/sources';
import { RIVERS } from '../../../../ledger/ocean/riverCourses';
import {
  COMPRESSIONS, LEGEND_NOTES, PRESET_COLOR, nextCompression, summaryLine, formatClock, formatFrame,
  fmtValue, formatProbe, pointerToLonLat, lonLatToPct, describeSites, tooltipLines,
} from '../hudFormat';

// Inland near Suzhou: a land cell, so the straight-line snap has a length.
const V = {
  hash: 'h1', status: 'REJECTED', coordinates: { lat: 31.3, lon: 120.6 },
  input: { temp: 20, do: 6, bod: 10, dt: 2, epi: 3, nitrate: 5, flow: 42, siteName: 'Test site' },
};

describe('clock, compression, frame monitor', () => {
  it('cycles 1 → 3 → 9 → 30 → 1', () => {
    expect(COMPRESSIONS).toEqual([1, 3, 9, 30]);
    expect([1, 3, 9, 30].map(nextCompression)).toEqual([3, 9, 30, 1]);
  });
  it('formats the sim clock and the frame monitor', () => {
    expect(formatClock(184.25)).toBe('T+ 184.25 d');
    expect(formatClock(0)).toBe('T+ 0.00 d');
    expect(formatFrame(2.8)).toBe('Δt 2.8 ms · 357 Hz');
    expect(formatFrame(16)).toBe('Δt 16.0 ms · 63 Hz');
    expect(formatFrame(0)).toBe('Δt — ms');
  });
});

describe('summary line', () => {
  it('counts verdicts by status like the old map did', () => {
    expect(summaryLine([])).toBe('0 VERDICTS RECORDED');
    expect(summaryLine([{ status: 'APPROVED' }])).toBe('1 VERDICT RECORDED  ·  1 APPROVED');
    expect(summaryLine([{ status: 'APPROVED' }, { status: 'APPROVED' }, { status: 'EMERGENCY_VETO' }, {}]))
      .toBe('4 VERDICTS RECORDED  ·  2 APPROVED  ·  1 EMERGENCY VETO  ·  1 UNKNOWN');
  });
});

describe('probe', () => {
  it('formats values with magnitude-dependent precision', () => {
    expect(fmtValue(0)).toBe('0');
    expect(fmtValue(-1)).toBe('0');
    expect(fmtValue(NaN)).toBe('0');
    expect(fmtValue(3.2e-4)).toBe('3.2e-4');
    expect(fmtValue(0.02)).toBe('0.02');
    expect(fmtValue(1.234)).toBe('1.2');
    expect(fmtValue(150.4)).toBe('150');
  });
  it('formats a probe line, land and no-data cases', () => {
    expect(formatProbe(122.8, 31.2, [0.02, 0.14, 0.8, 0.3], false))
      .toBe('31.2°N 122.8°E · ΔT 0.02 °C · BOD 0.14 · NO₃ 0.80 · DO↓ 0.30 mg/L');
    expect(formatProbe(-89.2, 29.1, null, true)).toBe('29.1°N 89.2°W · LAND');
    expect(formatProbe(10, -45.5, null, false)).toBe('45.5°S 10.0°E · NO DATA');
  });
  it('maps canvas pixels to lon/lat (north up, full equirectangular world)', () => {
    expect(pointerToLonLat(0, 0, 512, 256)).toEqual({ lon: -180, lat: 90 });
    expect(pointerToLonLat(256, 128, 512, 256)).toEqual({ lon: 0, lat: 0 });
    expect(pointerToLonLat(384, 192, 512, 256)).toEqual({ lon: 90, lat: -45 });
    expect(pointerToLonLat(512, 10, 512, 256)).toBeNull();
    expect(pointerToLonLat(-1, 10, 512, 256)).toBeNull();
    expect(pointerToLonLat(10, 256, 512, 256)).toBeNull();
    expect(pointerToLonLat(10, 10, 0, 0)).toBeNull();
  });
  it('maps lon/lat to percent positions', () => {
    expect(lonLatToPct(0, 0)).toEqual({ left: 50, top: 50 });
    expect(lonLatToPct(-180, 90)).toEqual({ left: 0, top: 0 });
    expect(lonLatToPct(90, -45)).toEqual({ left: 75, top: 75 });
  });
});

describe('legend', () => {
  it('carries every honesty note 3a shows', () => {
    expect(LEGEND_NOTES).toEqual([
      'MODEL KINETICS · LITERATURE RANGES',
      'PRESET LOADS NARRATIVE-TUNED · NOT MEASURED',
      'CLIMATOLOGICAL CURRENTS · NOT FORECAST',
      'POINT SOURCE · PLUG FLOW · NO TRIBUTARIES',
      'USER SITES · STRAIGHT-LINE APPROX',
      'DO_SAT FRESHWATER FIT · ~20% HIGH AT SEA',
    ]);
  });
});

describe('sites', () => {
  const world = getOceanWorld();
  const userSrc = verdictSources([V], world.grid, world.mask);
  const sites = describeSites([...world.sources, ...userSrc], [V]);

  it('test setup: the verdict site is on land', () => {
    const { i, j } = world.grid.lonLatToCell(120.6, 31.3);
    expect(world.mask.land[world.grid.idx(i, j)]).toBeTruthy();
  });

  it('describes presets as neutral ambient sources, measured from their mouth', () => {
    const usa = sites.find((s) => s.id === 'preset:usa');
    expect(usa).toMatchObject({
      kind: 'preset', status: null, color: PRESET_COLOR,
      name: 'Lower Mississippi at New Orleans, USA', dischargeM3s: 16570,
    });
    expect(usa.site).toEqual(RIVERS.usa.course[0]);
    expect(usa.snapKm).toBeCloseTo(haversineKm(RIVERS.usa.course.at(-1), usa.snap), 9);
    expect(sites.filter((s) => s.kind === 'preset')).toHaveLength(world.sources.length);
  });

  it('describes a verdict by its status colour, measured from its audit site', () => {
    const v = sites.find((s) => s.id === 'h1');
    expect(v).toMatchObject({ kind: 'verdict', status: 'REJECTED', color: '#ef4444', name: 'Test site', dischargeM3s: 42 });
    expect(v.site).toEqual([120.6, 31.3]);
    expect(v.snapKm).toBeGreaterThan(0);
    expect(v.snapKm).toBeCloseTo(haversineKm([120.6, 31.3], v.snap), 9);
  });

  it('writes the tooltip lines', () => {
    expect(tooltipLines({
      id: 'h1', kind: 'verdict', name: 'Test site', status: 'EMERGENCY_VETO', color: '#ef4444',
      site: [121, 31.2], snap: [122, 31], snapKm: 97.4, dischargeM3s: 42, doMin: 3.14, rkm: 1840.4,
    })).toEqual([
      'Test site', 'EMERGENCY VETO', 'Q 42 m³/s · 0.25% OF MISSISSIPPI',
      'DO_MIN 3.1 mg/L @ rkm 1840', 'SNAP 97 km TO OCEAN',
    ]);
    expect(tooltipLines({
      id: 'preset:usa', kind: 'preset', name: 'X', status: null, color: PRESET_COLOR,
      site: [0, 0], snap: [0, 0], snapKm: 0, dischargeM3s: 16570, doMin: 5, rkm: 0,
    })).toEqual(['X', 'AMBIENT PRESET', 'Q 16,570 m³/s', 'DO_MIN 5.0 mg/L @ rkm 0', 'SNAP 0 km TO OCEAN']);
    expect(tooltipLines({
      id: 'x', kind: 'verdict', name: 'Y', status: 'APPROVED', color: '#22c55e',
      site: [0, 0], snap: [0, 0], snapKm: 1, dischargeM3s: 4.25, doMin: 8, rkm: 2,
    })[2]).toBe('Q 4.3 m³/s · 0.026% OF MISSISSIPPI');
  });
});
```

Append to `src/terminal/ledger/ocean/__tests__/sources.test.js` (add `verdictSources` to the existing `../sources` import):

```js
describe('verdictSources', () => {
  const input = { ...kernel, siteName: 'Test site' };
  it('builds one source per archived verdict with usable coordinates', () => {
    const out = verdictSources([
      { hash: 'a', status: 'REJECTED', coordinates: { lat: 31.3, lon: 120.6 }, input },
      { hash: 'b', status: 'APPROVED', coordinates: null, input },
      { hash: 'c', status: 'APPROVED', coordinates: { lat: '', lon: 5 }, input },
      { hash: 'd', status: 'APPROVED', coordinates: { lat: 10, lon: NaN }, input },
      { hash: 'e', status: 'APPROVED', coordinates: { lat: 10, lon: 10 } },
    ], grid, mask);
    expect(out.map((s) => s.id)).toEqual(['a']);
    expect(out[0].kind).toBe('verdict');
    expect(out[0].dischargeM3s).toBe(42);
  });
  it('is empty for no verdicts', () => {
    expect(verdictSources([], grid, mask)).toEqual([]);
  });
});
```

Append to `src/terminal/gl/__tests__/pingPong.test.js` (add `readTexel` to the `../pingPong` import):

```js
describe('readTexel', () => {
  it('reads one RGBA float texel from the target framebuffer and unbinds', () => {
    const gl = withFloat();
    const t = createFloatTarget(gl, 8, 4);
    const start = gl.__log.length;
    const out = readTexel(gl, t, 5, 2);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out).toHaveLength(4);
    expect(gl.__log.slice(start)).toEqual([
      ['bindFramebuffer', gl.FRAMEBUFFER, t.fbo.__tag],
      ['readPixels', 5, 2, 1, 1, gl.RGBA, gl.FLOAT, [0, 0, 0, 0]],
      ['bindFramebuffer', gl.FRAMEBUFFER, null],
    ]);
  });
});
```

Append inside `describe('createOceanGpu', …)` in `src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`:

```js
  it('reads one cell of the current state texture', () => {
    const gl = withFloat();
    const gpu = make(gl);
    gpu.step();                                   // read and write have swapped at least once
    const fboTex = new Map();
    let cur = null;
    for (const [name, ...a] of gl.__log) {
      if (name === 'bindFramebuffer') cur = a[1];
      else if (name === 'framebufferTexture2D') fboTex.set(cur, a[3]);
    }
    const start = gl.__log.length;
    expect(gpu.readCell(5, 2)).toHaveLength(4);
    const log = gl.__log.slice(start);
    expect(log[1]).toEqual(['readPixels', 5, 2, 1, 1, gl.RGBA, gl.FLOAT, [0, 0, 0, 0]]);
    expect(fboTex.get(log[0][2])).toBe(gpu.stateTexture().__tag);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js src/terminal/ledger/ocean/__tests__/sources.test.js src/terminal/gl/__tests__/pingPong.test.js src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`
Expected: FAIL — missing exports (`nextCompression`, `verdictSources`, `readTexel`, `readCell`). If the "test setup" case fails (the point is ocean in the 110 m mask), report it; do not move the point without saying so.

- [ ] **Step 3: Implement `readTexel` and `readCell`**

Append to `src/terminal/gl/pingPong.js`:

```js
// One texel, for a cursor probe. Same float readback rules as readTarget
// (RGBA/FLOAT needs EXT_color_buffer_float, which probeFloatTargets required).
export function readTexel(gl, target, x, y, out = new Float32Array(4)) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.FLOAT, out);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return out;
}
```

In `src/terminal/ledger/ocean/gpu/oceanGpu.js` add `readTexel` to the `../../../gl/pingPong` import list, and add after `readState()`:

```js
    // [ΔT, BOD, NO₃, D] of cell (i, j); row 0 = south. A pipeline stall: call
    // at most PROBE_INTERVAL_MS apart.
    readCell(i, j) {
      return readTexel(gl, state.read, i, j);
    },
```

- [ ] **Step 4: Implement `verdictSources`**

Append to `src/terminal/ledger/ocean/sources.js`:

```js
// Every archived verdict is a permanent source (spec decision 2). A verdict
// without usable coordinates (older records, empty form fields) or without its
// input is skipped, never guessed.
export function verdictSources(verdicts, grid, mask) {
  const out = [];
  for (const v of verdicts) {
    const c = v?.coordinates;
    if (!c || !v.input || !Number.isFinite(num(c.lat)) || !Number.isFinite(num(c.lon))) continue;
    const src = buildSource(verdictSourceSpec(v), grid, mask);
    if (src) out.push(src);
  }
  return out;
}
```

(`num` is the module's existing helper: `''`/`null`/`undefined` → NaN.)

- [ ] **Step 5: Write `hudFormat.js`**

Replace `src/terminal/views/ledger/ocean/hudFormat.js` with:

```js
// hudFormat.js — pure text and geometry for the Ledger ocean HUD (spec §4).
// No React and no GL, so every string the HUD shows is unit-tested.

import { AUDIT_PRESETS } from '../../../ledger/auditPresets';
import { RIVERS } from '../../../ledger/ocean/riverCourses';
import { haversineKm } from '../../../ledger/ocean/sources';

export const MODE_LABEL = {
  static: 'STATIC · NO FLOAT TARGETS',
  'static-shader': 'STATIC · SIM SHADERS FAILED',
  unsupported: 'OCEAN UNAVAILABLE · NO WEBGL2',
  lost: 'OCEAN SUSPENDED · GPU CONTEXT LOST',
};

export const HUD_TITLE = 'THE OPEN LEDGER v2.0';
export const COMPRESSIONS = [1, 3, 9, 30];      // simulated days per wall second
export const DEFAULT_COMPRESSION = 9;
export const PROBE_INTERVAL_MS = 100;           // ≤ 10 Hz readPixels
export const PROBE_TAP_HOLD_MS = 5000;          // a tapped probe readout stays this long
export const COMPACT_BELOW_PX = 640;            // hero width below which the HUD collapses
export const PROBE_HINT = 'HOVER TO PROBE';
export const PROBE_NOTE = 'MODEL VALUES · NOT MEASURED';

// Spec §3 honesty notes that apply to what 3a draws.
export const LEGEND_NOTES = [
  'MODEL KINETICS · LITERATURE RANGES',
  'PRESET LOADS NARRATIVE-TUNED · NOT MEASURED',
  'CLIMATOLOGICAL CURRENTS · NOT FORECAST',
  'POINT SOURCE · PLUG FLOW · NO TRIBUTARIES',
  'USER SITES · STRAIGHT-LINE APPROX',
  'DO_SAT FRESHWATER FIT · ~20% HIGH AT SEA',
];

// The composite's channel colours (shaders.js COMPOSITE_FS CRIMSON / AMBER /
// GREEN; the deficit is an absence of light with a cyan rim).
export const LEGEND_SWATCHES = [
  { label: 'ΔT', color: 'rgb(255,23,51)' },
  { label: 'BOD', color: 'rgb(255,158,0)' },
  { label: 'NO₃', color: 'rgb(56,255,20)' },
  { label: 'DO↓', color: '#050505', ring: 'rgb(0,230,255)' },
];

// Moved verbatim from LedgerMap.jsx (deleted in 3a).
export const STATUS_COLOR = {
  APPROVED: '#22c55e',
  CONDITIONAL: '#eab308',
  REJECTED: '#ef4444',
  EMERGENCY_VETO: '#ef4444',
};
export const DEFAULT_COLOR = '#38bdf8';
export const PRESET_COLOR = '#14b8a6';

export function nextCompression(dps) {
  return COMPRESSIONS[(COMPRESSIONS.indexOf(dps) + 1) % COMPRESSIONS.length];
}

export function statusLabel(status) {
  return status ? status.replace(/_/g, ' ') : 'UNKNOWN';
}

export function summaryLine(verdicts) {
  const counts = new Map();
  for (const v of verdicts) {
    const s = v.status || 'UNKNOWN';
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  const n = verdicts.length;
  const head = `${n} VERDICT${n !== 1 ? 'S' : ''} RECORDED`;
  const parts = [...counts].map(([s, c]) => `${c} ${statusLabel(s)}`);
  return parts.length ? `${head}  ·  ${parts.join('  ·  ')}` : head;
}

export function formatClock(days) {
  return `T+ ${days.toFixed(2)} d`;
}

export function formatFrame(ms) {
  return ms > 0 ? `Δt ${ms.toFixed(1)} ms · ${Math.round(1000 / ms)} Hz` : 'Δt — ms';
}

export function fmtValue(x) {
  if (!(x > 0)) return '0';
  if (x >= 100) return x.toFixed(0);
  if (x >= 1) return x.toFixed(1);
  if (x >= 0.01) return x.toFixed(2);
  return x.toExponential(1); // 3.2e-4 → '3.2e-4'
}

const fmtLat = (lat) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
const fmtLon = (lon) => `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;

export function formatProbe(lon, lat, v, isLand) {
  const where = `${fmtLat(lat)} ${fmtLon(lon)}`;
  if (isLand) return `${where} · LAND`;
  if (!v) return `${where} · NO DATA`;
  return `${where} · ΔT ${fmtValue(v[0])} °C · BOD ${fmtValue(v[1])} · NO₃ ${fmtValue(v[2])} · DO↓ ${fmtValue(v[3])} mg/L`;
}

// Canvas CSS pixels → lon/lat. The composite is the full equirectangular
// world, north up (row 0 of the state texture is the bottom of the canvas).
export function pointerToLonLat(x, y, w, h) {
  if (!(w > 0) || !(h > 0) || x < 0 || y < 0 || x >= w || y >= h) return null;
  return { lon: -180 + (360 * x) / w, lat: 90 - (180 * y) / h };
}

export function lonLatToPct(lon, lat) {
  return { left: ((lon + 180) / 360) * 100, top: ((90 - lat) / 180) * 100 };
}

const PRESET_BY_ID = new Map(AUDIT_PRESETS.map((p) => [`preset:${p.key}`, p]));

// Ring + tooltip data per built source. Snap distance: presets from the last
// point of their RIVERS course (the mouth) to the snapped ocean cell; verdicts
// from the audit site (their course is the straight snap line).
export function describeSites(sources, verdicts = []) {
  const byHash = new Map(verdicts.map((v) => [v.hash, v]));
  return sources.map((s) => {
    const site = s.course[0];
    const snap = [s.snap.lon, s.snap.lat];
    const base = {
      id: s.id, kind: s.kind, site, snap,
      dischargeM3s: s.dischargeM3s, doMin: s.critical.doMin, rkm: s.critical.rkm,
    };
    if (s.kind === 'preset') {
      const key = s.id.slice('preset:'.length);
      return {
        ...base,
        snapKm: haversineKm(RIVERS[key].course.at(-1), snap),
        name: PRESET_BY_ID.get(s.id)?.siteName ?? key,
        status: null,
        color: PRESET_COLOR,
      };
    }
    const v = byHash.get(s.id);
    const status = v?.status ?? 'UNKNOWN';
    return {
      ...base,
      snapKm: haversineKm(site, snap),
      name: v?.input?.siteName || 'USER SITE',
      status,
      color: STATUS_COLOR[status] || DEFAULT_COLOR,
    };
  });
}

const fmtQ = (q) => (q >= 10 ? Math.round(q).toLocaleString('en-US') : q.toFixed(1));

export function tooltipLines(site) {
  const q = `Q ${fmtQ(site.dischargeM3s)} m³/s`;
  const pct = ((site.dischargeM3s / RIVERS.usa.dischargeM3s) * 100).toPrecision(2);
  return [
    site.name,
    site.kind === 'preset' ? 'AMBIENT PRESET' : statusLabel(site.status),
    site.kind === 'preset' ? q : `${q} · ${pct}% OF MISSISSIPPI`,
    `DO_MIN ${site.doMin.toFixed(1)} mg/L @ rkm ${Math.round(site.rkm)}`,
    `SNAP ${Math.round(site.snapKm)} km TO OCEAN`,
  ];
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js src/terminal/ledger/ocean/__tests__/sources.test.js src/terminal/gl/__tests__/pingPong.test.js src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`
Expected: PASS. Then run `npx vitest run src/terminal/gl/` and confirm no snapshot changed.

- [ ] **Step 7: Mutation checks**

1. `readTexel`: swap `x, y` in `readPixels` → pingPong test fails.
2. `readCell`: `state.read` → `state.write` → oceanGpu readCell test fails.
3. `verdictSources`: delete the `if (!c || …) continue;` line → sources test throws/fails.
4. `pointerToLonLat`: `90 - …` → `-90 + …` → hudFormat test fails.
5. `describeSites`: verdict `snapKm` from `snap` to `snap` (`haversineKm(snap, snap)`) → verdict site test fails.
6. `describeSites`: preset `snapKm` from `site` instead of the course end → preset test fails.
7. `nextCompression`: drop `% COMPRESSIONS.length` → cycle test fails.
8. `fmtValue`: change `x >= 0.01` to `x >= 0.001` → probe precision test fails.
9. Remove any one entry from `LEGEND_NOTES` → legend test fails.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/views/ledger/ocean/hudFormat.js src/terminal/views/ledger/ocean/__tests__/hudFormat.test.js src/terminal/ledger/ocean/sources.js src/terminal/ledger/ocean/__tests__/sources.test.js src/terminal/gl/pingPong.js src/terminal/gl/__tests__/pingPong.test.js src/terminal/ledger/ocean/gpu/oceanGpu.js src/terminal/ledger/ocean/__tests__/oceanGpu.test.js
git commit -m "feat(ledger-ocean): HUD formatters, verdict sources and a 1-texel probe readback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `OceanHud` and the integrated `LedgerOcean`

**Files:**
- Create: `src/terminal/views/ledger/ocean/OceanHud.jsx`
- Modify: `src/terminal/views/ledger/ocean/LedgerOcean.jsx` (whole file)
- Test: `src/terminal/views/ledger/ocean/__tests__/OceanHud.test.jsx` (new), `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx` (append)

**Interfaces:**
- Consumes: everything `hudFormat.js` exports (Task 4); `verdictSources`, `packSources(grid, land, sources) → Float32Array`, `sim.setSources(data)`, `sim.readCell(i, j)`; driver `warmupChunk`, `resetWarmup`, `frameMs`, `simDays`.
- Produces:
  - `OceanHud` (default export, `forwardRef`): props `{ compact, mode, reducedMotion, daysPerSecond, onCycleCompression, sites, latestHash, verdicts }`; handle `{ setFrame({ simDays, frameMs, now }), setProbe(text | null) }`. DOM hooks for tests and screenshots: `data-hud="clock" | "frame" | "compression" | "mode" | "title" | "summary" | "legend" | "probe" | "tooltip"`, rings `data-site="<source id>"`.
  - `LedgerOcean({ width, height, daysPerSecond = 9, verdicts = [], latestHash = null, onFrame = null })`. `daysPerSecond` is the initial compression; the HUD control owns it afterwards.

- [ ] **Step 1: Write the failing HUD tests**

Create `src/terminal/views/ledger/ocean/__tests__/OceanHud.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import OceanHud from '../OceanHud';
import { HUD_TITLE, LEGEND_NOTES, MODE_LABEL, PROBE_HINT, PROBE_NOTE, PRESET_COLOR } from '../hudFormat';

const SITES = [
  { id: 'preset:usa', kind: 'preset', name: 'Lower Mississippi at New Orleans, USA', status: null, color: PRESET_COLOR,
    site: [-90.07, 29.95], snap: [-89.3, 29.0], snapKm: 12, dischargeM3s: 16570, doMin: 4.2, rkm: 0 },
  { id: 'h1', kind: 'verdict', name: 'Test site', status: 'REJECTED', color: '#ef4444',
    site: [120.6, 31.3], snap: [122.1, 31.0], snapKm: 140, dischargeM3s: 42, doMin: 3.1, rkm: 12 },
];
const hud = (props = {}) => {
  const ref = createRef();
  const out = render(
    <OceanHud ref={ref} daysPerSecond={9} onCycleCompression={() => {}} sites={SITES}
      verdicts={[{ status: 'REJECTED' }]} {...props} />,
  );
  return { ref, ...out, q: (k) => out.container.querySelector(`[data-hud="${k}"]`) };
};

describe('OceanHud', () => {
  it('lays out the full HUD on desktop', () => {
    const { q } = hud();
    expect(screen.getByText(HUD_TITLE)).toBeTruthy();
    expect(q('summary').textContent).toBe('1 VERDICT RECORDED  ·  1 REJECTED');
    for (const note of LEGEND_NOTES) expect(q('legend').textContent).toContain(note);
    for (const s of ['ΔT', 'BOD', 'NO₃', 'DO↓']) expect(q('legend').textContent).toContain(s);
    expect(q('probe').textContent).toBe(PROBE_HINT);
    expect(q('compression').textContent).toBe('1 s = 9 d');
    expect(q('frame')).toBeTruthy();
  });

  it('collapses on mobile to the clock top-left and the legend bottom-left', () => {
    const { q } = hud({ compact: true });
    expect(screen.queryByText(HUD_TITLE)).toBeNull();
    expect(q('summary')).toBeNull();
    expect(q('frame')).toBeNull();
    expect(q('probe')).toBeNull();
    expect(q('clock')).toBeTruthy();
    expect(q('compression')).toBeTruthy();
    expect(q('legend')).toBeTruthy();
  });

  it('shows a tapped probe in place of the legend on mobile, then gives the legend back', () => {
    const { ref, q } = hud({ compact: true });
    act(() => ref.current.setProbe('0.0°N 0.0°E · LAND'));
    expect(q('probe').textContent).toBe('0.0°N 0.0°E · LAND');
    expect(screen.getByText(PROBE_NOTE)).toBeTruthy();
    expect(q('legend')).toBeNull();
    act(() => ref.current.setProbe(null));
    expect(q('legend')).toBeTruthy();
  });

  it('writes the clock on every change but the frame monitor at most every 250 ms', () => {
    const { ref, q } = hud();
    act(() => ref.current.setFrame({ simDays: 1.25, frameMs: 16, now: 0 }));
    expect(q('clock').textContent).toBe('T+ 1.25 d');
    expect(q('frame').textContent).toBe('Δt 16.0 ms · 63 Hz');
    act(() => ref.current.setFrame({ simDays: 1.5, frameMs: 2.8, now: 100 }));
    expect(q('clock').textContent).toBe('T+ 1.50 d');
    expect(q('frame').textContent).toBe('Δt 16.0 ms · 63 Hz');
    act(() => ref.current.setFrame({ simDays: 1.5, frameMs: 2.8, now: 250 }));
    expect(q('frame').textContent).toBe('Δt 2.8 ms · 357 Hz');
  });

  it('cycles compression through its control', () => {
    const onCycle = vi.fn();
    hud({ onCycleCompression: onCycle });
    fireEvent.click(screen.getByRole('button', { name: /Time compression/ }));
    expect(onCycle).toHaveBeenCalledTimes(1);
  });

  it('rings each source site and shows its tooltip on hover and on tap', () => {
    const { container, q } = hud({ latestHash: 'h1' });
    const ring = container.querySelector('[data-site="h1"]');
    expect(ring.style.left.endsWith('%')).toBe(true);
    expect(parseFloat(ring.style.left)).toBeCloseTo(((120.6 + 180) / 360) * 100, 6);
    expect(parseFloat(ring.style.top)).toBeCloseTo(((90 - 31.3) / 180) * 100, 6);
    expect(container.querySelector('[data-site="preset:usa"]')).toBeTruthy();
    fireEvent.mouseEnter(ring);
    expect(q('tooltip').textContent).toContain('Q 42 m³/s · 0.25% OF MISSISSIPPI');
    expect(q('tooltip').textContent).toContain('SNAP 140 km TO OCEAN');
    fireEvent.mouseLeave(ring);
    expect(q('tooltip')).toBeNull();
    fireEvent.click(container.querySelector('[data-site="preset:usa"]'));
    expect(q('tooltip').textContent).toContain('AMBIENT PRESET');
  });

  it('shows the mode label instead of the clock when the ocean is not live', () => {
    const { q } = hud({ mode: 'static' });
    expect(q('mode').textContent).toBe(MODE_LABEL.static);
    expect(q('clock')).toBeNull();
  });

  it('says the ocean is still under reduced motion and offers no compression control', () => {
    const { q } = hud({ reducedMotion: true });
    expect(q('clock')).toBeTruthy();
    expect(q('compression')).toBeNull();
    expect(screen.getByText(/STILL · REDUCED MOTION/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Append the failing integration tests**

In `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx` change the testing-library import to `import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';`, change the hudFormat import to `import { MODE_LABEL, PROBE_HINT, PROBE_TAP_HOLD_MS, formatClock } from '../hudFormat';`, and append:

```jsx
const V = {
  hash: 'h1', status: 'REJECTED', coordinates: { lat: 31.3, lon: 120.6 },
  input: { temp: 20, do: 6, bod: 10, dt: 2, epi: 3, nitrate: 5, flow: 42, siteName: 'Test site' },
};
const RECT = { left: 0, top: 0, width: 512, height: 256, right: 512, bottom: 256, x: 0, y: 0 };
const oceanCanvas = () => {
  const c = screen.getByLabelText(/Ledger ocean/);
  c.getBoundingClientRect = () => RECT;
  return c;
};

describe('LedgerOcean HUD integration', () => {
  it('writes the sim clock and the frame monitor', () => {
    const days = [];
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={(d) => days.push(d)} />);
    m.frames(30);
    expect(m.container.querySelector('[data-hud="clock"]').textContent).toBe(formatClock(days.at(-1)));
    expect(days.at(-1)).toBeGreaterThan(0);
    expect(m.container.querySelector('[data-hud="frame"]').textContent).toBe('Δt 16.0 ms · 63 Hz');
  });

  it('probes the hovered cell with a 1-px float readback', () => {
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    rec.gl.readPixels = (...a) => { rec.log.push(['readPixels', ...a.slice(0, 6)]); a[6].set([0.02, 0.14, 0.8, 0.3]); };
    const canvas = oceanCanvas();
    act(() => { fireEvent.pointerMove(canvas, { pointerType: 'mouse', clientX: 256, clientY: 128 }); });
    m.frames(1);
    expect(rec.log).toContainEqual(['readPixels', 256, 128, 1, 1, rec.gl.RGBA, rec.gl.FLOAT]);
    expect(screen.getByText('0.0°N 0.0°E · ΔT 0.02 °C · BOD 0.14 · NO₃ 0.80 · DO↓ 0.30 mg/L')).toBeTruthy();
    act(() => { fireEvent.pointerLeave(canvas, { pointerType: 'mouse' }); });
    expect(screen.getByText(PROBE_HINT)).toBeTruthy();
  });

  it('reads the probe at most every 100 ms of frame time', () => {
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    act(() => { fireEvent.pointerMove(oceanCanvas(), { pointerType: 'mouse', clientX: 256, clientY: 128 }); });
    const before = count('readPixels');
    m.frames(60); // 960 ms
    const reads = count('readPixels') - before;
    expect(reads).toBeGreaterThanOrEqual(8);
    expect(reads).toBeLessThanOrEqual(10);
  });

  it('probes on tap and clears the readout after the hold time', () => {
    const m = mountLive(<LedgerOcean width={360} height={180} />);
    const canvas = screen.getByLabelText(/Ledger ocean/);
    canvas.getBoundingClientRect = () => ({ ...RECT, width: 360, height: 180, right: 360, bottom: 180 });
    act(() => { fireEvent.pointerDown(canvas, { pointerType: 'touch', clientX: 180, clientY: 90 }); });
    m.frames(1);
    expect(screen.getByText(/^0\.0°N 0\.0°E · ΔT/)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(PROBE_TAP_HOLD_MS); });
    expect(screen.queryByText(/^0\.0°N 0\.0°E/)).toBeNull();
  });

  it('cycles time compression 9 → 30 d/s and the sim follows', () => {
    const days = [];
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={(d) => days.push(d)} />);
    m.frames(5);
    const button = screen.getByRole('button', { name: /Time compression/ });
    expect(button.textContent).toBe('1 s = 9 d');
    act(() => { fireEvent.click(button); });
    expect(button.textContent).toBe('1 s = 30 d');
    const d0 = days.at(-1);
    m.frames(20); // 0.32 s × 30 d/s = 9.6 d (9 d/s would give 2.9 d)
    expect(days.at(-1) - d0).toBeGreaterThanOrEqual(9.25);
    expect(days.at(-1) - d0).toBeLessThanOrEqual(10);
  });

  it('adds an archived verdict as a source once, and rings its site', () => {
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    const uploads = count('texImage2D');
    m.frames(2);
    expect(count('texImage2D')).toBe(uploads);
    m.rerender(<LedgerOcean width={512} height={256} verdicts={[V]} latestHash="h1" />);
    m.frames(1);
    expect(count('texImage2D')).toBe(uploads + 1);
    m.frames(3);
    expect(count('texImage2D')).toBe(uploads + 1);
    expect(m.container.querySelector('[data-site="h1"]')).toBeTruthy();
    expect(m.container.querySelectorAll('[data-site^="preset:"]')).toHaveLength(5);
  });

  it('re-settles a reduced-motion ocean when a verdict adds a source', () => {
    reduceMotion();
    const days = [];
    const onFrame = (d) => days.push(d);
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={onFrame} />);
    m.frames(WARM_FRAMES + 2);
    expect(paints()).toBe(1);
    m.rerender(<LedgerOcean width={512} height={256} onFrame={onFrame} verdicts={[V]} />);
    m.frames(WARM_FRAMES + 2);
    expect(days.at(-1)).toBeCloseTo(2 * REDUCED_MOTION_DAYS, 9);
    expect(paints()).toBe(2);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/`
Expected: FAIL — `OceanHud` module missing; integration tests fail on missing `data-hud` / `data-site` nodes. The Task 3 tests still pass.

- [ ] **Step 4: Create `OceanHud.jsx`**

```jsx
// OceanHud.jsx — the Ledger ocean's instrument overlay (spec §4 HUD).
// Monospace, over the canvas; pointer events only on the controls and the
// source rings. Per-frame text (clock, frame monitor) is written through the
// imperative handle, not React state, so the HUD does not re-render at the
// display rate. The probe readout is state: it changes at most at 10 Hz.

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  HUD_TITLE, LEGEND_NOTES, LEGEND_SWATCHES, MODE_LABEL, PROBE_HINT, PROBE_NOTE,
  formatClock, formatFrame, lonLatToPct, summaryLine, tooltipLines,
} from './hudFormat';

const INK = 'rgba(20,184,166,0.72)';
const DIM = 'rgba(20,184,166,0.42)';
const FRAME_TEXT_MS = 250;
const RING_PX = 16;

const controlStyle = {
  pointerEvents: 'auto',
  background: 'transparent',
  border: 'none',
  padding: 0,
  font: 'inherit',
  letterSpacing: 'inherit',
  color: 'rgba(94,234,212,0.9)',
  cursor: 'pointer',
  textDecoration: 'underline dotted',
};

function Swatch({ color, ring }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', width: 7, height: 7, marginRight: 3, verticalAlign: 'middle',
        background: color, border: ring ? `1px solid ${ring}` : 'none',
      }}
    />
  );
}

function tooltipBox(site) {
  const { left, top } = lonLatToPct(site.site[0], site.site[1]);
  return {
    position: 'absolute',
    ...(left > 60 ? { right: `calc(${100 - left}% + 12px)` } : { left: `calc(${left}% + 12px)` }),
    ...(top > 60 ? { bottom: `calc(${100 - top}% + 10px)` } : { top: `calc(${top}% + 10px)` }),
    background: 'rgba(0,0,0,0.9)',
    border: `1px solid ${site.color}`,
    padding: '4px 7px',
    color: site.color,
    whiteSpace: 'nowrap',
  };
}

const OceanHud = forwardRef(function OceanHud({
  compact = false,
  mode = 'live',
  reducedMotion = false,
  daysPerSecond,
  onCycleCompression,
  sites = [],
  latestHash = null,
  verdicts = [],
}, ref) {
  const clockRef = useRef(null);
  const frameRef = useRef(null);
  const frameAtRef = useRef(-Infinity);
  const [probe, setProbe] = useState(null);
  const [focus, setFocus] = useState(null);

  useImperativeHandle(ref, () => ({
    setFrame({ simDays, frameMs, now }) {
      const clock = formatClock(simDays);
      if (clockRef.current && clockRef.current.textContent !== clock) clockRef.current.textContent = clock;
      if (frameRef.current && now - frameAtRef.current >= FRAME_TEXT_MS) {
        frameRef.current.textContent = formatFrame(frameMs);
        frameAtRef.current = now;
      }
    },
    setProbe(text) {
      setProbe(text);
    },
  }), []);

  const focused = sites.find((s) => s.id === focus) ?? null;
  const live = mode === 'live';

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        font: `${compact ? 8 : 9}px monospace`, letterSpacing: '0.12em', lineHeight: 1.5, color: INK,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 360 180"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {sites
          .filter((s) => s.kind === 'verdict' && Math.abs(s.snap[0] - s.site[0]) <= 180)
          .map((s) => (
            <line
              key={s.id}
              x1={s.site[0] + 180} y1={90 - s.site[1]} x2={s.snap[0] + 180} y2={90 - s.snap[1]}
              stroke={s.color} strokeOpacity="0.6" strokeWidth="1" vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>

      {sites.map((s) => {
        const { left, top } = lonLatToPct(s.site[0], s.site[1]);
        const latest = s.id === latestHash;
        return (
          <button
            key={s.id}
            type="button"
            data-site={s.id}
            aria-label={tooltipLines(s).join(' · ')}
            onMouseEnter={() => setFocus(s.id)}
            onMouseLeave={() => setFocus((f) => (f === s.id ? null : f))}
            onFocus={() => setFocus(s.id)}
            onBlur={() => setFocus((f) => (f === s.id ? null : f))}
            onClick={() => setFocus((f) => (f === s.id ? null : s.id))}
            style={{
              position: 'absolute', left: `${left}%`, top: `${top}%`, width: RING_PX, height: RING_PX,
              transform: 'translate(-50%, -50%)', padding: 0, border: 'none', background: 'transparent',
              cursor: 'pointer', pointerEvents: 'auto',
            }}
          >
            <span
              style={{
                position: 'absolute', inset: latest ? 2 : 4, borderRadius: '50%',
                border: `${latest ? 2 : 1.5}px solid ${s.color}`, opacity: s.kind === 'preset' ? 0.6 : 0.95,
              }}
            />
          </button>
        );
      })}

      {focused && (
        <div data-hud="tooltip" role="tooltip" style={tooltipBox(focused)}>
          {tooltipLines(focused).map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      <div style={{ position: 'absolute', left: 8, top: 6 }}>
        {live ? (
          <>
            <span ref={clockRef} data-hud="clock" />
            {reducedMotion ? (
              <span style={{ color: DIM }}> · STILL · REDUCED MOTION</span>
            ) : (
              <>
                {' · '}
                <button
                  type="button"
                  data-hud="compression"
                  onClick={onCycleCompression}
                  aria-label={`Time compression: 1 s = ${daysPerSecond} simulated days. Click to change.`}
                  style={controlStyle}
                >
                  {`1 s = ${daysPerSecond} d`}
                </button>
                {!compact && (
                  <>
                    {' · '}
                    <span ref={frameRef} data-hud="frame" style={{ color: DIM }} />
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <span data-hud="mode">{MODE_LABEL[mode]}</span>
        )}
      </div>

      {!compact && (
        <div data-hud="title" style={{ position: 'absolute', right: 8, top: 6, color: DIM, letterSpacing: '0.2em' }}>
          {HUD_TITLE}
        </div>
      )}

      <div style={{ position: 'absolute', left: 8, bottom: 6, maxWidth: compact ? 'calc(100% - 16px)' : '58%' }}>
        {compact && probe ? (
          <>
            <div data-hud="probe">{probe}</div>
            <div style={{ color: DIM }}>{PROBE_NOTE}</div>
          </>
        ) : (
          <>
            {!compact && <div data-hud="summary">{summaryLine(verdicts)}</div>}
            <div data-hud="legend" style={{ color: DIM }}>
              {LEGEND_SWATCHES.map((s) => (
                <span key={s.label} style={{ marginRight: 8, whiteSpace: 'nowrap' }}>
                  <Swatch color={s.color} ring={s.ring} />
                  {s.label}
                </span>
              ))}
              <div>{LEGEND_NOTES.join(' / ')}</div>
            </div>
          </>
        )}
      </div>

      {!compact && (
        <div style={{ position: 'absolute', right: 8, bottom: 6, maxWidth: '40%', textAlign: 'right' }}>
          <div data-hud="probe">{probe ?? PROBE_HINT}</div>
          {probe && <div style={{ color: DIM }}>{PROBE_NOTE}</div>}
        </div>
      )}
    </div>
  );
});

export default OceanHud;
```

- [ ] **Step 5: Rewrite `LedgerOcean.jsx` with sources, probe, compression and the HUD**

Replace `src/terminal/views/ledger/ocean/LedgerOcean.jsx` with:

```jsx
// LedgerOcean.jsx — the Ledger ocean: WebGL2 advection of audited discharge,
// composited on the shared harness, with the HUD overlay (OceanHud). The sim
// runs inside onInit/draw; the ledger is never written. Sources = the ambient
// presets plus every archived verdict (straight-line course to its snapped
// ocean cell). Without float render targets (or if a sim program fails to
// build) it draws the static coastline only; without WebGL2 it says so.
//
// Lifecycle:
// - Size changes resize the canvas in place (hostRef.resize). The host is
//   built once per GL context, never per size: a rebuild would loseContext()
//   on dispose, and the next getContext() on the same canvas returns that
//   dead context (CouncilField pattern).
// - A lost context suspends drawing. On restore the canvas is remounted
//   (key = generation) and the host rebuilt; the ocean restarts from T+0,
//   because its state lived in GPU memory.
// - Reduced motion: the warm-up is spread over frames (nothing is painted
//   meanwhile), then one frame is held and repainted only when resized. A new
//   source re-runs the warm-up, then repaints once.
// - Probe: a 1-texel float readback of the state, at most every
//   PROBE_INTERVAL_MS of frame time; mouse hover on desktop, tap elsewhere.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShaderCanvas } from '../../../gl/useShaderCanvas';
import { createFloatTexture } from '../../../gl/pingPong';
import { getOceanWorld } from '../../../ledger/ocean/oceanWorld';
import { createOceanGpu } from '../../../ledger/ocean/gpu/oceanGpu';
import { packSources } from '../../../ledger/ocean/gpu/gpuData';
import { verdictSources } from '../../../ledger/ocean/sources';
import { SIM_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS } from '../../../ledger/ocean/gpu/shaders';
import { OCEAN_EXPOSURE } from '../../../ledger/ocean/gpu/palette';
import { createStepClock } from '../../../ledger/ocean/clock';
import { createOceanDriver, REDUCED_MOTION_DAYS } from './oceanDriver';
import OceanHud from './OceanHud';
import {
  COMPACT_BELOW_PX, DEFAULT_COMPRESSION, PROBE_INTERVAL_MS, PROBE_TAP_HOLD_MS,
  describeSites, formatProbe, nextCompression, pointerToLonLat,
} from './hudFormat';

const CONTEXT_OPTIONS = { alpha: false, antialias: false, premultipliedAlpha: false };
const NO_VERDICTS = [];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function paint({ gl, prog, U, vao }, grid, tex, sim, tsec) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.useProgram(prog);
  gl.bindVertexArray(vao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sim ? sim.stateTexture() : tex.zero);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, tex.static);
  gl.uniform1i(U.uState, 0);
  gl.uniform1i(U.uStatic, 1);
  gl.uniform2f(U.uGrid, grid.nx, grid.ny);
  gl.uniform2f(U.uRes, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(U.uTime, tsec);
  const { ref, gain, rim, aberration } = OCEAN_EXPOSURE;
  gl.uniform4f(U.uRef, ref[0], ref[1], ref[2], ref[3]);
  gl.uniform4f(U.uGain, gain[0], gain[1], gain[2], gain[3]);
  gl.uniform1f(U.uRim, rim);
  gl.uniform1f(U.uAberration, aberration);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export default function LedgerOcean({
  width,
  height,
  daysPerSecond = DEFAULT_COMPRESSION,
  verdicts = NO_VERDICTS,
  latestHash = null,
  onFrame = null,
}) {
  const canvasRef = useRef(null);
  const hudRef = useRef(null);
  const world = useMemo(() => getOceanWorld(), []);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const [dps, setDps] = useState(daysPerSecond);
  const [mode, setMode] = useState('live'); // 'live' | 'static' | 'static-shader' | 'unsupported' | 'lost'
  const [generation, setGeneration] = useState(0);

  const simRef = useRef(null);
  const driverRef = useRef(null);
  const texRef = useRef(null);
  const uploadedRef = useRef(null);
  const lostRef = useRef(false);
  const warmRef = useRef(false);
  const dirtyRef = useRef(true);
  const sizeRef = useRef({ width, height });
  const probeRef = useRef(null);
  const probeAtRef = useRef(-Infinity);
  const tapTimerRef = useRef(0);
  const dpsRef = useRef(dps);
  dpsRef.current = dps;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const userSources = useMemo(() => verdictSources(verdicts, world.grid, world.mask), [world, verdicts]);
  const sources = useMemo(() => [...world.sources, ...userSources], [world, userSources]);
  const sourceData = useMemo(
    () => (userSources.length ? packSources(world.grid, world.mask.land, sources) : world.ambientSourceData),
    [world, sources, userSources],
  );
  const sites = useMemo(() => describeSites(sources, verdicts), [sources, verdicts]);
  const sourceDataRef = useRef(sourceData);
  sourceDataRef.current = sourceData;

  const readProbe = (now, sim) => {
    const p = probeRef.current;
    if (!p || now - probeAtRef.current < PROBE_INTERVAL_MS) return;
    probeAtRef.current = now;
    const land = !!world.mask.land[p.k];
    const v = land || !sim ? null : sim.readCell(p.i, p.j);
    hudRef.current?.setProbe(formatProbe(p.lon, p.lat, v, land));
  };

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
    // The loop must run under reduced motion: it carries the spread warm-up,
    // then idles (draw returns without painting) until a resize or new source.
    haltOnReducedMotion: false,
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
      } else {
        texRef.current = {
          static: createFloatTexture(gl, grid.nx, grid.ny, world.staticData),
          zero: createFloatTexture(gl, grid.nx, grid.ny, new Float32Array(grid.n * 4)),
        };
        setMode(failed ? 'static-shader' : 'static');
      }
    },
    onDispose: (gl) => {
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
    draw: (host, { now, dt, tsec, hidden, reducedMotion: rm }) => {
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
          warmRef.current = driver.warmupChunk(REDUCED_MOTION_DAYS);
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
        dirtyRef.current = false;
      }
      const simDays = driver ? driver.simDays() : 0;
      hudRef.current?.setFrame({ simDays, frameMs: driver ? driver.frameMs() : 0, now });
      onFrameRef.current?.(simDays);
    },
    onUnsupported: () => setMode('unsupported'),
    deps: [generation],
  });

  // Resize in place. Skips the mount pass (the host was just built at this
  // size): assigning canvas.width clears the drawing buffer even when the
  // value is unchanged.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (sizeRef.current.width === width && sizeRef.current.height === height) return;
    sizeRef.current = { width, height };
    host.resize(width, height);
    dirtyRef.current = true;
  }, [hostRef, width, height]);

  // Context loss (GPU reset, driver eviction, too many contexts). The listener
  // must preventDefault() or the browser never fires webglcontextrestored.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const onLost = (e) => {
      e.preventDefault();
      lostRef.current = true;
      setMode('lost');
    };
    const onRestored = () => {
      setMode('live');
      setGeneration((g) => g + 1);
    };
    el.addEventListener('webglcontextlost', onLost);
    el.addEventListener('webglcontextrestored', onRestored);
    return () => {
      el.removeEventListener('webglcontextlost', onLost);
      el.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [generation]);

  useEffect(() => () => clearTimeout(tapTimerRef.current), []);

  const probeAt = useCallback((clientX, clientY) => {
    const el = canvasRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const p = pointerToLonLat(clientX - r.left, clientY - r.top, r.width, r.height);
    if (!p) return false;
    const { i, j } = world.grid.lonLatToCell(p.lon, p.lat);
    probeRef.current = { ...p, i, j, k: world.grid.idx(i, j) };
    return true;
  }, [world]);

  const clearProbe = useCallback(() => {
    probeRef.current = null;
    hudRef.current?.setProbe(null);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (e.pointerType !== 'mouse') return;
    if (!probeAt(e.clientX, e.clientY)) clearProbe();
  }, [probeAt, clearProbe]);

  const onPointerLeave = useCallback((e) => {
    if (e.pointerType === 'mouse') clearProbe();
  }, [clearProbe]);

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === 'mouse') return;
    if (!probeAt(e.clientX, e.clientY)) return;
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(clearProbe, PROBE_TAP_HOLD_MS);
  }, [probeAt, clearProbe]);

  const cycleCompression = useCallback(() => setDps((d) => nextCompression(d)), []);

  return (
    <div style={{ position: 'relative', width, height, background: '#050505' }}>
      <canvas
        key={generation}
        ref={canvasRef}
        aria-label="Ledger ocean: advection of audited discharge"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        style={{ display: mode === 'unsupported' ? 'none' : 'block', width, height, touchAction: 'manipulation' }}
      />
      <OceanHud
        ref={hudRef}
        compact={width < COMPACT_BELOW_PX}
        mode={mode}
        reducedMotion={reducedMotion}
        daysPerSecond={dps}
        onCycleCompression={cycleCompression}
        sites={sites}
        latestHash={latestHash}
        verdicts={verdicts}
      />
    </div>
  );
}
```

- [ ] **Step 6: Run the view tests**

Run: `npx vitest run src/terminal/views/ledger/ocean/__tests__/`
Expected: PASS (all Task 3 tests plus 8 HUD and 7 integration tests). The Task 3 tests that query `MODE_LABEL.*` by text now find it in the HUD's `data-hud="mode"` span.

- [ ] **Step 7: Mutation checks**

1. `readProbe`: delete the `now - probeAtRef.current < PROBE_INTERVAL_MS` condition → the throttle test fails (60 reads).
2. `probeAt`: pass `(clientY - r.top, clientX - r.left, …)` swapped → the hover probe test fails (wrong `readPixels` cell).
3. `onPointerDown`: delete the `setTimeout(…)` line → the tap test fails (readout never clears).
4. Draw: delete the `if (sim && uploadedRef.current !== …) { … }` block → the verdict-source test fails (no upload).
5. Draw: remove `uploadedRef.current = sourceDataRef.current;` inside that block → the verdict-source test fails (uploads every frame).
6. Draw: delete `driver.resetWarmup(); warmRef.current = false;` → the reduced-motion re-settle test fails.
7. `cycleCompression`: `setDps((d) => d)` → the compression test fails.
8. OceanHud `setFrame`: delete the `now - frameAtRef.current >= FRAME_TEXT_MS` condition → the HUD throttle test fails.
9. OceanHud: render the frame span when `compact` → the mobile collapse test fails.
10. OceanHud: `onMouseLeave` does nothing → the tooltip test fails.
11. Draw: delete the `hudRef.current?.setFrame(…)` line → the clock integration test fails.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/views/ledger/ocean/OceanHud.jsx src/terminal/views/ledger/ocean/LedgerOcean.jsx src/terminal/views/ledger/ocean/__tests__/OceanHud.test.jsx src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx
git commit -m "feat(ledger-ocean): HUD with clock, compression, frame monitor, legend, probe and source rings; verdicts become sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The tab — ocean hero, v2.0 header, old hero deleted

**Files:**
- Modify: `src/terminal/views/LedgerTab.jsx`
- Delete: `src/terminal/views/ledger/LedgerMap.jsx`, `src/terminal/views/ledger/LedgerParticles.jsx`
- Test: `src/terminal/views/__tests__/LedgerTab.test.jsx` (new)

**Interfaces:**
- Consumes: `LedgerOcean({ width, height, verdicts, latestHash })` (Task 5); `SubmissionForm({ onSubmit, loading, apiData, onApiFetch, apiLoading, apiError, verdicts })`; `AuditCascade({ verdict, visible, onComplete })`; `storeVerdict(v) → Promise<v with hash>`, `getAllVerdicts()`, `getVerdictCount()`; `loadWasm() → module` with `run_chrono_actuary` (registry `CHRONOS-KERNEL-2.1.0`); `ledgerBus.emit`; `emit(category, kind, payload)` from `src/observatory/observatoryBus.js`.
- Produces: hero = `<LedgerOcean>` at the measured hero width, height `Math.round(width / 2)`; on cascade completion the sealed verdict is prepended to `verdicts` (→ ocean source + ring), `latestHash` set, `ledgerBus` / observatory emits unchanged.

- [ ] **Step 1: Write the failing tab test**

Create `src/terminal/views/__tests__/LedgerTab.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  oceanProps: [],
  INPUT: { lat: 31.3, lon: 120.6, siteName: 'Test site', temp: 20, do: 6, bod: 10, dt: 2, epi: 3, nitrate: 5, flow: 42 },
}));

vi.mock('../ledger/ocean/LedgerOcean', async () => {
  const { createElement } = await import('react');
  return { default: (props) => { h.oceanProps.push(props); return createElement('div', { 'data-testid': 'ocean-stub' }); } };
});
vi.mock('../ledger/SubmissionForm', async () => {
  const { createElement } = await import('react');
  return { default: ({ onSubmit }) => createElement('button', { type: 'button', onClick: () => onSubmit(h.INPUT) }, 'stub-submit') };
});
vi.mock('../ledger/AuditCascade', async () => {
  const { createElement } = await import('react');
  return { default: ({ onComplete }) => createElement('button', { type: 'button', onClick: () => onComplete() }, 'stub-complete') };
});
vi.mock('../../ledger/verdictStore', () => ({
  getAllVerdicts: vi.fn(async () => []),
  getVerdictCount: vi.fn(async () => 0),
  storeVerdict: vi.fn(async (v) => ({ ...v, hash: 'h-new' })),
}));
vi.mock('../../../wasm/wasmSingleton', () => ({
  loadWasm: async () => ({ run_chrono_actuary: () => 'RULING' }),
}));
vi.mock('../../../observatory/observatoryBus', () => ({ emit: vi.fn() }));

import LedgerTab from '../LedgerTab';
import { ledgerBus } from '../../ledger/ledgerBus';
import { emit as emitObs } from '../../../observatory/observatoryBus';

describe('LedgerTab — ocean hero (phase 3a)', () => {
  beforeEach(() => { h.oceanProps.length = 0; });

  it('renders the ocean in the hero slot at 2:1 with the v2.0 header, and no eclipse', async () => {
    render(<LedgerTab />);
    expect(screen.getByTestId('ocean-stub')).toBeTruthy();
    const last = h.oceanProps.at(-1);
    expect(last.width).toBeGreaterThan(0);
    expect(last.height).toBe(Math.round(last.width / 2));
    expect(screen.getByText('The Open Ledger')).toBeTruthy();
    expect(screen.getByText('v2.0')).toBeTruthy();
    expect(screen.getByText('HYDROLOGICAL AUDIT & OUTFALL DISPERSION')).toBeTruthy();
    expect(screen.getByText(/The equations are the authority\./)).toBeTruthy();
    expect(screen.getByText('Every verdict drains somewhere. The ocean keeps the account.')).toBeTruthy();
    expect(document.head.innerHTML).not.toMatch(/lt-eclipse/);
    await waitFor(() => expect(h.oceanProps.at(-1).verdicts).toEqual([]));
  });

  it('hands the sealed verdict to the ocean on cascade completion and keeps both emits', async () => {
    const busSpy = vi.spyOn(ledgerBus, 'emit');
    render(<LedgerTab />);
    fireEvent.click(screen.getByText('stub-submit'));
    const complete = await screen.findByText('stub-complete');
    act(() => { fireEvent.click(complete); });
    await waitFor(() => expect(h.oceanProps.at(-1).verdicts.map((v) => v.hash)).toEqual(['h-new']));
    expect(h.oceanProps.at(-1).latestHash).toBe('h-new');
    expect(busSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'VERDICT_ISSUED', verdict: expect.objectContaining({ hash: 'h-new' }),
    }));
    expect(emitObs).toHaveBeenCalledWith('transmissions', 'verdict_issued', expect.objectContaining({ verdict: expect.any(String) }));
    busSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/views/__tests__/LedgerTab.test.jsx`
Expected: FAIL — no `ocean-stub` (the tab still renders `LedgerMap`), header text not found.

- [ ] **Step 3: Edit `LedgerTab.jsx`**

(a) Imports: delete `import LedgerMap from './ledger/LedgerMap';`, `import LedgerParticles from './ledger/LedgerParticles';` and `import { toMapXY } from '../data/worldMapPolys';`. After `import AuditCascade from './ledger/AuditCascade';` add `import LedgerOcean from './ledger/ocean/LedgerOcean';`.

(b) Boot constants: replace

```js
// Phase 1: map fades in (0→0.8s)
```
with
```js
// Phase 1: ocean hero fades in (0→0.8s)
```
and `const PHASE_MAP   = 800;` with `const PHASE_HERO  = 800;`. After `const PHASE_FORM  = 2000;` add:

```js
// Hero width before layout is measured (jsdom has no layout); replaced by the
// ResizeObserver measurement on the first effect in a browser.
const HERO_FALLBACK_W = 1024;
```

(c) In `LEDGER_STYLES`, delete everything from the line `/* ── Lunar eclipse sweep (CSS-only, div-based) ───────────────────────── */` through the closing `}` of `@keyframes lt-eclipseLift { … }` (the four `lt-eclipse*` keyframes), leaving the template literal closed by the existing `` `; ``.

(d) State and refs: replace `const [mapBooted, setMapBooted] = useState(false);` with:

```js
  const [heroBooted, setHeroBooted] = useState(false);
  const [heroW, setHeroW] = useState(0);
```

and replace

```js
  const particlesRef = useRef(null);
  const mapContainerRef = useRef(null);
```

with

```js
  const heroRef = useRef(null);
```

In the boot effect replace `setTimeout(() => setMapBooted(true), PHASE_MAP)` with `setTimeout(() => setHeroBooted(true), PHASE_HERO)`. After the "Inject keyframes once" effect add:

```js
  // Hero width drives the ocean's backing store (2:1). Resizes are applied in
  // place by LedgerOcean (hostRef.resize), never by rebuilding its GL host.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    const measure = () => setHeroW(Math.floor(el.clientWidth) || HERO_FALLBACK_W);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
```

(e) `handleCascadeComplete`: delete the whole `// Fire particle burst at the verdict's map position` block (the `if (particlesRef.current && …) { … }`), and replace the line `const handleCascadeComplete = useCallback(() => {` with:

```js
  // Phase 3a: no eclipse and no burst. The sealed verdict joins `verdicts`;
  // LedgerOcean turns it into a permanent source (straight-line course to its
  // snapped ocean cell) and rings its site, latestHash marking the ring. The
  // seal sequence (clock ease, flare along the course) is phase 3b.
  const handleCascadeComplete = useCallback(() => {
```

(f) Hero: replace everything from `{/* ── Hero: Verdict Map ─────…── */}` through the closing `</div>` of that hero block (the one that ends right after the vignette overlay div, before `{/* ── Header ──…── */}`) with:

```jsx
      {/* ── Hero: the ocean ledger ────────────────────────────────────────── */}
      <div
        ref={heroRef}
        className="mb-6 relative"
        style={{ aspectRatio: '2 / 1', opacity: heroBooted ? 1 : 0, transition: 'opacity 0.8s ease' }}
      >
        {heroW > 0 && (
          <LedgerOcean
            width={heroW}
            height={Math.round(heroW / 2)}
            verdicts={verdicts}
            latestHash={latestHash}
          />
        )}
        {/* Vignette overlay — above the canvas, below the HUD (OceanHud zIndex 2) */}
        <div
          className="absolute inset-0 pointer-events-none rounded-sm"
          style={{
            zIndex: 1,
            background: 'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.5) 100%)',
          }}
        />
      </div>
```

(g) Header: replace `<span className="text-[10px] font-mono text-zinc-600">v1.0</span>` with `<span className="text-[10px] font-mono text-zinc-600">v2.0</span>`; replace the h1 text `THERMODYNAMIC AUDIT INFRASTRUCTURE` with `HYDROLOGICAL AUDIT &amp; OUTFALL DISPERSION`; in the subtitle `<p>`, after `immutable, and citable. The equations are the authority.` add on the next line:

```jsx
          <span className="block mt-1 text-zinc-400">Every verdict drains somewhere. The ocean keeps the account.</span>
```

- [ ] **Step 4: Delete the old hero files**

```bash
git rm src/terminal/views/ledger/LedgerMap.jsx src/terminal/views/ledger/LedgerParticles.jsx
```

Then confirm nothing references them or the removed plumbing:
Run: `grep -rn "LedgerMap\|LedgerParticles\|lt-eclipse\|particlesRef\|mapContainerRef\|mapBooted" src/`
Expected: no output.
Run: `grep -n "toMapXY" src/terminal/views/LedgerTab.jsx`
Expected: no output (`toMapXY` itself stays in `worldMapPolys.js`; EcocideTab and interceptGeometry use it).

- [ ] **Step 5: Run the tab test and the ledger suites**

Run: `npx vitest run src/terminal/views/__tests__/LedgerTab.test.jsx src/terminal/views/ledger/ tests/ledger/ src/terminal/ledger/`
Expected: PASS.

- [ ] **Step 6: Mutation checks**

1. Drop `verdicts={verdicts}` from `<LedgerOcean>` → the completion test fails.
2. Drop `latestHash={latestHash}` → the completion test fails.
3. Revert the h1 to `THERMODYNAMIC AUDIT INFRASTRUCTURE` → the header test fails.
4. Delete the closing-line `<span>` → the header test fails.
5. Change `height={Math.round(heroW / 2)}` to `height={320}` → the hero test fails.
6. Delete the `ledgerBus.emit(…)` line → the completion test fails.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/LedgerTab.jsx src/terminal/views/__tests__/LedgerTab.test.jsx
git commit -m "feat(ledger): the ocean is the Ledger hero; header v2.0; SVG map, particle burst and eclipse removed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git rm` in Step 4 already staged the two deletions; `git status --short` before committing must show exactly the two `D` files and the two modified/added paths above staged.)

---

### Task 7: Screenshots of the live tab and the user's visual review

**Files:**
- Create: `scripts/ledgerTabShots.mjs`

**Interfaces:**
- Consumes: `launch({ url, width, height, dpr })` → page with `send`, `eval`, `waitFor`, `screenshot({ path, clip })`, `hover(x, y)`, `enableTouch()`, `touch(type, x, y)`, `consoleErrors()`, `close()`. Nav buttons `button[aria-label="Ledger"]` (desktop bar and mobile bar, `src/terminal/App.jsx`). Canvas `canvas[aria-label^="Ledger ocean"]`.
- Produces: PNGs in `<os tmpdir>/ledger-tab-shots` (or the first CLI argument), printed paths.

- [ ] **Step 1: Create the script**

```js
// Screenshots of the live Ledger tab (ocean hero, HUD, header) for visual
// review: desktop 1440×1000 @1x and phone 390×844 @3x, headless Chrome
// (SwiftShader). Per view: the viewport after 8 s, the hero alone, the hero
// with the probe active (hover on desktop, tap on the phone) and, desktop
// only, a source-ring tooltip.
//
//   node scripts/ledgerTabShots.mjs [outDir]
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from './cdp.mjs';

const OUT = process.argv[2] || join(tmpdir(), 'ledger-tab-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HERO = `document.querySelector('canvas[aria-label^="Ledger ocean"]')`;
const NAV = `[...document.querySelectorAll('button[aria-label="Ledger"]')].find((b) => b.offsetParent)`;
const VIEWS = [
  { name: 'desktop', width: 1440, height: 1000, dpr: 1, mobile: false },
  { name: 'mobile', width: 390, height: 844, dpr: 3, mobile: true },
];
const PROBE_AT = [-88.0, 26.5];      // Gulf of Mexico, off the Mississippi mouth
const RING_AT = [6.9603, 50.9375];   // Rhine preset site (Cologne)

await mkdir(OUT, { recursive: true });
const server = await createServer({ server: { port: 5196, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const shot = async (page, name, clip) => {
  const path = join(OUT, name);
  await page.screenshot({ path, ...(clip ? { clip } : {}) });
  console.log(path);
};
try {
  for (const v of VIEWS) {
    const page = await launch({ url: base, width: v.width, height: v.height, dpr: v.dpr });
    try {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width: v.width, height: v.height, deviceScaleFactor: v.dpr, mobile: v.mobile,
      });
      if (v.mobile) await page.enableTouch();
      await page.waitFor(`!!(${NAV})`, { timeoutMs: 60000, label: 'Ledger nav' });
      await page.eval(`${NAV}.click()`);
      await page.waitFor(`(() => { const c = ${HERO}; return !!c && c.getBoundingClientRect().width > 200; })()`, {
        timeoutMs: 60000, label: 'ocean canvas',
      });
      await page.eval('window.scrollTo(0, 0)');
      await sleep(8000);
      await shot(page, `${v.name}-viewport.png`);
      const r = await page.eval(`(() => { const b = ${HERO}.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()`);
      const clip = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h), scale: 1 };
      const at = ([lon, lat]) => [r.x + ((lon + 180) / 360) * r.w, r.y + ((90 - lat) / 180) * r.h];
      await shot(page, `${v.name}-hero.png`, clip);
      const [px, py] = at(PROBE_AT);
      if (v.mobile) {
        await page.touch('touchStart', px, py);
        await page.touch('touchEnd', px, py);
      } else {
        await page.hover(px, py);
      }
      await sleep(400);
      await shot(page, `${v.name}-hero-probe.png`, clip);
      if (!v.mobile) {
        const [rx, ry] = at(RING_AT);
        await page.hover(rx, ry);
        await sleep(300);
        await shot(page, `${v.name}-hero-ring-tooltip.png`, clip);
      }
      const errors = page.consoleErrors();
      if (errors.length) console.log(`${v.name} console errors: ${JSON.stringify(errors)}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await server.close();
}
process.exit(0);
```

- [ ] **Step 2: Capture**

Run: `node scripts/ledgerTabShots.mjs`
Expected: 7 PNG paths (desktop: viewport, hero, hero-probe, hero-ring-tooltip; mobile: viewport, hero, hero-probe) and no console-error line. If the nav or canvas wait times out, report BLOCKED with the error; do not change the selectors blind — open a viewport screenshot first.

- [ ] **Step 3: Look at every PNG and describe it factually**

Open each PNG (Read tool). Report, without adjectives the pixels do not support:
- Desktop: the hero spans the content width at 2:1; plumes visible at the five preset mouths; vignette darkens edges but the HUD corners stay legible; top-left clock `T+ … d · 1 s = 9 d · Δt … ms · … Hz`; top-right `THE OPEN LEDGER v2.0`; bottom-left summary + swatches + the six legend notes; bottom-right probe text in the probe shot; the Rhine tooltip lines; five teal preset rings; header eyebrow `The Open Ledger v2.0`, the new h1 and the closing line; no leftover eclipse or map dots.
- Mobile: hero width = viewport − 24 px at 2:1; only clock + compression top-left and the legend bottom-left; the tapped probe replaces the legend; text overlap or clipping, if any.
Also run `npx vitest run src/terminal/views/ledger/ocean/` once more if anything is changed in response.

- [ ] **Step 4: Commit**

```bash
git add scripts/ledgerTabShots.mjs
git commit -m "chore(ledger): CDP screenshots of the live Ledger tab at desktop and phone widths

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: STOP — the user's visual review**

The controller shows the PNGs to the user. HUD layout, sizes, colours and the legend wording change only on the user's direction, in follow-up commits (re-captured with `node scripts/ledgerTabShots.mjs`, each change's tests re-run). The phase gate runs after the user signs off.

---

### Task 8: Phase gate

**Files:** none (verification only).

- [ ] **Step 1: Suite and lint**

Run: `npm test`
Expected: all green except the known `src/terminal/art/__tests__/artComposite.test.js` coarse-DPR failure. Record the pass/fail counts.
Run: `npm run lint`
Expected: 0 errors, ≤ 143 warnings (the script fails above 143). If new warnings come from 3a files, fix them in those files and re-run the affected tests.

- [ ] **Step 2: Real-GPU gates**

Run: `node scripts/oceanShaders.mjs` — exit 0.
Run: `node scripts/oceanParity.mjs` — exit 0; record the final-step relative error per channel (3a must not have changed them: no shader or oracle file changed).
Run: `node scripts/oceanWarmup.mjs` — exit 0; `laterTasks` is empty.

- [ ] **Step 3: Boundary checks**

Run: `git diff --stat cdf3e864..HEAD -- src/terminal/ledger/auditPresets.js src/terminal/ledger/verdictStore.js src/terminal/ledger/ledgerBus.js src/terminal/views/ledger/AuditCascade.jsx src/terminal/views/ledger/SubmissionForm.jsx src/terminal/views/ledger/CoordinatePicker.jsx src/terminal/gl/__tests__/__snapshots__ src/terminal/gl/glHost.js src/terminal/gl/frameLoop.js src/terminal/gl/useShaderCanvas.js src/terminal/ledger/ocean/gpu/shaders.js src/terminal/ledger/ocean/referenceStep.js`
Expected: empty output.
Run: `git ls-files src/terminal/views/ledger/LedgerMap.jsx src/terminal/views/ledger/LedgerParticles.jsx`
Expected: empty output.
Run: `grep -rln "verdictStore\|ledgerBus" src/terminal/ledger/ocean src/terminal/views/ledger/ocean`
Expected: empty output.
Run: `git diff cdf3e864..HEAD -- src/terminal/views/LedgerTab.jsx | grep -n "VERDICT_ISSUED\|verdict_issued"`
Expected: no `-`/`+` lines touching the two emit calls (they are unchanged context, so this prints nothing).
Run: `git status --short -- docs src scripts ledger-ocean-preview.html`
Expected: only the pre-existing unrelated entries (`docs/superpowers/specs/2026-09-25-council-field-accretion-design.md`, `src/terminal/views/manifesto/__tests__/__snapshots__/councilField.test.jsx.snap`); nothing from 3a left unstaged.

- [ ] **Step 4: Visual confirmation**

Re-run `node scripts/ledgerTabShots.mjs` on the final HEAD and open the desktop and mobile hero PNGs; confirm they match what the user signed off in Task 7 (state any difference).

- [ ] **Step 5: Report**

Report: test counts, lint warning count, parity numbers, shader-check result, the warm-up measurements (Task 2 baseline vs final), the user's visual sign-off, and every mutation (all tasks) that unexpectedly did NOT fail. Do not push.
