// src/terminal/mercury/__tests__/cornerLayoutWiring.test.js — source-level wiring of the portrait-phone corner layout
// (the repo's idiom for r3f glue): one node-position source, a round hit area, the taller phone stage.
import { describe, it, expect } from 'vitest';
import sphereSrc from '../MercurySphere.jsx?raw';
import planetSrc from '../MercuryPlanet.jsx?raw';
import hookSrc from '../useStageCameraDist.js?raw';
import tabSrc from '../../views/MercuryTab.jsx?raw';

describe('corner layout wiring', () => {
  it('the handles and the thread read nodePosition; in corners the ring is off and nothing precesses', () => {
    expect(sphereSrc).toContain('const { layout } = useStageLayout(isMobile);');
    expect(sphereSrc).toContain('const [x, y] = nodePosition({ phase, angle }, 0, layout);');
    expect(sphereSrc).toContain('const [endX, endY] = nodePosition(litNode, 0, layout);');
    expect(sphereSrc).toContain('ringRef.current.rotation.z = corners ? 0 : orbitPrecessionAngle(clock.elapsedTime);');
    expect(sphereSrc).toContain('{!corners && (');
    expect(sphereSrc).not.toMatch(/Math\.(cos|sin)\(\w+\) \* ORBIT_RADIUS/); // no private copy of the ring
  });
  it('in corners the hit area is round: the circle phoneLayout keeps a flick gap from the sphere', () => {
    expect(sphereSrc).toContain("borderRadius: corners ? '50%' : undefined,");
  });
  it('the visitors launch from, and the mirror reflects, the same node positions', () => {
    expect(planetSrc).toContain('const p = nodePosition(node, precession, stageLayoutRef.current);');
    expect(planetSrc).toContain('const [x, y, z] = nodePosition(node, precession, stageLayoutRef.current);');
    expect(planetSrc).not.toContain('nodeWorldPosition(');
  });
  it('the hook: corners on a portrait phone, the ring fit otherwise; the default export is still the distance', () => {
    expect(hookSrc).toContain('if (isCornerLayout({ isMobile, wPx: w, hPx: h })) {');
    expect(hookSrc).toContain('return useStageLayout(isMobile).dist;');
  });
  it('a portrait phone gets the taller stage; a landscape phone and desktop keep theirs', () => {
    expect(tabSrc).toContain('? { height: phoneStageHeightCss(phoneStage.w) }');
    expect(tabSrc).toContain("? { height: 'calc(100svh - 420px - env(safe-area-inset-bottom, 0px))' }");
    expect(tabSrc).toContain(": { aspectRatio: '16 / 9', maxHeight: `calc(100svh - ${NAV_OFFSET_PX}px)` }),");
  });
});
