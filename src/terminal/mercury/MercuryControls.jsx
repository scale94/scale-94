import { useEffect, useRef } from 'react';
import { snapSlider } from './sliderMath';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

// A phone drag (fix/mercury-motion): the hit area is 36 px tall with touch-action none, so the browser never takes the
// finger for a page pan (which cancelled the pointer mid-drag); the drag ends on up / cancel / a lost capture; and the
// value is snapped to step and sent at most once per animation frame, only when it moves (every pointer move used to
// re-render the whole stage).
function Slider({ label, value, min, max, step, onChange }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);
  const raf = useRef(0);
  const pending = useRef(value);
  const sent = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; sent.current = value; }, [onChange, value]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const flush = () => {
    raf.current = 0;
    if (pending.current === sent.current) return;
    sent.current = pending.current;
    onChangeRef.current(pending.current);
  };
  const update = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = snapSlider(min + (max - min) * t, min, max, step);
    pending.current = v;
    if (v === sent.current) return;
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  };
  const start = (e) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    update(e);
  };
  const move = (e) => { if (dragging.current) update(e); };
  const end = () => { dragging.current = false; };

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const knob = isMobile ? 16 : 8;
  return (
    <div className="mb-1">
      <div className="flex justify-between">
        <span className="text-[10px] font-mono text-cyan-400/60 tracking-widest uppercase">{label}</span>
        <span className="text-[10px] font-mono text-cyan-400/40">{typeof value === 'number' ? value.toFixed(2) : value}</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-9 flex items-center cursor-pointer"
        style={{ touchAction: 'none' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      >
        <div className="relative w-full h-1 bg-cyan-900/30 rounded">
          <div className="absolute left-0 top-0 h-full bg-cyan-500/60 rounded" style={{ width: `${pct}%` }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full bg-cyan-400"
            style={{ width: knob, height: knob, left: `calc(${pct}% - ${knob / 2}px)` }}
          />
        </div>
      </div>
    </div>
  );
}

const PHASE_PARAMS = {
  fluid: [
    { key: 'curlAmp',    label: 'curl amp',   min: 0,   max: 0.1,  step: 0.001 },
    { key: 'tubeRadius', label: 'tube radius', min: 0.1, max: 0.8,  step: 0.01  },
    { key: 'chromatic',  label: 'chromatic',   min: 0,   max: 1,    step: 0.01  },
  ],
  thermal: [
    { key: 'flameWidth', label: 'flame width', min: 0.2, max: 2.0, step: 0.05 },
  ],
  earth: [
    { key: 'eruptStrength', label: 'eruption', min: 0, max: 2.0, step: 0.05 },
  ],
  air: [
    { key: 'orbitalSpeed', label: 'orbital spd', min: 0.2, max: 3.0, step: 0.05 },
    { key: 'spread',       label: 'spread',      min: 0.2, max: 2.0, step: 0.05 },
  ],
};

const PHASE_LABEL = {
  fluid: '// fluid :: active',
  thermal: '// thermal :: active',
  earth: '// earth :: active',
  air: '// air :: active',
};

export default function MercuryControls({
  activePhase,
  params,
  onChange,
  fps = 0,
  particleCount = 0,
}) {
  const handleChange = (key, value) => onChange({ ...params, [key]: value });

  return (
    <div className="font-mono text-[11px] border border-cyan-900/30 rounded-lg p-3 bg-black/50 backdrop-blur-sm space-y-1">
      <div className="text-[9px] text-cyan-400/40 tracking-widest mb-3 border-b border-cyan-900/20 pb-2">
        {PHASE_LABEL[activePhase] ?? '// neutral :: liquid'}
      </div>

      <Slider label="speed"      value={params.speed}      min={0.01} max={0.4}  step={0.01} onChange={v => handleChange('speed', v)} />
      <Slider label="turbulence" value={params.turbulence ?? 0.25} min={0}    max={1.0}  step={0.01} onChange={v => handleChange('turbulence', v)} />
      <Slider label="density"    value={params.density}    min={500} max={15000} step={100} onChange={v => handleChange('density', v)} />

      <div className="border-t border-cyan-900/20 pt-2 mt-2">
        {(PHASE_PARAMS[activePhase] ?? []).map(({ key, label, min, max, step }) => (
          <Slider
            key={key}
            label={label}
            value={params[key] ?? min}
            min={min}
            max={max}
            step={step}
            onChange={v => handleChange(key, v)}
          />
        ))}
      </div>

      <div className="border-t border-cyan-900/20 pt-2 mt-1 space-y-0.5 text-[9px] text-cyan-400/30 tracking-widest">
        <div>FPS: {fps}</div>
        <div>particles: {particleCount.toLocaleString('en-US')}</div>
      </div>
    </div>
  );
}
