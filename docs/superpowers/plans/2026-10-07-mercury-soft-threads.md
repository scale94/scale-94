# /mercury Soft Threads (sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the fluid and air filament threads read as atmosphere: a soft Gaussian cross-section, a rendered fray, slowly warped paths, a tint that makes them the core of the fog, and a softer air mirror sky.

**Architecture:** Most of the work lands in the shared gas chunk `src/terminal/mercury/planet/gasStreak.js`, which feeds the vertex and fragment shaders of all four flows. The fluid flow (`src/terminal/fluid/ParticleFlow.jsx`) and the air flow (`src/terminal/air/AtmosphericFlow.jsx`) opt in at their filament lines. New look knobs ride the existing `GAS_TUNE` → uniform path, which already copies them every frame. The air mirror sky changes only `skyAirLayer`/`skyAir` in `src/terminal/mercury/planet/aetherSky.js`. Its two look knobs are threaded as mirror uniforms the same way `uNeutralSky` was.

**Tech Stack:** three.js ShaderMaterial (GLSL ES), React Three Fiber, vitest. Live probes use Node + CDP (`scripts/cdp.mjs`) against the dev server on :5175.

**Spec:** `docs/superpowers/specs/2026-10-07-mercury-soft-threads-design.md` (b6f3a25c, approved 2026-10-07).

## Global Constraints

- Branch `feature/mercury-stage`. Commit locally after each task. **Never push** (author rule: push only on an explicit push command).
- No position scatter across a thread: `FLUID_SIGMA_R` stays 0.0075 and `AIR_SIGMA_ALT` stays 0.0015. Fray is rendered only.
- Every path term is evaluated inside the chain the lane neighbours share (`fluidFilAt` for fluid, `airDisplace` for air).
- Warp is low frequency along the path: the replica gap and dash-off-path bars stay green at `filWarp` 2.
- Calm = frozen threads: new motion reads only `uTime` (flows) or `uSkyT` (sky), both calm-gated.
- Sky regions stay rigid: the air warp is applied in each layer's frame, after the rotation. No shear term.
- Filaments stay additive: `gasOut` keeps alpha 0 for filaments.
- Length caps (`aspectMax`, `FIL_GAP_ASPECT`, `FIL_GAP_CLOSE`, `GAS_PX_FLOOR`) stay keyed to the core width `w`. Only the drawn quad grows.
- Fog sprites, thermal, earth, the other skies and the neutral sky are untouched. The fog path must stay byte-identical where tests pin it.
- Tests: `npx vitest run src/terminal/mercury` must be fully green after every task. Lint: `npm run lint` with 0 errors and at most 143 warnings.
- House idiom: GLSL constants are interpolated with `glf()` / `v3()` from `src/terminal/gl/glf.js`. Source-string pins are the existing test style for shader text; numeric checks use JS mirrors.

---

## File map

| File | Responsibility | Tasks |
|---|---|---|
| `src/terminal/mercury/planet/gasStreak.js` | shared filament profile, halo quad, taper rescale, tint, fray, warp, tune list | 1, 2, 3 |
| `src/terminal/mercury/planet/planetLook.js` | `PLANET_TUNE` defaults for the new knobs | 1, 2, 3, 4 |
| `src/terminal/fluid/ParticleFlow.jsx` | fluid opt-in: profile, tint, fray, warp | 1, 2, 3 |
| `src/terminal/fluid/particleFlowBuffers.js` | `FLUID_LANE_HUE_SPREAD`, `FLUID_FIL_WARP` | 1, 3 |
| `src/terminal/air/AtmosphericFlow.jsx` | air opt-in: profile, tint, fray, warp | 1, 2, 3 |
| `src/terminal/air/atmosphericFlowBuffers.js` | `AIR_FIL_WARP` | 3 |
| `src/terminal/mercury/planet/aetherSky.js` | air mirror sky: stretch, warp, line power, envelope, seam | 4 |
| `src/terminal/mercury/planet/hgMirrorGlsl.js`, `mercuryPlanetShader.js`, `MercuryPlanet.jsx` | `uAirSkyLat` / `uAirSkyWarp` plumbing | 4 |
| `src/terminal/mercury/planet/__tests__/gasStreak.test.js` | shared-chunk tests | 1, 2, 3 |
| `src/terminal/mercury/planet/__tests__/flowStreak.test.js` | flow pins + replica gap tests | 1, 2, 3 |
| `src/terminal/mercury/planet/__tests__/threadReplica.js` | JS replica gains the warp | 3 |
| `src/terminal/mercury/planet/__tests__/aetherSky.test.js` | sky tests | 4 |
| `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.*.fs.glsl` | pinned planet shaders (chunk swap + decls) | 4 |
| `.superpowers/sdd/tools/ms-mean.mjs` | mean tool: declare the mirror uniforms the sky now reads | 4 |

---

### Task 1: Soft Gaussian cross-section, halo quad, fog-core tint

**Files:**
- Modify: `src/terminal/mercury/planet/gasStreak.js` (constants block near the top; `GAS_STREAK_VS` uniforms, varyings and `gasSpriteCore`; `GAS_STREAK_FS`; `GAS_TUNE`)
- Modify: `src/terminal/mercury/planet/planetLook.js` (`PLANET_TUNE`, after `airFilGain`)
- Modify: `src/terminal/fluid/ParticleFlow.jsx` (import line 10; `laneHue` line; FS alpha and colour)
- Modify: `src/terminal/fluid/particleFlowBuffers.js` (constants)
- Modify: `src/terminal/air/AtmosphericFlow.jsx` (FS alpha and colour)
- Test: `src/terminal/mercury/planet/__tests__/gasStreak.test.js`, `src/terminal/mercury/planet/__tests__/flowStreak.test.js`

**Interfaces:**
- Produces (JS): `FIL_PROFILE_K` (1), `FIL_OLD_CROSS` (1.3), `FIL_PROFILE_PEAK` from `gasStreak.js`; `FLUID_LANE_HUE_SPREAD` (0.25) from `particleFlowBuffers.js`; `PLANET_TUNE.filHalo` 2.5, `.filEdgeDesat` 0.45, `.filCoreLift` 0.15.
- Produces (GLSL): `float gasFilProfile(float d)` and `vec3 gasFilTint(vec3 color, float d)` in `GAS_STREAK_FS`; the varying `vStreakCap` becomes `vec3` (z = the capsule's half-extent in point coords, used by the taper); uniforms `uFilHalo` (VS), `uFilEdgeDesat`, `uFilCoreLift` (FS).

- [ ] **Step 1: Write the failing tests** (append to `gasStreak.test.js`; add `FIL_PROFILE_K, FIL_OLD_CROSS, FIL_PROFILE_PEAK` to its `../gasStreak` import)

```js
describe('soft threads §1/§4: Gaussian cross-section, halo quad, fog-core tint', () => {
  const prof = (d) => FIL_PROFILE_PEAK * Math.exp(-FIL_PROFILE_K * d * d);
  const integ = (f, a, b, n = 20000) => { let s = 0; const h = (b - a) / n; for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h); return s * h; };
  const ss = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };

  it('carries the old fluid capsule light across the thread (within 0.5 %), negligible at the halo edge', () => {
    const old = integ((x) => ss(1, 0.3, Math.abs(x)), -1, 1);
    expect(old).toBeCloseTo(FIL_OLD_CROSS, 3);
    expect(integ(prof, -PLANET_TUNE.filHalo, PLANET_TUNE.filHalo) / old).toBeGreaterThan(0.995);
    expect(integ(prof, -PLANET_TUNE.filHalo, PLANET_TUNE.filHalo) / old).toBeLessThan(1.005);
    expect(prof(PLANET_TUNE.filHalo)).toBeLessThan(0.003);
  });

  it('GLSL: profile + tint in the FS, constants via glf; fog untouched by the tint', () => {
    for (const [n, v] of Object.entries({ FIL_PROFILE_K, FIL_PROFILE_PEAK })) expect(GAS_STREAK_FS).toContain(`const float ${n} = ${glf(v)};`);
    expect(GAS_STREAK_FS).toContain('float gasFilProfile(float d) { return FIL_PROFILE_PEAK * exp(-FIL_PROFILE_K * d * d); }');
    expect(GAS_STREAK_FS).toMatch(/vec3 gasFilTint\(vec3 color, float d\) \{\s*if \(vRole < 0\.5\) return color;/);
    expect(GAS_STREAK_FS).toContain('vec3 c = mix(color, vec3(l), uFilEdgeDesat * smoothstep(0.5, 2.0, d));');
    expect(GAS_STREAK_FS).toContain('uniform float uFilEdgeDesat;');
    expect(GAS_STREAK_FS).toContain('uniform float uFilCoreLift;');
  });

  it('halo quad: wq = w x max(filHalo, 1); total = wq + L; caps and the length stay on the core w', () => {
    expect(GAS_STREAK_VS).toContain('uniform float uFilHalo;');
    expect(GAS_STREAK_VS).toContain('float wq = w * max(uFilHalo, 1.0);');
    expect(GAS_STREAK_VS).toContain('L = min(L, max(uPointMax - wq, 0.0));');
    expect(GAS_STREAK_VS).toContain('float total = wq + L;');
    expect(GAS_STREAK_VS).toContain('vStreakCap = vec3(0.5 * L / total, 0.5 * w / total, 0.5 * (L + w) / total);');
    expect(GAS_STREAK_VS).toContain('L = max(L, min(FIL_GAP_CLOSE * gapPx - w, (FIL_GAP_ASPECT - 1.0) * w));');
  });

  it('taper keyed to the capsule end (vStreakCap.z), so the halo never lengthens the overlap', () => {
    expect(GAS_STREAK_FS).toContain('return 1.0 - smoothstep(0.5 - FIL_TAPER, 0.5, 0.5 * s / vStreakCap.z);');
  });

  it('knobs live in PLANET_TUNE and ride GAS_TUNE', () => {
    expect(PLANET_TUNE).toMatchObject({ filHalo: 2.5, filEdgeDesat: 0.45, filCoreLift: 0.15 });
    const u = GAS_TUNE_UNIFORMS(PLANET_TUNE);
    expect(u.uFilHalo.value).toBe(2.5);
    expect(u.uFilEdgeDesat.value).toBe(0.45);
    expect(u.uFilCoreLift.value).toBe(0.15);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/gasStreak.test.js`
Expected: FAIL. `FIL_PROFILE_PEAK` is undefined and the new GLSL strings are missing.

- [ ] **Step 3: Implement the shared chunk** (`gasStreak.js`)

After `export const THREAD_WEIGHT_FLOOR = 0.35; ...` add:

```js
// Soft threads §1 (2026-10-07): the filament cross-section is a Gaussian exp(-K d²), d in core half-widths, drawn on a
// quad widened by filHalo so the tail is not clipped. The old fluid capsule smoothstep(1, 0.3, |d|) carried
// 2 × (0.3 + 0.7 / 2) = 1.3 core half-widths of light across the thread; the peak keeps exactly that.
export const FIL_PROFILE_K = 1;
export const FIL_OLD_CROSS = 1.3;
export const FIL_PROFILE_PEAK = FIL_OLD_CROSS / Math.sqrt(Math.PI / FIL_PROFILE_K);
```

In `GAS_STREAK_VS`: add `uniform float uFilHalo;` after `uniform float uPointMax;`, and change `varying vec2 vStreakCap;` to `varying vec3 vStreakCap;`. In `gasSpriteCore`, change the fog branch line `vStreakCap = vec2(0.0, 0.5);` to `vStreakCap = vec3(0.0, 0.5, 0.5);`. Then replace these lines:

```glsl
  L = min(L, max(uPointMax - w, 0.0));
  float total = w + L;
```

with:

```glsl
  float wq = w * max(uFilHalo, 1.0); // the drawn quad: room for the Gaussian tail (caps and length stay on the core w)
  L = min(L, max(uPointMax - wq, 0.0));
  float total = wq + L;
```

Also replace `vStreakCap = vec2(0.5 * L / total, 0.5 * w / total);` with:

```glsl
  vStreakCap = vec3(0.5 * L / total, 0.5 * w / total, 0.5 * (L + w) / total); // z: the capsule end (the taper's 0.5)
```

In `GAS_STREAK_FS`: change `varying vec2 vStreakCap;` to `varying vec3 vStreakCap;`. In `gasTaper`, change its last line to:

```glsl
  return 1.0 - smoothstep(0.5 - FIL_TAPER, 0.5, 0.5 * s / vStreakCap.z);
```

After `const float FIL_TAPER = ...;` add:

```glsl
uniform float uFilEdgeDesat;
uniform float uFilCoreLift;
const float FIL_PROFILE_K = ${glf(FIL_PROFILE_K)};
const float FIL_PROFILE_PEAK = ${glf(FIL_PROFILE_PEAK)};
// Filament cross-section (soft threads §1): a Gaussian in core half-widths carrying the old capsule's light.
float gasFilProfile(float d) { return FIL_PROFILE_PEAK * exp(-FIL_PROFILE_K * d * d); }
// Filament colour across the thread (§4): the edges fall toward their own luminance (the fog's body, not neon), the
// core lifts toward white at its own brightness. Fog: unchanged.
vec3 gasFilTint(vec3 color, float d) {
  if (vRole < 0.5) return color;
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 c = mix(color, vec3(l), uFilEdgeDesat * smoothstep(0.5, 2.0, d));
  return mix(c, vec3(max(color.r, max(color.g, color.b))), uFilCoreLift * (1.0 - smoothstep(0.0, 0.5, d)));
}
```

Extend `GAS_TUNE` with `['uFilHalo', 'filHalo'], ['uFilEdgeDesat', 'filEdgeDesat'], ['uFilCoreLift', 'filCoreLift']`.

In `planetLook.js` `PLANET_TUNE`, after `airFilGain`:

```js
  filHalo: 2.5,      // soft threads §1: filament quad width × this (the Gaussian tail; length caps stay on the core width)
  filEdgeDesat: 0.45, // §4: filament edges fall toward their own luminance by this
  filCoreLift: 0.15,  // §4: filament core lifts toward white by this
```

- [ ] **Step 4: Opt the flows in**

`particleFlowBuffers.js`, after `FLUID_ALONG_JITTER`:

```js
export const FLUID_LANE_HUE_SPREAD = 0.25; // soft threads §4: a thread's hue sits near the fog's (was a full-palette offset)
```

`ParticleFlow.jsx`: import `FLUID_LANE_HUE_SPREAD` next to `FLUID_FIL_SHIMMER` on line 10, add `const float FLUID_LANE_HUE_SPREAD = ${glf(FLUID_LANE_HUE_SPREAD)};` next to `const float FLUID_FIL_SHIMMER`, and change the hue line to:

```glsl
    float laneHue = aRole < 0.5 ? 0.0 : gasHash(aLane, 0.37) * FLUID_LANE_HUE_SPREAD; // filaments: near the fog hue
```

In the fluid FS, replace `float alpha = smoothstep(1.0, 0.3, d) * gasTaper(gl_PointCoord);` with:

```glsl
    float alpha = (vRole < 0.5 ? smoothstep(1.0, 0.3, d) : gasFilProfile(d)) * gasTaper(gl_PointCoord);
```

and after `color *= vBrightness;` add `color = gasFilTint(color, d);`.

In the air FS, replace `float alpha = smoothstep(1.0, 0.0, d) * gasTaper(gl_PointCoord);` with:

```glsl
    float alpha = (vRole < 0.5 ? smoothstep(1.0, 0.0, d) : gasFilProfile(d)) * gasTaper(gl_PointCoord);
```

and after `col = mix(col, ionColor, vIon);` add `col = gasFilTint(col, d);`.

- [ ] **Step 5: Update the stale pins** (these lines changed on purpose)

In `gasStreak.test.js`:
- line ~82: the regex part `vStreakCap = vec2\(0\.0, 0\.5\);` becomes `vStreakCap = vec3\(0\.0, 0\.5, 0\.5\);`
- line ~95: `'vStreakCap = vec2(0.5 * L / total, 0.5 * w / total);'` becomes `'vStreakCap = vec3(0.5 * L / total, 0.5 * w / total, 0.5 * (L + w) / total);'`
- line ~299: `'L = min(L, max(uPointMax - w, 0.0));'` becomes `'L = min(L, max(uPointMax - wq, 0.0));'`
- line ~310 regex: `return 1\.0 - smoothstep\(0\.5 - FIL_TAPER, 0\.5, s\);` becomes `return 1\.0 - smoothstep\(0\.5 - FIL_TAPER, 0\.5, 0\.5 \* s \/ vStreakCap\.z\);`
- line ~374: `'varying vec2 vStreakCap;'` becomes `'varying vec3 vStreakCap;'`
- line ~390 key list: add `'uFilCoreLift', 'uFilEdgeDesat', 'uFilHalo'` (keep it sorted).

In `flowStreak.test.js`:
- line ~236: `'float laneHue = aRole < 0.5 ? 0.0 : gasHash(aLane, 0.37);'` becomes `'float laneHue = aRole < 0.5 ? 0.0 : gasHash(aLane, 0.37) * FLUID_LANE_HUE_SPREAD;'`, and add `expect(fluidBuf.FLUID_LANE_HUE_SPREAD).toBe(0.25);`
- line ~384: `'float alpha = smoothstep(1.0, 0.3, d) * gasTaper(gl_PointCoord);'` becomes `'float alpha = (vRole < 0.5 ? smoothstep(1.0, 0.3, d) : gasFilProfile(d)) * gasTaper(gl_PointCoord);'`
- line ~394: the air equivalent with `smoothstep(1.0, 0.0, d)`.
- Add to the fluid/air FS test (the `it(\`${el}: FS ends in gasOut()...` loop, line ~86): `expect(src).toMatch(/col(or)? = gasFilTint\(col(or)?, d\);/);`

- [ ] **Step 6: Run the suite, expect PASS**

Run: `npx vitest run src/terminal/mercury`
Expected: all green. If an unlisted pin fails, it must be one quoting a line this task replaced. Update it to the new line; never loosen a numeric bar.

- [ ] **Step 7: Lint + commit**

```bash
npm run lint
git add src/terminal/mercury/planet/gasStreak.js src/terminal/mercury/planet/planetLook.js src/terminal/fluid/ParticleFlow.jsx src/terminal/fluid/particleFlowBuffers.js src/terminal/air/AtmosphericFlow.jsx src/terminal/mercury/planet/__tests__/gasStreak.test.js src/terminal/mercury/planet/__tests__/flowStreak.test.js
git commit -m "feat(mercury): soft threads §1/§4 — Gaussian filament cross-section on a halo quad (light conserved), edges fall to the fog's luminance, fluid lane hue near the fog"
```

---

### Task 2: Rendered fray (width breathing, light conserved)

**Files:**
- Modify: `src/terminal/mercury/planet/gasStreak.js` (`GAS_STREAK_VS`: uniforms, `gasFray`, sprite signatures; `GAS_TUNE`)
- Modify: `src/terminal/mercury/planet/planetLook.js`
- Modify: `src/terminal/fluid/ParticleFlow.jsx`, `src/terminal/air/AtmosphericFlow.jsx` (sprite + `vLane` lines)
- Test: `gasStreak.test.js`, `flowStreak.test.js`

**Interfaces:**
- Consumes: Task 1's `wq`, `vStreakCap` (vec3), `gasFilProfile`.
- Produces (GLSL): `float gasFray(vec3 laneCoord, float t)`; `gasSpriteThread(..., float jit, float wk)` (new last parameter, the drawn width factor); `gasSpriteCore(..., float gain, float wk)`. `gasSprite` and `gasSpriteGain` keep their signatures and pass `1.0`.
- Produces (JS): `GAS_FRAY_Z` (11), `PLANET_TUNE.filWidthVar` 0.35, `.filFray` 2.0.

- [ ] **Step 1: Write the failing tests** (append to `gasStreak.test.js`; import `GAS_FRAY_Z`)

```js
describe('soft threads §2: rendered fray', () => {
  it('a wider drawn profile divided by its width factor carries the same light (alpha / wk)', () => {
    const prof = (d) => FIL_PROFILE_PEAK * Math.exp(-FIL_PROFILE_K * d * d);
    const integ = (f, a, b, n = 20000) => { let s = 0; const h = (b - a) / n; for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h); return s * h; };
    const ref = integ(prof, -8, 8);
    for (const wk of [1 - PLANET_TUNE.filWidthVar, 1, 1 + PLANET_TUNE.filFray]) {
      expect(integ((x) => prof(x / wk) / wk, -8 * wk, 8 * wk) / ref).toBeCloseTo(1, 4);
    }
  });

  it('gasFray: seamless lane label, decorrelated from the mask (z offset), slow (MASK_EVOLVE), range [1 - var, 1 + fray]', () => {
    expect(GAS_FRAY_Z).toBe(11);
    expect(GAS_STREAK_VS).toContain(`const float GAS_FRAY_Z = ${glf(GAS_FRAY_Z)};`);
    expect(GAS_STREAK_VS).toContain('float f = clamp(0.5 + 0.5 * snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, GAS_FRAY_Z + t * MASK_EVOLVE)), 0.0, 1.0);');
    expect(GAS_STREAK_VS).toContain('return mix(1.0 - uFilWidthVar, 1.0 + uFilFray, f);');
  });

  it('wk widens the drawn quad and the profile scale only; L and every cap stay on the core w', () => {
    expect(GAS_STREAK_VS).toContain('float gasSpriteThread(vec4 clipNow, vec4 clipPrev, vec4 clipBack, vec4 clipAhead, float role, float size, float aspectMax, float jit, float wk) {');
    expect(GAS_STREAK_VS).toContain('float wq = w * max(uFilHalo, 1.0) * wk;');
    expect(GAS_STREAK_VS).toContain('vStreakCap = vec3(0.5 * L / total, 0.5 * w * wk / total, 0.5 * (L + w) / total);');
    expect(GAS_STREAK_VS).toContain('return gasSpriteCore(clipNow, clipPrev, clipNow, clipNow, role, size, aspectMax, jit, uStreakGain, 1.0);');
    expect(GAS_STREAK_VS).toContain('L = max(L, min(FIL_GAP_CLOSE * gapPx - w, (FIL_GAP_ASPECT - 1.0) * w));');
  });

  it('knobs', () => {
    expect(PLANET_TUNE).toMatchObject({ filWidthVar: 0.35, filFray: 2 });
    const u = GAS_TUNE_UNIFORMS(PLANET_TUNE);
    expect(u.uFilWidthVar.value).toBe(0.35);
    expect(u.uFilFray.value).toBe(2);
  });
});
```

Add to `flowStreak.test.js` (inside the top-level describe that defines `STREAKED`):

```js
  it('fluid + air: the fray widens the drawn filament and divides its alpha (light conserved); fog wk = 1', () => {
    for (const src of [particleSrc, atmoSrc]) {
      expect(src).toContain('float fray = aRole < 0.5 ? 1.0 : gasFray(gasThreadCoord(aLane, aPhase), uTime);');
      expect(src).toMatch(/gasHash\(aPhase, a(Radius|Seed)\), fray\);/);
      expect(src).toMatch(/\/ fray;/);
    }
  });
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/gasStreak.test.js src/terminal/mercury/planet/__tests__/flowStreak.test.js`
Expected: FAIL on the new strings and the missing `GAS_FRAY_Z` / tune keys.

- [ ] **Step 3: Implement** (`gasStreak.js`)

JS, after `FIL_PROFILE_PEAK`:

```js
export const GAS_FRAY_Z = 11; // fray noise z offset: the same seamless lane label as the mask, decorrelated from it
```

`GAS_STREAK_VS`: add `uniform float uFilWidthVar;` and `uniform float uFilFray;` after `uniform float uFilHalo;`, and `const float GAS_FRAY_Z = ${glf(GAS_FRAY_Z)};` after `const float GAS_MASK_LANE_GAP`. Change the core signature to `float gasSpriteCore(vec4 clipNow, vec4 clipPrev, vec4 clipBack, vec4 clipAhead, float role, float size, float aspectMax, float jit, float gain, float wk) {`, change the `wq` line to `float wq = w * max(uFilHalo, 1.0) * wk; // drawn quad: Gaussian tail × the fray (caps and length stay on the core w)`, and change the cap line to:

```glsl
  vStreakCap = vec3(0.5 * L / total, 0.5 * w * wk / total, 0.5 * (L + w) / total); // y: the drawn (frayed) half-width
```

Wrappers:

```glsl
float gasSpriteThread(vec4 clipNow, vec4 clipPrev, vec4 clipBack, vec4 clipAhead, float role, float size, float aspectMax, float jit, float wk) {
  return gasSpriteCore(clipNow, clipPrev, clipBack, clipAhead, role, size, aspectMax, jit, uStreakGain, wk);
}

float gasSprite(vec4 clipNow, vec4 clipPrev, float role, float size, float aspectMax, float jit) {
  return gasSpriteCore(clipNow, clipPrev, clipNow, clipNow, role, size, aspectMax, jit, uStreakGain, 1.0);
}
```

and in `gasSpriteGain`: `return gasSpriteCore(clipNow, clipPrev, clipNow, clipNow, role, size, aspectMax, jit, gain, 1.0);`.

After `gasThreadCoord`, add:

```glsl
// Rendered fray (soft threads §2): the drawn width factor along a thread, on the same seamless lane label as the mask
// (z-offset: decorrelated), slowly evolving. Wide = a diffuse ribbon, narrow = a bright core; the caller divides the
// alpha by it, so the light across the thread is conserved. Never moves a particle (the staircase lesson, 7f/7g).
float gasFray(vec3 laneCoord, float t) {
  float f = clamp(0.5 + 0.5 * snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, GAS_FRAY_Z + t * MASK_EVOLVE)), 0.0, 1.0);
  return mix(1.0 - uFilWidthVar, 1.0 + uFilFray, f);
}
```

Extend `GAS_TUNE` with `['uFilWidthVar', 'filWidthVar'], ['uFilFray', 'filFray']`. `PLANET_TUNE`, after `filCoreLift`:

```js
  filWidthVar: 0.35, // §2: a pinched stretch draws at (1 - this) × the core width (alpha ÷ the factor: light conserved)
  filFray: 2,        // §2: a frayed stretch draws at (1 + this) × the core width
```

- [ ] **Step 4: Opt the flows in**

Fluid `main`: replace the `gl_PointSize = gasSpriteThread(...)` line and the `vLane = ...` line with:

```glsl
    float fray = aRole < 0.5 ? 1.0 : gasFray(gasThreadCoord(aLane, aPhase), uTime);
    gl_PointSize = gasSpriteThread(gl_Position, projectionMatrix * mvPrev, clipBack, clipAhead, aRole, size, FIL_ASPECT, gasHash(aPhase, aRadius), fray);
    // Fog: × fogAlpha. Filaments: the mask runs along each thread (lane id + knot label), slowly evolving, × filAlpha,
    // ÷ the fray (a wider drawn thread is dimmer: same light).
    vLane = gasAlpha(aRole, gasThreadCoord(aLane, aPhase), uTime) / fray;
```

Air `main`:

```glsl
    float fray = aRole < 0.5 ? 1.0 : gasFray(gasThreadCoord(aLane, aPhase), uTime);
    gl_PointSize = gasSpriteThread(gl_Position, projectionMatrix * mvPrev, clipBack, clipAhead, aRole, size, AIR_FIL_ASPECT, gasHash(aPhase, aSeed), fray);
    // Fog: × fogAlpha. Filaments: the mask runs along each thread (lane id + orbit label), slowly evolving, × filAlpha, ÷ the fray.
    vLane = gasAlpha(aRole, gasThreadCoord(aLane, aPhase), uTime) * (aRole < 0.5 ? 1.0 : uAirFilGain) / fray;
```

- [ ] **Step 5: Update the stale pins**

- `flowStreak.test.js` `STREAKED.fluid.sprite` / `STREAKED.air.sprite` (lines ~22, ~30): append `, fray` before the closing `);`.
- `flowStreak.test.js` line ~48: `'vLane = gasAlpha(aRole, gasThreadCoord(aLane, aPhase), uTime)'` still matches as a substring; leave it.
- `flowStreak.test.js` line ~280: the air vLane pin becomes `'vLane = gasAlpha(aRole, gasThreadCoord(aLane, aPhase), uTime) * (aRole < 0.5 ? 1.0 : uAirFilGain) / fray;'`
- `flowStreak.test.js` line ~462 slices up to `'gl_PointSize = gasSpriteThread('`. That is still present; leave it.
- `gasStreak.test.js` line ~294: the `gasSpriteThread` signature pin gains `, float wk`; line ~295: the `gasSprite` core call gains `, 1.0`.
- `gasStreak.test.js` line ~390 key list: add `'uFilFray', 'uFilWidthVar'` (sorted).
- Any other pin that quotes `gasSpriteCore(` with the old argument list: append `, 1.0` (or `, wk` in `gasSpriteThread`).

- [ ] **Step 6: Run the suite, expect PASS**

Run: `npx vitest run src/terminal/mercury`
Expected: all green, including the unchanged replica gap tests (the fray does not touch `L`).

- [ ] **Step 7: Lint + commit**

```bash
npm run lint
git add src/terminal/mercury/planet/gasStreak.js src/terminal/mercury/planet/planetLook.js src/terminal/fluid/ParticleFlow.jsx src/terminal/air/AtmosphericFlow.jsx src/terminal/mercury/planet/__tests__/gasStreak.test.js src/terminal/mercury/planet/__tests__/flowStreak.test.js
git commit -m "feat(mercury): soft threads §2 — rendered fray: the drawn thread breathes from a bright core to a diffuse ribbon along its length, alpha ÷ width (no particle moves)"
```

---

### Task 3: Domain-warped paths (fluid + air), replica-guarded

**Files:**
- Modify: `src/terminal/mercury/planet/gasStreak.js` (`FIL_WARP_FREQ`, `FIL_WARP_RATE`, `uFilWarp`, `gasWarp`, `GAS_TUNE`)
- Modify: `src/terminal/mercury/planet/planetLook.js` (`filWarp`)
- Modify: `src/terminal/fluid/particleFlowBuffers.js` (`FLUID_FIL_WARP`), `src/terminal/fluid/ParticleFlow.jsx` (`fluidFilAt`, `main`)
- Modify: `src/terminal/air/atmosphericFlowBuffers.js` (`AIR_FIL_WARP`), `src/terminal/air/AtmosphericFlow.jsx` (`airDisplace`)
- Modify: `src/terminal/mercury/planet/__tests__/threadReplica.js` (mirror the warp)
- Test: `gasStreak.test.js`, `flowStreak.test.js`

**Interfaces:**
- Consumes: the flows' own `snoise(vec3)`, declared before `GAS_STREAK_VS` in both flows.
- Produces (GLSL): `vec3 gasWarp(vec3 p, float t, float amp)`.
- Produces (JS): `FIL_WARP_FREQ` 1.1, `FIL_WARP_RATE` 0.04 (`gasStreak.js`); `FLUID_FIL_WARP` 0.07; `AIR_FIL_WARP` 0.08; `PLANET_TUNE.filWarp` 1; replica `fluidFil(ph, p, shimK, warpK)`, `airFilAt(angle, p, curlK, warpK)`, `measureThreads(..., { warpK })`, and `gasWarpJS(p, t, amp, warpK)`.

- [ ] **Step 1: Mirror the warp in the replica** (`threadReplica.js`)

Extend the imports: `FIL_WARP_FREQ, FIL_WARP_RATE` from `'../gasStreak'`, `FLUID_FIL_WARP` from the fluid buffers, `AIR_FIL_WARP` from the air buffers. Add after `export const DT = 1 / 30;`:

```js
// gasWarp (soft threads §3), JS mirror: a slow low-frequency displacement field the filament paths pass through.
export function gasWarpJS(p, t, amp, warpK = PLANET_TUNE.filWarp) {
  const q = [p[0] * FIL_WARP_FREQ, p[1] * FIL_WARP_FREQ, p[2] * FIL_WARP_FREQ + t * FIL_WARP_RATE];
  const k = amp * warpK;
  return [snoise(q) * k, snoise([q[0] + 31.4, q[1], q[2]]) * k, snoise([q[0], q[1] + 47.2, q[2]]) * k];
}
```

Change `fluidFil` to:

```js
export function fluidFil(ph, p, shimK = FLUID_FIL_SHIMMER, warpK = PLANET_TUNE.filWarp) {
  const { base, center } = knotPos(ph, p.phase, p.offset, p.radius);
  const q = base.map((x) => x * 8);
  const j = [snoise([q[0] + T, q[1], q[2]]), snoise([q[0], q[1] + T, q[2]]), snoise([q[0], q[1], q[2] + T])].map((x) => x * 0.012 * shimK);
  const c = curlFluid(center.map((x) => x * 2 + T * 0.1)).map((x) => x * 0.02);
  const w = gasWarpJS(base, T, FLUID_FIL_WARP, warpK);
  return { pos: [base[0] + j[0] + c[0] + w[0], base[1] + j[1] + c[1] + w[1], base[2] + j[2] + c[2] + w[2]], base };
}
```

Change `airFilAt` to take `warpK = PLANET_TUNE.filWarp` as its 4th parameter. After the wander line, add:

```js
  const wv = gasWarpJS(pos, T, AIR_FIL_WARP, warpK);
  for (let k = 0; k < 3; k++) pos[k] += wv[k];
```

In `measureThreads`, add `warpK` to the destructured options, then append `, warpK` to every `fluidFil(..., shimK)` and `airFilAt(..., curlK)` call inside it. Find them with:
`grep -n "fluidFil(\|airFilAt(" src/terminal/mercury/planet/__tests__/threadReplica.js`.

- [ ] **Step 2: Write the failing tests**

Append to `flowStreak.test.js` (inside its replica describe, next to `'fluid replica (shimmer included)...'`):

```js
  it('warp headroom (soft threads §3): fluid at 2x filWarp still closes its gaps and keeps the dash on the path', () => {
    const m = measureThreads('fluid', fluidBuf.buildBuffers(3600, 1200), { rate: 0.1, step: 3, devSteps: 12, warpK: 2 });
    expect(m.openVis).toBeLessThanOrEqual(0.01);
    expect(m.devP95).toBeLessThanOrEqual(1.5);
  });

  it('warp headroom: air at 2x filWarp, same bars', () => {
    const m = measureThreads('air', airBuf.buildBuffers(3600, 1200), { rate: 1.2, step: 6, devSteps: 10, lanes: [0, 1, 2, 3, 4], warpK: 2 });
    expect(m.openVis).toBeLessThanOrEqual(0.01);
    expect(m.devP95).toBeLessThanOrEqual(1.5);
  });

  it('the warp actually moves the threads (not vacuous): the mean displacement at default is ≥ 0.02 scene units', () => {
    const b = fluidBuf.buildBuffers(3600, 1200);
    let s = 0, n = 0;
    b.lanes.forEach((k, i) => {
      if (k < 0 || n >= 400) return;
      const p = { phase: b.phases[i], offset: b.offsets[i], radius: b.radii[i] };
      const a = fluidFil(0, p, undefined, 1).pos, z = fluidFil(0, p, undefined, 0).pos;
      s += Math.hypot(a[0] - z[0], a[1] - z[1], a[2] - z[2]); n++;
    });
    expect(s / n).toBeGreaterThanOrEqual(0.02);
  });

  it('warp lives in the shared chains (neighbours see it), filaments only, on the calm-gated uTime', () => {
    expect(particleSrc).toContain('return b + j + curlNoise(c * 2.0 + uTime * 0.1) * uCurlAmp + gasWarp(b, uTime, FLUID_FIL_WARP);');
    expect(particleSrc).toContain('if (aRole > 0.5) pos += gasWarp(basePos, uTime, FLUID_FIL_WARP);');
    expect(atmoSrc).toContain('if (aRole > 0.5) pos += gasWarp(pos, uTime, AIR_FIL_WARP);');
    expect(particleSrc).toContain('const float FLUID_FIL_WARP = ${glf(FLUID_FIL_WARP)};');
    expect(atmoSrc).toContain('const float AIR_FIL_WARP = ${glf(AIR_FIL_WARP)};');
  });
```

(The last test matches the flows' raw source, so the `${glf(...)}` template text is matched literally.)

Append to `gasStreak.test.js` (import `FIL_WARP_FREQ, FIL_WARP_RATE`):

```js
describe('soft threads §3: gasWarp', () => {
  it('low frequency, slow, scaled by the live knob; snoise-built (needs the flow snoise only)', () => {
    expect(FIL_WARP_FREQ).toBe(1.1);
    expect(FIL_WARP_RATE).toBe(0.04);
    for (const [n, v] of Object.entries({ FIL_WARP_FREQ, FIL_WARP_RATE })) expect(GAS_STREAK_VS).toContain(`const float ${n} = ${glf(v)};`);
    expect(GAS_STREAK_VS).toContain('vec3 gasWarp(vec3 p, float t, float amp) {');
    expect(GAS_STREAK_VS).toContain('vec3 q = p * FIL_WARP_FREQ + vec3(0.0, 0.0, t * FIL_WARP_RATE);');
    expect(GAS_STREAK_VS).toContain('return amp * uFilWarp * vec3(snoise(q), snoise(q + vec3(31.4, 0.0, 0.0)), snoise(q + vec3(0.0, 47.2, 0.0)));');
    expect(PLANET_TUNE.filWarp).toBe(1);
    expect(GAS_TUNE_UNIFORMS(PLANET_TUNE).uFilWarp.value).toBe(1);
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/gasStreak.test.js src/terminal/mercury/planet/__tests__/flowStreak.test.js`
Expected: FAIL. The imports are undefined (`FIL_WARP_FREQ`, `FLUID_FIL_WARP`, …) and the GLSL strings are missing.

- [ ] **Step 4: Implement**

`gasStreak.js` JS, after `GAS_FRAY_Z`:

```js
// Soft threads §3: path domain warp. Features ~1/FREQ ≈ 0.9 scene units, far above the lane-neighbour spacing, so the
// gap-closing dashes still follow the path (the pick-up-sticks lesson, look i); RATE on the flow's calm-gated uTime.
export const FIL_WARP_FREQ = 1.1;
export const FIL_WARP_RATE = 0.04;
```

`GAS_STREAK_VS`: add `uniform float uFilWarp;` after `uniform float uFilFray;`; add `const float FIL_WARP_FREQ = ${glf(FIL_WARP_FREQ)};` and `const float FIL_WARP_RATE = ${glf(FIL_WARP_RATE)};` after `GAS_FRAY_Z`; after `gasFray` add:

```glsl
// Path domain warp (soft threads §3): a slow, low-frequency displacement field the threads pass through, so the stacked
// loops separate, bend and drift. Evaluate it INSIDE the chain the lane neighbours share (fluidFilAt / airDisplace),
// or the path secant and the gap-closing break.
vec3 gasWarp(vec3 p, float t, float amp) {
  vec3 q = p * FIL_WARP_FREQ + vec3(0.0, 0.0, t * FIL_WARP_RATE);
  return amp * uFilWarp * vec3(snoise(q), snoise(q + vec3(31.4, 0.0, 0.0)), snoise(q + vec3(0.0, 47.2, 0.0)));
}
```

Extend `GAS_TUNE` with `['uFilWarp', 'filWarp']`. `PLANET_TUNE`, after `filFray`:

```js
  filWarp: 1,        // §3: path domain-warp amplitude × this (per-flow amplitude FLUID_FIL_WARP / AIR_FIL_WARP)
```

`particleFlowBuffers.js`, after `FLUID_LANE_HUE_SPREAD`:

```js
export const FLUID_FIL_WARP = 0.07; // soft threads §3: filament path warp amplitude, scene units (knot radius 1, tube 0.32)
```

`atmosphericFlowBuffers.js`, after `AIR_FIL_ASPECT`:

```js
export const AIR_FIL_WARP = 0.08; // soft threads §3: filament path warp amplitude, scene units
```

`ParticleFlow.jsx`: import `FLUID_FIL_WARP`; add `const float FLUID_FIL_WARP = ${glf(FLUID_FIL_WARP)};` next to `FLUID_FIL_SHIMMER`. The last line of `fluidFilAt` becomes:

```glsl
    return b + j + curlNoise(c * 2.0 + uTime * 0.1) * uCurlAmp + gasWarp(b, uTime, FLUID_FIL_WARP);
```

In `main`, after `vec3 pos = basePos + vec3(jx, jy, jz) + curl;`:

```glsl
    if (aRole > 0.5) pos += gasWarp(basePos, uTime, FLUID_FIL_WARP); // = fluidFilAt's chain; prev keeps it (pos - basePos)
```

`AtmosphericFlow.jsx`: add `AIR_FIL_WARP` to the buffers import; add `const float AIR_FIL_WARP = ${glf(AIR_FIL_WARP)};` after `AIR_FIL_ASPECT`. In `airDisplace`, right after the wander line:

```glsl
    if (aRole > 0.5) pos += gasWarp(pos, uTime, AIR_FIL_WARP); // soft threads §3: in the shared chain (prev + neighbours)
```

- [ ] **Step 5: Update the stale pin**

`flowStreak.test.js` line ~380: `'return b + j + curlNoise(c * 2.0 + uTime * 0.1) * uCurlAmp;'` becomes `'return b + j + curlNoise(c * 2.0 + uTime * 0.1) * uCurlAmp + gasWarp(b, uTime, FLUID_FIL_WARP);'`. The air test at line ~293 lists `airDisplace` lines in order. The warp line sits between the wander and the curl, so if that test asserts strict adjacency, insert `'if (aRole > 0.5) pos += gasWarp(pos, uTime, AIR_FIL_WARP);'` at the right index.

- [ ] **Step 6: Run the suite**

Run: `npx vitest run src/terminal/mercury`
Expected: all green. That includes the pre-existing replica tests: fluid/air visible gaps ≤ 1 %, dash-off-path p95 ≤ 1.5 px, calm step bars. They now run with the warp on.
If a gap or dash-off-path bar fails: halve `FIL_WARP_FREQ` (0.55) and re-run; if it still fails, halve the per-flow amplitude. Never relax a bar. Record the final values and the replica numbers in the commit body.

- [ ] **Step 7: Lint + commit**

```bash
npm run lint
git add src/terminal/mercury/planet/gasStreak.js src/terminal/mercury/planet/planetLook.js src/terminal/fluid/ParticleFlow.jsx src/terminal/fluid/particleFlowBuffers.js src/terminal/air/AtmosphericFlow.jsx src/terminal/air/atmosphericFlowBuffers.js src/terminal/mercury/planet/__tests__/threadReplica.js src/terminal/mercury/planet/__tests__/gasStreak.test.js src/terminal/mercury/planet/__tests__/flowStreak.test.js
git commit -m "feat(mercury): soft threads §3 — slow low-frequency path warp in the shared filament chains (fluid + air); replica gap/dash bars hold at 2x"
```

---

### Task 4: Air mirror sky: gentler stretch, layer-frame warp, soft envelope and seam

**Files:**
- Modify: `src/terminal/mercury/planet/aetherSky.js` (constants, GLSL consts, `skyAirLayer`, header `Needs` line)
- Modify: `src/terminal/mercury/planet/hgMirrorGlsl.js` (`HG_MIRROR_UNIFORMS`, `HG_MIRROR_DECLS_GLSL`)
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js` (`PLANET_UNIFORMS`, the `uniform float uNeutralSky;` decl)
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (uniform init ~line 346, per-frame copy ~line 493)
- Modify: `src/terminal/mercury/planet/planetLook.js` (`airSkyLat`, `airSkyWarp`)
- Modify: `.superpowers/sdd/tools/ms-mean.mjs` (declare + set the mirror uniforms the sky reads)
- Modify: `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.{full,pre-slow-noon,pre-visitors}.fs.glsl`
- Test: `src/terminal/mercury/planet/__tests__/aetherSky.test.js`

**Interfaces:**
- Produces (JS): `AIR_SHEAR_BAND` 0.25 (was 0.12), `AIR_SKY_LINE_POW` 10, `AIR_SKY_ENV_POW` 1.5, `AIR_SKY_WARP_Y` 0.15 from `aetherSky.js`; `PLANET_TUNE.airSkyLat` 3.5, `.airSkyWarp` 0.6.
- Produces (GLSL): uniforms `uAirSkyLat`, `uAirSkyWarp` in every mirror shader (via `HG_MIRROR_DECLS_GLSL`) and in the planet shader.

- [ ] **Step 1: Write the failing tests** (append to `aetherSky.test.js`, inside the outer describe; add `AIR_SKY_LINE_POW, AIR_SKY_ENV_POW, AIR_SKY_WARP_Y` to the `../aetherSky` import)

```js
  describe('soft threads §5: the air mirror sky', () => {
    it('constants as specced, interpolated', () => {
      expect(AIR_SHEAR_BAND).toBe(0.25);
      expect(AIR_SKY_LINE_POW).toBe(10);
      expect(AIR_SKY_ENV_POW).toBe(1.5);
      expect(AIR_SKY_WARP_Y).toBe(0.15);
      for (const [n, v] of Object.entries({ AIR_SKY_LINE_POW, AIR_SKY_ENV_POW, AIR_SKY_WARP_Y })) {
        expect(AETHER_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
      }
    });

    it('stretch + warp are live knobs; the warp is in the layer frame (ph), periodic (cos/sin ph), on the sky clock, ≤ 3 octaves', () => {
      expect(AETHER_SKY_GLSL).not.toContain('R.y * 8.0');
      expect(AETHER_SKY_GLSL).toContain('vec3 wq = vec3(cos(ph), sin(ph), R.y * 1.5) * 1.2 + vec3(0.0, 0.0, uSkyT * 0.03);');
      expect(AETHER_SKY_GLSL).toContain('float phw = ph + uAirSkyWarp * (skyFbm(wq, wOct) - 0.5);');
      expect(AETHER_SKY_GLSL).toContain('float yw = R.y + AIR_SKY_WARP_Y * (skyFbm(wq + 7.3, wOct) - 0.5);');
      expect(AETHER_SKY_GLSL).toContain('vec3 q = vec3(cos(phw) * 1.2, sin(phw) * 1.2, yw * uAirSkyLat);');
      expect(AETHER_SKY_GLSL).toContain('float wOct = min(nOct, 3.0);');
    });

    it('softer lines; a smooth spherical envelope instead of the plateau + shoulder', () => {
      expect(AETHER_SKY_GLSL).toContain('float lines = pow(1.0 - abs(n * 2.0 - 1.0), AIR_SKY_LINE_POW);');
      expect(AETHER_SKY_GLSL).toContain('float band = pow(max(1.0 - R.y * R.y, 0.0), AIR_SKY_ENV_POW);');
      expect(AETHER_SKY_GLSL).not.toContain('smoothstep(0.95, 0.2, abs(R.y))');
      // smooth: no flat plateau (strictly decreasing in |y| away from 0) and C1 at the equator (even in y)
      const env = (y) => Math.max(1 - y * y, 0) ** AIR_SKY_ENV_POW;
      for (let y = 0.01; y < 1; y += 0.01) expect(env(y)).toBeLessThan(env(y - 0.01));
      expect(env(0.2)).toBeLessThan(0.95);
    });

    it('both layers stay rigid: the warp reads ph (az - spin of its own layer), never az alone', () => {
      expect(AETHER_SKY_GLSL).toContain('c += wUp * skyAirLayer(R, az - spin, 1.0, nOct);');
      expect(AETHER_SKY_GLSL).toContain('c += (1.0 - wUp) * skyAirLayer(R, az - spin * AIR_LOWER_DIR, -1.0, nOct);');
    });

    it('uAirSkyLat / uAirSkyWarp: mirror + planet uniforms, live knobs', () => {
      for (const u of ['uAirSkyLat', 'uAirSkyWarp']) {
        expect(HG_MIRROR_UNIFORMS).toContain(u);
        expect(PLANET_UNIFORMS).toContain(u);
      }
      expect(PLANET_TUNE).toMatchObject({ airSkyLat: 3.5, airSkyWarp: 0.6 });
    });
  });
```

Also change the existing `AIR_SHEAR_BAND` expectation, if one pins 0.12, to 0.25.

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherSky.test.js`
Expected: FAIL. `AIR_SKY_LINE_POW` is undefined and the GLSL is missing.

- [ ] **Step 3: Implement the sky** (`aetherSky.js`)

Change `export const AIR_SHEAR_BAND = 0.12; ...` to:

```js
export const AIR_SHEAR_BAND = 0.25;   // R.y half-width of the equatorial cross-fade between the two rigid air layers (soft threads §5: was 0.12)
export const AIR_SKY_LINE_POW = 10;   // air streak ridge power (was 18: hard ruled lines)
export const AIR_SKY_ENV_POW = 1.5;   // air envelope (1 - y²)^k: smooth to the poles, no plateau
export const AIR_SKY_WARP_Y = 0.15;   // air latitude warp (the angle warp is the live knob uAirSkyWarp)
```

In the GLSL constants block, after `const float AIR_SHEAR_BAND = ...;`:

```glsl
const float AIR_SKY_LINE_POW = ${glf(AIR_SKY_LINE_POW)};
const float AIR_SKY_ENV_POW = ${glf(AIR_SKY_ENV_POW)};
const float AIR_SKY_WARP_Y = ${glf(AIR_SKY_WARP_Y)};
```

Replace `skyAirLayer` with:

```glsl
// Air: streamlines along the orbit, the upper layer one way, the lower AIR_LOWER_DIR the other; Rayleigh-weighted.
// Soft threads §5: a gentler latitude stretch (uAirSkyLat, was 8), a warp in the layer's own frame (ph: periodic,
// rigid with its layer, on the calm-gated sky clock), softer ridges, a smooth (1 - y²)^k envelope.
vec3 skyAirLayer(vec3 R, float ph, float s, float nOct) {
  float wOct = min(nOct, 3.0);
  vec3 wq = vec3(cos(ph), sin(ph), R.y * 1.5) * 1.2 + vec3(0.0, 0.0, uSkyT * 0.03);
  float phw = ph + uAirSkyWarp * (skyFbm(wq, wOct) - 0.5);
  float yw = R.y + AIR_SKY_WARP_Y * (skyFbm(wq + 7.3, wOct) - 0.5);
  vec3 q = vec3(cos(phw) * 1.2, sin(phw) * 1.2, yw * uAirSkyLat);
  float n = skyFbm(q + vec3(0.0, 0.0, skyFbm(q * 0.5, nOct) * 2.0), nOct);
  float lines = pow(1.0 - abs(n * 2.0 - 1.0), AIR_SKY_LINE_POW);
  float gust = smoothstep(0.45, 0.8, skyFbm(vec3(cos(phw + 0.6 * s) * 0.9, sin(phw + 0.6 * s) * 0.9, yw * 2.0) + 4.0, nOct));
  float band = pow(max(1.0 - R.y * R.y, 0.0), AIR_SKY_ENV_POW);
  float mu = dot(R, uSunDir);
  return vec3(0.55, 0.76, 0.98) * lines * gust * band * (0.5 + 0.5 * (1.0 + mu * mu)) * 0.6;
}
```

In the file header, change `// Needs (declared by HG_MIRROR_DECLS_GLSL): uSkyT, uSkyPhase, uSkyW, uNeutralSky, uSunDir.` to `... uSkyT, uSkyPhase, uSkyW, uNeutralSky, uAirSkyLat, uAirSkyWarp, uSunDir.`

- [ ] **Step 4: Plumb the two uniforms** (the same path `uNeutralSky` took in 7a1f56f3)

- `hgMirrorGlsl.js`: in `HG_MIRROR_UNIFORMS`, insert `'uAirSkyLat', 'uAirSkyWarp',` after `'uNeutralSky',`; in `HG_MIRROR_DECLS_GLSL`, after `'uniform float uNeutralSky;',` add `'uniform float uAirSkyLat;',` and `'uniform float uAirSkyWarp;',`.
- `mercuryPlanetShader.js`: in `PLANET_UNIFORMS`, after `'uNeutralSky',` add `'uAirSkyLat', 'uAirSkyWarp',`; after the line `uniform float uNeutralSky;` add `uniform float uAirSkyLat;` and `uniform float uAirSkyWarp;`.
- `MercuryPlanet.jsx`: after `uNeutralSky: { value: PLANET_TUNE.neutralSky },` add `uAirSkyLat: { value: PLANET_TUNE.airSkyLat },` and `uAirSkyWarp: { value: PLANET_TUNE.airSkyWarp },`; after `u.uNeutralSky.value = PLANET_TUNE.neutralSky;` add `u.uAirSkyLat.value = PLANET_TUNE.airSkyLat;` and `u.uAirSkyWarp.value = PLANET_TUNE.airSkyWarp;`.
- `planetLook.js` `PLANET_TUNE`, after `neutralSky`:

```js
  airSkyLat: 3.5,    // soft threads §5: air mirror sky latitude stretch (was a hard 8); live until the look call, then a const
  airSkyWarp: 0.6,   // §5: air mirror sky angle warp (rad scale), in each layer's own rigid frame
```

Droplets, beads and visitors copy `HG_MIRROR_UNIFORMS` from the planet material by name (`useDropletField.js:28`, `useHgBeads.js:32`, `useVisitorField.js`), so they pick up the new uniforms with no further change.

- [ ] **Step 5: Regenerate the pinned planet shaders** (chunk swap + decls, nothing else)

Create `src/terminal/mercury/planet/__tests__/_swap.tmp.test.js`:

```js
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { AETHER_SKY_GLSL as NEW } from '../aetherSky';
import { AETHER_SKY_GLSL as OLD } from './_oldSky.tmp';
it('swap', () => {
  for (const f of ['planetShader.full.fs.glsl', 'planetShader.pre-slow-noon.fs.glsl', 'planetShader.pre-visitors.fs.glsl']) {
    const p = resolve(__dirname, '__snapshots__', f);
    let s = readFileSync(p, 'utf8');
    if (s.split(OLD).length !== 2) throw new Error(`${f}: old sky chunk not found exactly once`);
    s = s.replace(OLD, NEW);
    if (s.split('uniform float uNeutralSky;\n').length !== 2) throw new Error(`${f}: uNeutralSky decl not found exactly once`);
    s = s.replace('uniform float uNeutralSky;\n', 'uniform float uNeutralSky;\nuniform float uAirSkyLat;\nuniform float uAirSkyWarp;\n');
    writeFileSync(p, s);
  }
});
```

Then run:

```bash
D=src/terminal/mercury/planet
git show HEAD:$D/aetherSky.js | sed "s#'../../gl/glf'#'../../../gl/glf'#; s#'./aetherClock'#'../aetherClock'#" > $D/__tests__/_oldSky.tmp.js
npx vitest run $D/__tests__/_swap.tmp.test.js
rm $D/__tests__/_swap.tmp.test.js $D/__tests__/_oldSky.tmp.js
git diff --stat -- $D/__tests__/__snapshots__
```

Expected: the swap passes; each of the three snapshot files changes by roughly 20–25 lines. Check with `git diff` that the only changes are inside the air sky functions, the new consts and the two uniform decls.

- [ ] **Step 6: Run the suite, expect PASS**

Run: `npx vitest run src/terminal/mercury`
Expected: all green.

- [ ] **Step 7: Fix the mean tool, re-measure `SKY_MEAN.air`** (needs the dev server: `preview_start` `scale94-dev-5175`)

In `.superpowers/sdd/tools/ms-mean.mjs`, in the `fs` string, change `uniform float uSkyT; uniform vec4 uSkyPhase; uniform vec4 uSkyW; uniform vec3 uSunDir;` to `uniform float uSkyT; uniform vec4 uSkyPhase; uniform vec4 uSkyW; uniform vec3 uSunDir; uniform float uNeutralSky; uniform float uAirSkyLat; uniform float uAirSkyWarp;`. After the `uSunDir` uniform is set, add:

```js
    const { PLANET_TUNE } = await import('/src/terminal/mercury/planet/planetLook.js');
    gl.uniform1f(U('uNeutralSky'), 0); gl.uniform1f(U('uAirSkyLat'), PLANET_TUNE.airSkyLat); gl.uniform1f(U('uAirSkyWarp'), PLANET_TUNE.airSkyWarp);
```

(Insert that import line inside the same async IIFE, next to the existing imports.)

Run: `node .superpowers/sdd/tools/ms-mean.mjs`
Expected: a JSON object with `fluid`, `thermal`, `earth` and `air` means. Fluid, thermal and earth must match the current `SKY_MEAN` within 2 %; that confirms the tool is unchanged for them. Paste the new `air` triple into `SKY_MEAN.air` in `aetherSky.js` (5 significant digits) and update the comment date to 2026-10-07 (soft threads). Then repeat Step 5 so the snapshots carry the new mean, and re-run `npx vitest run src/terminal/mercury`.

- [ ] **Step 8: Lint + commit**

```bash
npm run lint
git add src/terminal/mercury/planet/aetherSky.js src/terminal/mercury/planet/hgMirrorGlsl.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/planetLook.js src/terminal/mercury/planet/__tests__/aetherSky.test.js src/terminal/mercury/planet/__tests__/__snapshots__/
git commit -m "feat(mercury): soft threads §5 — air mirror sky: gentler stretch (live 3.5, was 8), warp in each layer's rigid frame, softer ridges, smooth envelope, wider seam; SKY_MEAN.air re-measured"
```

(`ms-mean.mjs` lives under the git-ignored tools folder; it is kept locally, not committed.)

---

### Task 5: Live look round (controller, not a subagent)

**Files:** `.superpowers/sdd/tools/thread-look.mjs` (exists; layer isolation, pointerdown taps), output in `.superpowers/sdd/tools/out/`.

- [ ] **Step 1: Sheets.** With the dev server on :5175, run `node .superpowers/sdd/tools/thread-look.mjs soft`. Expected: `errors: []` and `out/thread-soft-sheet.png` (rows fluid, air; columns default, fil-only, fog-only, mirror-only). **Look at it** next to `out/thread-base-sheet.png` before saying anything about the result.
- [ ] **Step 2: Calm.** Run the same probe with calm on (`window.__mercuryTune` calm flag, as in `ms-flows.mjs`), take two shots 2 s apart, and diff them. Expected: identical frames; threads continuous with no staircase in a 1:1 crop.
- [ ] **Step 3: Knob sweep** where the sheet calls for it: `filHalo` {2, 2.5, 3}, `filFray` {1, 2, 3}, `filWarp` {0.5, 1, 1.5}, `filEdgeDesat` {0.3, 0.45, 0.6}, `maskDepth` {0.3, 0.6}, `airFilGain` (re-check, spec §1), `airSkyLat` {2.5, 3.5, 5}, `airSkyWarp` {0.3, 0.6, 1.0}. Put a contact sheet per knob on the author's table.
- [ ] **Step 4: Author call.** Freeze the ruled defaults in `PLANET_TUNE`. Turn `airSkyLat` / `airSkyWarp` into consts (`AIR_SKY_LAT`, `AIR_SKY_WARP` in `aetherSky.js`) and remove the two uniforms from the four plumbing sites (Task 4 Step 4, reversed). Re-run `ms-mean.mjs` and the snapshot swap, run the full suite, then commit.
- [ ] **Step 5: Phone-gate notes** go into `.superpowers/sdd/progress.md`: filament fill ≈ `filHalo × mean(fray)` × the old area; per filament vertex, fluid adds 9 `snoise` for the warp (3 calls × 3) plus 1 for the fray, and air adds 3 + 1; the air sky adds 2 fbm (≤ 3 octaves) per layer sample.

---

## Self-review (done)

- Spec coverage: §1 (Task 1), §2 (Task 2), §3 (Task 3), §4 (Task 1), §5 (Task 4), tuning surface (Tasks 1–4, frozen in Task 5), testing (each task plus Task 5), phone gate notes (Task 5). The spec's "air total light shifts ~25 %" is handled as the `airFilGain` re-check in Task 5 Step 3.
- Names are consistent across tasks: `gasFilProfile`, `gasFilTint`, `gasFray`, `gasWarp`, `gasSpriteThread(..., jit, wk)`, `gasSpriteCore(..., gain, wk)`, `vStreakCap` (vec3), `FIL_PROFILE_K` / `FIL_PROFILE_PEAK` / `FIL_OLD_CROSS`, `GAS_FRAY_Z`, `FIL_WARP_FREQ` / `FIL_WARP_RATE`, `FLUID_FIL_WARP`, `AIR_FIL_WARP`, `FLUID_LANE_HUE_SPREAD`, `uAirSkyLat` / `uAirSkyWarp`, and tune keys `filHalo`, `filEdgeDesat`, `filCoreLift`, `filWidthVar`, `filFray`, `filWarp`, `airSkyLat`, `airSkyWarp`.
- Known risk: pins not listed here may quote a replaced line. The rule is to update them to the new line and never loosen a numeric bar.
