// driveFrames.js — deterministic replay of a component's GL traffic.
//
// Uses fake timers so rAF, performance.now and setTimeout all advance off one
// clock. The log is split at rec.log.length as measured immediately after
// mount() returns: everything recorded synchronously during mount is `init`,
// everything recorded afterward (i.e. during the advanced frames) is
// `frames`. This is deliberate, not incidental — a component that paints
// once synchronously inside its mount effect (e.g. MercuryTerminator) is
// doing initialisation, not running its animation loop, so that first paint
// belongs in `init` even though it may itself call drawArrays.
//
// Mid-run prop changes: `mount` may return either the original bare unmount
// function, or `{ unmount, rerender }` (the shape @testing-library/react's
// `render()` already produces, minus its other fields). Passing `rerenders:
// [{ at, element }, ...]` schedules one or more `rerender(element)` calls,
// each wrapped in `act()`, to fire immediately before the timer advance for
// frame index `at` (0-based). Because that always happens strictly after the
// `initEnd` cut, everything a scripted rerender causes — the prop-sync effect
// and any GL calls it triggers — lands in `frames`, never `init`. With no
// `rerenders` supplied the loop below never calls `act`, so behavior for
// existing callers (bare-function mount, no script) is byte-for-byte what it
// was before this capability existed.

import { vi } from 'vitest';
import { act } from '@testing-library/react';
import { installRecordingGL } from './recordingGL';

export const FRAME_MS = 16;
export const DEFAULT_FRAMES = 60;

export function driveFrames(mount, { frames = DEFAULT_FRAMES, version = 1, rerenders = [] } = {}) {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance',
             'setTimeout', 'clearTimeout', 'Date'],
  });
  const rec = installRecordingGL({ version });
  let unmount = () => {};
  try {
    const mounted = mount();
    let rerender = null;
    if (typeof mounted === 'function') {
      unmount = mounted;
    } else {
      ({ unmount, rerender } = mounted);
    }
    const initEnd = rec.log.length;
    for (let i = 0; i < frames; i++) {
      for (const r of rerenders) {
        if (r.at !== i) continue;
        if (!rerender) {
          throw new Error(
            'driveFrames: rerenders was passed but mount() did not return { unmount, rerender }'
          );
        }
        act(() => { rerender(r.element); });
      }
      vi.advanceTimersByTime(FRAME_MS);
    }
    const all = rec.log.map(serialiseEntry);
    return { init: all.slice(0, initEnd), frames: all.slice(initEnd) };
  } finally {
    try { unmount(); } finally {
      try { rec.restore(); } finally { vi.useRealTimers(); }
    }
  }
}

function serialiseEntry(entry) {
  const [name, ...args] = entry;
  return `${name}(${args.map(a => JSON.stringify(a)).join(', ')})`;
}
