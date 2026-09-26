# Nav bar icon polish, tier 4: the last four stock glyphs

**Date:** 2026-09-26 · **Branch:** `feature/nav-icon-tier4` (off main `2c7f837c`) · **Status:** design approved, not built

Follows `2026-09-26-nav-icon-polish-design.md` (tiers 1–3, merged to local main).
The same rule holds: **the icon draws what the tab does.** After tiers 1–3, the last
four lucide icons (`Cpu`, `Lock`, `KeyRound`, `Moon`) were the only stock glyphs
left in the bar, and they broke the set.

## Decisions (locked in brainstorm)

| Tab | Chosen | Rejected (and why) |
|---|---|---|
| Kernel | **K8**: a pinned processor frame with a diamond die | ᛟ rune (read as Norse rune / Bluetooth); plain nested square (dice / stop button); reliquary niche (tombstone); ring-0 diamond + 4 bus lines; frame + square die + 2 or 3 pins per side (≈ lucide `Cpu` stroke for stroke) |
| Privacy | **P3**: airgap enclave, a hexagonal perimeter broken by one airgap, holding an untouched diamond node | porous circles (read as targets / bullseyes); nested hexagons (hex nut) |
| Cryptography | **C1**: the hidden lattice point, a 3×3 lattice (ML-KEM is lattice-based) with the centre point ringed | lattice row in a capsule (reads as a pill) |
| Lunar | **M6b**: a sharp waxing crescent on the right, with the dark limb completed by a thin earthshine line | disc + terminator (lens bracket); disc + ticks (the brightness icon); onion/wisp; plain crescent (≈ stock `Moon`); filled crescent (breaks no-fill); dashed ghost limb (dashes break up at 12px) |

## 1. Components

Four files in `src/terminal/components/icons/`, built exactly like tiers 1–3
(`InterceptIcon` is the template): `React.forwardRef`, `displayName`, `viewBox="0 0 24 24"`,
`fill="none"`, `stroke="currentColor"`, `strokeWidth="2"`, round caps and joins,
`aria-hidden="true"`, and `className` plus extra props forwarded.

**`KernelCoreIcon.jsx`** (Kernel)
```
<path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />   the package frame
<path d="M12 8.5l3.5 3.5-3.5 3.5-3.5-3.5z" />                                         the diamond die (the kernel's own mark, not a generic square)
<path d="M9 1.5v2.5M15 1.5v2.5M9 20v2.5M15 20v2.5M1.5 9h2.5M1.5 15h2.5M20 9h2.5M20 15h2.5" />   the bus pins, two per side
```

**`AirgapIcon.jsx`** (Privacy)
```
<path d="M19.79 9.6V7.5L12 3 4.21 7.5v9L12 21l7.79-4.5v-2.1" />   the enclave wall, broken on the right by the airgap
<path d="M12 9.5l2.5 2.5-2.5 2.5-2.5-2.5z" />                     the sovereign node, untouched
```

**`LatticeIcon.jsx`** (Cryptography)
```
<path d="M5 5h0M12 5h0M19 5h0M5 12h0M19 12h0M5 19h0M12 19h0M19 19h0" />   the lattice (zero-length subpaths drawn by round caps)
<path d="M12 12h0" />                                                    the hidden point
<circle cx="12" cy="12" r="3.5" />                                       the ring that marks it
```

**`EarthshineMoonIcon.jsx`** (Lunar)
```
<path d="M12 3a9 9 0 0 1 0 18a5 9 0 0 0 0-18z" />                              the waxing crescent, lit on the right
<path d="M12 3a9 9 0 0 0 0 18" strokeWidth="1" opacity="0.55" />               the dark limb in earthshine
```

**Sanctioned exception (Lunar only).** The earthshine path is the only stroke in the
bar that is not 2px. It carries `strokeWidth="1"` and `opacity="0.55"` on the
`<path>`, not the `<svg>`, so the svg-level grammar still holds. Do not "normalise"
it to 2px: at 2px it reads as a full disc and the crescent disappears.

Each component gets a header comment in the voice of `InterceptIcon`: what the glyph
depicts in the tab, and what it replaced and why.

## 2. Wiring in `App.jsx`

| Tab | Desktop (`w-3 h-3`) | Mobile (`w-5 h-5`) |
|---|---|---|
| Kernel | `<Cpu …/> /Kernel` → `<KernelCoreIcon …/> /Kernel` | `<Cpu …/>` → `<KernelCoreIcon …/>` |
| Privacy | `<Lock …/> /Privacy` → `<AirgapIcon …/> /Privacy` | `<Lock …/>` → `<AirgapIcon …/>` |
| Cryptography | `<KeyRound …/> /Cryptography` → `<LatticeIcon …/> /Cryptography` | `<KeyRound …/>` → `<LatticeIcon …/>` |
| Lunar | `<Moon …/> /Lunar` → `<EarthshineMoonIcon …/> /Lunar` | `<Moon …/>` → `<EarthshineMoonIcon …/>` |

Button classes and colours stay exactly as they are. After the swap, `App.jsx` uses
no lucide icon, so its `import { … } from 'lucide-react'` line is removed. The
`lucide-react` package stays, because other views still import it.

## 3. Cleanup riding along

The neighbour comments in `CascadeIcon.jsx:9` ("beside Lock / KeyRound / Moon") and
`ScentGlyph.jsx:6` ("beside <Lock>, <KeyRound> and <Moon>") go stale again. Reword
both so they don't name specific neighbours ("beside the other nav glyphs"), so they
stop rotting on every icon change.

## 4. Out of scope

- In-tab uses of lucide icons (`Lock`, `Shield` etc. in PrivacyTab and elsewhere).
- The BSKY butterfly (a brand mark, deliberately left as is).
- Any change to tiers 1–3 glyphs.

## 5. Testing

- **Unit:** add the four glyphs to the existing `describe.each` in
  `src/terminal/components/icons/__tests__/navGlyphs.test.jsx`, giving 8 glyphs × 4
  cases = 32 tests. The existing contract applies unchanged: className, viewBox,
  svg-level stroke, `stroke-width="2"`, round caps and joins, `aria-hidden`, ref
  forwarding, ≤5 drawn elements, no fills, and `displayName`.
- **Lint:** 0 errors, and the warning count must not rise (ratchet is 143). If it falls,
  lower the ratchet to the measured count.
- **Live check** (headless CDP, scratchpad `navshots.mjs`; wait for the boot, hold a
  touch for the mobile nav, and wait for the mobile nav width to reach 375):
  - desktop inactive plus each of the four active states, zoomed;
  - the mobile nav at 375px.
  Pass, judged by eye at real size:
  - the lattice dots survive at 12px;
  - the earthshine limb is faint but present on desktop and clearly visible on mobile;
  - the airgap stays open;
  - the diamond die stays distinct from the frame;
  - all four sit centred against their labels.
