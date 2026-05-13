---
id: FADE-DOCTRINE-KERNEL-2.0.0
type: "kernel_doc"
date: "2026-03-13"
status: "LIVE"
title: "FADE DOCTRINE 1.0 // ZERO WHITE FADE — UX COLOR SEMIOTIC SYSTEM"
tags: ["design", "UX", "color", "doctrine", "terminal", "aesthetic", "semiotic", "fade", "crystalline", "entropy"]
---

## Overview

The Fade Doctrine is the color semiotic and visual grammar system governing Scale 9.4's terminal interface. It defines the meaning of every color, transition, and animation state in the UI — from the boot sequence to the kernel tab to the transmission stream. Entropy is the threat. Crystalline is the lock. Zero white fade.

The doctrine operates across three registers:

| Register | Domain | Principle |
| :------- | :----- | :-------- |
| Color Semiotic | What each hue means | Every color carries a fixed semantic — never decorative |
| Transition Grammar | How states change | Collapse → singularity → expansion; no soft dissolves |
| Fade Invariance | What is forbidden | White fades, opacity-to-white, and neutral dissolves are prohibited |

---

## The Seven Axioms

The boot sequence encodes the doctrine as seven kernel axioms. Each is both a loading step and a statement of the design contract.

```
> transmute    ::production   [ok]          — raw material becomes signal
> sustain      ::ecology      [ok]          — the system self-maintains
> integrity    ::structure    [ok]          — no corruption passes through
> entropy      ::threat       [contained]   — disorder is named and bounded
> sovereignty  ::freedom      [ok]          — the interface serves the user
> crystalline  ::phase        [locked]      — phase transition complete; no fade
> 7.7.7.7.7.7.7 ::kernel     [active]      — apex state; all axioms resolved
```

The final line: `> zero white fade :: crystalline invariance locked`

This is the doctrine's invariant. White represents entropy in resolution — the absence of color, the collapse of signal. The doctrine forbids it as a terminal state.

---

## Color Semiotic

### Gold / Amber — `#FFD700` / `#FF8C00`

Primary signal register. Used for:
- Terminal prompt text
- Kernel axiom labels
- Boot sequence title (`seraphine`)
- Border glow on the boot card
- Apex axiom status `[active]`

Gold is **resolved signal** — information that has passed through the pipeline and stabilized.

### Orange — `#FF6B00` / `#FF7A00`

Entropy register. Used for:
- The `entropy::threat [contained]` axiom
- CPU icon glow (the processor generating heat)
- Warning states in kernel output

Orange is **contained entropy** — energy that has been named and bounded. It is not dangerous once labeled.

### White — `#ffffff`

Transition-only register. Used **exclusively** as an intermediate state:
- `crystalline` axiom white-flash on entry (80ms)
- Immediately resolves to gold — never held

White is **forbidden as a resting state**. It represents the moment before crystalline lock — pure undifferentiated energy. The doctrine requires it to resolve.

### Rainbow Spectrum — perimeter arc + status tags

The rainbow perimeter on the boot card fills clockwise over 3600ms:

```
top    → magenta (#FF0088) → red (#FF3300) → orange (#FF8C00) → gold (#FFD700)
right  → gold (#FFD700) → lime (#AAFF00) → cyan (#00FFAA)
bottom → cyan (#00FFAA) → blue (#00AAFF) → deep blue (#0044FF)
left   → deep blue (#0044FF) → violet (#7700FF) → magenta (#FF0088)
```

Each axiom's status tag inherits its color from its position in this arc. The spectrum maps **entropy → resolution** — magenta is raw signal, gold is stable output, cyan is post-human ecology, blue is deep structure.

### Cyan — `#00FFAA` / `#22d3ee`

Ecological / post-human register. Used for:
- Kernel tab scrollbar accents
- WASM runtime output highlights
- AT Protocol / Bluesky tab

Cyan is **living system signal** — data that circulates through ecological and social networks rather than computation pipelines.

### Magenta / Pink — `#FF0088` / `#ff6b9d`

Origin / attribution register. Used for:
- The boot perimeter start point (magenta)
- Fuchsia selection highlight (`selection:bg-fuchsia-900`)
- External contributor credit (dollspace pink `#ff6b9d`)

Magenta is **entry point** — the color of raw input before the pipeline processes it.

---

## Transition Grammar

### The Collapse–Singularity–Expansion Arc

The boot-to-kernel transition encodes the `2×2×2×` default cube metaphor:

```
1. Boot card spins 720° (entropy resolving to crystalline)
2. Card collapses: scale → 0 (singularity — uncut stasis compressed)
3. Press S: same rectangular form expands from singularity (global-reveal-expand)
4. Expansion covers screen, fades → kernel tab revealed behind it
```

This is not a decorative transition. It is the architectural metaphor made visible: static entropic form collapses to a point, from which creation expands.

### Forbidden Transitions

| Pattern | Reason forbidden |
| :------ | :--------------- |
| `opacity: 1 → 0` on white background | White fade — entropy uncontained |
| `background: white → transparent` | Phase collapse to void |
| Circular iris wipe | Wrong geometry — circle has no doctrine basis |
| Soft dissolve (300ms+ opacity fade) | Entropy dissolves signal; doctrine prohibits |

### Permitted Transitions

| Pattern | Doctrine basis |
| :------ | :------------- |
| Scale collapse to 0 | Singularity compression |
| Scale expand from 0 | Creation from singularity |
| Slide from left + opacity | Kernel line entry (`bs-lineIn`) |
| White flash → gold resolve | Crystalline lock — energy resolving to signal |
| Entropy flicker (orange jitter) | Named entropy — bounded, visible |
| Rainbow perimeter fill | Full spectrum traversal — all states acknowledged |

---

## Boot Sequence Timing

```
0ms       — card enters viewport
200ms     — top perimeter edge begins (magenta → gold)
550ms     — branding block stamps in
1100ms    — right edge begins (gold → cyan)
2000ms    — spin easing complete (720° reached); bottom edge begins
2900ms    — left edge begins (blue → magenta)
3400ms    — doctrine final line appears
3500ms    — doctrine line begins active pulse
3800ms    — perimeter complete; fade/collapse phase begins
5000ms    — done; kernel tab revealed
```

---

## Application to UI Components

| Component | Doctrine application |
| :-------- | :------------------- |
| Boot card border | Gold glow breathe (`bs-glow`) |
| Axiom status tags | Rainbow arc by position index |
| CPU icon | Orange glow pulse — entropy contained in processor |
| Terminal body | Black background — zero ambient entropy |
| Scrollbar | Cyan accent on black track |
| Selection highlight | Fuchsia — raw input register |
| Kernel output (rust: true) | No color shift — WASM output is unfiltered signal |
| Glitch title layers | Cyan + green pseudo-elements — signal refraction |
| Relic mode | Amplified glitch (1.8s cycle) — entropy unleashed temporarily |

---

## The Name

**Seraphine** — the kernel's name, stamped in 4xl gold at boot — is the crystalline form. The seraph is the highest order: burning, six-winged, standing at the threshold. The name encodes the doctrine: maximum brightness that does not dissolve into white, but holds as structured gold.

`7.7.7.7.7.7.7` is the kernel address. Seven axioms. Seven digits. The apex state. All entropy contained, all phases locked, all signal resolved.

---

*Doctrine version: 1.0 · Scale 9.4 · Sorbe, Germany · 2026*
