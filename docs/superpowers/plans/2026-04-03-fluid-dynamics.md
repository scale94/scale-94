# Fluid Dynamics Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-bleed 3D particle simulation tab where ~10,000 bioluminescent particles flow inside a glassmorphic trefoil torus knot, positioned between Lunar and Ledger in the navigation.

**Architecture:** New lazy-loaded `FluidTab` component wraps an R3F `Canvas` containing two children: a `GlassKnot` (torus knot with transmission material) and a `ParticleFlow` (GPU-driven Points mesh with custom shaders). Curl-noise flow is computed in the vertex shader. Auto-rotating orbit controls yield to user interaction.

**Tech Stack:** three, @react-three/fiber, @react-three/drei, custom GLSL shaders (inline strings)

---

## File Structure

```
src/terminal/views/FluidTab.jsx        — Tab entry point (lazy-loaded). Renders full-bleed R3F Canvas + scene children.
src/terminal/fluid/FluidScene.jsx      — Scene orchestrator: camera, lights, OrbitControls, background.
src/terminal/fluid/GlassKnot.jsx       — Trefoil torus knot with MeshTransmissionMaterial.
src/terminal/fluid/ParticleFlow.jsx    — Points mesh + custom ShaderMaterial (vertex/fragment shaders, curl noise, color mapping).
```

**Modified files:**
```
package.json                           — Add three, @react-three/fiber, @react-three/drei
vite.config.js:28-33                   — Add three to manualChunks
src/terminal/App.jsx:12                — Add Droplets import from lucide-react
src/terminal/App.jsx:76-77             — Add FluidTab lazy import
src/terminal/App.jsx:1081-1082         — Add Fluid nav button between Lunar and Ledger (desktop)
src/terminal/App.jsx:1110-1122         — Add fluid breadcrumb color entry
src/terminal/App.jsx:1249-1252         — Add FluidTab conditional render between Lunar and Ledger
src/terminal/App.jsx:1416-1419        — Add Fluid mobile nav button between Lunar and Ledger
```

---

### Task 1: Install Three.js Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd F:/scale_9.4 && npm install three @react-three/fiber @react-three/drei
```

Expected: `added X packages` — no peer dependency errors. React 19 is supported by R3F v9+ and drei v10+.

- [ ] **Step 2: Verify install**

Run:
```bash
cd F:/scale_9.4 && node -e "require('three'); require('@react-three/fiber'); require('@react-three/drei'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd F:/scale_9.4 && git add package.json package-lock.json && git commit -m "deps: add three, @react-three/fiber, @react-three/drei"
```

---

### Task 2: Add Three.js to Vite Manual Chunks

**Files:**
- Modify: `vite.config.js:28-33`

- [ ] **Step 1: Add the three chunk**

In `vite.config.js`, inside the `manualChunks` function (line 28-33), add a new rule before the closing brace:

```js
if (id.includes('node_modules/three')) return 'three';
```

The full function becomes:
```js
manualChunks(id) {
  if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor';
  if (id.includes('node_modules/lucide-react')) return 'lucide';
  if (id.includes('node_modules/d3-geo') || id.includes('node_modules/topojson')) return 'geo';
  if (id.includes('node_modules/dompurify')) return 'sanitizer';
  if (id.includes('node_modules/three')) return 'three';
},
```

- [ ] **Step 2: Verify build still works**

Run:
```bash
cd F:/scale_9.4 && npx vite build 2>&1 | tail -20
```

Expected: Build succeeds. A new `assets/three-*.js` chunk appears in output.

- [ ] **Step 3: Commit**

```bash
cd F:/scale_9.4 && git add vite.config.js && git commit -m "build: isolate three.js into dedicated chunk"
```

---

### Task 3: Create ParticleFlow Component (Shaders + Points Mesh)

This is the core simulation — the GPU-driven particle system with curl-noise flow inside a torus knot tube.

**Files:**
- Create: `src/terminal/fluid/ParticleFlow.jsx`

- [ ] **Step 1: Create the fluid directory**

```bash
mkdir -p F:/scale_9.4/src/terminal/fluid
```

- [ ] **Step 2: Write ParticleFlow.jsx**

Create `src/terminal/fluid/ParticleFlow.jsx` with the following content:

```jsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Torus Knot parametric helpers ──────────────────────────────────────────
// p=2, q=3 trefoil knot. Returns centerline point at parameter t ∈ [0, 1].
function knotPoint(t, R = 1, r = 0.4) {
  const phi = t * Math.PI * 2;
  const p = 2, q = 3;
  const x = (R + r * Math.cos(q * phi)) * Math.cos(p * phi);
  const y = (R + r * Math.cos(q * phi)) * Math.sin(p * phi);
  const z = r * Math.sin(q * phi);
  return [x, y, z];
}

// Tangent via finite difference (normalized)
function knotTangent(t, R = 1, r = 0.4) {
  const dt = 0.0001;
  const [ax, ay, az] = knotPoint(t, R, r);
  const [bx, by, bz] = knotPoint(t + dt, R, r);
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  return [dx / len, dy / len, dz / len];
}

// ── GLSL Shaders ───────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  attribute float aPhase;
  attribute float aRadius;
  attribute float aOffset;
  varying float vSpeed;
  varying float vLife;

  //
  // 3D simplex noise (Stefan Gustavson)
  //
  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0);
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x  = x_ * ns.x + ns.yyyy;
    vec4 y  = y_ * ns.x + ns.yyyy;
    vec4 h  = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314 *
                vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // Curl noise — divergence-free 3D field from simplex noise
  vec3 curlNoise(vec3 p) {
    float e = 0.1;
    float n1 = snoise(p + vec3(e, 0, 0));
    float n2 = snoise(p - vec3(e, 0, 0));
    float n3 = snoise(p + vec3(0, e, 0));
    float n4 = snoise(p - vec3(0, e, 0));
    float n5 = snoise(p + vec3(0, 0, e));
    float n6 = snoise(p - vec3(0, 0, e));
    float x = (n4 - n3) - (n6 - n5);
    float y = (n6 - n5) - (n2 - n1);
    float z = (n2 - n1) - (n4 - n3);
    return normalize(vec3(x, y, z)) * 0.5;
  }

  // Torus knot centerline (p=2, q=3)
  vec3 knotCenter(float t) {
    float phi = t * 6.283185307;
    float R = 1.0;
    float r = 0.4;
    float cp = cos(2.0 * phi);
    float sp = sin(2.0 * phi);
    float cq = cos(3.0 * phi);
    float sq = sin(3.0 * phi);
    return vec3((R + r * cq) * cp, (R + r * cq) * sp, r * sq);
  }

  void main() {
    // Advance parametric position along knot
    float t = fract(aPhase + uTime * uSpeed * (0.6 + aOffset * 0.4));

    // Centerline position
    vec3 center = knotCenter(t);

    // Tangent via finite difference
    vec3 tangent = normalize(knotCenter(t + 0.001) - center);

    // Build a local frame (Frenet-like)
    vec3 up = abs(tangent.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0);
    vec3 normal = normalize(cross(tangent, up));
    vec3 binormal = cross(tangent, normal);

    // Offset inside tube — spiral with curl noise perturbation
    float angle = aOffset * 6.283185307 + uTime * 0.5;
    float rad = aRadius * 0.32; // max ~0.32, tube radius is 0.4
    vec3 localOffset = normal * cos(angle) * rad + binormal * sin(angle) * rad;

    // Add curl noise turbulence
    vec3 curl = curlNoise(center * 2.0 + uTime * 0.15) * 0.06;

    vec3 pos = center + localOffset + curl;

    // Velocity proxy — how much curl noise displaces this particle
    vSpeed = length(curl) * 10.0 + aOffset * 0.3;
    vLife = aPhase;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (3.0 + aRadius * 3.0) * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vSpeed;
  varying float vLife;

  void main() {
    // Soft radial Gaussian sprite
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = exp(-d * d * 3.0);
    if (alpha < 0.01) discard;

    // Bioluminescent gradient: magenta → violet → cyan
    vec3 magenta = vec3(1.0, 0.0, 0.667);   // #ff00aa
    vec3 violet  = vec3(0.533, 0.267, 1.0);  // #8844ff
    vec3 cyan    = vec3(0.0, 1.0, 0.8);      // #00ffcc

    float t = clamp(vSpeed, 0.0, 1.0);
    vec3 color = t < 0.5
      ? mix(magenta, violet, t * 2.0)
      : mix(violet, cyan, (t - 0.5) * 2.0);

    // Slight brightness variation by phase
    color *= 0.8 + 0.4 * sin(vLife * 6.283185307);

    gl_FragColor = vec4(color, alpha * 0.85);
  }
`;

// ── Component ──────────────────────────────────────────────────────────────
const PARTICLE_COUNT = 10000;

export default function ParticleFlow() {
  const meshRef = useRef();
  const materialRef = useRef();

  // Build particle attribute buffers once
  const { positions, phases, radii, offsets } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const phases    = new Float32Array(PARTICLE_COUNT);
    const radii     = new Float32Array(PARTICLE_COUNT);
    const offsets   = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = Math.random();
      const [x, y, z] = knotPoint(t);
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      phases[i]  = t;
      radii[i]   = Math.random();
      offsets[i]  = Math.random();
    }

    return { positions, phases, radii, offsets };
  }, []);

  // Advance time uniform each frame
  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <points ref={meshRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={PARTICLE_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aPhase"    array={phases}    count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aRadius"   array={radii}     count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aOffset"   array={offsets}   count={PARTICLE_COUNT} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime:  { value: 0 },
          uSpeed: { value: 0.08 },
        }}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/fluid/ParticleFlow.jsx && git commit -m "feat(fluid): particle system with curl-noise flow inside torus knot"
```

---

### Task 4: Create GlassKnot Component

**Files:**
- Create: `src/terminal/fluid/GlassKnot.jsx`

- [ ] **Step 1: Write GlassKnot.jsx**

Create `src/terminal/fluid/GlassKnot.jsx`:

```jsx
import { MeshTransmissionMaterial } from '@react-three/drei';

export default function GlassKnot() {
  return (
    <mesh>
      <torusKnotGeometry args={[1, 0.4, 256, 32, 2, 3]} />
      <MeshTransmissionMaterial
        backside
        samples={6}
        thickness={0.5}
        chromaticAberration={0.03}
        anisotropy={0.2}
        distortion={0.1}
        distortionScale={0.2}
        temporalDistortion={0.1}
        iridescence={0.4}
        iridescenceIOR={1.5}
        iridescenceThicknessRange={[100, 400]}
        clearcoat={1}
        clearcoatRoughness={0.1}
        transmission={1}
        roughness={0.05}
        color="#1a1a2e"
        attenuationColor="#4f46e5"
        attenuationDistance={2}
      />
    </mesh>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/fluid/GlassKnot.jsx && git commit -m "feat(fluid): glassmorphic torus knot shell"
```

---

### Task 5: Create FluidScene Component

**Files:**
- Create: `src/terminal/fluid/FluidScene.jsx`

- [ ] **Step 1: Write FluidScene.jsx**

Create `src/terminal/fluid/FluidScene.jsx`:

```jsx
import { useRef, useCallback } from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
import GlassKnot from './GlassKnot';
import ParticleFlow from './ParticleFlow';

export default function FluidScene() {
  const controlsRef = useRef();
  const idleTimer = useRef(null);

  // Resume auto-rotate after 3s idle
  const handleInteractionEnd = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (controlsRef.current) controlsRef.current.autoRotate = true;
    }, 3000);
  }, []);

  const handleInteractionStart = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, []);

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.5} />

      {/* Transmission material needs an environment to refract */}
      <Environment preset="night" />

      <GlassKnot />
      <ParticleFlow />

      <OrbitControls
        ref={controlsRef}
        autoRotate
        autoRotateSpeed={0.4}
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={6}
        onStart={handleInteractionStart}
        onEnd={handleInteractionEnd}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/fluid/FluidScene.jsx && git commit -m "feat(fluid): scene orchestrator with orbit controls + environment"
```

---

### Task 6: Create FluidTab View

**Files:**
- Create: `src/terminal/views/FluidTab.jsx`

- [ ] **Step 1: Write FluidTab.jsx**

Create `src/terminal/views/FluidTab.jsx`:

```jsx
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import FluidScene from '../fluid/FluidScene';

export default function FluidTab() {
  return (
    <div
      className="w-full rounded-sm overflow-hidden"
      style={{
        height: 'calc(100vh - 140px)',
        background: '#000000',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <FluidScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/views/FluidTab.jsx && git commit -m "feat(fluid): FluidTab view with full-bleed R3F canvas"
```

---

### Task 7: Wire FluidTab into App.jsx

**Files:**
- Modify: `src/terminal/App.jsx:12` (Droplets icon import)
- Modify: `src/terminal/App.jsx:76-77` (lazy import)
- Modify: `src/terminal/App.jsx:1081-1082` (desktop nav button)
- Modify: `src/terminal/App.jsx:1110-1122` (breadcrumb colors)
- Modify: `src/terminal/App.jsx:1249-1252` (conditional render)
- Modify: `src/terminal/App.jsx:1416-1419` (mobile nav button)

- [ ] **Step 1: Add Droplets to lucide-react import**

In `src/terminal/App.jsx` line 12, add `Droplets` to the lucide import:

Change:
```js
import { Hexagon, Cpu, Lock, Scale, Eye, ShieldAlert, KeyRound, Waves, Radio, Leaf, Moon } from 'lucide-react';
```

To:
```js
import { Hexagon, Cpu, Lock, Scale, Eye, ShieldAlert, KeyRound, Waves, Radio, Leaf, Moon, Droplets } from 'lucide-react';
```

- [ ] **Step 2: Add FluidTab lazy import**

After line 77 (`const LedgerTab = lazy(…)`), add:

```js
const FluidTab = lazy(() => import('./views/FluidTab'));
```

- [ ] **Step 3: Add desktop nav button**

Between the Lunar button (line 1081) and the Ledger button (line 1083), insert:

```jsx
            <button aria-label="Fluid" aria-current={activeTab === 'fluid' ? 'page' : undefined} onClick={() => handleNav('~/system/fluid', 'fluid')} className={`${activeTab === 'fluid' ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)]' : 'text-indigo-400/60 hover:text-indigo-200 hover:bg-indigo-900/20'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap`}><Droplets className="w-3 h-3" /> /Fluid</button>
```

- [ ] **Step 4: Add breadcrumb color entry**

In the `_bc` object (around line 1110-1122), add a `fluid` entry after the `lunar` entry:

```js
fluid:        { prompt: 'text-indigo-400',  path: 'text-indigo-300',  cursor: 'bg-indigo-400',  border: 'border-indigo-500/25', glow: '0 0 18px rgba(99,102,241,0.25), 0 0 4px rgba(99,102,241,0.4)',    cursorGlow: '0 0 10px rgba(99,102,241,0.8)',     pathGlow: '0 0 6px rgba(99,102,241,0.3)' },
```

- [ ] **Step 5: Add conditional render**

Between the Lunar render block (lines 1249-1252) and the Ledger render block (lines 1254-1259), insert:

```jsx
          {/* Fluid Tab — bioluminescent particle dynamics */}
          {activeTab === 'fluid' && !selectedArticle && !architectThesis && (
            <FluidTab />
          )}
```

- [ ] **Step 6: Add mobile nav button**

Between the Lunar mobile button (lines 1416-1418) and the Ledger mobile button (line 1419), insert:

```jsx
        <button onClick={() => handleNav('~/system/fluid', 'fluid')} aria-label="Fluid" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'fluid' ? 'text-indigo-400' : 'text-indigo-400/50'}`}>
          <Droplets className="w-5 h-5" />
        </button>
```

- [ ] **Step 7: Verify dev server loads**

Run:
```bash
cd F:/scale_9.4 && npx vite build 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/App.jsx && git commit -m "feat(fluid): wire FluidTab into App.jsx navigation + routing"
```

---

### Task 8: Smoke Test and Polish

**Files:**
- Possibly modify: `src/terminal/fluid/ParticleFlow.jsx`, `src/terminal/fluid/GlassKnot.jsx`, `src/terminal/fluid/FluidScene.jsx`

- [ ] **Step 1: Run dev server and visually verify**

Run:
```bash
cd F:/scale_9.4 && npm run dev
```

Open `http://localhost:5173` in the browser. Click the `/Fluid` tab (indigo, between Lunar and Ledger). Verify:

1. The indigo nav button appears in both desktop and mobile nav
2. The breadcrumb shows `scale@node:~/system/fluid` in indigo
3. The canvas fills the viewport with a black background
4. The glassmorphic torus knot is visible with refractive shell
5. ~10,000 particles flow inside the knot along its curves
6. Particles shift from magenta → violet → cyan
7. The knot auto-rotates slowly
8. Mouse drag pauses auto-rotation and allows orbit
9. Auto-rotation resumes ~3s after releasing the mouse
10. Zoom is clamped (can't clip into or lose the knot)

- [ ] **Step 2: Run existing tests to confirm no regressions**

Run:
```bash
cd F:/scale_9.4 && npm test
```

Expected: All existing tests pass.

- [ ] **Step 3: Run production build**

Run:
```bash
cd F:/scale_9.4 && npx vite build 2>&1 | tail -20
```

Expected: Build succeeds. `three-*.js` chunk appears in the assets list. No chunk size warnings beyond the configured 1000KB limit (three.js chunk will be ~600KB gzipped — within Vite's default limit).

- [ ] **Step 4: Commit any polish fixes**

If any adjustments were made during verification:
```bash
cd F:/scale_9.4 && git add -A && git commit -m "fix(fluid): polish particle flow and glass material tuning"
```

If no changes needed, skip this step.
