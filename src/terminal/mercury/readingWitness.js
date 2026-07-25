// Pure predicates deciding whether a single kernel was truly read, and whether
// the whole pinned corpus has been witnessed.
const MIN_SCROLL_EVENTS = 3; // guards against one instantaneous jump-to-bottom

export function isAbsorbed({ activeSeconds, requiredSeconds, reachedBottom, scrollEvents }) {
  return (
    activeSeconds >= requiredSeconds &&
    reachedBottom === true &&
    scrollEvents >= MIN_SCROLL_EVENTS
  );
}

export function allWitnessed(completedIds, requiredIds) {
  if (!requiredIds || requiredIds.length === 0) return false;
  return requiredIds.every((id) => completedIds.has(id));
}
