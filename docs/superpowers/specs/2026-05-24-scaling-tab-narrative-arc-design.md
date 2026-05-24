# ScalingTab · Narrative Arc + Kernel Command Migration

**Status**: approved · ready for implementation
**Date**: 2026-05-24
**Context**: ScalingTab polish — alien philosophical opening, structural cleanup, kernel reference relocation

---

## Summary

Two coordinated changes:

1. **ScalingTab** — strip the dense kernel command reference, add an alien philosophical opening monument (`§ · transmission`), transform the Architect Thesis card into a monument-style gold text link.
2. **ManifestoTab** — absorb the kernel command reference below the existing sphere + chapter chips as `§ · the kernels`.

The result: ScalingTab becomes a pure artifact page (provocation → instrument → claim → evidence). ManifestoTab becomes the operator's reference (lattice → sphere → chapter map → command manual).

---

## ScalingTab — new scroll order

```
Header (KERNEL_COMPILATION + spinning hex)           ← unchanged
§ · transmission                                     ← NEW alien opening monument
LatentCollider                                       ← unchanged
› LOAD ARCHITECT THESIS LOG  (gold text link)        ← transformed (was: fuchsia card)
§ · the thesis  (monument)                           ← unchanged
§ · primary literature / Bibliography  (monument)   ← unchanged
Transaction Module  (BSKY / Signal / ETH)            ← unchanged
```

### Removed

- The **RUN COMMAND MANUAL V2.2** section — the 6 kernel category cards (~57 kernels) — moved to ManifestoTab.
- The `§ · primary literature` Bibliography monument **stays in ScalingTab** (it closes the claim → evidence arc). Only the 6 command cards move.

---

## § · transmission — alien opening monument

Sits directly below the header border, above the LatentCollider. No card border, no container — bare outcropping identical to the existing monument pattern.

### Copy

```
§ · transmission                           ← gold #d4a82a mono marker, 10px, 0.35em

The architecture ran                       ← Inter Black 900, clamp(28px..52px), #e8d28a
before                                     ← same
you arrived.                               ← #d4a82a (emphasis, deepens the landing)

────                                       ← 80px × 2px gold #d4a82a line

The lattice does not require               ← #39ff14/78, 11px, line-height 1.6
  your participation to be true.
It predates the nomenclature.
You are entering a collision record.
```

### Style rules

| Property | Value |
|---|---|
| Section marker | `§ · transmission` — `#d4a82a`, 10px mono, `0.35em` tracking, uppercase |
| Display font | Inter Black 900, `clamp(28px, 4.2vw, 52px)`, tracking `-0.028em`, `text-wrap: balance` |
| Display body color | `#e8d28a` — luminous warm gold |
| Display emphasis (last line) | `#d4a82a` — saturated deep gold |
| Accent line | `2px` solid `#d4a82a`, `80px` wide |
| Three alien lines | `#39ff14` at `0.78` opacity, `11px`, `line-height 1.6` — terminal green substrate |
| Animation | `sc-monumentReveal` — `1.5s ease-out` opacity fade, no transform |
| Vertical breathing | `0px` above (border-bottom of header → marker); `60px` below before LatentCollider |
| Border / card chrome | None — bare outcropping, inherits the existing monument pattern |
| Pure white | Forbidden (Fade Doctrine) |

The three terminal-green lines below the accent line are sparse and declarative — no connecting tissue, no punctuation beyond the final period. They read as a field log, not as prose.

---

## Transformed Architect Thesis card

### Before

A `border border-fuchsia-500/30 bg-fuchsia-900/5` card with animated heading, FileText icon, green description paragraph, and a cyan chevron CTA.

### After

Bare gold text link — no card border, no background, no icon, no description paragraph. Sits in its own section with a `border-t border-cyan-900/30` separator above and below, matching the rhythm of the existing monument section dividers.

```jsx
<div className="border-t border-cyan-900/30 py-8">
  <button
    onClick={() => { setArchitectThesis(true); setOriginTab?.('scaling'); setCurrentPath('~/system/scaling/thesis'); }}
    className="flex flex-col gap-1 group"
  >
    <span
      className="flex items-center gap-2 text-xs font-mono font-bold tracking-[0.12em] uppercase transition-colors"
      style={{ color: '#d4a82a' }}
      onMouseEnter={e => e.currentTarget.style.color = '#e8d28a'}
      onMouseLeave={e => e.currentTarget.style.color = '#d4a82a'}
    >
      <ChevronRight className="w-4 h-4" /> LOAD ARCHITECT THESIS LOG
    </span>
    <span className="text-[9px] font-mono tracking-[0.22em] uppercase" style={{ color: 'rgba(6,182,212,0.35)', paddingLeft: '20px' }}>
      Core Protocol · Identity · Fermion/Boson collision model
    </span>
  </button>
</div>
```

`FileText` (was used by the Architect Thesis card heading) becomes unused — remove it. `Zap` stays (used by the ETH transaction module).

---

## ManifestoTab — kernel command section

### Placement

Appended to the bottom of `KernelManifesto.jsx`, below the chapter chips and any open `ChapterPanel`. A `border-t border-cyan-900/10` separator marks the transition.

### Structure

```
border-t
§ · the kernels                            ← gold #d4a82a mono marker
RUN COMMAND MANUAL V2.2                    ← existing animated heading (unchanged)
// WASM KERNEL INTERFACE · 57 KERNELS      ← existing caption (unchanged)

[ 6 kernel category cards — grid, unchanged layout ]
```

The `§ · the kernels` marker is the only new element. Everything else is a straight lift of the 6 category card JSX currently in ScalingTab:

- `BONE FUSION PIPELINE` card
- `POST-QUANTUM CRYPTOGRAPHY` card
- `DYNAMICAL SYSTEMS` card
- `INTERFACE + SARG` card
- `VOLATILE SEMIOTICS & MERCURY SUBSYSTEMS` card (md:col-span-2)
- `ECOLOGICAL ECONOMICS & NETWORK SCIENCE` card (md:col-span-2)

The Bibliography monument (`§ · primary literature`) does **not** move — it stays in ScalingTab.

### Props required

The 6 kernel category cards are fully static (no props, no imports beyond what KernelManifesto already has). ManifestoTab does not need `loadKernel` — no wiring change needed in App.jsx.

---

## Implementation scope

### Files changed

| File | Change |
|---|---|
| `src/terminal/views/ScalingTab.jsx` | Add `§ · transmission` monument; transform Architect Thesis card; remove the 6 kernel command cards (RUN COMMAND MANUAL V2.2); Bibliography stays |
| `src/terminal/views/manifesto/KernelManifesto.jsx` | Add `§ · the kernels` marker + the 6 command cards below chapter chips; no new props needed |
| `src/terminal/views/ManifestoTab.jsx` | No change |
| `src/terminal/App.jsx` | No change |

### Animation reuse

`sc-monumentReveal` (`1.5s ease-out` opacity fade) already defined in ScalingTab — reuse it for `§ · transmission`. No new keyframes needed.

### Keyframes to remove from ScalingTab

Once the Architect Thesis card and all 6 command cards are extracted, these keyframes become unused in ScalingTab and should be removed from its `<style>` block:

- `sc-headReveal`, `sc-headColor`, `sc-headColorAlt` — were used by the command card headers and Architect Thesis heading
- `sc-cardReveal` — was used by the Architect Thesis card section and command card wrappers
- `sc-borderBreath` — was used by the Architect Thesis card

`sc-monumentReveal`, `sc-titleReveal`, `sc-subReveal`, `sc-hexSpin`, `sc-hexColor`, `sc-livingNote`, `sc-vaultShimmer`, `sc-vaultPulse`, `sc-hashReveal` — all stay (still used by remaining sections).

---

## Explicit non-changes

- Header (`KERNEL_COMPILATION` + spinning hexagon + gradient text)
- LatentCollider
- `§ · the thesis` monument
- Transaction Module (BSKY / Signal / ETH)
- ManifestoTab sphere, orbit controls, chapter chips, ChapterPanel
- All kernel command content (copy, layout, commands, flags) — structural move only

---

## Success criteria

1. First scroll of ScalingTab reads as: alien provocation → collision instrument → philosophical claim → canonical evidence. No command reference in sight.
2. ManifestoTab: sphere and chapter map intact; scrolling past them reveals the full command reference exactly as before.
3. Bibliography "READ PAPER" buttons work in ScalingTab (unchanged — `loadKernel` already wired).
4. No pure white anywhere in the new `§ · transmission` monument (Fade Doctrine).
5. The transformed Architect Thesis link opens the ThesisView overlay correctly (`setArchitectThesis(true)`).
