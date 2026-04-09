import { MeshTransmissionMaterial } from '@react-three/drei';

export default function GlassKnot({ isMobile = false, visible = true }) {
  return (
    <mesh visible={visible}>
      <torusKnotGeometry args={[1, 0.4, isMobile ? 128 : 256, isMobile ? 16 : 32, 2, 3]} />
      <MeshTransmissionMaterial
        backside
        samples={isMobile ? 2 : 8}
        thickness={0.6}
        chromaticAberration={isMobile ? 0 : 0.10}
        anisotropy={0.4}
        distortion={isMobile ? 0 : 0.22}
        distortionScale={isMobile ? 0 : 0.35}
        temporalDistortion={isMobile ? 0 : 0.12}
        iridescence={isMobile ? 0 : 0.85}
        iridescenceIOR={1.6}
        iridescenceThicknessRange={[120, 600]}
        clearcoat={1}
        clearcoatRoughness={0.05}
        transmission={1}
        roughness={0.04}
        color="#03091a"
        attenuationColor="#07204a"
        attenuationDistance={1.4}
        ior={1.58}
      />
    </mesh>
  );
}
