// riverCourses.js — river stage data for the audit presets: course from the
// audit site to the mouth, mean discharge at the mouth, and reach-averaged
// Manning parameters. Keyed by ALL_AUDIT_PRESETS key; auditPresets.js itself is
// untouched. Every number carries a source note or the literal UNVERIFIED.
// Courses are city/landmark waypoints, not surveyed thalwegs.
// An optional riverKm (sourced channel length, site → sea) overrides the polyline for travel time and river km.

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
  yangtze: {
    course: [[121.515, 31.3925], [121.9831, 31.3936]],
    dischargeM3s: 31550,
    manning: { n: 0.025, R: 10, S: 0.00001 },
    sources: {
      course: 'Wusongkou site = Huangpu mouth 31°23′33″N 121°30′54″E, Baoshan, Shanghai (Wikipedia, "Huangpu River", https://en.wikipedia.org/wiki/Huangpu_River, retrieved 2026-09-30) → Yangtze mouth 31°23′37″N 121°58′59″E (Wikipedia, "Yangtze", https://en.wikipedia.org/wiki/Yangtze, retrieved 2026-09-30); straight site→mouth approximation, South Channel not traced',
      dischargeM3s: 'Yangtze estuary (Shanghai) mean 31,550 m³/s, 1955–2021 (Wikipedia, "Yangtze" infobox, https://en.wikipedia.org/wiki/Yangtze, retrieved 2026-09-30); Datong gauge 28,700 m³/s 1980–2020 in the same infobox',
      manning: 'UNVERIFIED — assumed tidal lower-Yangtze values (n 0.025, R 10 m, S 1e-5)',
    },
  },
  ganges: {
    course: [[90.6304, 23.2198], [90.72, 22.95], [90.8, 22.6], [90.8597, 22.013]],
    dischargeM3s: 40974,
    manning: { n: 0.025, R: 12, S: 0.00002 },
    sources: {
      course: 'UNVERIFIED — the two interior waypoints (90.72°E 22.95°N, 90.8°E 22.6°N) are approximations. Site = Lower Meghna source at the Padma confluence 23°13′11″N 90°37′50″E, "The Meghna meets its major tributary, the Padma, in Chandpur District" → Lower Meghna mouth 22°0′47″N 90°51′35″E (Wikipedia, "Meghna River", https://en.wikipedia.org/wiki/Meghna_River, retrieved 2026-09-30)',
      dischargeM3s: 'Lower Meghna near mouth mean 40,974 m³/s, 1971–2000 — the combined Ganges (Padma) + Brahmaputra + Upper Meghna flow below Chandpur; 40,533 m³/s at Chandpur (Wikipedia, "Meghna River" infobox citing riversnetwork.org "Ganga (Ganges)-Brahmaputra", https://en.wikipedia.org/wiki/Meghna_River, retrieved 2026-09-30)',
      manning: 'UNVERIFIED — assumed large deltaic channel values (n 0.025, R 12 m, S 2e-5)',
    },
  },
  citarum: {
    course: [[107.1535, -6.0556], [106.9877, -5.9413]],
    dischargeM3s: 423,
    manning: { n: 0.035, R: 2, S: 0.0003 },
    sources: {
      course: 'Site = Batujaya 6°03′20″S 107°09′13″E, ~500 m from the Citarum (Wikipedia Indonesia, "Situs Batujaya", https://id.wikipedia.org/wiki/Situs_Batujaya, retrieved 2026-09-30) → mouth at Muaragembong 5°56′29″S 106°59′16″E (Wikipedia, "Citarum River", https://en.wikipedia.org/wiki/Citarum_River, retrieved 2026-09-30); straight approximation, meanders not traced',
      dischargeM3s: 'Citarum mean 423 m³/s near the mouth (Wikipedia, "Citarum River" infobox, https://en.wikipedia.org/wiki/Citarum_River, retrieved 2026-09-30); no period stated',
      manning: 'UNVERIFIED — assumed small lowland river values (n 0.035, R 2 m, S 3e-4)',
    },
  },
  danube: {
    course: [
      [14.29, 48.31], [16.3738, 48.2082], [17.1077, 48.1486], [18.12, 47.76], [19.0402, 47.4979],
      [18.68, 45.99], [19.0, 45.35], [19.8335, 45.2671], [20.4489, 44.7866], [22.6567, 44.6319],
      [22.8826, 43.9962], [25.9657, 43.8356], [27.26, 44.1171], [27.9575, 45.2692], [28.008, 45.4353],
      [28.8051, 45.1716], [29.6533, 45.1553], [29.75, 45.15],
    ],
    riverKm: 2135.2,
    dischargeM3s: 6452,
    manning: { n: 0.03, R: 5, S: 0.000125 },
    sources: {
      course: 'UNVERIFIED — city waypoint coordinates other than Linz are planner approximations. Linz 48°18′21″N 14°17′11″E (Wikipedia, "Linz", https://en.wikipedia.org/wiki/Linz, retrieved 2026-09-30); Linz → Vienna → Bratislava → Komárno → Budapest → Mohács → Vukovar → Novi Sad → Belgrade → Drobeta-Turnu Severin → Vidin → Ruse → Silistra → Brăila → Galați → Tulcea → Sulina',
      riverKm: 'Linz city centre: Schiffsanlegestelle Linz-Nibelungen Nr. 12, in front of the Nibelungenbrücke, Strom-km 2135.2 (Oberösterreich Tourismus, "Schiffsanlegestelle Linz-Nibelungen Nr. 12", https://www.oberoesterreich.at/oesterreich-poi/detail/430002006/schiffsanlegestelle-linz-nibelungen-nr-12.html, retrieved 2026-09-30); Linz-Schloss Nr. 11 at Strom-km 2135.3 agrees; km counted upstream from km 0 at the old Sulina lighthouse (Wikipedia DE, "Donau", https://de.wikipedia.org/wiki/Donau, retrieved 2026-09-30)',
      dischargeM3s: 'Danube mean 6,452 m³/s at the delta, 1931–2020 (Wikipedia, "Danube" infobox, https://en.wikipedia.org/wiki/Danube, retrieved 2026-09-30)',
      manning: 'UNVERIFIED — assumed large regulated river values (n 0.03, R 5 m); S 1.25e-4 = Linz elevation 266 m (Wikipedia, "Linz", https://en.wikipedia.org/wiki/Linz, retrieved 2026-09-30; city elevation, not the water surface) ÷ 2135.2 km to sea level',
    },
  },
};
