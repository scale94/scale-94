// src/terminal/quintessence/whispers.js — which house each piece lives in (spec §5.8).
// Pure data, no React: the house tables and the riddle pool. The whisper
// picker lives in observerStore (it reads the session trail).

// Piece id → the INTERNAL tab id that houses it ('manifesto' is /ACCRETION).
export const PIECE_TAB = {
  'mercury.flick': 'mercury', 'bsky.trend': 'bsky', 'accretion.collide': 'manifesto',
  'lunar.phase': 'lunar', 'scent.collide': 'scaling', 'chaos.pick': 'art',
  'sol.release': 'sol', 'crypto.seal': 'cryptography', 'ledger.write': 'ledger',
  'transmission.mark': 'transmission', 'ecocide.growth': 'ecocide',
  'surveillance.privacy': 'surveillance', 'kernel.run': 'kernel', 'altar.ignite': 'mercury',
};

// The inverse: tab → every piece it houses, in PIECE_TAB order.
export const TAB_PIECES = Object.entries(PIECE_TAB).reduce((acc, [piece, tab]) => {
  (acc[tab] ||= []).push(piece);
  return acc;
}, {});

// The riddle pool (spec Appendix A, verbatim; the author tunes it). Each piece's
// lines in order; a whisper id is `${piece}:${index}`. Voice: lower-case, `·`
// separators, no verbs aimed at UI. Idle whispers reuse the target's lines.
export const RIDDLES = {
  'mercury.flick': [
    'quicksilver sulks when left alone',
    'a flick of the wrist is a flick of the will',
    'the messenger only runs when pushed',
  ],
  'bsky.trend': [
    "the sky won't stop saying one word · catch it",
    'pin a rumour to the wind',
    'the crowd hums a name · keep it',
  ],
  'accretion.collide': [
    'two minds fall faster together',
    'seat a pair of thinkers · let the light bend',
    'thought gathers mass in collision',
  ],
  'lunar.phase': [
    'the moon wears a perfume per phase',
    'mark the moon and it marks you back',
    'dryness is a calendar · choose a night',
  ],
  'scent.collide': [
    'let scent be your accent',
    'two notes · one collision · a new accord',
    'the nose knows what the mind collides',
  ],
  'chaos.pick': [
    'the sphere speaks louder in pairs',
    'order is a rumour · fork it',
    'pick two and the chaos picks you',
  ],
  'sol.release': [
    'the sun throws tantrums at whoever faces it',
    'snap the star · something leaves for you',
    'light takes eight minutes to forgive',
  ],
  'crypto.seal': [
    'a secret kept is a secret sealed',
    'lock something small · see who notices',
    'lattices remember what you hide',
  ],
  'ledger.write': [
    'the tide signs whatever you confess',
    'water keeps the books',
    'write it down and the sea will witness',
  ],
  'transmission.mark': [
    'some signals ask to be kept',
    'not every packet is lost · mark one',
    'the dead letter wants a reader',
  ],
  'ecocide.growth': [
    'growth has a dial and a bill',
    "turn up more · count what's left",
    'the earth keeps the receipts',
  ],
  'surveillance.privacy': [
    'someone reads over your shoulder · read back',
    'privacy is a drawer · it opens both ways',
    'the watcher has a watcher',
  ],
  'kernel.run': [
    'the terminal answers only to verbs',
    'load a mind · then make it run',
    'a kernel at rest is a kernel denied',
  ],
  'altar.ignite': [
    'three bones aligned · the altar is listening',
    'four is a body · five is a soul',
    'the fifth element waits beneath the mercury',
  ],
};
