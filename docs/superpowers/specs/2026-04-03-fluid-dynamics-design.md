# Fluid Dynamics Tab — Design Spec

**Date:** 2026-04-03
**Status:** Approved
**Position:** Between Lunar and Ledger tabs
**Color Identity:** Indigo (`#6366f1`)

---

## Overview

A new lazy-loaded dashboard tab housing a real-time 3D particle simulation. ~10,000 bioluminescent particles flow inside a glassmorphic trefoil torus knot, driven by curl-noise fluid dynamics on the GPU. Full-bleed immersive canvas with orbit controls that auto-rotate until user interaction.

## Dependencies (New)

```
three
@react-three/fiber
@react-three/drei
```

None of these exist in the project today. All existing visualization uses Canvas 2D.

## File Structure

```
src/terminal/views/FluidTab.jsx          — Tab wrapper (lazy-loaded entry point)
src/terminal/fluid/FluidScene.jsx        — R3F Canvas + scene setup (camera, lights, controls)
src/terminal/fluid/ParticleFlow.jsx      — Particle system: Points mesh + custom ShaderMaterial
src/terminal/fluid/GlassKnot.jsx         — Torus knot glassmorphic shell (MeshTransmissionMaterial)
```

## Bounding Geometry

- **Shape:** Three.js `TorusKnotGeometry(1, 0.4, 256, 32, 2, 3)` — trefoil knot
- **Material:** drei `MeshTransmissionMaterial`
  - High transmission (~0.95), low roughness (~0.1)
  - Subtle chromaticAberration (~0.03)
  - Slight iridescence for spectral edge highlights
  - Backside rendering enabled for interior visibility
- **Purpose:** Visual container — particles are seen swirling inside this translucent shell

## Particle System

### Seeding
- **Count:** 8,000–12,000 particles (single `Points` draw call)
- **Initial positions:** Randomly distributed along the torus knot's parametric curve, offset inward within the tube radius
- **Parametric curve:** `TorusKnotCurve` sampled at uniform `t` values, with random radial offset (0 to ~0.35) from the centerline

### Flow Physics (GPU-driven)
- **Primary velocity:** Follows the knot's tangent direction at each particle's nearest parametric position
- **Secondary turbulence:** 3D curl noise (simplex-based) layered on top for organic swirl
- **Boundary enforcement:** Soft radial clamping — particles that drift beyond the tube radius experience a gradual inward steering force (no hard collisions, no jarring bounces)
- **Implementation:** Custom vertex shader updates positions per frame using uniforms (`uTime`, `uSpeed`, `uTurbulence`)

### Rendering
- **Geometry:** `BufferGeometry` with position, velocity, and phase attributes
- **Material:** Custom `ShaderMaterial` with additive blending
- **Sprite shape:** Radial Gaussian falloff (soft glowing point) computed in fragment shader
- **Size:** Small (2–5px screen-space), slight size variation by velocity

### Color Palette (Bioluminescent)
Fragment shader maps velocity magnitude to a three-stop gradient:
- **Low velocity:** Deep magenta `#ff00aa`
- **Medium velocity:** Soft violet `#8844ff`
- **High velocity:** Vibrant cyan `#00ffcc`

Additive blending ensures overlapping particles create bright hotspots.

## Camera & Controls

- drei `OrbitControls`
- `autoRotate={true}`, `autoRotateSpeed={0.4}`
- `enableDamping={true}`, `dampingFactor={0.05}`
- Zoom clamped: `minDistance={2}`, `maxDistance={6}` (prevent clipping into shell or losing it)
- Auto-rotation pauses on pointer interaction, resumes after ~3s idle
- Initial camera position: `[0, 0, 3.5]` — close enough to see particle detail, far enough for full knot silhouette

## App.jsx Integration

### Lazy Import
```jsx
const FluidTab = lazy(() => import('./views/FluidTab'));
```

### Navigation Button
- **Position:** Between Lunar and Ledger buttons
- **Icon:** `Droplets` from lucide-react
- **Label:** `/Fluid`
- **Color scheme:**
  - Active: `bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)]`
  - Inactive: `text-indigo-400/60 hover:text-indigo-200 hover:bg-indigo-900/20`

### Breadcrumb Entry
```js
fluid: {
  prompt: 'text-indigo-400',
  path: 'text-indigo-300',
  cursor: 'bg-indigo-400',
  border: 'border-indigo-500/25',
  glow: '0 0 18px rgba(99,102,241,0.25), 0 0 4px rgba(99,102,241,0.4)',
  cursorGlow: '0 0 10px rgba(99,102,241,0.8)',
  pathGlow: '0 0 6px rgba(99,102,241,0.3)'
}
```

### Conditional Render
Between Lunar and Ledger render blocks:
```jsx
{activeTab === 'fluid' && !selectedArticle && !architectThesis && (
  <FluidTab />
)}
```

### Route Path
`~/system/fluid`

## Vite Config

Add `three` to manual chunks in `vite.config.js`:
```js
three: ['three']
```

This isolates the Three.js bundle (~600KB gzipped) from the main vendor chunk.

## Performance Characteristics

- **Draw calls:** 2 (one for glass knot mesh, one for particle Points)
- **GPU load:** Curl noise computed in vertex shader — no JS-side per-particle updates
- **Memory:** ~1MB for particle buffers (12K particles x 3 attributes x Float32)
- **Lazy loading:** Zero impact on initial page load or other tabs
- **Unmount:** Tab fully unmounts when inactive (R3F canvas disposed, GPU resources freed)

## Background

- Deep black `#000000` (matches site background)
- No grid, no axes, no ambient geometry — just the knot and its particles in void

## Not In Scope

- Stats/readouts panel (full immersion)
- WASM integration (pure GPU simulation)
- Audio/sonification
- Mobile touch gestures beyond basic orbit (pinch-zoom works via OrbitControls defaults)
- Post-processing effects (bloom, etc.) — particles achieve glow via additive blending
