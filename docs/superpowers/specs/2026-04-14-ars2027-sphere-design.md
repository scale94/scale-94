# ARS ELECTRONICA 2027 — Sphere Redesign
**Date**: 2026-04-14
**Feature**: TFG Sphere — Humanity Traits Layer (alien observer from Mercury)
**Location**: `src/terminal/mercury/TFGSphere.jsx` + new `src/terminal/data/humanityTraits.js`

---

## Concept

An alien stationed on Mercury observes Earth. The sphere is the signal — 30 humanity traits distributed across it. Planets are the alien's taxonomy system. Mercury (Hg) remains the observer anchor at north pole.

Theme for Ars Electronica 2027: *humanity's strengths and weaknesses, seen from outside.*

---

## Data Layer — `src/terminal/data/humanityTraits.js`

Replaces `periodicElements.js`. ~30 trait nodes. Each:

```js
{
  id: 'language',
  label: 'Language & Storytelling',
  rulingPlanet: 'Mercury',
  category: 'STRENGTH',      // STRENGTH | PARADOX | WEAKNESS
  strength: 0.88,            // 0.0–1.0 — drives shader
  alienNote: '...',          // alien-voice reading (shown on click)
}
```

### Trait roster

**STRENGTHS** (strength 0.70–1.0) — bright, hue-pulsing:
| id | label | rulingPlanet | strength |
|---|---|---|---|
| language | Language & Storytelling | Mercury | 0.88 |
| mathematics | Mathematics / Pattern Recognition | Uranus | 0.92 |
| music | Music & Rhythm | Venus | 0.91 |
| collective_memory | Collective Memory (Culture, Libraries) | Saturn | 0.79 |
| empathy_local | Empathy at Small Scale | Moon | 0.84 |
| medicine | Medicine & Healing | Neptune | 0.76 |
| science | Scientific Method | Uranus | 0.85 |
| engineering | Tool Use & Engineering | Mars | 0.80 |
| cooperation | Large-scale Cooperation (rare) | Jupiter | 0.73 |
| art | Art & Aesthetics | Venus | 0.90 |

**PARADOXES** (strength 0.40–0.69) — flickering between bright and dim:
| id | label | rulingPlanet | strength |
|---|---|---|---|
| technology | Technology (creation & destruction) | Uranus | 0.55 |
| religion | Religion (cohesion & conflict) | Jupiter | 0.50 |
| love | Love (bonding & obsession) | Venus | 0.62 |
| intelligence | Intelligence (foresight & hubris) | Mercury | 0.58 |
| curiosity | Curiosity (discovery & exploitation) | Mercury | 0.65 |
| power | Power (protection & corruption) | Pluto | 0.45 |
| money | Money (cooperation tool & weapon) | Saturn | 0.48 |
| identity | Identity (belonging & tribalism) | Moon | 0.52 |
| progress | Progress (liberation & displacement) | Uranus | 0.60 |
| narrative | Narrative (truth & propaganda) | Mercury | 0.43 |

**WEAKNESSES** (strength 0.10–0.39) — dim, drifting:
| id | label | rulingPlanet | strength |
|---|---|---|---|
| tribalism | Tribalism / In-group Bias | Mars | 0.12 |
| short_term | Short-term Thinking | Moon | 0.15 |
| war | War & Violence | Mars | 0.10 |
| misinformation | Misinformation / Self-deception | Neptune | 0.18 |
| ecocide | Environmental Destruction | Saturn | 0.11 |
| inequality | Economic Inequality | Jupiter | 0.20 |
| addiction | Addiction (substances & attention) | Neptune | 0.22 |
| denial | Denial of Mortality | Pluto | 0.25 |
| coordination_failure | Coordination Failure | Saturn | 0.17 |
| status | Status Competition | Jupiter | 0.19 |

### Planet → Ruler mapping (`PLANET_MAP`)

```js
// trait id → planet name (used for astro lookup)
export const TRAIT_PLANET_MAP = {
  language: 'Mercury',
  mathematics: 'Uranus',
  music: 'Venus',
  collective_memory: 'Saturn',
  empathy_local: 'Moon',
  medicine: 'Neptune',
  science: 'Uranus',
  engineering: 'Mars',
  cooperation: 'Jupiter',
  art: 'Venus',
  technology: 'Uranus',
  religion: 'Jupiter',
  love: 'Venus',
  intelligence: 'Mercury',
  curiosity: 'Mercury',
  power: 'Pluto',
  money: 'Saturn',
  identity: 'Moon',
  progress: 'Uranus',
  narrative: 'Mercury',
  tribalism: 'Mars',
  short_term: 'Moon',
  war: 'Mars',
  misinformation: 'Neptune',
  ecocide: 'Saturn',
  inequality: 'Jupiter',
  addiction: 'Neptune',
  denial: 'Pluto',
  coordination_failure: 'Saturn',
  status: 'Jupiter',
};
```

### Alien-voice `alienNote` examples

```
// language
"MERCURY · SIGNAL 0.88\nHomo sapiens: symbolic compression\nof experience into transmissible form.\nUnique in: recursive self-reference.\nObserver note: primary survival vector."

// war
"MARS · SIGNAL 0.10\nHomo sapiens: mass kinetic energy\ntransfer between conspecifics.\nFrequency: continuous / 12,000 yr\nPattern: predictable. Cause: resource\nscarcity + status delta."

// technology
"URANUS · SIGNAL 0.55\nHomo sapiens: tool-making at civilisation\nscale. Creates and terminates its own\nconditions for existence.\nObserver status: unresolved."
```

---

## Shader — three visual tiers

Existing vertex + fragment shader; update the mid-tier (0.40–0.69) to flicker:

```glsl
// Fragment — PARADOX tier (was flat grey, now oscillates)
} else if (vPhase >= 0.40) {
  float flicker = 0.5 + 0.5 * sin(uTime * 8.0 + vIdx * 1.3);
  float hue     = fract(vIdx * 0.618034 + 0.2);
  col   = mix(colWeak, hsv2rgb(hue, 0.6, 0.9), flicker * 0.7);
  alpha = 0.55 + 0.4 * flicker;
}
```

STRENGTH and WEAKNESS tiers: unchanged.

---

## Interaction — alien readings

### Single node click
Panel shows `alienNote` from the trait. If `rulingPlanet` is in `astroCache`, appends:
```
{planet} in {sign} {degree}°
Retro: Yes/No
{aspect from cache}
```

### Two-node connection
Reads aspect between the two ruling planets (existing `computeAspect`). Label:
```
{planetA} — {planetB}
{aspect name} (orb {n}°)
{traitA.label} ↔ {traitB.label}
{one-line alien interpretation}
```

Alien interpretation is derived at runtime: if same planet → "same signal, internal split"; if aspect === 'Conjunction' → "harmonic lock"; if aspect === 'Square' → "active tension"; etc. Simple switch — no external data needed.

### Mercury (Hg) anchor click
```
TRANSMISSION ORIGIN · Hg-80
MERCURY — OBSERVER STATION
{sign} {degree}° / {Retro or Direct}
Distance from Earth: variable.
Signal latency: nominal.
```

---

## Bug fixes (bundled)

1. **ringRef split**: rename to `ringARef` (selA) and `ringHgRef` (hgActive). Each `<mesh>` gets its own ref.
2. **astroCache reset**: remove `setAstroCache(null)` from the `onClick` handler. Cache persists for session.
3. **Html label clutter**: remove the `nonHgElements.map` that renders floating labels for all high-affinity nodes. Labels only appear in the selection reading panels.
4. **Operator precedence**: fix line 421 to `(selA !== null && selB === null) || hgActive`.

---

## Files changed

| File | Action |
|---|---|
| `src/terminal/data/humanityTraits.js` | Create — 30 traits with alien notes |
| `src/terminal/mercury/TFGSphere.jsx` | Modify — new data, shader flicker tier, bug fixes, alien reading panels |
| `src/terminal/mercury/tfgAstroHelpers.js` | Modify — replace `PLANET_MAP` with `TRAIT_PLANET_MAP`, update `getRuler` signature |
| `src/terminal/mercury/TFGCanvas.jsx` | No change |
| `src/terminal/views/ScalingTab.jsx` | No change |

---

## Out of scope

- Geographic lat/long positioning (Fibonacci stays)
- Globe shader / Earth texture
- Backend / external data feeds
- Any changes to LatentCollider
