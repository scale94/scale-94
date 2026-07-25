// Silent, App-level reading witness. Accrues focus-gated active reading time per
// pinned kernel article (keyed by selectedArticle.id) and fires onWitnessed once
// when every required kernel has been genuinely read. No UI, no persistence.
import { useEffect, useRef } from 'react';
import { countWords, requiredSeconds } from './readingThresholds';
import { isAbsorbed, allWitnessed, MIN_SCROLL_EVENTS } from './readingWitness';

const BOTTOM_SLOP = 24;   // px tolerance for "reached bottom"
const DEV = !!import.meta.env?.DEV;

// The article prose reveals via a typing animation, so innerText can undercount
// early. Track the LARGEST word count seen and derive the threshold from it, so an
// early (small) measurement never locks in a too-easy threshold.
function measureInto(stats, el) {
  if (!el) return;
  const words = countWords(el.innerText);
  if (words > stats.measuredWords) {
    stats.measuredWords = words;
    stats.requiredSeconds = requiredSeconds(words);
  }
}

// Absorbed = enough active time AND (the reader really scrolled to the bottom, OR
// the article currently fits without scrolling). The "fits" waiver is recomputed
// every check from live geometry, so an article that is small mid-reveal but grows
// past the viewport still requires a real scroll-to-bottom.
function absorbedNow(stats, el) {
  const fits = !!el && el.scrollHeight <= el.clientHeight + BOTTOM_SLOP;
  return isAbsorbed({
    activeSeconds: stats.activeSeconds,
    requiredSeconds: stats.requiredSeconds,
    reachedBottom: stats.scrolledBottom || fits,
    scrollEvents: fits ? MIN_SCROLL_EVENTS : stats.scrollEvents,
  });
}

export default function useReadingWitness({ mainRef, selectedArticle, activeTab, requiredArticleIds, onWitnessed }) {
  const statsRef = useRef(new Map());   // id -> { activeSeconds, requiredSeconds, scrolledBottom, scrollEvents, measuredWords }
  const completedRef = useRef(new Set());
  const firedRef = useRef(false);
  const cbRef = useRef(onWitnessed);
  cbRef.current = onWitnessed;

  const currentId =
    activeTab === 'kernel' && selectedArticle && requiredArticleIds.includes(selectedArticle.id)
      ? selectedArticle.id
      : null;

  // Per-article measurement + scroll wiring, re-run when the shown kernel changes.
  useEffect(() => {
    if (!currentId) return;
    const el = mainRef.current;
    const stats = statsRef.current.get(currentId) || { activeSeconds: 0, requiredSeconds: Infinity, scrolledBottom: false, scrollEvents: 0, measuredWords: 0 };
    statsRef.current.set(currentId, stats);

    measureInto(stats, el);

    const check = () => {
      measureInto(stats, el);
      if (absorbedNow(stats, el)) completedRef.current.add(currentId);
      if (!firedRef.current && allWitnessed(completedRef.current, requiredArticleIds)) {
        firedRef.current = true;
        cbRef.current?.();
      }
      if (DEV) console.debug('[witness]', currentId, { ...stats, done: [...completedRef.current] });
    };

    const onScroll = () => {
      if (!el) return;
      stats.scrollEvents += 1;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_SLOP) stats.scrolledBottom = true;
      check();
    };

    el?.addEventListener('scroll', onScroll, { passive: true });
    return () => el?.removeEventListener('scroll', onScroll);
  }, [currentId, mainRef, requiredArticleIds]);

  // Focus-gated active-time accrual (1s cadence).
  useEffect(() => {
    if (!currentId) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const stats = statsRef.current.get(currentId);
      if (!stats) return;
      measureInto(stats, mainRef.current);
      stats.activeSeconds += 1;
      if (absorbedNow(stats, mainRef.current)) completedRef.current.add(currentId);
      if (!firedRef.current && allWitnessed(completedRef.current, requiredArticleIds)) {
        firedRef.current = true;
        cbRef.current?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [currentId, mainRef, requiredArticleIds]);
}
