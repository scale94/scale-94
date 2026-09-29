// riverCourses.js — river stage data for the audit presets: course from the
// audit site to the mouth, mean discharge at the mouth, and reach-averaged
// Manning parameters. Keyed by AUDIT_PRESETS key; auditPresets.js itself is
// untouched. Every number carries a source note or the literal UNVERIFIED.
// Courses are city/landmark waypoints, not surveyed thalwegs.

export const RIVERS = {
  mercury: {
    course: [[20.0088, 39.9269], [20.0311, 39.8439]],
    dischargeM3s: 50,
    manning: { n: 0.035, R: 1.5, S: 0.001 },
    sources: {
      course: 'Blue Eye spring → Bistricë mouth 39°50′38″N 20°1′52″E (Wikipedia, "Bistrica (Ionian Sea)"); straight site→mouth approximation, not traced',
      dischargeM3s: 'Bistricë 40.4–66.4 m³/s seasonal (Wikipedia); 50 used as a representative mean',
      manning: 'UNVERIFIED — assumed small spring-fed river values (n 0.035, R 1.5 m, S 1e-3)',
    },
  },
  germany: {
    course: [
      [6.9603, 50.9375], [6.7735, 51.2277], [6.7623, 51.4344], [6.6178, 51.6587],
      [6.2458, 51.8318], [5.8625, 51.8475], [5.4292, 51.8867], [4.9742, 51.8306],
      [4.6901, 51.8133], [4.4792, 51.9225], [4.1333, 51.9775],
    ],
    dischargeM3s: 2290,
    manning: { n: 0.03, R: 5, S: 0.0001 },
    sources: {
      course: 'Cologne → Düsseldorf → Duisburg → Wesel → Emmerich → Nijmegen (Waal) → Tiel → Gorinchem → Dordrecht → Rotterdam → Hook of Holland; city coordinates',
      dischargeM3s: 'Rhine annual mean 2,290 m³/s approaching the Dutch border (Wikipedia, "Rhine"); delta distributary split ignored',
      manning: 'UNVERIFIED — assumed large regulated river values (n 0.03, R 5 m, S 1e-4)',
    },
  },
  usa: {
    course: [
      [-90.0715, 29.9511], [-89.9906, 29.8547], [-89.8006, 29.5783],
      [-89.6937, 29.4805], [-89.3542, 29.2766], [-89.25, 29.15],
    ],
    dischargeM3s: 16570,
    manning: { n: 0.025, R: 15, S: 0.00002 },
    sources: {
      course: 'New Orleans → Belle Chasse → Pointe à la Hache → Port Sulphur → Venice → Head of Passes; town coordinates',
      dischargeM3s: 'Mississippi at Baton Rouge 16,570 m³/s, 2004–2022 (Wikipedia, "Mississippi River"); main stem after the Atchafalaya diversion',
      manning: 'UNVERIFIED — assumed lower-Mississippi values (n 0.025, R 15 m, S 2e-5)',
    },
  },
  brazil: {
    course: [[-39.74, -19.78], [-39.8147, -19.6558]],
    dischargeM3s: 793.7,
    manning: { n: 0.03, R: 3, S: 0.0002 },
    sources: {
      course: 'Regência audit site → Rio Doce mouth 19°39′21″S 39°48′53″W (Wikipedia, "Doce River"); straight approximation',
      dischargeM3s: 'Rio Doce basin mean 793.7 m³/s (Atlas Digital das Águas de Minas, UFV)',
      manning: 'UNVERIFIED — assumed sandy estuarine reach values (n 0.03, R 3 m, S 2e-4)',
    },
  },
  north_korea: {
    course: [[127.535, 39.9186], [127.6, 39.8]],
    dischargeM3s: 100,
    manning: { n: 0.035, R: 2, S: 0.0005 },
    sources: {
      course: 'UNVERIFIED — Hamhung → Songchon delta near Hungnam, approximate; no public survey',
      dischargeM3s: 'UNVERIFIED — no public discharge data for the Songchon; order-of-magnitude assumption',
      manning: 'UNVERIFIED — assumed short industrial river values (n 0.035, R 2 m, S 5e-4)',
    },
  },
};
