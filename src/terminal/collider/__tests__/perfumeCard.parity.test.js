import { describe, it, expect } from 'vitest';
import * as D from '../domains.js';
import * as P from '../perfumeCard.js';
const M = { ...D, ...P };
import { FIXTURES } from './fixtures.js';

describe('perfume card parity (P0 pin)', () => {
  it.each(FIXTURES)('$name: buildPerfumeCard', ({ domA, domB, result }) => {
    expect(M.buildPerfumeCard(domA, domB, result)).toMatchSnapshot();
  });
  it.each(FIXTURES)('$name: generateAccordHash', async ({ domA, domB, result }) => {
    const card = M.buildPerfumeCard(domA, domB, result);
    const h = await M.generateAccordHash(card, result.accord, domA, domB);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toMatchSnapshot();
  });
  it.each(FIXTURES)('$name: buildTesseractProfile', async ({ domA, domB, result }) => {
    const card = M.buildPerfumeCard(domA, domB, result);
    expect(await M.buildTesseractProfile(card, result.accord, domA, domB, result)).toMatchSnapshot();
  });
  it('domain table shape', () => {
    expect(M.ALL_DOMAINS.map(d => [d.id, d.short, d.hue])).toMatchSnapshot();
  });
});
