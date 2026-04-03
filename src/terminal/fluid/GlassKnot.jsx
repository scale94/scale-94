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
