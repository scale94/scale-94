import { MeshTransmissionMaterial } from '@react-three/drei';

export default function CrystalGeode({ isMobile = false }) {
  return (
    <mesh scale={[1.4, 1.4, 1.4]}>
      {/* detail=2 → 320 triangular faces — properly crystalline */}
      <icosahedronGeometry args={[1, 2]} />
      <MeshTransmissionMaterial
        backside
        samples={isMobile ? 2 : 6}
        thickness={0.55}
        transmission={1}
        roughness={0.03}
        chromaticAberration={isMobile ? 0 : 0.06}
        anisotropy={0.35}
        distortion={isMobile ? 0 : 0.14}
        distortionScale={isMobile ? 0 : 0.22}
        temporalDistortion={isMobile ? 0 : 0.07}
        iridescence={isMobile ? 0 : 0.55}
        iridescenceIOR={1.5}
        iridescenceThicknessRange={[100, 400]}
        color="#0e0602"
        attenuationColor="#6b3a10"
        attenuationDistance={1.6}
        ior={1.55}
      />
    </mesh>
  );
}
