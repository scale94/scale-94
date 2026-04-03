# FluidTab v2 — Explainer Chrome + Interactive Controls + Particle Polish

**Date:** 2026-04-03
**Status:** Approved
**Context:** Ars Electronica 2027 exhibition piece. Tab identity: "Bioluminescent Current Simulation // Deep-Ocean Signal Propagation"

---

## Overview

Upgrade the FluidTab from a bare canvas to a fully-dressed dashboard tab matching the SCALE 9.4 design language. Three changes: (1) explainer header with staggered reveal animations, (2) five interactive control sliders for simulation parameters, (3) crisper particle rendering — distinct luminous pixel-dots instead of diffuse blobs.

## Layout Structure

Two-zone vertical layout:

**Top Zone: Explainer Header**
- Gradient title, subtitle tagline, energy line divider, prose description
- Staggered reveal animation on mount (opacity + blur + translateY cascade)

**Main Zone: Split grid** — `grid grid-cols-1 lg:grid-cols-[280px_1fr]`
- Left panel: Control sliders + system status readout
- Right panel: 3D Canvas (fills remaining width)
- On mobile: stacks vertically (controls above canvas)

## Explainer Header

### Title
```
BIOLUMINESCENT CURRENT SIMULATION
```
- Classes: `text-xl sm:text-2xl font-bold tracking-tight uppercase font-mono`
- Gradient: `linear-gradient(90deg, #818cf8, #c7d2fe, #6366f1)` with `WebkitBackgroundClip: 'text'`
- Animation: `fd-titleReveal 0.8s cubic-bezier(0.16,1,0.3,1) both`

### Subtitle
```
DEEP-OCEAN SIGNAL PROPAGATION // TOROIDAL FLOW TOPOLOGY
```
- Classes: `text-[9px] font-mono text-indigo-500/40 uppercase tracking-[0.2em]`
- Animation: `fd-titleReveal 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both`

### Energy Line
- Container: `mt-4 relative h-[1px]`
- Main line: `linear-gradient(90deg, rgba(99,102,241,0.6), rgba(99,102,241,0.1), transparent)`
- Glow layer: 60px wide, `filter: blur(2px)`, indigo, pulsing
- Animations: `fd-energyLine 1.2s 0.3s cubic-bezier(0.16,1,0.3,1) both` and `fd-energyPulse 3s 1.5s ease-in-out infinite both`

### Prose
```
Particle-field simulation modeling bioluminescent signal propagation through
a closed toroidal manifold. Curl-noise driven flow constrained to a trefoil
knot boundary. Ars Electronica 2027.
```
- Classes: `text-xs font-mono text-gray-500 leading-relaxed max-w-2xl mt-3`
- Animation: `fd-proseReveal 0.6s 0.4s cubic-bezier(0.16,1,0.3,1) both`

### Spacer
- `border-b border-indigo-900/30 pb-4 mb-6` after prose

## Control Panel (Left Column)

### Container
- Classes: `space-y-4`
- Each slider group: `border border-white/[0.05] rounded-lg bg-black/30 p-3`

### Five Sliders

| Label | Key | Range | Default | Mobile Default | Shader Uniform |
|-------|-----|-------|---------|----------------|----------------|
| FLOW VELOCITY | `speed` | 0.01–0.20 | 0.08 | 0.08 | `uSpeed` |
| CURRENT DRIFT | `curlAmp` | 0.00–0.20 | 0.02 | 0.02 | `uCurlAmp` |
| LUMINANCE DENSITY | `density` | 2000–12000 | 10000 | 4000 | particle count (buffer rebuild) |
| SIGNAL DEPTH | `tubeRadius` | 0.10–0.40 | 0.32 | 0.32 | `uTubeRadius` |
| CHROMATIC DRIFT | `chromatic` | -1.0–1.0 | 0.0 | 0.0 | `uChromatic` |

### Slider Styling (per slider)
- Label row: flex justify-between
  - Label: `text-[8px] font-mono text-indigo-400/60 uppercase tracking-widest`
  - Value: `text-[10px] font-mono text-indigo-300`
- Track: `w-full h-[4px] bg-indigo-950/50 rounded-full relative cursor-pointer` with `touch-action: none`
- Fill: `absolute left-0 top-0 h-full bg-indigo-500 rounded-full` with `box-shadow: 0 0 8px rgba(99,102,241,0.4)`
- Thumb: `absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-400` with `box-shadow: 0 0 8px rgba(99,102,241,0.6)`
- Interaction: pointer/touch drag on track sets value proportionally. `touch-action: none` prevents scroll interference.

### System Status Readout
Below sliders:
```
── SYSTEM STATUS ──────────
FPS         60
PARTICLES   10000
DRAW CALLS  2
```
- Container: `mt-4 pt-3 border-t border-white/[0.05]`
- Title: `text-[7px] font-mono text-white/20 uppercase tracking-widest mb-2`
- Each row: `flex justify-between text-[8px] font-mono`
  - Label: `text-white/20`
  - Value: `text-indigo-400/40`
- FPS updated via `useFrame` callback, throttled to 1Hz

## Particle Rendering Changes

### Animation Feel: Sand, Not Liquid

The simulation must feel like luminous sand grains cascading through a glass sculpture — not fluid swirling in a pipe. Key differences from v1:

**Primary motion:** Tangential drift along the knot centerline (particles flow forward) + a gravity bias vector `(0, -1, 0)` projected onto the local Frenet frame. Particles gently fall along the lower curves of the knot, accumulate briefly at the nadir, then cascade forward.

**Secondary motion:** Small per-particle noise jitter (NOT curl noise swirl). Each particle has a unique high-frequency displacement — `snoise(position * 8.0 + uTime) * 0.012` — that gives granular texture. The particles shimmer and jostle independently like sand grains, never moving in uniform streams.

**Curl noise role:** Demoted from primary driver to subtle environmental perturbation. Amplitude reduced from `0.06` to `0.02` default. It adds gentle drift variation, not visible swirl.

### Pure Color Fade Harmony

Color is completely decoupled from velocity. Each particle cycles slowly through the bioluminescent palette based on its phase and time:

```glsl
float hue = fract(aPhase + uTime * 0.05 + uChromatic * 0.33);
vec3 color = hue < 0.333
  ? mix(magenta, violet, hue * 3.0)
  : hue < 0.666
    ? mix(violet, cyan, (hue - 0.333) * 3.0)
    : mix(cyan, magenta, (hue - 0.666) * 3.0);
```

All 10,000 particles drift through magenta → violet → cyan → magenta at different phase offsets, creating a living gradient that breathes. The `uChromatic` slider shifts the global phase offset — the entire field smoothly rotates through hue space.

### Sharper Sprites
Current fragment shader uses soft Gaussian `exp(-d * d * 3.0)` — particles blur into a solid mass.

New fragment shader alpha computation:
```glsl
float alpha = smoothstep(1.0, 0.3, d);
```
This creates a bright solid core with a tight halo — each particle reads as a distinct luminous grain.

### Smaller Point Size
Current vertex shader: `gl_PointSize = (3.0 + aRadius * 3.0) * (300.0 / -mvPosition.z);`

New: `gl_PointSize = (1.5 + aRadius * 2.0) * (300.0 / -mvPosition.z);`
Range: 1.5–3.5px screen-space. Individual grains visible at distance.

### Higher Alpha
Fragment shader final alpha: `0.95` (was `0.85`). Crisper dots.

## New Uniforms in ShaderMaterial

```js
uniforms: {
  uTime:       { value: 0 },
  uSpeed:      { value: 0.08 },
  uCurlAmp:    { value: 0.02 },
  uTubeRadius: { value: 0.32 },
  uChromatic:  { value: 0.0 },
}
```

### Vertex Shader Changes
- Replace hardcoded `* 0.06` curl amplitude with `* uCurlAmp`
- Replace hardcoded `aRadius * 0.32` tube radius with `aRadius * uTubeRadius`

## Dynamic Particle Count

When LUMINANCE DENSITY slider changes:
- New `Float32Array` buffers are allocated with the new count
- Buffer attributes are replaced on the existing `BufferGeometry`
- `needsUpdate = true` set on each attribute
- Debounced to 200ms to avoid thrashing during drag

## Animations (CSS Keyframes)

Defined in a `<style>` block inside FluidTab (same pattern as LedgerTab):

```css
@keyframes fd-titleReveal {
  0%   { opacity: 0; filter: brightness(3) blur(6px); letter-spacing: 0.4em; }
  40%  { opacity: 1; filter: brightness(2) blur(1px); letter-spacing: 0.15em; }
  100% { opacity: 1; filter: brightness(1) blur(0); letter-spacing: 0.05em; }
}
@keyframes fd-energyLine {
  from { width: 0; }
  to   { width: 100%; }
}
@keyframes fd-energyPulse {
  0%, 100% { opacity: 0.03; }
  50%      { opacity: 0.07; }
}
@keyframes fd-proseReveal {
  from { opacity: 0; transform: translateY(6px); filter: blur(2px); }
  to   { opacity: 1; transform: translateY(0); filter: blur(0); }
}
```

## File Structure

```
Modified:
  src/terminal/views/FluidTab.jsx          — Header chrome, split layout, slider state, animations
  src/terminal/fluid/FluidScene.jsx        — Accept + pass control props
  src/terminal/fluid/ParticleFlow.jsx      — New uniforms, sharper sprite, dynamic count

Created:
  src/terminal/fluid/FluidControls.jsx     — Slider panel + system status readout

Unchanged:
  src/terminal/fluid/GlassKnot.jsx
  src/terminal/App.jsx
```

## Mobile Behavior

- Grid stacks to single column (`grid-cols-1` below `lg`)
- Controls appear above canvas
- Canvas height: `calc(100vh - 420px)` on mobile (accounts for header + controls + nav)
- LUMINANCE DENSITY defaults to 4000 on mobile
- Touch-drag on sliders works via `touch-action: none` on each track element
