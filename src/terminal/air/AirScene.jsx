import { useRef, useCallback } from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import AtmoShell from './AtmoShell';
import AtmosphericFlow from './AtmosphericFlow';

export default function AirScene({
  isMobile     = false,
  orbitalSpeed = 1.2,
  turbulence   = 0.18,
  spread       = 1.0,
  density      = null,
  onFps        = null,
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
      <color attach="background" args={['#000306']} />

      {/* Ionosphere crown — electric, dominant */}
      <pointLight position={[0,  3.2, 0]}   intensity={3.0}  color="#2255ff" distance={8}   decay={2} />
      {/* Deep atmosphere underlit — cold indigo */}
      <pointLight position={[0, -2.5, 0]}   intensity={1.0}  color="#112266" distance={6}   decay={2} />
      {/* Aurora side light — teal-green, creates shell iridescence */}
      <pointLight position={[-3, 1.5, -1]}  intensity={0.6}  color="#1a8866" distance={8}   decay={2} />
      {/* Warm dawn horizon fill on opposite side */}
      <pointLight position={[2.5, 0, 2]}    intensity={0.35} color="#4466aa" distance={7}   decay={2} />
      <ambientLight intensity={0.05} color="#0a1030" />

      <Environment preset="dawn" />

      <AtmoShell isMobile={isMobile} />
      <AtmosphericFlow
        isMobile={isMobile}
        orbitalSpeed={orbitalSpeed}
        turbulence={turbulence}
        spread={spread}
        density={density}
        onFps={onFps}
      />

      <OrbitControls
        ref={controlsRef}
        autoRotate
        autoRotateSpeed={0.6}
        enableDamping
        dampingFactor={0.05}
        minDistance={2.5}
        maxDistance={7}
        onStart={handleInteractionStart}
        onEnd={handleInteractionEnd}
      />

      {/* Atmospheric bloom — subtle halo, only ionosphere and high-altitude cloud layers trigger */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.26}
          luminanceSmoothing={0.92}
          intensity={isMobile ? 0.6 : 1.3}
          mipmapBlur={!isMobile}
        />
      </EffectComposer>
    </>
  );
}
