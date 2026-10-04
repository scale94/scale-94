// SlowNoonDial.jsx — THE SLOW NOON: one day at Caloris as a resonance rosette (spec 2026-10-03).
// Angle = Caloris local time (noon top, dawn left); radius = distance to the Sun. The 3:2 spin-orbit
// resonance closes the trace into two lobes with two perihelion pinches; a x22 loupe shows the real
// retrograde loop. Hover (or tap on touch) draws the matching hairlines on the planet.

import { useEffect, useMemo, useState } from 'react';
import {
  slowNoonState, rosettePath, loupePath, formatReadouts, TRAIL_DAYS, DAY_MS, SLOW_NOON_REFRESH_MS,
} from './planet/slowNoon';
import { DEV_OVERRIDES } from './mercuryTuning';
import { useOverlayReveal } from './useOverlayReveal';
import { DIAL, LOUPE, ringXY, dialXY, loupeXY } from './slowNoonDialGeometry';

const INK = { day: '#1c1a14', night: '#0a0c16', ring: '#3a3f4a', tick: '#8a8f9a', label: '#9aa0ad',
  path: '#5b6170', trail: '#cfd5e0', gold: '#e8c27a', hand: '#ffffff', loupeBg: '#07080d' };
const HAND_DIM = 0.35;

// Polyline through points; null breaks the line.
function pathD(points) {
  let d = '', pen = false;
  for (const p of points) {
    if (!p) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
    pen = true;
  }
  return d;
}

const halfDisc = (from, to) => {
  const [x0, y0] = ringXY(from, DIAL.ring), [x1, y1] = ringXY(to, DIAL.ring);
  return `M${x0} ${y0} A${DIAL.ring} ${DIAL.ring} 0 0 1 ${x1} ${y1} Z`;
};

const readNow = () => DEV_OVERRIDES.dateMs ?? Date.now();

export default function SlowNoonDial({ onOverlay }) {
  const [nowMs, setNowMs] = useState(readNow);
  useEffect(() => {
    const id = setInterval(() => setNowMs(readNow()), SLOW_NOON_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const dayKey = Math.floor(nowMs / DAY_MS);
  const path = useMemo(() => rosettePath(dayKey * DAY_MS), [dayKey]);
  const { state, loupe } = useMemo(() => {
    const s = slowNoonState(nowMs);
    return { state: s, loupe: s.retro ? loupePath(s.retro) : null };
  }, [nowMs]);
  const reveal = useOverlayReveal(onOverlay);
  const lines = formatReadouts(state);

  const here = { t: nowMs, hour: state.hour, rAU: state.rAU };
  const trail = [...path.filter((p) => p.t >= nowMs - TRAIL_DAYS * DAY_MS && p.t < nowMs), here];
  const peris = path.filter((p, i) => i > 0 && i < path.length - 1 && p.rAU < path[i - 1].rAU && p.rAU <= path[i + 1].rAU);
  const [hx, hy] = dialXY(state.hour, state.rAU);

  let loupeD = '';
  if (loupe) {
    const peri = loupe.reduce((a, b) => (b.rAU < a.rAU ? b : a));
    loupeD = pathD(loupe.map((p) => {
      const xy = loupeXY(p, peri);
      return Math.hypot(xy[0] - LOUPE.x, xy[1] - LOUPE.y) < LOUPE.r - 1 ? xy : null;
    }));
  }

  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const major = i % 6 === 0;
    const [x1, y1] = ringXY(i, DIAL.ring), [x2, y2] = ringXY(i, DIAL.ring - (major ? 10 : 4));
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK.tick} strokeWidth={major ? 1.2 : 0.6} />);
  }
  const label = (hour, text) => {
    const [x, y] = ringXY(hour, DIAL.label);
    return <text key={text} x={x} y={y} fill={INK.label} fontSize="8" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle" letterSpacing="1.5">{text}</text>;
  };

  return (
    <div
      className="border border-zinc-600/[0.05] rounded-lg bg-black/30 p-3 select-none"
      role="group"
      aria-label={`The Slow Noon. ${lines.join('. ')}`}
      style={{ touchAction: 'manipulation' }}
      {...reveal}
    >
      <div className="text-[10px] font-mono text-zinc-400/80 uppercase tracking-[0.2em] mb-1">◉ THE SLOW NOON</div>
      <div className="text-[8px] font-mono text-zinc-600 mb-2">{'// one day at Caloris · 176 Earth days · radius = distance to the Sun'}</div>
      <svg viewBox="0 0 300 300" className="w-full h-auto" aria-hidden="true">
        <path d={halfDisc(6, 18)} fill={INK.day} />
        <path d={halfDisc(18, 6)} fill={INK.night} />
        <circle cx={DIAL.c} cy={DIAL.c} r={DIAL.ring} fill="none" stroke={INK.ring} />
        {ticks}
        {label(12, 'NOON')}{label(6, 'DAWN')}{label(18, 'DUSK')}{label(0, 'MIDNIGHT')}
        <path d={pathD(path.map((p) => dialXY(p.hour, p.rAU)))} fill="none" stroke={INK.path} strokeWidth="0.8" />
        {peris.map((p) => {
          const [x, y] = dialXY(p.hour, p.rAU);
          return <circle key={p.t} data-slow-noon-peri="" cx={x} cy={y} r="9" fill="none" stroke={INK.gold} strokeWidth="0.7" strokeDasharray="2 2" />;
        })}
        <g data-slow-noon-hand="" opacity={state.calorisFacing ? 1 : HAND_DIM}>
          <path d={pathD(trail.map((p) => dialXY(p.hour, p.rAU)))} fill="none" stroke={INK.trail} strokeWidth="1.4" />
          <circle cx={hx} cy={hy} r="3.2" fill={INK.hand} />
        </g>
        {loupe && (
          <g data-slow-noon-loupe="">
            <circle cx={LOUPE.x} cy={LOUPE.y} r={LOUPE.r} fill={INK.loupeBg} stroke={INK.gold} strokeWidth="0.7" />
            <path d={loupeD} fill="none" stroke={INK.gold} strokeWidth="1" />
            <text x="296" y="298" fill={INK.gold} fontSize="7" fontFamily="monospace" textAnchor="end">×22 · THE SUN STANDS, TURNS BACK</text>
          </g>
        )}
      </svg>
      <div className="mt-2 space-y-0.5 text-[9px] font-mono text-zinc-400 uppercase tracking-[0.12em]">
        {lines.map((l) => <div key={l}>{l}</div>)}
      </div>
    </div>
  );
}
