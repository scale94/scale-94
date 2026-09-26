# Nav bar icon polish, tier 4: the last four stock glyphs

**Date:** 2026-09-26 · **Branch:** `feature/nav-icon-tier4` (off main `2c7f837c`) · **Status:** built on the branch (not merged, not pushed)

Follows `2026-09-26-nav-icon-polish-design.md` (tiers 1–3, merged to local main).
The same rule holds: **the icon draws what the tab does.** After tiers 1–3, the last
four lucide icons (`Cpu`, `Lock`, `KeyRound`, `Moon`) were the only stock glyphs
left in the bar, and they broke the set.

## Decisions (locked in brainstorm)

| Tab | Chosen | Rejected (and why) |
|---|---|---|
| Kernel | **K9** (revised from K8 after the live check): a DIP processor frame, pins top and bottom only, with a diamond die | K8, pins on all four sides (read as a gear/cog at 12px);  ᛟ rune (read as Norse rune / Bluetooth); plain nested square (dice / stop button); reliquary niche (tombstone); ring-0 diamond + 4 bus lines; frame + square die + 2 or 3 pins per side (≈ lucide `Cpu` stroke for stroke) |
| Privacy | **P3**: airgap enclave, a hexagonal perimeter broken by one airgap, holding an untouched diamond node | porous circles (read as targets / bullseyes); nested hexagons (hex nut) |
| Cryptography | **C6** (revised from C1 after the live check): a skewed lattice (ML-KEM is lattice-based) with the short vector reaching the hidden point | C1, a square grid with a ringed centre (read as the sun/brightness icon at 12px);  lattice row in a capsule (reads as a pill) |
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
<path d="M8 1.5v2.5M12 1.5v2.5M16 1.5v2.5M8 20v2.5M12 20v2.5M16 20v2.5" />   the bus pins, top and bottom only (a DIP package)
```

Revised after the live check (K8 → K9). With pins on all four sides the glyph read as a
gear/settings cog at 12px, because pins all the way round blur into teeth. Pins on two
edges only still read as a processor and can't read as a cog.

**`AirgapIcon.jsx`** (Privacy)
```
<path d="M19.79 9.6V7.5L12 3 4.21 7.5v9L12 21l7.79-4.5v-2.1" />   the enclave wall, broken on the right by the airgap
<path d="M12 9.5l2.5 2.5-2.5 2.5-2.5-2.5z" />                     the sovereign node, untouched
```

**`LatticeIcon.jsx`** (Cryptography)
```
<path d="M4 3.5h0M10.5 5h0M17 6.5h0M6 10h0M19 13h0M14.5 18h0M21 19.5h0" />   a skewed lattice (zero-length subpaths drawn by round caps)
<path d="M8 16.5L12.5 11.5" />                                                  the short vector, from a lattice point to the hidden one
<circle cx="12.5" cy="11.5" r="1.6" />                                          the hidden point
```

Revised after the live check (C1 → C6). The square 3×3 grid with a ringed centre read as
the sun/brightness icon at 12px, because it has even radial spacing around a ring. The lattice is
now skewed like a real lattice basis, and the secret is marked by the short vector that
reaches it: the shortest-vector problem that lattice schemes such as ML-KEM rest on.

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

**Added after the live check (user request):** the Kernel tab's own `system_kernel`
header icon (`KernelTab.jsx`, `w-8 h-8`, gold reveal + glow animation) swaps `Cpu` for
`KernelCoreIcon` too, so the tab and its nav button carry the same mark. The inline
`style` (colour and animation) passes through unchanged. `Cpu` drops out of KernelTab's
lucide import.

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
