import { useState, useEffect, useRef, useMemo } from 'react';

const MAX_SYSTEM_LOGS = 2000;

export default function useSystemLog() {
  const [systemLogs, setSystemLogs] = useState([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "Initializing SOMA 11.1..." },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "Mounting Fish Scale Resilience..." },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "Entropy Ledger synchronized." },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "User 'scale' authenticated." }
  ]);

  const logRef = useRef(null);

  // Centralized append helper — defensive and caps length
  function appendSystemLog(newEntry) {
    setSystemLogs(prev => {
      const next = [...prev, newEntry];
      if (next.length > MAX_SYSTEM_LOGS) {
        return next.slice(next.length - MAX_SYSTEM_LOGS);
      }
      return next;
    });
  }

  // One-time sanitization: remove old nested arrays (a structural fix)
  useEffect(() => {
    setSystemLogs(prev => {
      const flatPrev = Array.isArray(prev) ? prev.flat(Infinity) : [];
      return flatPrev.slice(Math.max(0, flatPrev.length - MAX_SYSTEM_LOGS));
    });
  }, []);

  // Auto-scroll system log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [systemLogs]);

  // Memoized slice — avoids creating a new array on every render
  const visibleLogs = useMemo(() => systemLogs.slice(-400), [systemLogs]);

  return { systemLogs, appendSystemLog, setSystemLogs, visibleLogs, logRef };
}
