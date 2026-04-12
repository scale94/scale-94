import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ELEMENTS } from '../data/periodicElements';

const SPHERE_RADIUS = 2.8;
const BASE_SIZE     = 0.055;

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

  void main() {
    vec3 colLocked    = vec3(0.88, 0.88, 0.90);
    vec3 colWeak      = vec3(0.25, 0.28, 0.32);
    vec3 colDissipate = vec3(0.04, 0.06, 0.08);

    vec3  col;
    float alpha;

    if (vPhase >= 0.70) {
      float pulse = 0.88 + 0.12 * sin(uTime * 5.0 + vIdx * 0.7);
      col   = colLocked * pulse;
      alpha = 1.0;
    } else if (vPhase >= 0.40) {
      col   = colWeak;
      alpha = 0.85;
    } else {
      col   = colDissipate;
      alpha = 0.30;
    }
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function TFGSphere() {
  const groupRef    = useRef();
  const meshRef     = useRef();
  const hgLightRef  = useRef();
  const matRef      = useRef();
  const driftRef    = useRef(null);

  const { nonHgElements, positions, phaseAlignments } = useMemo(() => {
    const els  = ELEMENTS.filter(e => e.atomicNumber !== 80);
    const pts  = fibonacciSphere(els.length, SPHERE_RADIUS);
    const pa   = new Float32Array(els.map(e => e.phaseAffinity));
    return { nonHgElements: els, positions: pts, phaseAlignments: pa };
  }, []);

  const hgPos = useMemo(() => new THREE.Vector3(0, SPHERE_RADIUS, 0), []);

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(BASE_SIZE, 8, 8);
    g.setAttribute('phaseAlignment', new THREE.InstancedBufferAttribute(phaseAlignments, 1));
    const idxArr = new Float32Array(nonHgElements.length);
    for (let i = 0; i < nonHgElements.length; i++) idxArr[i] = i;
    g.setAttribute('instanceIndex', new THREE.InstancedBufferAttribute(idxArr, 1));
    return g;
  }, [nonHgElements, phaseAlignments]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
  }), []);

  // Sync matRef inside an effect — keeps render body pure
  useEffect(() => { matRef.current = mat; }, [mat]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Set initial instance matrices and initialise drift state
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < nonHgElements.length; i++) {
      dummy.position.copy(positions[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    driftRef.current = new Float32Array(nonHgElements.length);
    // dummy is a stable useMemo ref — this effect runs once on mount only
  }, [nonHgElements, positions, dummy]);

  // Dispose GPU resources on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((state) => {
    const t     = state.clock.elapsedTime;
    const mesh  = meshRef.current;
    const drift = driftRef.current;

    if (matRef.current) matRef.current.uniforms.uTime.value = t;
    if (groupRef.current) groupRef.current.rotation.y = t * 0.04;
    if (hgLightRef.current) {
      hgLightRef.current.intensity = 0.8 + 0.4 * Math.sin(t * 2.1);
    }

    if (mesh && drift) {
      let dirty = false;
      for (let i = 0; i < nonHgElements.length; i++) {
        if (nonHgElements[i].phaseAffinity >= 0.40) continue;
        drift[i] = (drift[i] + 0.002) % 0.15;
        const scale = 1 + drift[i] / SPHERE_RADIUS;
        dummy.position.copy(positions[i]).multiplyScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        dirty = true;
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[geo, mat, nonHgElements.length]} />

      <mesh position={hgPos}>
        <sphereGeometry args={[BASE_SIZE * 3, 16, 16]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.8}
          metalness={0.9}
          roughness={0.1}
        />
        <pointLight ref={hgLightRef} color="#f59e0b" intensity={0.8} distance={4} />
        <Html
          position={[0.3, 0, 0]}
          style={{
            color: '#f59e0b',
            fontFamily: 'monospace',
            fontSize: '9px',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          Hg · 80
        </Html>
      </mesh>

      {nonHgElements.map((el, i) => {
        if (el.phaseAffinity < 0.70) return null;
        const p = positions[i];
        return (
          <Html
            key={el.atomicNumber}
            position={[p.x, p.y, p.z]}
            style={{
              color: '#c0c0c0',
              fontFamily: 'monospace',
              fontSize: '9px',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            {el.symbol} · {el.atomicNumber}
          </Html>
        );
      })}
    </group>
  );
}
