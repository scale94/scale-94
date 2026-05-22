import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { HUMANITY_TRAITS, TRAIT_PLANET_MAP } from '../data/humanityTraits';
import { loadWasm } from '../../wasm/wasmSingleton';
import { PLANET_COLORS_BY_NAME, parseAstroOutput, computeAspect } from './tfgAstroHelpers';
import { colliderBus } from '../views/LatentCollider';

// Fresnel atmosphere shader — silver-mercury corona at the edge of the sphere
const ATMOS_VERT = /* glsl */`
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vN = normalize(normalMatrix * normal);
    vec4 mvP = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mvP.xyz);
    gl_Position = projectionMatrix * mvP;
  }
`;
const ATMOS_FRAG = /* glsl */`
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float rim = pow(1.0 - abs(dot(vN, vV)), 2.4);
    float drift = 0.55 + 0.45 * sin(uTime * 0.65 + vN.y * 2.1);
    // Silver-mercury gradient: cool steel at poles, faint cyan at equator
    vec3 col = mix(vec3(0.38, 0.42, 0.52), vec3(0.12, 0.28, 0.44), drift);
    gl_FragColor = vec4(col, rim * 0.28);
  }
`;

const SPHERE_RADIUS = 2.8;
const BASE_SIZE     = 0.055;
const MAX_SPARKS    = 400;

// HSL → RGB for spark color computation
function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n, k = (n + h * 12) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  return [f(0), f(8), f(4)];
}

// Hue by category: STRENGTH → gold, PARADOX → fuchsia, WEAKNESS → cyan
function traitHue(trait) {
  return trait.category === 'STRENGTH' ? 44 + Math.random() * 14
       : trait.category === 'PARADOX'  ? 280 + Math.random() * 30
       : 185 + Math.random() * 20;
}

// Fibonacci sphere: distributes n points uniformly on a sphere of given radius.
function fibonacciSphere(n, radius) {
  const phi    = Math.PI * (3 - Math.sqrt(5)); // golden angle ≈ 2.399 rad
  const points = [];
  for (let i = 0; i < n; i++) {
    const y     = 1 - (i / (n - 1)) * 2;
    const r     = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    points.push(new THREE.Vector3(
      Math.cos(theta) * r * radius,
      y * radius,
      Math.sin(theta) * r * radius,
    ));
  }
  return points;
}

const vertexShader = /* glsl */`
  attribute float phaseAlignment;
  attribute float instanceIndex;
  uniform   float uTime;
  varying   float vPhase;
  varying   float vIdx;

  void main() {
    vPhase = phaseAlignment;
    vIdx   = instanceIndex;

    float s;
    if (vPhase >= 0.70) {
      s = 1.0 + 0.2 * sin(uTime * 5.0 + vIdx * 0.7);
    } else if (vPhase >= 0.40) {
      s = 1.0;
    } else {
      s = 0.8;
    }
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * s, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform float uTime;
  varying float vPhase;
  varying float vIdx;

  // HSV → RGB so we can assign each locked element its own hue
  vec3 hsv2rgb(float h, float s, float v) {
    vec3 c = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return v * mix(vec3(1.0), c, s);
  }

  void main() {
    vec3 colWeak      = vec3(0.25, 0.28, 0.32);
    vec3 colDissipate = vec3(0.04, 0.06, 0.08);

    vec3  col;
    float alpha;

    if (vPhase >= 0.70) {
      // Each element gets its own hue from the golden-ratio sequence
      float hue   = fract(vIdx * 0.618034 + 0.55);
      float pulse = 0.78 + 0.22 * sin(uTime * 5.0 + vIdx * 0.7);
      col   = hsv2rgb(hue, 0.72, pulse);
      alpha = 1.0;
    } else if (vPhase >= 0.40) {
      float flicker = 0.5 + 0.5 * sin(uTime * 8.0 + vIdx * 1.3);
      float hue     = fract(vIdx * 0.618034 + 0.2);
      col   = mix(colWeak, hsv2rgb(hue, 0.6, 0.9), flicker * 0.7);
      alpha = 0.55 + 0.4 * flicker;
    } else {
      col   = colDissipate;
      alpha = 0.30;
    }
    gl_FragColor = vec4(col, alpha);
  }
`;

function alienInterpretation(aspect) {
  if (!aspect) return 'No resonance detected.';
  switch (aspect.name) {
    case 'Conjunct':  return 'Harmonic lock. Same signal.';
    case 'Trine':     return 'Stable configuration.';
    case 'Sextile':   return 'Cooperative tension.';
    case 'Square':    return 'Active conflict vector.';
    case 'Opposite':  return 'Polarity maximum.';
    default:          return 'Pattern unclassified.';
  }
}

export default function TFGSphere() {
  const groupRef    = useRef();
  const meshRef     = useRef();
  const hgLightRef  = useRef();
  const matRef      = useRef();
  const driftRef    = useRef(null);

  // Selection state: [firstIdx, secondIdx] — null = empty slot
  // First tap selects, second tap on different element draws a connection line.
  // Tapping the same element deselects. Tapping a third element shifts: [1]→[0], new→[1].
  const [selection,    setSelection]    = useState([null, null]);
  const [hgActive,     setHgActive]     = useState(false);
  const [readingText,  setReadingText]  = useState('');
  const [astroCache,   setAstroCache]   = useState(null); // parsed run_astro output
  const ringRef            = useRef();
  const ringHgRef          = useRef();
  const pulseRef           = useRef({ active: false, t: 0, idx: -1 });
  const prevTimeRef        = useRef(0);
  const expansionRef       = useRef(1.0);
  const expansionTargetRef = useRef(1.0);
  const burstRef           = useRef({ active: false, t: 0 });
  const burstMeshRef       = useRef();
  const [burstColor,   setBurstColor]   = useState('#d946ef');
  const [chimeraData,  setChimeraData]  = useState(null);

  // ── Spark particle pool ───────────────────────────────────────────────────
  const sparkPosArr = useRef(new Float32Array(MAX_SPARKS * 3).fill(9999));
  const sparkVelArr = useRef(new Float32Array(MAX_SPARKS * 3));
  const sparkLife   = useRef(new Float32Array(MAX_SPARKS));
  const sparkMaxL   = useRef(new Float32Array(MAX_SPARKS));
  const sparkHueArr = useRef(new Float32Array(MAX_SPARKS));
  const nextSpkIdx  = useRef(0);
  const pointsRef   = useRef();

  const sparkGeo = useMemo(() => {
    const g   = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_SPARKS * 3).fill(9999);
    const col = new Float32Array(MAX_SPARKS * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  const sparkMat = useMemo(() => new THREE.PointsMaterial({
    size: 0.07,
    sizeAttenuation: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), []);

  // Convenience: first and second selected indices
  const [selA, selB] = selection;

  const { traits, positions, phaseAlignments } = useMemo(() => {
    const pts = fibonacciSphere(HUMANITY_TRAITS.length, SPHERE_RADIUS);
    const pa  = new Float32Array(HUMANITY_TRAITS.map(t => t.strength));
    return { traits: HUMANITY_TRAITS, positions: pts, phaseAlignments: pa };
  }, []);

  const hgPos = useMemo(() => new THREE.Vector3(0, SPHERE_RADIUS, 0), []);

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(BASE_SIZE, 8, 8);
    g.setAttribute('phaseAlignment', new THREE.InstancedBufferAttribute(phaseAlignments, 1));
    const idxArr = new Float32Array(traits.length);
    for (let i = 0; i < traits.length; i++) idxArr[i] = i;
    g.setAttribute('instanceIndex', new THREE.InstancedBufferAttribute(idxArr, 1));
    return g;
  }, [traits, phaseAlignments]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
  }), []);

  // Mercury corona atmosphere — Fresnel glow, rendered on the sphere's outer shell
  const atmosMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   ATMOS_VERT,
    fragmentShader: ATMOS_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
  }), []);
  const atmosMatRef = useRef();

  // Sync matRef inside an effect — keeps render body pure
  useEffect(() => { matRef.current = mat; }, [mat]);
  useEffect(() => { atmosMatRef.current = atmosMat; }, [atmosMat]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Set initial instance matrices and initialise drift state
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < traits.length; i++) {
      dummy.position.copy(positions[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    driftRef.current = new Float32Array(traits.length);
    // traits and positions are stable useMemo refs — this effect runs once on mount only
  }, [traits, positions, dummy]);

  // Dispose GPU resources on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
      atmosMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
    };
  }, [geo, mat, atmosMat, sparkGeo, sparkMat]);

  // Emit sparks from a world-space position
  const emitSpark = useCallback((worldPos, hue, count, speed) => {
    for (let i = 0; i < count; i++) {
      const idx   = nextSpkIdx.current % MAX_SPARKS;
      nextSpkIdx.current++;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const spd   = (0.4 + Math.random() * 2.2) * (speed ?? 1);
      sparkPosArr.current[idx*3]   = worldPos.x;
      sparkPosArr.current[idx*3+1] = worldPos.y;
      sparkPosArr.current[idx*3+2] = worldPos.z;
      sparkVelArr.current[idx*3]   = Math.sin(phi) * Math.cos(theta) * spd;
      sparkVelArr.current[idx*3+1] = Math.sin(phi) * Math.sin(theta) * spd;
      sparkVelArr.current[idx*3+2] = Math.cos(phi) * spd;
      sparkLife.current[idx] = 0;
      sparkMaxL.current[idx] = 0.7 + Math.random() * 1.5;
      sparkHueArr.current[idx] = hue + (Math.random() - 0.5) * 35;
    }
  }, []);

  // React to collider events: expand sphere during acceleration, burst on synthesis
  useEffect(() => {
    return colliderBus.on(data => {
      if (data.type === 'COLLIDER_PHASE') {
        expansionTargetRef.current = data.phase === 'accelerating' ? 1.28 : 1.0;
      }
      if (data.type === 'CHIMERA_SYNTHESIS') {
        const hue = Math.round(((data.hueA ?? 280) + (data.hueB ?? 120)) / 2);
        setBurstColor(`hsl(${hue}, 80%, 60%)`);
        burstRef.current = { active: true, t: 0 };
        setChimeraData(data);
      }
    });
  }, []);

  // Immediate reading text on selection (no WASM needed)
  useEffect(() => {
    if (selA === null && !hgActive) { setReadingText(''); return; }
    if (selA !== null && selB === null) {
      const trait = traits[selA];
      setReadingText(trait.alienNote);
    }
  }, [selA, selB, hgActive, traits]);

  // Fetch astro data once on first selection, cache it for enriched labels
  useEffect(() => {
    if (selA === null && !hgActive) return;
    if (astroCache) return; // already loaded this session
    loadWasm().then(wasm => {
      const parsed = parseAstroOutput(wasm.run_astro(Date.now()));
      setAstroCache(parsed);
    });
  }, [selA, hgActive, astroCache]);

  // Compute reading text from cache whenever selection or cache changes
  useEffect(() => {
    if (!astroCache) return;

    // Two traits selected → alien tension analysis
    if (selA !== null && selB !== null) {
      const traitA = traits[selA];
      const traitB = traits[selB];
      const pA     = TRAIT_PLANET_MAP[traitA.id];
      const pB     = TRAIT_PLANET_MAP[traitB.id];
      if (pA === pB) {
        setReadingText(
          `${pA} \u2014 INTERNAL SPLIT\n` +
          `${traitA.label}\n\u2194 ${traitB.label}\n` +
          `Same signal. Bifurcated output.`
        );
        return;
      }
      if (astroCache[pA] && astroCache[pB]) {
        const dA  = astroCache[pA];
        const dB  = astroCache[pB];
        const asp = computeAspect(dA.sign, dA.degree, dB.sign, dB.degree);
        setReadingText(
          `${pA} \u2014 ${pB}\n` +
          `${asp ? `${asp.name} (orb ${asp.orb}\u00b0)` : 'No aspect'}\n` +
          `${traitA.label}\n\u2194 ${traitB.label}\n` +
          alienInterpretation(asp)
        );
      } else {
        setReadingText(
          `${pA || '?'} \u2014 ${pB || '?'}\n` +
          `${traitA.label}\n\u2194 ${traitB.label}\n` +
          `Planetary data unavailable.`
        );
      }
      return;
    }

    // Single selection or Hg anchor
    const idx = selA ?? (hgActive ? 'hg' : null);
    if (idx === null) { setReadingText(''); return; }

    if (idx === 'hg') {
      const d = astroCache['Mercury'] || {};
      setReadingText(
        `TRANSMISSION ORIGIN \u00b7 Hg-80\n` +
        `MERCURY \u2014 OBSERVER STATION\n` +
        `${d.sign || '?'} ${(d.degree || 0).toFixed(0)}\u00b0 / ${d.retrograde ? 'Retro \u211e' : 'Direct'}\n` +
        `Signal latency: nominal.`
      );
    } else {
      const trait  = traits[idx];
      const planet = TRAIT_PLANET_MAP[trait.id];
      const d      = astroCache[planet] || {};
      setReadingText(
        trait.alienNote + '\n' +
        (d.sign ? `${d.sign} ${d.degree.toFixed(0)}\u00b0 / ${d.retrograde ? 'Retro \u211e' : 'Direct'}` : '\u2014')
      );
    }
  }, [selA, selB, hgActive, astroCache, traits]);

  useFrame((state) => {
    const t     = state.clock.elapsedTime;
    const mesh  = meshRef.current;
    const drift = driftRef.current;

    if (matRef.current)    matRef.current.uniforms.uTime.value = t;
    if (atmosMatRef.current) atmosMatRef.current.uniforms.uTime.value = t;
    if (groupRef.current) groupRef.current.rotation.y = t * 0.04;

    // ── Idle ambient sparks (Feigenbaum-fade style) ───────────────────────
    if (groupRef.current && Math.random() < 0.55) {
      const ri  = Math.floor(Math.random() * positions.length);
      const lp  = positions[ri].clone().multiplyScalar(expansionRef.current);
      const wp  = lp.applyMatrix4(groupRef.current.matrixWorld);
      emitSpark(wp, traitHue(traits[ri]), 1, 0.22);
    }
    if (hgLightRef.current) {
      hgLightRef.current.intensity = 0.8 + 0.4 * Math.sin(t * 2.1);
    }

    // ── Sphere expansion during collider acceleration ──────────────────────
    const expTarget = expansionTargetRef.current;
    const expCur    = expansionRef.current;
    const expanding = Math.abs(expTarget - expCur) > 0.0005;
    if (expanding) {
      expansionRef.current = expCur + (expTarget - expCur) * 0.04;
    }

    // Orbital ring rotation
    if (ringRef.current) ringRef.current.rotation.y += 0.02;

    // Pulse animation for planetary elements (scale 1→1.5→1 over 0.4s)
    const now   = t;
    const delta = now - prevTimeRef.current;
    prevTimeRef.current = now;

    // ── Atomizer burst (expanding wireframe sphere shell) ─────────────────
    const burst = burstRef.current;
    if (burst.active && burstMeshRef.current) {
      burst.t += delta;
      const p = Math.min(burst.t / 1.5, 1.0);
      const s = p * 7;
      burstMeshRef.current.scale.set(s, s, s);
      burstMeshRef.current.material.opacity = (1 - p * p) * 0.55;
      if (p >= 1.0) {
        burst.active = false;
        burstMeshRef.current.scale.set(0, 0, 0);
        burstMeshRef.current.material.opacity = 0;
      }
    }
    const pulse = pulseRef.current;
    if (pulse.active && mesh && pulse.idx >= 0 && pulse.idx < traits.length) {
      pulse.t += delta;
      const progress = Math.min(pulse.t / 0.4, 1.0);
      const scale    = 1.0 + 0.5 * Math.sin(progress * Math.PI);
      dummy.position.copy(positions[pulse.idx]);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(pulse.idx, dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;
      dummy.scale.set(1, 1, 1); // reset for drift loop below
      if (progress >= 1.0) pulse.active = false;
    }

    if (mesh && drift) {
      let dirty = expanding; // also dirty when expansion is changing
      // Update non-drift elements when sphere is expanding/contracting
      if (expanding) {
        for (let i = 0; i < traits.length; i++) {
          if (traits[i].strength < 0.40) continue; // handled below
          if (pulse.active && pulse.idx === i) continue;        // pulse overrides
          dummy.position.copy(positions[i]).multiplyScalar(expansionRef.current);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
      }
      for (let i = 0; i < traits.length; i++) {
        if (traits[i].strength >= 0.40) continue;
        drift[i] = (drift[i] + 0.002) % 0.15;
        const scale = (1 + drift[i] / SPHERE_RADIUS) * expansionRef.current;
        dummy.position.copy(positions[i]).multiplyScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        dirty = true;
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
    }

    // ── Spark particle update ──────────────────────────────────────────────
    const posBuf = sparkGeo.attributes.position;
    const colBuf = sparkGeo.attributes.color;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const ml = sparkMaxL.current[i];
      if (ml <= 0) { posBuf.array[i*3] = 9999; continue; }
      const lf = sparkLife.current[i];
      if (lf >= ml) {
        sparkMaxL.current[i] = 0;
        posBuf.array[i*3] = 9999;
        colBuf.array[i*3] = colBuf.array[i*3+1] = colBuf.array[i*3+2] = 0;
        continue;
      }
      sparkLife.current[i] += delta;
      sparkVelArr.current[i*3]   *= 0.93;
      sparkVelArr.current[i*3+1] *= 0.93;
      sparkVelArr.current[i*3+2] *= 0.93;
      posBuf.array[i*3]   += sparkVelArr.current[i*3]   * delta;
      posBuf.array[i*3+1] += sparkVelArr.current[i*3+1] * delta;
      posBuf.array[i*3+2] += sparkVelArr.current[i*3+2] * delta;
      const lifeT = lf / ml;
      let alpha;
      if      (lifeT < 0.15) alpha = (lifeT / 0.15) ** 2;
      else if (lifeT > 0.70) alpha = Math.pow(1 - (lifeT - 0.70) / 0.30, 2.2);
      else                   alpha = 1.0;
      alpha *= 0.65;
      const [r, g, b] = hslToRgb(sparkHueArr.current[i] / 360, 0.9, 0.65);
      colBuf.array[i*3]   = r * alpha;
      colBuf.array[i*3+1] = g * alpha;
      colBuf.array[i*3+2] = b * alpha;
    }
    posBuf.needsUpdate = true;
    colBuf.needsUpdate = true;
  });

  return (
    <>
    <group ref={groupRef}>
      {/* ── Mercury corona — Fresnel atmosphere, silver-steel at edge of chaos ── */}
      <mesh>
        <sphereGeometry args={[SPHERE_RADIUS * 1.16, 36, 28]} />
        <primitive object={atmosMat} attach="material" />
      </mesh>

      {/* ── Orbital belts — perihelion precession geometry ── */}
      {/* Ecliptic ring: Mercury's orbital plane, 7° inclination */}
      <mesh rotation={[Math.PI / 2, 0, 0.12]}>
        <torusGeometry args={[SPHERE_RADIUS * 1.06, 0.005, 6, 80]} />
        <meshBasicMaterial color="#506880" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      {/* Precession ring: tilt marks the anomalous advance of perihelion */}
      <mesh rotation={[Math.PI / 3.8, 0.55, 0]}>
        <torusGeometry args={[SPHERE_RADIUS * 1.13, 0.003, 6, 80]} />
        <meshBasicMaterial color="#304860" transparent opacity={0.09} depthWrite={false} />
      </mesh>

      {/* Atomizer burst — wireframe sphere expanding outward on chimera synthesis */}
      <mesh ref={burstMeshRef} scale={[0, 0, 0]}>
        <sphereGeometry args={[0.28, 14, 14]} />
        <meshBasicMaterial color={burstColor} transparent opacity={0} wireframe />
      </mesh>

      {/* Ring on first selected trait (selA) */}
      {selA !== null && (() => {
        const p      = positions[selA];
        const traitA = traits[selA];
        const col    = PLANET_COLORS_BY_NAME[TRAIT_PLANET_MAP[traitA.id]] ?? '#404050';
        return (
          <mesh ref={ringRef} position={[p.x, p.y, p.z]} rotation={[Math.PI / 6, 0, 0]}>
            <torusGeometry args={[BASE_SIZE * 3, 0.008, 8, 48]} />
            <meshBasicMaterial color={col} transparent opacity={0.9} />
          </mesh>
        );
      })()}

      {/* Dim ring on second selected trait (selB) */}
      {selB !== null && (() => {
        const p      = positions[selB];
        const traitB = traits[selB];
        const col    = PLANET_COLORS_BY_NAME[TRAIT_PLANET_MAP[traitB.id]] ?? '#404050';
        return (
          <mesh position={[p.x, p.y, p.z]} rotation={[Math.PI / 6, 0, 0]}>
            <torusGeometry args={[BASE_SIZE * 3, 0.008, 8, 48]} />
            <meshBasicMaterial color={col} transparent opacity={0.55} />
          </mesh>
        );
      })()}

      {/* Connection line between selA and selB */}
      {selA !== null && selB !== null && (() => {
        const pA   = positions[selA];
        const pB   = positions[selB];
        const elA  = traits[selA];
        const elB  = traits[selB];
        const colA = PLANET_COLORS_BY_NAME[TRAIT_PLANET_MAP[elA.id]] ?? '#404050';
        const colB = PLANET_COLORS_BY_NAME[TRAIT_PLANET_MAP[elB.id]] ?? '#404050';
        // Blend the two colors by averaging hex components
        const blend = (c1, c2) => {
          const r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
          const r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
          return `#${Math.round((r1+r2)/2).toString(16).padStart(2,'0')}${Math.round((g1+g2)/2).toString(16).padStart(2,'0')}${Math.round((b1+b2)/2).toString(16).padStart(2,'0')}`;
        };
        const lineColor = blend(colA, colB);
        const pts = new Float32Array([pA.x, pA.y, pA.z, pB.x, pB.y, pB.z]);
        const mid = { x: (pA.x+pB.x)/2, y: (pA.y+pB.y)/2 + 0.3, z: (pA.z+pB.z)/2 };
        return (
          <>
            <line>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[pts, 3]} />
              </bufferGeometry>
              <lineBasicMaterial color={lineColor} transparent opacity={0.7} />
            </line>
            {readingText && (
              <Html position={[mid.x, mid.y, mid.z]} style={{
                background:    'rgba(0,0,0,0.85)',
                border:        `1px solid ${lineColor}66`,
                color:         '#c0c0c0',
                fontFamily: "'Geist Mono', ui-monospace, monospace",
                fontSize:      '9px',
                padding:       '5px 7px',
                whiteSpace:    'pre',
                pointerEvents: 'none',
                userSelect:    'none',
                borderRadius:  '3px',
                minWidth:      '120px',
                maxWidth:      '200px',
                transform:     'translateX(-50%)',
              }}>
                {readingText}
              </Html>
            )}
          </>
        );
      })()}

      {/* Single-selection intel card */}
      {selA !== null && selB === null && (() => {
        const p      = positions[selA];
        const trait  = traits[selA];
        const planet = TRAIT_PLANET_MAP[trait.id];
        const d      = astroCache?.[planet] || {};
        const catCol = trait.category === 'STRENGTH' ? '#39ff14'
                     : trait.category === 'PARADOX'  ? '#d946ef'
                     : '#f43f5e';
        const bars   = Math.round(trait.strength * 10);
        const noteLines = trait.alienNote.split('\n');
        return (
          <Html position={[p.x, p.y + 0.52, p.z]} style={{
            background:  'rgba(2,2,10,0.93)',
            border:      `1px solid ${catCol}33`,
            borderLeft:  `2px solid ${catCol}bb`,
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            fontSize:    '9px',
            padding:     '6px 9px',
            pointerEvents: 'none',
            userSelect:  'none',
            borderRadius: '2px',
            minWidth:    '165px',
            maxWidth:    '230px',
            transform:   'translateX(-50%)',
            animation:   'tfg-intel-in 0.18s ease-out both',
          }}>
            <style>{`
              @keyframes tfg-intel-in {
                from { opacity:0; transform:translateX(-50%) translateY(4px); }
                to   { opacity:1; transform:translateX(-50%) translateY(0); }
              }
            `}</style>
            <div style={{ color: catCol, fontWeight: 'bold', fontSize: 10, marginBottom: 3 }}>
              ◈ {trait.label}
            </div>
            <div style={{ color: '#404055', letterSpacing: '0.04em', marginBottom: 3 }}>
              {trait.category} · SIG {trait.strength.toFixed(2)}
            </div>
            <div style={{ color: catCol, opacity: 0.8, letterSpacing: '0.06em', marginBottom: 4, fontSize: 8 }}>
              {'█'.repeat(bars)}{'░'.repeat(10 - bars)}
            </div>
            <div style={{ borderTop: '1px solid #1a1a28', marginBottom: 4 }} />
            <div style={{ color: '#506070', marginBottom: 3 }}>
              <span style={{ color: PLANET_COLORS_BY_NAME[planet] || '#607080' }}>{planet}</span>
              {d.sign
                ? <span style={{ color: '#404060' }}> · {d.sign} {d.degree?.toFixed(0)}°{d.retrograde ? ' ℞' : ''}</span>
                : null}
            </div>
            {noteLines.slice(1).map((ln, i) => (
              <div key={i} style={{ color: '#3a4a5a', fontSize: 8, lineHeight: '1.55' }}>{ln}</div>
            ))}
          </Html>
        );
      })()}

      {/* Hg single-selection (keeps existing text) */}
      {hgActive && readingText && (() => {
        const p = { x: 0, y: SPHERE_RADIUS, z: 0 };
        return (
          <Html position={[p.x, p.y + 0.45, p.z]} style={{
            background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(245,158,11,0.35)',
            color: '#c0c0c0', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '9px',
            padding: '6px 8px', whiteSpace: 'pre', pointerEvents: 'none',
            userSelect: 'none', borderRadius: '3px', minWidth: '130px',
            maxWidth: '200px', transform: 'translateX(-50%)',
          }}>{readingText}</Html>
        );
      })()}

      {hgActive && (
        <mesh ref={ringHgRef} position={hgPos} rotation={[Math.PI / 6, 0, 0]}>
          <torusGeometry args={[BASE_SIZE * 9, 0.008, 8, 48]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} />
        </mesh>
      )}

      {/* 117 non-Hg elements — single draw call */}
      <instancedMesh
        ref={meshRef}
        args={[geo, mat, traits.length]}
        onClick={(e) => {
          // TODO(phase-b): emit('gaze', 'sphere_clicked', { sphere: 'TFG' })
          e.stopPropagation();
          const idx = e.instanceId;
          if (idx === undefined || idx === null) return;
          pulseRef.current = { active: true, t: 0, idx };
          setHgActive(false);
          // Spark burst at world position of clicked trait node
          if (groupRef.current) {
            const lp = positions[idx].clone().multiplyScalar(expansionRef.current);
            lp.applyMatrix4(groupRef.current.matrixWorld);
            const isBridge = selection[0] !== null && selection[0] !== idx;
            emitSpark(lp, traitHue(traits[idx]), isBridge ? 55 : 38, isBridge ? 1.6 : 1.1);
          }
          setSelection(prev => {
            const [a, b] = prev;
            if (a === idx) return [null, null];          // deselect
            if (a === null) return [idx, null];          // first pick
            if (b === idx) return [a, null];             // deselect second
            return [a, idx];                             // second pick → connection
          });
        }}
      />

      {/* Collider result overlay — shown when a collision has completed */}
      {chimeraData && (() => {
        const d   = chimeraData;
        const hue = Math.round(((d.hueA ?? 280) + (d.hueB ?? 120)) / 2);
        const col = `hsl(${hue}, 70%, 55%)`;
        const fmt = (v) => (v != null ? (v * 100).toFixed(0) + '%' : '—');
        const deg = (v) => (v != null ? v.toFixed(1) + '°' : '—');
        return (
          <Html position={[0, -3.6, 0]} style={{
            background:    'rgba(4,4,12,0.92)',
            border:        `1px solid ${col}55`,
            color:         '#c0c8d8',
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            fontSize:      '9px',
            padding:       '7px 10px',
            whiteSpace:    'pre',
            pointerEvents: 'auto',
            borderRadius:  '4px',
            minWidth:      '240px',
            lineHeight:    '1.5',
            transform:     'translateX(-50%)',
          }}>
            <span style={{ color: col, fontWeight: 'bold', display: 'block', marginBottom: 3 }}>
              ◈ {d.chimeraName || 'CHIMERA'}
            </span>
            {d._domainNameA && d._domainNameB
              ? `${d._domainNameA}\n× ${d._domainNameB}\n`
              : ''}
            {`COSINE   ${deg(d.angle != null ? d.angle : null)}  ${d.cosine != null ? d.cosine.toFixed(3) : '—'}\n`}
            {`COHERENCE ${fmt(d.coherence)}  VIABILITY ${fmt(d.viability)}\n`}
            {`NOVELTY  ${fmt(d.novelty)}  PHASE ${d.phase || '—'}`}
            {d.accord?.dominant ? `\nACCORD   ${d.accord.dominant}` : ''}
            {d.accord?.polarityClass ? `  ·  ${d.accord.polarityClass}` : ''}
            <span
              style={{ display: 'block', marginTop: 4, color: '#404055', cursor: 'pointer' }}
              onClick={() => setChimeraData(null)}
            >[ dismiss ]</span>
          </Html>
        );
      })()}

      {/* Hg anchor node — north pole, amber-gold */}
      <mesh
        position={hgPos}
        onClick={(e) => {
          e.stopPropagation();
          setSelection([null, null]);
          setHgActive(v => !v);
        }}
      >
        <sphereGeometry args={[BASE_SIZE * 3, 16, 16]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.8}
          metalness={0.9}
          roughness={0.1}
        />
        <pointLight ref={hgLightRef} color="#f59e0b" intensity={1.4} distance={6} />
        <Html
          position={[0.3, 0, 0]}
          style={{
            color: '#f59e0b',
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            fontSize: '9px',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          Hg · 80
        </Html>
      </mesh>

      {/* Hg corona — wide diffuse halo around the anchor */}
      <mesh position={hgPos}>
        <sphereGeometry args={[BASE_SIZE * 10, 12, 12]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.06} depthWrite={false} />
      </mesh>

    </group>
    {/* Sparks — world-space, independent of sphere rotation */}
    <points ref={pointsRef}>
      <primitive object={sparkGeo} attach="geometry" />
      <primitive object={sparkMat} attach="material" />
    </points>
    </>
  );
}
