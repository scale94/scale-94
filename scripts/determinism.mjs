// determinism.mjs — the page-side shim that makes canvas frames reproducible.
//
// Reference screenshots are only a parity gate if the same build renders the
// same pixels twice. /art is stochastic on three axes: Math.random (particle
// spawn, jitter, awakening), the wall clock (every eased/pulsing quantity), and
// the real vsync cadence (how far the sim advances between frames). This shim
// pins all three and hands frame advancement to the driver.
//
// ── Two phases, and why ─────────────────────────────────────────────────────
//
// The shim installs in PASSTHROUGH mode and does nothing until the driver calls
// __virtualize(). That is not a convenience; virtualising from page load breaks
// React.
//
// React's scheduler decides when to yield by comparing performance.now() against
// a deadline. With a frozen clock that comparison stops behaving, and a
// concurrent render can simply never commit. Measured: r3f's <Canvas> called
// configure() and created a live WebGL context, but root.render(children) never
// committed — no onCreated, no children mounted, no useFrame, so the GL layer
// stayed blank for the entire capture while looking like it had rendered. The
// harness was silently blind to exactly the layer the migration is moving work
// into.
//
// So: let the app boot and mount under real timing, then take control. Only the
// captured window needs to be deterministic, and it is.
//
// ── What is pinned, once virtualised ────────────────────────────────────────
//
//   Math.random      -> mulberry32, re-seeded at the switch and each frame
//   performance.now  -> virtual clock, advanced only by the pump
//   Date.now         -> the same clock, offset to a fixed epoch
//   setTimeout etc.  -> virtual, fired by the pump
//   requestAnimationFrame -> queued, not scheduled; __pump(n) runs exactly n
//
// Installed via Page.addScriptToEvaluateOnNewDocument so the overrides are in
// place before any module body runs, even though they stay inert until asked.

export const DETERMINISM_SHIM = `(() => {
  const SEED = 0x9E3779B9;
  const FRAME_MS = 1000 / 60;
  const EPOCH = 1750000000000;   // fixed wall-clock origin

  // Absolute virtual time the clock snaps to at the switch. Fixed, so runs
  // agree; large, so anything that stored a real boot-time timestamp reads as
  // long finished rather than as a negative elapsed time.
  const VIRTUAL_START = 100000;

  let virtual = false;

  // ── RNG ───────────────────────────────────────────────────────────────────
  let s = SEED >>> 0;
  const seeded = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const realRandom = Math.random.bind(Math);
  Math.random = function () { return virtual ? seeded() : realRandom(); };
  window.__reseed = (seed) => { s = ((seed ?? SEED) >>> 0); };

  // Re-seeding once is not enough with a GPU library mounted: three.js calls
  // Math.random() for every object UUID, continuously, from the same global
  // stream the simulation draws from, and the two desync. Re-seeding at the
  // START of each frame makes the 2D layer immune to whatever GL allocates
  // afterwards, because ArtTab draws first and advances the composite from its
  // own tail. The app should own a private RNG, but a parity gate must not
  // require rewriting the thing it measures.
  let reseedEachFrame = false;
  window.__reseedEachFrame = (on) => { reseedEachFrame = !!on; };

  // ── Clocks ────────────────────────────────────────────────────────────────
  const realPerfNow = performance.now.bind(performance);
  const OrigDate = Date;
  const realDateNow = OrigDate.now.bind(OrigDate);

  let vnow = 0;
  performance.now = () => (virtual ? vnow : realPerfNow());
  const nowMs = () => (virtual ? EPOCH + vnow : realDateNow());

  window.Date = new Proxy(OrigDate, {
    construct(target, args) {
      return args.length === 0 ? new target(nowMs()) : new target(...args);
    },
  });
  window.Date.now = nowMs;

  // ── Virtual timers ────────────────────────────────────────────────────────
  const realSetTimeout   = window.setTimeout.bind(window);
  const realSetInterval  = window.setInterval.bind(window);
  const realClearTimeout = window.clearTimeout.bind(window);
  const realClearInterval= window.clearInterval.bind(window);

  const timers = new Map();      // id -> { at, fn, args, interval }
  let timerId = 1;

  window.setTimeout = (fn, delay = 0, ...args) => {
    if (!virtual) return realSetTimeout(fn, delay, ...args);
    const id = timerId++;
    timers.set(id, { at: vnow + Math.max(0, delay || 0), fn, args, interval: null });
    return id;
  };
  window.setInterval = (fn, delay = 0, ...args) => {
    if (!virtual) return realSetInterval(fn, delay, ...args);
    const id = timerId++;
    const d = Math.max(1, delay || 1);
    timers.set(id, { at: vnow + d, fn, args, interval: d });
    return id;
  };
  window.clearTimeout  = (id) => { if (timers.delete(id)) return; realClearTimeout(id); };
  window.clearInterval = (id) => { if (timers.delete(id)) return; realClearInterval(id); };
  window.__realSetTimeout = realSetTimeout;

  function runDueTimers() {
    // Fire in (time, id) order, re-checking after each so timers scheduled by
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

  // ── Frames ────────────────────────────────────────────────────────────────
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCaf = window.cancelAnimationFrame.bind(window);

  let queue = [];
  let nextId = 1;
  const live = new Set();

  // In passthrough the callback still goes through a wrapper, so that a loop
  // already scheduled with the real rAF when __virtualize() is called MIGRATES
  // into the virtual queue instead of being lost. Without this the queue is
  // empty at the switch and the first pump batch does nothing: every rAF loop on
  // the page is mid-flight with the browser, not with us.
  window.requestAnimationFrame = (cb) => {
    if (!virtual) {
      const id = nextId++;
      live.add(id);
      realRaf((t) => {
        if (!live.has(id)) return;
        live.delete(id);
        if (virtual) { queue.push({ id: nextId++, cb }); live.add(nextId - 1); }
        else cb(t);
      });
      return id;
    }
    const id = nextId++;
    live.add(id);
    queue.push({ id, cb });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    if (!virtual) return realCaf(id);
    live.delete(id);
    queue = queue.filter(q => q.id !== id);
  };

  // Per-frame cost of every rAF callback, bucketed by callback function name.
  // rAF *interval* under headless software GL is meaningless (it runs
  // unthrottled), but the work inside the callback is real and comparable.
  const costs = new Map();
  window.__frameCosts = () => Object.fromEntries([...costs].map(([k, v]) => [k, v.slice()]));
  window.__resetCosts = () => costs.clear();

  window.__pump = (n) => {
    if (!virtual) throw new Error('__pump called before __virtualize');
    for (let i = 0; i < n; i++) {
      vnow += FRAME_MS;
      if (reseedEachFrame) s = SEED >>> 0;
      runDueTimers();               // timers land before the frame, as in a real tick
      const batch = queue;
      queue = [];
      for (const { id, cb } of batch) {
        if (!live.has(id)) continue;
        live.delete(id);
        const t0 = realPerfNow();
        try { cb(vnow); } catch (e) { /* app has its own try/catch; keep pumping */ }
        const dt = realPerfNow() - t0;
        const key = cb.name || 'anon';
        if (!costs.has(key)) costs.set(key, []);
        costs.get(key).push(dt);
      }
    }
    return vnow;
  };

  // Take control. Everything before this point ran on the real browser, which
  // is what lets React and r3f mount at all.
  window.__virtualize = ({ seed, reseedEachFrame: rpf = true } = {}) => {
    if (virtual) return vnow;
    vnow = VIRTUAL_START;
    s = ((seed ?? SEED) >>> 0);
    reseedEachFrame = !!rpf;
    virtual = true;
    return vnow;
  };

  window.__isVirtual = () => virtual;
  window.__vnow = () => vnow;
  window.__queued = () => queue.length;
  window.__deterministic = true;
})()`;
