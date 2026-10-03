// slowNoonDialGeometry — THE SLOW NOON dial's coordinate maps (split from SlowNoonDial.jsx so the
// component file exports only a component, keeping react-refresh quiet).

export const DIAL = Object.freeze({ c: 150, ring: 140, label: 128, rIn: 40, rSpan: 95, rMinAU: 0.30, rMaxAU: 0.47 });
export const LOUPE = Object.freeze({ x: 248, y: 246, r: 44, degPx: 22, auPx: 1500 });

const angle = (hour) => (hour / 24) * 2 * Math.PI + Math.PI / 2;
const wrap12 = (h) => h - 24 * Math.floor((h + 12) / 24);

export function ringXY(hour, R) {
  return [DIAL.c + R * Math.cos(angle(hour)), DIAL.c + R * Math.sin(angle(hour))];
}

export function dialXY(hour, rAU) {
  const R = DIAL.rIn + ((rAU - DIAL.rMinAU) / (DIAL.rMaxAU - DIAL.rMinAU)) * DIAL.rSpan;
  return ringXY(hour, R);
}

export function loupeXY(p, peri) {
  return [LOUPE.x + wrap12(p.hour - peri.hour) * 15 * LOUPE.degPx, LOUPE.y - (p.rAU - peri.rAU) * LOUPE.auPx];
}
