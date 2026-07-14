// src/terminal/mercury/ElementSeal.jsx — one element's living core (spec §5).
// Dry = mineral stillness: pure CSS, zero GPU. Wet = the eye's nebula in the
// house hue. Armed wet seals constrict toward miosis; holdProgress (0..1)
// drives the constriction the rest of the way under the visitor's finger.
import ObserverEye from '../components/ObserverEye';

export default function ElementSeal({ wet, tint, armed = false, holdProgress = 0, size = 72 }) {
  if (!wet) {
    return (
      <div
        aria-hidden="true"
        className="mx-auto rounded-full"
        style={{
          width: size, height: size,
          background: 'radial-gradient(circle at 38% 32%, #3f3f46 0%, #27272a 45%, #18181b 80%)',
          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.8)',
          opacity: 0.55,
        }}
      />
    );
  }
  return (
    <div className="mx-auto" style={{ width: size, height: size }}>
      <ObserverEye
        lens={false}
        state="leaning"
        tint={tint}
        pulse={armed}
        constrict={armed ? Math.max(0.58, 0.58 + 0.42 * holdProgress) : null}
        size={size}
      />
    </div>
  );
}
