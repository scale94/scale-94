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

import { vi } from 'vitest';
import { installRecordingGL } from './recordingGL';

export const FRAME_MS = 16;
export const DEFAULT_FRAMES = 60;

export function driveFrames(mount, { frames = DEFAULT_FRAMES, version = 1 } = {}) {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance',
             'setTimeout', 'clearTimeout', 'Date'],
  });
  const rec = installRecordingGL({ version });
  let unmount = () => {};
  try {
    unmount = mount();
    const initEnd = rec.log.length;
    for (let i = 0; i < frames; i++) vi.advanceTimersByTime(FRAME_MS);
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
