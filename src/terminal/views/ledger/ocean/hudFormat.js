// hudFormat.js — pure text and geometry for the Ledger ocean HUD (spec §4).
// No React and no GL, so every string the HUD shows is unit-tested.

export const MODE_LABEL = {
  static: 'STATIC · NO FLOAT TARGETS',
  'static-shader': 'STATIC · SIM SHADERS FAILED',
  unsupported: 'OCEAN UNAVAILABLE · NO WEBGL2',
  lost: 'OCEAN SUSPENDED · GPU CONTEXT LOST',
};
