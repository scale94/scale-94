// Crystallize seals (spec §5.3, §6.6): card → base accord + chaos salt → envelope → spine.
// Real WASM, real WebCrypto, the real kit; only the identity store is in-memory.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { loadWasmNode } from '../../../../tests/helpers/loadWasmNode.js';
import { createIdentityVault } from '../identityVault.js';
import { unsealAccord } from '../accordSeal.js';
import { sealAccordForSpine } from '../sealAccordForSpine.js';
import { getSpine, _resetSpineForTests } from '../../quintessence/spineStore';
import { buildBaseAccord } from '../../scent/baseAccord';
import { MATERIALS } from '../../scent/materials';
import { NOTE_MATERIALS } from '../../scent/noteInterpretation';
import { buildPerfumeCard } from '../../collider/perfumeCard';
import { FIXTURES } from '../../collider/__tests__/fixtures';

const subtle = webcrypto.subtle;
const getRandomValues = (a) => webcrypto.getRandomValues(a);
const memStore = () => { const m = new Map(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; };

let wasm;
const F = FIXTURES[0];
const card = buildPerfumeCard(F.domA, F.domB, F.result);

beforeAll(() => { wasm = loadWasmNode(); });
beforeEach(() => _resetSpineForTests());

function deps(over = {}) {
  const vault = createIdentityVault({ wasm, subtle, getRandomValues, store: memStore() });
  return { vault, subtle, getRandomValues, loadWasm: async () => wasm, getVault: async () => vault, now: () => 42, ...over };
}

describe('sealAccordForSpine', () => {
  it('seals: the spine holds an envelope that unseals to the card base accord', async () => {
    const d = deps();
    const r = await sealAccordForSpine(card, d);
    expect(r).toMatchObject({ state: 'sealed', sizes: { ct: 1088 } });
    const { scent } = getSpine();
    expect(scent).toMatchObject({ cardName: card.name, sealedAt: 42, fp: r.fp });
    const id = await d.vault.getOrCreateIdentity();
    const u = await unsealAccord(scent.envelope, id, { wasm, subtle, unwrapSecrets: d.vault.unwrapSecrets });
    expect(u.state).toBe('ok');
    expect(u.baseAccord).toEqual(buildBaseAccord(card, NOTE_MATERIALS, MATERIALS));
    expect(u.salt).toHaveLength(32);
  });

  it('the spine never holds the plaintext accord', async () => {
    await sealAccordForSpine(card, deps());
    const raw = JSON.stringify(getSpine());
    expect(raw).not.toContain('materialId');
    expect(raw).not.toContain(MATERIALS[0].id);
  });

  it('two crystallizes of the same card give different envelopes (fresh salt + encapsulation)', async () => {
    const d = deps();
    await sealAccordForSpine(card, d);
    const a = getSpine().scent.envelope;
    await sealAccordForSpine(card, d);
    const b = getSpine().scent.envelope;
    expect(a.ct).not.toBe(b.ct);
    expect(a.aead_ct).not.toBe(b.aead_ct);
  });

  it('no SubtleCrypto → unsealed/no-webcrypto and the spine is untouched', async () => {
    expect(await sealAccordForSpine(card, deps({ subtle: null }))).toEqual({ state: 'unsealed', reason: 'no-webcrypto' });
    expect(getSpine().scent).toBeNull();
  });

  it('WASM fails to load → unsealed/wasm-unavailable and the spine is untouched', async () => {
    const r = await sealAccordForSpine(card, deps({ loadWasm: async () => { throw new Error('404'); } }));
    expect(r).toEqual({ state: 'unsealed', reason: 'wasm-unavailable' });
    expect(getSpine().scent).toBeNull();
  });

  it('any other failure → unsealed/error; it never throws', async () => {
    const r = await sealAccordForSpine({ ...card, topNotes: ['No Such Note'] }, deps());
    expect(r).toEqual({ state: 'unsealed', reason: 'error' });
    expect(getSpine().scent).toBeNull();
  });
});
