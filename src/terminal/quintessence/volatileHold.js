// src/terminal/quintessence/volatileHold.js — in-memory fallback when
// localStorage refuses the seal (spec §7). Survives tab switches within the
// session; evaporates on reload — which is exactly what VOLATILE means.
let held = null;
export function holdVolatile(artifact) { held = artifact; }
export function heldVolatile() { return held; }
export function _resetVolatileForTests() { held = null; }
