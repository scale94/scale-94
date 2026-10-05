# Mercury Glitter Dust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Hg aether beads read as glinting glitter dust (many sub-pixel specks that spark briefly and
irregularly) with a rare solid silver pearl, and flung beads visibly arc away from the planet before the
element's flow takes them.

**Architecture:** All behaviour lives in the pure sim `planet/hgBeads.js`: a two-population radius draw,
a per-tier rate scale, a per-bead wobble-and-tumble glint gate written into the upload buffer as a third
float, and a free-flight drag ramp for flung beads. The sprite shader `planet/hgBeadShader.js` reads the
gate and blends dust shading (glint only, gated) into pearl shading (today's mirror body, steady glint)
by on-screen size. `useHgBeads.js` binds the wider attribute and the new uniform; `MercuryPlanet.jsx`
passes the tier's rate scale.

**Tech Stack:** React 19, @react-three/fiber 9, three.js (ShaderMaterial, GLSL3 bead pass), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-mercury-glitter-dust-design.md` (includes the plan-time
amendment: tumble envelope, `WOBBLE_K` 3).

## Global Constraints

- Branch `feature/mercury-stage`. **Never push** without the author's explicit push command.
- Author decisions (verbatim from the spec): target read = **glitter dust**; approach **B** (one sim, one
  draw call, dust and pearls split by size); **fling free-flight** folded in. Gas filaments, the shared
  field, evaporation vapour and speed streaks are **out of scope**.
- Banded/mechanical motion is a hard fail: the twinkle must never read as a steady beat.
- `hgMirrorGlsl.js` is NOT edited (the planet's fragment-shader snapshot must stay byte-identical).
- Bead caps: `full 256`, `phone 128`, `lite 32`. Rate scales: `full 1`, `phone 0.55`, `lite 0.3`.
- Zero per-frame allocation in the sim and hook (preallocate; mutate in place).
- Calm (reduced motion): no trickle, no drift, no bursts (unchanged from round 1).
- Lint gate: `npm run lint` 0 errors (the script caps warnings at 143); don't sweep `exhaustive-deps`.
- Test command: `npx vitest run <path>`. Full suite has 1 known pre-existing failure
  (`artComposite` `compositeDpr`); any other failure is yours.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit
  `.import-cache.json`, untracked `baseline/` folders, or anything under `.superpowers/`. Stage files by
  name; never `git add -A` / `git add .`.

---

### Task 1: Population: dust/pearl radii, spawn rate, tier budget

**Files:**
- Modify: `src/terminal/mercury/planet/hgBeads.js`
- Modify: `src/terminal/mercury/planet/planetQuality.js:14,19,20`
- Modify: `src/terminal/mercury/MercuryPlanet.jsx:702-706`
- Test: `src/terminal/mercury/planet/__tests__/hgBeads.test.js`
- Test: `src/terminal/mercury/planet/__tests__/planetQuality.test.js:78-80`
- Test: `src/terminal/mercury/__tests__/hgBeadsWiring.test.js`

**Interfaces:**
- Produces: `DUST_R` `[0.0015, 0.006]`, `PEARL_R` `[0.012, 0.02]`, `PEARL_P` `0.05` (frozen arrays /
  number), `beadRadius(rng: () => number): number`, `AMBIENT_RATE` `18`, `FLING_N` `48`; `stepBeads` ctx
  accepts `rateScale` (number, default 1); `TIERS[t].beadRate` (number). `BEAD_R_MIN` / `BEAD_R_MAX` are
  removed.

- [ ] **Step 1: Write the failing tests**

In `hgBeads.test.js`, replace the import block with:

```js
import { describe, it, expect } from 'vitest';
import {
  createBeads, spawnBead, spawnFling, spawnSplash, stepBeads, beadRadius,
  AMBIENT_RATE, BEAD_ESCAPE_R, BEAD_LIFE, DUST_R, PEARL_R, PEARL_P, EVAP_RATE, FLING_N, FLING_V_MAX, FLING_DRAG_BOOST,
} from '../hgBeads';
import { mulberry32 } from '../aetherLobes';
import { SUN_DIR_WORLD } from '../planetFrame';
```

In the existing `'fire evaporates beads'` test, replace both `BEAD_R_MIN * 1.5` with `DUST_R[0] * 1.5`.

Add inside `describe('hgBeads sim', ...)`:

```js
  it('spawn radii split into dust (~95 %) and pearls (~5 %), each inside its range', () => {
    const rng = mulberry32(42);
    let pearls = 0;
    for (let k = 0; k < 10000; k++) {
      const r = beadRadius(rng);
      const dust = r >= DUST_R[0] && r <= DUST_R[1];
      const pearl = r >= PEARL_R[0] && r <= PEARL_R[1];
      expect(dust || pearl).toBe(true);
      if (pearl) pearls++;
    }
    expect(pearls / 10000).toBeGreaterThan(PEARL_P - 0.01);
    expect(pearls / 10000).toBeLessThan(PEARL_P + 0.01);
  });
  it('dust is skewed small: its median radius sits in the lower third of the dust range', () => {
    const rng = mulberry32(7);
    const dust = [];
    for (let k = 0; k < 4000; k++) { const r = beadRadius(rng); if (r <= DUST_R[1]) dust.push(r); }
    dust.sort((a, b) => a - b);
    expect(dust[dust.length >> 1]).toBeLessThan(DUST_R[0] + (DUST_R[1] - DUST_R[0]) / 3);
  });
  it('rateScale scales the ambient trickle (1 s: no bead has fallen back yet)', () => {
    const full = createBeads(256), phone = createBeads(256);
    run(full, 1, { ...CTX, phase: 'none' });
    run(phone, 1, { ...CTX, phase: 'none', rateScale: 0.55 });
    expect(full.n).toBeGreaterThanOrEqual(AMBIENT_RATE - 1);
    expect(full.n).toBeLessThanOrEqual(AMBIENT_RATE);
    expect(phone.n).toBeGreaterThanOrEqual(9);
    expect(phone.n).toBeLessThanOrEqual(10);
  });
```

In `planetQuality.test.js` replace lines 78–80 with:

```js
    expect(TIERS.full.beads).toBe(256);
    expect(TIERS.phone.beads).toBe(128);
    expect(TIERS.lite.beads).toBe(32);
    expect(TIERS.full.beadRate).toBe(1);
    expect(TIERS.phone.beadRate).toBe(0.55);
    expect(TIERS.lite.beadRate).toBe(0.3);
```

In `hgBeadsWiring.test.js`, inside `'the planet feeds all three sources and steps once per frame'`, add:

```js
    expect(planetSrc).toContain('beadCtx.rateScale = TIERS[tier].beadRate;');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeads.test.js src/terminal/mercury/planet/__tests__/planetQuality.test.js src/terminal/mercury/__tests__/hgBeadsWiring.test.js`
Expected: FAIL. `beadRadius` / `DUST_R` are not exported, `phone.beads` is 64, `beadRate` is undefined,
and the wiring string is missing.

- [ ] **Step 3: Implement**

In `hgBeads.js`, replace the two radius constants and the rate / count constants:

```js
export const DUST_R = Object.freeze([0.0015, 0.006]);  // scene units: ~0.4–1.5 px at the fitted desktop camera
export const PEARL_R = Object.freeze([0.012, 0.02]);   // ~3–5 px: the rare solid silver bead
export const PEARL_P = 0.05;                            // share of spawns that are pearls
export const AMBIENT_RATE = 18;   // beads/s off the sunlit surface → ~AMBIENT_RATE · BEAD_LIFE alive (× tier rateScale)
```

(delete `BEAD_R_MIN`, `BEAD_R_MAX`, and the old `AMBIENT_RATE = 6` line) and change `FLING_N`:

```js
export const FLING_N = 48;
```

Replace the `radius` helper (currently `const radius = (b) => BEAD_R_MIN + ...`) with:

```js
// Glitter dust, skewed small, with a rare pearl (spec §1).
export function beadRadius(rng) {
  if (rng() < PEARL_P) return PEARL_R[0] + (PEARL_R[1] - PEARL_R[0]) * rng();
  const u = rng();
  return DUST_R[0] + (DUST_R[1] - DUST_R[0]) * u * u;
}
const radius = (b) => beadRadius(b.rng);
```

In `stepBeads`, change the destructure and the trickle line:

```js
  const { phase, coreR, calm, liquid, boil, rateScale = 1 } = ctx;
```

```js
    b.acc += AMBIENT_RATE * rateScale * (1 + BOIL_GAIN * boil) * dt;
```

In `planetQuality.js`, add `beadRate` after `beads` in each tier and set phone's cap to 128:
- full: `beads: 256, beadRate: 1,`
- phone: `beads: 128, beadRate: 0.55,`
- lite: `beads: 32, beadRate: 0.3,`

In `MercuryPlanet.jsx`, in the block that fills `beadCtx` before `stepBeads` (currently lines 702–706),
add after `beadCtx.boil = exo.coverage;`:

```js
    beadCtx.rateScale = TIERS[tier].beadRate;
```

and add `rateScale: 1` to the `beadCtx` initialiser at line 446:

```js
  const beadCtx = useMemo(() => ({ phase: 'fluid', coreR: R_SCENE, calm: false, liquid: true, boil: 0, rateScale: 1, lastFam: 'idle', dirW: [0, 0, 0], omega: [0, 0, 0] }), []);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeads.test.js src/terminal/mercury/planet/__tests__/planetQuality.test.js src/terminal/mercury/__tests__/hgBeadsWiring.test.js`
Expected: PASS. The existing `'ambient trickle settles near rate × life'` test now runs at 18/s
(bounds 72 to 187, inside the 256 cap).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/hgBeads.js src/terminal/mercury/planet/planetQuality.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/__tests__/hgBeads.test.js src/terminal/mercury/planet/__tests__/planetQuality.test.js src/terminal/mercury/__tests__/hgBeadsWiring.test.js
git commit -m "feat(mercury): glitter dust population — dust/pearl radii, 18/s trickle, per-tier bead rate, phone cap 128

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The wobble-and-tumble glint gate (sim + upload)

**Files:**
- Modify: `src/terminal/mercury/planet/hgBeads.js`
- Modify: `src/terminal/mercury/useHgBeads.js:20`
- Modify: `src/terminal/mercury/planet/hgBeadShader.js` (VS attribute only)
- Test: `src/terminal/mercury/planet/__tests__/hgBeads.test.js`
- Test: `src/terminal/mercury/planet/__tests__/hgBeadShader.test.js`
- Test: `src/terminal/mercury/__tests__/hgBeadsWiring.test.js`

**Interfaces:**
- Consumes: `beadRadius`, `DUST_R`, `PEARL_R` (Task 1).
- Produces: `wobbleHz(r: number): number`; `wobbleGate(r, age, ph2, ph3, ph4, tumble): number` in
  [0, 1]; constants `WOBBLE_HZ_REF 0.8`, `WOBBLE_R_REF 0.012`, `WOBBLE_HZ_MIN 0.5`, `WOBBLE_HZ_MAX 5`,
  `WOBBLE_RATIO Math.sqrt(30 / 8)`, `TUMBLE_E 0.6`, `TUMBLE_K [0.15, 0.30]`, `WOBBLE_K 3`. Bead state
  gains `ph2`, `ph3`, `ph4`, `tumble` (Float32Array(cap)). `outBead` is now `Float32Array(cap * 3)`
  laid out (radius, alpha, gate). Shader attribute `aBead` is `vec3`.

- [ ] **Step 1: Write the failing tests**

In `hgBeads.test.js`, add `wobbleHz, wobbleGate, WOBBLE_HZ_MIN, WOBBLE_HZ_MAX` to the `'../hgBeads'`
import. Replace the existing `'packs position and (radius, alpha) into reused buffers'` test with:

```js
  it('packs position and (radius, alpha, gate) into reused buffers', () => {
    const b = createBeads(8);
    const p = b.outPos, q = b.outBead;
    expect(q.length).toBe(8 * 3);
    spawnBead(b, 0.1, 1.5, 0.2, 0, 0, 0, 0.01);
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect(b.outPos).toBe(p); expect(b.outBead).toBe(q);
    expect(b.outBead[0]).toBeCloseTo(0.01, 6);
    expect(b.outBead[1]).toBeGreaterThan(0);
    expect(b.outBead[2]).toBeCloseTo(wobbleGate(0.01, b.age[0], b.ph2[0], b.ph3[0], b.ph4[0], b.tumble[0]), 6);
  });
```

Add:

```js
  it('wobble rate ∝ r^-1.5, clamped to [WOBBLE_HZ_MIN, WOBBLE_HZ_MAX]', () => {
    expect(wobbleHz(0.012)).toBeCloseTo(0.8, 6);
    expect(wobbleHz(0.006)).toBeCloseTo(0.8 * 2 ** 1.5, 6);
    expect(wobbleHz(0.0015)).toBe(WOBBLE_HZ_MAX);
    expect(wobbleHz(0.05)).toBe(WOBBLE_HZ_MIN);
  });
  it('the gate stays in [0, 1]', () => {
    const rng = mulberry32(3);
    for (let k = 0; k < 2000; k++) {
      const g = wobbleGate(0.0015 + 0.02 * rng(), 20 * rng(), 6.3 * rng(), 6.3 * rng(), 6.3 * rng(), 0.15 + 0.15 * rng());
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
  // Dust radii only: a pearl's glint is mix(0.85, 1, gate), a shimmer, so it has no sparks to time.
  // Plan-time check with this exact model over seeds 0x5eed, 1, 7, 99, 12345: min CV 0.47, ≥ 18 intervals, duty ≈ 0.096.
  it('dust twinkle is not a metronome: every speck\'s spark intervals vary (CV ≥ 0.3); duty 5–20 %', () => {
    const b = createBeads(64, 0x5eed);
    for (let k = 0; k < 60; k++) spawnBead(b, 0, 2, 0, 0, 0, 0, [0.0015, 0.003, 0.0045, 0.006][k % 4]);
    let lit = 0, samples = 0;
    for (let i = 0; i < 60; i++) {
      const sparks = [];
      let prev = 0;
      for (let s = 0; s < 20 * 240; s++) {
        const g = wobbleGate(b.r[i], s / 240, b.ph2[i], b.ph3[i], b.ph4[i], b.tumble[i]);
        if (g > 0.05) lit++;
        if (g > 0.05 && prev <= 0.05) sparks.push(s / 240);
        prev = g; samples++;
      }
      const iv = sparks.slice(1).map((t, j) => t - sparks[j]);
      expect(iv.length).toBeGreaterThanOrEqual(3);
      const m = iv.reduce((a, c) => a + c, 0) / iv.length;
      const sd = Math.sqrt(iv.reduce((a, c) => a + (c - m) ** 2, 0) / iv.length);
      expect(sd / m).toBeGreaterThanOrEqual(0.3);
    }
    expect(lit / samples).toBeGreaterThan(0.05);
    expect(lit / samples).toBeLessThan(0.2);
  });
  it('remove keeps the wobble state in step with the swapped bead', () => {
    const b = createBeads(8);
    spawnBead(b, 1, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 1.5, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 2, 0, 1, 0, 0, 0, 0.01);
    const moved = [b.ph2[2], b.ph3[2], b.ph4[2], b.tumble[2]];
    b.r[1] = 0; // dies on the next step; bead 2 swaps into slot 1
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect([b.ph2[1], b.ph3[1], b.ph4[1], b.tumble[1]]).toEqual(moved);
  });
```

In `hgBeadShader.test.js`, add inside the describe:

```js
  it('aBead carries (radius, alpha, glint gate)', () => {
    expect(BEAD_VS).toContain('attribute vec3 aBead;');
  });
```

In `hgBeadsWiring.test.js`, inside `'the hook shares the planet mirror uniforms and sets GLSL3'`, add:

```js
    expect(hookSrc).toContain('new THREE.BufferAttribute(sim.outBead, 3)');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeads.test.js src/terminal/mercury/planet/__tests__/hgBeadShader.test.js src/terminal/mercury/__tests__/hgBeadsWiring.test.js`
Expected: FAIL. `wobbleHz` / `wobbleGate` are not exported, `outBead.length` is 16, the VS has
`vec2 aBead`, and the hook binds item size 2.

- [ ] **Step 3: Implement**

In `hgBeads.js`, after the `FLING_*` constants add:

```js
// The glint gate (spec §2 + amendment): a free droplet rings in its l=2 and l=3 shape modes
// (Rayleigh: f ∝ √(l(l−1)(l+2)) · r^−1.5, ratio √(30/8) ≈ 1.94), and an ejected droplet tumbles, so its
// wobble axis precesses and the Sun's image swings in and out of reach. 1.94 alone nearly phase-locks
// (CV 0.01, a metronome); the tumble envelope breaks it (min CV 0.44 over 60 beads). Rates are scaled
// for legibility, not physical (real droplets this size ring far faster).
export const WOBBLE_HZ_REF = 0.8;  // at WOBBLE_R_REF
export const WOBBLE_R_REF = 0.012;
export const WOBBLE_HZ_MIN = 0.5;
export const WOBBLE_HZ_MAX = 5;    // dust lives at the clamp: a shimmer, not a strobe
export const WOBBLE_RATIO = Math.sqrt(30 / 8);
export const TUMBLE_E = 0.6;       // tumble envelope depth
export const TUMBLE_K = Object.freeze([0.15, 0.3]); // tumble rate as a fraction of the wobble rate
export const WOBBLE_K = 3;         // spark sharpness: dark ~90 % of the time

export function wobbleHz(r) {
  const hz = WOBBLE_HZ_REF * (WOBBLE_R_REF / Math.max(r, 1e-6)) ** 1.5;
  return Math.min(WOBBLE_HZ_MAX, Math.max(WOBBLE_HZ_MIN, hz));
}

export function wobbleGate(r, age, ph2, ph3, ph4, tumble) {
  const wt = 2 * Math.PI * wobbleHz(r) * age;
  const s = (0.6 * Math.sin(wt + ph2) + 0.4 * Math.sin(WOBBLE_RATIO * wt + ph3))
    * (1 - TUMBLE_E + TUMBLE_E * Math.sin(tumble * wt + ph4));
  return s > 0 ? s ** WOBBLE_K : 0;
}
```

In `createBeads`, add the four arrays and widen `outBead`:

```js
    r: new Float32Array(cap), age: new Float32Array(cap), boost: new Float32Array(cap),
    ph2: new Float32Array(cap), ph3: new Float32Array(cap), ph4: new Float32Array(cap), tumble: new Float32Array(cap),
    outPos: new Float32Array(cap * 3), outBead: new Float32Array(cap * 3),
```

In `spawnBead`, after `b.r[i] = r; b.age[i] = 0; b.boost[i] = 0;` add:

```js
  b.ph2[i] = 2 * Math.PI * b.rng(); b.ph3[i] = 2 * Math.PI * b.rng(); b.ph4[i] = 2 * Math.PI * b.rng();
  b.tumble[i] = TUMBLE_K[0] + (TUMBLE_K[1] - TUMBLE_K[0]) * b.rng();
```

In `remove`, extend the scalar swap line:

```js
  b.r[i] = b.r[last]; b.age[i] = b.age[last]; b.boost[i] = b.boost[last];
  b.ph2[i] = b.ph2[last]; b.ph3[i] = b.ph3[last]; b.ph4[i] = b.ph4[last]; b.tumble[i] = b.tumble[last];
```

In the packing loop at the end of `stepBeads`, replace the two `outBead` writes with:

```js
    b.outBead[3 * i] = b.r[i]; b.outBead[3 * i + 1] = Math.max(0, a);
    b.outBead[3 * i + 2] = wobbleGate(b.r[i], b.age[i], b.ph2[i], b.ph3[i], b.ph4[i], b.tumble[i]);
```

Update the module's header comment line `Preallocated typed arrays; nothing allocates per frame.` to:
`Preallocated typed arrays; nothing allocates per frame. Upload: position + (radius, alpha, glint gate).`

In `useHgBeads.js` line 20, change the item size:

```js
    g.setAttribute('aBead', new THREE.BufferAttribute(sim.outBead, 3).setUsage(THREE.DynamicDrawUsage));
```

In `hgBeadShader.js` `BEAD_VS`, change the attribute line:

```glsl
attribute vec3 aBead; // radius (scene units), alpha, glint gate (hgBeads wobbleGate)
```

(The VS keeps reading `aBead.x` / `aBead.y`; Task 3 consumes `.z`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeads.test.js src/terminal/mercury/planet/__tests__/hgBeadShader.test.js src/terminal/mercury/__tests__/hgBeadsWiring.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/hgBeads.js src/terminal/mercury/useHgBeads.js src/terminal/mercury/planet/hgBeadShader.js src/terminal/mercury/planet/__tests__/hgBeads.test.js src/terminal/mercury/planet/__tests__/hgBeadShader.test.js src/terminal/mercury/__tests__/hgBeadsWiring.test.js
git commit -m "feat(mercury): bead glint gate — l=2/l=3 wobble × tumble envelope, uploaded as aBead.z

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Dust shading: gated glint, no body below 2 px, single glint on resolved pearls

**Files:**
- Modify: `src/terminal/mercury/planet/hgBeadShader.js`
- Modify: `src/terminal/mercury/useHgBeads.js`
- Modify: `src/terminal/mercury/planet/planetLook.js:61`
- Test: `src/terminal/mercury/planet/__tests__/hgBeadShader.test.js`
- Test: `src/terminal/mercury/__tests__/hgBeadsWiring.test.js`

**Interfaces:**
- Consumes: `aBead.z` = glint gate in [0, 1] (Task 2).
- Produces: uniform `uDustSparkle` (in `BEAD_UNIFORMS_OWN`), `PLANET_TUNE.dustSparkle` = 1.5.
  `BEAD_BODY_SUBPX` export is removed.

- [ ] **Step 1: Write the failing tests**

In `hgBeadShader.test.js`, replace the `'premultiplied output: ...'` test with:

```js
  it('premultiplied output: a pearl-only body occluder plus an additive, gated sun glint', () => {
    expect(BEAD_FS).toContain('fragColor = vec4(srgb * aBody + glint, aBody);');
    expect(BEAD_FS).toContain('normalize(Vc + uSunDir)');
    expect(BEAD_FS).toContain('vec3 G = min(gain * fresnelHg(dot(H, Vc)) * sh, vec3('); // fresnelHg is vec3: a float G did not compile (live, 2026-10-05)
    expect(BEAD_UNIFORMS_OWN).toContain('uBeadSparkle');
    expect(BEAD_UNIFORMS_OWN).toContain('uDustSparkle');
  });
  it('dust (< 2 px) has no body and a gated glint; pearls (> 4 px) keep the body and a steady glint', () => {
    expect(BEAD_VS).toContain('vGate = aBead.z;');
    expect(BEAD_FS).toContain('float kPearl = smoothstep(2.0, 4.0, vPx);');
    expect(BEAD_FS).toContain('float aBody = vA * vCover * vCover * edgeK * kPearl;');
    expect(BEAD_FS).toContain('float gain = mix(uDustSparkle * vGate, uBeadSparkle * mix(0.85, 1.0, vGate), kPearl);');
    expect(BEAD_FS).not.toContain('bodyK');
  });
  it('one glint on a resolved pearl: the analytic glint fades out 4 → 6 px', () => {
    expect(BEAD_FS).toContain('float unresolved = 1.0 - smoothstep(4.0, 6.0, vPx);');
    expect(BEAD_FS).toContain('vec3 glint = G * (w * vA * unresolved);');
  });
```

In `hgBeadsWiring.test.js`, inside `'the hook uploads the bead sparkle gain'`, add:

```js
    expect(hookSrc).toContain('uDustSparkle: { value: PLANET_TUNE.dustSparkle }');
    expect(hookSrc).toContain('u.uDustSparkle.value = PLANET_TUNE.dustSparkle;');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeadShader.test.js src/terminal/mercury/__tests__/hgBeadsWiring.test.js`
Expected: FAIL (strings missing).

- [ ] **Step 3: Implement**

In `hgBeadShader.js`:

Replace the `BEAD_UNIFORMS_OWN` line and delete the `BEAD_BODY_SUBPX` line:

```js
export const BEAD_UNIFORMS_OWN = ['uViewportPx', 'uPlanetR', 'uLitPen', 'uSunGlint', 'uBeadSparkle', 'uDustSparkle'];
```

In `BEAD_VS`, add a varying after `varying float vPx;`:

```glsl
varying float vGate;
```

and in `main()` after `vA = aBead.y;`:

```glsl
  vGate = aBead.z;
```

In `BEAD_FS`, after `uniform float uBeadSparkle;` add:

```glsl
uniform float uDustSparkle;
```

after `varying float vPx;` add:

```glsl
varying float vGate;
```

Replace the two lines

```glsl
  float bodyK = mix(${glf(BEAD_BODY_SUBPX)}, 1.0, smoothstep(2.0, 5.0, vPx));
  float aBody = vA * vCover * vCover * edgeK * bodyK;
```

with

```glsl
  // Dust below 2 px is glint only; the mirror body fades in to a pearl by 4 px. vPx is floored at
  // BEAD_MIN_PX (1.5), which is below this ramp, so it equals the true projected size wherever it matters.
  float kPearl = smoothstep(2.0, 4.0, vPx);
  float aBody = vA * vCover * vCover * edgeK * kPearl;
```

Replace

```glsl
  vec3 G = min(uBeadSparkle * fresnelHg(dot(H, Vc)) * sh, vec3(${glf(BEAD_GLINT_MAX)})); // fresnelHg is spectral (vec3): the glint keeps Hg's faint tint
```

with

```glsl
  // Dust sparks on its wobble gate; a pearl's glint only shimmers (spec §2).
  float gain = mix(uDustSparkle * vGate, uBeadSparkle * mix(0.85, 1.0, vGate), kPearl);
  vec3 G = min(gain * fresnelHg(dot(H, Vc)) * sh, vec3(${glf(BEAD_GLINT_MAX)})); // fresnelHg is spectral (vec3): the glint keeps Hg's faint tint
```

Replace

```glsl
  vec3 glint = G * (w * vA);
```

with

```glsl
  // Above 6 px the resolved Sun lobe in envRadiance is the glint: fade the analytic one out (no double glint).
  float unresolved = 1.0 - smoothstep(4.0, 6.0, vPx);
  vec3 glint = G * (w * vA * unresolved);
```

Update the header comment's `Premultiplied output (body occludes by its true coverage, the glint adds light)`
line to:
`// Premultiplied output (a pearl's body occludes by its true coverage, the glint adds light; dust is glint only).`

In `planetLook.js`, after the `beadSparkle` line add:

```js
  dustSparkle: 1.5,  // Hg glitter dust: peak of the wobble-gated glint (dark ~90 % of the time, so it can run hot), sRGB units before the 1.5 cap
```

In `useHgBeads.js`, in the `uniforms` object after `uBeadSparkle`:

```js
      uDustSparkle: { value: PLANET_TUNE.dustSparkle },
```

and in `upload` after `u.uBeadSparkle.value = PLANET_TUNE.beadSparkle;`:

```js
    u.uDustSparkle.value = PLANET_TUNE.dustSparkle;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeadShader.test.js src/terminal/mercury/__tests__/hgBeadsWiring.test.js`
Expected: PASS. Then run `npx vitest run src/terminal/mercury` (expected: PASS) and `npm run lint`
(expected: 0 errors).

GLSL is only string-tested here. The GPU compile runs live in Task 5. Read your FS diff once for type
mismatches: `gain` is a float, `G` is a vec3, `unresolved` is a float.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/hgBeadShader.js src/terminal/mercury/useHgBeads.js src/terminal/mercury/planet/planetLook.js src/terminal/mercury/planet/__tests__/hgBeadShader.test.js src/terminal/mercury/__tests__/hgBeadsWiring.test.js
git commit -m "feat(mercury): glitter dust shading — glint-only gated dust, pearl body from 2-4 px, one glint above 6 px

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Fling free-flight

**Files:**
- Modify: `src/terminal/mercury/planet/hgBeads.js`
- Test: `src/terminal/mercury/planet/__tests__/hgBeads.test.js`

**Interfaces:**
- Consumes: bead state from Tasks 1–2.
- Produces: `FLING_FREE_T` `0.5`, `FLING_RADIAL` `0.25`; bead state `free` (Uint8Array(cap), 1 = flung).
  `FLING_DRAG_BOOST`, `FLING_DRAG_T` and `boost` are removed.

- [ ] **Step 1: Write the failing tests**

In `hgBeads.test.js`, change the import: drop `FLING_DRAG_BOOST`, add `FLING_RADIAL` and `G_BEAD`.

Replace the test `'remove keeps boost in step with the swapped bead'` with:

```js
  it('remove keeps free in step with the swapped bead', () => {
    const b = createBeads(8);
    spawnBead(b, 1, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 1.5, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 2, 0, 1, 0, 0, 0, 0.01);
    b.free[0] = 0; b.free[1] = 0; b.free[2] = 1;
    b.r[1] = 0; // dies on the next step; bead 2 swaps into slot 1
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect(b.n).toBe(2);
    expect(b.pos[3]).toBeCloseTo(2, 1);
    expect(b.free[1]).toBe(1);
  });
```

Replace `'spawnBead returns its slot and zeroes boost; a fling sets it, even on eviction'` with:

```js
  it('spawnBead returns its slot and clears free; a fling sets it, including into an evicted slot', () => {
    const b = createBeads(4);
    for (let k = 0; k < 4; k++) { spawnBead(b, k, 0, 2, 0, 0, 0, 0.01); b.age[k] = 5; } // full, all old
    spawnFling(b, [0, 12, 0], 0.75, 4); // every fling bead evicts an old one
    for (let i = 0; i < 4; i++) expect(b.free[i]).toBe(1);
    const i = spawnBead(b, 0, 0, 2, 0, 0, 0, 0.01);
    expect(b.free[i]).toBe(0);
  });
```

In `'a fling about +X (the other basis branch) is tangential too'`, change the comment and bound:

```js
      const radial = (p[0] * v[0] + p[1] * v[1] + p[2] * v[2]) / pl; // the FLING_RADIAL outward kick is the only radial part
      expect(Math.abs(radial)).toBeLessThan(FLING_RADIAL + 1e-6);
```

Add:

```js
  it('a flung bead flies free: at 1 s it is past 1.3 × coreR in every element (was: clung at ~0.97)', () => {
    for (const phase of ['air', 'fluid', 'earth', 'thermal']) {
      const b = createBeads(64);
      spawnFling(b, [0, 1.78, 0], 0.75, FLING_N); // release speed ≈ 1.5 u/s
      run(b, 1, { ...CTX, phase, liquid: false });
      expect(b.n).toBeGreaterThan(0); // thermal evaporates the smallest dust; the rest must be out
      for (let i = 0; i < b.n; i++) {
        expect(Math.hypot(b.pos[3 * i], b.pos[3 * i + 1], b.pos[3 * i + 2])).toBeGreaterThan(1.3 * 0.75);
      }
    }
  });
  it('a flung bead is ballistic at release: one frame changes its velocity by gravity alone', () => {
    const b = createBeads(8);
    spawnFling(b, [0, 1.78, 0], 0.75, 1);
    const v0 = [b.vel[0], b.vel[1], b.vel[2]];
    const p0 = [b.pos[0], b.pos[1], b.pos[2]];
    const dt = 1 / 600;
    stepBeads(b, dt, { ...CTX, liquid: false });
    const r2 = p0[0] ** 2 + p0[1] ** 2 + p0[2] ** 2, g = G_BEAD / (r2 * Math.sqrt(r2));
    for (let c = 0; c < 3; c++) expect(b.vel[c]).toBeCloseTo(v0[c] - g * p0[c] * dt, 3);
  });
```

(Plan-time simulation of the free-flight model: at a 1.5 u/s release, r at 1 s is air 1.36, fluid 1.38,
earth 1.45, thermal 1.41, against the 0.975 bound. On today's code the boost relaxes flung beads into the
flow and they stay below about 0.97, so this test is RED first.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeads.test.js`
Expected: FAIL. `FLING_RADIAL` is not exported, `b.free` is undefined, and the 1 s radius test fails.

- [ ] **Step 3: Implement**

In `hgBeads.js`, replace the two boost constants:

```js
export const FLING_FREE_T = 0.5;   // s: a flung bead flies free (no drag), then eases into the flow: drag × (1 − e^(−age/T))
export const FLING_RADIAL = 0.25;  // outward launch kick (scene units/s): the spray peels off the surface
```

(delete `FLING_DRAG_BOOST` and `FLING_DRAG_T`).

In `createBeads`, replace `boost: new Float32Array(cap),` with `free: new Uint8Array(cap),`.

In `spawnBead`, replace `b.boost[i] = 0;` with `b.free[i] = 0;`.

In `remove`, replace `b.boost[i] = b.boost[last];` with `b.free[i] = b.free[last];`.

In `spawnFling`, change the launch kick and the flag:

```js
    let lx = wy * pz - wz * py + dx * FLING_RADIAL, ly = wz * px - wx * pz + dy * FLING_RADIAL, lz = wx * py - wy * px + dz * FLING_RADIAL;
```

```js
    b.free[spawnBead(b, px, py, pz, lx, ly, lz, radius(b))] = 1;
```

In `stepBeads`, replace the drag line:

```js
      const drag = b.free[i] ? DRAG * (1 - Math.exp(-b.age[i] / FLING_FREE_T)) : DRAG;
```

Update the header comment's `Motion:` sentence to:
`Motion: gravity toward the planet + drag toward the ACTIVE element's flow velocity (flung beads fly free first, FLING_FREE_T).`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeads.test.js`
Expected: PASS, including the existing `'the early drag arc keeps a fling in the scene past 0.6 s (air)'`
test. (At the 2.25 u/s cap, the free-flight model puts a bead at r ≈ 1.5 at 0.6 s, inside the escape
radius of 3.) If that test fails, report it; do not loosen it.

Then run `npx vitest run src/terminal/mercury` (expected: PASS) and `npm run lint` (expected: 0 errors).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/hgBeads.js src/terminal/mercury/planet/__tests__/hgBeads.test.js
git commit -m "feat(mercury): fling free-flight — flung beads fly ballistic, then ease into the flow (was: clung to the limb)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Live gate: GPU compile, data, look sheet (controller)

No source change. Run from the controller, who must view every image before reporting. The tools live
in `.superpowers/sdd/tools/` (never committed).

**Files:**
- Create: `.superpowers/sdd/tools/dustLook.mjs` (uncommitted tool)

- [ ] **Step 1: Write the probe**

Model it on `.superpowers/sdd/tools/beadLook.mjs` (same `openMercury` / `launch` / `m.melt` / `m.shot` /
`m.errors` helpers, and the same bead `Points` lookup now matched by `uDustSparkle`). It must capture:

```js
// Glitter dust look (glitter-dust plan Task 5). node dustLook.mjs [tag]
import { openMercury, OUT, sleep } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const TAG = process.argv[2] ?? 'a';
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
const log = [];
const BEADS = `(() => { let o = null; window.__mercury.scene.traverse((m) => { if (m.isPoints && m.material.uniforms && m.material.uniforms.uDustSparkle) o = m; }); return o; })()`;
const info = () => page.eval(`(() => { const o = ${BEADS}; if (!o) return 'NO BEADS'; const n = o.geometry.drawRange.count, p = o.geometry.attributes.position.array, q = o.geometry.attributes.aBead.array; const rs = [], gates = []; let pearls = 0; for (let i = 0; i < n; i++) { rs.push(Math.hypot(p[3*i], p[3*i+1], p[3*i+2])); gates.push(q[3*i+2]); if (q[3*i] >= 0.012) pearls++; } rs.sort((a,b)=>a-b); return { n, pearls, lit: gates.filter((g) => g > 0.05).length, med: +(rs[n>>1]||0).toFixed(2), max: +(rs[n-1]||0).toFixed(2) }; })()`);
try {
  const m = await openMercury(page);
  await sleep(1500);
  await m.melt(25); await sleep(9000); // > BEAD_LIFE: steady state
  for (const el of ['fluid', 'earth', 'air', 'thermal']) {
    await m.setPhase(el); await sleep(2500);
    log.push({ el, ...(await info()) });
    await m.shot(`${OUT}/gd-${TAG}-${el}.png`, 900);
  }
  await m.setPhase('fluid'); await sleep(2000);
  for (const s of [0.8, 1.5, 3]) {
    await page.eval(`window.__mercuryTune.planet.dustSparkle = ${s}; 1`); await sleep(300);
    log.push({ dustSparkle: s, ...(await info()) });
    await m.shot(`${OUT}/gd-${TAG}-ds${s}.png`, 900);
  }
  await page.eval('window.__mercuryTune.planet.dustSparkle = 1.5; 1');
  for (let k = 0; k < 12; k++) { await m.shot(`${OUT}/gd-${TAG}-strip${k}.png`, 900); await sleep(80); } // ~1 s strip
  await page.eval('window.__mercuryTune.holdAt(12); 1'); await sleep(1500);
  await page.eval('window.__mercuryTune.holdAt(null); window.__mercuryTune.breakNow(12); 1');
  const t0 = Date.now();
  for (const t of [0.3, 1.0, 2.0]) { while (Date.now() - t0 < t * 1000) await sleep(10); log.push({ fling: t, ...(await info()) }); await m.shot(`${OUT}/gd-${TAG}-f${t}.png`, 900); }
  log.push({ errors: await m.errors() });
} catch (e) { log.push({ FAIL: e.message }); } finally { console.log(JSON.stringify(log)); await page.close(); process.exit(0); }
```

If `openMercury` has no `setPhase` helper, switch the element through the same control the existing
probes use (search `.superpowers/sdd/tools/*.mjs` for `activePhase` / the element buttons) and note what
you used. `dustSparkle 3` exercises the 1.5 cap: it should look the same as 1.5 at the peak.

- [ ] **Step 2: Run against a fresh dev server of this checkout**

Run (dev server on 5175 started via the preview `scale94-dev-5175` config): `node .superpowers/sdd/tools/dustLook.mjs a`
Expected data:
- `errors: []` (GPU compile, 0 errors).
- Steady fluid `n` ≈ 100–200 with `pearls` ≈ 5 % of `n`.
- `lit` well under half of `n`.
- At fling `t = 1.0`, `max` ≥ 1.3.

- [ ] **Step 3: View the sheet and record the look**

Open every `gd-a-*.png` and judge them:
- Specks read as sparks, not grey dots.
- Pearls are solid silver with one glint.
- The strip frames differ speck-by-speck, with no common beat.
- The fling spray clearly leaves the limb at 0.3 s and 1.0 s.
- The shadow lane holds no sparks.

- [ ] **Step 4: Record**

Append the result to `.superpowers/sdd/progress.md` under a new `## Glitter dust` heading: commits,
data, the look verdict, and the open author calls (twinkle judged on the 360 Hz panel; phone FPS while
boiling at the 128 cap; `dustSparkle` default). Do not commit `progress.md`.
