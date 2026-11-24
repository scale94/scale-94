// src/terminal/quintessence/whispers.js — which house each piece lives in (spec §5.8).
// Pure data, no React. Task 4 ships the tables only; the riddle pool and the
// whisper picker land with the session trail.

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
