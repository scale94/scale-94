// useShaderCanvas.js — the React seam over glHost + frameLoop.
//
// Owns the effect: build the host, run the optional init pass, optionally
// paint one synchronous frame, start the loop, tear everything down. Owns no
// GL state and no per-frame maths — the component supplies `draw`.

import { useEffect, useRef } from 'react';
import { createShaderHost } from './glHost';
import { createFrameLoop } from './frameLoop';

export function useShaderCanvas(canvasRef, {
  draw,
  initialDraw = true,
  dtClamp = 0.05,
  seedLast = 'now',
  watchdogMs = 40,
  trackVisibility = false,
  haltOnReducedMotion = true,
  onSnap = null,
  onUnsupported = null,
  deps = [],
  ...hostOptions
}) {
  const snapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let host;
    try {
      host = createShaderHost(canvas, hostOptions);
    } catch (err) {
      console.error(err);
      onUnsupported?.();
      return undefined;
    }
    if (!host) {
      onUnsupported?.();
      return undefined;
    }

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (initialDraw) draw(host, { now: 0, dt: 0, tsec: 0, hidden: false, reducedMotion });

    const loop = createFrameLoop({
      onFrame: (now, dt, ctx) =>
        draw(host, { now, dt, tsec: now / 1000, hidden: ctx.hidden, reducedMotion }),
      dtClamp, seedLast, watchdogMs, trackVisibility,
      haltOnReducedMotion, reducedMotion,
    });
    loop.start();

    snapRef.current = reducedMotion && onSnap ? () => onSnap(host) : null;

    return () => {
      loop.stop();
      snapRef.current = null;
      host.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { snap: () => snapRef.current?.() };
}
