// MoonRendererToggle.jsx — persisted switch between the canvas and shader moon.
// The SCOTOPIC meter joins this file in Task 6.

import React from 'react';
import ParamBar from '../mercury/ParamBar';

export const MOON_RENDERER_KEY = 'lunar_moon_renderer_v1';
const VALID = ['canvas', 'shader'];

export function readRenderer() {
  try {
    const v = localStorage.getItem(MOON_RENDERER_KEY);
    return VALID.includes(v) ? v : 'shader';
  } catch {
    return 'shader';
  }
}

export function writeRenderer(v) {
  if (!VALID.includes(v)) return;
  try { localStorage.setItem(MOON_RENDERER_KEY, v); } catch { /* private mode */ }
}

export default function MoonRendererToggle({ value, onChange }) {
  const other = value === 'shader' ? 'canvas' : 'shader';
  return (
    <button
      type="button"
      onClick={() => onChange(other)}
      className="text-[8px] font-mono uppercase tracking-widest text-violet-400/70 hover:text-violet-300 transition-colors"
    >
      renderer · {value}
    </button>
  );
}

/**
 * Without this the 25-second adaptation ramp reads as "nothing is happening",
 * which is a UX failure rather than a subtlety.
 */
export function ScotopicMeter({ adapt }) {
  return (
    <div className="w-full max-w-[340px] px-2">
      <ParamBar
        label="SCOTOPIC"
        value={Math.max(0, Math.min(1, adapt))}
        min={0}
        max={1}
        color="bg-violet-500/70"
      />
    </div>
  );
}
