// Test-only: a real base accord (P0 fixture card → P1 kit) and envelope meta,
// shared by the P3 compile, altar and reveal tests.
import { buildBaseAccord } from '../baseAccord';
import { MATERIALS } from '../materials';
import { NOTE_MATERIALS } from '../noteInterpretation';
import { buildPerfumeCard } from '../../collider/perfumeCard';
import { FIXTURES } from '../../collider/__tests__/fixtures';

export const REAL_CARD = buildPerfumeCard(FIXTURES[0].domA, FIXTURES[0].domB, FIXTURES[0].result);
export const REAL_ACCORD = buildBaseAccord(REAL_CARD, NOTE_MATERIALS, MATERIALS);
export const RAMP_SALT = () => Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256);
export const ENVELOPE_META = Object.freeze({
  kem: 'ML-KEM-768', kdf: 'BLAKE3-derive_key', aead: 'AES-256-GCM',
  ctBytes: 1088, aeadBytes: 911, fp: '0123456789abcdef0123456789abcdef',
});
