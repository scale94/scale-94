import { useRef, useCallback } from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
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
      <color attach="background" args={['#080300']} />

      {/* Warm base glow beneath the flame */}
      <pointLight position={[0, -1.4, 0]}  intensity={3.5}  color="#ff3800" distance={4}   decay={2} />
      {/* Secondary cooler mid-flame light */}
      <pointLight position={[0,  0.4, 0]}  intensity={1.2}  color="#ff8c00" distance={5}   decay={2} />
      {/* Subtle cool backlight for Möbius glass refraction */}
      <pointLight position={[2,  3,   2]}  intensity={0.35} color="#ffcc80" distance={10}  decay={2} />
      <ambientLight intensity={0.08} color="#ff4500" />

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
    </>
  );
}
