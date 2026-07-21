import './SeraphineScale.css';

const MAX_TILT_DEG = 10;

export default function SeraphineScale({ deadFrac = 0, bloomFrac = 0 }) {
  const tilt  = Math.min(Math.max(deadFrac, 0), 1);   // == max(0,-vitality), capped
  const grace = Math.min(Math.max(bloomFrac, 0), 1);
  const showEye = grace > 0.02;

  // Beam base green lifts toward superbloom green as grace rises.
  const beamStroke = grace > 0 ? '#7fe08a' : '#7ab800';

  return (
    <div className="ss-overlay">
      {/* whisper of halo, behind the Eye */}
      {showEye && <div className="ss-halo" style={{ opacity: grace }} />}

      {/* the Eye — mounts only during bloom */}
      {showEye && (
        <div className="ss-eye" data-testid="seraphine-eye" style={{ opacity: Math.min(grace * 1.5, 1) }}>
          <svg viewBox="0 0 64 40">
            <ellipse cx="32" cy="20" rx="24" ry="13" fill="none" stroke="#3a5a08" strokeWidth="1" />
            <circle className="ss-iris" cx="32" cy="20" r="6.5" style={{ transform: `scale(${0.5 + grace * 0.5})` }} />
            {/* lid retracts (scaleY → 0) as grace opens the eye */}
            <rect className="ss-lid" x="6" y="5" width="52" height="30" style={{ transform: `scaleY(${1 - Math.min(grace, 1)})` }} />
          </svg>
        </div>
      )}

      {/* the beam — one composited rotation; cradles the sphere base */}
      <div className="ss-beam" data-testid="seraphine-beam" style={{ transform: `translateX(-50%) rotate(${tilt * MAX_TILT_DEG}deg)` }}>
        <svg viewBox="0 0 400 40">
          <path d="M 10 12 Q 200 34 390 12" fill="none" stroke={beamStroke} strokeWidth="2" style={{ transition: 'stroke .6s ease' }} />
          <polygon points="192,34 208,34 200,22" fill="#3a5008" />
        </svg>
      </div>
    </div>
  );
}
