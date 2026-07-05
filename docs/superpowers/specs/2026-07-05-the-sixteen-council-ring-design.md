# § · THE SIXTEEN — Council Ring Design

**Date:** 2026-07-05
**Status:** Approved pending user review
**Replaces:** KernelSphere 3D canvas + chapter chip row in the Manifesto tab

## Thesis

The Manifesto tab's centerpiece becomes a manifesto of wisdom: humanity's sixteen
essential minds mapped 1:1 onto the sixteen legacy dimensions of the feature space
(`DIM_NAMES[0..15]` in `src/terminal/data/nodeFeatures.js`). The layout itself argues
the thesis — a Council Ring rendered as Kate Raworth's doughnut: an ecological ceiling
outside, a social foundation inside, and the sixteen seated in the safe operating
space between. Eight canon minds (instrument builders) occupy the western arc; eight
sidelined minds (instrument readers) occupy the eastern arc. The species had the
instruments and the readings, and executed neither. That is the observation from Mercury.

## Roster (locked)

| dim | Axis | Mind | Caste | Core equation | System directive |
|----|------|------|-------|---------------|------------------|
| 0 | `dynamical` | Donella Meadows | S | dX/dt = inflow − outflow | Leverage Point Location / Paradigm Stack Intervention |
| 1 | `nonlinearity` | Benoît Mandelbrot | C | z_{n+1} = z_n² + c | Roughness Indexing / Fat-Tail Containment |
| 2 | `dimensionality` | Alexander Grothendieck | C | X ↦ Hom(−, X) | Abstraction Ascent / Problem Dissolution |
| 3 | `criticality` | Stuart Kauffman | S | K_c = 2 (Boolean network) | Edge-of-Chaos Poise / Order-for-Free Harvest |
| 4 | `entropy` | Nicholas Georgescu-Roegen | S | ΔS > 0 per production cycle | Entropy Debt Accounting / Irreversibility Audit |
| 5 | `synchrony` | Yoshiki Kuramoto | C | dθᵢ/dt = ωᵢ + (K/N)Σ sin(θⱼ−θᵢ) | Phase-Lock Threshold / Coupling Budget |
| 6 | `conservation` | Emmy Noether | C | ∂_μ J^μ = 0 | Symmetry Ledger / Invariant Preservation |
| 7 | `temporal` | Ilya Prigogine | C | dS = d_eS + d_iS, d_iS ≥ 0 | Dissipative Structure Licensing / Arrow-of-Time Enforcement |
| 8 | `spatial` | D'Arcy Wentworth Thompson | S | form = f(force) transformation grids | Morphogenetic Load Mapping / Force-to-Form Transcription |
| 9 | `stochastic` | Thomas Bayes | C | P(H\|E) = P(E\|H)P(H)/P(E) | Posterior Refresh / Evidence Ingestion |
| 10 | `game_theory` | Elinor Ostrom | S | 8 CPR design principles | Commons Boundary Enforcement / Polycentric Sanction Ladder |
| 11 | `thermodynamic` | Herman Daly | S | throughput ≤ regeneration | Throughput Ceiling / Steady-State Scale Audit |
| 12 | `information` | Claude Shannon | C | H = −Σ pᵢ log₂ pᵢ | Channel Capacity Allocation / Noise Culling |
| 13 | `cryptographic` | Alan Turing | C | U(⟨M, w⟩) = M(w) | Decidability Boundary / Secret Preservation |
| 14 | `biological` | Lynn Margulis | S | symbiogenesis: 1 + 1 → 1 | Symbiotic Merger Authorization / Competition Deprecation |
| 15 | `economic` | Kate Raworth | S | foundation ≤ economy ≤ ceiling | Safe Operating Space Verification / Doughnut Boundary Patrol |

Caste split: exactly 8 C / 8 S. Næss and Leopold hold no seats; they may appear as
kindred citations inside drawer prose (Margulis, Daly) but never as nodes.

## What is removed / kept

- **Removed:** `KernelSphere` canvas, its three.js/PCA machinery usage in the manifesto,
  the "Every kernel is a position…" intro copy, the chapter chip row, `ChapterPanel`
  invocation from KernelManifesto.
- **Kept:** the headline "The most compelling analogy has the weakest geometry."
  (the ring is now its proof), the § · the kernels RUN COMMAND MANUAL below, and
  `manifestoChapters.js` data (untouched; other consumers may reference it).
- `KernelSphere.jsx`, `kernelSpherePca.js`, `ChapterPanel.jsx` files stay in the repo
  (ChapterPanel is the motion template for SixteenPanel); only KernelManifesto stops
  rendering the sphere.

## Data layer

New file `src/terminal/data/sixteenMinds.js`:

```js
export const SIXTEEN_MINDS = [
  {
    dimIndex: 12,
    dimName: 'information',          // must match DIM_NAMES[dimIndex]
    anchorName: 'Claude Shannon',
    era: '1916–2001',
    caste: 'canon',                  // 'canon' | 'sidelined'
    coreEquation: 'H = −Σ pᵢ log₂ pᵢ',
    systemDirective: 'Channel Capacity Allocation / Noise Culling',
    epigraph: '…',                   // one line, the mind distilled
    body: '…',                       // 3–6 sentences, Mercury observer field-note voice
  },
  // … ×16
];
```

Invariants (unit-tested): exactly 16 entries; `dimIndex` covers 0–15 uniquely;
`dimName === DIM_NAMES[dimIndex]`; exactly 8 canon + 8 sidelined; all payload
fields non-empty.

Prose voice: anthropological-lyrical field notes from the Mercury observer — what
the mind saw, what the species did with it (built the instrument / ignored the
reading) — never Wikipedia summary.

## Components

### `src/terminal/views/manifesto/CouncilRing.jsx` — pure SVG, no three.js

- **Outer ring — Biophysical Ceiling:** sharp low-opacity cyan stroke (`#00FFAA`
  family — the doctrine's ecological register), arc label `BIOPHYSICAL CEILING`.
- **Inner ring — Social Foundation:** sharp low-opacity magenta stroke (`#FF0088`
  family — the doctrine's origin/entry register), arc label `SOCIAL FOUNDATION`.
- **Safe operating space:** the annulus between; 16 nodes seated on a middle radius.
- **Friction alignment:** canon nodes on the western arc (angles 90°–270° left
  hemisphere), sidelined on the eastern arc. Builders face readers across the void.
- **Node rendering:** glyph dot + `anchorName` + `[dim:NN] dim_name` micro-label.
  Base node hue inherits from the **rainbow perimeter arc position** (boot-card
  spectrum: magenta→red→orange→gold→lime→cyan→blue→violet→magenta), same rule as
  the boot axiom tags — this gives the circle its doctrine basis. Caste is encoded
  by a secondary cue (canon = deep-blue/violet stroke ring, deep-structure register;
  sidelined = cyan stroke ring, living-system register).
- **Center:** the ◉ eye glyph, faint — the observer's seat.
- **Active node:** 80ms white flash resolving to gold (`#FFD700`) — crystalline
  lock. Gold appears nowhere else in the ring. White never rests.
- Desktop hover: node brightens; a faint chord renders to its opposite-caste
  counterpart across the void. Click → SixteenPanel.

### `src/terminal/views/manifesto/SixteenPanel.jsx` — detail drawer

Cloned from ChapterPanel's motion idiom (fixed right drawer, backdrop, slide-in
transform, staggered sentence reveal, Escape/click-out dismiss — all doctrine-permitted
transitions). Content order:

1. `[dim:12] information` (mono micro-header, node's arc color)
2. Anchor name + era + caste tag (`CANON GEOMETRY` / `SIDELINED SYSTEMIC`)
3. Core equation — large, monospace, gold
4. Epigraph — italic, bordered-left
5. System directive line — dry telemetry register
6. Body prose — staggered sentences

### `src/terminal/views/manifesto/councilRingMath.js` — pure helpers

`seatAngle(index, caste)`, `angleToNearestNode(rotation)`, crosshair-zone hit test.
Pure functions, unit-tested.

### KernelManifesto.jsx changes

Sphere block + chapter chips replaced by `<CouncilRing />`; header copy updated to
THE SIXTEEN framing (headline retained); run-command manual untouched.

## Mobile (<768px) — the Rotating Crosshair Wheel

No card-stack collapse. The radial structure survives:

- SVG container scales up and anchors so only the upper ring segment is visible.
- A fixed **gold crosshair indicator** sits at 12 o'clock (resolved-signal register).
- Touch drag (`onTouchStart`/`onTouchMove`/`onTouchEnd`) rotates the ring via CSS
  transform around center, with momentum damping and snap-to-nearest-seat on release.
  Rotation is transform-only — no opacity fades (doctrine: no soft dissolves).
- The node under the crosshair becomes active (flash→gold) and its compact telemetry
  (`[dim:NN] dim_name`, anchor, equation, directive) renders in a **fixed-height**
  panel directly below the wheel — no viewport layout shift, no keyboard, no modal.
- Tapping the telemetry panel opens the full SixteenPanel drawer.

## Fade Doctrine compliance (binding)

- Zero white fade: white appears only as the 80ms selection flash resolving to gold.
- No soft dissolves ≥300ms opacity-only; permitted idioms only (slide+opacity entry,
  scale collapse/expand, flash→gold resolve).
- No circular iris wipes anywhere (drawer and wheel transitions are slides/transforms).
- Color semantics fixed per doctrine registers: cyan=ecological, magenta=origin,
  gold=resolved signal (active only), deep blue/violet=deep structure, orange reserved
  for warning states (unused here), black terminal ground.
- Ring geometry earns its doctrine basis via the rainbow perimeter arc mapping.

## Testing

- Vitest: `sixteenMinds` invariants (count, dim coverage, caste split, DIM_NAMES
  agreement, non-empty payloads).
- Vitest: `councilRingMath` pure functions (seat angles hemisphere-correct per caste,
  crosshair nearest-node resolution, snap behavior).
- Preview-browser verification: desktop ring render + hover/click drawer; 375px
  viewport wheel rotation, crosshair activation, fixed-height telemetry panel;
  console clean.

## Out of scope

- No changes to the LatentCollider / ScalingTab.
- No removal of manifestoChapters.js or its other consumers.
- No new Rust kernels; this is a data + SVG/React feature.
- Run-command manual redesign deferred.
