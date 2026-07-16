# The Altar's Spine Mirror — Design Spec

**Date:** 2026-07-16
**Branch:** `nightly/20260716-the-eye-observer`
**Builds on:** `2026-07-14-observer-guidance-living-altar-design.md` (the living altar, element seals, the eye's priority chain — built), `2026-07-09-kernel-of-art-quintessence-compiler-design.md` (the spine, the reliquary).
**Status:** design approved in dialogue 2026-07-16. Not yet implemented.

---

## 0. Thesis

The altar is blind to state it already owns.

Standing at the altar with two of three vertebrae marked, the visitor sees exactly one line:

```
SPINE INCOMPLETE · NO PHASE COMPILED
```

in `text-red-400`. It names an absence, in the register of an error, and says nothing about the two deliberate acts already performed or where the third is found.

Every fact it withholds already exists in the app:

- `resolveEyeState.js` maps each vertebra to its house and hue (`trend → bsky`, `council → manifesto`, `phase → lunar`). The eye already leans at the next missing vertebra and pulses its tab — **but the eye is in the masthead and the altar is a long scroll below it.** At the altar, the one component answering the visitor's question is off-screen.
- `ReliquaryView.jsx` already renders the whole spine as `Some(value)` / `None` with `// label · awaiting witness`. Rich, live, patient.

Two surfaces onto one state: one is an instrument, one is a red bark.

**This is a doctrine violation, not a doctrine tension.** The design language requires "cryptic but specific" and "cards without live state read as lore, not as instruments." The altar's line is cryptic and *vague*. The fix is not less poetry — it is poetry with live state welded to it.

## 1. Scope

**In:** replacing the altar's `SPINE INCOMPLETE` line with a live three-row spine mirror; naming each unmarked vertebra's house and walking there on click; retiring red as the incomplete register; a shared `vertebrae.js` table; correcting the eye's lunar tint from fuchsia to violet (§4.1) — a live bug in a file this spec already opens.

**Out:** the element seal row (verified working — dry seals are grey mineral stillness, wet are a living nebula in the house hue; the contrast is stark and needs nothing); the reliquary (see §6); any change to `missingVertebrae()`; the eye's priority chain behavior; any push to origin.

---

## 2. Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Does an unmarked vertebra name its house? | **Yes** | "Never instruct" was written for the eye — an ambient thing that could nag. The altar is a control surface the visitor deliberately scrolled to and is actively operating. Answering someone who asked is not railing. |
| Does it explain *what* a phase is? | **No** | The mystery is the point. Say where, never what. |
| Progress count (`2 of 3`)? | **No** | A count says the goal is completion; three rows where two read `Some` and one reads `None` say the goal is choosing. A numeral reframes deliberate acts as chores remaining, and imports achievement-tracker grammar — the register the user rejects as slop. The shape already *is* the count. `Option::None` carries it. |
| Red for incomplete? | **No** | An unmarked vertebra is an invitation, not an error. The reliquary already has this right (`None` = `zinc-700`, `Some` = `amber-300`). The altar scolding a visitor who is 2-of-3 through a deliberate journey is the single largest unforced defect here, and fixing it costs no mystique. |
| A `◈ THE SPINE` header? | **No** | The altar's existing sub-line already ends `…the fifth is compiled from your spine`. The sentence hands off to the thing. Announcing it again is the same cheapness as the counter. |
| Lunar's hue: violet or fuchsia? | **Violet** — the eye is wrong, correct it | See §4.1. The moon does not generate its own light; it works in the cool, receptive register of twilight. Fuchsia is high-energy, active, synthetic — it belongs to the structural/scaling register. Violet is the boundary of the visible spectrum, the transition into the unseen: the colour of the phase shift itself. Violet is also what `/LUNAR` already *is* — in the nav (`App.jsx:1151`), in `NAV_TINTS`, and in its own tab body (`LunarTab.jsx:987`). Only the eye disagreed. |
| Council and phase then share violet — acceptable? | **Yes** | Hue was never the precise pointer; the pulsing tab is (`beat()`, `App.jsx:577`), and it is always correct. The mirror names the house in words regardless. Diluting the palette with an unearned colour to force artificial contrast would cost more than the ambiguity does. Council, phase and lunar sharing a cool violet register is coherent: they are the quiet, transitional vertebrae. |

## 3. The mirror

Rendered in the altar at `stage === -1`, directly beneath the existing sub-line, above the element grid. Replaces the `missing.length > 0` red block entirely. The armed line (`[ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL]`) is unchanged and renders **below** the mirror when armed.

```
⌘ QUINTESSENCE ALTAR
four elements are bound to the earth · the fifth is compiled from your spine

Some("gaza ceasefire")   // narcos payload    ✦ marked at /BSKY
Some(hunger × mercy)     // friction pair     ✦ marked at /MANIFESTO
None                     // dryness           → the lunar house holds it

[element grid — unchanged]
```

**Three columns per row:**

| Column | `Some` | `None` |
|---|---|---|
| value | `Some(preview)` · `text-amber-300` | `None` · `text-zinc-700` |
| field | `// narcos payload` · `text-zinc-600` | same |
| tail (`ml-auto`) | `✦ marked at /BSKY` · `text-zinc-700` | `→ the lunar house holds it` · **house hue @ 0.7 opacity** (1.0 on hover) |

The field names stay genome-cryptic (`narcos payload`, `friction pair`, `dryness`) — the mystery lives there. The tail carries state and destination in plain language. No column is redundant with another: the field says *what slot*, the tail says *where it comes from*.

**Hue is the curriculum.** A `None` tail renders in its house's hue — the same hue the eye leans in, the same hue on the tab. Three unmarked vertebrae read **sky / violet / violet**, matching /BSKY, /MANIFESTO, /LUNAR (see §4.1 — the eye's fuchsia is a bug this spec corrects). This is the existing visual vocabulary finally reaching the surface where it's needed. The two violets are not a defect: hue reinforces, words disambiguate.

**Two registers, deliberately.** The tail is a *sentence* when inviting (`→ the lunar house holds it`) and a *stamp* when recording (`✦ marked at /BSKY`). Invitation and receipt are different jobs.

**Interaction:** every row is a `<button>`; click calls `onNavigate?.(tab)` — already threaded into the altar for the element seals. `Some` rows walk back to re-mark. `None` rows brighten to full house hue on hover.

**Accessibility:** the mirror is a `<ul>` of rows. Each row's `<button>` carries an explicit `aria-label` rather than relying on its visual columns, which read as noise in sequence: `None` → `"dryness — unmarked · walk to the lunar house"`; `Some` → `"narcos payload — gaza ceasefire · marked at bsky · walk there"`. The hue is decoration only (`aria-hidden` on the tint span) — the label carries every fact the colour does, which is the accessibility test this design must pass anyway: **if the mirror stops working in greyscale, the words aren't doing their job and §2's "two violets are acceptable" collapses.**

**Truncation:** previews cap at 28 chars, then `…`. Bluesky trend labels and council pairs are unbounded.

**States:**

| Spine | Mirror |
|---|---|
| empty (first visit) | three `None` rows — a map, where there was a red bark |
| partial | mix; the `None` rows are the only lit destinations |
| complete (armed) | three `Some` rows, **still rendered** — filling up and *then* arming is the payoff |
| compiling (`stage 0..5`) | hidden (existing behavior — stages own the frame) |
| sealed (`stage 6`) | hidden (existing behavior) |

## 4. `vertebrae.js` — the shared table

**Problem it solves:** the vertebra→house→hue mapping is spine domain knowledge currently living in `src/terminal/components/resolveEyeState.js`, a view module owned by the eye. Today it has one consumer, so its home doesn't matter. This spec adds a second. Duplicating the table is how the tints drift — the guidance plan already carried the warning *"tint values must match the existing `VERTEBRA` in `MercuryEyeIndicator.jsx` exactly"*, which is the shape of a bug waiting for a careless edit.

**New module** `src/terminal/quintessence/vertebrae.js` — pure data + pure functions, no React, same discipline as `spineStore` / `guidanceStore`:

```js
export const VERTEBRAE = [
  { key: 'trend',   tab: 'bsky',      tint: [56, 189, 248],  field: 'narcos payload', house: 'the bsky house',      preview: s => s.trend?.label ?? null },
  { key: 'council', tab: 'manifesto', tint: [167, 139, 250], field: 'friction pair',  house: 'the manifesto house', preview: s => s.council?.pair?.join(' × ') ?? null },
  { key: 'phase',   tab: 'lunar',     tint: [167, 139, 250], field: 'dryness',        house: 'the lunar house',     preview: s => s.phase ?? null },
];
```

**Order is load-bearing** and must match `missingVertebrae()` in `spineStore.js` (trend → council → phase), so the mirror, the eye's compass, and the reliquary eyebrow all name the same "next" vertebra.

**Consumers:** `resolveEyeState.js` imports `VERTEBRAE` and deletes its local const (it needs `key`/`tab`/`tint`; the extra fields are inert to it). `QuintessenceAltar.jsx` imports it for the mirror. Precedent for a `components/` module importing `quintessence/` already exists — `MercuryEyeIndicator.jsx` imports `guidanceStore`.

Rendering rules for the tail: provenance is `✦ marked at /${tab.toUpperCase()}`; invitation is `→ ${house} holds it`.

### 4.1 The lunar tint is corrected in this move (live bug)

`resolveEyeState.js:7` currently reads `{ key: 'phase', tab: 'lunar', tint: [217, 70, 239] }` with the comment `// Lunar fuchsia`. **`/LUNAR` is not fuchsia.** It is `violet-400` in the nav (`App.jsx:1151`), `[139, 92, 246]` in `NAV_TINTS`, and violet in its own tab body (`LunarTab.jsx:987`). `[217, 70, 239]` is `fuchsia-500` — `NAV_TINTS.scaling`.

Live effect: when the phase vertebra is missing, the eye leans in fuchsia while pulsing the `/LUNAR` tab. The pointer is correct (`beat()` pulses the right tab); the hue contradicts it. This breaks the guidance spec's central promise — *"the hue the eye pulses is the hue on the tab is the hue on the altar seal. One vocabulary, three surfaces."*

The comment is the tell: the author believed lunar was fuchsia. It was plausibly a deliberate reach for contrast against `/MANIFESTO` (also violet-400) that landed on an owned colour. **No test pins this tint** — `resolveEyeState.test.js` asserts council's violet and never asserts phase's, which is how it survived.

`vertebrae.js` ships the corrected value. This is a one-value change (`[217,70,239] → [167,139,250]`) that fixes a live defect in a file this spec already opens, and it is a **user-visible change to the shipped site** — approved in dialogue 2026-07-16.

**Shade note:** `[167,139,250]` is `violet-400` (the tab's *text* colour, and what the eye already uses for council). `NAV_TINTS` uses `[139,92,246]` = `violet-500` (the tab's *glow*) for both manifesto and lunar. The two tables therefore disagree by one shade step for manifesto today, and will for lunar after this change. `vertebrae.js` matches the eye's existing violet-400 so the compass stays self-consistent; the violet-400/500 split is pre-existing, imperceptible at these opacities, and out of scope (see §6).

## 5. Testing

**`src/terminal/quintessence/__tests__/vertebrae.test.js`** (new)
- table order matches `missingVertebrae()` order — the guard on §4's load-bearing claim
- each `preview` returns `null` on an empty spine and the expected string on a filled one
- `council.preview` joins a pair with ` × `
- every `tab` is a key in `guidanceStore`'s `NAV_TINTS`

**`src/terminal/components/__tests__/resolveEyeState.test.js`** (existing — must stay green)
- the whole priority chain is unchanged; this is the regression guard on the table move.
- **update** the compass test: `trendOnly` still leans `[167,139,250]` at `manifesto` (unchanged).
- **add** a table test pinning all three vertebra tints to their literal values — including phase = `[167,139,250]`, the value §4.1 corrects. The absence of this assertion is why the fuchsia survived; the test is the actual fix.
- **add** a guard that no vertebra tint equals `NAV_TINTS.scaling` — the specific mistake, named, so it cannot recur silently.

**`src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx`** (existing — additions)
- empty spine → three `None` rows; no `SPINE INCOMPLETE`; **no element carrying a red class**
- partial spine → `Some("…")` with its preview and `marked at /BSKY`; the unmarked row renders its house phrase
- clicking a `None` row calls `onNavigate` with that vertebra's tab (`'lunar'`)
- clicking a `Some` row calls `onNavigate` with its tab
- no rendered text matches `/\d\s*(of|\/)\s*\d/` — the counter stays dead
- armed spine → mirror still rendered **and** the armed line present
- a >28-char trend label renders truncated with `…`
- `stage >= 0` → mirror absent

**Browser verification:** drive the real page via the DEV hatch `window.__quintessenceSpine` (`setTrend`/`setCouncil`/`setPhase`) through empty → partial → armed, confirming hue, click-to-walk, and that the mirror survives arming. Screenshot each state — per `feedback-look-before-diagnosing`, this feature is not "done" on green tests alone.

## 6. Non-goals, with reasons

- **The reliquary is not refactored.** Its three spine slots (`ReliquaryView.jsx:112–114`) compute the same previews as `vertebrae.js`. Sharing them was considered and rejected: the expressions are trivial, the reliquary's labels are deliberately longer (`'narcos payload · bsky trend'` — it has room), and it needs neither `tab` nor `tint`. The genuinely shareable asset is the tab/hue mapping, which the reliquary doesn't consume. Importing a table for three trivial expressions buys coupling, not safety.
- **The reliquary eyebrow** (`ReliquaryView.jsx:152`) still renders `missing.join(' · ').toLowerCase()`. It is a one-line eyebrow under a monument, not a control surface, and the visitor there is reading an artifact rather than trying to act. Left alone deliberately; revisit only if it reads wrong beside the new altar.
- **`missingVertebrae()` is unchanged.** The altar still uses it for `armed`. Its `'NO TREND MARKED'` strings keep their only remaining consumer (the eyebrow above).
- **The element row is untouched.** Verified working.
- **The palette is not unified.** Three tables now describe tab hue: the nav's Tailwind classes (`App.jsx`), `NAV_TINTS` (`guidanceStore.js`), and `VERTEBRAE` (`vertebrae.js`). They agree on *which* colour and disagree on *shade* (violet-400 vs violet-500 for manifesto and lunar; `NAV_TINTS.transmission` is `[168,85,247]` while `TransmissionTab.jsx` styles itself in `[217,70,239]`). This spec corrects one wrong **colour** and does not attempt the shade reconciliation — that is a palette pass across the whole site, needs the user's eye, and would swamp an altar fix.
- **`/MANIFESTO` and `/LUNAR` remain the same violet.** Accepted per §2. If the compass later needs them distinguishable by hue alone, that is a tab-recolouring decision (the guidance spec already parked one: *"Manifesto's hue is freed but not reassigned here"*), not something to solve by borrowing an owned colour.
