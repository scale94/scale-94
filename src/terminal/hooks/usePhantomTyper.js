import { useRef, useCallback, useEffect, useMemo } from 'react';

/**
 * usePhantomTyper — state-based phantom typing for the terminal command input.
 *
 * The hook returns { typeAndSubmit, cancel } where:
 *   typeAndSubmit(rawCmd) animates `setCommandInput` char-by-char at ~40ms/char,
 *     then calls `runRawCommand(rawCmd)` to fire it through the existing dispatcher,
 *     then clears the input.
 *   cancel() aborts any in-flight typing immediately.
 *
 * @param {(text: string) => void} setCommandInput   from App.jsx
 * @param {(raw: string) => void}  runRawCommand     from App.jsx
 */
export default function usePhantomTyper({ setCommandInput, runRawCommand }) {
  const cancelRef = useRef({ cancelled: false });

  // Cancel any in-flight typing on unmount
  useEffect(() => () => { cancelRef.current.cancelled = true; }, []);

  const cancel = useCallback(() => {
    cancelRef.current.cancelled = true;
  }, []);

  const typeAndSubmit = useCallback(async (rawCmd) => {
    cancelRef.current = { cancelled: false };
    const token = cancelRef.current;
    for (let i = 1; i <= rawCmd.length; i++) {
      if (token.cancelled) return false;
      setCommandInput(rawCmd.slice(0, i));
      await new Promise(r => setTimeout(r, 40));
    }
    if (token.cancelled) return false;
    // small pause so the user sees the full command before it fires
    await new Promise(r => setTimeout(r, 180));
    if (token.cancelled) return false;
    runRawCommand(rawCmd);
    setCommandInput('');
    return true;
  }, [setCommandInput, runRawCommand]);

  // Stable object identity so consumers can safely include `phantom` in
  // useEffect dependency arrays without retriggering on every render.
  return useMemo(() => ({ typeAndSubmit, cancel }), [typeAndSubmit, cancel]);
}
