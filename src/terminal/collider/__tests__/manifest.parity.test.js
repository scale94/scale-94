import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateManifestMarkdown } from '../manifest.js';
import { buildPerfumeCard, buildTesseractProfile } from '../perfumeCard.js';
import { FIXTURES } from './fixtures.js';

const fx = (name) => FIXTURES.find(f => f.name === name);

// The fixtures carry real-shaped convergence / divergence / paradox axes, so
// the manifest reads them as they are. Only the scalar collision metrics are
// laid over here: they print in the COLLISION MANIFOLD block, and putting them
// in the shared fixtures would move the card pins (novelty > 0.55 adds a heart
// note; viability feeds buildTesseractProfile).
const withMetrics = (result) => ({
  ...result,
  nodeIdA: 'A-12', nodeIdB: 'B-34',
  cosine: 0.4321, angle: 64.4, sphereSim: 0.5123,
  novelty: 0.62, projNorm: 0.781,
  coherence: 0.7312, entropy: 1.234,
  postSaponificationSim: 0.4012,
  vClass: 'VIABLE', viability: 6.1234,
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
  const res = result === null ? null : withMetrics(base);
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

  it('full result + narrative', async () => {
    const { card, tesseract, res } = await build('interference-extrait');
    expect(generateManifestMarkdown(card, tesseract, res, narrative)).toMatchSnapshot();
  });
  it('null result + null narrative', async () => {
    const { card, tesseract } = await build('plain-chimera-name', null);
    expect(generateManifestMarkdown(card, tesseract, null, null)).toMatchSnapshot();
  });
  it('SEAL states what ran: fresh encapsulation + salt when sealed, none otherwise (no snapshot)', async () => {
    const { card, tesseract, res } = await build('interference-extrait');
    const sealed = generateManifestMarkdown(card, { ...tesseract, seal: { state: 'sealed', fp: 'f'.repeat(32) } }, res, narrative);
    expect(sealed).toContain('SEAL           ML-KEM-768 encapsulation + 32-byte chaos salt, both fresh per seal');
    const unsealed = generateManifestMarkdown(card, { ...tesseract, seal: { state: 'unsealed', reason: 'no-webcrypto' } }, res, narrative);
    expect(unsealed).toContain('SEAL           none — this card was not sealed');
    expect(unsealed).not.toContain('ML-KEM-768');
  });
  it('SPACE prints result.space (no snapshot)', async () => {
    const { card, tesseract, res } = await build('interference-extrait');
    const md = generateManifestMarkdown(card, tesseract, { ...res, space: '32-D feature tensor' }, narrative);
    expect(md).toContain('SPACE          32-D feature tensor · OCK');
  });
  it('planet domain fixture', async () => {
    const { card, tesseract, res } = await build('planet-domains');
    expect(generateManifestMarkdown(card, tesseract, res, narrative)).toMatchSnapshot();
  });
});
