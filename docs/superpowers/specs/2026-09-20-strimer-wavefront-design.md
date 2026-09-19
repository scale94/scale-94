# The strimer wavefront — design

Status: approved 2026-09-20. Branch `fix/art-sphere-index-space`.
Supersedes the five-line brief quoted in `plans/handover-strimer-wavefront.md`.

A Lian Li Strimer pulse on the /art sphere's edges: on left-click, a white-hot
packet races outward along each edge touching the clicked node and terminates
in a micro-ping at the far vertex. No ambient loop. The prism fan stays and is
unchanged — it is the structural "resonance" body, this is the kinetic
"signal" crack, both on the same click.

Every number in this document is measured or derived from source. Section 8
records the measurements and names the three that are still aesthetic dials.

---

## 1. What the measurements settled, and what they killed

Two throwaway probes were run before any of this was designed. Both patched
tracked source and restored in a `finally`; both left `src/` clean.

`scripts/_s1wake.mjs` — a stacked white disc travelling one edge on the
existing **additive edge mesh**, shot every frame in both modes.

`scripts/_s2layer.mjs` — the same packet as a capsule on a **new
non-accumulating layer** in r3f's scene graph, at three gains, both modes.

Four findings changed the design:

**The 18-float edge layout cannot express ink above 1.0.** `writeHsl` clamps s
and l to [0,1], `writeRgb255` divides by 255, `packAlphas` quantises alpha to a
byte, and `COMPOSITE_ADDITIVE` emits `col*topA + shadowCol*botA` with every
factor ≤ 1. One additive instance maxes at exactly 1.0 per channel. The prism
reaches its measured 37x by stacking 770 coincident curves. The HDR headroom
the handover celebrates is in the *target*, not in the *writer*.

**On the additive mesh, head brightness IS tail length in immersive.** The mesh
draws into the trail accumulator, which feeds back at `survival = 1 - m`
(measured 0.21–0.24 normal, 0.48–0.59 immersive; derived 0.28 / 0.68). The knee
then compresses the decaying residual so it reads *flat*: at stack 3 the
immersive afterimage held 98% / 96% / 87% of peak for three frames after the
probe stopped drawing, where stack 1 fell 73% / 41% / 22%. Brighter head, longer
apparent tail. The brief assumes those are independent dials; on that layer they
are not.

**A point head at this speed strobes into beads.** At 100ms / 6 frames the head
advances 41px per frame on a 249px edge while being ~6px wide, so it never
overlaps itself. Normal showed 2–3 beads; immersive showed the entire trajectory
lit at once, decaying from the far end. Photographed in
`lookbook/wake/MONTAGE-imm-s3.png`. The per-frame stride is **17% of the edge** —
which is exactly the 15–20% packet the brief already asks for. The packet length
is therefore not a style choice, it is the anti-aliasing requirement, and the
packet must be drawn as a **segment**, never a disc.

**The non-accumulating layer delivers zero residual in one frame, in both
modes.** Lift over the idle wire fell 0.80 → 0.020 (normal) and 0.78 → 0.027
(immersive) on the single frame after the packet stopped — both at the
simulation's own noise floor. Against the additive mesh's immersive
0.79 → 0.77 → 0.70 → 0.42 → 0.23. This is why the layer was chosen.

## 2. Where it lives

Two new files. Nothing certified is modified except one surgical change in
`useSomaGraph` (§6).

```
src/terminal/art/artStrimer.js      pure math — profile, kinematics, lifecycle,
                                    budget. No canvas, no three. Tested.
src/terminal/art/SphereStrimer.jsx  the r3f mesh and its shaders.
```

`SphereStrimer` mounts **inside `<Canvas>`, after `<SourceQuad>`, before
`<EffectComposer>`** in `SphereComposite.jsx`. That position is the whole
design and it is load-bearing in three ways:

- It is inside the composer's input, so the packet gets **Bloom and then
  Knee** exactly as everything else does.
- That input buffer is **HalfFloatType** — the
  `@react-three/postprocessing` 3.0.4 default, verified in `dist/index.js`
  (`frameBufferType: S = xe`, `xe` imported as `HalfFloatType`). So gain above
  1.0 survives to the bright-extract.
- It is **outside the trail accumulator**. `BackdropPass` renders the backdrop
  and both edge meshes into `trail.write` after `renderTrailFade`; this mesh is
  in r3f's own scene graph and is not in that path at all. That is the entire
  source of the zero-residual property.

`renderOrder = 10` and `depthTest = false`. `SourceQuad` is opaque at the
default renderOrder 0, so without an explicit order three's opaque-first sort
could place this either side of it.

**The accepted cost:** this layer is over the 2D canvas, so a packet passes in
front of node glyphs rather than behind them. Chosen knowingly; visible in
`lookbook/layer/MONTAGE-imm-g2p4.png`, where it reads as the crack passing over
the node rather than as a z-order error.

## 3. The instance layout

Its own layout, deliberately not `EDGE_STRIDE`. The edge layout's byte-packed
alpha is precisely what cannot carry this effect, and reusing it would reimport
the 1.0 ceiling that §1 rules out.

```
0–1   hx, hy     packet head, CSS px, canvas y-down
2–3   tx, ty     packet tail end, same space
4     width      cross-section half-width, px
5     gain       LINEAR peak. A PLAIN FLOAT — this is the field the edge
                 mesh does not have, and the reason this layer exists.
6–8   r, g, b    the tail colour, LINEAR 0–1 (see the trap in §9)
9     profile    0 = packet, 1 = rail, 2 = ping
```

`STRIMER_STRIDE = 10`.

**Budget.** Measured 2026-09-20 on `SPHERE_ADJ`: 31 nodes, 40 edges, **max
degree 4**, mean 2.58. Concurrent clicks are capped at 4, following
`PRISM_MAX_EFFECTS`' precedent. That is 16 packets worst case today. Bifurcation
adds dynamic nodes and can raise degree, so:

```
STRIMER_MAX_PACKETS = 64      packets + rails + pings share this
```

The cap is **enforced in the spawn** — drop the oldest packet beyond it —
because a cap a buffer is sized from has to be a cap something actually
applies, or it is a guess with a comment. A fixed preallocation of
64 × 10 floats is 2.5KB and cannot be reached.

## 4. The packet

Verbatim from `_s2layer.mjs`, which is the version that was photographed and
approved:

```glsl
float bb    = max(dot(ba, ba), 1e-6);                // load-bearing: see the ping
float h     = clamp(dot(pa, ba) / bb, 0.0, 1.0);     // 0 head, 1 tail
float d     = length(pa - ba * h);
float cross = exp(-2.0 * (d/w) * (d/w));
float along = pow(1.0 - h, 2.5);
vec3  col   = mix(uNeon, vec3(1.0), pow(1.0 - h, 6.0));
gl_FragColor = vec4(col * (gain * along * cross), 0.0);
```

`exp(-2(d/w)^2)` is the same gaussian the edge shader's glow uses, so the two
read as one family of light rather than two.

**The head must be authored white.** The knee is a max-channel Reinhard: it
scales all three channels by one factor, so it preserves hue and saturation
exactly and can *never* whiten a saturated colour. A cyan head at (0, 2.4, 2.4)
exits as (0, 0.927, 0.927) — bright cyan, never white. The neon belongs to the
tail, and `pow(1-h, 6.0)` is what puts white only at the very tip.

**Alpha is written 0** and the material takes `blendSrcAlpha = Zero`,
`blendDstAlpha = One`. The screen pass wrote full alpha and the vignette and
knee read it; an additive layer that also accumulated alpha would quietly change
what they see.

Vertex shader: a per-instance quad spanning the capsule's bounding box, padded
by `width * 1.75` (the same reach the edge layer's `GLOW_REACH` uses —
`exp(-2(d/w)^2)` drops below 1/255 at d = 1.66w). `gl_Position` is written
directly from `uResolution` in CSS px; the CPU has already projected, so the
camera takes no part in the geometry. This mirrors `EDGE_VERT` and is why the
orthographic camera's existence is irrelevant here.

### The rail

The same capsule with `profile = 1`: `along = 1.0` instead of the falloff,
spanning the **whole edge**, at low gain and narrow width, in the tail colour.

It exists because the measurement showed that in **normal mode the edge under
the packet is nearly invisible** — the crack reads as a comet through empty
space rather than as current in a trace, which is the mode most people will
see. Compare the two montages: immersive has enough edge ink to read correctly,
normal does not.

The rail lives and dies with its packet, on this same layer, so it inherits the
zero-residual property and touches neither certified edge mesh.

### The ping

`profile = 2`: a degenerate capsule with `head == tail`, which the same
arithmetic renders as a disc — `ba` is the zero vector, `h` clamps to 0 via the
`max(dot(ba,ba), 1e-6)` guard, and `d` becomes the plain radial distance. One
shader, three profiles.

Life `PING_FRAMES = 4`, gain decaying to zero across them. Drawn at the target
node's projected position.

## 5. Kinematics

**Constant world velocity, not constant transit time.** Electricity has a
propagation speed; a fixed transit budget makes long edges read as slow-motion
and short ones as instant, and they stop reading as the same physical thing.

Duration is computed from the **3D world-space** edge length, not the projected
one:

```
duration = clamp(worldLen / V, 70, 160)   // ms
u        = 1 - pow(1 - t, 3)              // ease-out cubic, t = elapsed/duration
```

Deriving from world length rather than screen length has a second payoff beyond
correct parallax: it is invariant under rotation, so a packet's timing does not
drift as the sphere turns, which is what makes a capture of it reproducible.

`V` is calibrated at build time so the **median** world edge length gives 100ms,
and the measured median is recorded in the constant's comment. The clamp exists
because a hub fires up to four edges at once and a 2x spread in duration breaks
the unison of the burst.

Ease-out cubic opens at 3x the average speed and settles into the node — the
brief's "fast, aggressive attack".

**Driven by `performance.now()` deltas, never a frame counter.** A frame counter
runs at double speed on the author's 120Hz display; that is the /SCENT bug and
it is not repeating here. It costs nothing in reproducibility because
`scripts/determinism.mjs` virtualises `performance.now()` and advances it
`FRAME_MS = 1000/60` per `__pump` — measured in `_s1wake`, `u` advanced exactly
0.16667 per pump across every cell.

## 6. Trigger and arrival

**Trigger.** Left-click on a node spawns one packet per edge in
`SPHERE_ADJ[node.id]`, directed outward from the clicked node. Depth 1 only —
no propagation through the graph, no ambient loop, no idle animation. Wires sit
dark until triggered.

Same gain in **both modes**. The measurement is what licenses that: this layer's
residual and peak are mode-identical, which is exactly why it was chosen over a
mode-dependent gain on the additive mesh.

Tail colour is the clicked node's cluster hue, `NODE_COLORS[node.id]`.

**Arrival.** Today `fireNode(id)` sets the clicked node's energy to 1 *and*
every neighbour's to `+0.6`, instantly — so the target vertex is already lit
~100ms before the crack reaches it, and the effect decorates a confirmation
that already happened. That is inverted.

The change is surgical, in `src/terminal/hooks/useSomaGraph.js`:

```js
const fireNode = useCallback((id, { neighbours = true } = {}) => { ... });
```

The neighbour loop becomes conditional. **The default stays `true`**, so every
existing caller and every existing test is unmoved — including the autonomous
ambient firing, whose behaviour must not change. Only ArtTab's left-click and
touch paths pass `{ neighbours: false }`, and the strimer delivers each
neighbour's `+0.6` when its own packet lands, alongside the ping.

The clicked node itself still lights instantly. It is the source.

## 7. Testing

`src/terminal/art/__tests__/artStrimer.test.js`, against the pure module:

- `packetProfile(0) === 1`, monotone decreasing in h, ≈0 at h = 1.
- `easeOutCubic` endpoints exact at 0 and 1; slope at 0 is 3.
- `duration` clamps at both ends, and is the unclamped value between them.
- A spawn produces exactly `degree` packets, every one directed **outward**
  from the clicked node — the failure mode being a packet that runs backward on
  an edge whose tuple happens to be stored `[neighbour, clicked]`.
- The budget is enforced: spawning past `STRIMER_MAX_PACKETS` drops the oldest
  and the live count never exceeds the cap.
- Lifecycle: a packet is dead after arrival + `PING_FRAMES`, and its pool slot
  is reused rather than leaked.
- The degenerate capsule: `head === tail` yields a finite, non-NaN profile. The
  edge shader already documents `atan(0,0)` and `mix(x, NaN, 0)` as live hazards
  in exactly this situation; the ping reaches it on every arrival.

## 8. Certification, and a claim to test rather than assume

The frame strip is the real gate. `artCompare` is a tripwire and not a verdict —
it passed the entire bloom dial move 21/21. `artInk` ratios must be read with
`lit` and `meanLit` beside them, never alone, because a ratio of sums cannot see
a redistribution, which is precisely the shape a travelling bright head has.

**The new capture rig** (`scripts/_s3strimer.mjs`) pins the world exactly as
`artBaseline` and `_a3bloom` do, clicks a degree-4 hub, and shoots with
`pump(1)` at offsets 1–8 in both modes. The existing `LIVE_OFFSETS = [14,26,44]`
is useless for a 6-frame transient — a wavefront that has already passed is not
in the frame being graded.

**The claim worth testing first: this may not move the reference at all.**
Because the layer leaves zero residual after one frame, any frame shot ≥2 frames
past arrival is identical to the pre-click frame. Every existing capture state
shoots well past that — `artBaseline` waits 20–24 frames for the pulse rings,
`_a3bloom --live` uses 14/26/44. If `artNull` (5 sets) and `artCompare` confirm
no cell moves, **no re-base is owed**, and the attribution chain to
`baseline/art-sphere-phase2-bloom-dial-certified` at `d69ce75` is preserved
intact.

Verify it. Do not assume it. If any cell does move, re-base **once**, after the
dials in §9 are settled — re-basing twice is how attribution is lost.

## 9. The three dials, and one trap

**Dials** — these are aesthetic and belong to the author, chosen on frames:

| dial | probe value | measured effect |
|---|---|---|
| `gain` | 2.4 | peak 0.907 / 0.967 / 0.979 at gain 1 / 2.4 / 4 |
| `packet` | 0.17 of the edge | the anti-strobe minimum; below it the beads return |
| rail gain | ~0.08 | not yet swept |

**Gain and packet length are not orthogonal.** Measured span grew
0.114 → 0.139 → 0.165 across gains 1 → 2.4 → 4, because the bloom halo widens
with the head. At gain 4 the packet already reaches the 17% target with no
length change. Sweep them together or one will be tuned against the other —
the same mistake the knee and the head brightness invited in §1.

**THE TRAP: this buffer holds LINEAR colour, and `NODE_COLORS` is sRGB.**
`SourceQuad` emits `srgbToLinear(min(srgb,1)) + max(srgb-1,0)` into the composer
input, so everything downstream is linear working space. The additive edge mesh
by contrast writes sRGB bytes into an sRGB-conceptual accumulator. A cluster hue
taken straight from `NODE_COLORS` and written to this layer is a colour-space
mismatch — it will read brighter and flatter than the same hue on an edge.
Convert with `srgbToLinear` at the CPU write site, once, and say so at the
write site.

## 10. Explicitly out of scope

- **The standing wave.** The handover names a slow bidirectional standing wave
  on resonance-adjacent *straight* edges. Different effect, different edge set,
  different trigger, and not brainstormed at all. It gets its own spec. Shipping
  it here would put two undialed effects in one capture with neither
  attributable when the frames disagree.
- **The dither** (design 2.4/2.5). Deliberately unbuilt: a ±1 level correction
  under ~3.5 levels of CSS film grain. The author ruled the grain stays.
- **`BLOOM` mode-dependence.** Measured and killed. Not revisited.
- **The `RIFT_ALPHA` exposure question.** Real and open, unrelated to this.

**Observed in passing, not changed:** ArtTab's left-click builds its label
cascade from `ADJ[node.id]` — the full 272-node adjacency — while the sphere
draws and fires over `SPHERE_ADJ` (31 nodes, 40 edges). The two disagree about
who a node's neighbours are. This may be deliberate, to label off-sphere
neighbours. It is noted here because the arrival change in §6 sits next to it,
and it is not touched.

---

## Appendix — the evidence

| artefact | what it holds |
|---|---|
| `scripts/_s1wake.mjs` | the additive-mesh wake probe; patches ArtTab, restores in `finally` |
| `scripts/_s2layer.mjs` | the non-accumulating layer probe; patches ArtTab + SphereComposite |
| `lookbook/wake/` | 6 cells × 19 frames + `report.json` — the beads, and the accumulator decay |
| `lookbook/layer/` | 6 cells × 13 frames + `report.json` — the crack, and zero residual |
| `lookbook/wake/MONTAGE-imm-s3.png` | the bead necklace that killed the point head |
| `lookbook/layer/MONTAGE-imm-g2p4.png` | the approved look |

Both probes are throwaway and both patch tracked source. `git status` after
running either. Never run them during a capture.

**The two scripts are committed; the frames are not.** `lookbook/` is untracked
in this repo, as it is for every other capture, so `lookbook/wake/` and
`lookbook/layer/` exist only on this machine — including the two montages this
design was approved on. Re-running either script regenerates its own frames and
`report.json` from a pinned world, which is why the scripts are the artefact
worth keeping and the PNGs are not. If a later session needs the pictures and
they are gone, re-run; do not quote a number from this document against frames
you have not reproduced.
