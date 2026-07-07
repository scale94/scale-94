# Council Collision Synthesis Engine — Design Spec

**Date:** 2026-07-06
**Branch:** new branch off main (`feat/council-synthesis-engine`)
**Status:** Approved layout (locked, incl. SKS contract); ready for implementation planning
**Predecessor:** `2026-07-05-council-ring-vector-collider-design.md` (shipped, merged to main)

## Overview

The Council Ring collider's output graduates from a one-line strip to the full staged synthesis breakdown pioneered in the Scaling tab. Collisions become **user-driven**: pick two minds, watch the furnace run, receive the structured conceptual payload — Shared Ground & Innovation Frontier, Semantic Vectors & Open Questions, Sanctuaries & Prompt Fragments — as copy-paste raw material for the future final kernel compilation. All state and data flow through the **Sovereign Kernel Standard (SKS)** contract so a user-submitted "personal kernel of truth" later drops into the same pipeline unchanged.

## Goals

1. User-picked pair collisions with zero-friction click mechanics (click arms, click fires).
2. Ambient attract mode retained for the installation context — visuals only, no breakdown.
3. Full deterministic synthesis breakdown below the ring, staged reveal, terminal aesthetic, copy affordances on every seed.
4. Dual thinker sidebars flanking the torus while a pair is selected.
5. Session persistence across tab switches; explicit `/RESET` to return to ambient.
6. SKS contract: polymorphic 16-D input, append-only versioned ledger, zero state leaks.
7. Fix existing text-clipping defects around the torus box (desktop and mobile).

## Non-goals (this phase)

- No guest-kernel input UI (the pipeline accepts guest profiles; nothing renders an input for them yet).
- No mobile selection/synthesis interactions — mobile keeps the crosshair wheel; only the §7 clipping fixes apply to mobile.
- No cross-tab final-compilation step (the ledger and bus are its interface, not its implementation).
- No LLM calls, no runtime randomness — same determinism doctrine as the Scaling narrative.

---

## 1 · Interaction state machine

Owned by `useCouncilCollider` (extended). States:

| State | Meaning |
|---|---|
| `AMBIENT` | Attract mode: auto-collisions run visually (particles, strip ticker). Breakdown panel suppressed. Nothing persisted. |
| `ARMED` | User clicked a node: ambient halts immediately (current cycle's canvas fades, no new ambient cycle starts). Mind A glows gold-pulse. Banner over the strip: `⌖ ARMED: <SURNAME> · SELECT SECOND MIND · [dossier] [disarm]`. Left sidebar mounts. |
| `FIRING` | Second click on a different node: collision fires instantly with the user-grade choreography (denser streams ×2, brighter flash). Right sidebar mounts. Input locked during flight. |
| `SYNTHESIZED` | **Animation gate:** only after the full particle lifecycle completes (EJECT burst finished) does the synthesis compute and the breakdown print below the ring. Ring idles in cooldown drift. Selection + panel persist. |

Transitions:

- `ARMED` → click armed node again, click `[disarm]`, or 45 s inactivity → back to `AMBIENT`.
- `SYNTHESIZED` → click any node → new `ARMED` (previous panel stays until the new synthesis replaces it); `/RESET` → wipe selection + panel → `AMBIENT`.
- `/RESET` is an explicit terminal button rendered with the panel header and in the ARMED banner. It appends a RESET event to the ledger, clears live selection/panel state, and resumes ambient.
- Tab switch / remount at any point: state rehydrates from the ledger (§5) — `SYNTHESIZED` restores pair, sidebars, and full panel; `ARMED` restores the armed mind. Ambient collisions never persist.

## 2 · Click mechanics & dossier coexistence

- Node hitboxes are dedicated to selection: first click arms, second click fires. No dossier on primary click.
- SixteenPanel (dossier) re-routes to `[dossier]` sub-affordances: nested in the ARMED banner, in each sidebar header, and on each mind's name in the breakdown header. Same panel component, new triggers.
- During `FIRING`, node clicks are ignored (input lock) until `SYNTHESIZED`.

## 3 · Upper view layout — dual thinker sidebars

Desktop upper view becomes a 3-column grid when a pair is (partially) selected:

```
[ MIND A profile | torus box (canvas+SVG) | MIND B profile ]
      ~230px            1fr (min 0)             ~230px
```

- Sidebar cards (new `MindSidebar` component): anchor name, era, `[dim:NN] dimName`, coreEquation (axiom), systemDirective, epigraph, excerpt, `[dossier]` button. Mono, arc-hue accents, fixed max height with internal scroll — structurally isolated from the torus box (no absolute positioning over it).
- `AMBIENT` state: no sidebars (grid collapses to single column — identical to today's layout).
- `ARMED`: left card only; right column shows a dim placeholder frame (`AWAITING SECOND MIND`).
- Below ~1100px viewport the grid stacks: sidebars render as two compact cards side-by-side under the torus instead of flanking it (no clipping, no squeeze).

> **As-built amendment (browser-verified):** the manifesto column is capped at `max-w-6xl` (1152px), which squeezed the flanked torus to ~578px — node labels rendered at 7.1px, verified illegible. As shipped: while sidebars flank, the ring box breaks out of the content column to `min(94vw, 1360px)` (centered via `margin-left: 50%; transform: translateX(-50%)` — note the transform creates a containing block, so SixteenPanel and the synthesis panel deliberately stay siblings *outside* this box); sidebar columns tightened to `minmax(170px, 200px)`; and the stacking breakpoint moved from 1100px to **1200px**. Result: labels ≥ 8.9px in every flanking configuration, 10.6px at 1400px viewports.

### Output notification (scroll affordance)

The instant the animation gate opens (transition to `SYNTHESIZED`), a high-visibility alert bar renders at the base of the upper container:

```
▼ // SYSTEM_OUTPUT_READY :: SCROLL_DOWN_FOR_SYNTHESIS ▼
```

- Animated pulse (CSS, respects `prefers-reduced-motion`), colored by trajectory (#FF0088 / #00FFAA).
- Clicking it smooth-scrolls to the breakdown panel anchor.
- It dismisses once the panel has been scrolled into view (IntersectionObserver on the panel).

## 4 · Synthesis engine — shared cores, council voice

### Refactor (zero behavior change to Scaling)

- `src/terminal/data/nodeFeatures.js`: extract vector-parameterized cores; ID-based functions delegate:
  - `fullEdgeFromVectors(fA, fB)` → `{ sim, dims: [{name, i, vA, vB, delta, contrib}], drivers }`
  - `paradoxesFromVectors(fA, fB)` → 64-round saponification, surviving residuals `[{name, residual}]`
  - `detectPeriod3Sanctuaries(paradoxes, bandWidth)` moves here from `useColliderNarrative.js` (pure paradox-cluster math); the hook re-imports it.
- `src/terminal/data/dimSemantics.js` (new): `DIM_SEMANTIC` moves here verbatim; `useColliderNarrative.js` imports it. One shared vocabulary.
- Scaling-tab tests must pass unchanged; add delegation-equivalence tests (ID-based output ≡ vector-core output on FEATURES rows).

### `manifesto/councilSynthesis.js` (new, pure — SKS §1 polymorphic)

```
synthesize(entryA, entryB, collideResult, ordinal) → COUNCIL_RECORD_V1.sections + directive
  entry := { kind: 'mind', mind, profile }            // profile = mindProfile(mind)
         | { kind: 'guest', label, texts?, profile }  // any Float32Array(16)
```

The engine reads ONLY `entry.profile` for math and `entry`-level display fields (label/surname, optional text pools) for voice. A guest entry with no texts falls back to dim-semantic phrasing — zero structural changes required. No import of `SIXTEEN_MINDS` inside the engine.

Sections (all deterministic; mind texts — epigraph clauses, directive halves, excerpt clauses, equation terms — woven in wherever both entries carry them):

1. **SHARED GROUND & INNOVATION FRONTIER** — top convergence dims by `contrib` with `DIM_SEMANTIC` tags and per-axis dominance (which profile drives each shared axis, `vA` vs `vB`, Δ≥0.15 threshold else "balanced"); then maximum-orthogonality dims by `delta` with diverge narratives. Explicit conceptual fields, not bar charts.
2. **SEMANTIC VECTORS & OPEN QUESTIONS** — 2–4 angles built from convergence × divergence × paradox structure, each naming its forcing tension and splicing one fragment from each thinker; then one open question per surviving paradox residual (`> 0.08`, matching the existing saponification core exactly; `0.02` is the loop's convergence epsilon), phrased through both thinkers' vocabulary: the exact irreducible tensions that force a new perspective.
3. **SANCTUARIES & PROMPT FRAGMENTS** — period-3 paradox clusters rendered as quiet pockets of aligned signal, each yielding one condensed seed; plus 3–5 copy-paste seeds (dim semantics × thinker fragments × metrics) and one master **SYNTHESIS DIRECTIVE** — the single "copy-paste me" prompt for the final kernel compilation.

Seeding: mulberry32 keyed on `(pairKey, ordinal)` as in Phase 1 — reproducible, no `Math.random()`.

The 1536-D `collide()` keeps running unchanged for trajectory/ejection/energies; its metrics join the record. Novelty scalar := `1 − collideResult.cosine`.

## 5 · SKS data foundation — `manifesto/councilLedger.js`

**SKS §2 (Ledger Archive):** append-only, versioned, immutable, self-contained records for every interactive event and computed state transition:

```js
// COUNCIL_EVENT_V1  (lightweight)
{ v: 1, kind: 'EVENT', event: 'ARM'|'DISARM'|'FIRE'|'RESET', ts,
  subject: pairRef | mindRef | null }

// COUNCIL_SYNTHESIS_V1  (full payload — one per completed synthesis)
{ v: 1, kind: 'SYNTHESIS', id, ts, ordinal,
  pair: [entryRef, entryRef],          // {kind:'mind', dimIndex, anchorName} | {kind:'guest', label}
  profiles: [Array(16), Array(16)],    // raw inputs — self-contained, guest-ready
  metrics: { cosine, novelty, energies, trajectory, dominantDim },
  sections: { sharedGround, frontier, angles, openQuestions, sanctuaries, seeds },
  directive: string,
  line: string }                        // the Phase-1 ticker line
```

- Single append-only log, in-memory + `localStorage` key `scale94.council.ledger.v1`. Cap 256 entries, oldest-first eviction; SYNTHESIS records are evicted only when they are the oldest (no preferential purge — the log is honest).
- API: `append(record)`, `list(filter?)`, `latest(kind?)`, `subscribe(fn)`, `reset()` (appends the RESET event, then clears **live-state pointers**, never past records), `_resetForTests()`.
- **SKS §3 (Zero State Leaks):** the tab's persistent UI state is *derived from the ledger head*, not from component state: on mount, `useCouncilCollider` replays `latest()` — a SYNTHESIS record with no later RESET/ARM restores `SYNTHESIZED` (pair, sidebars, panel); a trailing ARM restores `ARMED`. Component state is a cache of the ledger, never the source of truth.
- `councilBus` events gain `recordId` so live subscribers can pull the full record from the ledger. Bus pattern/bounds unchanged.
- localStorage failures (quota, privacy mode) degrade silently to in-memory — the tab must never crash on persistence.

## 6 · Breakdown UI — `manifesto/CouncilSynthesisPanel.jsx`

- Renders below the ring container at a stable anchor. Staged reveal: sections appear sequentially (~250 ms cadence, CSS-driven, respects `prefers-reduced-motion` by rendering instantly).
- Section headers as terminal rules: `§ SHARED GROUND & INNOVATION FRONTIER`, etc. Mono type, arc-hue and trajectory-color accents, phosphor-dark background matching the ring box.
- Every seed and the directive get a `CopySpan`-style copy affordance (extract `CopySpan` from `LatentCollider.jsx` into `src/terminal/components/CopySpan.jsx`; LatentCollider imports it — no behavior change).
- Panel header: pair names with `[dossier]` affordances, trajectory verdict, ordinal, `/RESET` button, timestamp.
- The one-line strip remains as the ticker directly under the torus (ambient continues to feed it in AMBIENT state).

## 7 · Layout fix — text clipping elimination

Defects to eliminate (both breakpoints, zero clipping):

- **Desktop:** node labels near the viewBox edges and any panel text must never clip against or overlap the torus box. The 3-column grid gives the torus cell `min-width: 0` and `overflow: hidden` on the *canvas* only; the SVG keeps its full viewBox (already widened to −170..810) and `overflow: visible` is never relied upon. Sidebars are grid siblings, never absolutely positioned over the ring. Z-order: canvas (below) → SVG (above) → banners/alerts (DOM, above the box, never inside it).
- **Mobile:** crosshair-wheel labels that counter-rotate near the mask edge get safe-area padding; the telemetry panel keeps fixed height with single-line ellipsis truncation on every row (no wrapping pushing layout). Font sizes move to clamp()-based responsive scaling where fixed px currently overflows compact widths.
- Acceptance: at 1400×1000, 1100×800, 768×1024, and 375×812 no text node intersects the torus box bounds and no text is cut mid-glyph (browser verification step).

## 8 · Testing

- `nodeFeatures` refactor: delegation equivalence + existing Scaling suites untouched and green.
- `councilSynthesis`: determinism (same entries+ordinal → identical record), section completeness on representative pairs, guest-profile path (synthetic 16-D vector, no texts), paradox/sanctuary/seed non-emptiness guarantees, directive present.
- `councilLedger`: append/immutability (mutating a listed record does not alter the store), cap eviction, localStorage round-trip (mocked), silent degradation on storage errors, rehydration selectors (`latest` state derivation for AMBIENT/ARMED/SYNTHESIZED).
- Hook/UI: state-machine transitions as pure reducer tests where extractable; browser verification for the animation gate, sidebars, scroll alert, persistence across tab switch, `/RESET`, and §7 clipping acceptance.
- Full repo suite (279+) stays green.

## Module summary

| File | Status | Responsibility |
|---|---|---|
| `data/dimSemantics.js` | new | Shared DIM_SEMANTIC vocabulary |
| `data/nodeFeatures.js` | refactor | Vector cores + delegation (+ sanctuary detection moves in) |
| `hooks/useColliderNarrative.js` | touch | Import DIM_SEMANTIC + sanctuaries from new homes |
| `components/CopySpan.jsx` | extract | Clipboard affordance (from LatentCollider) |
| `manifesto/councilSynthesis.js` | new | SKS-polymorphic synthesis engine (pure) |
| `manifesto/councilLedger.js` | new | SKS append-only versioned ledger + rehydration selectors |
| `manifesto/useCouncilCollider.js` | extend | State machine, animation gate, ledger-derived state |
| `manifesto/MindSidebar.jsx` | new | Thinker profile card (L/R of torus) |
| `manifesto/CouncilSynthesisPanel.jsx` | new | Staged breakdown renderer + copy affordances + /RESET |
| `manifesto/CouncilRing.jsx` | modify | Grid layout, banners, scroll alert, panel mount, clipping fixes |
| `manifesto/councilBus.js` | touch | Events gain recordId |
