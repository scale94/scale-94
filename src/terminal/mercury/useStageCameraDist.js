// src/terminal/mercury/useStageCameraDist.js — the fitted camera distance for the live canvas size.
// MercuryCanvas applies it to the camera; MercuryPlanet sizes its pops from it. Both derive it from the
// same r3f size, so they always agree. Recomputes only when the canvas size changes.

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { ORBIT_RADIUS } from './orbitNodes';
import { CAMERA_DIST, CAMERA_FOV_DEG } from './planet/planetLook';
import { fitCameraDistance, HANDLE_MARGIN_PX } from './planet/stageFit';

export default function useStageCameraDist(isMobile) {
  const w = useThree((s) => s.size.width);
  const h = useThree((s) => s.size.height);
  const key = isMobile ? 'mobile' : 'desktop';
  return useMemo(() => fitCameraDistance({
    halfWidthPx: w / 2,
    halfHeightPx: h / 2,
    ringR: ORBIT_RADIUS,
    marginPx: HANDLE_MARGIN_PX[key],
    fovDeg: CAMERA_FOV_DEG[key],
    minDist: CAMERA_DIST[key],
  }), [w, h, key]);
}
