import { MeshTransmissionMaterial } from '@react-three/drei';

export default function AtmoShell({ isMobile = false }) {
  return (
    <mesh>
      <sphereGeometry args={[1.45, isMobile ? 32 : 64, isMobile ? 16 : 32]} />
      <MeshTransmissionMaterial
        backside
        samples={isMobile ? 2 : 6}
        thickness={0.4}
        transmission={0.98}
        roughness={0.02}
        chromaticAberration={isMobile ? 0 : 0.06}
        anisotropy={0.2}
        distortion={isMobile ? 0 : 0.12}
        distortionScale={isMobile ? 0 : 0.18}
        temporalDistortion={isMobile ? 0 : 0.07}
        iridescence={isMobile ? 0 : 0.35}
        iridescenceIOR={1.3}
        iridescenceThicknessRange={[200, 800]}
        color="#010418"
        attenuationColor="#1a3a80"
        attenuationDistance={2.0}
        ior={1.30}
      />
    </mesh>
  );
}
