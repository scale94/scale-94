// MoonRendererToggle.jsx — persisted switch between the canvas and shader moon.
// The SCOTOPIC meter joins this file in Task 6.

import React from 'react';

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
