import { useMemo } from 'react';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

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
      const s = j * 2 - 1;
      const halfTwist = theta / 2;
      const r = 1.2 + s * width * Math.cos(halfTwist);
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      const z = s * width * Math.sin(halfTwist);

      positions.push(x, y, z);
      uvs.push(t, j);

      const dt = 0.001;
      const theta2 = theta + dt;
      const halfTwist2 = theta2 / 2;
      const r2 = 1.2 + s * width * Math.cos(halfTwist2);
      const dx = r2 * Math.cos(theta2) - x;
      const dy = r2 * Math.sin(theta2) - y;
      const dz = s * width * Math.sin(halfTwist2) - z;

      const halfTwistC = theta / 2;
      const ax = -width * Math.sin(halfTwistC) * 0.5 * Math.cos(theta);
      const ay = -width * Math.sin(halfTwistC) * 0.5 * Math.sin(theta);
      const az =  width * Math.cos(halfTwistC) * 0.5;

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

export default function GlassHearth({ isMobile = false, visible = true }) {
  const geometry = useMemo(() => buildMobiusGeometry(isMobile ? 64 : 128, 0.42), [isMobile]);

  return (
    // Rotated flat — Möbius lies horizontal like a hearth ring; fire rises through it
    <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0.4]} visible={visible}>
      <MeshTransmissionMaterial
        backside
        samples={isMobile ? 2 : 8}
        thickness={0.55}
        chromaticAberration={isMobile ? 0 : 0.08}
        anisotropy={0.35}
        distortion={isMobile ? 0 : 0.20}
        distortionScale={isMobile ? 0 : 0.30}
        temporalDistortion={isMobile ? 0 : 0.10}
        transmission={1}
        roughness={0.12}
        color="#100400"
        attenuationColor="#b83800"
        attenuationDistance={1.2}
        ior={1.58}
      />
    </mesh>
  );
}
