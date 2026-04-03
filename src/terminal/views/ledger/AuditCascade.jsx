import { useState, useEffect, useRef } from 'react';
import { PARAM_RANGES } from '../../ledger/verdictModel';

const MODULES = [
  { key: 'streeter_phelps', label: 'STREETER-PHELPS', param: 'do',      unit: 'mg/L' },
  { key: 'vant_hoff',       label: "VAN'T HOFF",      param: 'dt',      unit: '°C'   },
  { key: 'redfield',        label: 'REDFIELD',         param: 'nitrate', unit: 'mg/L' },
  { key: 'manning',         label: 'MANNING',          param: 'flow',    unit: 'm³/s' },
  { key: 'langelier',       label: 'LANGELIER',        param: 'lsi',     unit: 'LSI'  },
];

// Map parsed audit module keys to cascade module indices
const MODULE_KEY_MAP = {
  do_ledger: 0,
  thermal:   1,
  nutrient:  2,
  hydraulic: 3,
  langelier: 4,
};

const SIGNAL_COLORS = {
  GREEN:     '#22c55e',
  AMBER:     '#eab308',
  RED:       '#ef4444',
  VETO:      '#ef4444',
  EMERGENCY: '#dc2626',
  UNKNOWN:   '#6b7280',
};

const STAGGER_MS  = 300;
const SWEEP_MS    = 800;
const VERDICT_DELAY_MS = MODULES.length * STAGGER_MS + SWEEP_MS + 200;
const VERDICT_ANIM_MS  = 900;

const STATUS_GLOW = {
  APPROVED:       { color: '#22c55e', shadow: '0 0 20px rgba(34,197,94,0.4), 0 0 40px rgba(34,197,94,0.15)'   },
  CONDITIONAL:    { color: '#eab308', shadow: '0 0 20px rgba(234,179,8,0.4), 0 0 40px rgba(234,179,8,0.15)'   },
  REJECTED:       { color: '#ef4444', shadow: '0 0 20px rgba(239,68,68,0.4), 0 0 40px rgba(239,68,68,0.15)'   },
  EMERGENCY_VETO: { color: '#ef4444', shadow: '0 0 24px rgba(239,68,68,0.5), 0 0 48px rgba(239,68,68,0.2)'    },
};

const SEV_COLORS = {
  safe:     { bar: 'from-teal-900/30 to-teal-500',  text: '#2dd4bf', hex: '#14b8a6' },
  stress:   { bar: 'from-amber-900/30 to-amber-500', text: '#fbbf24', hex: '#f59e0b' },
  critical: { bar: 'from-red-900/30 to-red-500',    text: '#f87171', hex: '#ef4444' },
};

function getSeverity(param, value) {
  if (value === undefined || value === null || isNaN(Number(value))) return 'safe';
  const v = Number(value);
  if (param === 'do')  return v >= 6 ? 'safe' : v >= 4 ? 'stress' : 'critical';
  if (param === 'dt')  return v <= 3 ? 'safe' : v <= 6 ? 'stress' : 'critical';
  const range = PARAM_RANGES[param];
  if (!range) return 'safe';
  const pct = (v - range.min) / (range.max - range.min);
  return pct < 0.5 ? 'safe' : pct < 0.8 ? 'stress' : 'critical';
}

function getBarWidth(param, value) {
  if (value === undefined || value === null || isNaN(Number(value))) return 0;
  const v = Number(value);
  if (param === 'do')  return Math.min((v / 20) * 100, 100);
  if (param === 'dt')  return Math.min((Math.abs(v) / 10) * 100, 100);
  if (param === 'lsi') return Math.min((Math.abs(v) / 3) * 100, 100);
  const range = PARAM_RANGES[param];
  if (!range) return 0;
  return Math.min(((v - range.min) / (range.max - range.min)) * 100, 100);
}

const STYLES = `
  @keyframes ac-sweep {
    from {
      width: 0%;
      opacity: 0;
    }
    5% {
      opacity: 1;
    }
    to {
      width: var(--ac-w);
      opacity: 1;
    }
  }

  @keyframes ac-rowIn {
    from {
      opacity: 0;
      transform: translateX(-6px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes ac-scanline {
    0%   { top: -4px; }
    100% { top: 100%; }
  }

  @keyframes ac-verdictReveal {
    0%   { filter: brightness(4) blur(8px); opacity: 0.3; letter-spacing: 0.6em; }
    40%  { filter: brightness(2) blur(2px); opacity: 0.8; letter-spacing: 0.25em; }
    100% { filter: brightness(1) blur(0);   opacity: 1;   letter-spacing: 0.3em;  }
  }

  @keyframes ac-rulingIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes ac-glowPulse {
    0%, 100% { opacity: 0.7; }
    50%       { opacity: 1; }
  }

  @keyframes ac-shockwave {
    0%   { transform: scale(0.3); opacity: 0.7; border-width: 3px; }
    100% { transform: scale(3.5); opacity: 0; border-width: 0.5px; }
  }

  @keyframes ac-screenFlash {
    0%   { opacity: 0.15; }
    100% { opacity: 0; }
  }

  @keyframes ac-barGlint {
    0%   { left: -20%; opacity: 0; }
    20%  { opacity: 0.6; }
    100% { left: 120%; opacity: 0; }
  }

  .ac-shockwave {
    position: absolute;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 3px solid;
    pointer-events: none;
    animation: ac-shockwave 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    left: 50%;
    top: 50%;
    transform-origin: center;
    margin-left: -30px;
    margin-top: -30px;
  }

  .ac-screen-flash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    animation: ac-screenFlash 0.5s ease-out forwards;
    z-index: 5;
  }

  .ac-bar-fill {
    height: 100%;
    width: 0%;
    animation: ac-sweep var(--ac-dur, 800ms) cubic-bezier(0.25, 0, 0.4, 1) var(--ac-delay, 0ms) forwards;
  }

  .ac-row {
    opacity: 0;
    animation: ac-rowIn 250ms ease-out var(--ac-row-delay, 0ms) forwards;
  }

  .ac-verdict {
    animation: ac-verdictReveal 900ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .ac-ruling {
    animation: ac-rulingIn 600ms ease-out var(--ac-ruling-delay, 200ms) forwards;
    opacity: 0;
  }

  .ac-glow-pulse {
    animation: ac-glowPulse 2.4s ease-in-out infinite;
  }
`;

// ── Glitch text scramble hook ─────────────────────────────────────────────────
const GLITCH_CHARS = '█▓▒░╬╠╣╚╗┃┣┫▄▀▌▐⌐¬¡«»░▒▓';
function useGlitchText(target, active, duration = 700) {
  const [text, setText] = useState('');
  const rafRef = useRef(null);
  useEffect(() => {
    if (!active || !target) { setText(''); return; }
    const start = performance.now();
    const chars = target.split('');
    function tick() {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const resolved = Math.floor(progress * chars.length);
      let out = '';
      for (let i = 0; i < chars.length; i++) {
        if (i < resolved) {
          out += chars[i];
        } else {
          out += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        }
      }
      setText(out);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else setText(target);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, target, duration]);
  return text;
}

export default function AuditCascade({ verdict, visible, onComplete }) {
  const [verdictVisible, setVerdictVisible] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const status = verdict?.status || 'UNKNOWN';
  const glitchText = useGlitchText(status, verdictVisible, 800);

  // Reset and re-run whenever visible flips to true
  useEffect(() => {
    if (!visible) {
      setVerdictVisible(false);
      return;
    }

    const verdictTimer = setTimeout(() => {
      setVerdictVisible(true);
    }, VERDICT_DELAY_MS);

    const completeTimer = setTimeout(() => {
      onCompleteRef.current?.();
    }, VERDICT_DELAY_MS + VERDICT_ANIM_MS + 400);

    return () => {
      clearTimeout(verdictTimer);
      clearTimeout(completeTimer);
    };
  }, [visible]);

  if (!verdict || !visible) return null;

  const input   = verdict.input  || {};
  const parsedModules = verdict.audit?.modules || [];
  const parsedByIdx = {};
  for (const pm of parsedModules) {
    const idx = MODULE_KEY_MAP[pm.key];
    if (idx !== undefined) parsedByIdx[idx] = pm;
  }
  const glowCfg = STATUS_GLOW[status] || { color: '#6b7280', shadow: '0 0 16px rgba(107,114,128,0.3)' };

  return (
    <>
      <style>{STYLES}</style>

      <div
        style={{
          background: 'rgba(5,8,16,0.96)',
          border: '1px solid rgba(20,184,166,0.12)',
          borderRadius: '2px',
          padding: '16px 12px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Scanline overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            zIndex: 0,
          }}
        >
          {/* Static scanlines */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,200,0.012) 2px, rgba(0,255,200,0.012) 4px)',
            }}
          />
          {/* Moving scan beam */}
          {visible && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(20,184,166,0.25), transparent)',
                animation: 'ac-scanline 1.8s linear infinite',
              }}
            />
          )}
        </div>

        {/* Header label */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            fontFamily: 'monospace',
            fontSize: '9px',
            letterSpacing: '4px',
            color: 'rgba(20,184,166,0.5)',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          CHRONO-ACTUARY MODULE EXECUTION
        </div>

        {/* Module bars */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {MODULES.map((mod, i) => {
            const rawVal = input[mod.param];
            const value  = rawVal !== undefined ? Number(rawVal) : null;
            const sev    = getSeverity(mod.param, value);
            const width  = value !== null ? getBarWidth(mod.param, value) : 0;
            const colors = SEV_COLORS[sev];
            const rowDelay  = i * STAGGER_MS;
            const fillDelay = i * STAGGER_MS + 80;

            return (
              <div
                key={mod.key}
                className="ac-row"
                style={{ '--ac-row-delay': `${rowDelay}ms` }}
              >
                {/* Top row: label + value */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '4px',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        color: 'rgba(156,163,175,0.7)',
                        letterSpacing: '1px',
                      }}
                    >
                      {mod.label}
                    </span>
                    {parsedByIdx[i] && (
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '8px',
                          letterSpacing: '2px',
                          color: SIGNAL_COLORS[parsedByIdx[i].signal] || SIGNAL_COLORS.UNKNOWN,
                          opacity: verdictVisible ? 1 : 0,
                          transition: 'opacity 0.5s ease',
                        }}
                      >
                        {parsedByIdx[i].signal}
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: colors.text,
                      letterSpacing: '1px',
                    }}
                  >
                    {value !== null
                      ? `${Number.isInteger(value) ? value : value.toFixed(2)} ${mod.unit}`
                      : '— ' + mod.unit}
                  </span>
                </div>

                {/* Bar track */}
                <div
                  style={{
                    height: '4px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '1px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className="ac-bar-fill"
                    style={{
                      '--ac-w':     `${width}%`,
                      '--ac-dur':   `${SWEEP_MS}ms`,
                      '--ac-delay': `${fillDelay}ms`,
                      background: `linear-gradient(90deg, ${colors.hex}22, ${colors.hex})`,
                      boxShadow:  `0 0 6px ${colors.hex}66`,
                      borderRadius: '1px',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Glint shimmer */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      width: '30px',
                      height: '100%',
                      background: `linear-gradient(90deg, transparent, ${colors.hex}88, transparent)`,
                      animation: `ac-barGlint 1.2s ${fillDelay + SWEEP_MS}ms ease-out forwards`,
                      filter: 'blur(2px)',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Verdict reveal */}
        {verdictVisible && (
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: `1px solid ${glowCfg.color}22`,
            }}
          >
            {/* Shockwave ring */}
            <div
              className="ac-shockwave"
              style={{ borderColor: glowCfg.color }}
            />

            {/* Screen flash */}
            <div
              className="ac-screen-flash"
              style={{ background: `radial-gradient(ellipse at 50% 50%, ${glowCfg.color}30, transparent 70%)` }}
            />

            {/* Status — glitch scramble resolve */}
            <div
              className="ac-verdict"
              style={{
                fontFamily: 'monospace',
                fontSize: 'clamp(14px, 4vw, 18px)',
                fontWeight: 'bold',
                letterSpacing: '0.3em',
                color: glowCfg.color,
                textShadow: glowCfg.shadow,
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}
            >
              {glitchText || status}
            </div>

            {/* Glow underline */}
            <div
              className="ac-glow-pulse"
              style={{
                height: '1px',
                width: '100%',
                background: `linear-gradient(90deg, ${glowCfg.color}80, transparent)`,
                marginBottom: '10px',
              }}
            />

            {/* Ruling snippet */}
            {(verdict.audit?.ruling || verdict.ruling) && (
              <div
                className="ac-ruling"
                style={{ '--ac-ruling-delay': '300ms' }}
              >
                <pre
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: 'rgba(156,163,175,0.6)',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                    maxHeight: '80px',
                    overflow: 'hidden',
                    maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                  }}
                >
                  {verdict.audit?.ruling
                    ? verdict.audit.ruling
                    : verdict.ruling?.trim().slice(0, 240)}
                </pre>
              </div>
            )}

            {/* Hash */}
            {verdict.hash && (
              <div
                className="ac-ruling"
                style={{
                  '--ac-ruling-delay': '500ms',
                  fontFamily: 'monospace',
                  fontSize: '9px',
                  color: 'rgba(107,114,128,0.5)',
                  letterSpacing: '1px',
                  marginTop: '10px',
                }}
              >
                SHA-256 · {verdict.hash.slice(0, 12)}···{verdict.hash.slice(-8)}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
