// useCalm — reduced motion for /MERCURY (phase-4 spec §5): prefers-reduced-motion, read
// live (an OS toggle applies at once), or ?calm=1 for probes.

import { useEffect, useState } from 'react';
import { calmOverride } from './planet/planetQuality';

export const CALM_QUERY = '(prefers-reduced-motion: reduce)';

function readCalm() {
  if (typeof window === 'undefined') return false;
  if (calmOverride(window.location.search)) return true;
  return !!window.matchMedia?.(CALM_QUERY)?.matches;
}

export default function useCalm() {
  const [calm, setCalm] = useState(readCalm);
  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia?.(CALM_QUERY) : null;
    if (!mq) return undefined;
    const onChange = () => setCalm(readCalm());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return calm;
}
