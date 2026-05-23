# Eye Spectrum Animation — Design Spec
_2026-05-23_

## Problem

The ◉ alien observer eye in the nav bar reads as dull and easy to overlook. Its current animation only varies **opacity** — color is hardcoded gold (`#e8d28a` idle / `#d4a82a` Mercury active). It lacks the discrete centerpiece energy it should carry.

## Solution

Phase-aware full-spectrum color fade. The eye's `color` and `text-shadow` animate continuously through all 13 nav item colors. Speed and glow intensity adapt to the existing phase system. Opacity breathing is preserved unchanged.

## Color Sequence

All 13 nav item colors, in order, looping:

| Stop | Tab | Hex |
|------|-----|-----|
| 1 | kernel | `#06b6d4` |
| 2 | bsky | `#38bdf8` |
| 3 | manifesto | `#a78bfa` |
| 4 | transmission | `#c084fc` |
| 5 | scaling | `#d946ef` |
| 6 | privacy | `#fb7185` |
| 7 | surveillance | `#ef4444` |
| 8 | cryptography | `#f97316` |
| 9 | art | `#FFD700` |
| 10 | ecocide | `#7ab800` |
| 11 | lunar | `#a78bfa` |
| 12 | mercury | `#c0c0c0` |
| 13 | ledger | `#14b8a6` |

## Animation Phases

Three spectrum keyframe variants, each paired with the existing opacity animation:

| Phase | Spectrum keyframe | Speed | Glow | Opacity animation (unchanged) |
|-------|-------------------|-------|------|-------------------------------|
| Idle | `mei-spectrum-idle` | 52s linear | moderate | `mei-breath` 11s |
| Mercury active | `mei-spectrum-active` | 8s linear | bright/vivid | `mei-breath-active` 8s |
| Deep-watch | `mei-spectrum-deep` | 120s linear | minimal | `mei-breath-deep` 14s |
| Flare | `mei-spectrum-idle` (underneath) | 52s linear | moderate | `mei-flare` 1.8s forwards |

Combined `animation` string per phase:
```
idle:       mei-spectrum-idle 52s linear infinite, mei-breath 11s ease-in-out infinite
mercury:    mei-spectrum-active 8s linear infinite, mei-breath-active 8s ease-in-out infinite
deep-watch: mei-spectrum-deep 120s linear infinite, mei-breath-deep 14s ease-in-out infinite
flare:      mei-spectrum-idle 52s linear infinite, mei-flare 1.8s ease-out forwards
```

## Keyframe Structure

Each spectrum keyframe block animates `color` + `text-shadow` (which carries the hue-matched glow). Glow radius scales with phase brightness:

- **Idle**: `0 0 14px rgba(..., 0.55), 0 0 4px rgba(..., 0.3)`
- **Active**: `0 0 28px rgba(..., 0.90), 0 0 10px rgba(..., 0.6)`
- **Deep**: `0 0 6px rgba(..., 0.22)`

The 13 color stops are distributed non-uniformly — the blue→purple sweep gets more space (0%–33%), the red/orange section is compressed (33%–50%), art gold and green get distinct stops, then mercury silver and ledger teal close the loop before cycling back.

## Changes to MercuryEyeIndicator.jsx

**Add:** 3 new `@keyframes` (`mei-spectrum-idle`, `mei-spectrum-active`, `mei-spectrum-deep`) inside the existing `<style>` block, each with all 13 color+glow stops.

**Modify:** Strip `text-shadow` from the 4 existing opacity keyframes (`mei-breath`, `mei-breath-active`, `mei-breath-deep`, `mei-flare`). They control only `opacity` going forward.

**Modify:** The `animation` variable — change from single animation string to two comma-separated animations per phase.

**Modify:** Remove hardcoded `color` from the glyph `style` prop. Set `color: '#06b6d4'` as the pre-animation fallback (kernel cyan — where the spectrum starts).

## What Does Not Change

- Phase logic (`flaring`, `deepWatch`, `isOnMercury` state and their timing)
- Opacity ranges and easing for all phases
- Flare timing (1.8s, setTimeout)
- Phrase system (load/run phrases, firePhrase)
- Tooltip markup and styles
- Mobile chrome opacity handling
- Observatory emit (`eye_phase`)
- Hover scale effect
