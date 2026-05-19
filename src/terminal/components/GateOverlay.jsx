import React, { useState, useRef, useEffect } from 'react';
import { GATE_PROMPT, isAcceptedAnswer } from '../lib/gateAnswers';

export default function GateOverlay({ onResult }) {
  const [value, setValue] = useState('');
  const [fading, setFading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Desktop: auto-focus. iOS blocks this but the tap-to-focus handler below covers mobile.
    inputRef.current?.focus();
  }, []);

  const resolve = (passed) => {
    if (fading) return;
    setFading(true);
    setTimeout(() => onResult(passed), 300);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      resolve(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      resolve(isAcceptedAnswer(value));
    }
  };

  const handleOverlayClick = (e) => {
    // Tapping anywhere focuses the input (iOS Safari blocks autoFocus from useEffect)
    if (e.target !== inputRef.current) {
      inputRef.current?.focus();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="entry prompt"
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/95 transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
      onClick={handleOverlayClick}
    >
      <div className="flex flex-col items-center gap-6 px-6 max-w-3xl w-full">
        <div
          className="font-mono text-cyan-300 text-base sm:text-2xl md:text-3xl text-center tracking-wide"
          aria-live="polite"
        >
          {GATE_PROMPT}
        </div>

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
          className="bg-transparent border-b border-cyan-500/60 focus:border-cyan-300 focus:outline-none text-cyan-100 font-mono text-lg sm:text-2xl text-center w-full max-w-md px-2 py-2 caret-cyan-300"
          aria-label="your answer"
        />

        {/* Mobile: tap-to-focus cue + explicit submit button */}
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <div className="font-mono text-cyan-700 text-[10px] uppercase tracking-widest">
            {focused ? 'Enter to submit · Esc to refuse' : 'tap to answer'}
          </div>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); resolve(isAcceptedAnswer(value)); }}
            className="md:hidden w-full py-2 border border-cyan-900/60 text-cyan-600 font-mono text-[11px] uppercase tracking-widest active:bg-cyan-900/20"
          >
            submit
          </button>
        </div>
      </div>
    </div>
  );
}
