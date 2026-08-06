# /art sphere — step 2 reference (real bloom)

Captured on `fix/art-sphere-index-space` with the GL bloom composite live. This
is the reference **step 3** is measured against.

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-step2 baseline/<name>
```

## The gate is a tolerance, not a hash

The earlier harness gated on byte-identical canvas hashes. That worked while the
sphere was pure Canvas2D driven from a frozen clock, and it stopped working the
moment the GL layer had to be captured too.

**The clock cannot be virtualised from page load.** React's scheduler compares
`performance.now()` against a yield deadline; freeze it and a concurrent render
never commits. Measured: r3f's `<Canvas>` ran `configure()` and got a live WebGL
context, but `render(children)` never committed — no `onCreated`, no children,
no `useFrame`. The GL layer stayed blank for an entire capture run and produced
a bloom-free "step 2" reference set that looked completely plausible.

So the shim is now two-phase: the app boots and mounts under **real** timing, and
`__virtualize()` takes over the clock, RNG, timers and rAF afterwards. Two
consequences, both handled:

- rAF loops already in flight at the switch would be lost, so passthrough
  callbacks are wrapped and **migrate** into the virtual queue.
- The simulation carries real-time history into the captured window. ArtTab
  exposes a **dev-only** `window.__artHarnessReset()` (stripped from production
  by `import.meta.env.DEV`) that resets rotation, node positions and particles.

That leaves a small residue — the other simulation hooks (Hopfield field,
morphogenesis, edge state, awakening, conductor) still carry history, and
resetting every one is a large, fragile surface. Measured residue across two
independent full runs:

| | mean abs difference / 255 |
|---|---|
| idle, hover, mid-drag, resonance | 0.000 – 0.025 |
| fired-cascade | up to 0.25 |
| immersive-on | up to 1.6 |

So the noise floor is **under 2**, and the gate threshold is **4.0** — coarse
enough to ignore individual particles, far too fine to miss a layer that failed
to render, shifted, or changed brightness, which moves whole grid cells by tens
of units. The signature is mean luminance over a 32×18 grid.

Each state also records `canvasHash` (the 2D canvas alone) and `shotHash` (the
composited 2D-under-GL screenshot). They are reported but not gated on;
`canvasHash` is still useful as a strong signal when it *does* match.

## Known-bad state

`immersive-off` is a blank canvas with only DOM labels — leaving immersive
leaves the sphere unpainted for well over 600 frames. It hashes identically no
matter what, so it proves nothing. **Pre-existing**, not introduced by the GL
work. Do not read a pass on that state as evidence.
