import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import TFGSphere from './TFGSphere';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export default function TFGCanvas() {
  return (
    <div style={{ height: isMobile ? 360 : 500, width: '100%', touchAction: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: '#04040a' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.15} color="#0a0a14" />
          <TFGSphere />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={4}
            maxDistance={12}
            enablePan={false}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
