import { useRef, useCallback } from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
import GlassKnot from './GlassKnot';
import ParticleFlow from './ParticleFlow';

export default function FluidScene({ isMobile = false }) {
  const controlsRef = useRef();
  const idleTimer = useRef(null);

  // Resume auto-rotate after 3s idle
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

      {/* Transmission material needs an environment to refract */}
      <Environment preset="night" />

      <GlassKnot isMobile={isMobile} />
      <ParticleFlow isMobile={isMobile} />

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
