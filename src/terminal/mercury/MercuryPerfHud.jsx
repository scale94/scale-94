// MercuryPerfHud.jsx — dev-only perf HUD for /MERCURY (phase-4 spec §4), mounted with ?perf=1|2.
// Samples frame delta inside useFrame into a ring buffer (no React state per frame) and
// writes a fixed DOM overlay at 4 Hz (?perf=2: once per 2 s, to compare hitch rates with the
// HUD's own DOM write mostly removed). The author reads or screenshots it on their phone.
//
// Diagnostics for "where does the phone's frame time go" (all preallocated, HUD-mounted only):
//   js        frame start (first useFrame) -> end of gl.render submit, via a wrapped gl.render
//   ptr/lay   pointermove count per frame; with &layout=1 also a getBoundingClientRect() timed in
//             a capture-phase listener (forces layout if dirty, so its duration is the forced-layout
//             cost - but the probe itself then pays a layout per move, so it is opt-in)
//   hud       share of long frames (>33 ms) that directly follow a HUD textContent write
//   longtask  PerformanceObserver 'longtask' count + total ms
//   gpu       with &gpu=1: EXT_disjoint_timer_query_webgl2 around gl.render, read back
//             asynchronously (opt-in: query polling may itself cost frame time on mobile drivers)

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  createPerfStats, pushFrame, summarize, PERF_INFO,
  createExtraStats, pushExtra, summarizeExtra, createEventLog, pushEvent, summarizeEvents, LONG_FRAME_MS,
} from './planet/perfStats';
import { perfHudMode } from './planet/planetQuality';
import { HYPER_OMEGA_FRAC, V_HYPER } from './planet/hyperFling';
import { MAX_OMEGA } from './planet/mercuryBody';

const fmt = (r) => (r.n ? `${r.p50.toFixed(1)} / ${r.p95.toFixed(1)} / ${r.max.toFixed(1)} ms  (${r.fps.toFixed(0)} fps, n=${r.n})` : '—');
const nowS = () => performance.now() / 1000;
const GPU_POOL = 6;
const flag = (k) => { try { return new URLSearchParams(window.location.search).get(k) === '1'; } catch { return false; } };

export default function MercuryPerfHud({ tier, calm }) {
  const gl = useThree((s) => s.gl);
  const stats = useMemo(() => createPerfStats(), []);
  const extra = useMemo(() => createExtraStats(), []);
  const longTasks = useMemo(() => createEventLog(256), []);
  const gpuLog = useMemo(() => createEventLog(1024), []);
  const lastT = useRef(0);
  // mutable per-frame scratch; one object, mutated in place
  const f = useRef({ armed: false, t0: 0, dt: 0, ptr: 0, lay: 0, hudPending: false, hudAdj: false, gpuState: 'n/a' }).current;

  useFrame(({ clock }, delta) => {
    lastT.current = clock.elapsedTime;
    pushFrame(stats, clock.elapsedTime, delta, PERF_INFO.tau > 0);
  });

  // Runs before every other useFrame; negative priority keeps r3f auto-rendering.
  useFrame((_, delta) => {
    f.t0 = performance.now();
    f.dt = delta;
    f.hudAdj = f.hudPending;
    f.hudPending = false;
    f.armed = true;
  }, -1e9);

  // Wrap gl.render: jsMs = end of submit - t0; optional GPU timer query around it.
  useEffect(() => {
    const had = Object.prototype.hasOwnProperty.call(gl, 'render');
    const orig = gl.render;
    const ctx = gl.getContext();
    const ext = flag('gpu') && ctx && typeof ctx.createQuery === 'function' ? ctx.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    const pool = [];
    const pend = new Array(GPU_POOL).fill(null);   // FIFO of in-flight queries
    let pHead = 0, pLen = 0;
    if (ext) { for (let i = 0; i < GPU_POOL; i++) pool.push(ctx.createQuery()); f.gpuState = 'wait'; } else f.gpuState = 'n/a';
    let inQuery = false;

    const drain = () => {
      while (pLen > 0) {
        const q = pend[pHead];
        if (!ctx.getQueryParameter(q, ctx.QUERY_RESULT_AVAILABLE)) break;
        const bad = ctx.getParameter(ext.GPU_DISJOINT_EXT);
        if (!bad) { pushEvent(gpuLog, nowS(), ctx.getQueryParameter(q, ctx.QUERY_RESULT) / 1e6); f.gpuState = 'ok'; }
        pool.push(q);
        pend[pHead] = null; pHead = (pHead + 1) % GPU_POOL; pLen--;
      }
    };

    gl.render = function perfRender(...args) {
      let q = null;
      if (ext && !inQuery) {
        drain();
        q = pool.pop() || null;
        if (q) { ctx.beginQuery(ext.TIME_ELAPSED_EXT, q); inQuery = true; }
      }
      const r = orig.apply(this, args);
      if (q) {
        ctx.endQuery(ext.TIME_ELAPSED_EXT); inQuery = false;
        pend[(pHead + pLen) % GPU_POOL] = q; pLen++;
      }
      if (f.armed) {
        f.armed = false;
        pushExtra(extra, nowS(), f.dt, performance.now() - f.t0, f.ptr, f.lay, f.hudAdj);
        f.ptr = 0; f.lay = 0;
      }
      return r;
    };
    return () => {
      if (had) gl.render = orig; else delete gl.render;
      if (ext) {
        for (const q of pool) ctx.deleteQuery(q);
        for (let i = 0; i < pLen; i++) ctx.deleteQuery(pend[(pHead + i) % GPU_POOL]);
      }
    };
  }, [gl, extra, gpuLog, f]);

  // pointermove: count + timed getBoundingClientRect (forced-layout proxy)
  useEffect(() => {
    const c = gl.domElement;
    const timeLayout = flag('layout');
    const onMove = () => {
      f.ptr++;
      if (!timeLayout) return;
      const a = performance.now();
      c.getBoundingClientRect();
      f.lay += performance.now() - a;
    };
    c.addEventListener('pointermove', onMove, { capture: true, passive: true });
    return () => c.removeEventListener('pointermove', onMove, { capture: true });
  }, [gl, f]);

  // long tasks
  const hasLongTask = typeof PerformanceObserver !== 'undefined'
    && (PerformanceObserver.supportedEntryTypes || []).includes('longtask');
  useEffect(() => {
    if (!hasLongTask) return undefined;
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) pushEvent(longTasks, (e.startTime + e.duration) / 1000, e.duration);
    });
    po.observe({ type: 'longtask' });
    return () => po.disconnect();
  }, [hasLongTask, longTasks]);

  useEffect(() => {
    const mode = perfHudMode(typeof window !== 'undefined' ? window.location.search : '');
    const el = document.createElement('pre');
    Object.assign(el.style, {
      position: 'fixed', left: '8px', bottom: '8px', zIndex: 2147483647, margin: 0, padding: '6px 8px',
      font: '11px/1.35 ui-monospace, monospace', color: '#cfe', background: 'rgba(0,0,0,0.72)',
      pointerEvents: 'none', whiteSpace: 'pre',
    });
    el.dataset.mercuryPerfHud = '1';
    document.body.appendChild(el);
    let lastWrite = -Infinity;
    const id = setInterval(() => {
      const t = performance.now();
      if (mode === 2 && t - lastWrite < 2000) return;
      lastWrite = t;
      const now = lastT.current;
      const w = nowS();
      const c = gl.domElement;
      const x = summarizeExtra(extra, w);
      const lt = summarizeEvents(longTasks, w);
      const g = summarizeEvents(gpuLog, w);
      el.textContent = [
        `tier ${tier}${calm ? ' +CALM' : ''}  dpr ${gl.getPixelRatio().toFixed(2)}  ${c.width}×${c.height}px${mode === 2 ? '  [hud 0.5 Hz]' : ''}`,
        `all     p50/p95/max ${fmt(summarize(stats, now))}`,
        `still   p50/p95/max ${fmt(summarize(stats, now, { liquid: false }))}`,
        `liquid  p50/p95/max ${fmt(summarize(stats, now, { liquid: true }))}`,
        `js      p50/p95/max ${x.n ? `${x.js.p50.toFixed(1)} / ${x.js.p95.toFixed(1)} / ${x.js.max.toFixed(1)} ms` : '—'}`,
        `ptr/frame avg ${x.ptrAvg.toFixed(2)}${flag('layout') ? ` | forced-layout ms p95 ${x.layP95.toFixed(2)} max ${x.layMax.toFixed(2)} (n=${x.layN})` : ' | layout off (&layout=1)'}`,
        `hud-adj long(>${LONG_FRAME_MS}ms) ${x.longHud}/${x.long} = ${(x.hudShareOfLong * 100).toFixed(0)}%  vs base ${(x.hudBaseRate * 100).toFixed(1)}%`,
        hasLongTask ? `longtask n=${lt.n} total ${lt.total.toFixed(0)} ms` : 'longtask n/a',
        f.gpuState === 'n/a' ? (flag('gpu') ? 'gpu n/a' : 'gpu off (&gpu=1)') : (g.n ? `gpu     p50/p95/max ${g.p50.toFixed(1)} / ${g.p95.toFixed(1)} / ${g.max.toFixed(1)} ms (n=${g.n})` : 'gpu     —'),
        `τ ${PERF_INFO.tau.toFixed(2)}  heat ${PERF_INFO.heatK.toFixed(1)} K  boil ${(PERF_INFO.coverage * 100).toFixed(0)}%`,
        `tail B ${PERF_INFO.tailB.toFixed(2)}  v_r ${PERF_INFO.vrKmS.toFixed(1)} km/s`,
        `drops ${PERF_INFO.dropPrims} prims  ${(PERF_INFO.dropAreaPx / 1000).toFixed(0)}k px²  Σ ${PERF_INFO.sigma.toFixed(2)}`,
        // Gate 0: the last release against the hyper gate (spin ≥ HYPER_OMEGA_FRAC·MAX_OMEGA, pointer ≥ V_HYPER)
        PERF_INFO.relN ? `release #${PERF_INFO.relN}  spin ${PERF_INFO.relSpin.toFixed(2)}/${(HYPER_OMEGA_FRAC * MAX_OMEGA).toFixed(2)}  ptr ${PERF_INFO.relPtr.toFixed(1)}/${V_HYPER}  ${PERF_INFO.relHyper ? 'HYPER' : `no hyper (${PERF_INFO.relBlocked})${PERF_INFO.relFired ? ` → ${PERF_INFO.relFired}` : ''}`}` : 'release —',
      ].join('\n');
      f.hudPending = true;
    }, 250);
    return () => { clearInterval(id); el.remove(); };
  }, [gl, stats, extra, longTasks, gpuLog, f, hasLongTask, tier, calm]);

  return null;
}
