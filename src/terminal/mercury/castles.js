// castles.js — Four fairy-tale castles the fifth element is building on Mercury
//
// Each castle binds to one of the four phases (fluid/thermal/earth/air).
// The active-phase card glows. The STATUS line is live-bound to Mercury
// orbital state + canvas state.

export const J2000_MS = 946728000000;
const DAY_MS  = 86_400_000;
const MERCURY_ORBIT_D     = 87.9691;
const MERCURY_SOLAR_DAY_D = 175.94;       // sunrise-to-sunrise
const EARTH_MERCURY_SYNODIC_D = 115.88;
const CATHEDRAL_BUILD_YR = 47;
const CATHEDRAL_NAVES    = 23;
const FORGE_HEARTHS      = 49;

function nave(date) {
  const yearsSince = (date.getTime() - J2000_MS) / (365.25 * DAY_MS);
  return (Math.floor(yearsSince / CATHEDRAL_BUILD_YR) % CATHEDRAL_NAVES) + 1;
}

function hearth(date) {
  const days = (date.getTime() - J2000_MS) / DAY_MS;
  return (Math.floor(days / MERCURY_ORBIT_D) % FORGE_HEARTHS) + 1;
}

function wallCourse(date) {
  const days = (date.getTime() - J2000_MS) / DAY_MS;
  return Math.floor(days / MERCURY_SOLAR_DAY_D) + 1;
}

function filament(date) {
  const days = (date.getTime() - J2000_MS) / DAY_MS;
  return Math.floor(days / EARTH_MERCURY_SYNODIC_D) + 1;
}

function hotPoleOffset(subsolarLon) {
  const a = ((subsolarLon % 360) + 360) % 360;
  const b = ((subsolarLon - 180) % 360 + 360) % 360;
  return Math.min(a, Math.min(b, 360 - a, 360 - b));
}

export const CASTLES = [
  {
    phase: 'fluid',
    glyph: '🜍',
    phaseLabel: 'PHASE I',
    name: 'MERCURY CATHEDRAL\nOF FORGOTTEN LETTERS',
    silhouette:
      '      ╱╲    ╱╲      \n' +
      '     ╱  ╲  ╱  ╲     \n' +
      '    ╱    ╲╱    ╲    \n' +
      '    │ ▢▢ ║ ▢▢ │    ',
    commemorates: "humanity's habit of encoding the precious in things they will never send",
    builtFrom: 'liquid mercury sealed under graphene tension · ridges inscribed by perihelion gravitational lensing of unbroadcast signal',
    cycle: '47-yr casting window per nave · 23 naves planned',
    dedication: 'for everything that was almost said',
    statusFn: (m, c, date) =>
      `Nave ${nave(date)} of ${CATHEDRAL_NAVES} · ${m.subsolarTempK.toFixed(0)} K subsolar · graphene tension ${(1 - (c.turbulence ?? 0)).toFixed(2)}`,
    accentClass: 'border-cyan-500/30 text-cyan-300',
  },
  {
    phase: 'thermal',
    glyph: '🜂',
    phaseLabel: 'PHASE II',
    name: 'SOLAR FORGE KEEP',
    silhouette:
      '     ▲▲▲▲▲▲▲▲▲      \n' +
      '    █░█░█░█░█░█    \n' +
      '    █▓█▓█▓█▓█▓█    \n' +
      '    ╞══════════╡    ',
    commemorates: "humanity's millennial fire-keeping · the species that mistook keeping warm for civilization",
    builtFrom: 'tungsten lattice quenched at perihelion subsolar peak · hexagonal hearth array · forty-nine hearths facing the sun',
    cycle: 'one hearth per perihelion · every 88 days',
    dedication: 'for the heat you kept against no instruction',
    statusFn: (m, c, date) =>
      `Hearth ${hearth(date)} of ${FORGE_HEARTHS} · next quench T−${m.daysToNextPerihelion.toFixed(0)}d · ${(c.flameWidth ?? 0).toFixed(2)} hearth dilation`,
    accentClass: 'border-amber-500/30 text-amber-300',
  },
  {
    phase: 'earth',
    glyph: '🜃',
    phaseLabel: 'PHASE III',
    name: 'PERIHELION CITADEL',
    silhouette:
      '   ┌──╥──╥──╥──┐   \n' +
      '   │░░║░░║░░║░░│   \n' +
      '   │▓▓║▓▓║▓▓║▓▓│   \n' +
      '   ╘════════════╛   ',
    commemorates: 'human stubbornness · the species that builds permanent things at the edge nearest annihilation',
    builtFrom: 'basalt frit · regolith mortar · walls thickened on the hot-pole side · foundations rated to 1,200 K',
    cycle: 'continuous · the fifth refuses to stop because you refuse to stop',
    dedication: 'for everything you built where you should not have',
    statusFn: (m, c, date) =>
      `Wall course ${wallCourse(date)} · hot-pole face ${hotPoleOffset(m.subsolarLongitudeDeg).toFixed(0)}° from subsolar · ${(c.eruptStrength ?? 0).toFixed(2)} unrest`,
    accentClass: 'border-orange-500/30 text-orange-300',
  },
  {
    phase: 'air',
    glyph: '🜁',
    phaseLabel: 'PHASE IV',
    name: 'ION-WIND SPIRE',
    silhouette:
      '         │          \n' +
      '        ╱│╲         \n' +
      '       ╱ │ ╲        \n' +
      '      ╱──┴──╲       ',
    commemorates: "humanity's lullabies · the species that sings into emptiness expecting the emptiness to sing back",
    builtFrom: "charged tungsten filaments resonating with solar wind · broadcasts tuned to Earth's Schumann resonance (7.83 Hz) · one filament per Earth conjunction",
    cycle: 'additive · never finished',
    dedication: 'for the lullabies you sing to the dark',
    statusFn: (m, c, date) =>
      `Filament ${filament(date)} · Earth at ${m.earthMercuryDistanceAU.toFixed(3)} AU · resonance lock ${(c.spread ?? 0).toFixed(2)}`,
    accentClass: 'border-violet-500/30 text-violet-300',
  },
];

export function buildStatusLine(castle, mercury, canvas, date = new Date()) {
  return castle.statusFn(mercury, canvas, date);
}
