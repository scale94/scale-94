// SphereLabels.jsx — DOM overlay for the sphere's labels.
//
// Text was the one layer that could not follow the rest of the sphere onto
// the GPU: an SDF atlas is real work and this project's mono font has dropped
// glyphs before. Because the labels sit mid-stack, leaving them on the canvas
// would have blocked every layer beneath them from migrating. Same move as
// the collider chamber's readouts.
//
// Updates are imperative: the draw loop calls update() once per frame and the
// elements are mutated in place. Going through React state here would put
// reconciliation in the hot path of the one piece this whole migration exists
// to make faster.
//
// Positions arrive as CSS pixels straight from the projection — the draw loop
// projects against contentRect and applies DPR as a canvas transform.

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

const SphereLabels = forwardRef(function SphereLabels(_props, ref) {
  const hostRef = useRef(null);
  const poolRef = useRef(new Map());   // label key → span element

  useImperativeHandle(ref, () => ({
    update(labels) {
      const host = hostRef.current;
      if (!host) return;
      const pool = poolRef.current;
      const seen = new Set();

      for (const l of labels) {
        seen.add(l.key);
        let el = pool.get(l.key);
        if (!el) {
          el = document.createElement('span');
          el.style.position = 'absolute';
          // canvas fillText's y is the alphabetic baseline; this box's bottom
          // sits at `top`. Shifting up by ~0.21em (the mono stack's descent)
          // reproduces the same baseline instead of the box bottom.
          el.style.transform = 'translate(-50%, calc(-100% + 0.21em))';
          el.style.whiteSpace = 'nowrap';
          host.appendChild(el);
          pool.set(l.key, el);
        }
        if (el.textContent !== l.text) el.textContent = l.text;
        el.style.left = `${l.x}px`;
        el.style.top = `${l.y}px`;
        // line-height is folded into the font shorthand (rather than set
        // separately at creation) because `font` resets any sub-property it
        // doesn't specify — a bare `el.style.lineHeight = '1'` at creation
        // would be clobbered by this very assignment on the same call.
        el.style.font = `bold ${l.fontSize}px/1 monospace`;
        el.style.color = l.color;
        el.style.opacity = String(l.alpha);
      }

      for (const [key, el] of pool) {
        if (!seen.has(key)) { el.remove(); pool.delete(key); }
      }
    },
  }), []);

  useEffect(() => {
    const pool = poolRef.current;
    return () => { pool.forEach(el => el.remove()); pool.clear(); };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        pointerEvents: 'none', userSelect: 'none',
      }}
    />
  );
});

export default SphereLabels;
