# /art sphere — step 3 reference (background slice complete)

Captured on `fix/art-sphere-index-space` with the whole background slice on the
GPU. This is the reference **step 4** is measured against.

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-step3 baseline/<name>
```

## What is on the GPU now

The 2D canvas no longer paints a backdrop at all. Its clear is a
`destination-out` alpha erase, and everything beneath it is drawn by one shader
pass. Seven layers, in draw-loop order:

clear tint · exergy pulse · genesis glow · flash grid · spectral ambient ·
wireframe ghost · beat pulse · ghost trails

Still 2D, for step 4 onward: edges, nodes, particles, labels, conductor.

## The gate reads the SCREENSHOT, not the canvas

The signature used to be computed in-page from the 2D canvas's `getImageData`,
summing R, G and B **with no alpha term** — correct only while the canvas was
opaque and therefore *was* the picture. Once the clear became an alpha erase, a
pixel faded to invisibility keeps full-brightness straight RGB and only loses
alpha. Measured: **mean 6.3 / max 129 on a change that is provably identity**.

`scripts/artCompare.mjs` now decodes the composited screenshot both capture sets
already write, via `scripts/_png.mjs` (dependency-free). Older baselines stay
comparable without re-capture — their PNGs are committed. Self-comparison
verified at exactly 0. Threshold **4.0** on a 32×18 mean-luminance signature.

## The trap that PASSED the gate

The obvious build — a backdrop mesh under a `transparent` 2D quad — is wrong in
a way that scores green.

The 2D canvas composites its trail fade in **sRGB** byte space. A GL alpha blend
of a texture tagged `SRGBColorSpace` happens in three.js's **linear** working
space, because the sampler decodes first. Linear-space fading is systematically
brighter: **+1.0 mean over the frame, individual cells nearly doubling
(25.5 → 49.3)**, confined to the sphere disc. It scored **1.285 against a
threshold of 4**.

So the composite is one shader that blends in sRGB and converts the finished
pixel to linear on the way out. With an opaque canvas it reduces exactly to what
step 2's `meshBasicMaterial` wrote, so bloom is untouched — and it carries no
blend state, which retires the `premultipliedAlpha` trap the spec warns about.

**A tolerance gate answers "did anything move", never "is it right".**

## Most of these layers are INVISIBLE to this gate

Five of the seven never draw during a capture. A green 21/21 on them proves *no
regression* — the identical pass follows from deleting the layer outright.

| Layer | Why the capture cannot see it | Presence check |
|---|---|---|
| genesis glow | settled before the first shot | gold lean, during phase 0 vs after: **1.79 → 0.64** |
| exergy pulse | ecocide bus at rate 0 | magenta lean, rate 0 vs 1: **1.27 → 2.79** |
| flash grid | bifurcation events only | far-band luminance, before/after trigger: **2.53 → 2.96** |
| beat pulse | beat clock starts from a button never pressed | amber in the pulse annulus: **2.84 → 8.85** |
| ghost trails | IndexedDB empty in a fresh profile | nearest approach to (180,180,220): **31.3 → 14.1** |

The wireframe ghost *is* drawn every frame but at alpha 0.03 — too faint for the
gate to tell "ported" from "deleted". Checked by scanning the centre row for the
ring crossing at `cx ± sphereR`: **peak 8.0 over background 3.0 in both**.

Spectral ambient is the only one the gate really sees, and even there its ~0.3
peak contribution is the same order as the measured difference, so the **sign**
was checked instead: absence would show as a systematic deficit across
immersive-on; measured **−0.016** and **+0.190**.

Run them all with:

```bash
node scripts/artPresence.mjs
```

## Four ways the ghost-trail check lied

Worth reading before writing another one. Each of these reported "not detected"
against a layer that was working correctly:

1. **Mean blue-lean over the sphere is ~65× too coarse** — the layer contributes
   0.008 against ~0.5 of animation noise.
2. **Pixel-diffing two deterministic runs** drowns in the harness's own
   41k-changed-pixel reproducibility floor.
3. **Seeded positions got back-face culled** — measured rz −1.497 against the
   −0.3 threshold. The layer correctly drew nothing.
4. **`__virtualize()` after ~20s of real rAF** leaves `pump()` unable to advance
   the draw loop at all: two byte-identical screenshots. The ghost check needs
   its own clean page.

`window.__artBgState()` (dev-only) is what ended it — every background layer is
a uniform now rather than a canvas call, so the first question when one does not
appear is whether the state ever reached the shader. Pixels cannot answer that.

## Dev-only harness hooks

All inside `if (!import.meta.env.DEV) return`, so the bundler drops them:

- `__artHarnessReset()` — resets rotation, positions, particles; pins rotation to `rx=0.18, ry=0`
- `__artSetEcocide({ metabolicRift, exergyRate })` — the bus is module-scoped and unreachable otherwise
- `__artSetGhosts(positions?)` — seeds last session's positions; no argument synthesises a ring
- `__artBgState()` — reads back what the draw loop last published

## Cost

Headed Chrome, real GPU, `scripts/artFrameTime.mjs --seconds 10`:

| idle draw cost | step 2 | step 3 |
|---|---|---|
| p50 | 2.6 ms | **2.1 ms** |
| p95 | 12.5 ms | **11.9 ms** |
| p99 | 18.1 ms | **15.4 ms** |

**p99 is back under the 16.7 ms budget** it crossed at step 2. An intermediate
reading at two layers migrated gave p99 14.9; that and 15.4 are within
single-run noise of each other, so the last five layers should not be read as
having made it worse.

## Known-bad states

`immersive-off` is a blank canvas with only DOM labels and proves nothing.
`immersive-on` runs at mean ~1.3–1.7 with balanced ±cells — moved particles, the
documented noise floor, not a layer. **Both pre-existing.**

## Line count

`ArtTab.jsx` is **3185 lines, up from 3144**, and the plan's shrink gate reads
that as "the layers were copied rather than moved". It is not: no 2D drawing
code for any of the seven layers remains (verified). The three dev-only harness
hooks are 68 lines. The draw loop shrank; the file did not. The gate becomes
meaningful again at step 5, when nodes and particles leave.
