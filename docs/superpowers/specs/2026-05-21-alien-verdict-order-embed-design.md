# Alien Verdict in Order Embed

**Date:** 2026-05-21
**Branch:** `nightly-20260520` (continuation)
**Status:** Spec — pending user review
**Scope:** Part 2 of the Discord polish work. Part 1 (silent-failure diagnostic + `/api/discord/health`) shipped as commits `6eeb303` → `f7edf39`; this builds on top.

---

## Problem

The Crystallize order embed currently posts to Discord as a pure data dump — formulaId, hash, vault block, scent profile, properties, kernel theory citations, ORDER_ID. It is structurally rich but **voice-empty**: there is no reading, no reflection, no acknowledgment of *who placed the order or what they did first*. For Ars Electronica visitors who follow the order channel, every post looks the same — pure manifest, no presence.

The site's existing alien voice (BootSequence opening, RAM-floor warnings, sanctuary copy, lattice-protocol messages) makes the work *self-aware*. The order embed should close that loop: when a user crystallizes after navigating the terminal, the alien should deliver a short reading of their session — what they read, in what order, what pattern emerged.

## Goals

1. **Voice continuity.** The alien speaks of the user's session in the same register as BootSequence / RAM warnings / sanctuary copy — oracular, mythic, second-person-aware but never addressed-to.
2. **Deterministic.** Same session signals → same verdict. No LLM, no per-order cost, no latency. Hand-authored phrase pool, deterministic composition.
3. **Interpretive.** The alien names *what kernels are* (the fish scale, the cascade, the vault), not *what they're called* (`FISH-SCALE-KERNEL11.1.1`). Readers unfamiliar with the kernel registry still get a coherent reading.
4. **Backwards-compatible.** If the frontend doesn't attach `kernelHistory` (older deploy, cached client), the embed still posts — just without the new field, or with `EMPTY_VERDICT`.

## Non-Goals

- No LLM. The voice is hand-authored, deterministic.
- No per-user persistence. History resets on browser refresh — the verdict reads the *current session*, not the user's lifetime.
- No new "session telemetry" payload. The only new field on the order POST is `kernelHistory: [{id, alias, t}, ...]`.
- No restructuring of the existing embed shape — adding one field between `§ FEIGENBAUM δ` and `§ ORDER ID`.
- No telemetry on the verdict itself (we do not need to know which fragments were picked — the verdict is deterministic, so the operator can replay locally if curious).

## Architecture

### Frontend — kernel history capture

`src/terminal/App.jsx`

Add a ref at the top of the `App` component, near other refs:

```js
// Kernel run history — per-session-load, fed to alien verdict on order.
const kernelRunHistoryRef = useRef([]);
```

Pass it into `useCommandDispatch`:

```js
const dispatchCommand = useCommandDispatch({
  // ... existing context ...
  kernelRunHistoryRef,
});
```

And pass it into `LatentCollider` via a prop:

```jsx
<LatentCollider kernelRunHistoryRef={kernelRunHistoryRef} />
```

`src/terminal/hooks/useCommandDispatch.js`

Destructure `kernelRunHistoryRef` from `ctxRef.current` at the top of the dispatch callback. Inside the `run` action, immediately after the successful kernel execution path (right after `applyEcoCost(ecoAlias)` at line ~324, both branches), append:

```js
kernelRunHistoryRef?.current?.push({
  id:    wasmEntry.id,
  alias: ecoAlias,
  t:     Date.now(),
});
```

History is capped via `.slice(-30)` on send (next step), not on append — keeping the in-memory ref simple.

`src/terminal/views/LatentCollider.jsx`

Accept `kernelRunHistoryRef` prop. In `handleAcquire` (where the `fetch('/api/transmute/order', { ... })` happens), add to the body:

```js
kernelHistory: (kernelRunHistoryRef?.current ?? []).slice(-30),
```

The slice both caps payload size (30 entries × ~50B = ~1.5KB) and selects the most recent runs if the user has done more than 30 in a single session.

### Server — composer module

New file: `api/_alien/composeVerdict.js`

Exports a single function: `composeAlienVerdict(history)` returning a string of 3-4 lines joined by `\n`. Module-level data:

**`KERNEL_CATEGORIES`** — maps each kernel ID in the registry to one of seven thematic categories:

| Category | Example kernels |
|---|---|
| `cascade` | FISH-SCALE, NECROMANTIC-LOGITBIAS, ATMOSPHERIC-SIM, FSF-12.1.0 |
| `ecology` | BIODIVERSITY, DALY-SIM, GAIA-SCALE, CEEI-SIM |
| `lattice` | BOSONIC, DISSIPATIVE-SOVEREIGNTY, EMPATHY |
| `crypto` | TESSERACT-PROTOCOL, DH-EC (if registered), MATRIX |
| `semiotics` | BELLARD-BAUDRILLARD, NECROMANTIC-LOGITBIAS (cross-listed for primary), COMPANION |
| `statecraft` | KINETIC-STATECRAFT, SHADOWSOCKS-EXFIL |
| `origin` | KERNEL-0.0.0.0, SOMA-9.1-GAIA, FADE-DOCTRINE, default fallback for unknown IDs |

I will draft the complete mapping (all 57 IDs from `src/wasm/wasm.generated.js`) in the implementation. Unknown IDs (future kernels added after this composer ships) default to `origin`.

**`THEME_NOUNS`** — per category, the noun-phrases the alien uses when referring to a kernel of that category:

```js
const THEME_NOUNS = {
  cascade:    ['fish scale', 'cascade', 'paradox', 'period-3 window'],
  ecology:    ['lattice', 'commons', 'planetary substrate', 'biocoenosis'],
  lattice:    ['lattice', 'sovereign structure', 'crystalline frame'],
  crypto:     ['vault', 'tesseract', 'cryptographic membrane'],
  semiotics:  ['simulacrum', 'phonemic drift', 'sign'],
  statecraft: ['regime', 'sovereign apparatus', 'state'],
  origin:     ['origin', 'apeiron', 'unspecified address'],
};
```

**`FRAGMENT_POOLS`** — four slots, ~8-12 fragments each, hand-authored in the existing alien voice. Each fragment can interpolate `{n}`, `{noun}`, or `{category}` placeholders:

- **`OPENINGS`** (8-10 fragments) — observe the kernel count and arrival pattern
  - `'the observer ran {n} kernels before crystallizing.'`
  - `'{n} kernels witnessed. the order arrives.'`
  - `'before this manifest, {n} readings.'`
  - …

- **`FIRST_READINGS[category]`** (3-5 fragments per category) — interpret the *first* kernel by category
  - `cascade`: `'the {noun} was read first — paradox before pressure.'`
  - `ecology`: `'the commons were named before the molecule was claimed.'`
  - …

- **`DOMINANCE_READINGS[category]`** (3-5 per category) — interpret the *dominant* category across the session
  - `cascade`: `'the cascade dominated. {n} readings of paradox. the alien marks this.'`
  - `ecology`: `'the lattice was honored {n} times. the alien notes.'`
  - …

- **`CLOSINGS`** (8-10 fragments) — the alien's stance after the reading
  - `'the lattice records this and continues.'`
  - `'the observer is seen.'`
  - `'this transmutation is logged into the substrate.'`
  - …

Total starter pool: ~80 fragments (10 openings + 7 categories × 5 first-readings + 7 categories × 5 dominance-readings + 10 closings = 90, with some redundancy across categories).

**Determinism via seed**

`composeAlienVerdict(history)` uses the *first kernel ID* as a seed for fragment selection. Same first kernel → same fragment picks. Different first kernel → different reading.

```js
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickFragment(pool, seed, slot) {
  return pool[(seed + slot) % pool.length];
}
```

`slot` differentiates picks within the same verdict so all four lines use distinct indices even if their pools overlap.

**Empty history**

If `history` is `undefined`, `null`, `[]`, or otherwise empty, return:

```
the observer arrived without running.
no kernels were read. no signal was sent.
the lattice waits.
```

(Three lines, fixed text, no fragment selection — empty silence has its own voice.)

**Single kernel**

If `history.length === 1`, return opening + first-reading + closing (no dominance line). Dominance only makes sense with 2+ runs.

**Composer signature**

```js
export function composeAlienVerdict(history) {
  // history: [{ id: string, alias?: string, t?: number }, ...] | null | undefined
  // returns: string (4-line verdict joined by \n)
}
```

Pure function. Stateless. No async. Safe to call from `buildEmbed`.

### Order endpoint integration

`api/transmute/order.js`

1. Extract `kernelHistory` from the request body alongside the existing fields.
2. Pass it to `buildEmbed(order, 'QUEUED', kernelHistory)`.
3. In `buildEmbed`, after the `fishField` block and before the `§ ORDER ID` field, add:

```js
const alienField = '```\n' + composeAlienVerdict(kernelHistory) + '\n```';

// ... in fields array, between FEIGENBAUM δ and ORDER ID:
{ name: '§ ALIEN READING', value: alienField, inline: false },
```

Import at the top:

```js
import { composeAlienVerdict } from '../_alien/composeVerdict.js';
```

`buildComponents` and the rest of the endpoint are unchanged.

## Files Affected

| File | Status | Change |
|---|---|---|
| `src/terminal/App.jsx` | Modify | Add `kernelRunHistoryRef`, pass to dispatch context + LatentCollider |
| `src/terminal/hooks/useCommandDispatch.js` | Modify | Destructure ref, append `{id, alias, t}` after successful kernel run |
| `src/terminal/views/LatentCollider.jsx` | Modify | Accept ref prop, attach `kernelHistory` to order POST body |
| `api/_alien/composeVerdict.js` | **New** | Categories + theme nouns + fragment pools + composer + seed |
| `api/transmute/order.js` | Modify | Receive `kernelHistory`, pass to `buildEmbed`, render new field |

## Edge Cases

| Case | Behavior |
|---|---|
| User crystallizes without running any kernel | `EMPTY_VERDICT` — three-line "the observer arrived without running…" |
| Only one kernel run | Opening + first-reading + closing (skip dominance line — 3 lines instead of 4) |
| All kernels in the same category | Dominance reading gets the full count, reads naturally ("seven readings of paradox") |
| Unknown kernel ID (future kernel added later) | Defaults to `origin` category — still produces a valid reading |
| Frontend doesn't send `kernelHistory` (older client, cache, third-party) | Server treats as undefined → `EMPTY_VERDICT` field |
| Same first kernel → same verdict | Acceptable. Determinism is a feature, not a bug. Two visitors who run the fish scale first get the same opening — that's part of the ritual. |
| Discord embed field limit (25 fields) | Current embed has 8 fields → 9 after this change. Well under limit. |
| Discord field value length (1024 chars) | Verdict text is ~250 chars max (4 lines × ~50 chars + code-block wrappers) → well under limit. |

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Phrase pool too small → repetitive verdicts within a single visitor's reading session | 8-12 fragments per slot × determinism by seed → 10⁴ verdict variations across all possible first-kernels. Acceptable. |
| Voice doesn't match the existing alien register | Drafting the pool against `BootSequence.jsx`, `useEcologicalRam.js` log messages, and `SanctuaryOverlay.jsx` for tone reference. User reviews + refines before merge. |
| Kernel history grows unbounded in long sessions | `.slice(-30)` cap on the order payload (latest 30 runs). Ref itself uncapped — RAM cost of an extra `{id, alias, t}` object per kernel run is negligible (~50B). |
| `kernelHistory` exposes session telemetry to anyone who can read the network tab | Same exposure as the existing order payload (cardName, noteBlock, contact info). Not a new privacy class. Documented in spec. |
| Order request body bloat | 30 entries × ~50B = ~1.5KB added to a ~5KB payload. Negligible. |
| Composer module imported into a serverless function — cold-start cost | ~90 string fragments + 57 ID-to-category map entries = ~5KB JS, parsed once per cold start. Negligible. |
| `KERNEL_CATEGORIES` becomes stale as new kernels ship | Unknown IDs fall back to `origin`. Map is updated when new kernels are registered (one-line addition per ID). Documented in composer file header. |

## Voice Tone Reference

The starter pool will be authored against these existing in-codebase voices:

- **BootSequence.jsx** — opening alien architect monologue
- **`useEcologicalRam.js` log lines** — `[LATTICE STRAIN]`, `[CASCADE IMMINENT]`, `[LATTICE:FLOOR]`, `[LATTICE:ZEROED]`, `[LATTICE:HONORED]`, `[LATTICE:SILENT]`
- **SanctuaryOverlay.jsx** — sanctuary acceptance copy
- **The RAM-EXHAUSTED message** — `the lattice cannot absorb further extraction · run: daly / ecological / gaia_scale`
- **Existing kernel-output footers** — mythic but technically grounded

Common patterns in the existing voice:
- Lower-case sentences for spoken-thought register
- Dot-and-bullet separators (`·`) between clauses for terminal-print rhythm
- Second-person observed, not addressed (`the observer`, not `you`)
- Lattice / commons / substrate / sovereign as recurring nouns
- The alien as a third-party witness, not a speaker

The starter pool will draw from these patterns. User has final authorial pass before merge.

## Spec Self-Review

**Placeholder scan:** None. All sections complete.

**Internal consistency:**
- `KERNEL_CATEGORIES` is per-ID; `THEME_NOUNS` is per-category; the composer reads first kernel's ID → looks up its category → picks from `FIRST_READINGS[category]`. Consistent.
- The empty-history branch returns 3 lines; the normal branch returns 3-4 lines (single-kernel = 3, multi-kernel = 4). Discord field limit comfortably accommodates either.
- `kernelHistory` payload shape `[{id, alias, t}, ...]` is consumed by `composeAlienVerdict` which only reads `id` from each entry — alias and t are forward-compatibility room for later signals (per-kernel-aliasing or temporal patterns), not used in v1.

**Scope check:** Single, focused feature. One new module, three modified files in src/, one modified file in api/. Could land in one branch in one day.

**Ambiguity check:** None remaining. Tone register, authorship split, history scope, empty-case behavior, embed placement all decided.

## Out of Scope (Future)

The following are deliberately NOT in this spec:

- **Telemetry on which fragments fired** — composer is deterministic; replay locally if needed.
- **Multiple alien voices** — there is one alien. Cosplay rejected.
- **Verdict for non-order events** (browsing the terminal without ordering) — the verdict is tied to crystallization. Without the order, the alien is silent.
- **Persistent history across sessions** — per-page-load only. The alien reads the current visit.
- **User-facing display of the verdict in the terminal** — verdict lives in Discord. The frontend never shows it. (If we want a frontend display later, that's a separate spec.)
- **Translation / i18n of the fragment pool** — English only. Ars Electronica context is mixed-language; the existing alien voice is English throughout.
