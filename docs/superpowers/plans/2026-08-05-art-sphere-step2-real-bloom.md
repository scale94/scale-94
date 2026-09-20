# Art Sphere Step 2 — Real Bloom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake `filter: blur()` bloom on the /art sphere with real GPU bright-extract bloom, by mounting a react-three-fiber `<Canvas>` above the existing 2D canvas that takes the 2D output as a texture and runs it through `EffectComposer`.

**Architecture:** The 3130-line 2D draw loop is not restructured. A new `<SphereComposite>` overlay sits inside the existing container, absolutely positioned over the 2D canvas, with `pointer-events: none` so every interaction still lands on the 2D canvas. It renders one fullscreen quad textured with a single reused `THREE.CanvasTexture` wrapping the 2D canvas element, then applies bloom (always on) and vignette (immersive only). The GL canvas is driven with `frameloop="never"` and advanced from the tail of the existing 2D draw loop, so the composite always shows the frame that was just drawn rather than the previous one.

**Tech Stack:** react-three-fiber 9.5, three 0.183, @react-three/postprocessing 3.0.4, Vitest 4, headless Chrome over CDP via `scripts/cdp.mjs`.

## Global Constraints

- **Projection, depth sort and hit-testing stay on the CPU.** Moving projection into a vertex shader renders fine while every mouse, touch, resonance and fusion interaction silently dies. This is the invariant that makes an incremental migration safe.
- **Faithful parity first, locked as a fallback, then push.** Do not re-art.
- **Bloom always on.** Vignette stays gated to immersive, where it lives today.
- **Every migrated layer becomes its own module under `src/terminal/art/`** so `ArtTab.jsx` shrinks as work proceeds.
- **Never run vitest with `-u` / `--update`.**
- **Do not push.** `main` is already 19 commits ahead of origin; the author decides.
- **The stack is react-three-fiber**, already a dependency — not `src/terminal/gl/`.
- Gates that must stay green: `npx vitest run` (currently 968 tests / 105 files), `npm run lint` (0 errors; warnings ratchet at 153, currently 145), `npm run build`.
- `ArtTab.jsx` **cannot** be mounted in jsdom (~25 imports, ten hooks, WASM, IndexedDB, websockets, no `canvas` package). Unit tests cover extracted pure modules only and are **not** parity evidence.

## Baseline this plan is measured against

`baseline/art-sphere-2d/` on commit `9f6cc71`, captured before any WebGL exists. Read `baseline/art-sphere-2d/README.md` first — it documents three ways the capture rig can look reproducible without being reproducible.

Numbers to beat, headed on the real GPU at 1520×900 (sphere 1446×580):

| | p50 | p95 | p99 | max |
|---|---|---|---|---|
| idle — draw cost | 1.5 ms | 11.2 ms | 14.7 ms | 18.7 ms |
| drag — draw cost | 1.6 ms | 11.2 ms | 13.5 ms | 17.2 ms |

**The tail is the target, not the median.** Step 2 is not expected to reduce these — it *adds* GPU work. What step 2 must prove is that the added cost is small and that the p95 does not get worse. Steps 4–6 are what move the tail.

---

## The step-2 parity gate, stated precisely

This is the strongest gate in the whole migration and it must be used.

Step 2 does not change what the 2D draw loop paints for any non-immersive state. So:

- There are 21 captured states: 7 states × 3 scales. For **18 of them** the 2D canvas hash in `baseline/art-sphere-2d/manifest.json` must stay **byte-identical**. Any change means step 2 perturbed the 2D layer, which it must not.
- The **3 `immersive-on` states** (one per scale) **will** change, and must, because Task 3 deletes the fake `filter: blur()` bloom and the 2D radial-gradient vignette from the draw loop. That deletion is the entire point of the step.
- The **screenshots** for every state legitimately change, because bloom is now real and always on. They are compared by eye, not by hash.

Do not weaken this gate by regenerating the baseline. The baseline is the reference; step 2 is what gets judged.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/art/artComposite.js` | **Create.** Pure module. The DPR cap shared with the 2D canvas, the layer z-order and pointer-events contract, and the bloom/vignette parameter sets. No three.js import — this is the part that can be unit-tested. |
| `src/terminal/art/__tests__/artComposite.test.js` | **Create.** Unit tests for the above. |
| `src/terminal/art/SphereComposite.jsx` | **Create.** The r3f overlay: `<Canvas>`, the textured fullscreen quad, `EffectComposer`. Imports its numbers from `artComposite.js`. Cannot be jsdom-tested; verified in the browser at Task 4. |
| `src/terminal/views/ArtTab.jsx` | **Modify.** Mount `<SphereComposite>`, delete the fake bloom + vignette block, advance the GL canvas from the draw loop tail. |
| `baseline/art-sphere-2d/README.md` | **Modify.** Correct the step-2 gate wording (see Task 6). |
| `.superpowers/sdd/progress.md` | **Modify.** Record step 2. |

---

### Task 1: `artComposite.js` — the pure numbers and the layer contract

Everything in step 2 that can be tested without a GPU lives here. Most importantly the **pointer-events and z-order contract**, which is the step-2 form of the global "hit-testing stays on the CPU" invariant: if the GL overlay ever becomes clickable, every interaction on the sphere dies silently while the render still looks perfect.

**Files:**
- Create: `src/terminal/art/artComposite.js`
- Test: `src/terminal/art/__tests__/artComposite.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `compositeDpr(devicePixelRatio: number) => number` — the DPR the GL canvas must use.
  - `LAYER_Z: { canvas2d: 0, composite: 1, labels: 2, tooltip: 20 }`
  - `COMPOSITE_STYLE: object` — inline style for the GL overlay wrapper.
  - `BLOOM: { luminanceThreshold, luminanceSmoothing, intensity, mipmapBlur, radius }`
  - `VIGNETTE: { offset, darkness }`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/art/__tests__/artComposite.test.js`:

```js
// artComposite.test.js — the parts of the GL composite that do not need a GPU.
//
// The pointer-events contract is the one that matters. The GL overlay covers
// the 2D canvas completely; if it ever accepts pointer events, every hover,
// click, shift-click resonance, long-press fusion and drag on the sphere stops
// working while the render still looks perfect. That failure mode is invisible
// in a screenshot, so it gets a unit test instead.

import { describe, it, expect } from 'vitest';
import {
  compositeDpr, LAYER_Z, COMPOSITE_STYLE, BLOOM, VIGNETTE,
} from '../artComposite';

describe('compositeDpr', () => {
  it('matches the 2D canvas cap of 1.5 so the composite is texel-for-texel', () => {
    // ArtTab's ResizeObserver uses Math.min(devicePixelRatio, 1.5). If the GL
    // canvas picked a different DPR the quad would resample the 2D output.
    expect(compositeDpr(1)).toBe(1);
    expect(compositeDpr(1.5)).toBe(1.5);
    expect(compositeDpr(2)).toBe(1.5);
    expect(compositeDpr(3)).toBe(1.5);
  });

  it('never returns 0 or a negative for a missing or absurd devicePixelRatio', () => {
    expect(compositeDpr(0)).toBe(1);
    expect(compositeDpr(-2)).toBe(1);
    expect(compositeDpr(undefined)).toBe(1);
    expect(compositeDpr(NaN)).toBe(1);
  });
});

describe('layer contract', () => {
  it('stacks 2D canvas under composite under labels under tooltip', () => {
    expect(LAYER_Z.canvas2d).toBeLessThan(LAYER_Z.composite);
    expect(LAYER_Z.composite).toBeLessThan(LAYER_Z.labels);
    expect(LAYER_Z.labels).toBeLessThan(LAYER_Z.tooltip);
  });

  it('makes the GL overlay transparent to pointer events', () => {
    expect(COMPOSITE_STYLE.pointerEvents).toBe('none');
  });

  it('covers the container exactly so the quad is 1:1 with the 2D canvas', () => {
    expect(COMPOSITE_STYLE.position).toBe('absolute');
    expect(COMPOSITE_STYLE.inset).toBe(0);
  });

  it('sits at the composite layer', () => {
    expect(COMPOSITE_STYLE.zIndex).toBe(LAYER_Z.composite);
  });
});

describe('effect parameters', () => {
  it('extracts only bright pixels rather than blooming the whole frame', () => {
    // The old fake bloom blurred everything at 0.15 alpha, which is why it read
    // as a smear. Real bright-extract needs a threshold above the background.
    expect(BLOOM.luminanceThreshold).toBeGreaterThan(0);
    expect(BLOOM.luminanceThreshold).toBeLessThan(1);
    expect(BLOOM.intensity).toBeGreaterThan(0);
    expect(BLOOM.mipmapBlur).toBe(true);
  });

  it('keeps the vignette darkness below fully opaque', () => {
    expect(VIGNETTE.darkness).toBeGreaterThan(0);
    expect(VIGNETTE.darkness).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/terminal/art/__tests__/artComposite.test.js
```

Expected: FAIL — `Failed to resolve import "../artComposite"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/terminal/art/artComposite.js`:

```js
// artComposite.js — numbers and layer contract for the GL bloom composite.
//
// Kept free of three.js imports so it can be unit-tested: ArtTab itself cannot
// be mounted in jsdom, so anything testable has to live outside it.

// The 2D canvas caps its backing store at 1.5x (ArtTab's ResizeObserver). The
// GL canvas must use the same number or the fullscreen quad resamples the 2D
// output instead of presenting it texel-for-texel.
export const DPR_CAP = 1.5;

export function compositeDpr(devicePixelRatio) {
  const dpr = Number(devicePixelRatio);
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(dpr, DPR_CAP);
}

// Stacking order inside the sphere container. The GL overlay covers the 2D
// canvas; the DOM labels must stay above it, so labels do not feed the bloom.
export const LAYER_Z = {
  canvas2d: 0,
  composite: 1,
  labels: 2,
  tooltip: 20,
};

// pointerEvents:'none' is load-bearing, not cosmetic — see artComposite.test.js.
export const COMPOSITE_STYLE = {
  position: 'absolute',
  inset: 0,
  zIndex: LAYER_Z.composite,
  pointerEvents: 'none',
};

// Bright-extract bloom, always on. Threshold sits above the sphere's dim
// structural lines (edges, wireframe ghost) so only nodes, particles and fire
// cascades bloom — the old fake bloom blurred everything at 0.15 alpha, which
// is exactly why it read as a smear rather than as light.
export const BLOOM = {
  luminanceThreshold: 0.28,
  luminanceSmoothing: 0.9,
  intensity: 1.1,
  mipmapBlur: true,
  radius: 0.7,
};

// Immersive only. Replaces the 2D radial-gradient vignette, which ran to
// rgba(0,0,0,0.65) at the corners.
export const VIGNETTE = {
  offset: 0.32,
  darkness: 0.65,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/terminal/art/__tests__/artComposite.test.js
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/artComposite.js src/terminal/art/__tests__/artComposite.test.js
git commit -m "feat(art): add artComposite — layer contract and bloom parameters"
```

---

### Task 2: `SphereComposite.jsx` — the r3f overlay

**Files:**
- Create: `src/terminal/art/SphereComposite.jsx`

**Interfaces:**
- Consumes: `compositeDpr`, `COMPOSITE_STYLE`, `BLOOM`, `VIGNETTE` from `../art/artComposite`.
- Produces: default export `SphereComposite({ sourceRef, immersive, onAdvanceReady })`.
  - `sourceRef: React.RefObject<HTMLCanvasElement>` — the existing 2D canvas.
  - `immersive: boolean` — gates the vignette.
  - `onAdvanceReady: (advance: ((t: number) => void) | null) => void` — called once with r3f's `advance` when the GL root is created, and with `null` on unmount. ArtTab calls it from the tail of its draw loop.

There is no unit test for this task. It needs a GPU and a mounted `ArtTab`, and it is verified in the browser at Task 4. Do not write a jsdom test that mocks three.js — it would assert that the mock works.

- [ ] **Step 1: Write the component**

Create `src/terminal/art/SphereComposite.jsx`:

```jsx
// SphereComposite.jsx — real bloom for the sphere.
//
// Sits ABOVE the 2D canvas, takes its output as a texture on a fullscreen quad,
// and runs bright-extract bloom (always) plus vignette (immersive only). The 2D
// draw loop is not restructured: this is a post-process, not a port.
//
// Three things here are load-bearing:
//
// 1. pointer-events:none on the wrapper. This overlay completely covers the 2D
//    canvas, which is where every hover, click, resonance, fusion and drag is
//    hit-tested. If it ever accepts pointer events the sphere still renders
//    perfectly and every interaction dies silently.
//
// 2. ONE CanvasTexture, created once and marked needsUpdate each frame. A new
//    texture per frame would allocate and re-upload a full GPU texture 60x a
//    second and leak until GC.
//
// 3. frameloop="never" plus advance() called from the tail of ArtTab's draw
//    loop. r3f's own rAF loop is independent of ArtTab's, so with the default
//    frameloop the composite shows whichever 2D frame happened to finish last —
//    a one-frame lag that gets worse under load. Driving it from the 2D loop
//    guarantees we composite the frame that was just drawn.

import { useMemo, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { compositeDpr, COMPOSITE_STYLE, BLOOM, VIGNETTE } from './artComposite';

// The fullscreen quad. An orthographic camera in r3f is sized in pixels, so a
// plane matching the viewport in pixels fills it exactly with no camera maths.
function SourceQuad({ sourceRef }) {
  const size = useThree(s => s.size);

  const texture = useMemo(() => {
    const el = sourceRef.current;
    if (!el) return null;
    const t = new THREE.CanvasTexture(el);
    t.minFilter = THREE.LinearFilter;      // no mipmaps: the quad is 1:1
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;   // the 2D canvas is sRGB
    return t;
  }, [sourceRef]);

  useEffect(() => () => texture?.dispose(), [texture]);

  // Re-upload the 2D canvas each rendered frame. This is the whole cost of the
  // composite and Task 5 measures it.
  useFrame(() => { if (texture) texture.needsUpdate = true; });

  if (!texture) return null;

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[size.width, size.height]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}       {/* present the 2D colours unchanged */}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// Hands r3f's advance() out to ArtTab. Must live inside <Canvas> to read the store.
function AdvanceBridge({ onAdvanceReady }) {
  const advance = useThree(s => s.advance);
  useEffect(() => {
    onAdvanceReady?.(advance);
    return () => onAdvanceReady?.(null);
  }, [advance, onAdvanceReady]);
  return null;
}

export default function SphereComposite({ sourceRef, immersive, onAdvanceReady }) {
  const dpr = useRef(compositeDpr(typeof window !== 'undefined' ? window.devicePixelRatio : 1)).current;

  return (
    <div style={COMPOSITE_STYLE} aria-hidden="true">
      <Canvas
        frameloop="never"
        dpr={dpr}
        orthographic
        camera={{ position: [0, 0, 1], near: 0.1, far: 10 }}
        gl={{
          alpha: false,
          antialias: false,
          // Called out in the spec's own traps: a wrong premultipliedAlpha
          // produces an identical GL call log with visibly different output,
          // which is why this migration is gated on pixels and not call logs.
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <AdvanceBridge onAdvanceReady={onAdvanceReady} />
        <SourceQuad sourceRef={sourceRef} />
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={BLOOM.luminanceThreshold}
            luminanceSmoothing={BLOOM.luminanceSmoothing}
            intensity={BLOOM.intensity}
            mipmapBlur={BLOOM.mipmapBlur}
            radius={BLOOM.radius}
          />
          {immersive
            ? <Vignette offset={VIGNETTE.offset} darkness={VIGNETTE.darkness} eskil={false} />
            : null}
        </EffectComposer>
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles and nothing regressed**

```bash
npm run build
```

Expected: `✓ built in …`, no errors.

```bash
npx vitest run
```

Expected: 976 tests / 106 files passed — 968 before this plan, plus Task 1's 8.

```bash
npm run lint
```

Expected: `0 errors`. Warnings must not exceed 153.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/art/SphereComposite.jsx
git commit -m "feat(art): add SphereComposite — r3f bloom overlay above the 2D canvas"
```

---

### Task 3: Mount it in ArtTab and delete the fake bloom

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx` — imports, the draw-loop tail, the immersive post-process block at `:1599-1630`, the container JSX at `:2523-2540`.

**Interfaces:**
- Consumes: `SphereComposite` from `../art/SphereComposite`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Add the import**

In the import block near `import SphereLabels from '../art/SphereLabels';`, add:

```jsx
import SphereComposite from '../art/SphereComposite';
```

- [ ] **Step 2: Add the advance ref and its callback**

Next to the other refs (near `const rafRef = useRef(null);`), add:

```jsx
  // r3f's advance(), handed over by SphereComposite once its GL root exists.
  // Null until then, and null again after unmount — the draw loop must not
  // assume the composite is mounted.
  const glAdvanceRef = useRef(null);
  const handleAdvanceReady = useCallback((advance) => {
    glAdvanceRef.current = advance;
  }, []);
```

- [ ] **Step 3: Delete the fake bloom and vignette from the draw loop**

Remove this entire block (currently `ArtTab.jsx:1598-1630`), including the `bloomCanvasRef` usage:

```jsx
      // ── Immersive Mode: bloom post-process + vignette ─────────────────────
      if (immersiveRef.current) {
        // ... the whole block through the vignette fillRect ...
      }
```

Replace it with:

```jsx
      // ── Bloom and vignette ────────────────────────────────────────────────
      // Both now happen on the GPU in SphereComposite, which takes this canvas
      // as a texture. The old version blurred a half-resolution copy with
      // ctx.filter and composited it back at 0.15 alpha, which is why it read
      // as a smear rather than as light. Bloom is now always on; the vignette
      // is still immersive-only.
```

Then delete the now-unused `bloomCanvasRef` declaration. Find it with:

```bash
grep -n "bloomCanvasRef" src/terminal/views/ArtTab.jsx
```

Expected after deletion: no matches.

- [ ] **Step 4: Advance the GL canvas from the draw-loop tail**

The draw loop's `try` block ends with the label handoff. Immediately **after** the `catch`, and still inside `draw`, add the advance call:

```jsx
      // ── Hand this frame's labels to the DOM overlay ───────────────────────
      labelsApiRef.current?.update(nextLabels);
      } catch (err) {
        console.error('[ArtTab] draw error (loop continues):', err);
      }

      // ── Composite ─────────────────────────────────────────────────────────
      // Outside the try on purpose: if the 2D draw threw part-way, we still
      // want the GL layer to present whatever did get drawn, exactly as the
      // browser would have. Inside the try it would be skipped along with
      // everything else after the throw.
      try {
        glAdvanceRef.current?.(performance.now());
      } catch (err) {
        console.error('[ArtTab] composite advance failed:', err);
      }
    };
```

- [ ] **Step 5: Mount the overlay and fix the layer order**

In the container JSX, the 2D canvas and `<SphereLabels>` are siblings. Insert `<SphereComposite>` between them and give the canvas and labels explicit stacking so the labels stay on top of the bloom.

Change the canvas's `style` to add `position: 'relative', zIndex: 0`:

```jsx
        <canvas
          ref={canvasRef}
          width={900}
          height={620}
          style={{
            display: 'block', width: '100%', height: 'auto',
            cursor: 'grab', touchAction: 'none',
            position: 'relative', zIndex: 0,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
        />

        <SphereComposite
          sourceRef={canvasRef}
          immersive={immersive}
          onAdvanceReady={handleAdvanceReady}
        />

        <SphereLabels ref={labelsApiRef} />
```

Then in `src/terminal/art/SphereLabels.jsx`, add `zIndex: 2` to the host div's style so it sits above the composite:

```jsx
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        pointerEvents: 'none', userSelect: 'none',
        zIndex: 2,
      }}
```

- [ ] **Step 6: Run the gates**

```bash
npx vitest run
```

Expected: all pass, count unchanged from Task 2.

```bash
npm run lint
```

Expected: `0 errors`, warnings ≤ 153.

```bash
npm run build
```

Expected: `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/ArtTab.jsx src/terminal/art/SphereLabels.jsx
git commit -m "feat(art): mount the GL bloom composite, delete the ctx.filter fake"
```

---

### Task 4: Browser verification and the parity gate

Unit tests cannot see pixels. This is the task that decides whether step 2 worked.

**Files:**
- No source changes expected. If this task finds defects, fix them and re-run the whole task.

- [ ] **Step 1: Start the dev server**

Use the preview tooling, never a bare shell — `preview_start` with the `scale94-dev` configuration (port 5174). Do not run a dev server with `bash`.

- [ ] **Step 2: Confirm the composite actually mounted and is not eating input**

```bash
node scripts/artFrameTime.mjs --seconds 2
```

This boots /art through CDP. Before trusting anything else, check in that same session that there are now **two** canvases in the sphere container and that the GL one is pointer-transparent. Write a throwaway probe using `scripts/cdp.mjs`:

```js
import { launch } from './scripts/cdp.mjs';
const page = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900 });
// ... navigate to /CHAOS (nav label is "/CHAOS", not "/ART") ...
console.log(await page.eval(`(() => {
  const host = document.querySelector('canvas').parentElement;
  const cs = [...host.querySelectorAll('canvas')];
  const top = document.elementFromPoint(760, 600);
  return {
    canvasCount: cs.length,
    contexts: cs.map(c => c.getContext('webgl2') ? 'gl' : '2d'),
    elementAtSphereCentre: top && top.tagName + ':' + (top.getContext?.('webgl2') ? 'gl' : '2d'),
  };
})()`));
await page.close();
```

Expected: `canvasCount: 2`, and `elementAtSphereCentre` must resolve to the **2D** canvas. If it resolves to the GL canvas, `pointer-events: none` is not applied and every interaction is dead — stop and fix before going further.

- [ ] **Step 3: Run the parity gate**

```bash
node scripts/artBaseline.mjs --out baseline/art-sphere-step2
```

Then compare the 2D canvas hashes against the reference:

```bash
node -e "
const a=require('./baseline/art-sphere-2d/manifest.json');
const b=require('./baseline/art-sphere-step2/manifest.json');
let bad=0;
for (const s of Object.keys(a.scales)) {
  for (const st of Object.keys(a.scales[s].shots)) {
    const x=a.scales[s].shots[st].canvasHash, y=b.scales[s].shots[st].canvasHash;
    const expectChange = st==='immersive-on';
    const changed = x!==y;
    if (changed!==expectChange) { bad++; console.log('FAIL', s, st, x, '->', y, expectChange?'(expected a change)':'(expected NO change)'); }
  }
}
console.log(bad? bad+' MISMATCHES' : 'GATE PASSED: 18 states byte-identical, 3 immersive-on states changed as designed');
"
```

Expected: `GATE PASSED`.

If a non-immersive state changed, step 2 perturbed the 2D layer. Find out why before continuing — do **not** regenerate the reference baseline.

- [ ] **Step 4: Look at the render**

Open `baseline/art-sphere-step2/laptop-1520x900@1x__idle.png` and the matching `baseline/art-sphere-2d/…` reference side by side, and do the same for `fired-cascade` and `immersive-on`.

What you are looking for, per the spec's acceptance criterion: **real light bleed where the old bloom showed a smear.** Bright nodes and fire cascades should throw light into the surrounding black; dim structural lines (edges, wireframe ghost) should not glow. If the whole frame has lifted in brightness, `BLOOM.luminanceThreshold` is too low.

Do not skip this by reading a pixel statistic. A violet-pixel count on this project once read *higher* before a fix than after.

- [ ] **Step 5: Interaction smoke test**

Every interaction path, because §3.1 is an invariant and invariants need proving. Drive them through `scripts/cdp.mjs` against the running server: hover a node (tooltip appears), click a node (cascade fires), shift-click two nodes with resonance armed, **touch long-press a node** (`page.enableTouch()` then `page.longPress(x, y, 750)` — the fusion ring must appear and the sphere must keep animating), drag to rotate, and toggle immersive on and off.

Confirm zero uncaught errors throughout:

```js
console.log(await page.eval('window.__errs ? window.__errs.length : 0'));
```

Note the trap that cost time during the Task 0 fix: **the sphere rotates**, so node coordinates found by a hover sweep go stale within seconds. Confirm a node is under the point immediately before pressing it, or you will "verify" a code path you never reached.

- [ ] **Step 6: Commit the step-2 capture**

```bash
git add baseline/art-sphere-step2
git commit -m "test(art): capture step-2 composite states, 2D parity gate passed"
```

---

### Task 5: Measure the texture upload — do not assume it

The spec is explicit: **measure, do not assume**, the per-frame canvas→texture upload. This task produces the number.

**Files:**
- Modify: `baseline/art-sphere-2d/README.md` (Task 6 does the writing; this task produces the data).

- [ ] **Step 1: Measure with the composite mounted**

```bash
node scripts/artFrameTime.mjs --seconds 10
```

`drawCost` now includes the `advance()` call, because Task 3 put it at the tail of the same rAF callback. So the delta against the reference **is** the composite's full cost — upload plus quad plus bloom.

Record p50/p95/p99 for idle and drag, and compare against:

| | p50 | p95 | p99 |
|---|---|---|---|
| idle (reference) | 1.5 ms | 11.2 ms | 14.7 ms |
| drag (reference) | 1.6 ms | 11.2 ms | 13.5 ms |

- [ ] **Step 2: Isolate the upload from the bloom**

The composite has two costs and they respond to different fixes. Temporarily comment out the `<EffectComposer>` block in `SphereComposite.jsx`, re-run the same command, and record the numbers again. Three figures result: reference, quad-only, quad+bloom. Restore the composer afterwards and confirm with `git diff` that nothing is left commented out.

- [ ] **Step 3: Decide about DPR, with the number in hand**

The spec suggests capping the 2D backing store's DPR if upload is material. **That cap already exists and is already at 1.5×** — `ArtTab.jsx:565` uses `Math.min(window.devicePixelRatio || 1, 1.5)`, which the baseline confirms: at DPR 2 the backing store is 2169×870, exactly 1446×580 × 1.5. So this lever is mostly already spent, and the plan does not assume it is available.

Judge against these thresholds:

- Composite adds **< 1 ms at p95** on the projector scale: done, change nothing.
- Composite adds **1–3 ms at p95**: acceptable for step 2, but record it — steps 4–6 remove far more than that from the 2D side.
- Composite adds **> 3 ms at p95**, or the projector p99 crosses 16.7 ms: stop and report to the author before proceeding to step 3. The options are lowering `DPR_CAP` in `artComposite.js` to 1.25 (which then also needs lowering in `ArtTab.jsx:565` to stay texel-for-texel — they are one number in two places and Task 6 records that), or dropping `mipmapBlur`. Do not pick one unilaterally; this is an aesthetic tradeoff.

- [ ] **Step 4: Commit the measurement**

```bash
git add baseline/art-sphere-2d/frametime-headed-gpu.json baseline/art-sphere-step2
git commit -m "test(art): measure the composite's per-frame cost against the baseline"
```

---

### Task 6: Record what happened

**Files:**
- Modify: `baseline/art-sphere-2d/README.md`
- Modify: `.superpowers/sdd/progress.md`
- Modify: `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md`

- [ ] **Step 1: Confirm the baseline README's step-2 gate still describes what shipped**

The README's "How to use it at each step" section already states the 18/3 split, corrected when this plan was written. Re-read it against what was actually built. If Task 3 ended up touching the 2D draw loop anywhere beyond deleting the 33-line immersive post-process block, that section is now wrong and must be updated to say so plainly rather than quietly widening the tolerance.

- [ ] **Step 2: Record the DPR coupling**

Add to the same README, under a new `## Coupled constants` heading:

```markdown
`DPR_CAP` in `src/terminal/art/artComposite.js` and the `1.5` in
`src/terminal/views/ArtTab.jsx`'s ResizeObserver are the same number in two
places. If they diverge, the fullscreen quad resamples the 2D output instead
of presenting it texel-for-texel, which shows up as a soft, slightly blurred
sphere that is easy to mistake for the bloom being too wide.
```

- [ ] **Step 3: Record the measured cost**

Add the three figures from Task 5 (reference, quad-only, quad+bloom) to the README's frame-budget section, with the scale and renderer stated. State plainly whether step 2 got more expensive and by how much. Do not round a regression away.

- [ ] **Step 4: Update the spec's step-2 section**

In `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md`, mark Step 2 as done and correct two things the implementation settled:

- the DPR cap already existed at 1.5× before step 2, so "cap the 2-D backing store's DPR" is not an available first optimisation;
- loop reconciliation (§3.2) started here in inverted form — the 2D loop drives the GL canvas via `frameloop="never"` + `advance()`, rather than `useFrame` becoming the clock. §3.2's direction is still the destination for step 6.

- [ ] **Step 5: Update the SDD ledger**

Append a step-2 entry to `.superpowers/sdd/progress.md` recording: the gate result from Task 4 Step 3, the measured cost from Task 5, any defect found in the browser that the unit tests missed, and the open aesthetic question below.

- [ ] **Step 6: Commit**

```bash
git add baseline/art-sphere-2d/README.md .superpowers/sdd/progress.md docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md
git commit -m "docs(art): record step 2 — real bloom, measured cost, corrected gate"
```

---

## Open question for the author, to be raised after Task 4, not before

The migration's one known open aesthetic item comes due at exactly this step:

> Labels now sit above bloom + vignette and no longer feed the bloom, so immersive edge labels read brighter than before.

Do not pre-empt it with a code change. It could only be judged against real bloom, which is what Task 4 produces. Show the author `immersive-on` from `baseline/art-sphere-2d/` and from `baseline/art-sphere-step2/` side by side and let them call it. If they want labels to bloom, the fix is to move `SphereLabels` inside the composite as a second texture — a real change, and one for a separate step, not a tweak.

---

## Self-review notes

- **Spec coverage.** §5 Step 2 requires: r3f `<Canvas>` above the 2D canvas (Task 3), 2D output as a texture on a fullscreen quad (Task 2), `EffectComposer` bright-extract bloom (Task 2), vignette gated to immersive (Tasks 1–2), draw code not restructured (Task 3 deletes only the 33-line fake post-process), one reused texture object (Task 2), measured upload cost (Task 5), DPR cap decision (Task 5 Step 3), acceptance by side-by-side screenshots and frame time (Tasks 4–5). §6 verification: pixel diffs not call logs (Task 4), headless Chrome over CDP (Task 4), both scales (Task 4 covers three), interaction smoke test including touch (Task 4 Step 5). §8.4 immersive geometry: the overlay is `inset: 0` inside the same container, so it follows the fixed-fullscreen switch automatically — Task 4 Step 5 toggles immersive to prove it.
- **Not covered, deliberately.** §3.2's full loop reconciliation, the `destination-out` clear (spec assigns it to step 3), and the two coexisting trail decays (steps 3–6).
- **Type consistency.** `onAdvanceReady` is named identically in Tasks 2 and 3; `compositeDpr`, `COMPOSITE_STYLE`, `BLOOM`, `VIGNETTE`, `LAYER_Z` and `DPR_CAP` match between Task 1's implementation, Task 1's tests and Task 2's import.
