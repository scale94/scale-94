// src/terminal/mercury/useInViewport.js — GPU courtesy (spec §7): wet seals
// animate only while visible. No IntersectionObserver (jsdom, ancient UA) →
// treat as visible; the eye's watchdog already self-throttles when hidden.
import { useEffect, useRef, useState } from 'react';

export function useInViewport() {
  const ref = useRef(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}
