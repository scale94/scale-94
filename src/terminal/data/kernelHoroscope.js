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

  // Depth cipher. The horizon recedes at your exact speed; the exit is to stop
  // orbiting, not to arrive.
  blackhole: {
    axis: 'the horizon recedes at your exact speed · the exit is to stop orbiting',
    quadrants: {
      'DARK-WAXING': {
        plato:  'The ancestor. Whoever wrote the layer you are standing on, and wrote it better.',
        promo:  'Four words of changelog and no forwarding address.',
        directive: 'Read the source, not the author.',
      },
      'LIGHT-WAXING': {
        plato:  'Close now. Another year of this and you are the one being cited.',
        promo:  'The horizon recedes at exactly your speed. It has never once been nearer.',
        directive: 'Ship the thing at your current radius.',
      },
      'LIGHT-WANING': {
        plato:  'You arrived. The thing you chased is in your hands and it is yours.',
        promo:  'It is ordinary. It was always ordinary; distance was the only feature it had.',
        directive: 'Take the credit that was never withheld, only unclaimed.',
      },
      'DARK-WANING': {
        plato:  'One more orbit. The next pass is the one that catches it.',
        promo:  'Orbit is not approach. You have held this radius for years.',
        directive: 'Name what you can already do that you still call aspiration.',
      },
    },
    paradox: {
      harmonic: 'Two depths agree and the agreement dissolves the idol. What you admired turns out to be a technique, and techniques transfer.',
      fused:    'You and the ancestor at zero-point. Indistinguishable from outside, which is the only place the distinction ever lived.',
      friction: 'Drive against depth. Every increment of effort buys less distance; the asymptote is charging you for it.',
      polarity: 'Aspiration opposite arrival. Awareness only through the gap — and the gap is the whole apparatus.',
    },
    coda: {
      complete: 'The ring is closed. Nothing in it is above you.',
      partial:  'The spine is unfinished and it is still yours. Unfinished is not unqualified.',
    },
  },

  // Homophony cipher. The sound holds while the payload recompiles at each
  // border. Sits at the full moon: maximum projection, zero vision.
  semiotic: {
    axis: 'the sound holds while the payload recompiles · reach is not vision',
    quadrants: {
      'DARK-WAXING': {
        plato:  'Silence. Nothing sent, nothing to answer for.',
        promo:  'The refusal arrives anyway. It always arrives; the only variable is what you compile it into.',
        directive: 'Compile the refusal into something you own.',
      },
      'LIGHT-WAXING': {
        plato:  'The word means one thing. Say it and be understood.',
        promo:  'It crossed a border while you were saying it. Same sound, new payload, and the room heard the new one.',
        directive: 'Hold the form and let the payload change.',
      },
      'LIGHT-WANING': {
        plato:  'Untouchable. Maximum projection, the name carrying further than the body.',
        promo:  'You are lit from every side and can see nothing. Reach is not vision.',
        directive: 'Turn the lights off and count what you can still see.',
      },
      'DARK-WANING': {
        plato:  'The name persists. Whatever else goes, the name was built to outlast it.',
        promo:  'A name that outlasts the body is a monument, and monuments do not get to revise.',
        directive: 'Say the thing that would cost you the name.',
      },
    },
    paradox: {
      harmonic: 'Sound and meaning hop together and the border opens. A translation nobody had to be taught.',
      fused:    'Signal and self at zero-point. What you are called and what you are have stopped being separable — that is the cost, not the achievement.',
      friction: 'Payload under pressure at the checkpoint. The sound passes; the meaning is what gets searched.',
      polarity: 'Projection opposite perception. Everyone can find you and you cannot find the door.',
    },
    coda: {
      complete: 'Four crossings, all marked. The sound held through every one.',
      partial:  'The chain is short and the sound is intact. Short chains still cross borders.',
    },
  },

  // Counterfeit cipher. Purity is desiccation. Seated at last quarter, where
  // DRYNESS peaks at 96 — the monument reached, and refused.
  fishscale: {
    axis: 'purity is desiccation · the monument is reached every cycle and refused every cycle',
    quadrants: {
      'DARK-WAXING': {
        plato:  'Start clean this time. No cut, no compromise, nothing in it that should not be.',
        promo:  'Nothing in it that should not be is nothing in it. Clean does not run.',
        directive: 'Put something impure in it before it sets.',
      },
      'LIGHT-WAXING': {
        plato:  'Discipline. The intake narrows, the edges sharpen, the thing gets truer.',
        promo:  'Narrowing feels like precision from inside and reads as drying from outside.',
        directive: 'Stop narrowing.',
      },
      'LIGHT-WANING': {
        plato:  'Almost pure. What is left is what survived, and what survived is the real material.',
        promo:  'What survived is what was least alive. You have been selecting for the wrong property.',
        directive: 'Select for what moves, not for what lasts.',
      },
      'DARK-WANING': {
        plato:  'The monument. Perfectly preserved, nothing left to lose, nothing left to rot.',
        promo:  'Preserved is not alive. The cycle reaches this exact point every month and refuses to stay.',
        directive: 'Leave the monument standing and walk.',
      },
    },
    paradox: {
      harmonic: 'Purity and preservation agree, and the agreement is a still object. Agreement at this dryness is the failure mode.',
      fused:    'The cut and the product at zero-point. The contaminant is the texture that makes it saleable; you cannot remove it without removing the thing.',
      friction: 'Desiccation against circulation. The drier it gets the better it keeps and the less it moves.',
      polarity: 'Preservation opposite vitality. Maximum permanence, minimum pulse — and the cycle turns anyway.',
    },
    coda: {
      complete: 'The ring closed and did not calcify. That is the entire achievement.',
      partial:  'Unfinished and still wet. Keep it that way longer than feels responsible.',
    },
  },

  // The only lens that is not a cipher: it publishes. Seated on the return to
  // new, where the ring closes.
  rossignol: {
    axis: 'one song, four tongues, identical response · purity is the label telling the truth',
    quadrants: {
      'DARK-WAXING': {
        plato:  'A new start, unencumbered, nothing carried over.',
        promo:  'You came back wearing a name you picked up somewhere else. The return is never to the same place.',
        directive: 'Come back before you are finished.',
      },
      'LIGHT-WAXING': {
        plato:  'Say it plainly and it will be understood as you meant it.',
        promo:  'It will be understood as they need it. That is not a failure of the saying — it is what saying is for.',
        directive: 'Let them hear it wrong and keep playing.',
      },
      'LIGHT-WANING': {
        plato:  'The formula is the value. Publish it and you are left with nothing.',
        promo:  'Published, it becomes an assay. A declared label is the only purity anyone can verify.',
        directive: 'Publish the assay.',
      },
      'DARK-WANING': {
        plato:  'One more circuit before you declare anything.',
        promo:  'The ring is already closed. You are circling something you have finished.',
        directive: 'Close it and say so out loud.',
      },
    },
    paradox: {
      harmonic: 'Two tongues agree without translation. The pulse crossed and nobody had to be taught it.',
      fused:    'Departure and return at zero-point. The bird is home and foreign in the same instant, and both are correct readings.',
      friction: 'Disclosure against advantage. Every declared gram costs you the edge and buys the only trust that compounds.',
      polarity: 'The song opposite the name. Four languages, one response — the response was never in the language.',
    },
    coda: {
      complete: 'Four marked, the ring shut. This is the reading the other four were arriving at.',
      partial:  'The ring is open at one point. An open ring is a route, not a defect.',
    },
  },
};
