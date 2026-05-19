import { useEffect, useRef } from 'react';

const TOUR_COMMANDS = [
  'mercury',
  'run bosonic',
  'art',
  'ledger',
  'load fish_scale_kernel',
];

const GAP_MS = 2500;

/**
 * useTourSequence — on `active`, types the 5 tour commands sequentially
 * via the phantom typer. Any real (`isTrusted`) keydown on the terminal
 * input cancels the remaining queue silently.
 *
 * The effect intentionally depends only on `active` + `inputRef`. The
 * other callables (`phantom`, `appendSystemLog`, `onDone`) are read
 * through refs so re-renders don't trigger cleanup → cancel.
 */
export default function useTourSequence({ active, phantom, inputRef, appendSystemLog, onDone }) {
  const cancelledRef       = useRef(false);
  const hasRunRef          = useRef(false);
  const phantomRef         = useRef(phantom);
  const appendSystemLogRef = useRef(appendSystemLog);
  const onDoneRef          = useRef(onDone);

  // Keep refs current without triggering effect re-runs
  phantomRef.current         = phantom;
  appendSystemLogRef.current = appendSystemLog;
  onDoneRef.current          = onDone;

  useEffect(() => {
    if (!active || hasRunRef.current) return;
    hasRunRef.current = true;
    cancelledRef.current = false;

    const inputEl = inputRef.current;
    const handler = (e) => {
      if (e.isTrusted) {
        cancelledRef.current = true;
        phantomRef.current?.cancel();
      }
    };
    inputEl?.addEventListener('keydown', handler);

    (async () => {
      try {
        for (const cmd of TOUR_COMMANDS) {
          if (cancelledRef.current) break;
          appendSystemLogRef.current?.({
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
            msg: `# the architect demonstrates :: ${cmd}`,
          });
          await new Promise(r => setTimeout(r, 350));
          if (cancelledRef.current) break;
          await phantomRef.current.typeAndSubmit(cmd);
          if (cancelledRef.current) break;
          await new Promise(r => setTimeout(r, GAP_MS));
        }
      } finally {
        onDoneRef.current?.();
      }
    })();

    return () => {
      cancelledRef.current = true;
      phantomRef.current?.cancel();
      inputEl?.removeEventListener('keydown', handler);
    };
  }, [active, inputRef]);
}
