# Mercury Lighting Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The spun liquid planet reads as photographed liquid mercury: no terminator on the mirror, highlights that blow out, a sharper mirror, midtones from structure.

**Architecture:** All changes live in the shared Hg mirror chunks (`aetherSky.js`, `hgMirrorGlsl.js`) and reach the four liquid call sites through one new entry point, `envRadianceLiquid`. Every new effect is a live knob whose default reproduces today's look, so each task lands look-neutral except the one change it is about. The author then rules each default.

**Tech Stack:** three.js raw GLSL (WebGL2) strings, vitest (string, replica and file-snapshot tests), CDP look scripts in `.superpowers/sdd/tools/` (dev server `scale94-dev-5175`).

**Spec:** `docs/superpowers/specs/2026-11-22-mercury-lighting-polish-design.md`

## Global Constraints

- Branch `polish/mercury-lighting`. Never push, PR or merge without an explicit author command.
- Untouched: `envRadiance`, `aetherMirror`, `frozenAether`, glaze, frost rime, quench, evaporite, visitor water/rock (visitorShader.js l.190–210), element skies, the exosphere shader.
- `studioRadiance` (JS) stays a line-for-line replica of `skyStudio` (GLSL); `studioMeanCached` keys on every studio knob.
- Crust/regolith A/B: within ±1 LSB per channel (dither).
- No flat ambient lift, smooth dome or soft wrap lobe. No banding.
- Cross-reference edits go in ONE write (the author's dev tab hot-reloads half-done edits). Big shader edits: script file with a dry run.
- PLANET_FS snapshot (`__tests__/__snapshots__/planetShader.full.fs.glsl`) is re-pinned deliberately in the task that changes it (`npx vitest run -u <file>`), never incidentally.
- Every look gate: an A/B sheet AND the author's look in motion. A task is not done until the author rules.
- Known noise: the full-repo vitest has 3 pre-existing failures (artComposite + 2 strip snapshots). Run tests scoped to `src/terminal/mercury`.

## Review Focus

1. **Element ↔ neutral transitions** (wE between 0 and 1): the split shoulders must not pop. Expect a smooth cross-fade; test in Task 2 (split sums to the old sky).
2. **Boiling liquid** (rough → ROUGH_BOIL 0.4) also goes through `envRadianceLiquid`: the untinted studio must stay a blurred mean there, not a grey ball. Look item in Task 2's sheet.
3. **neutralNebula 1**: the nebula part is untinted too and must still compile and render. Shot in Task 2's sheet.
4. **Sun glint through the highlight curve**: SUN_SHOULDER 3 maps near 1, not above it; the droplet/bead glints added after env keep their own caps. Test in Task 3.
5. **D3D11 compile time**: one more function body per call site. Measure the cold mount before/after in Task 2 (it must not regress toward the 87 s stall).

---

### Task 1: Diagnose the day-half grey fill (no product code)

**Files:**
- Create: `.superpowers/sdd/tools/polish-diag.mjs` (gitignored, copy the pattern of `polish-iso.mjs`)
- Modify: `.superpowers/sdd/progress.md` (append the finding)

- [ ] **Step 1:** Write `polish-diag.mjs`: melt the planet, then shoot the liquid with (a) the ruled tune, (b) `studioSoftbox: 0`, (c) `studioKey: 0`, (d) both 0, (e) `neutralSky: 0`, plus a sampled linear value at the day-half centre and the night-half centre for each (read back via `page.screenshot` pixels; sRGB is fine).
- [ ] **Step 2:** Run `node .superpowers/sdd/tools/polish-diag.mjs a` with the dev server on 5175. Expected: one of (b)–(d) removes the grey fill. Record which term, and the pixel values, in progress.md.
- [ ] **Step 3:** If no tent term removes it, or if (e) leaves it, STOP and report to the author before Task 2. Otherwise note which term's geometry Task 5 must reshape.

### Task 2: The mirror sees the tent everywhere

**Files:**
- Modify: `src/terminal/mercury/planet/aetherSky.js` (AETHER_SKY_GLSL: split function)
- Modify: `src/terminal/mercury/planet/hgMirrorGlsl.js` (new liquid chunk + uniform)
- Modify: `src/terminal/mercury/planet/planetLook.js` (PLANET_TUNE knob)
- Modify: `src/terminal/mercury/MercuryPlanet.jsx:352,521` (uniform wiring; the droplets and beads share these objects)
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js:900,926`, `dropletShader.js:301`, `hgBeadShader.js:98` (switch to `envRadianceLiquid`)
- Test: `__tests__/aetherSky.test.js`, `__tests__/hgMirrorGlsl.test.js`, `__tests__/dropletShader.test.js`, `__tests__/hgBeadShader.test.js`, the PLANET_FS file snapshot

**Interfaces:**
- Produces (GLSL, in AETHER_SKY_GLSL): `vec3 aetherSkySplit(vec3 R, float rough, out vec3 neutral)` returns the element part (sky + mean, mixed by k); `neutral` gets the studio + nebula part (mixed by k the same way). `aetherSky(R, rough)` becomes `elem + neutral` through it and keeps its exact result.
- Produces (GLSL, in HG_ENV_GLSL): `vec3 studioShoulder(vec3 x)`: `aetherShoulder` with its knee read from `uStudioLook2.x` instead of AETHER_SHOULDER.
  `vec3 aetherMirrorLiquid(vec3 R, float rough, vec3 nW)` = `aetherTint(nW) * aetherShoulder(uAetherGain * aetherHue(elem)) + studioShoulder(uAetherGain * aetherHue(neutral))`.
  `vec3 envRadianceLiquid(vec3 R, float rough, vec3 P, vec3 nW)` = `envRadiance`'s Sun + emitter terms + `aetherMirrorLiquid`. Share the Sun/emitter code with `envRadiance` through one helper, so the two can't drift.
- Produces (uniform): `uniform vec4 uStudioLook2;` = (shoulder, falloff, seams, card), in HG_MIRROR_UNIFORMS and HG_MIRROR_DECLS_GLSL. PLANET_TUNE: `studioShoulder: 1, studioFalloff: 0, studioSeams: 0, studioCard: 0` (all = today's look).

- [ ] **Step 1: Write the failing tests**
  - aetherSky.test: `'aetherSkySplit separates the neutral sky and aetherSky is their sum'`: AETHER_SKY_GLSL contains `vec3 aetherSkySplit(vec3 R, float rough, out vec3 neutral)`, and `aetherSky` returns via `aetherSkySplit`.
  - hgMirrorGlsl.test: `'the liquid mirror tints only the element sky'`: HG_ENV_GLSL contains `envRadianceLiquid` and `aetherMirrorLiquid`; the `aetherMirrorLiquid` body applies `aetherTint` once, to the element term only; `uStudioLook2` is in HG_MIRROR_UNIFORMS and in the decls.
  - hgMirrorGlsl.test: `'envRadiance and aetherMirror are unchanged'`: their bodies equal strings captured from 8255e4c0 (paste the old bodies into the test as the expected values).
  - Planet/droplet/bead tests: the liquid line calls `envRadianceLiquid(`; frost/quench/evaporite still call `envRadiance(`.
- [ ] **Step 2:** Run `npx vitest run src/terminal/mercury/planet`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement the interfaces above in one write per file. The k-mix and SKY_W_MIN gating for each part follow today's `aetherSky` exactly.
- [ ] **Step 4:** Run the same command. Expected: all pass except the PLANET_FS file snapshot. Inspect its diff: only the chunk additions and the two call sites at l.900/926 may change. Then re-pin with `npx vitest run -u src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`.
- [ ] **Step 5: Look gate.** Extend `polish-look.mjs` into an A/B. The "before" shots are taken BEFORE Step 3 (same script, tag `before`), so no second checkout is needed. Shots: liquid ruled; liquid boiling; neutralNebula 1; crust at rest. Crust diff within ±1 LSB (compare with sharp, max abs channel diff ≤ 1). Record the cold-mount compile time before/after (Review Focus 5). Send the sheet; the author rules in motion.
- [ ] **Step 6: Commit**
```bash
git add src/terminal/mercury docs
git commit -m "fix(mercury): the liquid mirror sees the studio untinted on the night side"
```

### Task 3: Highlights that blow out

**Files:**
- Create: `src/terminal/mercury/planet/hgHighlight.js` (JS curve + its GLSL chunk)
- Modify: `hgMirrorGlsl.js` (include the chunk; apply it in `envRadianceLiquid`'s return)
- Modify: `planetLook.js` (`HG_HIGHLIGHT_KNEE = 0.6`)
- Test: `__tests__/hgHighlight.test.js`, `__tests__/hgMirrorGlsl.test.js`

**Interfaces:**
- Consumes: `envRadianceLiquid`, `uStudioLook2.x` (Task 2).
- Produces: `export function hgHighlight([r, g, b], knee = HG_HIGHLIGHT_KNEE): [r, g, b]` and `export const HG_HIGHLIGHT_GLSL` defining `vec3 hgHighlight(vec3 x)`, a line-for-line replica. The algorithm, per max channel m:
```
if m <= knee: return x
s = knee + (1 - knee) * (1 - exp(-(m - knee) / (1 - knee)))
y = x * (s / m)   // hue-preserving
```
- The curve is applied inside `envRadianceLiquid` (a single place), so all four call sites get it, and no output encode changes.

- [ ] **Step 1: Write the failing tests** in `hgHighlight.test.js`:
  - `'identity below the knee'`: `hgHighlight([0.5, 0.3, 0.1])` deep-equals the input; and `[0.6, 0.6, 0.6]` too.
  - `'C1 at the knee'`: slope from `m = 0.6` to `0.6 + 1e-4` ≈ 1 (within 1e-3).
  - `'monotone and below 1'`: for m in 0.6..50, the output max rises and stays < 1.
  - `'hue preserved'`: the ratios r/g and g/b of `[3, 1.5, 0.75]` are kept.
  - `'Sun glint stays near white'`: `hgHighlight([3, 3, 3])[0]` > 0.95 (SUN_SHOULDER 3).
  - `'the GLSL is the JS replica'`: HG_HIGHLIGHT_GLSL contains `exp(-(m - HG_HIGHLIGHT_KNEE) / (1.0 - HG_HIGHLIGHT_KNEE))`, and HG_ENV_GLSL's `envRadianceLiquid` returns through `hgHighlight(`.
- [ ] **Step 2:** Run `npx vitest run src/terminal/mercury/planet/__tests__/hgHighlight.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement. Re-pin PLANET_FS as in Task 2 Step 4.
- [ ] **Step 4:** Run `npx vitest run src/terminal/mercury`. Expected: pass (bar the 3 known failures outside this folder).
- [ ] **Step 5: Look gate.** Sheet: knob sweep `studioShoulder` 1 / 2 / 4 × `studioKey` 4 / 6 / 8 (and canopy along with the key), liquid in motion. The crust diff stays within ±1 LSB. The author rules the defaults; set them in PLANET_TUNE in the same commit.
- [ ] **Step 6: Commit** `feat(mercury): liquid highlights roll off to white; studio shoulder knob`.

### Task 4: A sharper mirror

**Files:**
- Modify (only after the ruling): `planetLook.js` (`ROUGH_LIQUID`)
- Test: whatever existing test pins ROUGH_LIQUID (`grep -rn ROUGH_LIQUID src/terminal/mercury/planet/__tests__`)

- [ ] **Step 1:** Sweep sheet: `roughLiquid` 0.14 / 0.08 / 0.06 / 0.04, with the Task 3 defaults, still + motion. Add a limb crop at 3× zoom for sparkle/aliasing.
- [ ] **Step 2:** The author rules. If the ruling reads "black glass" at every value below 0.14, keep 0.14 for now and note in progress.md that Task 5 must carry it; re-run this sweep after Task 5.
- [ ] **Step 3:** Set ROUGH_LIQUID to the ruled value, update its test and its comment (the old "black glass" rationale), and run `npx vitest run src/terminal/mercury`. Expected: pass.
- [ ] **Step 4: Commit** `feat(mercury): sharper liquid mirror (roughLiquid <value>)`.

### Task 5: Midtones from structure

**Files:**
- Modify: `aetherSky.js` (`studioRadiance` + `skyStudio`, new constants, `studioMean`/`studioMeanCached` key)
- Modify: `MercuryPlanet.jsx` (pass the new knobs to `studioMeanCached`)
- Test: `__tests__/aetherSky.test.js`

**Interfaces:**
- Consumes: `uStudioLook2.yzw` (Task 2) = (falloff, seams, card); JS knob object gains `falloff, seams, card`.
- Produces: `studioRadiance(x, y, z, { crisp, key, canopy, floor, dome, falloff, seams, card })`; `studioMeanCached(crisp, key, canopy, floor, dome, falloff, seams, card)`.

The three additions (my calls, constants at the top of aetherSky.js beside the TENT_ ones):
- **Falloff** (`TENT_FALLOFF_POW = 2`): inside each strip and the canopy, brightness × `1 − falloff · (1 − c)^POW`, where c = 1 at the centre line and 0 at the edge. Edges keep their crisp smoothsteps.
- **Seams** (`TENT_SEAM_COUNT = 6`, `TENT_SEAM_W = 0.006` rad, `TENT_SEAM_LUM = 0.02`): faint vertical lines in azimuth across the tent walls (|R.y| < TENT_STRIP_Y1, outside the strips), each `seams · TENT_SEAM_LUM · key`. Thin enough to bend visibly in ripples; no noise (no banding source).
- **Card** (`TENT_CARD_AZ`, `TENT_CARD_Y`, `TENT_CARD_HW = 0.18`, `TENT_CARD_COL = [1.0, 0.72, 0.38]` linear (the corona's amber; confirm the hue against the corona shader's colour constant and use that), `TENT_CARD_LUM = 0.15`): a crisp-edged rectangle, low on the Sun side. skyStudio then returns `vec3` colour instead of `vec3(L)`.

- [ ] **Step 1: Write the failing tests** in aetherSky.test:
  - `'new knobs at 0 reproduce the ruled tent exactly'`: for a 32×64 direction grid, `studioRadiance` with `{...STUDIO_DEFAULTS, falloff: 0, seams: 0, card: 0}` equals the 8255e4c0 value (capture `studioMean(STUDIO_DEFAULTS)` before editing and assert equality to 1e-12).
  - `'falloff darkens the strip centre-to-edge, not the edge itself'`: on the key strip, the value at its centre with falloff 1 equals the falloff-0 value, and halfway out it is lower.
  - `'seams are thin and faint'`: max added radiance ≤ `TENT_SEAM_LUM · key`; the fraction of the grid touched < 5 %.
  - `'the card is warm and sunward only'`: it adds radiance only for directions within its rectangle, with r > g > b.
  - `'studioMeanCached recomputes when any new knob changes'`.
  - `'skyStudio mirrors studioRadiance'`: every new constant is interpolated into AETHER_SKY_GLSL (extend the existing constants test).
- [ ] **Step 2:** Run `npx vitest run src/terminal/mercury/planet/__tests__/aetherSky.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement JS and GLSL in one write. Re-pin PLANET_FS.
- [ ] **Step 4:** Run `npx vitest run src/terminal/mercury`. Expected: pass.
- [ ] **Step 5: Look gate.** Knob sheets (falloff 0/0.5/1, seams 0/1/2, card 0/1) on the liquid in motion, plus a grey-fill check: the Task 1 term reshaped if Task 1 pointed at one. The author rules the defaults; set them in PLANET_TUNE. If Task 4 deferred, re-run its sweep now.
- [ ] **Step 6: Commit** `feat(mercury): studio structure (softbox falloff, seams, warm card)`.

### Task 6: Final gates

- [ ] **Step 1:** Run `npx vitest run src/terminal/mercury` and `npm run lint`. Expected: pass; lint 0 errors, warnings ≤ the 153 ratchet.
- [ ] **Step 2:** 360 Hz desktop check (frame time p50 with the final defaults vs 8255e4c0) and the cold-mount compile time.
- [ ] **Step 3:** Phone gate on the OnePlus 9 Pro (the author runs it): p50 frame time of the spun liquid, no first-tap stall regression.
- [ ] **Step 4:** Append the outcome to `.superpowers/sdd/progress.md`; whole-branch review; then STOP. Push/merge only on the author's command.
