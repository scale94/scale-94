// src/terminal/data/kernelHoroscope.js — the doctrine register's corpus.
//
// The mythic twin of this tab's cited chemistry, in the register kernelDoctrines
// already established: "the alchemy to the theory's chemistry, astrology to its
// astronomy." Each lens speaks a Plato / Promo / Paradox triad and resolves to
// one imperative.
//
// Indexing: quadrant picks WHAT a kernel says, tension class picks HOW the
// paradox lands, coda reads the spine. 19 slots per lens.
//
// Directive contract: one sentence, imperative, one verb, one object. No
// hedging. No directive promises arrival, transformation or enlightenment —
// the cycle has no destination, only adaptation. Directives address conduct
// and seeing.
//
// Copy discipline: shape only. No events, persons, places or institutions.

export const TENSION_CLASSES = ['harmonic', 'fused', 'friction', 'polarity'];

export const KERNEL_HOROSCOPE = {
  // Entropy cipher. The drawer is unlocked; protection is search cost, not walls.
  hudelschublade: {
    axis: 'the drawer is unlocked · protection is search cost, not walls',
    quadrants: {
      'DARK-WAXING': {
        plato:  'The vault. Every wall you add is another index entry for the sweep.',
        promo:  'The drawer nobody opens, because nobody can parse what they already own.',
        directive: 'Stop hardening it and misfile it.',
      },
      'LIGHT-WAXING': {
        plato:  'A clean surface. Everything where it belongs, legible at a glance.',
        promo:  'Legible at a glance to you, and to everyone else at the same glance.',
        directive: 'Put the thing you value where you would never look for it.',
      },
      'LIGHT-WANING': {
        plato:  'The inventory. You could list what you have if anyone asked.',
        promo:  'The list is the theft. Whoever holds it has no further use for the drawer.',
        directive: 'Do not make the list.',
      },
      'DARK-WANING': {
        plato:  'Order restored. The mess finally sorted, the entropy spent.',
        promo:  'Sorted is searchable. You spent the only key you had.',
        directive: 'Leave the mess exactly as it stands.',
      },
    },
    paradox: {
      harmonic: 'Two systems agree and the agreement is the leak. Nothing hidden survives being easy to read.',
      fused:    'Cover and contents at zero-point. The mess and the valuables are one object now; separating them destroys both.',
      friction: 'Signal under structural pressure routes around the structure. Force applied to a drawer only proves something is in it.',
      polarity: 'Maximum legibility opposite maximum value. What you can fully explain, you can fully lose.',
    },
    coda: {
      complete: 'The ring is closed and the drawer is still the safest room in it.',
      partial:  'Vertebrae unmarked. Unmarked is not empty — it is unindexed.',
    },
  },
};
