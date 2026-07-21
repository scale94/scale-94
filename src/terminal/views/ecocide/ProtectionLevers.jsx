import { useRef, useState, useEffect, useCallback } from 'react';
import './ProtectionLevers.css';

// Shared pointer engine — custom track works on iPad (native range does not).
function useLeverPointer(onChange, disabled) {
  const trackRef = useRef(null);
  const valueFromEvent = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);
  const handlePointer = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    onChange(valueFromEvent(e));
    const move = (me) => { me.preventDefault(); onChange(valueFromEvent(me)); };
    const up   = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
  }, [disabled, onChange, valueFromEvent]);
  return { trackRef, handlePointer };
}

function LeverRow({ label, color, value, disabled, onChange, children }) {
  const { trackRef, handlePointer } = useLeverPointer(onChange, disabled);
  const pct = value * 100;
  return (
    <div className="pl-row">
      <span className="pl-label" style={{ color }}>{label}</span>
      <div className="pl-track" ref={trackRef} onPointerDown={handlePointer}>
        {children(pct)}
      </div>
      <span className="pl-val" style={{ color }}>{Math.round(pct)}</span>
    </div>
  );
}

const TENDRILS = 'M20 22 Q30 12 44 6 M55 22 Q60 10 72 4 M90 22 Q98 13 110 5 M120 22 Q126 9 134 3';
const MESH_LINES = [[10,4,30,18],[30,18,50,4],[50,4,70,18],[10,18,30,4],[30,4,50,18],[50,18,70,4]];
const MESH_NODES = [[10,4],[30,18],[50,4],[70,18],[30,4],[50,18]];

export function ProtectionLevers({ levers, isGated, onChange }) {
  const [ignite, setIgnite] = useState(false);
  const prevGated = useRef(isGated);
  useEffect(() => {
    if (prevGated.current && !isGated) {        // gate just opened → ignite once
      setIgnite(true);
      const t = setTimeout(() => setIgnite(false), 800);
      return () => clearTimeout(t);
    }
    prevGated.current = isGated;
  }, [isGated]);

  const wrapClass = `pl-wrap${isGated ? ' is-gated' : ''}${ignite ? ' pl-ignite' : ''}`;

  return (
    <div className={wrapClass} data-testid="protection-levers">
      <LeverRow label="TOXICITY_CAP" color="#5a8ac0" value={levers.toxicityCap} disabled={isGated} onChange={(v) => onChange('toxicityCap', v)}>
        {(pct) => (<>
          <div className="pl-tox-poison" />
          <div className="pl-tox-membrane" style={{ width: `${pct}%` }} />
        </>)}
      </LeverRow>

      <LeverRow label="SANCTUARY" color="#5fbf3a" value={levers.sanctuary} disabled={isGated} onChange={(v) => onChange('sanctuary', v)}>
        {(pct) => (<>
          <div className="pl-sanc-fill" style={{ width: `${pct}%` }} />
          <div className="pl-sanc-ring" style={{ left: `${pct}%` }} />
        </>)}
      </LeverRow>

      <LeverRow label="RESTORATION" color="#3fd06a" value={levers.restoration} disabled={isGated} onChange={(v) => onChange('restoration', v)}>
        {(pct) => (
          <div className="pl-rest-fill" style={{ width: `${pct}%` }}>
            <svg className="pl-rest-svg" viewBox="0 0 200 22" preserveAspectRatio="none">
              {TENDRILS.split('M').filter(Boolean).map((seg, i) => <path key={i} d={`M${seg}`} />)}
            </svg>
          </div>
        )}
      </LeverRow>

      <LeverRow label="NATIVE_BIODIV" color="#7fe08a" value={levers.nativeBio} disabled={isGated} onChange={(v) => onChange('nativeBio', v)}>
        {(pct) => (
          <div className="pl-nat-fill" style={{ width: `${pct}%` }}>
            <svg className="pl-nat-svg" viewBox="0 0 200 22" preserveAspectRatio="none">
              {MESH_LINES.map(([x1,y1,x2,y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
              {MESH_NODES.map(([cx,cy], i) => <circle key={i} cx={cx} cy={cy} r="1" style={{ animationDelay: `${i * 0.4}s` }} />)}
            </svg>
          </div>
        )}
      </LeverRow>
    </div>
  );
}
