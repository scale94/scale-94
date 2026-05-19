import { useEffect, useRef } from 'react';
import wasmRegistry from '../../wasm/wasm.generated';
import { ECOLOGICAL_DELTA_MAP } from './useEcologicalRam';

const DURATION_MS    = 60_000;
const MIN_GAP_MS     = 800;
const MAX_GAP_MS     = 1500;
const INTRUSION_EVERY = 3;

const EXCLUDED_KERNELS = new Set([
  'VCACHE-BURN',         // 100k iterations, too slow
  'ML-KEM-CLASSIFIED',   // navigates to /cryptography + opens an API session
]);

const INTRUSION_LINES = [
  'INTRUSION_DETECTED :: unprivileged execution from MERCURY_NODE',
  'INTRUSION_DETECTED :: substrate access granted to non-local process',
  'INTRUSION_DETECTED :: keyboard buffer redirected',
  'INTRUSION_DETECTED :: exfiltrating kernel cache to perihelion',
  'INTRUSION_DETECTED :: user attention captured',
];

// Alien takeover only runs draining kernels — possession must not restore RAM.
// Look up via aliases (same keys as ECOLOGICAL_DELTA_MAP). Default delta = -10.
function kernelDrains(entry) {
  if (!entry?.aliases) return true;
  for (const alias of entry.aliases) {
    const delta = ECOLOGICAL_DELTA_MAP[alias];
    if (delta !== undefined && delta > 0) return false;
  }
  return true;
}

function pickRandomKernel() {
  const ids = Object.values(wasmRegistry)
    .filter(e => !EXCLUDED_KERNELS.has(e.id) && kernelDrains(e))
    .map(e => e.id);
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

function jitterGap() {
  return MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
}

/**
 * usePossessionSequence — on `active`, runs the 60s hostile WASM takeover.
 *
 * Reads `phantom`, `appendSystemLog`, `setPossessionActive`,
 * `setPossessionCountdown`, and `onDone` through refs so re-renders
 * never cause cleanup → cancellation. Effect deps: [active] only.
 */
export default function usePossessionSequence({
  active,
  phantom,
  appendSystemLog,
  setPossessionActive,
  setPossessionCountdown,
  onDone,
}) {
  const hasRunRef               = useRef(false);
  const phantomRef              = useRef(phantom);
  const appendSystemLogRef      = useRef(appendSystemLog);
  const setPossessionActiveRef  = useRef(setPossessionActive);
  const setCountdownRef         = useRef(setPossessionCountdown);
  const onDoneRef               = useRef(onDone);

  phantomRef.current             = phantom;
  appendSystemLogRef.current     = appendSystemLog;
  setPossessionActiveRef.current = setPossessionActive;
  setCountdownRef.current        = setPossessionCountdown;
  onDoneRef.current              = onDone;

  useEffect(() => {
    if (!active || hasRunRef.current) return;
    hasRunRef.current = true;

    setPossessionActiveRef.current(true);
    const startedAt = Date.now();
    let tick = 0;
    let timeoutId;
    let cancelled = false;

    const runTick = async () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= DURATION_MS) {
        appendSystemLogRef.current?.({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          msg: 'EXFILTRATION COMPLETE :: substrate released',
          rust: true,
        });
        setPossessionActiveRef.current(false);
        setCountdownRef.current(0);
        onDoneRef.current?.();
        return;
      }
      setCountdownRef.current(Math.ceil((DURATION_MS - elapsed) / 1000));

      tick++;
      if (tick % INTRUSION_EVERY === 0) {
        const line = INTRUSION_LINES[Math.floor(Math.random() * INTRUSION_LINES.length)];
        appendSystemLogRef.current?.({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          msg: `  ${line}`,
          intrusion: true,
        });
      }

      const kernelId = pickRandomKernel();
      if (kernelId) {
        await phantomRef.current?.typeAndSubmit(`run ${kernelId.toLowerCase()}`);
      }

      if (cancelled) return;
      timeoutId = setTimeout(runTick, jitterGap());
    };

    timeoutId = setTimeout(runTick, 600);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      phantomRef.current?.cancel();
      setPossessionActiveRef.current(false);
      setCountdownRef.current(0);
    };
  }, [active]);
}
