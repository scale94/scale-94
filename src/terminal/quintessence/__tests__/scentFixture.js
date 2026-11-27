// Test-only: an envelope-shaped scent for spine tests that are not about crypto.
// The real seal is exercised in src/terminal/lib/__tests__/accordSeal.test.js.
import { setScent } from '../spineStore';

export const FX_FP = '0123456789abcdef0123456789abcdef';
export const FX_ENVELOPE = Object.freeze({
  v: 1, kem: 'ML-KEM-768', kdf: 'BLAKE3-derive_key', aead: 'AES-256-GCM',
  fp: FX_FP, ct: 'AAAA', nonce: 'AAAA', aead_ct: 'AAAA',
});
export const FX_SCENT = Object.freeze({ envelope: FX_ENVELOPE, cardName: 'Fixture Accord', sealedAt: 1_700_000_000_000, fp: FX_FP });

export function sealScentForTests(overrides = {}) {
  setScent({ ...FX_SCENT, ...overrides });
}
