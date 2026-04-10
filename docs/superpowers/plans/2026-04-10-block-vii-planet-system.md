# Block VII — Planet System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Block VII (Cluster 7, Planet System) to the LatentCollider domain grid — 11 domains (☉ ☿ ♀ ⊕ ☽ ♂ ♃ ♄ ⛢ ♆ ♇) with deep-space indigo styling, isolated entirely to ScalingTab.

**Architecture:** Single-file edit to `LatentCollider.jsx`. Four sequential additions: the domain data array, the ALL_DOMAINS spread, the DOMAIN_SPHERE_MAP entries, and the JSX grid block. No other files touched.

**Tech Stack:** React JSX, Tailwind CSS, existing LatentCollider infrastructure

---

### Task 1: Add PLANET_DOMAINS array

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx` — after FSK_DOMAINS const (line ~280)

- [ ] **Step 1: Open the file and locate the insertion point**

Find this line in `src/terminal/views/LatentCollider.jsx`:

```js
// Unified lookup by id — keeps DOMAINS array untouched for animation code
const ALL_DOMAINS = [...DOMAINS, ...ELEM_DOMAINS, ...PHIL_MATH_DOMAINS, ...LIFE_HUM_DOMAINS, ...COGN_SYNTH_DOMAINS, ...FSK_DOMAINS];
```

Insert the `PLANET_DOMAINS` array immediately **above** that line:

```js
// ── Block VII: Planet System ──────────────────────────────────────────────────
const PLANET_DOMAINS = [
  { id: 70, name: 'Sol Chromosphere Sovereignty',     short: '☉', hue: 45  },
  { id: 71, name: 'Mercury Messenger Precession',     short: '☿', hue: 210 },
  { id: 72, name: 'Venus Greenhouse Seduction',       short: '♀', hue: 30  },
  { id: 73, name: 'Terra Biosphere Accord',           short: '⊕', hue: 120 },
  { id: 74, name: 'Luna Tidal Synchrony',             short: '☽', hue: 220 },
  { id: 75, name: 'Mars Iron War Geology',            short: '♂', hue: 0   },
  { id: 76, name: 'Jupiter Storm Kingship',           short: '♃', hue: 25  },
  { id: 77, name: 'Saturn Ring Time Compression',     short: '♄', hue: 40  },
  { id: 78, name: 'Uranus Obliquity Doctrine',        short: '⛢', hue: 180 },
  { id: 79, name: 'Neptune Deep Current Sovereignty', short: '♆', hue: 225 },
  { id: 80, name: 'Pluto Underworld Threshold',       short: '♇', hue: 270 },
];
```

- [ ] **Step 2: Verify the insertion**

Confirm `PLANET_DOMAINS` appears immediately before the `ALL_DOMAINS` line and that IDs 70–80 are contiguous with no duplicates (FSK_DOMAINS ends at id 69).

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): add PLANET_DOMAINS array — Block VII ids 70-80"
```

---

### Task 2: Register PLANET_DOMAINS in ALL_DOMAINS

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx` — the `ALL_DOMAINS` spread line

- [ ] **Step 1: Update the ALL_DOMAINS spread**

Find this exact line:

```js
const ALL_DOMAINS = [...DOMAINS, ...ELEM_DOMAINS, ...PHIL_MATH_DOMAINS, ...LIFE_HUM_DOMAINS, ...COGN_SYNTH_DOMAINS, ...FSK_DOMAINS];
```

Replace it with:

```js
const ALL_DOMAINS = [...DOMAINS, ...ELEM_DOMAINS, ...PHIL_MATH_DOMAINS, ...LIFE_HUM_DOMAINS, ...COGN_SYNTH_DOMAINS, ...FSK_DOMAINS, ...PLANET_DOMAINS];
```

- [ ] **Step 2: Verify**

Confirm `domainById(70)` through `domainById(80)` will now resolve. The `domainById` function is `const domainById = (id) => ALL_DOMAINS.find(d => d.id === id);` — it relies solely on `ALL_DOMAINS`, so this single change is sufficient.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): register PLANET_DOMAINS in ALL_DOMAINS lookup"
```

---

### Task 3: Append planet entries to DOMAIN_SPHERE_MAP

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx` — the `DOMAIN_SPHERE_MAP` array (ends around line 378)

- [ ] **Step 1: Find the end of DOMAIN_SPHERE_MAP**

Locate this closing section of the array:

```js
  /* 69 RAVE     */ { nodeId: 'rave_legacy',     cluster: 'fsk'    },
];
```

Insert the 11 planet entries immediately before the closing `];`:

```js
  // ── Block VII: Planet System ─────────────────────────────────────────────
  /* 70 SOL      */ { nodeId: 'fusion',          cluster: 'phys'   },
  /* 71 HG       */ { nodeId: 'seraphine',       cluster: 'phys'   },
  /* 72 VE       */ { nodeId: 'atmospheric',     cluster: 'eco'    },
  /* 73 EA       */ { nodeId: 'biocoenosis',     cluster: 'eco'    },
  /* 74 LU       */ { nodeId: 'kuramoto',        cluster: 'sync'   },
  /* 75 MA       */ { nodeId: 'feigenbaum',      cluster: 'phys'   },
  /* 76 JU       */ { nodeId: 'ceei',            cluster: 'sync'   },
  /* 77 SA       */ { nodeId: 'bouligand_36',    cluster: 'eco'    },
  /* 78 UR       */ { nodeId: 'magic_angle_1p1', cluster: 'phys'   },
  /* 79 NE       */ { nodeId: 'pragmatic',       cluster: 'drk'    },
  /* 80 PL       */ { nodeId: 'necromantic',     cluster: 'drk'    },
```

- [ ] **Step 2: Verify positional alignment**

`DOMAIN_SPHERE_MAP` is index-accessed positionally — entry at array index N maps to domain id N. Confirm the array now has exactly 81 entries (indices 0–80).

Count: Block I (16) + Block II (16) + Block III (8) + Block IV (8) + Block V (10) + Block VI (12) + Block VII (11) = 81. ✓

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): add planet sphere node mappings to DOMAIN_SPHERE_MAP"
```

---

### Task 4: Add Block VII JSX grid

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx` — after the Block VI JSX grid (ends around line 1741)

- [ ] **Step 1: Find the Block VI closing tag**

Locate this exact closing section of the Block VI grid:

```jsx
      {/* ── Domain Grid — Block VI: Fish Scale Doctrine ── */}
      <div className="text-[8px] font-mono text-gray-400/60 uppercase tracking-widest mt-3 mb-1">
        BLOCK VI — FISH SCALE DOCTRINE
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {FSK_DOMAINS.map(d => {
```

After the entire Block VI `</div>` closing tag (the one that closes the `grid grid-cols-4 sm:grid-cols-6` div), insert the Block VII grid:

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
              <div
                className="font-bold text-[13px] leading-none mb-1"
                style={selected ? { color: `hsl(${d.hue}, 70%, 65%)` } : {}}
              >
                {d.short}
              </div>
              {isA && <div className="text-[7px] text-fuchsia-500 mt-0.5">A</div>}
              {isB && <div className="text-[7px] text-cyan-500 mt-0.5">B</div>}
            </button>
          );
        })}
      </div>
```

- [ ] **Step 2: Visual check — open the app**

Run the dev server and navigate to the ScalingTab. Confirm:
1. Block VII label appears below Block VI in the LatentCollider
2. 11 indigo-tinted glyph buttons render: ☉ ☿ ♀ ⊕ ☽ ♂ ♃ ♄ ⛢ ♆ ♇
3. Clicking any planet button selects it as Domain A or B
4. Running a collision with a planet domain completes without errors (check browser console)
5. No other tabs (Art, Kernel, Classified) show any change

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): Block VII Planet System — indigo domain grid in ScalingTab"
```
