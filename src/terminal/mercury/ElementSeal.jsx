// src/terminal/mercury/ElementSeal.jsx — one element's living core (spec §5).
// Dry = mineral stillness: pure CSS, zero GPU. Wet = the eye's nebula in the
// house hue. Armed wet seals constrict toward miosis; holdProgress (0..1)
// drives the constriction the rest of the way under the visitor's finger.
//
// A dry seal still wears a hairline of its house hue (hue spec §3). Four
// identical grey spheres taught nothing: FIRE *is* the art house, EARTH *is*
// ecocide, and that mapping is the altar's keystone — it cannot only become
// visible after you have already walked there. The rim is one CSS border; dry
// stays mineral, stays zero-GPU.
import ObserverEye from '../components/ObserverEye';
import { useInViewport } from './useInViewport';

export default function ElementSeal({ wet, tint, armed = false, holdProgress = 0, size = 72 }) {
  const [ref, inView] = useInViewport();
  if (!wet) {
    return (
      <div
        aria-hidden="true"
        className="mx-auto rounded-full"
        style={{
          width: size, height: size,
          background: 'radial-gradient(circle at 38% 32%, #3f3f46 0%, #27272a 45%, #18181b 80%)',
          border: `1px solid rgba(${tint[0]},${tint[1]},${tint[2]},0.25)`,
          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.8)',
          opacity: 0.55,
        }}
      />
    );
  }
  return (
    <div ref={ref} className="mx-auto" style={{ width: size, height: size }}>
      {inView ? (
        <ObserverEye lens={false} state="leaning" tint={tint} pulse={armed}
          constrict={armed ? Math.max(0.58, 0.58 + 0.42 * holdProgress) : null} size={size} />
      ) : (
        <div aria-hidden="true" className="rounded-full" style={{
          width: size, height: size,
          background: `radial-gradient(circle at 42% 36%, rgba(${tint[0]},${tint[1]},${tint[2]},0.5) 0%, rgba(${tint[0]},${tint[1]},${tint[2]},0.15) 55%, transparent 80%)`,
        }} />
      )}
    </div>
  );
}
