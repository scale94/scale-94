# ScalingTab · Monument Elevation

**Status**: design · pending implementation
**Branch**: `nightly-20260520`
**Date**: 2026-05-21
**Context**: Ars Electronica 2027 submission · polish phase

## Goal

Elevate the ScalingTab so the project's deepest claims read as *canonical*, not as a developer manual. The dense terminal substrate is doing important work — it shows rigor — but the project's strongest statements (the white paper thesis, the citation backbone) currently sit at the same visual register as the kernel command listings. A juror scanning the tab cannot tell what is foundational and what is reference.

The fix is not to add new sections, decoration, or copy. It is to **transform three existing moments** so the eye knows where the artwork's load-bearing claims live.

## Concept · The Monument Pattern

A small set of moments in the ScalingTab break from the cyberpunk-terminal register and adopt a **Modernist Monument** treatment: massive sans-serif display type rendered in the project's own gold spectrum, a single saturated gold accent line, no decorative ornament, and committed stillness (no spin, breath, chroma, or glow). Everything else stays terminal.

The contrast is the meaning. The terminal is the engine room — working code, kernel listings, citations. The monument is the artifact above it — the thesis, the canon. Jurors will read this as: "the work has substance *and* knows what its substance is."

### Fade Doctrine compliance

The monument **never uses pure white**. White is the entropy threat under the Fade Doctrine ("zero white fade · crystalline lock · seven axioms · apex 7.7.7.7.7.7.7"). The boot sequence already enforces this rule ("Status tag — full arc color · no white"). The monument inherits the same discipline.

Contrast in the monument is achieved chromatically, not luminantly: two saturations of gold against black. The body sits in **luminous warm gold** (high luminance, slightly desaturated — reads as the "light"). Emphasis sits in **saturated deep gold** (same hue, lower luminance, fully saturated — reads as the "weight"). The accent line and section marker use the same deep gold. The whole monument is monochromatic — a single sustained chromatic note across a still field.

This makes the monument more *scale94-native* than a generic black-and-white modernist treatment would be. The visual vocabulary is the project's own.

### Pattern rules (apply to every monument moment)

| Property | Value |
| --- | --- |
| Display font | `'Inter', system-ui, sans-serif` · weight `900` · tracking `-0.028em` |
| Display size | `clamp(36px, 5.5vw, 68px)` for section headings · `clamp(28px, 4.2vw, 52px)` for body display (white paper thesis) |
| Display body color | `#e8d28a` — luminous warm gold (the "light") · approx OKLCH(0.87, 0.10, 90°) |
| Display emphasis color | `#d4a82a` — saturated deep gold (the "weight") · approx OKLCH(0.74, 0.14, 85°) · same hue, lower luminance, fully saturated |
| Section marker | `§ · <topic>` in monospace, `10px`, deep gold `#d4a82a`, letter-spacing `0.35em`, uppercase. Always sits *above* the display word. No Roman numerals (avoids implying a strict outline; the symbol carries enough weight alone). |
| Accent line | `2px` solid `#d4a82a`, width `80px`, sits *between* the display word and any subtitle. No glow, no animation. |
| Subtitle | Monospace `10px`, **terminal cyan** `rgba(6, 182, 212, 0.6)`, letter-spacing `0.25em`, uppercase. Below the accent line. The subtitle is the substrate breaking through into the monument — it stays in the terminal palette deliberately. |
| Animation | A single `1.5s` opacity fade-in on mount. No spin, no breath, no color cycle, no chromatic aberration. The monument arrives still and stays still. |
| Vertical breathing | `80px` minimum above the section marker; `48px` minimum below the subtitle before content resumes |
| Border / card | NONE. The monument breaks free of any container. It is not a card; it is an outcropping. |
| Pure white usage | **FORBIDDEN anywhere in the monument** (Fade Doctrine). Includes `#fff`, `rgba(255,255,255,*)`, `white`, and any near-white desaturated grey above ~92% luminance. |

## Transformations

### § · The Thesis (Seraphine White Paper)

**Before**: a bordered fuchsia-tinted card with the Ars Electronica 2027 corner stamp, animated colour-rotating headline, supporting prose, "READ PAPER" CTA.

**After**: the card chrome is removed entirely. The structure becomes:

```
§ · the thesis                         ← gold #d4a82a mono marker
white paper · ars electronica 2027     ← terminal cyan mono, 60% opacity
                                       (replaces the corner stamp)
                                       
The most compelling                    ← Inter Black 900, clamp(28px..52px)
analogy has the                        ← luminous warm gold #e8d28a
weakest geometry.                      ← saturated deep gold #d4a82a

────                                   ← 80px × 2px gold #d4a82a line
                                       
SERAPHINE · FADE DOCTRINE · MERCURY    ← terminal cyan mono, unchanged
Three cross-domain analogy pairs...    ← terminal green, unchanged
→ READ PAPER                           ← terminal mono, gold (was fuchsia)
```

The last three words of the thesis (`weakest geometry.`) deepen from luminous gold to saturated gold. This is the chromatic rhythm of the monument — a single sustained gold field with one weighted note. The accent line below mirrors the emphasis colour exactly, closing the figure.

Supporting metadata (`Lindblad decoherence`, `Bone Fusion`, etc.) and the load button stay terminal-mono. The substrate is intact; only the thesis itself rises out of it.

### § · The Kernels (RUN COMMAND MANUAL marker)

**Before**: `RUN COMMAND MANUAL V2.2` rendered in animated colour-cycling head with a fuchsia caption line below.

**After**: existing terminal-head treatment is preserved, but a single line is added above it:

```
§ · the kernels                        ← gold mono marker, identical to monument
RUN COMMAND MANUAL V2.2                ← unchanged terminal head
// WASM KERNEL INTERFACE · 57 KERNELS  ← unchanged caption
```

No display type here — this is *not* a monument moment. The section marker alone is enough to create rhythm between the two monuments (white paper above, bibliography below), telling the eye "this is canonical content, but lighter weight than the bracketing moments."

### § · Primary Literature (Bibliography)

**Before**: bordered amber-tinted block. Header reads `📖 BIBLIOGRAPHY & PRIMARY LITERATURE` with animated colour-cycle and a "56 kernels · short-form refs" count on the right.

**After**: the bordered card chrome is removed. The structure becomes:

```
§ · primary literature                 ← gold #d4a82a mono marker

Bibliography                           ← Inter Black 900, clamp(36px..68px)
                                       ← luminous warm gold #e8d28a

────                                   ← 80px × 2px gold #d4a82a line

56 kernels · canonical references      ← terminal cyan mono, 60% opacity

[ existing 2-column citation grid ]    ← unchanged
                                       ← amber primary / cyan secondary / 
                                         fuchsia commands, all preserved
```

The animated colour-cycle, the `BookOpen` icon, and the right-side count line are removed. The citation grid itself is untouched — its terminal density is the rigor it claims. The display word "Bibliography" sits in luminous warm gold without an emphasis word (it's a single noun, no rhythm note needed).

The closing footer line (`// "Original to Scale94 doctrine" denotes kernels native to the project...`) stays as terminal mono, unchanged.

## Explicit non-changes

These elements are deliberately *not* touched in this nightly:

- **Header** (`KERNEL_COMPILATION` + spinning hexagon + gradient text) — works as identity, no replacement
- **LatentCollider** — the existing hero; already polished with Phase 2 decay
- **Architect Thesis card** — small secondary CTA, doesn't need monument weight; would dilute the white paper's moment if elevated
- **RUN COMMAND MANUAL grid** (6 kernel section cards) — the rigor lives here, terminal is correct
- **Transaction Module footer** (BSKY / Signal / ETH) — practical contact, terminal register is honest
- **Tab-level animations** (tab fade, section reveals) — preserved

## Implementation notes

- **Font loading**: Inter weight 900 must be reliably available. Vite config / index.html should preload `Inter-Black.woff2` (or use Google Fonts with `display=swap`). If Inter fails, fallback to `system-ui` weight 900 — acceptable but less consistent across OS targets. Worth checking whether the site already loads Inter elsewhere; reuse the existing import if so.
- **Color tokens**: introduce two shared gold constants for the monument — `#e8d28a` (luminous warm gold, body) and `#d4a82a` (saturated deep gold, emphasis + accent line + section marker). Both are deliberately warmer / more amber than the Mercury observer eye's `#FFD700`. The 6% hue shift toward amber keeps the monument gold visually distinct from the observer-eye gold. Pure white (`#fff`) is **forbidden in the monument** per Fade Doctrine — see §Fade Doctrine compliance above.
- **Animation**: the existing `sc-cardReveal` keyframe is too quick (0.5s, ease-out, translateY). The monument needs a slower, gentler fade. Add a new `sc-monumentReveal` keyframe: `from { opacity: 0 } to { opacity: 1 }`, `1.5s ease-out`. No transform, no blur.
- **Accessibility**: luminous gold `#e8d28a` on black ≈ 13:1 contrast (WCAG AAA). Saturated deep gold `#d4a82a` on black ≈ 8.5:1 contrast (WCAG AAA at display sizes). Section markers at 10px monospace pass AA at the small-text threshold. The chromatic-only contrast (luminous gold vs deep gold) is sufficient at display scale because the luminance delta is ~17 points, comparable to the gap between black text and dark-grey text on white.
- **Mobile**: `clamp()` ranges handle phone widths. On screens narrower than 380px, the largest display drops to 36px which still reads as monument. No special mobile treatment required.
- **Section marker symbol**: use the literal `§` character (U+00A7). Web-safe across every monospace font. Letter-spacing `0.35em` gives it enough air to read as a structural anchor rather than a typo.

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Inter Black fails to load on first paint, monument text appears in `system-ui` for a flash | Use `font-display: swap`; the fallback is acceptable for ~200ms while the woff2 loads |
| The white paper thesis breaks into 3 lines on narrow screens, losing its compositional weight | Test at 320px, 768px, 1280px breakpoints; if the 3-line break hurts the line economy, allow `text-wrap: balance` to redistribute |
| Gold accent line at 80px feels arbitrary on ultra-wide screens | Hold the 80px constant — the line is a *fixed* anchor, not a percentage. Its job is to be small and precise. |
| Animation policy "no spin, no breath" looks broken next to the still-spinning header hexagon | Acceptable. The contrast (header animated, monument still) is part of the rhythm: the system is alive; its claims are not. |
| Two-gold monochromatic palette may read flatter than a white-on-black contrast to some viewers | Test at production scale. The chromatic-only contrast is the Fade-Doctrine-correct choice; if the white paper reads as insufficiently differentiated, increase the saturation gap (push body to `#f0dca0`, push emphasis to `#c89320`) rather than reintroducing white. |

## Out of scope

- Frontispiece, dedication page, or opening epigraph (no new elements per Q3)
- Colophon footer treatment on the transaction module
- Architect Thesis card transformation
- Restructuring the kernel grid
- Re-typesetting the citations themselves (only the section opening changes)
- Changes to other tabs (Mercury, Lunar, etc.)

## Success criteria

A juror who has not read the spec, on first scroll of the ScalingTab:

1. Reads the thesis sentence as the project's central claim, not as one card among many
2. Can immediately distinguish what is "the work's substance" vs "the work's reference apparatus" without reading section headers
3. Does not feel the monument moments as "design polish bolted on" — they should read as load-bearing typographic architecture
4. Does not lose the cyberpunk-terminal identity of the rest of the tab; the substrate remains intact and the monument earns its contrast by being rare
5. **Doctrinal compliance**: no pure white pixel appears inside any monument section. The all-gold monochrome reads as belonging to scale94, not as borrowed modernist design vocabulary.
