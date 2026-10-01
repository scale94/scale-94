// src/terminal/mercury/planet/planetMaps.js — binding the decoded MESSENGER/USGS maps to a
// planet material. The textures outlive any one material: a live CALM toggle swaps the
// shader variant (a new material) and must not reload the maps or flash the flat fallback,
// so MercuryPlanet keeps the loaded set and rebinds it to whichever material is current.

// maps: { albedo, dem, demSize: [w, h] } once decoded, or null (flat fallback).
export function bindPlanetMaps(u, maps) {
  if (!maps) {
    u.uAlbedo.value = null;
    u.uDem.value = null;
    u.uHasMaps.value = 0;
    return;
  }
  u.uAlbedo.value = maps.albedo;
  u.uDem.value = maps.dem;
  u.uDemTexel.value.set(1 / maps.demSize[0], 1 / maps.demSize[1]);
  u.uHasMaps.value = 1;
}
