// Pure geometry for the Council Ring. Angles in degrees, clockwise from 12
// o'clock (top = 0°). SVG y grows downward.

const HEMISPHERE_SEATS = 8;
const SEAT_SPACING = 20; // 8 seats × 20° = 160° arc, centered in each hemisphere

// Western hemisphere (canon): centered on 270° (9 o'clock).
// Eastern hemisphere (sidelined): centered on 90° (3 o'clock).
const WEST_CENTER = 270;
const EAST_CENTER = 90;

export function seatAngle(seatInHemisphere, caste) {
  const center = caste === 'canon' ? WEST_CENTER : EAST_CENTER;
  // Distribute seats symmetrically around the hemisphere center.
  const offset = (seatInHemisphere - (HEMISPHERE_SEATS - 1) / 2) * SEAT_SPACING;
  return center + offset;
}

export function polarToXY(angleDeg, radius, cx, cy) {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // -90 so 0° points up
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function angularDistance(a, b) {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return Math.min(d, 360 - d);
}

export function angleToNearestSeatIndex(rotationDeg, seatAngles) {
  let best = 0;
  let bestDist = Infinity;
  seatAngles.forEach((seat, i) => {
    const effective = ((seat + rotationDeg) % 360 + 360) % 360;
    const dist = angularDistance(effective, 0);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}
