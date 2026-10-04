import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ORBIT_NODES, ORBIT_RADIUS, orbitPrecessionAngle } from './orbitNodes';

// Orbit ring, mercury thread and elemental handles. The planet is MercuryPlanet.

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

export default function MercurySphere({
  activePhase,
  pendingPhase,
  sphereState,
  onNodeTap,
  onElementFired = null,
  isMobile = false,
}) {
  const ringRef = useRef();

  // Click burst state for handle animation
  const [pressedPhase, setPressedPhase] = useState(null);

  const litPhase = pendingPhase ?? activePhase;

  // The planet itself is MercuryPlanet (raw shader, real Sun). This component
  // keeps the orbit ring, the mercury thread and the element handles.
  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = orbitPrecessionAngle(clock.elapsedTime);
    }
  });

  return (
    <group>

      {/* Orbit ring — precesses via rotation.z in useFrame */}
      <group ref={ringRef}>
        {/* Dashed ring drawn as thin torus */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ORBIT_RADIUS, 0.004, 8, 80]} />
          {/* no depth write: seen edge-on its near half crosses the planet, and a written depth there punched a dark line
              through the planet and clipped the visitors drawn after it */}
          <meshBasicMaterial color="#ffffff" transparent opacity={0.12} depthWrite={false} />
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
