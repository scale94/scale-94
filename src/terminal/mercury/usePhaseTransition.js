import { useRef, useReducer, useCallback, useEffect } from 'react';
import { TUNE } from './mercuryTuning';

export const PHASES = ['fluid', 'thermal', 'earth', 'air'];

// Beat durations in ms
const BEAT_MS = { consolidating: 200, elongating: 200, flowing: 250, emerging: 150 };

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function easeIn(t)  { const c = Math.max(0, Math.min(1, t)); return c * c; }
function easeOut(t) { const c = Math.max(0, Math.min(1, t)); return 1 - (1 - c) * (1 - c); }

// The breath's envelope: how contracted the nebula is (0 = home, 1 = inside
// the drop) for a given beat and its already-eased progress. Pure — exported
// for tests; the hook feeds it the same eased t it uses for opacities.
export function condenseEnvelope(beat, easedT) {
  if (beat === 'consolidating') return easedT;          // inhale
  if (beat === 'elongating' || beat === 'flowing') return 1; // held — flash owns the frame
  if (beat === 'emerging') return 1 - easedT;           // exhale: launch fast, settle slow
  return 0;                                             // idle
}

function condenseAll(value) {
  return Object.fromEntries(PHASES.map(p => [p, value]));
}

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
    phaseCondense: condenseAll(0),
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
      // The clouds part for the mirror: the ACTIVE phase ducks too (not just
      // ghosts), so the chrome flash and its reflected world read through a
      // momentary clearing instead of through the nebula. Held low through
      // elongating/flowing (those beats don't touch opacities); the new
      // element's cloud floods back in during emerging.
      a.phaseOpacities = Object.fromEntries(
        PHASES.map(p => [p, p === a.activePhase ? lerp(1.0, TUNE.duckActive, t) : lerp(0.12, TUNE.duckGhost, t)])
      );
      a.phaseCondense = condenseAll(condenseEnvelope('consolidating', t));
      a.sphereState = { ...IDLE_SPHERE, reflectivity: lerp(1.0, 2.0, t), chromePhase: t, nodeChrome: t };
      if (elapsed >= BEAT_MS.consolidating) { a.beat = 'elongating'; a.beatStart = now; }

    } else if (a.beat === 'elongating') {
      const t = easeOut(elapsed / BEAT_MS.elongating);
      a.phaseCondense = condenseAll(1);
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
      a.phaseCondense = condenseAll(1);
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
        PHASES.map(p => [p, p === a.pendingPhase ? lerp(TUNE.duckActive, 1.0, t) : lerp(TUNE.duckGhost, 0.12, t)])
      );
      a.phaseCondense = condenseAll(condenseEnvelope('emerging', t));
      a.sphereState = { ...IDLE_SPHERE, reflectivity: lerp(1.2, 1.0, t), colorBlend: 1 };
      if (elapsed >= BEAT_MS.emerging) {
        a.activePhase = a.pendingPhase;
        a.pendingPhase = null;
        a.beat = 'idle';
        a.phaseOpacities = idleOpacities(a.activePhase);
        a.phaseCondense = condenseAll(0);
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
    phaseCondense:  a.phaseCondense,
    sphereState:    a.sphereState,
    triggerTransition,
  };
}
