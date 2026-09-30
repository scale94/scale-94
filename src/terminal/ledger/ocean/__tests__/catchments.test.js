import { describe, it, expect } from 'vitest';
import { CATCHMENTS, catchmentTarget } from '../catchments';
import { CATALOG } from '../riverCatalog';
import { RIVERS } from '../riverCourses';

// [name, lon, lat, ring key]
const ROUTES = [
  ['Berlin', 13.405, 52.52, 'elbe'], ['Prague', 14.42, 50.08, 'elbe'], ['Hamburg', 10.0, 53.55, 'elbe'], ['Dresden', 13.74, 51.05, 'elbe'],
  ['Manaus', -60.0217, -3.119, 'amazon'], ['Iquitos', -73.25, -3.75, 'amazon'], ['Santarem', -54.7, -2.44, 'amazon'],
  ['Kinshasa', 15.3, -4.32, 'congo'], ['Kisangani', 25.2, 0.5, 'congo'], ['Lubumbashi', 27.5, -11.66, 'congo'],
  ['Cairo', 31.24, 30.04, 'nile'], ['Khartoum', 32.53, 15.5, 'nile'], ['Kampala', 32.58, 0.35, 'nile'], ['Bahir Dar', 37.39, 11.6, 'nile'], ['Aswan', 32.9, 24.09, 'nile'],
  ['Bamako', -8.0, 12.64, 'niger'], ['Niamey', 2.11, 13.51, 'niger'], ['Abuja', 7.5, 9.08, 'niger'],
  ['Montreal', -73.57, 45.5, 'stlawrence'], ['Toronto', -79.38, 43.65, 'stlawrence'], ['Quebec', -71.2, 46.8, 'stlawrence'], ['Thunder Bay', -89.25, 48.38, 'stlawrence'], ['Duluth', -92.1, 46.78, 'stlawrence'], ['Milwaukee', -87.9, 43.04, 'stlawrence'],
  ['Yakutsk', 129.73, 62.03, 'lena'],
  ['Krasnoyarsk', 92.87, 56.01, 'yenisey'], ['Ulaanbaatar', 106.9, 47.9, 'yenisey'], ['Irkutsk', 104.28, 52.29, 'yenisey'],
  ['Phnom Penh', 104.92, 11.56, 'mekong'], ['Vientiane', 102.6, 17.97, 'mekong'],
  ['Lanzhou', 103.8, 36.06, 'yellow'], ['Zhengzhou', 113.65, 34.75, 'yellow'], ['Xi\'an', 108.94, 34.34, 'yellow'], ['Taiyuan', 112.55, 37.87, 'yellow'],
  ['Lahore', 74.35, 31.55, 'indus'], ['Karachi', 67.0, 24.86, 'indus'], ['Islamabad', 73.05, 33.68, 'indus'], ['Kabul', 69.2, 34.5, 'indus'],
  ['Asuncion', -57.6, -25.3, 'parana'], ['Sao Paulo', -46.63, -23.55, 'parana'], ['Buenos Aires', -58.5, -34.5, 'parana'], ['Cuiaba', -56.1, -15.6, 'parana'], ['Montevideo', -56.2, -34.85, 'parana'],
  ['Cologne', 6.96, 50.94, 'rhine'], ['Frankfurt', 8.68, 50.11, 'rhine'], ['Basel', 7.59, 47.56, 'rhine'], ['Stuttgart', 9.18, 48.78, 'rhine'], ['Nuremberg', 11.08, 49.45, 'rhine'],
  ['Konstanz', 9.18, 47.66, 'rhine'], ['Friedrichshafen', 9.48, 47.65, 'rhine'], ['Bregenz', 9.75, 47.5, 'rhine'], ['Lindau', 9.68, 47.55, 'rhine'], ['Zurich', 8.54, 47.37, 'rhine'], ['Chur', 9.53, 46.85, 'rhine'], ['Vaduz', 9.52, 47.14, 'rhine'],
  ['Vienna', 16.37, 48.21, 'danube'], ['Linz', 14.29, 48.31, 'danube'], ['Budapest', 19.04, 47.5, 'danube'], ['Belgrade', 20.46, 44.79, 'danube'], ['Munich', 11.58, 48.14, 'danube'], ['Bucharest', 26.1, 44.43, 'danube'], ['Zagreb', 15.98, 45.81, 'danube'],
  ['New Orleans', -90.07, 29.95, 'mississippi'], ['St Louis', -90.2, 38.63, 'mississippi'], ['Minneapolis', -93.27, 44.98, 'mississippi'], ['Pittsburgh', -80, 40.44, 'mississippi'], ['Memphis', -90.05, 35.15, 'mississippi'], ['Nashville', -86.78, 36.16, 'mississippi'],
  ['Wuhan', 114.3, 30.59, 'yangtze'], ['Shanghai', 121.47, 31.23, 'yangtze'], ['Chongqing', 106.55, 29.56, 'yangtze'], ['Chengdu', 104.07, 30.67, 'yangtze'], ['Nanjing', 118.8, 32.06, 'yangtze'], ['Kunming', 102.7, 25.0, 'yangtze'],
  ['Delhi', 77.2, 28.6, 'ganges'], ['Varanasi', 83.0, 25.3, 'ganges'], ['Dhaka', 90.4, 23.8, 'ganges'], ['Guwahati', 91.75, 26.14, 'ganges'], ['Lhasa', 91.1, 29.65, 'ganges'], ['Kolkata', 88.36, 22.57, 'ganges'],
];

// Outside every ring: today's nearest-ocean snap applies.
const OUTSIDE = [
  ['Suez', 32.55, 29.97], ['Arkhangelsk', 40.54, 64.54], ['Lyon', 4.83, 45.76], ['Warsaw', 21.0, 52.23],
  ['Sahara', 10, 25], ['Antarctica', 0, -80], ['mid-Atlantic', -30, 0], ['Oslo', 10.75, 59.9],
  ['Krakow', 19.9, 50.06], ['Paris', 2.35, 48.85], ['Houston', -95.4, 29.76], ['Hong Kong', 114.17, 22.3],
  ['Ouagadougou', -1.52, 12.37], ['Porto Alegre', -51.2, -30.03],
];

describe('catchmentTarget', () => {
  it.each(ROUTES)('%s routes to the %s ring', (name, lon, lat, key) => {
    const t = catchmentTarget(lon, lat);
    expect(t, name).not.toBeNull();
    expect(t.key, name).toBe(key);
    expect(t.outfall).toHaveLength(2);
  });

  it.each(OUTSIDE)('%s is outside every catchment', (name, lon, lat) => {
    expect(catchmentTarget(lon, lat), name).toBeNull();
  });

  it('routes Berlin to the Elbe outfall, not the Baltic', () => {
    const t = catchmentTarget(13.405, 52.52);
    expect(t.sourceId).toBe('catalog:elbe');
    expect(t.outfall).toEqual(CATALOG.elbe.outfall);
  });

  it('routes the Rhine, Danube, Mississippi, Yangtze and Ganges rings to the existing preset outfalls', () => {
    const want = { rhine: 'germany', danube: 'danube', mississippi: 'usa', yangtze: 'yangtze', ganges: 'ganges' };
    for (const [ring, preset] of Object.entries(want)) {
      const c = CATCHMENTS.find((x) => x.key === ring);
      expect(c.outfalls).toEqual([`preset:${preset}`]);
    }
    const t = catchmentTarget(6.96, 50.94);
    expect(t.sourceId).toBe('preset:germany');
    expect(t.outfall).toEqual(RIVERS.germany.course.at(-1));
  });

  it('sends the Nile to the nearer of its two mouths', () => {
    expect(catchmentTarget(30.3, 30.5).sourceId).toBe('catalog:nile_rosetta');
    expect(catchmentTarget(32.1, 30.5).sourceId).toBe('catalog:nile_damietta');
  });

  it('returns null for non-finite input', () => {
    for (const bad of [[NaN, 10], [10, NaN], [undefined, 10], [10, null]]) {
      expect(catchmentTarget(...bad)).toBeNull();
    }
  });
});

describe('CATCHMENTS data', () => {
  it('has 17 well-formed rings, none crossing the antimeridian', () => {
    expect(CATCHMENTS).toHaveLength(17);
    expect(new Set(CATCHMENTS.map((c) => c.key)).size).toBe(17);
    for (const c of CATCHMENTS) {
      expect(c.ring.length, c.key).toBeGreaterThanOrEqual(3);
      expect(c.sources.ring.startsWith('UNVERIFIED'), c.key).toBe(true);
      for (let p = 0; p < c.ring.length; p++) {
        const [lon, lat] = c.ring[p];
        expect(Number.isFinite(lon) && Number.isFinite(lat), c.key).toBe(true);
        expect(Math.abs(lon) <= 180 && Math.abs(lat) <= 90, c.key).toBe(true);
        const [plon] = c.ring[(p + c.ring.length - 1) % c.ring.length];
        expect(Math.abs(lon - plon), c.key).toBeLessThanOrEqual(180);
      }
    }
  });

  it('routes every catalog river from some ring, and every outfall id resolves', () => {
    const listed = new Set(CATCHMENTS.flatMap((c) => c.outfalls));
    for (const key of Object.keys(CATALOG)) expect(listed.has(`catalog:${key}`), key).toBe(true);
    for (const id of listed) {
      const [kind, key] = id.split(':');
      expect(kind === 'catalog' ? CATALOG[key] : RIVERS[key], id).toBeTruthy();
    }
  });

  it('has no overlapping rings (exact: no proper edge crossing, no vertex strictly inside another ring)', () => {
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const properCross = (p1, p2, p3, p4) => {
      const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2), d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
      return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    };
    const onSeg = (p, a, b) => cross(a, b, p) === 0
      && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
      && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
    const onBoundary = (p, r) => r.some((a, i) => onSeg(p, a, r[(i + 1) % r.length]));
    const inside = (p, r) => {
      let c = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const bbox = (r) => [Math.min(...r.map((p) => p[0])), Math.min(...r.map((p) => p[1])), Math.max(...r.map((p) => p[0])), Math.max(...r.map((p) => p[1]))];
    const boxes = CATCHMENTS.map((c) => bbox(c.ring));
    const problems = [];
    for (let a = 0; a < CATCHMENTS.length; a++) {
      for (let b = a + 1; b < CATCHMENTS.length; b++) {
        const A = boxes[a], B = boxes[b];
        if (A[2] < B[0] || B[2] < A[0] || A[3] < B[1] || B[3] < A[1]) continue;
        const ra = CATCHMENTS[a].ring, rb = CATCHMENTS[b].ring;
        const tag = `${CATCHMENTS[a].key}/${CATCHMENTS[b].key}`;
        for (let i = 0; i < ra.length; i++) {
          for (let j = 0; j < rb.length; j++) {
            if (properCross(ra[i], ra[(i + 1) % ra.length], rb[j], rb[(j + 1) % rb.length])) problems.push(`${tag}: edges cross at ${i},${j}`);
          }
        }
        for (const p of ra) if (!onBoundary(p, rb) && inside(p, rb)) problems.push(`${tag}: ${p} inside ${CATCHMENTS[b].key}`);
        for (const p of rb) if (!onBoundary(p, ra) && inside(p, ra)) problems.push(`${tag}: ${p} inside ${CATCHMENTS[a].key}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
