import { useRef, useCallback } from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
import GlassKnot from './GlassKnot';
import ParticleFlow from './ParticleFlow';

export default function FluidScene({
  isMobile = false,
  speed = 0.08,
  curlAmp = 0.02,
  tubeRadius = 0.32,
  chromatic = 0.0,
  density = null,
  onFps = null,
}) {
  const controlsRef = useRef();
  const idleTimer = useRef(null);

  const handleInteractionEnd = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (controlsRef.current) controlsRef.current.autoRotate = true;
    }, 3000);
  }, []);

  const handleInteractionStart = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, []);

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.5} />

      <Environment preset="night" />

      <GlassKnot isMobile={isMobile} />
      <ParticleFlow
        isMobile={isMobile}
        speed={speed}
        curlAmp={curlAmp}
        tubeRadius={tubeRadius}
        chromatic={chromatic}
        density={density}
        onFps={onFps}
      />

      <OrbitControls
        ref={controlsRef}
        autoRotate
        autoRotateSpeed={0.4}
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={6}
        onStart={handleInteractionStart}
        onEnd={handleInteractionEnd}
      />
    </>
  );
}
