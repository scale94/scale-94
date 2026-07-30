// colliderPhases.js — timing curves for the collision chamber.
//
// This module owns durations, NOT the state graph. Six of the seven phase
// transitions are event-driven (a domain is selected, collide() resolves, the
// user resets); only colliding -> result is a clock, and even that fires from
// a timer in the component, never from the render loop. See spec section 6.
//
// Every constant below is an old frame threshold converted at 60fps. The
// chamber used to count frames -- `const t = timerRef.current++` -- so on a
// 120Hz display the entire collision played at double speed. Same authored
// shape, real clock.

export const ACCELERATE_MS = 1800; // was progress = t / 108
export const COLLIDE_MS    = 2500; // was t > 150 -> result

const FLASH_MS   = 250;  // t < 15
const SHAKE_MS   = 333;  // t < 20
const RING1_MS   = 583;  // t < 35
const RING2_AT   = 83;   // t > 5
const RING2_MS   = 500;  // over 30 frames
const SPARK_MS   = 667;  // t < 40
const JET_MS     = 417;  // t < 25
const CHIMERA_IN = 500;  // t > 30
const CHIMERA_OUT= 2000; // t < 120
const VAPOR_IN   = 1000; // t > 60
const VAPOR_OUT  = 2333; // t < 140
const ARM_AT     = 1333; // t > 80 -- beams and metrics
const METRICS_MS = 500;  // fadeIn over 30 frames

export const PHASE_ID = { idle: 0, selecting: 1, accelerating: 2, colliding: 3, result: 4 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const gate = (ms, lo, hi) => (ms >= lo && ms < hi ? 1 : 0);
// Rising 0..1 over `dur` from `from`, or -1 once past it. -1 is the inactive
// sentinel so these stay plain floats on the way to a uniform.
const window01 = (ms, from, dur) => (ms < from || ms >= from + dur ? -1 : (ms - from) / dur);

const INERT = {
  progress: 0, ease: 0, shake: 0, ring1: -1, ring2: -1, flash: 0,
  sparkGate: 0, jetGate: 0, chimeraGate: 0, vaporGate: 0,
  beamT: -1, metrics: 0, done: 0,
};

export function phaseTiming(phase, elapsedMs) {
  const ms = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;

  if (phase === 'accelerating') {
    const progress = clamp01(ms / ACCELERATE_MS);
    return { ...INERT, progress, ease: progress * progress * progress };
  }

  if (phase === 'colliding') {
    return {
      progress: clamp01(ms / COLLIDE_MS),
      ease: 0,
      shake: clamp01(1 - ms / SHAKE_MS),
      ring1: window01(ms, 0, RING1_MS),
      ring2: window01(ms, RING2_AT, RING2_MS),
      flash: clamp01(1 - ms / FLASH_MS),
      sparkGate: gate(ms, 0, SPARK_MS),
      jetGate: gate(ms, 0, JET_MS),
      chimeraGate: gate(ms, CHIMERA_IN, CHIMERA_OUT),
      vaporGate: gate(ms, VAPOR_IN, VAPOR_OUT),
      beamT: ms < ARM_AT ? -1 : (ms - ARM_AT) / 1000, // seconds, for the shader
      metrics: ms < ARM_AT ? 0 : clamp01((ms - ARM_AT) / METRICS_MS),
      done: ms >= COLLIDE_MS ? 1 : 0,
    };
  }

  return { ...INERT };
}
