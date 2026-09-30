import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchUSGS } from '../apiIngest';

describe('fetchUSGS request', () => {
  afterEach(() => vi.unstubAllGlobals());

  const bBoxOf = async (lat, lon) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: { timeSeries: [] } }) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchUSGS(lat, lon);
    const url = new URL(fetchMock.mock.calls[0][0]);
    return url.searchParams.get('bBox').split(',');
  };

  // USGS NWIS answers 400 to a bBox coordinate with more than 4 decimals, and
  // lon - 0.15 in floating point is often 21.607999999999997.
  it.each([[40.218, 21.758], [29.9511, -90.0715], [52.52, 13.405], [-3.119, -60.0217]])(
    'sends a bBox with at most 4 decimals for %s, %s',
    async (lat, lon) => {
      const coords = await bBoxOf(lat, lon);
      expect(coords).toHaveLength(4);
      for (const c of coords) expect(c).toMatch(/^-?\d+(\.\d{1,4})?$/);
    },
  );

  it('keeps the box 0.3 degrees square around the site', async () => {
    const [w, s, e, n] = (await bBoxOf(40.218, 21.758)).map(Number);
    expect(e - w).toBeCloseTo(0.3, 4);
    expect(n - s).toBeCloseTo(0.3, 4);
    expect((w + e) / 2).toBeCloseTo(21.758, 4);
    expect((s + n) / 2).toBeCloseTo(40.218, 4);
  });
});
