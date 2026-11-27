import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateManifestMarkdown } from '../manifest.js';
import { buildPerfumeCard, buildTesseractProfile } from '../perfumeCard.js';
import { FIXTURES } from './fixtures.js';

const fx = (name) => FIXTURES.find(f => f.name === name);

// The fixtures carry string convergence entries; the manifest reads
// {name, contrib, vA, vB} objects, so enrich a copy of the result here.
const richResult = (result) => ({
  ...result,
  nodeIdA: 'A-12', nodeIdB: 'B-34',
  cosine: 0.4321, angle: 64.4, sphereSim: 0.5123,
  novelty: 0.62, projNorm: 0.781,
  coherence: 0.7312, entropy: 1.234,
  postSaponificationSim: 0.4012,
  vClass: 'VIABLE', viability: 6.1234,
  convergence: [{ name: 'entropy', contrib: 0.812, vA: 0.7, vB: 0.65 }],
  divergence: [{ name: 'synchrony', delta: 0.5, vA: 0.1, vB: 0.6 }],
  paradoxes: [{ name: 'thermodynamic', residual: 0.21, original: 0.44 }],
});

const narrative = {
  archetype: 'THE LANTERN',
  archetypeSigma: 1.234,
  sanctuaries: [{ center: 3.83, width: 0.012, size: 3, members: [1, 5, 9] }],
  meta: { interference: 0.5, catalysis: 0.25, resonanceFreq: 0.75, turbulence: 0.1234 },
  decayArc: [
    { time: 'T+0', glyph: 'α', shell: 'outer', regime: 'stable', patch: 'patch-one', notes: ['a', 'b'] },
    { time: 'T+12h', glyph: 'β', shell: 'inner', regime: 'chaotic', patch: 'patch-two', notes: ['c'] },
  ],
};

async function build(name, result) {
  const { domA, domB, result: base } = fx(name);
  const res = result === null ? null : richResult(base);
  const card = buildPerfumeCard(domA, domB, base);
  const tesseract = await buildTesseractProfile(card, base.accord, domA, domB, base);
  return { card, tesseract, res };
}

describe('manifest parity (P0 pin)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('no living, full result + narrative', async () => {
    const { card, tesseract, res } = await build('interference-extrait');
    expect(generateManifestMarkdown(card, tesseract, null, res, narrative)).toMatchSnapshot();
  });
  it('no living, null result + null narrative', async () => {
    const { card, tesseract } = await build('plain-chimera-name', null);
    expect(generateManifestMarkdown(card, tesseract, null, null, null)).toMatchSnapshot();
  });
  it('planet domain fixture', async () => {
    const { card, tesseract, res } = await build('planet-domains');
    expect(generateManifestMarkdown(card, tesseract, null, res, narrative)).toMatchSnapshot();
  });
  it('LIVING case', async () => {
    const { card, tesseract, res } = await build('interference-extrait');
    const living = { layer: 'heart', slotIdx: 1, newNote: 'Iris', oldNote: 'Rose', editionEntropy: '0.8123', witnessHash: 'ab'.repeat(32) };
    expect(generateManifestMarkdown(card, tesseract, living, res, narrative)).toMatchSnapshot();
  });
});
