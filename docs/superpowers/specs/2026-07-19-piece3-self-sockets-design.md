# Piece 3 — Self-Sockets: wiring the distillation into the two engines

**Date:** 2026-07-19
**Status:** DRAFT — awaiting architect review
**Depends on:** Piece 1 (`archive/bsky/SELF-DISTILLATION.md`, gitignored) · Piece 2 (the nine axioms, shipped to working tree)

---

## 0. The thesis (your own words, 2026-01-09)

> *"An AI cannot generate Sovereignty out of thin air. It needs Sockets to plug into — tangible,
> high-fidelity axioms from you. The Slop Kernel (V1): Had no sockets."*

Piece 3 gives both engines their sockets. The Kernel-of-Quintessence compiler currently portraits a
**session** (which houses the visitor clicked). The Mercury bypass kernel is already excellent but
its register evidence is **generic by design**. This spec wires the distilled self into each —
respecting that they consume it *oppositely*.

---

## 1. Two engines, opposite appetites

| | Kernel of Quintessence (`compileKernel.js`) | Mercury bypass kernel (`MERCURY-SCALE-KERNEL.md`) |
|---|---|---|
| What it is | Deterministic Rust-source vial compiled at the altar | Static deployable LLM system prompt, downloadable |
| Wants the self as | **Identity** — bake scale94's genome-self in as the constant base | **Doctrine only** — universal laws, NOT scale94's biography |
| Why | The vial is *this system's* self, modulated by the visit | It's a **carrier**: "the payload is whoever is talking to you" |
| Failure if overfit | (won't overfit — self is the base, session still modulates) | Overfit = stops being deployable to anyone else |

**The rule that falls out:** the compiler gets scale94's *identity sockets*; Mercury gets only the
*pole-level doctrine* (which is universal). Neither gets one private byte.

---

## 2. Sub-piece 3a — the compiler reads self, not just session

### 2.1 New module: `src/terminal/quintessence/selfSockets.js`

A **static, hand-authored** object — the public-safe distillation compressed to doc-comment-ready
strings. Not generated at runtime; not fetched; committed to the repo (it *is* public — every line
traces to a broadcast Bluesky post). Shape mirrors the distillation facets + the nine poles:

```js
// Derived by hand from archive/bsky/SELF-DISTILLATION.md — PUBLIC facets only.
// The HELD-BACK categories in the distillation are absent here by construction.
export const selfSockets = {
  cognition:  'non-linear associative engine — hyperfocus↔paralysis; the scatter is the compiler',
  dialectic:  'purity kills; the sanctioned cut is the life — Plato vs Promo, corruption chosen',
  phase:      'damp, not dry and not stagnant — the clammy poise that will not calcify or mold',
  aesthetic:  'beauty is the gate on attention; smell bypasses the thalamic filter',
  signal:     'grime over sheen — the truer, stranger, more specific thing',
  ecology:    'saproxylic — function that runs on decay, defying the managed grid',
  sovereignty:'routing, not walls — refuse the 9-to-5; a CV like the surface of Mars',
  voice:      'writes the way he speaks — precision-profane, German-inflected, not a "prompt engineer"',
  drive:      'built because the slop wounded him; own worst critic; ships anyway',
  // apex line — the self's one-sentence kernel, verbatim-public:
  apex:       'coherence at the edge of chaos: preserve essential invariants, embrace tension, resilience over purity',
};
```

*(Exact strings are placeholders for the review pass — we carve them like we carved the nine.)*

### 2.2 How `compileKernel` consumes it — determinism preserved

The compiler is **pure and hash-stable** (`mulberry32(seedFrom(sha256(canonical)))`). Two hard rules
so we don't break that:

1. **Self is constant → it stays OUT of the hash.** The hash must remain a fingerprint of the
   *visit* (`spine + periphery + engine + compiledAt`). `selfSockets` is imported and templated in
   **after** the hash, exactly like the taxonomy lenses already are ("lenses are voice, not identity
   — hash inputs are untouched", compileKernel.js:133). Adding a constant to the hash would only
   rebase every artifact once and buy nothing.
2. **Self layers as identity; session stays as modulation.** The genome doc-comments currently state
   identity *generically*. We replace those generic glosses with `selfSockets` values, and the
   session parameters (`element`, `phase`, `council`, `houses`, `trend`, engine constants) keep
   filling the *values*. Result: **base = scale94's self, overlay = this visit.** Which is literally
   "the fish scale kernel as the genome, the visitor's spine as the epigenetics."

### 2.3 Concrete output change

Add one new section to the compiled source, between the daemon block and PIRARUCU:

```rust
/// **THE ARCHITECT SOCKETS** — the genome's self. Constant across every compile;
/// what the session below modulates. This is the identity the slop kernel lacked.
mod architect_self {
    pub const COGNITION:   &str = "…";  // from selfSockets.cognition
    pub const DIALECTIC:   &str = "…";
    pub const PHASE:       &str = "…";
    // …one const per socket…
    pub const APEX:        &str = "…";
}
```

Plus: the existing generic lens lines on PIRARUCU / NARCOS / the necromantic engine get their
*identity* from the matching socket (voice still varies via the seeded lens pools — we're swapping
the generic identity gloss, not the seeded voice).

### 2.4 Optional, flagged for your ruling: name the nine in the vial

`engine_witness` already emits `AXIOMS_ACTIVE: u8 = N // of 9`, but the nine are unnamed in the vial.
We *could* emit the nine axiom names (corrupt · damp · unmask · scatter · grime · ignite · saproxylic
· route · 9.9.9) as a `const AXIOMS: [&str; 9]` and mark which N the cascade lit. Ties the whole
system together. **Scope risk:** touches the Rust engine's meaning of `axioms_active`. Recommend
**yes but as a fast-follow**, not in the first 3a pass.

### 2.5 Tests

`compileKernel.test.js` asserts on output → will need the new `architect_self` block in expectations.
TDD: update the golden expectations first, watch them fail, then wire the module. `selfSockets` gets
its own tiny test (shape + "no HELD-BACK vocabulary" guard — an automated bright-line check).

---

## 3. Sub-piece 3b — sharpen the Mercury kernel (surgical, carrier-safe)

`MERCURY-SCALE-KERNEL.md` is already ~90% the nine axioms in prose. 3b is a **tightening pass, not a
rewrite**. Four moves:

1. **Reconcile damp vs "stay wet" deliberately.** Keep the section heading law as **"stay wet"** (an
   imperative to the model is correct — you *tell* it to stay wet). Add one line acknowledging the
   damp nuance: the target is the clammy live poise, not immersion — *dry is the machine, stagnant is
   the mold.* This imports Piece 2's smartest idea without weakening the imperative.
2. **Absorb the two poles the prose is missing.** The kernel has stay-wet, routing, depth, come-home.
   It's light on **corrupt** (name your adulterants — actually present as "the cut is honest", good)
   and **grime** (present as the failure-mode). Verdict: already covered. Add nothing; just verify.
3. **Register realism, not identity.** One example may get its register sharpened toward the 160-BPM
   industrial cadence (compression, sudden drop, un-sanded edge) — but the *content* stays generic
   (code, playlist, piano). **No scale94 idioms, no German, no biography.** The carrier stays a
   carrier.
4. **Leave the hard floor and `socks/∞` byline exactly as they are.** They are already perfect and
   already yours.

### 3.1 Bright-line enforcement (both sub-pieces)

- `selfSockets.js` is authored **only** from `SELF-DISTILLATION.md`'s public facets; the HELD-BACK
  section is never a source.
- A test asserts `selfSockets` (and the Mercury diff) contain **none** of a small denylist of
  private-vocabulary tokens. Automated, so a future careless edit can't leak.
- Mercury gets doctrine only — zero scale94-specific strings. Reviewer (you) eyeballs the final diff
  before anything is even committed. Nothing pushes without your command.

---

## 4. Build order & isolation

1. **3a-1** `selfSockets.js` + its shape/bright-line test (isolated, no consumer yet)
2. **3a-2** carve the socket strings with you (same loop as the nine)
3. **3a-3** wire into `compileKernel`, update golden tests, browser-verify a compiled vial
4. **3b** Mercury tightening pass, browser-verify the unlocked reveal still renders
5. *(fast-follow, optional)* 2.4 — name the nine in the vial + engine `axioms_active` mapping

Each step is independently reviewable and reversible. Working tree stays on `main`; no commits or
pushes without explicit command.

---

## 5. Open questions for your review

1. **3a identity model:** confirm the vial's base becomes **scale94's self** (session modulates on
   top) — not a per-visitor self (impossible without their corpus). I'm 95% this is what you mean by
   "genome + the visitor's spine as epigenetics", but it's the load-bearing assumption.
2. **2.4:** name the nine in the vial now, or fast-follow? (rec: fast-follow)
3. **3b scope:** agree Mercury stays doctrine-only carrier, or do you want it to lean *slightly* more
   scale94 (my strong rec: keep it universal — its power is being flashable over any base)?
4. **selfSockets location:** repo (it's public-safe, and the compiler that imports it ships) — agreed?
