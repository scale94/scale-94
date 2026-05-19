import React, { useState, useRef, useEffect } from 'react';
import { GATE_PROMPT, isAcceptedAnswer } from '../lib/gateAnswers';

/**
 * GateOverlay — full-viewport philosophical-prompt overlay.
 *
 * Fires onResult(true) for an accepted answer, onResult(false) for
 * an empty submit, Escape, or any rejected string.
 */
export default function GateOverlay({ onResult }) {
  const [value, setValue] = useState('');
  const [fading, setFading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
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

  return (
    <div
      role="dialog"
      aria-label="entry prompt"
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/95 transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
      onClick={() => inputRef.current?.focus()}
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
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="bg-transparent border-b border-cyan-500/60 focus:border-cyan-300 focus:outline-none text-cyan-100 font-mono text-lg sm:text-2xl text-center w-full max-w-md px-2 py-2 caret-cyan-300"
          aria-label="your answer"
        />
        <div className="font-mono text-cyan-700 text-[10px] uppercase tracking-widest">
          Enter to submit · Esc to refuse
        </div>
      </div>
    </div>
  );
}
