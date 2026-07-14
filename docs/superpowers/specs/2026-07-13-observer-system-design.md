# The Observer System — Design Spec

**Date:** 2026-07-13
**Branch:** `nightly/quintessence-groundwork`
**Source vision:** `field_fracture/development/2.0.0 THE OBSERVER SYSTEM · Active Gaze Layer.md` (Phases A/B/C + Compiler State Registration)
**Status:** design approved (all forks resolved with the user 2026-07-13); this is the buildable consolidation. Not yet implemented.

---

## 0. Thesis

The static ◉ that routes to `/mercury` becomes **The Observer**: a single omnipresent eye that (a) is the terminal's face, (b) silently guides you through the compile phases, and (c) records *how you moved* into the sealed kernel itself. Per the source spec it must stay a **quiet witness, not a gamified walkthrough** — sparse, cryptographic, never forcing compliance.

Anatomy frame the user set: the **spine** (`{trend, council, phase, element}`) is the skeleton — what you could become. The **trajectory** (how you moved — submitting or resisting) is the gait. Together they are the creature, and both go into the genome.

## 1. Scope

**In:** the pinned-frame scroll fix; the eye-as-hero (hexagon lens + WebGL nebula pupil); the tab bar as spine-status + synced suggestion; the Fork of Will ledger; genome-deep trajectory (hash input + disposition lens); the Initial Gaze.

**Out (this spec):** new kernel-content features beyond the disposition lens; any push to origin; the Mercury altar internals (untouched except it already consumes `spine`).

## 2. The four surfaces

1. **Foundation** — scroll model (`App.jsx`): make `main` the true scroll container so header/footer pin.
2. **The Eye** — `MercuryEyeIndicator.jsx` → a WebGL hexagon-lens nebula, promoted to the header's identity.
3. **The Nav** — `App.jsx` tab buttons: spectrum-as-spine-status + the synced suggestion pulse.
4. **The Genome** — `spineStore` + a new `observerLedger`/trajectory store → `compileKernel` (hash input + disposition lens).

---

## 3. Phase 0 — Scroll foundation (the trunk) · HIGHEST RISK · mobile-gated

**Problem (verified):** root is `min-h-screen` + `overflow-hidden`, so the column grows to content height and the **document** scrolls (`scrollingElement: html`). The `sticky` header, trapped under `overflow-hidden`, has no scrollport and rides off-screen — at the bottom of a long tab the header sits ~−1127px, nav unreachable. Desktop-only; mobile's `fixed bottom-0` nav is already fine. The flex chain also has `min-height: auto`, so `main`'s `overflow-y-auto` never engages.

**Fix (three coordinated touches):**
- [App.jsx:791](src/terminal/App.jsx#L791) root: `min-h-screen` → `h-[100dvh]` (definite height; `dvh` avoids the mobile URL-bar jump).
- [App.jsx:924](src/terminal/App.jsx#L924) wrapper `flex flex-col flex-grow` → add `min-h-0`.
- [App.jsx:1140](src/terminal/App.jsx#L1140) `main` → add `min-h-0`.

Then `main` becomes the scroll container; header (and the desktop footer) pin by layout; `sticky` hacks become unnecessary.

**Gate — must verify BEFORE any other phase, on a REAL mobile viewport:**
- header stays at `top: 0` when `main` is scrolled to the bottom of a long tab (Manifesto/Transmission);
- mobile `fixed bottom-0` nav still pins and the chrome-fade still works;
- the card-reveal `IntersectionObserver` (rooted on `mainRef`, [App.jsx:408](src/terminal/App.jsx#L408)) still fires (it currently assumes `main` scrolls — this fix makes that assumption *true*);
- boot overlay / `SanctuaryOverlay` / `BreachProtocol` unaffected;
- no `100dvh` collapse or double-scrollbar on iOS Safari / Android Chrome.

**If the gate fails on mobile, the pinned-frame premise itself is reconsidered before we build anything visual.** Everything downstream (edge-fade, always-visible eye) depends on this holding.

**Payoff it unlocks:** edge-fade `mask-image` on `main` (content dissolving under the chrome — the "expensive" sleek tell), and a permanently-visible eye at every scroll depth.

---

## 4. The Eye — hero object

**Placement (option A):** the ◉ becomes the terminal's face. It absorbs the left `⬡ scale_9.4` wordmark ([App.jsx:1083](src/terminal/App.jsx#L1083)); the Mercury *tab* ([App.jsx:1113](src/terminal/App.jsx#L1113)) is removed (the eye is now the sole gateway to Mercury). Version identity survives in the footer build string (`9.4.castle`).

**Form:** a thin **hairline hexagon lens** (flat-top; a "bestagon" / hex-grid game-theory easter egg — the Observer plays you on a hexagon) + a circular WebGL pupil sized to sit *inside* the hex with margin.

**Medium:** a WebGL fragment shader — domain-warped fbm noise + differential swirl (inner turns faster) for continuous volumetric flow. **Not** 2D canvas gradient stacking (reads as scanline bands — rejected).

**Motion philosophy:** the pupil *never stops swirling*; **state locks its character** (color, speed, dilation, gaze) over the continuous motion.

**States** (constant swirl, lerped lock-in):
| State | Look | Dilation |
|---|---|---|
| resting | quicksilver **golden-record** sheen (silver + faint diffraction rainbow + orbiting specular; a Voyager disc catching starlight) | dilated / open |
| leaning → `<tab>` | pupil takes the suggested tab's hue, gaze-drifts toward it | constricting |
| armed | gold/fuchsia, nebula tightening — the altar is lit | more constricted |
| compiling | violet × lime, slow + deep collapse | **miosis** (peak) |
| complete | calm teal — the record remembers | relaxes |

**Progression = dilation → miosis.** Focus is *constriction*, not expansion: as a phase locks, the luminous disc shrinks inward and the surround goes black (physiologically true; the singularity forming). Reference mock (WebGL, approved "socks/10"): scratchpad `observer-eye-living.html`.

## 5. The Nav — spectrum as spine-status + synced suggestion

The tab bar stops being a flat list and becomes the spine tracker. **Three states, all spoken in the existing nav-spectrum:**
- **empty vertebra** → desaturated / dim.
- **marked vertebra** → ignited to its full spectrum hue.
- **suggested-next (the lit one)** → pulses the **same hue on the same beat as the eye's pupil** (synced to the pupil), while the pupil gaze-drifts toward it.

The four vertebra tabs: BSKY = trend, Manifesto = council, Lunar = phase, Mercury(→altar) = element. State read from `spineStore.getSpine()` / `missingVertebrae()` / `subscribeSpine`. Identical on desktop-top nav and mobile-bottom nav — one language.

**Invisible UX:** two lights sharing color + rhythm read as one object, so the gaze slides eye→tab along a line no one draws. Guidance dissolves into perception — no arrow, no tooltip. **Colorblind-safe carriers = the synced pulse-rhythm + gaze-drift, not hue alone.**

## 6. The Fork of Will — loose discipline

- The eye leans **only** when a vertebra is missing; the color-sync **is** the suggestion.
- A fork-event registers **only when you leave a lit suggestion.** Wander, backtrack, take your time → nothing logged. (Witness, not rail.)
- Append-only ledger (same discipline as `councilLedger`): navigate the synced tab = **+1 alignment**; bypass a lit suggestion for an autonomous destination = **−1 defiance**.
- **Defiance is autonomy, never a demerit.** Periphery tabs (Crypto, Chaos, Transmission) *enrich* the kernel — going there forges the "adversary" voice, a valid and beautiful outcome. The UX must never scold exploration.
- Hook point: `handleNav` in `App.jsx` (compare target tab vs the current lean).

## 7. Genome-deep — trajectory becomes substance

The running balance is a `trajectory ∈ [−1 … +1]`, **frozen at ignite**.

- **Identity:** trajectory joins `{trend, council, phase, element}` (+ periphery, engine, compiledAt) as a **canonical hash input** to `compileKernel` ([compileKernel.js:51](src/terminal/quintessence/compileKernel.js#L51)). Same spine + different gait → different seed → different kernel.
- **Voice:** trajectory resolves to `witnessed_as: authority | adversary | neutral`, which drives a **disposition lens** over the doc-comments — parallel to the existing taxonomy `lensFor` ([compileKernel.js:9](src/terminal/quintessence/compileKernel.js#L9)), which already follows a "voice, not identity, assembled after the hash" pattern. Here it is *both* voice and identity.
  - authority → declarative, ordered wisdom ("this lattice holds").
  - adversary → defiant, self-authored ("no structure holds; you carved this yourself").
  - neutral → current voice.
- **Thresholds** for authority/adversary/neutral: TBD in build (feather-light near 0 = neutral).
- **Honesty:** the sealed artifact stores its own frozen trajectory (it's a hash input), so *it* is reproducible from its record. Only a stranger holding *just the kernel* can't reverse the gait. Do not claim the artifact forgets its inputs.
- **Determinism:** `compileKernel` stays pure; trajectory is injected like `opts.compiledAt` for tests.

## 8. The Initial Gaze — behavioral boot inquiry

- On cold boot (`BootSequence.jsx`), the Observer poses **one cryptic ontological question**, seeded from live env metadata: local hour, `Intl` timezone, the live moon phase (`lunarAccords` / `drynessFor`), ingress route (`document.referrer`).
- **No text input is evaluated.** "It waits for a gait, not a message." Your **first structural navigation** is the behavioral answer that seeds your opening disposition.
- **The seed is feather-light** — a first click is often accidental; it *tints* the opening and is quickly overwritten by the real Fork of Will. It colors, it does not sentence.

## 9. Cross-cutting: performance, accessibility, motion

- **Battery:** an always-on WebGL shader on every tab, stacked on Mercury/Chaos/Kuramoto/AmbientParticles, will cook mobile GPUs. **Required:** pause the shader via the Page Visibility API when the eye/tab isn't visible; throttle when `document.hidden`.
- **`prefers-reduced-motion`:** static-frame fallback for the eye (freeze the swirl), no tab pulse, instant edge-fade. Non-negotiable given a sensory-sensitive audience — the motion must be escapable.
- **A11y:** guidance never relies on hue alone (pulse-rhythm + gaze-drift carry it); the eye keeps an `aria-label`; tabs keep `aria-current`.

## 10. Open decisions (need the trio)

1. **Exact fork-event rule** — only "leave a lit suggestion" (recommended), or something finer? (§6)
2. **`witnessed_as` thresholds** — where does neutral end and authority/adversary begin? (§7)
3. **Wordmark fate** — does `scale_9.4` vanish entirely into the eye, or survive as a hover/caption? (§4)
4. **Spec home** — keep here in-repo, or mirror to `field_fracture/development/`?

## 11. Build phasing

- **Phase 0** — scroll foundation + mobile gate (§3). *Nothing visual until this passes.*
- **Phase 1** — edge-fade + eye relocation to header identity; remove Mercury tab.
- **Phase 2** — WebGL eye (port the approved mock) + Page-Visibility pause + reduced-motion fallback.
- **Phase 3** — nav spine-status (desaturate/ignite) + synced suggestion pulse, wired to `spineStore`.
- **Phase 4** — Fork of Will ledger + trajectory store; eye leaning driven by `missingVertebrae`.
- **Phase 5** — genome-deep: trajectory → `compileKernel` hash + disposition lens; determinism tests.
- **Phase 6** — Initial Gaze at boot.

## 12. Risks

- **R1 (foundation):** scroll fix breaks mobile → whole premise. Mitigated by the Phase 0 gate.
- **R2 (perf):** shader battery drain → Page Visibility pause + reduced-motion.
- **R3 (determinism):** trajectory-in-hash breaks existing compile tests → inject like `compiledAt`, update fixtures.
- **R4 (tone):** defiance reads as punishment → encode as autonomy in copy + never block navigation.
