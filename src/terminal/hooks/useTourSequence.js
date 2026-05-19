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
 */
export default function useTourSequence({ active, phantom, inputRef, appendSystemLog, onDone }) {
  const cancelledRef = useRef(false);
  const hasRunRef    = useRef(false);

  useEffect(() => {
    if (!active || hasRunRef.current) return;
    hasRunRef.current = true;
    cancelledRef.current = false;

    const inputEl = inputRef.current;
    const handler = (e) => {
      if (e.isTrusted) {
        cancelledRef.current = true;
        phantom.cancel();
      }
    };
    inputEl?.addEventListener('keydown', handler);

    (async () => {
      for (const cmd of TOUR_COMMANDS) {
        if (cancelledRef.current) break;
        appendSystemLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          msg: `# the architect demonstrates :: ${cmd}`,
        });
        await new Promise(r => setTimeout(r, 350));
        if (cancelledRef.current) break;
        await phantom.typeAndSubmit(cmd);
        if (cancelledRef.current) break;
        await new Promise(r => setTimeout(r, GAP_MS));
      }
      onDone?.();
    })();

    return () => {
      cancelledRef.current = true;
      phantom.cancel();
      inputEl?.removeEventListener('keydown', handler);
    };
  }, [active, phantom, inputRef, appendSystemLog, onDone]);
}
