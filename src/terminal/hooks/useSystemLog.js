import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const MAX_SYSTEM_LOGS = 2000;

export default function useSystemLog() {
  const [systemLogs, setSystemLogs] = useState([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "Initializing SOMA 11.1..." },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "Mounting Fish Scale Resilience..." },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "Entropy Ledger synchronized." },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "User 'scale' authenticated." },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "──────────────────────────────────" },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "TERMINAL READY. Commands available:" },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "  load <keyword>  — open a kernel  (e.g. load soma)" },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "  list            — show all modules" },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "  search <term>   — filter kernel index" },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "  help            — all commands" },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "──────────────────────────────────" },
  ]);

  // Stable element ref — written by the callback ref below.
  const logElRef   = useRef(null);
  // Holds the active MutationObserver so we can disconnect on unmount.
  const logObsRef  = useRef(null);

  // Callback ref attached to the log container in KernelTab.
  // React calls this with the element on mount and null on unmount.
  const logRef = useCallback((el) => {
    // ── Teardown: disconnect the previous observer when the element leaves the DOM.
    if (logObsRef.current) {
      logObsRef.current.disconnect();
      logObsRef.current = null;
    }

    logElRef.current = el;
    if (!el) return;

    // ── Mount snap: double-rAF defers until after paint so scrollHeight is
    // fully computed even when the log container had zero height before mount.
    // Single rAF is enough for layout, but the second frame guarantees paint.
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!el.isConnected) return;
        el.scrollTop = el.scrollHeight;
      });
    });

    // ── MutationObserver: fires whenever React appends new <div> log rows.
    // This catches every entry added while the element is live, regardless
    // of whether the useEffect on systemLogs fired before or after layout.
    const obs = new MutationObserver(() => {
      if (!el.isConnected) return;
      el.scrollTop = el.scrollHeight;
    });
    // childList: direct children (the log <div> rows) — subtree not needed.
    obs.observe(el, { childList: true });
    logObsRef.current = obs;

    // Clean up the rAFs if the element unmounts before they fire.
    // We store them on the element only as a quick teardown handle;
    // the null branch above does the real cleanup via the observer disconnect.
    el._snapRaf1 = raf1;
    el._snapRaf2 = raf2;
  }, []);

  // Centralized append helper — stable reference via useCallback so callers
  // can safely use it as a useEffect dependency without causing infinite loops.
  const appendSystemLog = useCallback((newEntry) => {
    setSystemLogs(prev => {
      const next = [...prev, newEntry];
      if (next.length > MAX_SYSTEM_LOGS) {
        return next.slice(next.length - MAX_SYSTEM_LOGS);
      }
      return next;
    });
  }, []); // setSystemLogs is stable — no deps needed

  // One-time sanitization: remove old nested arrays (a structural fix)
  useEffect(() => {
    setSystemLogs(prev => {
      const flatPrev = Array.isArray(prev) ? prev.flat(Infinity) : [];
      return flatPrev.slice(Math.max(0, flatPrev.length - MAX_SYSTEM_LOGS));
    });
  }, []);

  // Fallback scroll: fires after React commits new log entries to the DOM.
  // The MutationObserver is the primary driver; this covers the edge case
  // where the observer fires before scrollHeight updates (extremely rare).
  useEffect(() => {
    const el = logElRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [systemLogs]);

  // Memoized slice — avoids creating a new array on every render
  const visibleLogs = useMemo(() => systemLogs.slice(-400), [systemLogs]);

  return { systemLogs, appendSystemLog, setSystemLogs, visibleLogs, logRef };
}
