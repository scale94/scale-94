// MercuryPerfHud.jsx — dev-only perf HUD for /MERCURY (phase-4 spec §4), mounted with ?perf=1.
// Samples frame delta inside useFrame into a ring buffer (no React state per frame) and
// writes a fixed DOM overlay at 4 Hz. The author reads or screenshots it on their phone.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createPerfStats, pushFrame, summarize, PERF_INFO } from './planet/perfStats';

const fmt = (r) => (r.n ? `${r.p50.toFixed(1)} / ${r.p95.toFixed(1)} / ${r.max.toFixed(1)} ms  (${r.fps.toFixed(0)} fps, n=${r.n})` : '—');

export default function MercuryPerfHud({ tier, calm }) {
  const gl = useThree((s) => s.gl);
  const stats = useMemo(() => createPerfStats(), []);
  const lastT = useRef(0);

  useFrame(({ clock }, delta) => {
    lastT.current = clock.elapsedTime;
    pushFrame(stats, clock.elapsedTime, delta, PERF_INFO.tau > 0);
  });

  useEffect(() => {
    const el = document.createElement('pre');
    Object.assign(el.style, {
      position: 'fixed', left: '8px', bottom: '8px', zIndex: 2147483647, margin: 0, padding: '6px 8px',
      font: '11px/1.35 ui-monospace, monospace', color: '#cfe', background: 'rgba(0,0,0,0.72)',
      pointerEvents: 'none', whiteSpace: 'pre',
    });
    el.dataset.mercuryPerfHud = '1';
    document.body.appendChild(el);
    const id = setInterval(() => {
      const now = lastT.current;
      const c = gl.domElement;
      el.textContent = [
        `tier ${tier}${calm ? ' +CALM' : ''}  dpr ${gl.getPixelRatio().toFixed(2)}  ${c.width}×${c.height}px`,
        `all     p50/p95/max ${fmt(summarize(stats, now))}`,
        `still   p50/p95/max ${fmt(summarize(stats, now, { liquid: false }))}`,
        `liquid  p50/p95/max ${fmt(summarize(stats, now, { liquid: true }))}`,
        `τ ${PERF_INFO.tau.toFixed(2)}  heat ${PERF_INFO.heatK.toFixed(1)} K  boil ${(PERF_INFO.coverage * 100).toFixed(0)}%`,
        `tail B ${PERF_INFO.tailB.toFixed(2)}  v_r ${PERF_INFO.vrKmS.toFixed(1)} km/s`,
      ].join('\n');
    }, 250);
    return () => { clearInterval(id); el.remove(); };
  }, [gl, stats, tier, calm]);

  return null;
}
