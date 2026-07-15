// src/terminal/mercury/useInViewport.js — GPU courtesy (spec §7): wet seals
// animate only while visible. No IntersectionObserver (jsdom, ancient UA) →
// treat as visible; the eye's watchdog already self-throttles when hidden.
// Callback-ref, not useRef: the observed node appears only when the seal
// turns wet, which can happen long after mount — setup must re-run then.
import { useCallback, useEffect, useState } from 'react';

export function useInViewport() {
  const [node, setNode] = useState(null);
  const ref = useCallback((n) => setNode(n), []);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(node);
    return () => io.disconnect();
  }, [node]);
  return [ref, inView];
}
