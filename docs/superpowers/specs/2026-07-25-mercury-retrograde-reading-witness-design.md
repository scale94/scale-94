# Mercury Retrograde — the True Reader's Cosmic Event

**Date:** 2026-07-25
**Status:** Design — awaiting spec review
**Surface:** `src/terminal/components/MercuryTerminator.jsx` (the compile-frontier shader) + a new silent reading-telemetry layer

---

## One-line

A reader who genuinely reads all five pinned lore kernels — measured silently, not
button-mashed — is visited, unbidden, by the one astronomical event unique to
Mercury: the **retrograde Sun**. The day/night terminator they have watched crawl
forward halts, walks backward, and rights itself. No prompt, no UI, no advertisement.

## Why this event

Mercury's 3:2 spin–orbit resonance on an eccentric orbit means that near perihelion
its orbital angular velocity briefly exceeds its rotational rate, so the Sun appears
to **stop, reverse, and resume** — the "double sunrise." It is real, documented, and
happens on no other planet. Crucially it *is* the shader we already have: an
external view of Mercury's disc shows this as the **terminator sliding backward**.
The reward reuses the site's core mechanic and bends its physics for one person. No
new geometry, no new textures — one transient branch in the existing fragment shader.

## Locked decisions (do not re-open in the plan)

1. **Event = retrograde Sun**, rendered as the terminator receding. Not the transit,
   not the sodium tail.
2. **Trigger = unbidden (Option A).** Fires the instant the fifth kernel crosses its
   reading threshold. NOT gated behind the quintessence compile.
3. **Decoupled from vitrification and the quintessence seal.** Both were considered
   and cut. This feature touches neither.
4. **The terminator returns to truth.** The retrograde is a transient, honored
   exception; when it finishes, the terminator eases back to its real compile-state
   position (`twilight`/`day` from `useCompileFrontier`). "Position is meaning" still
   holds — the event is a rare parenthesis, not a new resting state.
5. **Zero surface footprint.** Nobody who does not earn it ever learns it exists.

## Detection model — the silent witness

### Reading surface (ground truth, from code)

Clicking a pinned kernel runs `handleKernelClick` (`src/terminal/App.jsx`). After the
load animation, if the kernel has an `articleId`, it calls `setSelectedArticle(article)`,
navigates to `~/system/kernel`, and resets scroll to top. So each kernel opens its own
**dedicated full-text reading pane** — reading is per-article, not one long scroll and
not five inline-expanded cards. "Read all five" = visit and complete all five article
views within a session. The witness state must therefore **survive navigation** between
panes (it lives above the article view, in App-level state).

### The five

The pinned exhibition kernels (from `pinnedModules` in `KernelTab.jsx`): Fish Scale
genome, Hudelschublade, Black Hole Taxonomy, Semiotic-Synthesis-9.9.9,
Rossignol-Andalib. The plan resolves their exact `articleId`s from `pinnedModules`.

### Per-kernel word counts (real, raw `wc -w` incl. wrapper)

| Kernel | words |
|---|---|
| Hudelschublade | 622 |
| Black Hole Taxonomy | 664 |
| Semiotic-Synthesis-9.9.9 | 886 |
| Rossignol-Andalib | 1231 |
| Fish Scale | 595 |
| **total** | **~3,998 raw (~3,000 prose)** |

Rossignol alone is ~40% of the corpus, so a flat per-kernel time would let a skimmer
pass on the long one. **Thresholds are per-kernel, proportional to each kernel's own
length.**

### Threshold math

- Expected active read = `words / WPM`, with `WPM ≈ 200` (intensive technical prose).
- Credit at **leniency 0.5–0.6** of expected (optimize against false negatives — a
  genuine reader missing the egg is the only real failure; a lucky skimmer is harmless).
- Per-kernel required active seconds ≈ `(words / 200) * 60 * 0.55`.
  Rough floors: Fish Scale ~98s, Hudelschublade ~103s, Black Hole ~110s,
  Semiotic ~146s, Rossignol ~203s → **cumulative ~11 min at full attention,
  ~8–9 min after leniency.** (Recompute from prose-only counts during implementation;
  the raw counts include the JS wrapper.)

### What counts as "absorbed" for one kernel

A kernel flips to `complete` when, within its reading pane, ALL hold:

- **Active time** accumulated ≥ its per-kernel threshold. Active time accrues only
  while `document.hidden === false` **and** the window has focus. Leaving to another
  tab / app **pauses** accrual — it does not reset it (glancing away must not nuke
  eight minutes of honest reading).
- **Reached bottom** — the reading pane scrolled to (near) its end at least once.
- **Genuine progression** — a low-frequency scroll delta was observed over the dwell,
  not a single instantaneous jump to the bottom.

### Earning the event

`witnessed` flips true the moment **all five** pinned `articleId`s are `complete`
within the session. Telemetry is **per-session, in memory** — so it naturally requires
real reading each session and cannot be replayed from cache. On earning, the retrograde
fires **once**. A session-level `hasFired` guard prevents re-firing if the reader keeps
reading afterward.

### Open decision for review — the "purity" gate

The original intent was "read all five *before even touching the other shiny tabs*."
A hard "never navigated elsewhere" lock is fragile and false-negative-prone (read four,
peek at Lunar, come back, finish → lost forever). **Recommended interpretation:** drop
the permanent cross-tab lockout; keep purity where it matters — per-kernel focus (accrual
pauses on blur) and genuine dwell. The egg is for the person who *read*, not the person
who navigated in a particular order. **Confirm at review** whether you want the stricter
"unbroken session, no detours" gate instead.

## Architecture (isolated units)

1. **`readingThresholds.js`** (pure) — `requiredSeconds(words, { wpm, leniency })`.
   Fully unit-tested.
2. **`readingWitness.js`** (pure) — completion predicate for one kernel
   `isAbsorbed({ activeSeconds, threshold, reachedBottom, scrollEvents })` and the
   corpus predicate `allWitnessed(completedIds, requiredIds)`. Fully unit-tested.
3. **`useReadingWitness()`** (hook) — owns the per-`articleId` accumulator map. While a
   kernel article is shown it: samples active time (rAF or interval, gated on
   `visibilitychange` + `window` focus), listens to the reading pane's scroll for
   bottom-reached + scroll-event count, and marks kernels complete via the pure
   predicates. Emits `onWitnessed()` once when the corpus predicate first passes. Lives
   at App level so state persists across pane navigation.
4. **Bridge** — App holds a `retrograde` trigger token (a timestamp, mirroring the
   existing `flare` prop pattern). `onWitnessed()` sets it once.
5. **`MercuryTerminator` retrograde branch** — new `retrograde` prop (token). On a new
   token, a one-shot animation **detaches** the effective terminator drive from the live
   `tw`/`day` for its duration, runs a scripted curve, then re-attaches and eases back to
   the true values. Curve is a pure exported function.

### The retrograde curve (pure, exported, testable)

`retrogradeCurve(t01) -> { twOffset, dayOffset }` over ~4–6s, eased, legible on a 180px
disc, rendering the double-sunrise signature: brief advance → **recede past the start**
→ small re-advance → settle. Invariants (assert in tests): starts and ends at zero
offset (so it begins and ends on the true terminator), stays bounded, and the recede
segment is monotonic. A rare, cool "impossible" tint (violet-white, distinct from the
gold run-`flare`) marks the reversal so an informed eye knows this is not ordinary dawn.

## Data flow

```
read kernel pane ──▶ useReadingWitness (active time + scroll, per articleId)
                         │  pure: readingThresholds + readingWitness
                         ▼
              all five complete → onWitnessed() ──▶ App sets `retrograde` token (once)
                                                        │
                                                        ▼
                                     MercuryTerminator: one-shot retrograde branch
                                     (detach → curve → re-attach to true tw/day)
```

## Edge cases & guardrails

- **Dead-frame trap.** The disc must never look like a crashed context. The retrograde
  is motion by definition, so this is inherently safe, but the return-to-truth must be a
  smooth ease, never a hard snap.
- **Reduced motion.** `prefers-reduced-motion` already suppresses the terminator's
  ambient loop. For the retrograde: skip the oscillation; optionally do a single slow
  dip-and-return, or no-op. Decide in the plan; default to no-op (motion-sensitive
  readers earned it but should not be forced through a swing).
- **Reader idles mid-kernel.** Accrual is active-time-gated; an idle visible tab still
  accrues (they may be reading slowly). Acceptable — leniency already tolerates this.
- **In-flight load abort.** `handleKernelClick` can abort/replace loads; the witness
  keys strictly on the *shown* `selectedArticle.articleId`, so an aborted load never
  credits reading.
- **N and the frontier are unaffected.** This feature reads compile state but never
  writes it; `useCompileFrontier` is untouched.

## Testing

- `readingThresholds`: word count → seconds, wpm/leniency params.
- `readingWitness`: per-kernel predicate (each condition independently gates), corpus
  predicate (all five required, order-independent).
- `retrogradeCurve`: zero at both ends, bounded, recede segment monotonic.
- `MercuryTerminator`: new-token → animation arms (mirror the `flare` plumbing test).
- `useReadingWitness`: active-time does not accrue while hidden/blurred (the pause
  invariant), completion fires once.

## Out of scope

Vitrification, the quintessence-seal crystal, the transit-of-Mercury silhouette, the
sodium tail, and any scroll-velocity / cursor-magnetosphere surface effects. All
considered, all cut.
