// Pure pieces of the orbit thread's opacity behaviour (kept out of MercurySphere.jsx so they are unit-testable).
export const THREAD_PEAK = 0.7;
export const THREAD_REST = 0.35;

// Thread opacity target: peak while the element spins up, resting level otherwise; 0 once released (activeFade 0).
export function threadTargetOpacity(activeFade, transitionState) {
  return activeFade * THREAD_PEAK * (transitionState === 'spinUp' ? 1 : THREAD_REST);
}
// Frame-rate independent ease toward the target (time constant 0.25 s).
export function easeThread(o, target, delta) {
  return o + (target - o) * (1 - Math.exp(-delta / 0.25));
}
// The thread keeps pointing at the last lit phase while it eases out after the element is released.
export function threadPhase(litPhase, lastLit) {
  return litPhase ?? lastLit;
}
export const THREAD_VISIBLE_MIN = 0.005;
