import { describe, it, expect } from 'vitest';
import canvasSrc from '../MercuryCanvas.jsx?raw';
import planetSrc from '../MercuryPlanet.jsx?raw';
import sphereSrc from '../MercurySphere.jsx?raw';
import threadSrc from '../threadMath.js?raw';
import tabSrc from '../../views/MercuryTab.jsx?raw';

describe('MercuryCanvas — neutral state wiring', () => {
  it('has no ghosts: no GHOST_DENSITY, every flow gets the tier counts', () => {
    expect(canvasSrc).not.toMatch(/GHOST_DENSITY/);
    expect(canvasSrc).toContain("const gasFor = (phase) => gasCounts(gasBase, TIERS[TIER].gasDensity, phase === 'thermal');");
  });
  it('opacity is the fade times the active cap, no ghost floor', () => {
    expect(canvasSrc).toContain('const ACTIVE_OPACITY = 0.45;');
    expect(canvasSrc).toContain('const opacityFor = (phase) => fades[phase] * ACTIVE_OPACITY;');
    expect(canvasSrc).not.toMatch(/0\.12/);
  });
  it('every flow is visible only while its fade is above 0, and condenses nothing', () => {
    for (const p of ['fluid', 'thermal', 'earth', 'air']) expect(canvasSrc).toContain(`visible={fades.${p} > 0}`);
    expect(canvasSrc.match(/condense=\{0\}/g)?.length).toBe(4);
    expect(canvasSrc).not.toMatch(/condenseFor|phaseCondense|sphereState|pendingPhase/);
  });
  it('precompiles the hidden flows at mount', () => {
    expect(canvasSrc).toContain("import { precompileHidden } from './planet/precompileHidden';");
    expect(canvasSrc).toContain('precompileHidden(gl, scene, camera, flows)');
    expect(canvasSrc).toContain('<PrecompileGasFlows />');
  });
  it('reports the phase from the machine, not from the tap', () => {
    expect(canvasSrc).toMatch(/useEffect\(\(\) => \{\s*onPhaseChange\?\.\(targetPhase\);\s*\}, \[targetPhase, onPhaseChange\]\);/);
    expect(canvasSrc).toMatch(/const handleNodeTap = useCallback\(\(phase\) => \{\s*triggerTransition\(phase\);\s*\}, \[triggerTransition\]\);/);
  });
  it('hands the planet the fades, the hold and the neutral FPS', () => {
    expect(canvasSrc).toContain('fades={fades}');
    expect(canvasSrc).toContain('holdLiquid={holdLiquid}');
    expect(canvasSrc).toContain('onFps={activePhase ? null : onFps}');
  });
});

describe('MercuryPlanet — neutral state wiring', () => {
  it('sets the hold on the body before stepping it', () => {
    expect(planetSrc).toMatch(/body\.holdLiquid = holdLiquid;\s*\n\s*stepBody\(body,/);
  });
  it('mirror sky weights come from the fades', () => {
    expect(planetSrc).toContain('skyWeights(fades, skyW);');
  });
});

describe('MercurySphere — lit node and thread follow the active element', () => {
  it('lights the active element only and fades the thread with it', () => {
    expect(sphereSrc).toContain('const litPhase = activePhase;');
    expect(threadSrc).toContain('export const THREAD_REST = 0.35;');
    expect(threadSrc).toContain('export const THREAD_PEAK = 0.7;');
    expect(threadSrc).toContain("activeFade * THREAD_PEAK * (transitionState === 'spinUp' ? 1 : THREAD_REST)");
    expect(threadSrc).toContain('return o + (target - o) * (1 - Math.exp(-delta / 0.25));');
    expect(sphereSrc).toContain('mat.opacity = easeThread(mat.opacity, threadTarget, delta);');
    expect(sphereSrc).not.toMatch(/sphereState|pendingPhase|nodeChrome/);
  });
});

describe('MercuryTab — boots neutral', () => {
  it('starts with no active phase and labels it neutral', () => {
    expect(tabSrc).toContain("const [activePhase, setActivePhase] = useState(null);");
    expect(tabSrc).toContain("{activePhase ?? 'neutral'} :: phase active");
  });
});

describe('MercurySphere — handle activation', () => {
  it('keeps assistive-tech clicks (detail 0) without double-firing pointer taps', () => {
    expect(sphereSrc).toContain('onClick={(e) => { if (e.detail === 0) onNodeTap(phase); }}');
    expect(sphereSrc).toContain('release ${phase}, return to neutral');
  });
});
