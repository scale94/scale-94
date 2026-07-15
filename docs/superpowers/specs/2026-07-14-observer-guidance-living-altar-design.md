# Observer Guidance + The Living Altar — Design Spec

**Date:** 2026-07-14
**Branch:** `nightly/quintessence-groundwork`
**Builds on:** `2026-07-13-observer-system-design.md` (the eye, states, masthead — built) — this spec adds the guidance layer (§5/§6 of that spec, reshaped by decisions below) and rebuilds the altar's element seals.
**Status:** design approved in dialogue 2026-07-14; this is the buildable consolidation. Not yet implemented.

---

## 0. Thesis

Two problems, one system. **First:** new visitors ask "what should I do?" — the site needs soft guidance in the CDPR yellow-prop tradition: hint a direction through consistent visual vocabulary, never through instruction. **Second:** the altar is a dead-end — a long scroll to `SPINE INCOMPLETE`, four inert buttons. Both are solved by the same keystone:

**The element ↔ house mapping (LOCKED):**

| Element | House | Hue (the house's existing tab hue) |
|---|---|---|
| FIRE | Chaos (`art`) | gold-orange `#FF8C00→#FFD700` |
| AIR | Transmission | purple `#a855f7` |
| WATER | Ledger | teal `#14b8a6` |
| EARTH | Ecocide | lime `#7ab800` |

Element seal hues = house tab hues, **not** classical element colors (no blue water, no white air). The consistency IS the curriculum: the hue the eye pulses in ambient mode is the hue on the tab is the hue on the altar seal. One vocabulary, three surfaces.

**Doctrine (unchanged, non-negotiable):** witness, never rail. Guidance never blocks, never scolds, never locks a door. Defiance is autonomy. The eye must never freeze (a frozen eye is the failure state).

## 1. Scope

**In:** ambient guidance mode (the element curriculum); compass mode priority integration; mirror-flash on tab click; the synced tab pulse; living altar seals (wet/dry from witness data, click = navigate, hold = seal); the armed ritual; GPU + reduced-motion strategy; test plan.

**Out:** the shadow/disposition lens over kernel doc-comments (own spec, next cycle); Fork of Will ledger + trajectory (existing spec §6–7, phases 4–6); Initial Gaze; tab recoloring beyond the keystone (Manifesto's hue is freed but not reassigned here); tab reordering; any push to origin.

---

## 2. The eye's guidance modes

The eye's state resolution (currently in `MercuryEyeIndicator.jsx`) grows from one hierarchy into this priority chain, top wins:

1. **compiling** — flaring on kernel run (existing).
2. **complete** — sealed kernel present (existing).
3. **armed** — spine complete (existing). Gains the shared-beat pulse (§4) synced with the altar's armed hum.
4. **compass-leaning** — journey started (≥1 vertebra marked) and a vertebra missing: lean at the next missing vertebra in its hue (existing behavior, unchanged).
5. **mirror-flash** — transient overlay, ~1.5s: on any tab navigation the pupil flashes the clicked tab's hue, then decays back to the underlying mode. Allowed over every state except `compiling`. The eye acknowledges every step you take — mirror first, then compass.
6. **ambient-suggestion** — empty spine, nothing sealed: the element curriculum (§3).
7. **resting** — golden-record idle (existing) — the interlude between ambient suggestions.

### Extraction for testability
`MercuryEyeIndicator`'s inline state computation moves to a pure function `resolveEyeState({flaring, sealed, spine, suggestion, flash}) → {state, tint, gaze}` (same file or sibling module) so the priority chain is unit-testable without WebGL.

## 3. Ambient mode — the element curriculum (decision: option B)

When the spine is empty and no kernel is sealed, the eye teaches the four element houses — **only** those four. Manifesto, Scaling, Cryptography, Lunar are never ambient-suggested: the vertebra tabs get taught by compass mode once the journey starts; Scaling and Cryptography remain pure-autonomy discoveries.

**Picker mechanics** (new module `src/terminal/quintessence/guidanceStore.js`, bus-adjacent, same discipline as `spineStore`: no React, listener Set, `getSuggestion()/subscribeGuidance()`):
- Pool: `[art, transmission, ledger, ecocide]` minus the currently active tab.
- Cadence: **suggest ~20s → rest 40–70s (randomized) → next suggestion.** The rest interlude is mandatory — the eye invites, then withdraws. No nagging.
- No immediate repeats; otherwise uniform random. No weighting by visit history in v1 (a visitor may be re-invited to a house they visited — that's fine, feather-light).
- During a suggestion the eye enters `leaning` with the house hue (reuses existing `tint`/`deriveCols`) and gaze-drift toward the nav.
- `notifyNav(tab)` hook (called from `handleNav` in `App.jsx`): fires the mirror-flash, and if the visitor navigated to the currently suggested house, ends the suggestion early (the invitation was accepted; no ledger entry — fork-of-will accounting is out of scope).

## 4. The synced tab pulse

While a suggestion (or the armed state) is live, the suggested tab's nav button pulses **the same hue on the same beat as the pupil** — two lights sharing color and rhythm read as one object.

- **Amplitude: low.** A subtle glow/opacity breath, no scale, no movement. If it reads as a notification badge, it's too loud.
- **Sync mechanism:** fixed shared period **2.4s**, phase-anchored to the global clock. CSS side: `animation-delay: -(performance.now() % 2400)ms` computed at mount. Shader side: the pupil's brightness pulse derives from `u_t` against the same period. Both clocks are `performance.now()`-rooted, so phases stay aligned without a message bus.
- Applies to both desktop top-nav and mobile bottom-nav buttons (one language).
- **Colorblind-safe carriers:** the shared rhythm + the eye's gaze-drift, never hue alone.
- `prefers-reduced-motion`: no pulse at all (the suggestion still exists via the eye's static color lock; guidance degrades gracefully to hue-only, which is acceptable because reduced-motion is an explicit user choice).

## 5. The Living Altar — seals that remember

`QuintessenceAltar.jsx` element buttons become **seals** with wet/dry state derived from the witness:

- **Dry (never walked the house):** mineral, desaturated, **static** — a single frozen shader frame or plain CSS treatment. No animation. Stillness is the meaning.
- **Wet (house visited ≥1×):** the living shader ignites in the house hue and stays lit. Wetness is vitality, rendered literally.
- **Source of truth:** `observatoryBus` gaze totals (`getTotals().gaze.tabsVisited` — keys `art`, `transmission`, `ledger`, `ecocide`), live via the bus's `subscribe`. This is presentation over existing bookkeeping — no new persistence.
- **Click = navigate. Always. Forever.** A seal click routes to its house (requires threading an `onNavigate` prop from `App.handleNav` through `MercuryTab` → `QuintessenceAltar`). This replaces today's click-to-ignite — igniting moves to the hold gesture (§6). Seals are **never disabled**: the `disabled={!armed}` state is removed. The `SPINE INCOMPLETE · …` line remains (honest), but beneath it the altar now offers four doors instead of four dead buttons.
- Seal visual: reuse the eye's nebula shader as the seal's core (ObserverEye gains a `lens` prop to omit the hexagon ring, or the shader is consumed via a thin `ElementSeal` wrapper — planner's choice; **one shader source, no forks**). Sigil + element name + note overlay the disc.

## 6. The armed ritual

When the spine completes (`subscribeSpine`, existing), the altar transforms — **unmistakably, locally, and without closing a single door**:

- **Wet seals constrict:** shader `focus` shifts toward miosis — the ambient flow condenses into a dense, pulsing core on the shared 2.4s beat, in sync with the masthead eye's armed pulse. This is the "two lights, one object" trick again, now spanning masthead ↔ altar.
- **Dry seals stay dry** — cold, mineral, still — and stay clickable (navigate to the house; a visitor at an armed altar can still go wet a seal before sealing). Contrast carries the portrait.
- **The prompt compiles in**, replacing the incomplete line: `[ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL]` (terminal voice, states the gesture explicitly).
- **Nav, header, scroll: untouched.** No viewport lock, no removed chrome, no cursor replacement. Arming is an invitation. A visitor may walk away from an armed altar indefinitely.

### Hold-to-seal
- **Pointer:** press and hold a seal for **1.2s**. During the hold, that seal's disc constricts progressively (focus lerps toward full miosis under the finger) with a visible radial progress cue. Release before completion: spring back, nothing happens, no penalty. Completion: run the existing `ignite(elementId)` flow unchanged (overwrite-confirm, stages, compile, seal). Sealing at a dry element is **allowed** — the honest dry compile.
- **Quick click while armed:** still navigates. The gesture split (click=walk, hold=seal) is permanent and unambiguous.
- **Keyboard / a11y:** seals are buttons; `Enter`/`Space` opens an inline two-option confirm on the seal — `[seal the kernel here]` / `[walk the house]` — no timed gesture required. `aria-live` announcement when the altar arms.
- **Reduced motion:** no progressive constriction animation; the hold still works with the radial progress cue only, or the keyboard confirm path.

## 7. Performance & motion budget

- New GPU surfaces: up to 4 seal canvases + the eye. Dry seals cost ~nothing (static frame). Wet seals animate **only while in the viewport** (IntersectionObserver-gated, same pattern as existing canvases) and inherit ObserverEye's hybrid rAF/watchdog scheduler and reduced-motion static-snap behavior.
- WebGL context count stays single-digit; if it ever pressures the ~16/page limit, the fallback is rendering seals from one shared canvas — noted, not built (YAGNI).
- `prefers-reduced-motion`: eye = static color-locked frame (existing); seals = static frames in their wet/dry state; no tab pulse; ritual via confirm path. Every motion in this spec is escapable.

## 8. Error handling

- `guidanceStore` timers must be cleaned on unmount/HMR; a dead store degrades to `resting` (the eye without guidance is just the eye — never a crash).
- Witness read failures (`getTotals` throwing) → all seals render dry. An unwitnessed altar is a valid portrait.
- Hold gesture interrupted by scroll/pointer-cancel → clean cancel, spring back.
- The altar's existing never-brick guarantee (compile failure → cool down silently) is preserved untouched.

## 9. Testing

- `guidanceStore`: pool membership (element houses only, never vertebra/periphery tabs), no immediate repeat, cadence bounds, accepted-suggestion early end, cleanup.
- `resolveEyeState`: full priority chain (compiling > complete > armed > compass > flash > ambient > resting) as a pure-function table test.
- Altar: wet/dry derivation from mocked totals; click navigates (never ignites); hold completion ignites; early release doesn't; keyboard confirm path ignites; dry-seal sealing allowed; armed prompt renders. **Existing `quintessenceAltar.test.jsx` click-to-ignite expectations must be rewritten**, not deleted — same coverage, new gesture.
- Live verification: pane toolkit (pixel readback for hue assertions, `__quintessenceSpine` for state driving) per the established method.

## 10. Build phasing

1. **Phase 1 — guidanceStore + resolveEyeState extraction** (pure logic + tests, no visuals).
2. **Phase 2 — ambient mode + mirror-flash wired into the eye**; `notifyNav` from `handleNav`.
3. **Phase 3 — synced tab pulse** (desktop + mobile nav).
4. **Phase 4 — living seals** (wet/dry, click=navigate, shader reuse).
5. **Phase 5 — armed ritual + hold-to-seal** (incl. test rewrite).
6. **Phase 6 — perf/a11y sweep** (IntersectionObserver gating, reduced-motion paths, keyboard).

## 11. Risks

- **R1 (tone):** ambient suggestions read as nagging → mitigated by the mandatory rest interlude + low pulse amplitude; if it still nags, lengthen rests before touching anything else.
- **R2 (gesture discoverability):** hold-to-seal is non-obvious → the armed prompt names the gesture explicitly; keyboard path is self-describing.
- **R3 (behavior change):** click-to-ignite becomes click-to-navigate — any muscle memory from prior sessions breaks once, intentionally. The prompt line is the migration notice.
- **R4 (perf):** four more shaders on Mercury → viewport gating + dry-seals-static keeps steady-state cost ≈ one animated seal typical.
- **R5 (sync drift):** CSS animation clock vs shader `u_t` drift → both root in `performance.now()`; drift over a session is bounded and imperceptible at 2.4s period; re-anchor CSS delay on suggestion start.
