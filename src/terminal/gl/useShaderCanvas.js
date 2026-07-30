// useShaderCanvas.js — the React seam over glHost + frameLoop.
//
// Owns the effect: build the host, run the optional init pass, optionally
// paint one synchronous frame, start the loop, tear everything down. Owns no
// GL state and no per-frame maths — the component supplies `draw`.

import { useCallback, useEffect, useRef } from 'react';
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
  const hostRef = useRef(null);

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
    hostRef.current = host;

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
      // Order matters: the loop must be stopped before the host is disposed,
      // so a frame that is already scheduled (or firing) can never draw into
      // a program/context that dispose() has just torn down. Today's flow is
      // synchronous end-to-end so nothing actually yields between these two
      // statements, but that is an implementation detail, not a contract —
      // keep the order even though no current effect can race it.
      loop.stop();
      snapRef.current = null;
      hostRef.current = null;
      host.dispose();
    };
    // deps controls the whole rebuild: `draw`, `onSnap`, `onUnsupported` and
    // every hostOption are captured by this closure only at the point deps
    // changes, not on every render. A caller that needs to react to some
    // other prop on every render must bridge it through a ref and read the
    // ref inside `draw` — which is exactly what the migrated components do
    // via their own props-sync effect. Do not silence this by adding those
    // values to the deps array; that would rebuild (and briefly blank) the
    // GL host on every render instead of only when `deps` says to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const snap = useCallback(() => snapRef.current?.(), []);
  return { snap, hostRef };
}
