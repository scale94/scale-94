// src/terminal/mercury/useStageCameraDist.js — the fitted camera distance for the live canvas size.
// MercuryCanvas applies it to the camera; MercuryPlanet sizes its pops from it. Both derive it from the
// same r3f size, so they always agree. Recomputes only when the canvas size changes.
// A portrait phone gets the corner layout (planet/phoneLayout.js): the triggers in the canvas corners and the camera
// set so the sphere is as large as a flick gap to every trigger allows. Everything else keeps the ring fit.

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { ORBIT_RADIUS } from './orbitNodes';
import { CAMERA_DIST, CAMERA_FOV_DEG } from './planet/planetLook';
import { fitCameraDistance, HANDLE_MARGIN_PX } from './planet/stageFit';
import { isCornerLayout, phoneCornerLayout } from './planet/phoneLayout';

// { dist, layout }: layout is the corner layout on a portrait phone, else null (the ring).
export function useStageLayout(isMobile) {
  const w = useThree((s) => s.size.width);
  const h = useThree((s) => s.size.height);
  const key = isMobile ? 'mobile' : 'desktop';
  return useMemo(() => {
    if (isCornerLayout({ isMobile, wPx: w, hPx: h })) {
      const layout = phoneCornerLayout({ wPx: w, hPx: h, fovDeg: CAMERA_FOV_DEG[key] });
      return { dist: layout.dist, layout };
    }
    const dist = fitCameraDistance({
      halfWidthPx: w / 2,
      halfHeightPx: h / 2,
      ringR: ORBIT_RADIUS,
      marginPx: HANDLE_MARGIN_PX[key],
      fovDeg: CAMERA_FOV_DEG[key],
      minDist: CAMERA_DIST[key],
    });
    return { dist, layout: null };
  }, [w, h, key, isMobile]);
}

export default function useStageCameraDist(isMobile) {
  return useStageLayout(isMobile).dist;
}
