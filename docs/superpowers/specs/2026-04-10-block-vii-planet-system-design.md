# Block VII — Planet System Design Spec
**Date:** 2026-04-10  
**Status:** Approved  
**Scope:** LatentCollider (`src/terminal/views/LatentCollider.jsx`) — ScalingTab only

---

## Overview

Add Block VII (Cluster 7) to the LatentCollider domain grid in the ScalingTab. The theme is our solar system. Block VI (Fish Scale Doctrine) remains Block VI — Cluster 7 skips the number 6 intentionally.

No changes touch the ArtTab, the 3D sphere node graph, nodeFeatures.js, or any other tab.

---

## Decisions

| Choice | Decision |
|--------|----------|
| Scope | 11 domains: 8 planets + Sun + Moon + Pluto |
| Color theme | Deep Space Indigo (`indigo-500` family) |
| Domain framing | Hybrid: astronomical glyph as `short`, myth+physics fusion as `name` |
| Domain IDs | 70–80 (appended to ALL_DOMAINS after FSK_DOMAINS at 58–69) |
| Grid layout | `grid-cols-4 sm:grid-cols-6` (matches Block VI proportions for 11 items) |

---

## Domain Definitions — `PLANET_DOMAINS` array

```js
const PLANET_DOMAINS = [
  { id: 70, name: 'Sol Chromosphere Sovereignty',       short: '☉',  hue: 45  },
  { id: 71, name: 'Mercury Messenger Precession',       short: '☿',  hue: 210 },
  { id: 72, name: 'Venus Greenhouse Seduction',         short: '♀',  hue: 30  },
  { id: 73, name: 'Terra Biosphere Accord',             short: '⊕',  hue: 120 },
  { id: 74, name: 'Luna Tidal Synchrony',               short: '☽',  hue: 220 },
  { id: 75, name: 'Mars Iron War Geology',              short: '♂',  hue: 0   },
  { id: 76, name: 'Jupiter Storm Kingship',             short: '♃',  hue: 25  },
  { id: 77, name: 'Saturn Ring Time Compression',       short: '♄',  hue: 40  },
  { id: 78, name: 'Uranus Obliquity Doctrine',          short: '⛢',  hue: 180 },
  { id: 79, name: 'Neptune Deep Current Sovereignty',   short: '♆',  hue: 225 },
  { id: 80, name: 'Pluto Underworld Threshold',         short: '♇',  hue: 270 },
];
```

---

## Sphere Node Mappings — appended to `DOMAIN_SPHERE_MAP`

Each planet maps to the existing sphere node whose cluster semantics best match:

| ID | Planet | Node ID | Cluster | Rationale |
|----|--------|---------|---------|-----------|
| 70 | ☉ Sol | `fusion` | `phys` | Stellar plasma / nuclear fusion |
| 71 | ☿ Mercury | `seraphine` | `phys` | Signal transit / relativistic quantum |
| 72 | ♀ Venus | `atmospheric` | `eco` | Runaway atmospheric dynamics |
| 73 | ⊕ Terra | `biocoenosis` | `eco` | Living planet / biosphere |
| 74 | ☽ Luna | `kuramoto` | `sync` | Tidal locking / gravitational synchrony |
| 75 | ♂ Mars | `feigenbaum` | `phys` | Chaotic dust storm dynamics |
| 76 | ♃ Jupiter | `ceei` | `sync` | Storm governance / commons sovereignty |
| 77 | ♄ Saturn | `bouligand_36` | `eco` | Ring resonance / helicoidal structure |
| 78 | ⛢ Uranus | `magic_angle_1p1` | `phys` | Axial obliquity / angle-dependent phenomena |
| 79 | ♆ Neptune | `pragmatic` | `drk` | Deep current / hidden doctrine |
| 80 | ♇ Pluto | `necromantic` | `drk` | Exile / underworld threshold |

---

## UI Block — appended after Block VI in the domain grid JSX

```jsx
{/* ── Domain Grid — Block VII: Planet System ── */}
<div className="text-[8px] font-mono text-indigo-500/40 uppercase tracking-widest mt-3 mb-1">
  BLOCK VII — PLANET SYSTEM
</div>
<div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
  {PLANET_DOMAINS.map(d => {
    const isA = domainA === d.id;
    const isB = domainB === d.id;
    const selected = isA || isB;
    const disabled = phase === 'accelerating' || phase === 'colliding';
    return (
      <button
        key={d.id}
        onClick={() => !disabled && handleSelect(d.id)}
        disabled={disabled}
        className={`
          text-[9px] font-mono uppercase tracking-wider py-2 px-1 rounded border transition-all
          ${selected
            ? 'border-indigo-500/60 bg-indigo-900/20 text-indigo-300'
            : 'border-indigo-900/20 bg-black/30 text-indigo-600/60 hover:border-indigo-600/40 hover:text-indigo-400 hover:bg-indigo-900/10'}
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        `}
        title={d.name}
        style={selected ? { boxShadow: `0 0 12px hsla(${d.hue}, 70%, 50%, 0.3)` } : {}}
      >
        <div className="font-bold text-[13px] leading-none mb-1"
          style={selected ? { color: `hsl(${d.hue}, 70%, 65%)` } : {}}>
          {d.short}
        </div>
        {isA && <div className="text-[7px] text-fuchsia-500 mt-0.5">A</div>}
        {isB && <div className="text-[7px] text-cyan-500 mt-0.5">B</div>}
      </button>
    );
  })}
</div>
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/terminal/views/LatentCollider.jsx` | Add `PLANET_DOMAINS` const, append to `ALL_DOMAINS`, append 11 entries to `DOMAIN_SPHERE_MAP`, add Block VII JSX grid |

**No other files are modified.**

---

## Out of Scope

- No new nodes added to `nodeFeatures.js`
- No changes to `useSomaGraph.js` (3D sphere)
- No changes to ArtTab, KernelTab, or any other tab
- No Rust/WASM changes
