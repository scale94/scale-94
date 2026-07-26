// frameLoop.js — the shared animation loop for the terminal's shaders.
//
// Owns: rAF scheduling, the watchdog, dt policy, reduced-motion policy and
// optional visibility tracking. Owns no GL and no React.
//
// HARD CONSTRAINT: the next frame is scheduled at the TOP of the frame, before
// onFrame runs. LunarShaderMoon's idle throttle early-returns before drawing;
// scheduling at the bottom would starve the loop the first time it fired, and
// the GL call-log snapshots cannot catch that because rAF is not a GL call.

export function createFrameLoop({
  onFrame,
  dtClamp = 0.05,
  seedLast = 'now',
  watchdogMs = null,
  trackVisibility = false,
  haltOnReducedMotion = false,
  reducedMotion = false,
  now = () => performance.now(),
  raf = (cb) => requestAnimationFrame(cb),
  caf = (id) => cancelAnimationFrame(id),
}) {
  let rafId = 0;
  let wdId = 0;
  let running = false;
  // `last` used to double as its own "seeded?" flag via truthiness, which
  // silently broke under fake timers where performance.now() is exactly 0
  // at mount: a seedLast:'now' loop would read last=0, treat it as falsy
  // ("unseeded"), and report dt=0 on its first real tick instead of the
  // correct ~1 frame. `seeded` tracks that state explicitly so a literal
  // zero timestamp is never confused with "not yet seeded".
  let last = 0;
  let seeded = false;
  let hidden = typeof document !== 'undefined' ? document.hidden : false;

  function onVisibility() {
    hidden = document.hidden;
    if (!hidden) {
      if (seedLast === 'zero') {
        // Reseed to the unseeded state so the next frame's dt is 0 again —
        // the moon must not be billed for time spent hidden.
        last = 0;
        seeded = false;
      } else {
        last = now();
        seeded = true;
      }
    }
  }

  function schedule() {
    rafId = raf(frame);
    if (watchdogMs != null) {
      wdId = setTimeout(() => { caf(rafId); frame(now()); }, watchdogMs);
    }
  }

  function frame(t) {
    if (watchdogMs != null) clearTimeout(wdId);
    if (!running) return;
    schedule();                                  // top-scheduling — see header
    // seedLast 'now' marks `seeded` true at start(), so the first frame takes
    // the Math.min branch even if `last` happens to be 0. seedLast 'zero'
    // leaves `seeded` false, so the first dt is 0 regardless of `last`.
    const dt = seeded ? Math.min((t - last) / 1000, dtClamp) : 0;
    last = t;
    seeded = true;
    onFrame(t, dt, { hidden });
  }

  return {
    start() {
      if (running) return;
      if (reducedMotion && haltOnReducedMotion) return;
      running = true;
      if (seedLast === 'zero') {
        last = 0;
        seeded = false;
      } else {
        last = now();
        seeded = true;
      }
      if (trackVisibility) document.addEventListener('visibilitychange', onVisibility);
      schedule();
    },
    stop() {
      if (!running) return;
      running = false;
      caf(rafId);
      if (watchdogMs != null) clearTimeout(wdId);
      if (trackVisibility) document.removeEventListener('visibilitychange', onVisibility);
    },
    isRunning() { return running; },
  };
}
