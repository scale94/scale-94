import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { NODES, FEATURES } from '../../data/nodeFeatures';
import { nodeColor } from '../../data/kernelColorMap';
import { CHAPTER_BY_SECTOR } from '../../data/manifestoChapters';
import { project16Dto3D } from './kernelSpherePca';

// Fresnel rim — quiet steel atmosphere, no Mercury-specific theming.
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
    float rim = pow(1.0 - abs(dot(vN, vV)), 2.6);
    float drift = 0.55 + 0.45 * sin(uTime * 0.4 + vN.y * 1.8);
    vec3 col = mix(vec3(0.30, 0.34, 0.46), vec3(0.10, 0.20, 0.36), drift);
    gl_FragColor = vec4(col, rim * 0.22);
  }
`;

const SPHERE_RADIUS = 2.8;
const NODE_SIZE = 0.045;

// Pull legacy 16-D submatrix and project once.
function useProjection() {
  return useMemo(() => {
    const sub = FEATURES.map(row => row.slice(0, 16));
    const { coords } = project16Dto3D(sub);
    // Scale to sphere radius
    return coords.map(([x, y, z]) => new THREE.Vector3(
      x * SPHERE_RADIUS, y * SPHERE_RADIUS, z * SPHERE_RADIUS,
    ));
  }, []);
}

// Cluster centroid positions and chapter mapping.
function useClusterCentroids(positions) {
  return useMemo(() => {
    const clusters = {};
    for (let i = 0; i < NODES.length; i++) {
      const c = NODES[i].cluster;
      if (!clusters[c]) clusters[c] = { sum: new THREE.Vector3(), count: 0, color: null };
      clusters[c].sum.add(positions[i]);
      clusters[c].count++;
      if (!clusters[c].color) clusters[c].color = nodeColor(NODES[i].id, c);
    }
    return Object.entries(clusters).map(([id, c]) => ({
      id,
      pos: c.sum.divideScalar(c.count),
      color: c.color,
      chapter: CHAPTER_BY_SECTOR[id] || null,
    }));
  }, [positions]);
}

export default function KernelSphere({ onChapterSelect }) {
  const groupRef = useRef();
  const meshRef = useRef();
  const matRef = useRef();
  const atmosMatRef = useRef();
  const [hover, setHover] = useState(null);

  const positions = useProjection();
  const centroids = useClusterCentroids(positions);

  // Per-instance color from cluster hue
  const colors = useMemo(() => {
    const arr = new Float32Array(NODES.length * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < NODES.length; i++) {
      const c = nodeColor(NODES[i].id, NODES[i].cluster);
      tmp.setHSL(c.hue / 360, c.sat / 100, c.lit / 100);
      arr[i * 3] = tmp.r;
      arr[i * 3 + 1] = tmp.g;
      arr[i * 3 + 2] = tmp.b;
    }
    return arr;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(NODE_SIZE, 8, 8);
    g.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));
    return g;
  }, [colors]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 instanceColor;
      varying vec3 vCol;
      void main() {
        vCol = instanceColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      uniform float uTime;
      void main() {
        gl_FragColor = vec4(vCol * (0.85 + 0.15 * sin(uTime * 1.2)), 0.95);
      }
    `,
  }), []);

  const atmosMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: ATMOS_VERT,
    fragmentShader: ATMOS_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
  }), []);

  useEffect(() => { matRef.current = mat; }, [mat]);
  useEffect(() => { atmosMatRef.current = atmosMat; }, [atmosMat]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Place instances
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < NODES.length; i++) {
      dummy.position.copy(positions[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions, dummy]);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
      atmosMat.dispose();
    };
  }, [geo, mat, atmosMat]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (matRef.current) matRef.current.uniforms.uTime.value = t;
    if (atmosMatRef.current) atmosMatRef.current.uniforms.uTime.value = t;
    if (groupRef.current) groupRef.current.rotation.y = t * 0.035;
  });

  const handleNodeClick = useCallback((e) => {
    e.stopPropagation();
    const idx = e.instanceId;
    if (idx == null) return;
    const cluster = NODES[idx].cluster;
    const chapter = CHAPTER_BY_SECTOR[cluster];
    if (chapter) onChapterSelect?.(chapter);
  }, [onChapterSelect]);

  const handleCentroidClick = useCallback((centroid) => (e) => {
    e.stopPropagation();
    if (centroid.chapter) onChapterSelect?.(centroid.chapter);
  }, [onChapterSelect]);

  return (
    <group ref={groupRef}>
      {/* Atmosphere */}
      <mesh>
        <sphereGeometry args={[SPHERE_RADIUS * 1.18, 36, 28]} />
        <primitive object={atmosMat} attach="material" />
      </mesh>

      {/* All 272 kernel nodes */}
      <instancedMesh
        ref={meshRef}
        args={[geo, mat, NODES.length]}
        onClick={handleNodeClick}
        onPointerOver={(e) => { e.stopPropagation(); setHover(e.instanceId ?? null); }}
        onPointerOut={() => setHover(null)}
      />

      {/* Cluster centroids — large labelled spheres, click anchor for the chapter */}
      {centroids.map((c) => (
        <group key={c.id} position={[c.pos.x, c.pos.y, c.pos.z]}>
          <mesh onClick={handleCentroidClick(c)}>
            <sphereGeometry args={[NODE_SIZE * 2.4, 16, 16]} />
            <meshStandardMaterial
              color={`hsl(${c.color.hue.toFixed(0)}, ${c.color.sat.toFixed(0)}%, ${c.color.lit.toFixed(0)}%)`}
              emissive={`hsl(${c.color.hue.toFixed(0)}, ${c.color.sat.toFixed(0)}%, ${(c.color.lit * 0.7).toFixed(0)}%)`}
              emissiveIntensity={0.6}
              metalness={0.6}
              roughness={0.35}
            />
          </mesh>
          <Html
            position={[0.18, 0.04, 0]}
            zIndexRange={[10, 0]}
            style={{
              color: c.chapter ? '#c8c8d4' : '#3a3a48',
              fontFamily: "'Geist Mono', ui-monospace, monospace",
              fontSize: '9px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              pointerEvents: 'none',
              opacity: c.chapter ? 0.85 : 0.45,
            }}
          >
            §{c.id}
          </Html>
        </group>
      ))}

      {/* Hover hint on individual nodes */}
      {hover != null && (
        <Html
          position={positions[hover]}
          zIndexRange={[10, 0]}
          style={{
            color: '#9ca3af',
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            fontSize: '9px',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none',
            background: 'rgba(4,4,12,0.92)',
            border: '1px solid rgba(120,140,200,0.18)',
            padding: '3px 6px',
            borderRadius: 2,
            transform: 'translate(8px, -50%)',
          }}
        >
          {NODES[hover].label} · {NODES[hover].cluster}
        </Html>
      )}

      <ambientLight intensity={0.25} color="#1a1f2e" />
      <pointLight position={[5, 4, 5]} intensity={0.6} color="#a8b4d8" />
    </group>
  );
}
