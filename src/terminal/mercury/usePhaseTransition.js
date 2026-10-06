import { useRef, useReducer, useCallback, useEffect } from 'react';
import { ELEMENTS, createMachine, request, advance, holdLiquid, activeElement } from './transitionMachine';

export const PHASES = ELEMENTS;

// Thin rAF driver for transitionMachine: re-renders once per animated frame while a transition runs, never at rest.
export default function usePhaseTransition() {
  const machine = useRef(null);
  if (machine.current === null) machine.current = createMachine();
  const lastRef = useRef(0);
  const rafRef = useRef(null);
  const [, forceRender] = useReducer((n) => n + 1, 0);

  const stop = useCallback(() => {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const frame = useCallback(() => {
    const now = performance.now();
    advance(machine.current, now - lastRef.current); // a hidden tab's huge gap resolves the whole sequence here
    lastRef.current = now;
    rafRef.current = machine.current.beat === 'idle' ? null : requestAnimationFrame(frame);
    forceRender();
  }, []);

  const triggerTransition = useCallback((element) => {
    request(machine.current, element);
    if (rafRef.current == null && machine.current.beat !== 'idle') {
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(frame);
    }
    forceRender();
  }, [frame]);

  useEffect(() => stop, [stop]);

  const m = machine.current;
  return {
    activePhase: activeElement(m),
    fades: { ...m.fade },
    transitionState: m.beat,
    holdLiquid: holdLiquid(m),
    triggerTransition,
  };
}
