# TFG Sphere — Astrology Click Design Spec
**Date**: 2026-04-12
**Feature**: Planetary astrology readings + orbital ring click animations on TFG sphere
**Location**: TFGSphere.jsx (ScalingTab hero) — LatentCollider untouched

---

## Overview

Two enhancements to the existing TFG hollow element sphere:

1. **Click animation**: clicking any element spawns an orbital ring around it (torus geometry, planet-colored for planetary elements, dim silver for others)
2. **Astrology kernel**: clicking an element triggers a WASM call that returns real planetary position data (Jean Meeus VSOP87) — planetary elements get full readings, all others get a "ruled by" fallback

LatentCollider and its OCK olfactory layer are untouched.

---

## Files

| File | Action | Purpose |
|---|---|---|
| `src/terminal/mercury/TFGSphere.jsx` | Modify | Click state, orbital ring mesh, reading panel, WASM call |
| `content/rust_kernels/src/lib.rs` | Modify | Add `run_astro(unix_ms: f64) -> String` using VSOP87 |
| `src/wasm/scale94_kernels.js` | Modify | Export `run_astro` function |
| `src/wasm/wasm.generated.js` | Modify | Register `run_astro` in dispatch table |

WASM rebuild required after adding the Rust function.

---

## Planetary Element Mappings

10 elements have full planetary readings. The 7 classical alchemical metals + 3 modern planet namesakes:

| Element | Symbol | # | Planet | Ring Color |
|---|---|---|---|---|
| Mercury | Hg | 80 | Mercury | `#c0c0c0` silver |
| Gold | Au | 79 | Sun | `#f59e0b` amber-gold |
| Silver | Ag | 47 | Moon | `#e8e8f0` white-silver |
| Iron | Fe | 26 | Mars | `#ef4444` red |
| Copper | Cu | 29 | Venus | `#22c55e` green |
| Tin | Sn | 50 | Jupiter | `#8b5cf6` purple |
| Lead | Pb | 82 | Saturn | `#78716c` grey-brown |
| Uranium | U | 92 | Uranus | `#06b6d4` cyan |
| Neptunium | Np | 93 | Neptune | `#3b82f6` deep blue |
| Plutonium | Pu | 94 | Pluto | `#dc2626` dark red |

All other 108 elements: dim silver ring (`#404050`) + "ruled by" fallback text.

---

## Rust Astrology Kernel

### Function signature
```rust
pub fn run_astro(unix_ms: f64) -> String
```

### Algorithm

Uses Jean Meeus "Astronomical Algorithms" truncated VSOP87 mean elements:

For each of the 10 planets:
1. Compute Julian Day Number from `unix_ms`
2. Compute T = (JD − 2451545.0) / 36525 (Julian centuries from J2000)
3. Apply mean longitude formula + major perturbation terms per planet
4. Normalize longitude to [0°, 360°)
5. Zodiac sign = floor(longitude / 30), degree within sign = longitude mod 30
6. Retrograde detection: compute velocity (dL/dT), retrograde if velocity < 0
7. Dominant aspect: check angular separations between all planet pairs, report tightest (orb < 8°)

### Output format (one block per planet)

```
MERCURY
Sign: Taurus 14°
Retrograde: No
Aspect: Conjunct Sun (orb 3°)
---
SUN
Sign: Taurus 11°
Retrograde: No
Aspect: Conjunct Mercury (orb 3°)
---
[... 8 more planets ...]
```

### Parsing in JS

`parseAstroOutput(raw)` splits on `---`, maps each block to `{ planet, sign, degree, retrograde, aspect }`.

### Non-planetary fallback

`getRuler(element)` maps by group proximity to nearest planetary element:
- Groups 1–2 → Moon
- Groups 3–5 → Saturn
- Groups 6–8 → Mars
- Groups 9–11 → Venus / Sun
- Groups 13–14 → Mercury
- Groups 15–18 → Jupiter
- f-block → Neptune / Pluto

Returns: `"Ruled by [Planet] · [Planet's current sign]"`

---

## Click Interaction — TFGSphere.jsx

### State

```js
const [activeIdx, setActiveIdx] = useState(null); // index into nonHgElements, or null
```

Hg has its own separate click state (it is not in the InstancedMesh):
```js
const [hgActive, setHgActive] = useState(false);
```

### Click detection

`<instancedMesh>` does not fire onClick natively. Use R3F `onPointerDown` on the group + `THREE.Raycaster` to find the clicked instance index. Alternatively, use R3F's built-in `onClick` on `<instancedMesh>` which passes `event.instanceId`.

Use R3F's built-in: `<instancedMesh onClick={(e) => { e.stopPropagation(); setActiveIdx(e.instanceId); }} />`

### Orbital ring

For each active element, render a `<mesh>` at that element's sphere position:
```jsx
<mesh position={positions[activeIdx]} rotation={[Math.PI / 6, 0, 0]}>
  <torusGeometry args={[BASE_SIZE * 3, 0.008, 8, 48]} />
  <meshBasicMaterial color={ringColor} transparent opacity={0.9} />
</mesh>
```

Ring rotates via `useFrame`: `ringRef.current.rotation.y += 0.02` (1.2 rad/s at 60fps).

Second click on same element: `setActiveIdx(null)` (despawn).
Click different element: `setActiveIdx(newIdx)` (previous despawns, new spawns).

### Planetary pulse animation

For planetary elements only, on activation: lerp scale from 1.0 → 1.5 → 1.0 over 0.4s.

```js
const pulseRef = useRef({ active: false, t: 0, idx: -1 });
// In useFrame: if pulseRef.current.active, advance t, compute scale, setMatrixAt for that instance
```

### Reading panel

`<Html>` overlay anchored above the active element:

```jsx
<Html position={[p.x, p.y + 0.4, p.z]} style={{
  background: 'rgba(0,0,0,0.85)',
  border: '1px solid rgba(217,70,239,0.4)',
  color: '#c0c0c0',
  fontFamily: 'monospace',
  fontSize: '9px',
  padding: '6px 8px',
  whiteSpace: 'pre',
  pointerEvents: 'none',
  userSelect: 'none',
  borderRadius: '3px',
  minWidth: '140px',
}}>
  {readingText}
</Html>
```

`readingText` is populated after the async WASM call resolves. Before it resolves: show `"computing..."`.

### WASM call

```js
useEffect(() => {
  if (activeIdx === null) return;
  const el = nonHgElements[activeIdx];
  setReadingText('computing...');
  loadWasm().then(wasm => {
    const raw = wasm.run_astro(Date.now());
    const parsed = parseAstroOutput(raw);
    const planet = PLANET_MAP[el.atomicNumber]; // null if non-planetary
    if (planet) {
      const data = parsed[planet];
      setReadingText(
        `${planet.toUpperCase()} · ${el.symbol}\n` +
        `${data.sign} ${data.degree}°\n` +
        `Retro: ${data.retrograde ? 'Yes ℞' : 'No'}\n` +
        `${data.aspect || '—'}`
      );
    } else {
      const ruler = getRuler(el);
      const rulerData = parsed[ruler];
      setReadingText(
        `${el.symbol} · ruled by ${ruler}\n` +
        `${rulerData.sign} ${rulerData.degree}°`
      );
    }
  });
}, [activeIdx, nonHgElements]);
```

---

## Constraints

- LatentCollider.jsx: zero changes
- No new npm packages — Three.js, R3F, drei already available
- WASM kernel: add to existing kernel file, do not create a new `.wasm` binary
- `run_astro` accuracy target: zodiac sign correct, degree within ±2° (truncated VSOP87 is sufficient)
- Mobile: click works via touch (R3F pointerdown handles both)
