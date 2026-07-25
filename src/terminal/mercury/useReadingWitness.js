// Silent, App-level reading witness. Accrues focus-gated active reading time per
// pinned kernel article (keyed by selectedArticle.id) and fires onWitnessed once
// when every required kernel has been genuinely read. No UI, no persistence.
import { useEffect, useRef } from 'react';
import { countWords, requiredSeconds } from './readingThresholds';
import { isAbsorbed, allWitnessed } from './readingWitness';

const BOTTOM_SLOP = 24;   // px tolerance for "reached bottom"
const MIN_SCROLL_EVENTS = 3;
const DEV = !!import.meta.env?.DEV;

export default function useReadingWitness({ mainRef, selectedArticle, activeTab, requiredArticleIds, onWitnessed }) {
  const statsRef = useRef(new Map());   // id -> { activeSeconds, requiredSeconds, reachedBottom, scrollEvents, measured }
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
    const stats = statsRef.current.get(currentId) || { activeSeconds: 0, requiredSeconds: Infinity, reachedBottom: false, scrollEvents: 0, measured: false };
    statsRef.current.set(currentId, stats);

    const measure = () => {
      if (!el || stats.measured) return;
      const words = countWords(el.innerText);
      if (words <= 0) return;               // content not rendered yet; try again on scroll/tick
      stats.requiredSeconds = requiredSeconds(words);
      // Short article that fits without scrolling: nothing to scroll, so credit
      // the bottom and waive the scroll-event floor (time alone decides).
      if (el.scrollHeight <= el.clientHeight + BOTTOM_SLOP) {
        stats.reachedBottom = true;
        stats.scrollEvents = Math.max(stats.scrollEvents, MIN_SCROLL_EVENTS);
      }
      stats.measured = true;
    };
    measure();

    const check = () => {
      if (!stats.measured) measure();
      if (isAbsorbed(stats)) completedRef.current.add(currentId);
      if (!firedRef.current && allWitnessed(completedRef.current, requiredArticleIds)) {
        firedRef.current = true;
        cbRef.current?.();
      }
      if (DEV) console.debug('[witness]', currentId, { ...stats, done: [...completedRef.current] });
    };

    const onScroll = () => {
      if (!el) return;
      stats.scrollEvents += 1;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_SLOP) stats.reachedBottom = true;
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
      if (!stats.measured) {
        const el = mainRef.current;
        const words = countWords(el?.innerText);
        if (words > 0) {
          stats.requiredSeconds = requiredSeconds(words);
          if (el && el.scrollHeight <= el.clientHeight + BOTTOM_SLOP) {
            stats.reachedBottom = true;
            stats.scrollEvents = Math.max(stats.scrollEvents, MIN_SCROLL_EVENTS);
          }
          stats.measured = true;
        }
      }
      stats.activeSeconds += 1;
      if (isAbsorbed(stats)) completedRef.current.add(currentId);
      if (!firedRef.current && allWitnessed(completedRef.current, requiredArticleIds)) {
        firedRef.current = true;
        cbRef.current?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [currentId, mainRef, requiredArticleIds]);
}
