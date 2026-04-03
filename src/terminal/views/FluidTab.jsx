import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import FluidScene from '../fluid/FluidScene';

export default function FluidTab() {
  return (
    <div
      className="w-full rounded-sm overflow-hidden"
      style={{
        height: 'calc(100vh - 140px)',
        background: '#000000',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <FluidScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
