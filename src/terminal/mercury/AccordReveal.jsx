// AccordReveal.jsx — the reveal at the altar (spec §8, C over B; P3 rulings 8–9).
// Poetry condenses into chemistry: each note, then its material rows, each row
// resolving left → right out of its own slice of the real AES-256-GCM
// ciphertext. The schedule is pure (revealSchedule.js); this host only paints
// frameAt(t). Every number shown is read from the computed formula.
//
// Colour (Fade Doctrine): top #6cc6d4, heart #d98a46, base #c8a556; gold
// #fcd34d only on the FORMULA line; white exists only inside an 80 ms flash.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildReveal, frameAt } from './revealSchedule';

export const LAYER_HEX = Object.freeze({ top: '#6cc6d4', heart: '#d98a46', base: '#c8a556' });
export const GOLD_HEX = '#fcd34d';
const ASH = '#a8a29e';
const MUTED = '#71717a';
const FLASH_HEX = '#ffffff';
const SKIP_HOLD_MS = 400;

const prefersReducedMotion = () => {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; }
  catch (_) { return false; }
};

const stockText = (stock) => (stock === 1 ? 'neat' : `${+(stock * 100).toFixed(4)}% stock`);

function Part({ text, resolved, color, flashChars = 0, flashing = false, part, className }) {
  // text[0, resolved) is chemistry, the rest is ciphertext still resolving.
  const done = text.slice(0, resolved);
  const pending = text.slice(resolved);
  const lit = flashing && resolved === text.length ? Math.min(flashChars, done.length) : 0;
  return (
    <span data-part={part} className={className} style={{ color }}>
      {done.slice(0, done.length - lit)}
      {lit > 0 && <span data-flash="on" style={{ color: FLASH_HEX }}>{done.slice(done.length - lit)}</span>}
      {pending && <span data-resolved="no" style={{ color: MUTED }}>{pending}</span>}
    </span>
  );
}

export default function AccordReveal({
  formula, aeadBytes, onDone,
  now = () => performance.now(),
  raf = (cb) => requestAnimationFrame(cb),
  cancelRaf = (id) => cancelAnimationFrame(id),
}) {
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const reveal = useMemo(() => buildReveal({ formula, aeadBytes, reducedMotion }), [formula, aeadBytes, reducedMotion]);
  const [t, setT] = useState(0);
  const skipped = useRef(false);
  const holdTimer = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const start = now();
    let id = null;
    let finished = false;
    const tick = () => {
      const tt = skipped.current ? Infinity : now() - start;
      setT(tt);
      if (tt >= reveal.totalMs) {
        if (!finished) { finished = true; doneRef.current?.(); }
        return;
      }
      id = raf(tick);
    };
    id = raf(tick);
    return () => { if (id != null) cancelRaf(id); };
    // now/raf/cancelRaf are injected for tests and stable for the component's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') skipped.current = true; };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(holdTimer.current); };
  }, []);

  const startHold = () => {
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => { skipped.current = true; }, SKIP_HOLD_MS);
  };
  const endHold = () => clearTimeout(holdTimer.current);

  const frame = frameAt(reveal, t);
  const visible = reveal.steps.filter((s) => frame.get(s).shown);
  const announce = [...visible].reverse().find((s) => s.kind === 'note' || s.kind === 'stage' || (s.kind === 'mod' && !reveal.steps.some((x) => x.kind === 'stage' && x.at >= s.at)));

  return (
    <div data-testid="accord-reveal" className="py-4 font-mono text-[10px] leading-relaxed select-none"
      onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold}>
      <div aria-live="polite" className="sr-only">{announce?.text ?? ''}</div>
      {visible.map((s, i) => {
        const key = `${s.kind}-${i}`;
        if (s.kind === 'header') {
          return <div key={key} data-testid="reveal-header" className="tracking-[0.2em] mb-2" style={{ color: MUTED }}>{s.text}</div>;
        }
        if (s.kind === 'stage') {
          const gold = /FORMULA/.test(s.text);
          return <div key={key} className="tracking-[0.25em] uppercase mt-1 mb-1" style={{ color: gold ? GOLD_HEX : ASH }}>✓ {s.text}</div>;
        }
        if (s.kind === 'note') {
          return <div key={key} className="font-sans text-[11px] mt-2 lowercase" style={{ color: LAYER_HEX[s.layer] ?? ASH }}>· {s.text}</div>;
        }
        if (s.kind === 'ref') {
          return <div key={key} className="pl-3" style={{ color: MUTED }}>{s.text}</div>;
        }
        if (s.kind === 'mod') {
          return <div key={key} className="mt-0.5" style={{ color: ASH }}>{s.text}</div>;
        }
        const f = frame.get(s);
        const color = LAYER_HEX[s.layer] ?? ASH;
        const nameRes = Math.min(f.resolvedChars, s.name.length);
        const valueRes = Math.max(0, f.resolvedChars - s.name.length);
        return (
          <div key={key} data-testid="reveal-row" data-material={s.materialId} data-layer={s.layer} className="pl-3">
            <div className="flex items-baseline min-w-0">
              <Part part="name" className="truncate min-w-0" color={color}
                text={f.chars.slice(0, s.name.length)} resolved={nameRes} />
              <span data-part="leader" aria-hidden="true" className="flex-1 border-b border-dotted mx-1 min-w-[1rem]" style={{ borderColor: MUTED }} />
              <Part part="grams" className="whitespace-nowrap shrink-0" color={color}
                text={f.chars.slice(s.name.length)} resolved={valueRes}
                flashChars={s.flashChars} flashing={f.flashing} />
            </div>
            <div data-part="meta" className="text-[8px]" style={{ color: MUTED }}>CAS {s.cas} · {stockText(s.stock)}</div>
          </div>
        );
      })}
    </div>
  );
}
