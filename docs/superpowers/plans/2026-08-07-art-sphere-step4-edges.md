# Art Sphere Step 4 — Edges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the sphere's edges, the resonance edge and the prism geometry chords off Canvas2D and onto the GPU as instanced line quads with real additive glow, retiring `ctx.shadowBlur` from the draw loop.

**Architecture:** Step 3's single composite pass cannot absorb these. A fullscreen shader is right for 31 ghost discs and wrong for ~60 line segments that cover a few percent of pixels. So the composite becomes **two passes**: an offscreen target holding **sRGB-encoded** values, into which the background quad draws and then the edge geometry blends; and the existing screen pass, which samples that target as its backdrop instead of calling `sphereBackground()`. Everything blends in sRGB, exactly as the canvas does, and the finished pixel converts to linear once on the way out.

**Tech Stack:** react-three-fiber 9.5, three 0.183, @react-three/postprocessing 3.0.4, Vitest 4, CDP harness (`scripts/artBaseline.mjs`, `artCompare.mjs`, `artSmoke.mjs`, `artPresence.mjs`).

## Global Constraints

- **Projection, depth sort and hit-testing stay on the CPU.** Edge hit-testing lives at `ArtTab.jsx:1741` and reads projected screen coordinates. Moving projection into a vertex shader renders identically and kills it silently.
- **Faithful parity first.** Do not re-art. If a layer looks better after the port, that is a bug until the author says otherwise.
- **Never run vitest with `-u` / `--update`.**
- **Do not push.** The author decides.
- Gates, all of which must pass before a commit:
  - `npx vitest run` — 994 tests / 107 files
  - `npm run lint` — 0 errors, warnings ≤ 153 (currently 145; **a new warning is yours, fix it, do not raise the ratchet**)
  - `npm run build`
  - `node scripts/artSmoke.mjs` — 9/9
  - `node scripts/artPresence.mjs` — 4/4
- `ArtTab.jsx` cannot be mounted in jsdom. Unit tests cover extracted pure modules only and are **not** parity evidence.

## What step 3 proved, that this step must not relearn

Read these before writing a line. Each cost real time.

1. **A green gate is not a correct render.** The sRGB-vs-linear blend bug scored **1.285 against a threshold of 4** while individual grid cells had nearly doubled. Check the *sign* of the difference (`mean signed delta`), not just the magnitude — a systematic bias is the tell.
2. **Blending space is the whole ballgame.** Canvas composites in sRGB byte space. A GL blend of a texture tagged `SRGBColorSpace` happens in linear, because the sampler decodes first. This is why the offscreen target below is **`NoColorSpace`, plain RGBA8** and why nothing converts until the final pass.
3. **Most layers are invisible to the parity gate.** For step 4, expect the resonance edge (needs shift-click with resonance armed) and the prism chords (command-triggered) to never fire during a capture. A pass on those proves *no regression*, never *it works* — deleting the layer scores identically. Each needs a presence check added to `scripts/artPresence.mjs`.
4. **When a layer does not appear, ask whether the state reached the shader before touching the shader.** `window.__artBgState()` exists for this. Extend it rather than guessing at pixels — four consecutive ghost-trail "failures" were all bugs in the check.
5. **Presence checks lie in specific ways:** metrics too coarse for the signal (compute the expected magnitude first), pixel-diffs drowning in the harness's ~41k-pixel reproducibility floor, seeded geometry landing behind the back-face cull, and `__virtualize()` failing to take control if it lands after ~20s of real rAF (give such a check its own page).
6. **`artBaseline.mjs` pins a boot fingerprint per manifest**, so a changed render cannot overwrite its own reference in place. Capture to a fresh directory and swap.

## The gate

Reference: `baseline/art-sphere-step3/` (captured with the whole background slice on the GPU).

```bash
node scripts/artBaseline.mjs --out baseline/wip
node scripts/artCompare.mjs baseline/art-sphere-step3 baseline/wip
```

Threshold 4.0 on a 32×18 mean-luminance signature of the **composited screenshot**. Noise floor is under 2; `immersive-on` legitimately runs 1.3–1.7 with balanced ±cells, and `immersive-off` is blank and proves nothing.

**This step legitimately changes pixels.** Edges are being re-implemented, and `shadowBlur` is being replaced by a different glow model. Parity means *looks the same*. A state going over threshold is a prompt to look at the PNGs, not an automatic failure — but you must look, and say which it was.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/art/artEdges.js` | **Create.** Pure. Edge alpha/width/dash/glow parameters and the gradient-stop maths, lifted verbatim from the draw loop so the GL and 2D versions cannot drift. |
| `src/terminal/art/__tests__/artEdges.test.js` | **Create.** Unit tests for the above. |
| `src/terminal/art/SphereEdges.jsx` | **Create.** The instanced line-quad mesh: geometry, per-instance attributes, and the edge shader (gradient, dash, glow). |
| `src/terminal/art/SphereComposite.jsx` | **Modify.** Add the offscreen sRGB target and the two-pass render; the screen quad samples the target instead of calling `sphereBackground()`. |
| `src/terminal/art/SphereBackground.js` | **Modify.** `sphereBackground()` becomes the fragment body of the offscreen backdrop pass. Its layer code is unchanged. |
| `src/terminal/views/ArtTab.jsx` | **Modify.** Delete the three 2D blocks; publish projected edge endpoints and per-edge state to a ref each frame. |
| `scripts/artPresence.mjs` | **Modify.** Add presence checks for the resonance edge and the prism chords. |

---

### Task 1: `artEdges.js` — lift the edge parameters out of the draw loop

Do this first and separately. It is the only part with real unit tests, and extracting the numbers *before* writing shaders is what stops the GL version drifting.

**Files:**
- Create: `src/terminal/art/artEdges.js`
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Produces:
  - `ORTHO_DASH = [8, 4]`, `SPECTRAL_DASH = [4, 3]`
  - `ORTHO_HUE_RATE = 0.0008`, `ORTHO_HUE_SPAN = 60`
  - `orthoHue(nowMs) => number` — base hue in degrees, `(nowMs * 0.0008 * 60) % 360`
  - `orthoGlow(nowMs) => number` — `10 + sin(nowMs * 0.0008 * 3) * 4`
  - `fusedGlow(fuseCos) => number` — `6 + fuseCos * 8`
  - `resonanceGlow(sim) => number` — `4 + sim * 24`
  - `edgeStops(colA, colB, cMid, baseAlpha, pulseBoost, strength) => [{t, rgba}, …]` — the three gradient stops, with the `(1 - strength*0.4)` and `(0.6 + strength*0.4)` end weights
  - `pulseRingRadius(pulse, scale) => number` — `(2 + pulse * 2.5) * scale`
  - `pulsePosition(pulse, direction) => number` — `direction >= 0 ? pulse : 1 - pulse`

Read the exact constants out of `ArtTab.jsx` (`:1055-1108` for the base edges, `:1110-1152` for the resonance edge, `:1153-1230` for the prism chords) and copy them. **Do not re-derive, and do not trust comments** — step 3 found three source comments that disagreed with the arithmetic beside them.

- [ ] **Step 1: Write the failing test**

```js
// artEdges.test.js — the numbers behind the GL edge layers.
//
// These were inline in a 3185-line draw loop. Extracted so the GPU version and
// the 2D code it replaces cannot drift apart silently, and so the animated
// curves can be tested without a canvas.

import { describe, it, expect } from 'vitest';
import {
  ORTHO_DASH, SPECTRAL_DASH,
  orthoHue, orthoGlow, fusedGlow, resonanceGlow,
  pulseRingRadius, pulsePosition, edgeStops,
} from '../artEdges';

describe('orthoHue', () => {
  it('completes a full rotation in about 7.5 seconds', () => {
    // hue = (t * 0.0008 * 60) % 360 → 360 degrees at t = 7500ms.
    expect(orthoHue(0)).toBeCloseTo(0, 10);
    expect(orthoHue(7500)).toBeCloseTo(0, 6);
    expect(orthoHue(3750)).toBeCloseTo(180, 6);
  });

  it('stays inside [0, 360)', () => {
    for (const t of [0, 1234, 99999, 1e7]) {
      const h = orthoHue(t);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});

describe('glow amounts', () => {
  it('oscillates the ortho glow between 6 and 14', () => {
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t < 20000; t += 17) {
      const g = orthoGlow(t);
      lo = Math.min(lo, g); hi = Math.max(hi, g);
    }
    expect(lo).toBeCloseTo(6, 1);
    expect(hi).toBeCloseTo(14, 1);
  });

  it('scales the fused glow from 6 to 14 with cosine similarity', () => {
    expect(fusedGlow(0)).toBeCloseTo(6, 10);
    expect(fusedGlow(1)).toBeCloseTo(14, 10);
  });

  it('scales the resonance glow from 4 to 28 — a much wider range', () => {
    expect(resonanceGlow(0)).toBeCloseTo(4, 10);
    expect(resonanceGlow(1)).toBeCloseTo(28, 10);
  });
});

describe('pulse ring', () => {
  it('grows from 2px to 4.5px, scaled by projection', () => {
    expect(pulseRingRadius(0, 1)).toBeCloseTo(2, 10);
    expect(pulseRingRadius(1, 1)).toBeCloseTo(4.5, 10);
    expect(pulseRingRadius(1, 2)).toBeCloseTo(9, 10);
  });

  it('runs backwards along the edge when direction is negative', () => {
    expect(pulsePosition(0.25, 1)).toBeCloseTo(0.25, 10);
    expect(pulsePosition(0.25, -1)).toBeCloseTo(0.75, 10);
  });
});

describe('dash patterns', () => {
  it('keeps the two patterns distinct — ortho is longer and sparser', () => {
    expect(ORTHO_DASH).toEqual([8, 4]);
    expect(SPECTRAL_DASH).toEqual([4, 3]);
  });
});

describe('edgeStops', () => {
  // The alpha weights are the whole reason this function exists: the two ends
  // of an edge are NOT symmetric, and a shader that fades symmetrically looks
  // right and is wrong. Strength skews it further.
  const A = [0, 100, 50], B = [200, 100, 50], M = [100, 100, 50];

  it('places the stops at 0, 0.5 and 1', () => {
    expect(edgeStops(A, B, M, 0.5, 0, 0).map(s => s.t)).toEqual([0, 0.5, 1]);
  });

  it('is asymmetric at zero strength: end B starts at 0.6 of the middle', () => {
    const [s0, s1, s2] = edgeStops(A, B, M, 0.5, 0, 0);
    expect(s0.a).toBeCloseTo(0.5, 10);         // 0.5 * (1 - 0)
    expect(s1.a).toBeCloseTo(0.5, 10);
    expect(s2.a).toBeCloseTo(0.3, 10);         // 0.5 * (0.6 + 0)
  });

  it('swings the two ends in opposite directions as strength rises', () => {
    const [s0, , s2] = edgeStops(A, B, M, 0.5, 0, 1);
    expect(s0.a).toBeCloseTo(0.3, 10);         // 0.5 * (1 - 0.4)
    expect(s2.a).toBeCloseTo(0.5, 10);         // 0.5 * (0.6 + 0.4)
  });

  it('adds the pulse boost to all three stops before weighting', () => {
    const [s0, s1] = edgeStops(A, B, M, 0.4, 0.2, 0);
    expect(s1.a).toBeCloseTo(0.6, 10);
    expect(s0.a).toBeCloseTo(0.6, 10);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js
```

Expected: FAIL, `Failed to resolve import "../artEdges"`.

- [ ] **Step 3: Implement `artEdges.js`** with the constants copied from the draw loop and the functions above.

- [ ] **Step 4: Run it and watch it pass.** If the 7.5s rotation assertion fails, do **not** loosen it before checking the real arithmetic — that assertion is a check on your reading of the original, and the source comment says "~6s", which is wrong.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/artEdges.js src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(art): extract edge layer parameters from the draw loop"
```

---

### Task 2: the two-pass pipeline, drawing nothing

**Do this before migrating any edge**, for the same reason step 3's backdrop went first: it is the risky architectural change, and doing it with zero layers moved means a parity failure has exactly one candidate cause. Step 3's plan got this ordering wrong and it cost a rewrite.

**Files:**
- Modify: `src/terminal/art/SphereComposite.jsx`
- Modify: `src/terminal/art/SphereBackground.js`

**Interfaces:**
- Produces: an offscreen `THREE.WebGLRenderTarget` (`RGBAFormat`, `UnsignedByteType`, `NoColorSpace`, no depth, no stencil) sized to the drawing buffer; the screen pass samples it via a `uBackdrop` sampler.
- Consumes: `BACKGROUND_GLSL` and `backgroundUniforms()` unchanged.

- [ ] **Step 1: Add the target and the backdrop pass.** In `SphereComposite.jsx`, create the target with `useMemo`, resize it in `SizeSync` alongside the renderer, and render a fullscreen backdrop quad into it each frame before the screen pass. Use `gl.setRenderTarget(target)` / `gl.render(backdropScene, camera)` / `gl.setRenderTarget(null)` driven from a `useFrame` with a negative `renderPriority` so it runs before the composer.

The backdrop fragment shader writes **sRGB values, unconverted**:

```glsl
precision highp float;
uniform vec2 uResolution;
varying vec2 vUv;
${BACKGROUND_GLSL}
void main() {
  gl_FragColor = vec4(sphereBackground(vUv, uResolution), 1.0);
}
```

- [ ] **Step 2: Point the screen pass at the target.** In `SourceQuad`'s fragment shader, replace the `sphereBackground()` call with a texture read. Everything else is unchanged — the blend is still sRGB, the conversion still happens once at the end:

```glsl
vec4 src = texture2D(uSource, vUv);
vec3 bg  = texture2D(uBackdrop, vUv).rgb;   // already sRGB, NoColorSpace
vec3 srgb = mix(bg, src.rgb, src.a);
gl_FragColor = vec4(srgbToLinear(srgb), 1.0);
```

Set `backdropTarget.texture.colorSpace = THREE.NoColorSpace`. **Tagging it `SRGBColorSpace` makes the sampler decode and reintroduces exactly the bug step 3 spent a rewrite fixing.**

- [ ] **Step 3: Verify parity.** This task changes where the backdrop is computed and nothing about what it contains, so it should be near-identity.

```bash
node scripts/artBaseline.mjs --out baseline/wip
node scripts/artCompare.mjs baseline/art-sphere-step3 baseline/wip
```

Expected: 21/21, means under ~0.4, and **`mean signed delta` near zero**. Run the diff map on `laptop-1520x900@1x__idle.png` and confirm no systematic brightness shift. A uniform bias means the target's colour space is wrong — the symptom is subtle and it will pass the threshold.

- [ ] **Step 4: Confirm the presence suite still passes.** Every background layer now routes through the target; if the target is misconfigured they fail together.

```bash
node scripts/artPresence.mjs
```

Expected: 4/4 RENDERS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/SphereComposite.jsx src/terminal/art/SphereBackground.js
git commit -m "feat(art): render the sphere backdrop into an offscreen sRGB target"
```

---

### Task 3: `SphereEdges.jsx` — the base edges

**Files:**
- Create: `src/terminal/art/SphereEdges.jsx`
- Modify: `src/terminal/art/SphereComposite.jsx` (add to the backdrop scene, after the backdrop quad)
- Modify: `src/terminal/views/ArtTab.jsx` (delete `:996-1108`, publish edge state)

**Interfaces:**
- Consumes: `artEdges.js`; an `edgeStateRef` whose `.current` is `{ count, data: Float32Array }` written in place each frame by ArtTab.
- Produces: default export `SphereEdges({ stateRef })`.

Per-instance attribute layout, 16 floats per edge, written in the CPU's existing depth-sorted order:

| offset | meaning |
|---|---|
| 0–3 | `ax, ay, bx, by` — projected endpoints, canvas px |
| 4–6 | `r, g, b` of stop 0 (0–1, sRGB) |
| 7–9 | `r, g, b` of stop 1 (mid) |
| 10–12 | `r, g, b` of stop 2 |
| 13 | packed alphas: `a0 + a1*256 + a2*65536`, each quantised to 1/255 |
| 14 | `width` px |
| 15 | packed flags: `dashPeriod + dashDuty*256 + glow*65536` |

- [ ] **Step 1: Build the instanced quad.** One `THREE.InstancedBufferGeometry` over a unit quad (`[0,-1] [1,-1] [1,1] [0,1]`), expanded in the vertex shader along the segment direction and its normal, padded by `width/2 + glow` so the glow falloff has room. Draw with `count` instances; a zero `count` must draw nothing rather than one degenerate instance.

- [ ] **Step 2: Write the edge fragment shader.** Along-line parameter `t` and perpendicular distance `d` come from the vertex shader as varyings.

```glsl
// Three-stop gradient, interpolated NON-premultiplied exactly as a canvas
// linear gradient does — the colour darkens toward the rim as it fades.
vec3 col; float a;
if (t < 0.5) { float u = t / 0.5; col = mix(c0, c1, u); a = mix(a0, a1, u); }
else         { float u = (t - 0.5) / 0.5; col = mix(c1, c2, u); a = mix(a1, a2, u); }

// Core line plus a soft glow shoulder standing in for ctx.shadowBlur.
float core = 1.0 - smoothstep(halfW - px, halfW + px, abs(d));
float glow = uGlow > 0.0 ? exp(-abs(d) / uGlow) * 0.5 : 0.0;
float cov = clamp(core + glow * (1.0 - core), 0.0, 1.0);

// Dash, in the same px units the canvas used.
if (dashPeriod > 0.0) {
  float s = mod(t * lineLen, dashPeriod);
  cov *= step(s, dashDuty);
}
gl_FragColor = vec4(col, a * cov);
```

`px` is `fwidth(d)`, taken outside any branch — inside non-uniform control flow it is undefined.

- [ ] **Step 3: Blend in sRGB, source-over.** The material is `transparent: true`, `blending: THREE.CustomBlending`, `blendSrc: THREE.SrcAlphaFactor`, `blendDst: THREE.OneMinusSrcAlphaFactor`, `depthTest: false`, `depthWrite: false`, `toneMapped: false`. Because the target holds raw sRGB values and is `NoColorSpace`, this blend happens in sRGB byte space, which is what the canvas did.

- [ ] **Step 4: Publish state from ArtTab and delete the 2D block.** Keep the existing depth sort and the `findIndex` lookups exactly as they are — they feed hit-testing. Write into a preallocated `Float32Array(MAX_EDGES * 16)`; do not allocate per frame.

- [ ] **Step 5: Gate it.**

```bash
node scripts/artBaseline.mjs --out baseline/wip
node scripts/artCompare.mjs baseline/art-sphere-step3 baseline/wip
```

Then **look at `idle`, `hover` and `fired-cascade` side by side with the reference.** Edges are the most visible thing on the sphere; a wrong gradient direction or a doubled glow is obvious by eye and can still score under threshold. Record the measured mean/max in the commit message.

- [ ] **Step 6: Confirm edge hit-testing still works.** `artSmoke.mjs` covers node hits but not edges. Add a check that hovering the midpoint between two connected nodes reports an edge, and that it still does after this change.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/art/SphereEdges.jsx src/terminal/art/SphereComposite.jsx src/terminal/views/ArtTab.jsx scripts/artSmoke.mjs
git commit -m "feat(art): move the sphere edges to the GPU"
```

---

### Task 4: pulse rings

**Files:**
- Modify: `src/terminal/art/SphereEdges.jsx`, `src/terminal/views/ArtTab.jsx` (delete `:1096-1107`)

The travelling disc on each pulsing edge. These are discs, not lines, so reuse the ghost-trail approach: a second instanced quad, or an extra loop in the backdrop shader. Prefer the instanced quad — pulses are sparse and a per-pixel loop over all edges is waste.

- [ ] **Step 1:** Add a `pulses` section to the published buffer: `x, y, radius, r, g, b, alpha` per active pulse, count published separately.
- [ ] **Step 2:** Render as instanced quads with a circular coverage falloff, same blend settings as Task 3.
- [ ] **Step 3:** Delete the 2D block.
- [ ] **Step 4:** Gate. Pulses fire on cascades, so `fired-cascade` is the state that shows them — check it specifically, and check the *sign* of its difference.
- [ ] **Step 5:** Commit with the measured numbers.

---

### Task 5: the resonance edge

**Files:**
- Modify: `src/terminal/art/SphereEdges.jsx`, `src/terminal/views/ArtTab.jsx` (delete `:1110-1152`), `scripts/artPresence.mjs`

**This layer is invisible to the parity gate.** It needs resonance armed and two nodes shift-clicked, which no capture state does. A green run proves nothing about it.

- [ ] **Step 1:** Publish its state (endpoints, similarity, glow) and render it as one more instance with a larger glow — `resonanceGlow(sim)` reaches 28, twice the base edges' maximum.
- [ ] **Step 2:** Delete the 2D block.
- [ ] **Step 3: Add a presence check** to `scripts/artPresence.mjs`. Arm resonance, shift-click two nodes found by the existing hover-grid probe, and measure. **Compute the expected signal magnitude before choosing the metric** — a mean over the sphere disc was 65× too coarse for the ghost trails and reported a working layer as broken.
- [ ] **Step 4:** Gate, run the presence suite, commit with both results.

---

### Task 6: prism geometry chords

**Files:**
- Modify: `src/terminal/art/SphereEdges.jsx`, `src/terminal/views/ArtTab.jsx` (delete `:1153-1230`), `scripts/artPresence.mjs`

Also invisible to the gate — command-triggered. Same treatment as Task 5.

- [ ] **Step 1:** Publish the chord bundle (every pair among the prism's nodes) into the same instanced buffer; these are ordinary line segments with their own colour and `lighter` blending.
- [ ] **Step 2:** `lighter` is **additive**: use `blendSrc: THREE.SrcAlphaFactor`, `blendDst: THREE.OneFactor`, in the same sRGB target. Do not reuse the source-over material — a wrong blend factor here produces an identical GL call log and visibly different output.
- [ ] **Step 3:** Delete the 2D block.
- [ ] **Step 4:** Add a presence check that issues the triggering command and measures the chord bundle.
- [ ] **Step 5:** Gate, presence suite, commit.

---

### Task 7: verify, measure, record

- [ ] **Confirm `ctx.shadowBlur` is gone from the draw loop.** `grep -n "shadowBlur" src/terminal/views/ArtTab.jsx` must return only the copy string at `:2937`. If any remain in the loop, a layer was missed.
- [ ] **Full interaction smoke test:** `node scripts/artSmoke.mjs` — 9/9 plus the new edge-hover check.
- [ ] **Full presence suite:** `node scripts/artPresence.mjs` — 6/6 with the two new checks.
- [ ] **Frame time**, headed on the real GPU:

```bash
node scripts/artFrameTime.mjs --seconds 10 --out baseline/art-sphere-step4
```

Compare against step 3's idle p50 2.1 ms / p95 11.9 ms / p99 15.4 ms. Edges are the heaviest remaining 2D work, so this should fall. **If it does not, say so plainly rather than explaining it away** — and note that a second render target costs a full-screen write per frame, which is a real cost this step adds.

- [ ] **Capture the step-4 reference.** `artBaseline.mjs` pins a boot fingerprint per manifest, so capture to `baseline/art-sphere-step4` fresh; do not try to overwrite step 3's.
- [ ] **Record** in `baseline/art-sphere-step4/README.md`, the spec's Step 4 section, and `.superpowers/sdd/progress.md`: the comparator table, the cost delta, which layers the gate could not see and how each was verified instead, and anything this plan got wrong.
- [ ] **Line count.** `wc -l src/terminal/views/ArtTab.jsx` — 3185 now. Three substantial blocks (~270 lines) leave in this step, so unlike step 3 this one **should** fall. If it does not, the layers were copied rather than moved.

---

## Self-review notes

- **Spec coverage.** §5 Step 4 requires edges, the resonance edge and prism chords on line geometry with per-vertex colour and real additive glow (Tasks 3–6), `ctx.shadowBlur` retired (Task 7), and the CPU depth sort kept for parity (Task 3 Step 4). §6 verification: pixel comparison per task, interaction smoke test (Task 7). §3.1: hit-testing untouched (Global Constraints, Task 3 Step 6).
- **Deliberately not covered.** Nodes (step 5), particles and the trail feedback buffer (step 6).
- **Risk 1 — the second render target.** It adds a full-screen write per frame. If Task 7 measures a regression, the fallback is to fold the backdrop shader back into the screen pass and render edges into the *same* target as a second draw, which needs the composite to sample its own output and is harder. Measure before optimising.
- **Risk 2 — glow model.** `ctx.shadowBlur` is a real gaussian; `exp(-d/g)` is not. The base edges' glow is small (6–14 px) and mostly reads as thickness, but the resonance edge reaches 28 px where the difference will show. Expect to tune the `0.5` shoulder coefficient against the PNGs, and record the value chosen.
- **Risk 3 — dashes.** Canvas dashes are measured in path length from the path start; the shader measures `t * lineLen` from endpoint A. These agree for a straight two-point path, which is all of these are. If a dashed edge ever becomes a polyline, this breaks.
