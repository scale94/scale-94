import { describe, it, expect } from 'vitest';
import { fitCameraDistance, HANDLE_MARGIN_PX, MIN_AVAIL_FRAC } from '../stageFit';

const tanHalf = (fovDeg) => Math.tan((fovDeg * Math.PI) / 360);
// Projected ring radius in px for a camera at distance d (three's fov is vertical).
const ringPxV = (ringR, d, fovDeg, halfH) => (ringR / (d * tanHalf(fovDeg))) * halfH;
const ringPxH = (ringR, d, fovDeg, halfW, halfH) => (ringR / (d * tanHalf(fovDeg) * (halfW / halfH))) * halfW;

describe('fitCameraDistance', () => {
  it('wide canvas (height-limited): ring + margin lands exactly on the top edge', () => {
    const a = { halfWidthPx: 900, halfHeightPx: 408, ringR: 1.4, marginPx: 70, fovDeg: 42, minDist: 3.6 };
    const d = fitCameraDistance(a);
    expect(ringPxV(1.4, d, 42, 408) + 70).toBeCloseTo(408, 6);
    expect(ringPxH(1.4, d, 42, 900, 408) + 70).toBeLessThan(900);
    expect(d).toBeGreaterThan(3.6);
  });

  it('portrait canvas (width-limited): ring + margin lands exactly on the side edge', () => {
    const a = { halfWidthPx: 187.5, halfHeightPx: 196, ringR: 1.4, marginPx: 78, fovDeg: 48, minDist: 4.6 };
    const d = fitCameraDistance(a);
    expect(ringPxH(1.4, d, 48, 187.5, 196) + 78).toBeCloseTo(187.5, 6);
    expect(ringPxV(1.4, d, 48, 196) + 78).toBeLessThanOrEqual(196 + 1e-9);
  });

  it('never moves closer than minDist', () => {
    const d = fitCameraDistance({ halfWidthPx: 2000, halfHeightPx: 2000, ringR: 0.5, marginPx: 70, fovDeg: 42, minDist: 3.6 });
    expect(d).toBe(3.6);
  });

  it('degenerate canvas (half-extent ≤ margin) stays finite and uses MIN_AVAIL_FRAC', () => {
    const d = fitCameraDistance({ halfWidthPx: 50, halfHeightPx: 40, ringR: 1.4, marginPx: 70, fovDeg: 42, minDist: 3.6 });
    expect(Number.isFinite(d)).toBe(true);
    expect(ringPxV(1.4, d, 42, 40)).toBeLessThanOrEqual(40 * MIN_AVAIL_FRAC + 1e-9);
  });

  it('non-finite / zero sizes fall back to minDist', () => {
    expect(fitCameraDistance({ halfWidthPx: 0, halfHeightPx: 0, ringR: 1.4, marginPx: 70, fovDeg: 42, minDist: 3.6 })).toBe(3.6);
    expect(fitCameraDistance({ halfWidthPx: NaN, halfHeightPx: 300, ringR: 1.4, marginPx: 70, fovDeg: 42, minDist: 3.6 })).toBe(3.6);
  });

  it('desktop fits a pressed handle; mobile fits a resting one (author: the 380 ms press burst may touch the edge)', () => {
    expect(HANDLE_MARGIN_PX.desktop).toBeGreaterThanOrEqual((92 * 1.38) / 2);
    expect(HANDLE_MARGIN_PX.mobile).toBeGreaterThanOrEqual(104 / 2);
    expect(HANDLE_MARGIN_PX.mobile).toBeLessThan((104 * 1.38) / 2);
  });
});
