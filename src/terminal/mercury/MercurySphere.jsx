import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Day-side light ref is set on the group and positioned to face the active orbit node,
// creating the planet Mercury illumination: one bright hemisphere, one in shadow.

// Cardinal positions: N=air, E=fire(thermal), S=earth, W=water(fluid)
// Alchemical triangle symbols: fire=▲, water=▽, air=▲+bar, earth=▽+bar
const ORBIT_NODES = [
  { phase: 'air',     angle: Math.PI / 2,  color: '#38bdf8', element: 'AIR',   glyph: 'air'   },
  { phase: 'thermal', angle: 0,            color: '#f97316', element: 'FIRE',  glyph: 'fire'  },
  { phase: 'earth',   angle: -Math.PI / 2, color: '#d97706', element: 'EARTH', glyph: 'earth' },
  { phase: 'fluid',   angle: Math.PI,      color: '#6366f1', element: 'WATER', glyph: 'water' },
];

// Alchemical SVG symbol paths for each element
function ElementGlyph({ glyph, color, size = 26 }) {
  const s = size;
  const cx = s / 2, cy = s / 2;
  // Triangle points
  const up   = { x: cx, y: 2 };
  const bl   = { x: 2,  y: s - 2 };
  const br   = { x: s - 2, y: s - 2 };
  const down = { x: cx, y: s - 2 };
  const tl   = { x: 2,  y: 2 };
  const tr   = { x: s - 2, y: 2 };
  // Crossbar positions
  const barY  = cy + 4;  // on lower third of upward triangle
  const barY2 = cy - 4;  // on upper third of downward triangle
  const barX1 = cx - s * 0.28;
  const barX2 = cx + s * 0.28;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block', overflow: 'visible' }}>
      {glyph === 'fire' && (
        <polygon points={`${up.x},${up.y} ${br.x},${br.y} ${bl.x},${bl.y}`}
          fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      )}
      {glyph === 'water' && (
        <polygon points={`${down.x},${down.y} ${tl.x},${tl.y} ${tr.x},${tr.y}`}
          fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      )}
      {glyph === 'air' && (<>
        <polygon points={`${up.x},${up.y} ${br.x},${br.y} ${bl.x},${bl.y}`}
          fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        <line x1={barX1} y1={barY} x2={barX2} y2={barY} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </>)}
      {glyph === 'earth' && (<>
        <polygon points={`${down.x},${down.y} ${tl.x},${tl.y} ${tr.x},${tr.y}`}
          fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        <line x1={barX1} y1={barY2} x2={barX2} y2={barY2} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </>)}
    </svg>
  );
}

const ORBIT_RADIUS = 1.4;
const PRECESSION_RATE = 0.3 * (Math.PI / 180); // 0.3°/s in radians
const PRECESSION_DRIFT = 0.5 * (Math.PI / 180); // 0.5° drift per full cycle

export default function MercurySphere({
  activePhase,
  pendingPhase,
  sphereState,
  onNodeTap,
  onElementFired = null,
  sargScore = 1.0,
  isMobile = false,
}) {
  const sphereRef  = useRef();
  const ringRef    = useRef();
  const dayLightRef = useRef();
  const orbitAngleRef = useRef(0);
  const cycleCountRef = useRef(0);

  // Rotation velocity tracking for mercury viscosity deformation
  const prevAzimuthRef = useRef(null);
  const rotVelRef      = useRef(0);   // smoothed angular speed
  // Spring-damper state for each axis (surface tension snap-back)
  const deformXRef = useRef(1);
  const deformYRef = useRef(1);
  const deformZRef = useRef(1);

  // Click burst state for handle animation
  const [pressedPhase, setPressedPhase] = useState(null);

  const litPhase = pendingPhase ?? activePhase;

  useFrame(({ camera }, delta) => {
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

    // ── Mercury viscosity deformation ────────────────────────────────────────
    // Track camera azimuth → angular speed → oblate spheroid deformation.
    // Real liquid mercury: high surface tension (fast snap-back), low viscosity.
    // Spinning creates equatorial bulge (X/Z grow) + polar squash (Y shrinks).
    const azimuth = Math.atan2(camera.position.x, camera.position.z);
    if (prevAzimuthRef.current !== null) {
      let da = azimuth - prevAzimuthRef.current;
      if (da >  Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      const speed = Math.abs(da) / Math.max(delta, 0.001);
      // Fast EMA: velocity collapses quickly when you stop (surface tension wins)
      rotVelRef.current = rotVelRef.current * 0.68 + speed * 0.32;
    }
    prevAzimuthRef.current = azimuth;

    if (sphereRef.current) {
      const { elongation } = sphereState;
      const litNode = ORBIT_NODES.find(n => n.phase === litPhase);
      const targetAngle = litNode ? litNode.angle + orbitAngleRef.current : 0;
      const baseX = 1 + elongation * 0.15 * Math.cos(targetAngle);
      const baseY = 1 + elongation * 0.15 * Math.sin(targetAngle);

      // Oblate deformation magnitude — up to 50% when spinning hard
      const rotDeform = Math.min(rotVelRef.current * 0.58, 0.50);

      // Target shape: oblate spheroid (equatorial bulge, polar flatten)
      const txScale = baseX * (1 + rotDeform * 0.85); // equatorial X grows
      const tyScale = baseY * (1 - rotDeform * 0.65); // polar Y squashes
      const tzScale = 1     + rotDeform * 0.65;       // equatorial Z grows

      // Surface tension spring: stiffness 20 → snaps back in ~3 frames at 60fps
      const dt = Math.min(delta, 0.05);
      const k  = Math.min(20 * dt, 0.95);
      deformXRef.current += (txScale - deformXRef.current) * k;
      deformYRef.current += (tyScale - deformYRef.current) * k;
      deformZRef.current += (tzScale - deformZRef.current) * k;

      sphereRef.current.scale.set(deformXRef.current, deformYRef.current, deformZRef.current);
    }
  });

  const activeNode   = ORBIT_NODES.find(n => n.phase === activePhase);
  const pendingNode  = ORBIT_NODES.find(n => n.phase === pendingPhase) ?? activeNode;
  const activeColor  = new THREE.Color(activeNode?.color  ?? '#6366f1');
  const pendingColor = new THREE.Color(pendingNode?.color ?? '#6366f1');

  const cp = sphereState.chromePhase; // 0 = planet, 1 = liquid Hg

  // Planet Mercury: grey rocky surface with 12% element tint
  const planetGrey = new THREE.Color('#787878').lerp(activeColor, 0.12);
  // Liquid mercury: pure silver chrome
  const liquidSilver = new THREE.Color('#c4c4c8');
  // Element re-emergence: new element hue bleeds back in on day side
  const emergeColor = liquidSilver.clone().lerp(
    new THREE.Color(pendingNode?.color ?? '#6366f1'), sphereState.colorBlend * 0.25
  );

  // Interpolate: rocky planet → mirror liquid Hg
  const sphereColor = planetGrey.clone().lerp(emergeColor, cp);

  // Material properties:
  // Planet state  → rough 0.72, metalness 0.65 (rocky, diffuse, non-reflective)
  // Liquid Hg     → rough 0.02, metalness 0.99 (mirror, perfectly smooth)
  const roughness  = 0.72 - cp * 0.70;
  const metalness  = 0.65 + cp * 0.34;
  const clearcoat  = cp * 0.95;          // clearcoat only on liquid state
  const envIntensity = (0.3 + cp * 2.7) * Math.min(1, sargScore);

  // Day-side light: cool grey in planet mode, pure chrome-white in liquid mode
  const dayLightColor = new THREE.Color('#9a9aaa').lerp(new THREE.Color('#e8e8f0'), cp);
  // Intensity ramps up during consolidation — the "polishing" moment
  const dayIntensity = 1.8 + cp * 2.2;

  return (
    <group>
      {/* Day-side directional light — positioned in useFrame toward active node */}
      <directionalLight
        ref={dayLightRef}
        color={dayLightColor}
        intensity={dayIntensity}
        castShadow={false}
      />
      {/* Night-side fill — deep cold shadow */}
      <directionalLight
        position={[-3, -3, -2]}
        color="#060610"
        intensity={0.1}
      />

      {/* Mercury sphere — planet ↔ liquid Hg material transition */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.75, 64, 64]} />
        <meshPhysicalMaterial
          color={sphereColor}
          metalness={metalness}
          roughness={roughness}
          clearcoat={clearcoat}
          clearcoatRoughness={0.05}
          envMapIntensity={envIntensity}
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
        {ORBIT_NODES.map(({ phase, angle, color, element, glyph }) => {
          const x = Math.cos(angle) * ORBIT_RADIUS;
          const y = Math.sin(angle) * ORBIT_RADIUS;
          const isLit  = phase === litPhase;
          const nodeColor = new THREE.Color(color)
            .lerp(new THREE.Color('#c0c0c0'), sphereState.nodeChrome);
          // Interpolate color hex for HTML elements as chromePhase changes
          const htmlColor = '#' + nodeColor.getHexString();

          const isPressed = pressedPhase === phase;
          const hitSize   = isMobile ? 104 : 92;

          return (
            <group key={phase} position={[x, y, 0]}>
              {/* Visible 3D anchor dot */}
              <mesh>
                <sphereGeometry args={[0.055, 16, 16]} />
                <meshBasicMaterial
                  color={nodeColor}
                  transparent
                  opacity={isLit ? 1.0 : 0.45}
                />
              </mesh>
              {/* Elemental handle */}
              <Html center>
                <div
                  style={{
                    width:  hitSize,
                    height: hitSize,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    position: 'relative',
                    // Press-burst: scale up + spring back
                    transform: isPressed ? 'scale(1.38)' : 'scale(1)',
                    transition: isPressed
                      ? 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)'
                      : 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onClick={() => onNodeTap(phase)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setPressedPhase(phase);
                    onNodeTap(phase);
                    onElementFired?.(phase, e.clientX, e.clientY);
                    setTimeout(() => setPressedPhase(null), 380);
                  }}
                  aria-label={`${element} — switch to ${phase} phase`}
                >
                  {/* Circular ring — bursts on press */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: `${isPressed ? 1.5 : 1}px solid ${htmlColor}${isLit || isPressed ? 'dd' : '44'}`,
                    boxShadow: isPressed
                      ? `0 0 18px ${htmlColor}99, 0 0 40px ${htmlColor}55, inset 0 0 16px ${htmlColor}33`
                      : isLit
                        ? `0 0 10px ${htmlColor}55, 0 0 22px ${htmlColor}28, inset 0 0 8px ${htmlColor}18`
                        : 'none',
                    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                    pointerEvents: 'none',
                  }} />
                  {/* Alchemical glyph */}
                  <div style={{ pointerEvents: 'none', opacity: isLit || isPressed ? 1 : 0.45, transition: 'opacity 0.4s ease' }}>
                    <ElementGlyph glyph={glyph} color={htmlColor} size={28} />
                  </div>
                  {/* Element name */}
                  <span style={{
                    fontSize: 7,
                    fontFamily: "'Geist Mono', ui-monospace, monospace",
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    color: htmlColor,
                    opacity: isLit || isPressed ? 0.9 : 0.35,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    transition: 'opacity 0.4s ease',
                    lineHeight: 1,
                  }}>
                    {element}
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
