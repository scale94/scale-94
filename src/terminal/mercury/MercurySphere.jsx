import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Day-side light ref is set on the group and positioned to face the active orbit node,
// creating the planet Mercury illumination: one bright hemisphere, one in shadow.

// Cardinal positions: N=air, E=thermal, S=earth, W=fluid
const ORBIT_NODES = [
  { phase: 'air',     angle: Math.PI / 2,        symbol: '△', color: '#38bdf8' },
  { phase: 'thermal', angle: 0,                  symbol: '⊙', color: '#f97316' },
  { phase: 'earth',   angle: -Math.PI / 2,       symbol: '◻', color: '#d97706' },
  { phase: 'fluid',   angle: Math.PI,            symbol: '~', color: '#6366f1' },
];

const ORBIT_RADIUS = 1.4;
const PRECESSION_RATE = 0.3 * (Math.PI / 180); // 0.3°/s in radians
const PRECESSION_DRIFT = 0.5 * (Math.PI / 180); // 0.5° drift per full cycle

export default function MercurySphere({
  activePhase,
  pendingPhase,
  sphereState,
  onNodeTap,
  sargScore = 1.0,
}) {
  const sphereRef  = useRef();
  const ringRef    = useRef();
  const dayLightRef = useRef();
  const orbitAngleRef = useRef(0);
  const cycleCountRef = useRef(0);

  const litPhase = pendingPhase ?? activePhase;

  useFrame((_, delta) => {
    orbitAngleRef.current += PRECESSION_RATE * delta;
    if (orbitAngleRef.current >= Math.PI * 2) {
      cycleCountRef.current++;
      orbitAngleRef.current -= Math.PI * 2;
      orbitAngleRef.current += PRECESSION_DRIFT;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = orbitAngleRef.current;
    }

    // Day-side directional light tracks the active (lit) orbit node —
    // creates planet Mercury's illuminated hemisphere facing the node.
    if (dayLightRef.current) {
      const litNode = ORBIT_NODES.find(n => n.phase === litPhase);
      const nodeAngle = litNode ? litNode.angle + orbitAngleRef.current : 0;
      dayLightRef.current.position.set(
        Math.cos(nodeAngle) * 4,
        Math.sin(nodeAngle) * 4,
        2
      );
    }

    if (sphereRef.current) {
      const { elongation } = sphereState;
      const litNode = ORBIT_NODES.find(n => n.phase === litPhase);
      const targetAngle = litNode ? litNode.angle + orbitAngleRef.current : 0;
      const scaleX = 1 + elongation * 0.15 * Math.cos(targetAngle);
      const scaleY = 1 + elongation * 0.15 * Math.sin(targetAngle);
      sphereRef.current.scale.set(scaleX, scaleY, 1);
    }
  });

  const activeNode   = ORBIT_NODES.find(n => n.phase === activePhase);
  const pendingNode  = ORBIT_NODES.find(n => n.phase === pendingPhase) ?? activeNode;
  const activeColor  = new THREE.Color(activeNode?.color  ?? '#6366f1');
  const pendingColor = new THREE.Color(pendingNode?.color ?? '#6366f1');
  const sphereColor  = activeColor.clone().lerp(pendingColor, sphereState.colorBlend);

  const finalReflectivity = Math.min(1, sargScore) * sphereState.reflectivity;

  // Day-side light color: element hue at 15%, chrome at 85% — pure chrome during consolidation
  const dayLightColor = new THREE.Color(activeNode?.color ?? '#c8c8d8')
    .lerp(new THREE.Color('#c8c8d8'), 0.85 + sphereState.chromePhase * 0.15);

  return (
    <group>
      {/* Day-side directional light — positioned in useFrame toward active node */}
      <directionalLight
        ref={dayLightRef}
        color={dayLightColor}
        intensity={2.5 + sphereState.chromePhase * 1.5}
        castShadow={false}
      />
      {/* Night-side fill — deep cold shadow, very dim */}
      <directionalLight
        position={[-3, -3, -2]}
        color="#0a0a18"
        intensity={0.15}
      />

      {/* Mercury sphere — ~80px equivalent in world space */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.75, 64, 64]} />
        <meshPhysicalMaterial
          color={sphereColor}
          metalness={0.98}
          roughness={Math.max(0.02, 0.35 - finalReflectivity * 0.3)}
          reflectivity={finalReflectivity}
          clearcoat={0.8}
          clearcoatRoughness={0.1}
          envMapIntensity={finalReflectivity * 3}
        />
      </mesh>

      {/* Orbit ring — precesses via rotation.z in useFrame */}
      <group ref={ringRef}>
        {/* Dashed ring drawn as thin torus */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ORBIT_RADIUS, 0.004, 8, 80]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
        </mesh>

        {/* Mercury thread — only visible during elongating/flowing beats */}
        {sphereState.threadProgress > 0 && (() => {
          const litNode = ORBIT_NODES.find(n => n.phase === litPhase);
          if (!litNode) return null;
          const endX = Math.cos(litNode.angle) * ORBIT_RADIUS * sphereState.threadProgress;
          const endY = Math.sin(litNode.angle) * ORBIT_RADIUS * sphereState.threadProgress;
          const midX = endX / 2;
          const midY = endY / 2;
          const length = Math.sqrt(endX * endX + endY * endY);
          const angle  = Math.atan2(endY, endX);
          return (
            <mesh position={[midX, midY, 0]} rotation={[0, 0, angle]}>
              <cylinderGeometry args={[0.008, 0.002, length, 6]} />
              <meshBasicMaterial color="#d0d0d0" transparent opacity={0.7} />
            </mesh>
          );
        })()}

        {/* Orbit nodes */}
        {ORBIT_NODES.map(({ phase, angle, symbol, color }) => {
          const x = Math.cos(angle) * ORBIT_RADIUS;
          const y = Math.sin(angle) * ORBIT_RADIUS;
          const isLit  = phase === litPhase;
          const nodeColor = new THREE.Color(color)
            .lerp(new THREE.Color('#c0c0c0'), sphereState.nodeChrome);

          return (
            <group key={phase} position={[x, y, 0]}>
              {/* Visible dot */}
              <mesh>
                <sphereGeometry args={[0.06, 12, 12]} />
                <meshBasicMaterial
                  color={nodeColor}
                  transparent
                  opacity={isLit ? 1.0 : 0.5}
                />
              </mesh>
              {/* Invisible 48px HTML touch target */}
              <Html center>
                <div
                  style={{ width: 48, height: 48, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => onNodeTap(phase)}
                  onPointerDown={(e) => { e.stopPropagation(); onNodeTap(phase); }}
                  aria-label={`Switch to ${phase} phase`}
                >
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none', userSelect: 'none' }}>
                    {symbol}
                  </span>
                </div>
              </Html>
            </group>
          );
        })}
      </group>
    </group>
  );
}
