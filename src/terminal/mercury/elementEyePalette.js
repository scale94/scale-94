// elementEyePalette.js — /MERCURY's four elements as the masthead eye sees them. A leaf module
// (no imports): observerEyeShader builds its elC() from it, and node scripts (eyeParity) load
// that shader directly. mercuryEye re-exports all of it.

// Each element's palette: [core, deep, light] RGB 0..255, built around elements.js's hue.
export const ELEMENT_EYE_COLS = {
  air:     [[56, 189, 248], [14, 116, 144], [224, 242, 254]],   // pale cyan · deep teal · near-white sky
  thermal: [[249, 115, 22], [185, 28, 28], [254, 215, 170]],    // ember · blood-red · flame-tip cream
  fluid:   [[99, 102, 241], [30, 41, 120], [165, 180, 252]],    // indigo · abyss · pale periwinkle
  earth:   [[217, 119, 6], [120, 53, 15], [253, 224, 140]],     // amber · umber · ochre light
};

// The shader's element ids (observerEyeShader elC, SHAPE.element), and the side of the eye each
// strikes from: where its node sits on the Mercury stage.
export const ELEMENT_IDS = { air: 0, thermal: 1, fluid: 2, earth: 3 };
export const ELEMENT_SIDE = { air: 'top', thermal: 'right', fluid: 'left', earth: 'bottom' };

