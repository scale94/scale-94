import React, { useState, useRef, useEffect } from 'react';
import { GATE_PROMPT, isAcceptedAnswer } from '../lib/gateAnswers';

// Inject keyframes once — no runtime cost, pure CSS animation
const GATE_KEYFRAMES = `
  @keyframes gate-chroma {
    0%   { text-shadow:  4px 0 #00cccccc, -4px 0 #cc00cccc; }
    20%  { text-shadow: -4px 0 #ff0088cc,  4px 0 #00cccccc; }
    40%  { text-shadow:  6px 0 #cc00cccc, -6px 0 #00cccccc; }
    60%  { text-shadow: -3px 0 #ff4400cc,  3px 0 #cc00cccc; }
    80%  { text-shadow:  3px 0 #00cccccc, -3px 0 #ff0088cc; }
    100% { text-shadow:  4px 0 #00cccccc, -4px 0 #cc00cccc; }
  }
  @keyframes gate-card-pulse {
    0%, 100% { box-shadow: 0 0 8px #cc000099, 0 0 32px #cc000033, inset 0 0 40px #cc000008; border-color: #cc000077; }
    50%       { box-shadow: 0 0 20px #ff0088bb, 0 0 60px #ff008844, inset 0 0 60px #ff008810; border-color: #ff0088aa; }
  }
  @keyframes gate-input-pulse {
    0%, 100% { box-shadow: 0 1px 0 #cc0000cc, 0 3px 16px #cc000055; }
    50%       { box-shadow: 0 1px 0 #ff0088ff, 0 3px 32px #ff008877; }
  }
  @keyframes gate-scan {
    0%   { transform: translateY(-10px); opacity: 0; }
    5%   { opacity: 0.07; }
    95%  { opacity: 0.07; }
    100% { transform: translateY(100vh); opacity: 0; }
  }
  @keyframes gate-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
`;

export default function GateOverlay({ onResult }) {
  const [value, setValue] = useState('');
  const [fading, setFading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const resolve = (passed) => {
    if (fading) return;
    setFading(true);
    setTimeout(() => onResult(passed), 350);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); resolve(false); return; }
    if (e.key === 'Enter')  { e.preventDefault(); resolve(isAcceptedAnswer(value)); }
  };

  const handleOverlayClick = (e) => {
    if (e.target !== inputRef.current) inputRef.current?.focus();
  };

  return (
    <>
      <style>{GATE_KEYFRAMES}</style>
      <div
        role="dialog"
        aria-label="entry prompt"
        className={`fixed inset-0 z-[200] flex items-center justify-center bg-black transition-opacity duration-350 overflow-hidden ${fading ? 'opacity-0' : 'opacity-100'}`}
        onClick={handleOverlayClick}
      >
        {/* Scan line sweeping down */}
        <div
          className="pointer-events-none absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent"
          style={{ animation: 'gate-scan 3.2s linear infinite' }}
        />

        {/* Vignette — red corners, black centre */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 40%, #cc000022 80%, #cc000055 100%)' }}
        />

        {/* Card */}
        <div
          className="relative flex flex-col items-center gap-8 px-8 py-10 max-w-2xl w-full mx-4 border"
          style={{
            background: '#000',
            animation: 'gate-card-pulse 2.4s ease-in-out infinite',
          }}
        >
          {/* Header stamp */}
          <div className="w-full flex justify-between items-center text-[9px] font-mono tracking-[0.25em] uppercase"
               style={{ color: '#cc000066' }}>
            <span>sys::access_gate</span>
            <span style={{ animation: 'gate-blink 1.1s step-end infinite', color: '#cc0000aa' }}>● CLEARANCE REQUIRED</span>
          </div>

          {/* Prompt with chromatic aberration */}
          <div className="flex flex-col items-center gap-2 w-full">
            <div
              className="font-mono font-black text-center leading-snug"
              style={{
                fontSize: 'clamp(1.1rem, 4vw, 2rem)',
                color: '#ff2244',
                animation: 'gate-chroma 1.8s ease-in-out infinite',
                letterSpacing: '0.04em',
              }}
            >
              {GATE_PROMPT}
            </div>
            <div
              className="font-mono text-[9px] uppercase tracking-[0.25em] text-center"
              style={{ color: '#cc000077' }}
            >
              ars electronica 2027 :: negotiating humanity
            </div>
          </div>

          {/* Input */}
          <div className="w-full max-w-md flex flex-col items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full bg-transparent border-b-2 text-center font-mono font-bold text-xl text-red-200 placeholder-red-900/50 outline-none caret-red-400"
              style={{
                borderColor: focused ? '#ff0088' : '#cc0000',
                animation: 'gate-input-pulse 2.4s ease-in-out infinite',
                letterSpacing: '0.12em',
                color: value ? '#ff8899' : undefined,
              }}
              placeholder="_ _ _"
              aria-label="your answer"
            />

            <div className="font-mono text-[10px] uppercase tracking-[0.2em]"
                 style={{ color: focused ? '#cc000099' : '#66000077' }}>
              {focused ? 'ENTER to submit · ESC to refuse' : 'TAP TO ANSWER'}
            </div>
          </div>

          {/* Mobile submit */}
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); resolve(isAcceptedAnswer(value)); }}
            className="md:hidden w-full max-w-md py-3 font-mono text-[11px] font-black uppercase tracking-[0.25em] border active:opacity-70"
            style={{
              borderColor: '#cc000077',
              color: '#cc0000aa',
              background: '#cc000011',
            }}
          >
            SUBMIT ANSWER
          </button>

          {/* Footer stamp */}
          <div className="w-full text-center font-mono text-[8px] tracking-[0.2em] uppercase"
               style={{ color: '#cc000033' }}>
            perihelion access protocol · node::scale-9.4
          </div>
        </div>
      </div>
    </>
  );
}
