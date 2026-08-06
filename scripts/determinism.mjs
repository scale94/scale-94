// determinism.mjs — the page-side shim that makes canvas frames reproducible.
//
// Reference screenshots are only a parity gate if the same build renders the
// same pixels twice. /art is stochastic on three axes: Math.random (particle
// spawn, jitter, awakening), the wall clock (every eased/pulsing quantity), and
// the real vsync cadence (how far the sim advances between frames). This shim
// pins all three, then hands frame advancement to the driver:
//
//   Math.random      -> mulberry32, fixed seed
//   performance.now  -> virtual clock, advanced only by the pump
//   Date.now         -> the same virtual clock, offset to a fixed epoch
//   requestAnimationFrame -> queued, not scheduled; __pump(n) runs exactly n frames
//
// Installed via Page.addScriptToEvaluateOnNewDocument so it is in place before
// any module body runs — several modules read performance.now() at import time.
//
// setTimeout/setInterval are virtualised onto the same clock and fired by the
// pump. Leaving them on the real clock was tried first and is not good enough:
// the app schedules real state changes from timers (boot sequence, awakening
// phases, tooltip debounces), so a variable number of them fire during the
// driver's real-time waits and two runs diverge. Observed directly — the idle
// frame hashed 2249bef0 on one run and 566f1193 on the next.
//
// React is unaffected: its scheduler prefers MessageChannel, which is untouched.

export const DETERMINISM_SHIM = `(() => {
  const SEED = 0x9E3779B9;
  const FRAME_MS = 1000 / 60;
  const EPOCH = 1750000000000;   // fixed wall-clock origin

  let s = SEED >>> 0;

  // Re-seed on demand. Seeding once at document start is NOT enough: module
  // evaluation consumes Math.random() before any app code runs, so adding a
  // dependency shifts the whole stream and the app's own seeded state comes out
  // different. Measured — importing three/r3f/postprocessing into ArtTab moved
  // every captured hash while the 2D draw loop was byte-for-byte unchanged.
  // The driver re-seeds after the module graph has loaded and before the sphere
  // mounts, so the reference is stable across dependency changes. Without this,
  // a "parity gate" would fail on every step of a migration that adds libraries
  // — i.e. exactly when it is needed.
  window.__reseed = (seed) => { s = ((seed ?? SEED) >>> 0); };

  // Re-seeding once is still not enough once a GPU library is mounted. three.js
  // calls Math.random() for every object UUID, so the composite consumes from
  // the same global stream the simulation draws from, continuously, and the two
  // desync. Measured: with the composite mounted, every captured hash moved even
  // though the 2D draw loop was byte-for-byte unchanged.
  //
  // The app's simulation should own a private RNG rather than share the global
  // one — but that is a source change, and a parity gate must not require
  // rewriting the thing it is measuring.
  //
  // So instead: re-seed at the START of every frame. ArtTab's draw runs first
  // and advances the composite from its own tail, so within a frame the 2D
  // drawing always sees the same stream regardless of what the GL layer
  // allocates afterwards. Both sides of a comparison run under the identical
  // rule, so the 2D layer is compared honestly. It does make the sim less varied
  // frame-to-frame than in production, which is fine for a gate and wrong for a
  // screenshot you intend to admire.
  let reseedEachFrame = false;
  window.__reseedEachFrame = (on) => { reseedEachFrame = !!on; };

  Math.random = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let vnow = 0;
  const origPerf = performance.now.bind(performance);
  performance.now = () => vnow;
  Date.now = () => EPOCH + vnow;
  const OrigDate = Date;
  // new Date() with no args must follow the virtual clock too.
  window.Date = new Proxy(OrigDate, {
    construct(target, args) {
      return args.length === 0 ? new target(EPOCH + vnow) : new target(...args);
    },
  });
  window.Date.now = () => EPOCH + vnow;

  // ── Virtual timers ────────────────────────────────────────────────────────
  const timers = new Map();          // id -> { at, fn, args, interval }
  let timerId = 1;
  const origSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, delay = 0, ...args) => {
    const id = timerId++;
    timers.set(id, { at: vnow + Math.max(0, delay || 0), fn, args, interval: null });
    return id;
  };
  window.setInterval = (fn, delay = 0, ...args) => {
    const id = timerId++;
    const d = Math.max(1, delay || 1);
    timers.set(id, { at: vnow + d, fn, args, interval: d });
    return id;
  };
  window.clearTimeout = (id) => timers.delete(id);
  window.clearInterval = (id) => timers.delete(id);
  // The driver itself needs one escape hatch onto the real clock.
  window.__realSetTimeout = origSetTimeout;

  function runDueTimers() {
    // Fire in (time, id) order, and re-check after each so timers scheduled by
    // timers still land in the right frame.
    for (let guard = 0; guard < 10000; guard++) {
      let next = null;
      for (const [id, t] of timers) {
        if (t.at <= vnow && (!next || t.at < next.t.at || (t.at === next.t.at && id < next.id))) next = { id, t };
      }
      if (!next) return;
      const { id, t } = next;
      if (t.interval != null) t.at = vnow + t.interval; else timers.delete(id);
      try { t.fn(...t.args); } catch (e) { /* app owns its errors */ }
    }
  }

  let queue = [];
  let nextId = 1;
  const live = new Set();
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    live.add(id);
    queue.push({ id, cb });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    live.delete(id);
    queue = queue.filter(q => q.id !== id);
  };

  // Per-frame cost of every rAF callback, bucketed by callback function name.
  // This is the number that matters for the migration: rAF *delta* under headless
  // software GL is meaningless (it runs unthrottled), but the work done inside
  // the callback is real and directly comparable before and after.
  const costs = new Map();
  window.__frameCosts = () => Object.fromEntries([...costs].map(([k, v]) => [k, v.slice()]));
  window.__resetCosts = () => costs.clear();

  window.__pump = (n) => {
    for (let i = 0; i < n; i++) {
      vnow += FRAME_MS;
      if (reseedEachFrame) s = SEED >>> 0;
      runDueTimers();                 // timers land before the frame, as in a real tick
      const batch = queue;
      queue = [];
      for (const { id, cb } of batch) {
        if (!live.has(id)) continue;
        live.delete(id);
        const t0 = origPerf();
        try { cb(vnow); } catch (e) { /* app has its own try/catch; keep pumping */ }
        const dt = origPerf() - t0;
        const key = cb.name || 'anon';
        if (!costs.has(key)) costs.set(key, []);
        costs.get(key).push(dt);
      }
    }
    return vnow;
  };

  window.__vnow = () => vnow;
  window.__queued = () => queue.length;
  window.__deterministic = true;
})()`;
