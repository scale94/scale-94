// MercuryPlanet.jsx — the planet under the real Sun (spec 2026-09-30, phase 1).
// Owns: impostor mesh, raw material, map loading, per-frame uniform writes.
// All maths lives in ./planet/* (tested); this file only wires it to GL.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_VS, PLANET_FS } from './planet/mercuryPlanetShader';
import { mercuryEphemeris } from './planet/mercuryEphemeris';
import { SUN_DIR_WORLD, bodyYawFor, sunDirForCamera } from './planet/planetFrame';
import { PLANET_TUNE, MEAN_R_AU } from './planet/planetLook';
import { MAPS } from './planet/mercuryMaps.generated';

const EPHEMERIS_REFRESH_S = 1;

export function planetEphemerisUniforms(nowMs, sunDir = SUN_DIR_WORLD) {
  const eph = mercuryEphemeris(nowMs);
  return {
    yaw: bodyYawFor(eph.subsolarLonDeg, sunDir),
    irr: (MEAN_R_AU / eph.r) ** 2,
    sinR: Math.sin(eph.sunAngularRadiusRad),
    subsolarLonDeg: eph.subsolarLonDeg,
  };
}

function loadMap(loader, url, srgb) {
  return new Promise((resolve, reject) => {
    loader.load(url, (tex) => {
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      resolve(tex);
    }, undefined, reject);
  });
}

export default function MercuryPlanet({ isMobile = false }) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const material = useMemo(() => {
    const e = planetEphemerisUniforms(Date.now());
    return new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PLANET_VS,
      fragmentShader: PLANET_FS,
      alphaToCoverage: !isMobile,
      uniforms: {
        uAlbedo: { value: null },
        uDem: { value: null },
        uHasMaps: { value: 0 },
        uSunDir: { value: new THREE.Vector3(...SUN_DIR_WORLD) },
        uBodyYaw: { value: e.yaw },
        uSunIrr: { value: e.irr },
        uSunSinR: { value: e.sinR },
        uDemTexel: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uExposure: { value: PLANET_TUNE.exposure },
        uRelief: { value: PLANET_TUNE.relief },
        uNightFloor: { value: PLANET_TUNE.nightFloor },
      },
    });
  }, [isMobile]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const set = isMobile ? MAPS.mobile : MAPS.desktop;
    const loader = new THREE.TextureLoader();
    let disposed = false;
    let textures = [];
    Promise.all([loadMap(loader, set.albedo, true), loadMap(loader, set.dem, false)])
      .then(([albedo, dem]) => {
        textures = [albedo, dem];
        if (disposed) { textures.forEach((t) => t.dispose()); return; }
        const u = material.uniforms;
        u.uAlbedo.value = albedo;
        u.uDem.value = dem;
        u.uDemTexel.value.set(1 / set.demSize[0], 1 / set.demSize[1]);
        u.uHasMaps.value = 1;
      })
      .catch((err) => console.error('[mercury] planet maps failed; flat fallback stays', err));
    return () => { disposed = true; textures.forEach((t) => t.dispose()); };
  }, [material, isMobile]);

  const nextEphemeris = useRef(0);
  const subsolarLonRef = useRef(null);
  useFrame(({ clock, camera }) => {
    const u = material.uniforms;
    const t = clock.elapsedTime;
    u.uTime.value = t;
    u.uExposure.value = PLANET_TUNE.exposure;
    u.uRelief.value = PLANET_TUNE.relief;
    u.uNightFloor.value = PLANET_TUNE.nightFloor;
    if (t >= nextEphemeris.current) {
      nextEphemeris.current = t + EPHEMERIS_REFRESH_S;
      const e = planetEphemerisUniforms(Date.now());
      u.uBodyYaw.value = e.yaw;
      u.uSunIrr.value = e.irr;
      u.uSunSinR.value = e.sinR;
      subsolarLonRef.current = e.subsolarLonDeg;
    }
    // The Sun follows the camera's azimuth (phase angle holds under autoRotate); the body yaw
    // re-pins the real subsolar longitude to it every frame.
    const sun = sunDirForCamera([camera.position.x, camera.position.y, camera.position.z]);
    u.uSunDir.value.set(sun[0], sun[1], sun[2]);
    if (subsolarLonRef.current !== null) u.uBodyYaw.value = bodyYawFor(subsolarLonRef.current, sun);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
