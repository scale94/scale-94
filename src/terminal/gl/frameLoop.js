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
  // 0 is overloaded here: it means "not yet seeded" (falsy, take the dt=0
  // branch below) as well as a literal zero timestamp. performance.now()
  // returning exactly 0 is not realistically possible, so the conflation
  // is not a live bug, but the intent is: falsy last === unseeded.
  let last = 0;
  let hidden = typeof document !== 'undefined' ? document.hidden : false;

  function onVisibility() {
    hidden = document.hidden;
    if (!hidden) last = seedLast === 'zero' ? 0 : now();
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
    // seedLast 'now' seeds `last` at start(), so the first frame takes the
    // Math.min branch. seedLast 'zero' leaves it 0, so the first dt is 0.
    const dt = last ? Math.min((t - last) / 1000, dtClamp) : 0;
    last = t;
    onFrame(t, dt, { hidden });
  }

  return {
    start() {
      if (running) return;
      if (reducedMotion && haltOnReducedMotion) return;
      running = true;
      last = seedLast === 'zero' ? 0 : now();
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
