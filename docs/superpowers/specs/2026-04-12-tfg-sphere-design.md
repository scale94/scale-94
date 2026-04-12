# TFG Sphere — Design Spec
**Date**: 2026-04-12  
**Feature**: Thalamic Flat-Band Gating Sphere  
**Location**: ScalingTab (new hero section above LatentCollider)

---

## Overview

A Three.js hollow sphere of all 118 periodic table elements, arranged via Fibonacci distribution, rendered in the ScalingTab as the new centerpiece. Mercury (Hg, #80) is the anchor node. TFG physics (phase affinity derived from electron shell proximity to Hg) determines which elements illuminate vs dissipate. LatentCollider below it is preserved exactly — zero changes.

---

## Files

| File | Action | Purpose |
|---|---|---|
| `src/terminal/data/periodicElements.js` | Create | 118 elements: symbol, name, atomicNumber, period, group, block, electronConfig, phaseAffinity |
| `src/terminal/mercury/TFGSphere.jsx` | Create | Three.js scene: InstancedMesh + GLSL shader + Hg anchor node |
| `src/terminal/mercury/TFGCanvas.jsx` | Create | Isolated R3F Canvas wrapper (mirrors MercuryCanvas.jsx) |
| `src/terminal/views/ScalingTab.jsx` | Modify | Insert TFGCanvas section above `<LatentCollider />` |

---

## Data Layer — periodicElements.js

118 element objects. Each has:
- `symbol` (string): e.g. `"Hg"`
- `name` (string): e.g. `"Mercury"`
- `atomicNumber` (number): 1–118
- `period` (number): 1–7
- `group` (number | null): 1–18, null for lanthanides/actinides
- `block` (string): `"s"`, `"p"`, `"d"`, `"f"`
- `phaseAffinity` (number): pre-computed 0.0–1.0, see algorithm below

### Phase Affinity Algorithm

Anchor: Hg (#80), period 6, group 12, d-block, config `[Xe] 4f¹⁴ 5d¹⁰ 6s²`

Conditions evaluated in priority order (first match wins):

```
if (element === Hg)  → phaseAffinity = 1.0   (anchor)
if (group === 12)    → 0.90                  (same column: Zn #30, Cd #48)
if (period === 6)    → 0.85                  (same row: Cs #55 – Rn #86)
if (block === "d")   → 0.55                  (d-block transition metals)
if (period === 5)    → 0.40                  (adjacent row)
else                 → 0.15                  (dissipating)
```

Three visual tiers derived from phaseAffinity:
- **Locked** (≥ 0.70): silver-white glow, pulsing, scale 1.0–1.2
- **Weak** (0.40–0.69): dim steel, slow oscillation, scale 1.0
- **Dissipating** (< 0.40): near-black, 30% opacity, micro outward drift

---

## Render Layer — TFGSphere.jsx

### Geometry

- Fibonacci sphere distribution, 118 points, radius 2.8
- Single `THREE.InstancedMesh` (one draw call for all 118 non-Hg elements)
- Per-instance: position on sphere surface, phaseAffinity encoded as `instanceColor`

### Hg Anchor Node

- Separate `<mesh>` outside the instanced batch (not in InstancedMesh)
- Fixed at north-pole position on sphere surface
- Amber-gold color (`#f59e0b`), 3× scale relative to base element size
- `<pointLight>` attached, intensity driven by sin(time) for breathing effect
- `<Html>` label: `Hg · 80` in terminal mono font

### GLSL Shader (ShaderMaterial on InstancedMesh)

> **Implementation note**: `phaseAlignment` is a `THREE.InstancedBufferAttribute` (Float32Array, 1 item/stride), set on the geometry before mount. `gl_InstanceID` requires WebGL2 — R3F defaults to WebGL2 so this is safe.

```glsl
// Vertex shader
attribute float phaseAlignment;  // per instance, 0.0–1.0
varying float vPhase;
varying float vId;

void main() {
  vPhase = phaseAlignment;
  vId = float(gl_InstanceID);
  // scale by phase tier
  float s = vPhase >= 0.70 ? 1.0 + 0.2 * sin(uTime * 5.0 + vId) : (vPhase >= 0.40 ? 1.0 : 0.8);
  vec3 pos = position * s;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
}

// Fragment shader
uniform float uTime;
varying float vPhase;
varying float vId;

void main() {
  vec3 locked    = vec3(0.88, 0.88, 0.90);
  vec3 weak      = vec3(0.25, 0.28, 0.32);
  vec3 dissipate = vec3(0.04, 0.06, 0.08);

  vec3 col;
  float alpha;
  if (vPhase >= 0.70) {
    float pulse = 0.88 + 0.12 * sin(uTime * 5.0 + vId * 0.7);
    col = locked * pulse;
    alpha = 1.0;
  } else if (vPhase >= 0.40) {
    col = weak;
    alpha = 0.85;
  } else {
    col = dissipate;
    alpha = 0.30;
  }
  gl_FragColor = vec4(col, alpha);
}
```

### Html Labels

Only rendered for locked tier (phaseAffinity ≥ 0.70) — approximately 18 elements (period 6 row + group 12 column). Each label: `symbol · atomicNumber`, terminal mono font, 9px, color `#c0c0c0`.

### Motion

- Sphere group slow-rotates at 0.04 rad/s (Y axis) via `useFrame`
- Locked nodes: scale pulse via shader (atomic weight seeds the phase offset)
- Dissipating nodes: radius += 0.002 per frame, resets to base at radius + 0.15 (micro orbit drift)
- `OrbitControls` enabled: rotate + zoom, no pan

---

## Canvas Wrapper — TFGCanvas.jsx

Mirrors `MercuryCanvas.jsx` structure:
- Isolated `<Canvas>` from `@react-three/fiber`
- `<OrbitControls>` from `@react-three/drei`
- `<ambientLight>` (intensity 0.15) + `<TFGSphere />`
- Height: 500px desktop / 360px mobile (CSS, same breakpoint as rest of ScalingTab)
- Background: transparent (inherits ScalingTab dark bg)
- No shared state with MercuryTab canvas

---

## ScalingTab Integration

Insert between the header block and `<LatentCollider />`:

```jsx
{/* ── TFG Sphere ── */}
<div className="border-b border-fuchsia-900/40 pb-8 mb-8"
  style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s forwards' }}>
  <div className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-widest mb-3 flex items-center gap-2">
    <span style={{ color: 'rgba(192,192,192,0.5)' }}>◉</span>
    THALAMIC FLAT-BAND GATING · HG #80 · PHASE-SELECTIVE REALITY FILTER
  </div>
  <TFGCanvas />
</div>

{/* ── Latent Space Collider (unchanged) ── */}
<LatentCollider />
```

LatentCollider import and implementation: **no changes whatsoever**.

---

## Constraints

- LatentCollider collision animation preserved exactly — no modifications to `LatentCollider.jsx`
- TFGCanvas is a fully isolated R3F scene — no shared Three.js context with MercuryTab
- No controls panel — phase affinity is deterministic, no user-tunable parameters
- Mobile: height reduces to 360px, OrbitControls touch gestures enabled by default in drei
