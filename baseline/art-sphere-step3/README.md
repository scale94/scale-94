# /art sphere — step 3 reference (GL backdrop, 2 of 6 layers migrated)

Captured on `fix/art-sphere-index-space` with the composite pipeline in place
and the wireframe ghost + ambient beat pulse rendering on the GPU.

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-step3 baseline/<name>
```

## What changed since step 2

The 2D canvas no longer paints a backdrop. Its clear is a `destination-out`
alpha erase, and the colour every faded pixel resolves to is drawn on the GPU
beneath it. Two of the six background layers have moved.

**Status: 2 of 6 layers migrated.** Still in the 2D loop: exergy pulse, genesis
glow, state flash grid, spectral ambient, temporal ghost trails.

## The gate now reads the SCREENSHOT, not the canvas

This is the single most important change in the harness, and it invalidates any
comparison run with the old comparator.

The signature used to be computed in-page from the 2D canvas's `getImageData`,
summing R, G and B **with no alpha term**. That was correct while the canvas was
opaque and therefore *was* the whole picture. It stopped being correct the
moment the clear became an alpha erase: `getImageData` returns *straight*
colour, so a pixel faded to invisibility keeps its full-brightness RGB and only
loses alpha. The gate read invisible trails as if they were lit.

Measured: it reported **mean 6.3 / max 129** on a change that is provably
identity. It also cannot see a GL layer at all, at any threshold.

`scripts/artCompare.mjs` now decodes the composited screenshot both capture sets
already write, via `scripts/_png.mjs` (dependency-free, Node's zlib). Older
baselines stay comparable without re-capture — their PNGs are committed
alongside their manifests. Self-comparison verified at exactly 0.

Threshold is still **4.0** on a 32×18 mean-luminance signature.

## The trap that passed the gate

The obvious build — a backdrop mesh under a `transparent` 2D quad — is wrong,
and wrong in a way that *passes*.

The 2D canvas composites its trail fade in **sRGB** byte space. A GL alpha blend
of a texture tagged `SRGBColorSpace` happens in three.js's **linear** working
space, because the sampler decodes first. Fading in linear is systematically
brighter: **+1.0 mean over the frame, individual cells nearly doubling
(25.5 → 49.3)**, confined to the sphere disc. It scored 1.285 against a
threshold of 4 — a comfortable pass on a visibly wrong image.

So the composite is one shader that blends in sRGB and converts the finished
pixel to linear on the way out. With an opaque canvas it reduces exactly to what
step 2's `meshBasicMaterial` wrote, so bloom is untouched. It carries no blend
state at all, which retires the `premultipliedAlpha` trap the spec warns about.

**Read this before trusting a green run.** A tolerance gate answers "did
anything move", never "is it right".

## Layers this gate cannot see

Three of the six migrations cannot be validated by the capture set, because the
layer is inactive in all 21 states. A pass proves *no regression* only — the
identical pass would follow from deleting the layer outright.

| Layer | Why it is invisible in capture |
|---|---|
| ambient beat pulse | beat clock starts from the ambient-mode button, never pressed |
| state flash grid | fires on bifurcation events only |
| exergy pulse | ecocide bus at rate 0 |
| genesis glow | settled by capture time |

Each therefore needs a **separate presence check** in a real browser. The beat
pulse was verified by peak amber-ness in the annulus between 0.6× and 1.25×
`sphereR`, ambient off vs on, across two beats at 114 BPM: **2.840 → 8.850**.

The wireframe ghost is visible but faint (alpha 0.03), too faint for the gate to
distinguish "ported" from "deleted". Verified by scanning the centre row for the
ring crossing at `cx ± sphereR`: **peak 8.0 over background 3.0 in both**
captures, right crossing identical.

## Known-bad state

`immersive-off` is a blank canvas with only DOM labels and proves nothing.
`immersive-on` runs at mean ~1.6 with balanced ±cells — moved particles, the
documented noise floor, not a layer. **Pre-existing.**

## Cost

Headed Chrome, real GPU, `scripts/artFrameTime.mjs --seconds 10`:

| idle draw cost | step 2 | step 3 (2 layers) |
|---|---|---|
| p50 | 2.6 ms | **2.4 ms** |
| p95 | 12.5 ms | **11.8 ms** |
| p99 | 18.1 ms | **14.9 ms** |

**p99 is back under the 16.7 ms frame budget**, which it crossed at step 2. Two
layers leaving the 2D loop bought 3.2 ms at the tail.

## A plan heuristic that does not work yet

The plan gates on `ArtTab.jsx` shrinking. It is **3144 lines, unchanged** — the
diff is exactly 32 insertions / 32 deletions.

That is not the failure the plan predicted ("the layers were copied rather than
moved"). Verified: no `ctx.ellipse` remains, and no beat gradient. Each
migration trades ~15 lines of drawing for ~5 lines of state-publishing plus a
signpost comment saying where the layer went. The count will only fall once the
larger layers move. Judge it at the end of step 3, not per commit.
