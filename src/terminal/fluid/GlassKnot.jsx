import { MeshTransmissionMaterial } from '@react-three/drei';

export default function GlassKnot({ isMobile = false }) {
  return (
    <mesh>
      <torusKnotGeometry args={[1, 0.4, isMobile ? 128 : 256, isMobile ? 16 : 32, 2, 3]} />
      <MeshTransmissionMaterial
        backside
        samples={isMobile ? 2 : 6}
        thickness={0.5}
        chromaticAberration={isMobile ? 0 : 0.03}
        anisotropy={0.2}
        distortion={isMobile ? 0 : 0.1}
        distortionScale={isMobile ? 0 : 0.2}
        temporalDistortion={isMobile ? 0 : 0.1}
        iridescence={isMobile ? 0 : 0.4}
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
