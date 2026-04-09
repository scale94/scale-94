import { useRef, useReducer, useCallback, useEffect } from 'react';

export const PHASES = ['fluid', 'thermal', 'earth', 'air'];

// Beat durations in ms
const BEAT_MS = { consolidating: 200, elongating: 200, flowing: 250, emerging: 150 };

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function easeIn(t)  { const c = Math.max(0, Math.min(1, t)); return c * c; }
function easeOut(t) { const c = Math.max(0, Math.min(1, t)); return 1 - (1 - c) * (1 - c); }

function idleOpacities(active) {
  return Object.fromEntries(PHASES.map(p => [p, p === active ? 1.0 : 0.12]));
}

const IDLE_SPHERE = {
  reflectivity: 1.0,
  chromePhase: 0,
  nodeChrome: 0,
  elongation: 0,
  threadProgress: 0,
  colorBlend: 0,
};

export default function usePhaseTransition(initialPhase = 'fluid') {
  const anim = useRef({
    activePhase: initialPhase,
    pendingPhase: null,
    beat: 'idle',
    beatStart: 0,
    phaseOpacities: idleOpacities(initialPhase),
    sphereState: { ...IDLE_SPHERE },
  });

  const [, forceRender] = useReducer(n => n + 1, 0);
  const rafRef = useRef(null);

  const stopAnimation = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const frame = useCallback(() => {
    const a = anim.current;
    const now = performance.now();
    const elapsed = now - a.beatStart;

    if (a.beat === 'consolidating') {
      const t = easeIn(elapsed / BEAT_MS.consolidating);
      a.phaseOpacities = Object.fromEntries(
        PHASES.map(p => [p, p === a.activePhase ? 1.0 : lerp(0.12, 0.04, t)])
      );
      a.sphereState = { ...IDLE_SPHERE, reflectivity: lerp(1.0, 2.0, t), chromePhase: t, nodeChrome: t };
      if (elapsed >= BEAT_MS.consolidating) { a.beat = 'elongating'; a.beatStart = now; }

    } else if (a.beat === 'elongating') {
      const t = easeOut(elapsed / BEAT_MS.elongating);
      a.sphereState = {
        ...IDLE_SPHERE,
        reflectivity: 2.0,
        chromePhase: lerp(1, 0.6, t),
        nodeChrome:  lerp(1, 0.4, t),
        elongation:  t,
        threadProgress: t * 0.5,
      };
      if (elapsed >= BEAT_MS.elongating) { a.beat = 'flowing'; a.beatStart = now; }

    } else if (a.beat === 'flowing') {
      const t = easeOut(elapsed / BEAT_MS.flowing);
      a.sphereState = {
        ...IDLE_SPHERE,
        reflectivity:   lerp(2.0, 1.2, t),
        chromePhase:    lerp(0.6, 0, t),
        nodeChrome:     lerp(0.4, 0, t),
        elongation:     lerp(1, 0, t),
        threadProgress: lerp(0.5, 1, t),
        colorBlend:     t,
      };
      if (elapsed >= BEAT_MS.flowing) { a.beat = 'emerging'; a.beatStart = now; }

    } else if (a.beat === 'emerging') {
      const t = easeOut(elapsed / BEAT_MS.emerging);
      a.phaseOpacities = Object.fromEntries(
        PHASES.map(p => [p, p === a.pendingPhase ? 1.0 : lerp(0.04, 0.12, t)])
      );
      a.sphereState = { ...IDLE_SPHERE, reflectivity: lerp(1.2, 1.0, t), colorBlend: 1 };
      if (elapsed >= BEAT_MS.emerging) {
        a.activePhase = a.pendingPhase;
        a.pendingPhase = null;
        a.beat = 'idle';
        a.phaseOpacities = idleOpacities(a.activePhase);
        a.sphereState = { ...IDLE_SPHERE };
        stopAnimation();
        forceRender();
        return;
      }
    }

    forceRender();
    rafRef.current = requestAnimationFrame(frame);
  }, [stopAnimation]);

  const triggerTransition = useCallback((targetPhase) => {
    const a = anim.current;
    if (targetPhase === a.activePhase || targetPhase === a.pendingPhase) return;
    stopAnimation();
    a.pendingPhase = targetPhase;
    a.beat = 'consolidating';
    a.beatStart = performance.now();
    rafRef.current = requestAnimationFrame(frame);
    forceRender();
  }, [frame, stopAnimation]);

  useEffect(() => stopAnimation, [stopAnimation]);

  const a = anim.current;
  return {
    activePhase:    a.activePhase,
    pendingPhase:   a.pendingPhase,
    transitionState: a.beat,
    phaseOpacities: a.phaseOpacities,
    sphereState:    a.sphereState,
    triggerTransition,
  };
}
