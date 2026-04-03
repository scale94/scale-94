import { useMemo } from 'react';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Build a Möbius strip geometry via BufferGeometry
function buildMobiusGeometry(segments = 128, width = 0.45) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const normals   = [];
  const uvs       = [];
  const indices   = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = t * Math.PI * 2;

    for (let j = 0; j <= 1; j++) {
      const s = j * 2 - 1; // -1 or +1

      // Möbius strip parametric equations
      const halfTwist = theta / 2;
      const r = 1.2 + s * width * Math.cos(halfTwist);
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      const z = s * width * Math.sin(halfTwist);

      positions.push(x, y, z);
      uvs.push(t, j);

      // Approximate normal via cross product of partial derivatives
      const dt = 0.001;
      const theta2 = theta + dt;
      const halfTwist2 = theta2 / 2;
      const r2 = 1.2 + s * width * Math.cos(halfTwist2);
      const dx = r2 * Math.cos(theta2) - x;
      const dy = r2 * Math.sin(theta2) - y;
      const dz = s * width * Math.sin(halfTwist2) - z;

      // Across-strip direction
      const halfTwistC = theta / 2;
      const ax = -width * Math.sin(halfTwistC) * 0.5 * Math.cos(theta);
      const ay = -width * Math.sin(halfTwistC) * 0.5 * Math.sin(theta);
      const az =  width * Math.cos(halfTwistC) * 0.5;

      // Normal = tangent × across
      const nx = dy * az - dz * ay;
      const ny = dz * ax - dx * az;
      const nz = dx * ay - dy * ax;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      normals.push(nx / nl, ny / nl, nz / nl);
    }
  }

  for (let i = 0; i < segments; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 1, base + 3, base + 2);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));
  geometry.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,       2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export default function GlassHearth({ isMobile = false }) {
  const geometry = useMemo(() => buildMobiusGeometry(isMobile ? 64 : 128, 0.42), [isMobile]);

  return (
    <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]}>
      <MeshTransmissionMaterial
        backside
        samples={isMobile ? 2 : 6}
        thickness={0.45}
        chromaticAberration={isMobile ? 0 : 0.04}
        anisotropy={0.3}
        distortion={isMobile ? 0 : 0.15}
        distortionScale={isMobile ? 0 : 0.25}
        temporalDistortion={isMobile ? 0 : 0.08}
        transmission={1}
        roughness={0.08}
        color="#1a0d00"
        attenuationColor="#c2410c"
        attenuationDistance={1.8}
        ior={1.55}
      />
    </mesh>
  );
}
