# Manifesto Lattice — Design Spec

**Date:** 2026-04-11
**Status:** DRAFT — awaiting user review before planning phase
**Scope:** Replace the current text-heavy `ManifestoTab.jsx` with an interactive radial lattice visualization framed as a Mercury-observer dissection of Earth's 32-dimensional kernel feature space.

---

## 1. Context

The current `src/terminal/views/ManifestoTab.jsx` renders two side-by-side HTML walls (`architect_thesis` at 5/16 width, `manifesto` at 11/16 width) both using `dangerouslySetInnerHTML` against pre-rendered markdown. There is nothing interactive. The tab is the densest-text-per-pixel surface in the entire site and does not reflect the Mercury-9.4 alien-architect rebrand that the terminal now leans on elsewhere.

The codebase already contains a rich, untapped dataset for a better rendering:

- **`src/terminal/data/nodeFeatures.js`** — 256+ concept nodes across 17 sectors (`NODES`), each with a 32-dimensional tensor in `FEATURES` (`DIM_COUNT = 32`, dims 0–15 are the legacy SOMA-9.4 space named in manifesto §2, dims 16–31 are the cognitive expansion). Exposes `cosineSim`, `topDrivers`, `analyzeEdge`, `analyzeFullEdge`, `compareNodes`, `extractParadoxes`, `findOrthogonalNode`.
- **`content/system_logs/MANIFESTO.md`** — six chapters (§1 SUBSTRATE, §2 FEATURE_SPACE, §3 BONE_FUSION, §4 SARG, §5 FADE, §8 ENCLAVE) that explicitly namecheck ~40 kernels and concepts which already exist as nodes in `nodeFeatures.js` (bouligand_36, kuramoto, seraphine, etc.).

`ArtTab.jsx` already visualizes the same node graph as a living rotating 3D sphere with click-to-fuse, audio, and particles. The manifesto lattice must not duplicate that experience.

---

## 2. Goal

Turn the manifesto tab into a **static radial mandala** — a pinned 2D projection of the kernel lattice — where text is *discovered* by clicking beacons, not *read* top-to-bottom. The tab reframes the manifesto as field notes assembled by an alien observer on Mercury looking at how little Earth's thinkers do with what they have. Text content is unchanged — only the presentation and access model change.

**Primary differentiator from ArtTab:** where ArtTab is inhabited, kinetic, and tactile (3D, rotating, fusable), the manifesto lattice is clinical, pinned, and still — an X-ray, not a toy. The alien is dissecting, not playing.

### Non-goals

- No new kernel content authored. All text comes from the existing `content/system_logs/MANIFESTO.md` and `content/system_logs/ARCHITECT-THESIS.md` (or whichever system article currently carries `ARCHITECT-THESIS` id).
- No WASM / Rust changes. Pure React + Canvas/SVG.
- No WebGL. Canvas2D is sufficient for 256 specks + 42 beacons at static positions.
- No fusion, no audio, no particles — those belong to ArtTab.
- No real PCA computation — projection is constructed (radial), not derived.
- No edits to `nodeFeatures.js`. Read-only consumer.
- Architect Thesis is not deleted but is demoted to a one-line status entry in the top telemetry rail.

---

## 3. Layout Architecture

The tab is composed of three horizontal regions, top to bottom:

### 3.1 Telemetry Rail (top, ~46 px fixed height)

Left-to-right content:

- **Eye glyph** (`◉`, cyan, preserved from current header) + title `architects_architecture` in the existing gradient.
- Subtitle line: `manifesto // mercury-9.4 // ostrom_protocol` (preserved).
- **Observer readouts** in monospace 9px cyan: `observer: mercury · signal: 0.87 · drift: 0.011 · dim_count: 32`. `signal` and `drift` are deterministic fake telemetry values seeded from the current hover target (or a slow sine if nothing is hovered). They do not represent any real computation; they are chrome.
- **Architect Thesis one-liner** in magenta: `architect: active · thesis: still running · since <thesis.date>`. Pulled from the `ARCHITECT-THESIS` system article's `date` field. On click, opens the full thesis in a modal (reusing the existing article modal path if available, else falls back to a simple overlay). This is the only reading path for the thesis in the new tab.
- **Beacon counter** in magenta: `node_count: 256 · beacon_count: 42 · read: 0/42`. `read` increments as the user opens beacons during the session (not persisted).
- **Clearance chip** on the far right (`clearance: sovereign`, preserved from current header).

### 3.2 Mandala (center, fills remaining vertical space)

A single SVG (preferred over Canvas2D because beacons need text labels with DOM-level hit detection and the whole thing is static — no per-frame redraw needed).

**Dimensions:** The mandala is a square inscribed in the available area, centered horizontally. Outer ring radius `R = min(width, height) * 0.38`. Concentric guide rings at `R`, `0.75·R`, `0.5·R`, `0.25·R`, stroked in `#164e63` with dashed inner rings.

**Spokes:** 16 lines from center to `R`, one per sector in `SECTORS` (excluding `fsk`, which is the 17th — see §6 open questions). Spoke angle for sector `k ∈ [0..15]`:

```
θ_k = (k / 16) * 2π - π/2   // start at 12 o'clock, clockwise
```

**Node placement:** For each node `n` with cluster `c` and intra-sector index `i ∈ [0..15]` (derived from the node's position in `NODES` within its cluster):

```
θ_n = θ_{c} + jitter_angle(n)       // jitter ±0.03 rad, deterministic from node id hash
r_n = (0.2 + 0.75 * magnitude(n)) * R
magnitude(n) = L2-norm of FEATURES[NODE_IDX[n.id]] divided by sqrt(32)
```

Using tensor L2 magnitude as radial distance makes "louder" nodes land on the outer ring — this is the one honest data-derived axis in an otherwise constructed layout. Jitter is deterministic (hash of node id) so positions are stable across renders.

**256 ambient specks:** Every node in `NODES` rendered as a 1 px circle in `#06b6d4` at 35% alpha. No labels. No hit detection. Pure atmosphere.

**~42 beacons:** A curated subset rendered as 3 px filled circles with a 4 px stroke halo at 30% alpha, colored by the node's sector hue (reuse `kernelColorMap.js` if possible for consistency with ArtTab). Each beacon has a monospace 7 px text label offset radially outward.

#### Beacon selection — which ~40 nodes get promoted

Beacons are the nodes the manifesto text explicitly references. The selection list lives in a new file `src/terminal/data/manifestoBeacons.js` as an ordered array of `{ nodeId, chapter, quote }` where:
- `nodeId` matches a `NODES[*].id` in `nodeFeatures.js`.
- `chapter` ∈ `{ substrate, feature_space, bone_fusion, sarg, fade, enclave }`.
- `quote` is a one-sentence fragment from `MANIFESTO.md` that namechecks this node (or the concept the node represents).

Initial seed list (to be verified during implementation against actual `NODES` ids):

| chapter | candidate node ids |
|---|---|
| substrate | `bouligand_36`, `mycorrhizal`, `replicator`, `grayscott`, `white_irid`, `biocoenosis` |
| feature_space | `kuramoto`, `soma91`, `soma_plus`, `firefly`, `chimera_state`, `lotka_volterra` |
| bone_fusion | `bone_fusion`, `bouligand_fsk`, `moire_fsk` + 3–4 siblings from math/phys |
| sarg | `seraphine`, `density_matrix`, `lindblad` (or closest id), `sarg_metric` + siblings |
| fade | `feigenbaum`, `fade_doctrine`, `feigenbaum_delta` + siblings from meta/phys |
| enclave | `ml_kem_768`, `aes_gcm`, `enclave` + siblings from crypto |

The implementation plan must audit `NODES` and replace any id that doesn't exist with the closest real id. If fewer than 40 real matches exist, the beacon count drops accordingly — this is acceptable.

#### 6 chapter territories — wedge overlay

Each of the 6 manifesto chapters maps to a contiguous arc of sectors (not to individual sectors — the mapping is 6→16, not 1→1). Rendered as radial gradient wedges filling the sector arc from center to `R`, with very low alpha (~14%) so they never obscure specks or beacons. Chapter label rendered on the outer perimeter at the wedge midpoint.

Initial chapter → sector arc mapping (subject to refinement during implementation once sector order is confirmed):

```
§1 substrate     → eco, bio, chem                     (3 spokes)
§2 feature_space → sync, phys, math                   (3 spokes)
§3 bone_fusion   → topo, meta, synth                  (3 spokes)
§4 sarg          → cogn, aesth                        (2 spokes)
§5 fade          → phil, hum, ling                    (3 spokes)
§8 enclave       → crypto, drk                        (2 spokes)
```

Total: 16 spokes mapped across 6 wedges. Ordering around the circle must be chosen so that chapters remain contiguous — §1 starts at 12 o'clock and they progress clockwise in the order above. The implementation plan must verify this mapping against `SECTORS` keys.

### 3.3 Transmission Log (bottom, ~46 px fixed height)

- Left: `> intercept · earth.kernels · ∞ the pipeline` (decorative header line), then a second line that reacts to hover: `> hover: <beacon_id> — "<one-line-quote>"`. When nothing is hovered, shows a slowly cycling idle message pulled from a small fixed array.
- Right: `decode: N/42 beacons read` counter and current cursor polar coordinates `(θ=X°, r=Y)` computed from mouse position relative to mandala center. Cursor coords update on mousemove and are purely decorative — reinforces the observer-watching-you feel.

---

## 4. Interaction Model

### 4.1 Hover

- Mouse over a beacon → beacon halo brightens from 30% to 70% alpha, label goes bold, transmission log bottom-left updates to that beacon's quote.
- Mouse over a chapter wedge (not a beacon) → wedge gradient brightens slightly, log bottom-left shows the chapter title.
- Mouse over ambient specks → no reaction (they are deliberately not interactive).
- Mouse leaves mandala entirely → log returns to idle message.

### 4.2 Click (inline expansion — the primary reading mechanism)

Click a beacon:
1. The beacon's circle expands into a full card in place, anchored at the beacon's coordinates. Card dimensions: ~400 px wide × ~260 px tall, positioned so it does not clip the mandala edge (if it would clip, it repositions to stay visible — the beacon's anchor line remains visible as a tether).
2. The rest of the mandala (all other specks, beacons, spokes, territories, rings) receives a CSS `filter: blur(3px) brightness(0.4)` transition over ~250 ms.
3. Card contents:
   - **Header row:** beacon id (e.g. `bouligand_36`), sector name, chapter tag.
   - **Tensor strip:** 32 tiny vertical bars showing the beacon's `FEATURES[i]` values, colored by the 2 highest-magnitude dims. Reuse `DIM_NAMES` for tooltips.
   - **Quote block:** the manifesto paragraph (or 2–3 sentences) from the relevant chapter where this concept is referenced. Text rendered in the existing `prose prose-invert` style so typography matches the rest of the site.
   - **Close affordance:** small × in the top-right corner, and clicking outside the card also closes it.
4. On close, card collapses back into the beacon circle, mandala un-blurs.
5. Only one card open at a time. Clicking a second beacon while a card is open smoothly transitions the card to the new beacon (close-old + open-new, not stacked).
6. Each unique beacon opened during the session increments `read` in the top telemetry rail and is highlighted with a small `✓` tick the rest of the session (resets on remount).

### 4.3 Chapter wedge click

Click a chapter wedge (in the empty region between beacons) → opens a card at the wedge centroid showing the chapter heading + the chapter's opening paragraph from `MANIFESTO.md`. Same blur-and-expand treatment. This is how the user reads the "framing text" of each chapter without being forced to click every beacon.

### 4.4 Keyboard

- `Esc` closes any open card.
- `Tab` cycles through beacons in reading order (sector 0 innermost → sector 15 outermost). The focused beacon gets a visible focus ring.
- `Enter` / `Space` on a focused beacon opens its card.

### 4.5 What the tab does *not* do

- No rotation, no drag, no pan, no zoom.
- No audio.
- No particle effects.
- No fusion, no "compare two beacons" mode.
- No real-time data feed — `signal` / `drift` telemetry is decorative chrome only.
- No persistence of `read` state across sessions.

---

## 5. File / Component Decomposition

To keep `ManifestoTab.jsx` focused and make each unit understandable in isolation:

```
src/terminal/views/ManifestoTab.jsx                  (top-level, orchestrates the 3 regions)
src/terminal/views/manifesto/
    TelemetryRail.jsx                                (top bar, reads architect_thesis)
    TransmissionLog.jsx                              (bottom bar, consumes hover state)
    Mandala.jsx                                      (SVG mandala container, owns hover/select state)
    MandalaGeometry.js                               (pure fns: projection, sector→arc, beacon layout)
    BeaconCard.jsx                                   (inline-expansion card)
src/terminal/data/manifestoBeacons.js                (curated beacon list + quotes + chapter mapping)
src/terminal/data/manifestoChapters.js               (6 chapters: id, title, sector arc, opening paragraph)
```

**Why this split:** `MandalaGeometry.js` is pure and testable in isolation. `Mandala.jsx` owns transient UI state (hoverTarget, selectedBeacon). `TelemetryRail` and `TransmissionLog` are presentational — they receive hover state via props (lifted up into `ManifestoTab`) so they can't drift out of sync. `BeaconCard` is standalone so it can be styled and animated independently. `manifestoBeacons.js` and `manifestoChapters.js` are data modules, easy to edit without touching component code.

**What stays in `ManifestoTab.jsx` itself:** mount the three regions, own the hover/select state, pass it down. Target ~120 lines, down from the current ~137.

---

## 6. Data and Edge Cases

### 6.1 Systematic audit required at implementation time

- Verify the initial beacon seed ids against `NODES[*].id`. Any id that does not exist must be replaced with the closest existing id (by label semantics) or dropped.
- Verify the 6-chapter→sector-arc mapping against `SECTORS` key order. The current spec assumes sectors can be ordered so that each chapter's sectors are contiguous; if this is impossible, the chapter mapping must be adjusted to match the actual sector ordering.
- Confirm `ARCHITECT-THESIS` is still the correct system article id for the thesis (see `systemArticles['ARCHITECT-THESIS']` in current `ManifestoTab.jsx:6`).

### 6.2 Missing data fallbacks

- If `systemArticles['MANIFESTO']` is undefined, the mandala still renders (structure-only view); beacon cards show `[manifesto content unavailable]` where quotes would go.
- If a beacon's chapter quote is missing from the beacons data file, show the chapter's opening paragraph instead.
- If `ARCHITECT-THESIS` is missing, the telemetry rail shows `architect: active · thesis: —` and the click does nothing (no modal).

### 6.3 Responsive

- Below 720 px viewport width (same breakpoint the current tab uses for `minWidth: 720 px`), the mandala scales down proportionally but the telemetry rail and transmission log reflow to 2 lines each to fit.
- Below 480 px, beacon labels are hidden entirely; only beacon dots remain. Tapping a dot still opens the card.
- The card's positioning algorithm must handle the small-viewport case by centering the card over the mandala rather than anchoring it to the beacon's coordinates.

---

## 7. Testing Considerations

- **MandalaGeometry.js unit tests** — pure geometry functions, easy to snapshot: given a fixed set of nodes and a fixed sector ordering, the output coordinates are deterministic. Tests confirm jitter is stable across runs (seeded by node id hash) and sector arcs are contiguous.
- **Beacon data integrity test** — a build-time check (could be a simple script or a Vitest test) that every `nodeId` in `manifestoBeacons.js` resolves to a real entry in `NODES`, and every `chapter` matches one of the 6 chapters in `manifestoChapters.js`.
- **Visual regression** — the mandala is static, so a single screenshot snapshot per viewport breakpoint (desktop / tablet / mobile) is sufficient to catch layout drift. Using the Claude Preview tooling is acceptable for manual verification during implementation.
- **Interaction tests** — hover updates transmission log, click opens a card, Esc closes, a second click swaps without stacking, Tab cycles focus.

---

## 8. Rollout

Single atomic replacement. `ManifestoTab.jsx` is lazy-loaded from `App.jsx:55`, so the change is scoped to the manifesto tab and does not touch any other view. No feature flag, no A/B — the old tab is deleted in the same commit the new one lands.

---

## 9. Open Questions (for writing-plans to resolve)

1. Final beacon seed list after auditing `NODES`.
2. Final chapter→sector arc mapping after confirming `SECTORS` key order.
3. Whether to keep the full architect_thesis modal or inline the thesis as a 7th chapter wedge. (Current spec: keep as modal via telemetry-rail one-liner. Alternative: delete from modal and inline as "§0 · THESIS" wedge at 12 o'clock.)
4. Whether `manifestoChapters.js` should parse chapter openings directly from `MANIFESTO.md` at build time or duplicate the text into the data file. Parsing is cleaner but adds a build-time dependency; duplication is simpler but risks drift. Recommendation: parse at build time via a small import script similar to `scripts/import-system.js`.
