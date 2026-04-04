import { useRef, useCallback } from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import GlassHearth from './GlassHearth';
import ThermalFlow from './ThermalFlow';

export default function ThermalScene({
  isMobile   = false,
  speed      = 0.13,
  turbulence = 0.40,
  flameWidth = 0.85,
  density    = null,
  onFps      = null,
}) {
  const controlsRef = useRef();
  const idleTimer   = useRef(null);

  const handleInteractionStart = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, []);

  const handleInteractionEnd = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (controlsRef.current) controlsRef.current.autoRotate = true;
    }, 3000);
  }, []);

  return (
    <>
      <color attach="background" args={['#060100']} />

      {/* Primary combustion source — intense base heat */}
      <pointLight position={[0, -1.6, 0]}  intensity={5.0}  color="#ff2800" distance={4}   decay={2} />
      {/* Mid-flame orange warmth */}
      <pointLight position={[0,  0.5, 0]}  intensity={1.8}  color="#ff7000" distance={5}   decay={2} />
      {/* Cool shadow rim from above — makes darks darker */}
      <pointLight position={[0,  4.0, 0]}  intensity={0.15} color="#1a0a00" distance={8}   decay={2} />
      {/* Subtle side fill so Möbius glass catches light */}
      <pointLight position={[3,  0.5, 2]}  intensity={0.4}  color="#c04000" distance={7}   decay={2} />
      <ambientLight intensity={0.05} color="#1a0500" />

      <Environment preset="sunset" />

      <GlassHearth isMobile={isMobile} />
      <ThermalFlow
        isMobile={isMobile}
        speed={speed}
        turbulence={turbulence}
        flameWidth={flameWidth}
        density={density}
        onFps={onFps}
      />

      <OrbitControls
        ref={controlsRef}
        autoRotate
        autoRotateSpeed={0.45}
        enableDamping
        dampingFactor={0.05}
        minDistance={2.5}
        maxDistance={7}
        onStart={handleInteractionStart}
        onEnd={handleInteractionEnd}
      />

      {/* Fire bloom: threshold high enough to preserve colour gradient, low enough for white-hot core */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.22}
          luminanceSmoothing={0.90}
          intensity={isMobile ? 0.8 : 1.6}
          mipmapBlur={!isMobile}
        />
      </EffectComposer>
    </>
  );
}
