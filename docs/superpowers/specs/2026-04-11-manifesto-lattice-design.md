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
- Architect Thesis is not deleted but is accessed only by clicking the mandala's center HUD (§3.3), which opens it as a modal overlay.

---

## 3. Layout Architecture

The tab is a **single region**: the mandala fills the entire tab, edge-to-edge, on pure black. There is no telemetry rail, no transmission log, no header strip, no architect-thesis bar, no rectangular chrome of any kind. No straight lines compete with the circle's geometry — **visual harmony is the non-negotiable constraint**. All informative text that would otherwise live in rails is concentrated into a single HUD element at the mandala's center (§3.3). Everything else is deleted from this tab (§3.4).

### 3.2 Mandala (the entire tab)

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

### 3.3 Center HUD (the `◉` glyph absorbs all chrome)

All informative text lives inside a **single circular HUD at the mandala's geometric center** — radius ~60 px on desktop, ~44 px on mobile. The HUD is the only place text appears besides beacon labels and chapter perimeter labels. It sits inside the innermost guide ring and visually reads as the mandala's pupil.

**Idle state** (nothing hovered, no card open):

```
     ◉
observer: mercury
architect: active
thesis: still running
      ↻
```

- Line 1: cyan `◉` eye glyph.
- Lines 2–4: 3 lines of 8 px monospace text, cyan 60% alpha, centered. These are the only pieces of "chrome" text that survive from the old rails.
- Line 5: a small `↻` affordance. Clicking the glyph or the `↻` opens the architect thesis as a modal overlay (reusing whatever modal path the site already has for system articles; if none exists, the implementation plan must add the minimal thing that works). This is the only access to the thesis from this tab.
- The whole HUD is on a 30% alpha black disk (`rgba(0,0,0,0.5)`) with a 0.5 px `#164e63` stroke matching the inner guide ring — so the text reads cleanly over whatever specks/wedges are underneath.

**Hover state** (mouse over a beacon, no card open yet):

```
     ◉
bouligand_36
sector: eco
"collagen lamellae
 rotate at 36°"
```

- Line 2: beacon id, cyan bold.
- Line 3: sector name in 7 px dim cyan.
- Lines 4–5: the beacon's `quote` field from `manifestoBeacons.js`, wrapped to fit the HUD width (max 2 lines, truncated with `…` if longer). 8 px monospace, green `#39ff14`.
- The HUD text swaps in place on hover; the disk and stroke do not animate. No floating label near the cursor — all feedback is centralized in the HUD. This is the unique move that differentiates from a standard tooltip.

**Chapter wedge hover** (mouse over an empty wedge region, not on a beacon):

```
     ◉
§3 BONE_FUSION
"the engine drives
 toward τ = 0.9990"
```

Same treatment: chapter id + a one-line chapter epigraph from `manifestoChapters.js`.

**Selected state** (a card is open — see §4.2):
HUD shows a minimal `×  close` affordance and nothing else. Acts as a second close button for users who click the center naturally. `Esc` also closes.

### 3.4 What happens to the old chrome elements

- **Eye glyph + `architects_architecture` title** — the glyph survives as the center HUD's top line; the title is deleted (the navigation tab strip above the view already says "manifesto").
- **Subtitle `manifesto // mercury-9.4 // ostrom_protocol`** — deleted.
- **Observer readouts (signal / drift / dim_count)** — deleted. Only `observer: mercury` survives as a single line of the idle HUD.
- **Architect Thesis full content** — accessed by clicking the center HUD, which opens it as a modal overlay. No rail, no one-liner text.
- **`clearance: sovereign` chip** — deleted.
- **Beacon read counter** — deleted. Progress is implicit in the checkmarks on already-opened beacons (§4.2 point 6).
- **Cursor polar coordinates readout** — deleted.
- **Transmission log strip** — deleted. The HUD absorbs its role.

---

## 4. Interaction Model

### 4.1 Hover (desktop) / tap-preview (mobile)

- Mouse over a beacon → beacon halo brightens from 30% to 70% alpha, beacon radius grows by +1 px, **center HUD swaps** to show that beacon's id, sector, and quote (§3.3 hover state). No floating label near the cursor — all feedback is in the HUD.
- Mouse over a chapter wedge (not a beacon) → wedge gradient brightens slightly, HUD swaps to chapter id + epigraph.
- Mouse over ambient specks → no reaction (they are deliberately not interactive).
- Mouse leaves mandala entirely → HUD returns to idle state.
- **Mobile:** there is no hover on touch devices, so a *single tap* on a beacon behaves as hover — it swaps the HUD and brightens the beacon but does **not** open the card. A *second tap* on the same beacon opens the card (§4.2). Tapping empty space (or the HUD) dismisses the hover preview back to idle. This two-tap pattern gives mobile users the same "read the label before committing" affordance desktop users get from hover.

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
6. Each unique beacon opened during the session is marked with a small `✓` tick next to its label for the rest of the session (resets on remount). No separate counter anywhere.

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
- No real-time data feed, no telemetry readouts, no cursor coordinates.
- No rectangular chrome (rails, bars, headers, footers, status chips).
- No persistence of `read` state across sessions.

---

## 5. File / Component Decomposition

To keep the implementation focused and make each unit understandable in isolation:

```
src/terminal/views/ManifestoTab.jsx                  (thin wrapper, mounts Mandala edge-to-edge)
src/terminal/views/manifesto/
    Mandala.jsx                                      (SVG mandala container, owns hover/select state, renders CenterHUD + BeaconCard)
    MandalaGeometry.js                               (pure fns: projection, sector→arc, beacon layout, hit-testing)
    CenterHUD.jsx                                    (the ◉ pupil — idle, hover, and selected states)
    BeaconCard.jsx                                   (inline-expansion card)
src/terminal/data/manifestoBeacons.js                (curated beacon list + quotes + chapter mapping)
src/terminal/data/manifestoChapters.js               (6 chapters: id, title, sector arc, opening paragraph)
```

**Why this split:** `MandalaGeometry.js` is pure and testable in isolation. `Mandala.jsx` owns transient UI state (`hoverTarget`, `selectedBeacon`) and composes the SVG plus the `CenterHUD` and `BeaconCard`. `CenterHUD` is a pure function of `{ hoverTarget, selectedBeacon, thesisArticle }` — no internal state, trivially testable. `BeaconCard` is standalone so it can be styled and animated independently. `manifestoBeacons.js` and `manifestoChapters.js` are data modules, easy to edit without touching component code.

**What stays in `ManifestoTab.jsx` itself:** receive `systemArticles` prop (for chapter text lookup) and mount `<Mandala />` at 100% width/height on a pure black background. Target ~40 lines, down from the current ~137.

---

## 6. Data and Edge Cases

### 6.1 Systematic audit required at implementation time

- Verify the initial beacon seed ids against `NODES[*].id`. Any id that does not exist must be replaced with the closest existing id (by label semantics) or dropped.
- Verify the 6-chapter→sector-arc mapping against `SECTORS` key order. The current spec assumes sectors can be ordered so that each chapter's sectors are contiguous; if this is impossible, the chapter mapping must be adjusted to match the actual sector ordering.
- Confirm `ARCHITECT-THESIS` is still the correct system article id for the thesis (see `systemArticles['ARCHITECT-THESIS']` in current `ManifestoTab.jsx:6`).

### 6.2 Missing data fallbacks

- If `systemArticles['MANIFESTO']` is undefined, the mandala still renders (structure-only view); beacon cards show `[manifesto content unavailable]` where quotes would go.
- If a beacon's chapter quote is missing from the beacons data file, show the chapter's opening paragraph instead.
- If `ARCHITECT-THESIS` is missing, the center HUD line reads `thesis: —` and clicking the glyph does nothing.

### 6.3 Responsive / mobile

Mobile is a first-class target, not a fallback. The tab must feel deliberate on a phone, not a desktop layout squeezed down.

**Breakpoints:**

- **≥ 960 px (desktop):** outer radius `R = min(w, h) * 0.38`; center HUD radius 60 px; beacon labels 7 px visible; 256 ambient specks.
- **720–959 px (tablet):** `R = min(w, h) * 0.42`; HUD 54 px; labels 7 px visible but shorter (strip to 10 chars, `…` if longer); ambient specks rendered at 0.8 px to stay subtle at this scale.
- **480–719 px (large phone / portrait tablet):** `R = min(w, h) * 0.46`; HUD 48 px; **beacon labels hidden by default** — only beacon dots remain. The current hover/tap target pops its id into the HUD instead. Ambient specks stay but at 0.6 px 25% alpha.
- **< 480 px (phone):** `R = min(w, h) * 0.48` — the mandala fills almost the entire viewport; HUD 44 px; labels hidden; ambient specks rendered at 0.5 px 20% alpha (still present, just atmospheric).

**Touch interaction model** (cross-reference §4.1):

1. First tap on a beacon = "preview" (equivalent to desktop hover). Center HUD swaps to show the beacon's id + quote. The beacon highlights. No card.
2. Second tap on the same beacon = "open". Card expands in place, rest of mandala blurs.
3. Tap outside the beacon (on empty mandala space or a different beacon) = dismiss preview / switch preview.
4. Tap outside an open card (or the HUD `×`) = close card.

This mirrors the iOS Maps-style "tap to preview, tap to commit" pattern. It prevents the #1 mobile failure mode for mandala-style interfaces: accidental selection while scrolling or exploring.

**Beacon hit-box padding:** On touch devices, beacon hit boxes expand to a minimum of 36×36 px (WCAG touch target) even though the visible dot stays at ~3 px. Hit boxes must not overlap — if two beacons are closer than 36 px on a small viewport, the implementation uses nearest-neighbor hit resolution (the tap selects whichever beacon center is closest to the tap point).

**Card sizing on mobile:** Below 720 px, the `BeaconCard` ignores the "anchor at beacon coordinates" rule and instead slides up from the bottom as a sheet covering the lower 60% of the viewport. The mandala above continues to blur. Tap outside the sheet or swipe it down to dismiss. This keeps the card readable on narrow screens without forcing the user to scroll inside an awkwardly-positioned floating box.

**No hover → no cursor chrome:** On touch, there is no mouse cursor, so nothing in §3.3 or elsewhere can depend on a `mousemove` event. All feedback must come from tap events. The spec is already written this way — calling it out explicitly.

**Orientation:** Both portrait and landscape are supported. In landscape on a phone, the mandala still scales to `min(w, h) * 0.48` — it does not stretch horizontally. The HUD sits at the geometric center regardless of orientation.

**Performance budget on low-end phones:** 256 ambient specks + 42 beacons + 16 spokes + 4 rings + 6 wedges = under 350 SVG elements. This is well inside the budget for a single static SVG on any phone from the last 5 years. No per-frame redraws (no RAF loop) — the mandala is static, re-rendering only on interaction. The blur on open-card is CSS `filter` which mobile Safari / Chrome both hardware-accelerate; if measured performance is poor on a target device, the fallback is a `brightness(0.4)` without the blur.

---

## 7. Testing Considerations

- **MandalaGeometry.js unit tests** — pure geometry functions, easy to snapshot: given a fixed set of nodes and a fixed sector ordering, the output coordinates are deterministic. Tests confirm jitter is stable across runs (seeded by node id hash) and sector arcs are contiguous.
- **Beacon data integrity test** — a build-time check (could be a simple script or a Vitest test) that every `nodeId` in `manifestoBeacons.js` resolves to a real entry in `NODES`, and every `chapter` matches one of the 6 chapters in `manifestoChapters.js`.
- **Visual regression** — the mandala is static, so a single screenshot snapshot per viewport breakpoint (desktop / tablet / mobile) is sufficient to catch layout drift. Using the Claude Preview tooling is acceptable for manual verification during implementation.
- **Interaction tests** — hover updates the center HUD text, click opens a card, Esc closes, a second click swaps without stacking, Tab cycles focus, double-tap on mobile opens the card after a single-tap preview.

---

## 8. Rollout

Single atomic replacement. `ManifestoTab.jsx` is lazy-loaded from `App.jsx:55`, so the change is scoped to the manifesto tab and does not touch any other view. No feature flag, no A/B — the old tab is deleted in the same commit the new one lands.

---

## 9. Open Questions (for writing-plans to resolve)

1. Final beacon seed list after auditing `NODES`.
2. Final chapter→sector arc mapping after confirming `SECTORS` key order.
3. Whether `manifestoChapters.js` should parse chapter openings directly from `MANIFESTO.md` at build time or duplicate the text into the data file. Parsing is cleaner but adds a build-time dependency; duplication is simpler but risks drift. Recommendation: parse at build time via a small import script similar to `scripts/import-system.js`.
4. Architect thesis modal — does the site already have a reusable modal/overlay component (e.g., from the article reading path) or does the implementation plan need to add a minimal one? Plan must check before assuming.
5. Mobile card dismiss gesture — is swipe-down necessary for V1 or is "tap outside" sufficient? Recommendation: tap-outside for V1, swipe-down as a follow-up if telemetry shows users struggling.
