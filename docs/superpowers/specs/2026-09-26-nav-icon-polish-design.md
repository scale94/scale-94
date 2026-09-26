# Nav bar icon polish: four bespoke glyphs

**Date:** 2026-09-26 · **Branch:** `feature/nav-icon-polish` · **Status:** design approved, not built

## Why

The nav bar mixes two kinds of glyph. The bespoke ones (`AccretionIcon`,
`CascadeIcon`, `ScentGlyph`, the inline butterfly) draw the thing their tab
actually computes. The rest are stock `lucide-react` metaphors or Unicode text
characters. They share a stroke grammar, so the gap is semantic, not stylistic:
the bespoke ones stand out because they mean something specific.

This round replaces the four weakest fallbacks. The rule every glyph follows:
**the icon draws what the tab does.**

Audit of the bar at the start of this branch:

| Tab | Glyph | Kind |
|---|---|---|
| /ACCRETION | `AccretionIcon` | bespoke |
| /CHAOS | `CascadeIcon` | bespoke |
| /SCENT | `ScentGlyph` | bespoke |
| /BSKY | `NavButterflyIcon` (inline in `App.jsx`) | hand-drawn brand mark |
| /KERNEL | `Cpu` | stock lucide |
| /LUNAR | `Moon` | stock lucide |
| /PRIVACY | `Lock` | stock lucide |
| /CRYPTOGRAPHY | `KeyRound` | stock lucide |
| /SURVEILLANCE | `ShieldAlert` | stock lucide |
| /ECOCIDE | `Leaf` | stock lucide |
| /TRANSMISSION | `⌖` text on desktop, `Radio` on mobile | Unicode + stock, inconsistent |
| /LEDGER | `ᛟ` text on desktop and mobile | Unicode, font-dependent |

## Decisions (locked in brainstorm)

| # | Tab | Chosen | Rejected |
|---|---|---|---|
| 1 | Surveillance | **The tap**: a copy of the packet splits off at an intercept node | targeting brackets (reads as a generic target); mechanical iris (= lucide `Aperture`, stock again) |
| 2 | Ecocide | **Seraphine's scale**: the world, with an equator, held in the curved cradle from `SeraphineScale.jsx` (E3, revised after the live check) | tamed S-curve (reads as a generic chart); sprout from a fracture (drifts back to the leaf cliché, blurs at 12px) |
| 3 | Transmission | **Packet in flight**: diamond packet with a two-line split slipstream | first round (oscilloscope trace, signal bars, `⌖` as SVG) all rejected as generic; second round's "off the limb" and "globe dispatch" |
| 4 | Ledger | **River + seal**: river wave over ruled lines, seal in the gap beside the short rule, outline (not filled) | `ᛟ` redrawn as SVG; ruled lines + seal without the river; filled seal |
| 5 | Scope | Nav only, desktop + mobile | also swapping in-tab header glyphs |
| 6 | Tier 4 | Kernel / Privacy / Cryptography / Lunar deferred; reassessed once these four are live | doing all eight now |

## 1. Components

One file per glyph in `src/terminal/components/icons/`, beside `ScentGlyph`.
Each is written like `CascadeIcon`: `React.forwardRef`, `displayName`, and the
lucide grammar (`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`,
`strokeWidth="2"`, round caps and joins, `className` and extra props forwarded,
`aria-hidden="true"`). That makes each a drop-in for the lucide icon it replaces,
and lets `currentColor` pick up every existing active/inactive nav colour,
including the gradient-filled active states that set `text-black`.

Geometry (24 × 24 units, as approved in the mockups):

**`InterceptIcon.jsx`** (Surveillance)
```
<path d="M2 9h7" />        route in
<path d="M15 9h7" />       route out: the packet still arrives
<circle cx="12" cy="9" r="3" />  the intercept node
<path d="M12 12v7" />      the tapped copy dropping away
<path d="M8.5 21h7" />     where the copy is kept
```

**`SeraphineScaleIcon.jsx`** (Ecocide)
```
<circle cx="12" cy="9.5" r="6" />         the world
<path d="M6 9.5h12" />                     its equator
<path d="M2.5 13.5Q12 24.5 21.5 13.5" />   the cradle, same curve family as SeraphineScale's
```

Revised after the live check (variant E3). The first cut (a world at `cy=10 r=6.5`
over a shallow beam `M2 18.5Q12 22 22 18.5`) read as a generic user/avatar icon
at 12px and 20px: a circle over a shallow arc is a head over shoulders. The
deeper cradle rises past the world's lower half, so it reads as a held sphere,
and the equator makes the circle a planet.

**`PacketIcon.jsx`** (Transmission)
```
<path d="M2 9h7" />  <path d="M2 15h7" />             the split slipstream
<path d="M17 6.5l5.5 5.5-5.5 5.5-5.5-5.5z" />     the packet, heading out
```

Two parallel wake lines, not the three of the X1 mockup. A longer middle line made
the wake converge into a right-pointing chevron, which read as a fast-forward
button at 12px and crowded the diamond's left vertex.

**`LedgerSealIcon.jsx`** (Ledger)
```
<path d="M3 6q2.25-3.5 4.5 0t4.5 0t4.5 0t4.5 0" />  the river
<path d="M3 12h18" />                                a ruled ledger line
<path d="M3 19h9" />                                 the short line: the entry being written
<circle cx="18.5" cy="19" r="2.5" />                 the seal, in the gap beside it
```

Each component carries a short header comment in the voice of `CascadeIcon` and
`AccretionIcon`: what the glyph depicts in the tab, and what it replaced and why.

## 2. Wiring in `App.jsx`

| Tab | Desktop nav (`w-3 h-3`) | Mobile nav (`w-5 h-5`) |
|---|---|---|
| Surveillance | `<ShieldAlert>` → `<InterceptIcon>` | `<ShieldAlert>` → `<InterceptIcon>` |
| Ecocide | `<Leaf>` → `<SeraphineScaleIcon>` | `<Leaf>` → `<SeraphineScaleIcon>` |
| Transmission | `⌖` text → `<PacketIcon>` | `<Radio>` → `<PacketIcon>` |
| Ledger | `<span style={{fontSize:12}}>ᛟ</span>` → `<LedgerSealIcon>` | `<span style={{fontSize:24}}>ᛟ</span>` → `<LedgerSealIcon>` |

The button classes and colours stay exactly as they are.

## 3. Out of scope (deliberately left alone)

- In-tab glyphs: `ShieldAlert` in the SurveillanceTab header, `⌖` as a text
  motif throughout TransmissionTab, InverseEngine and CouncilRing, and `ᛟ` as
  the "axiomatic law" marker in KernelTab, ReliquaryView and EcocideTab. They
  are each tab's own vocabulary, not nav icons.
- `Radio` in ArtTab and BskyTab, and `ShieldAlert` in PrivacyTab: different
  meanings, untouched.
- Relocating `AccretionIcon`, `CascadeIcon` or the inline butterfly into `icons/`.
- Tier 4 (Kernel, Privacy, Cryptography, Lunar).

## 4. Cleanup riding along

- `App.jsx:12`: drop `Hexagon` (already unused) and `ShieldAlert`, `Radio`, `Leaf`
  (unused after the swap). `Cpu`, `Lock`, `KeyRound`, `Moon` stay.
- Stale neighbour comments: `CascadeIcon.jsx` names "Hexagon / Leaf" and
  `ScentGlyph.jsx` names `<Radio>` as nav neighbours. Reword both to neighbours
  that still exist.

## 5. Testing

- **Unit, one parameterised test** (`describe.each` over the four glyphs) in
  `src/terminal/components/icons/__tests__/navGlyphs.test.jsx`, following
  `ScentGlyph.test.jsx`:
  - renders one `svg` that forwards `className`, with `viewBox="0 0 24 24"` and
    `fill="none"`;
  - forwards a ref to the `svg` element;
  - legibility budget: at most 5 drawn elements (`path` + `circle`), no filled
    shapes. The budget is asserted, not just commented, as in the ScentGlyph test.
- **Lint:** 0 errors, and the warnings ratchet must not rise.
- **Live check (browser pane or CDP):** wait until `sys::boot_sequence` has gone,
  plus about 2.6s, before measuring or screenshotting. The app is scaled
  mid-reveal before that. Then screenshot:
  - the desktop nav with every tab inactive, and each of the four new tabs active
    (Ledger's active state is a gradient fill with `text-black`);
  - the mobile nav at 375px.
  The pass condition is judged by eye at real size: the four glyphs hold their
  shape at 12px and read as siblings of Accretion and Chaos.
