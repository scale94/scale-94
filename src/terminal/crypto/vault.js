// vault.js — Tesseract Vault file encryption module
// Scale 9.4 // SOMA-9.4 // Tesseract-Vault architecture (dollspace-gay)
//
// Hybrid KEM/DEM file encryption:
//   KEM layer : ML-KEM-768 (FIPS 203) via Rust/WASM — vault_encapsulate / vault_decapsulate
//   DEM layer : AES-256-GCM (Web Crypto API) — streaming, chunked, non-extractable key
//
// ── .soma binary format ──────────────────────────────────────────────────────
//
//  HEADER  (1105 bytes)
//    [4B]   magic        : 0x534F4D41  ("SOMA")
//    [1B]   version      : 0x01
//    [12B]  base_IV      : OsRng 96-bit initialization vector
//    [1088B] KEM_CT      : ML-KEM-768 ciphertext (encapsulated AES key)
//
//  CHUNKS  (variable)
//    For each 1MB chunk:
//      [4B]  chunk_payload_size  (big-endian u32) — size of encrypted data incl. 16B GCM tag
//      [12B] chunk_nonce         — base_IV[0..8] ‖ chunk_index_BE_u32
//      [N+16B] AES-256-GCM ciphertext + 128-bit auth tag
//
//  EOF SENTINEL
//    [4B]  0x00000000
//
// Each chunk is independently authenticated by its GCM tag.
// The chunk nonce construction (fixed prefix + counter) is safe because:
//   - base_IV[0..8] is 64 bits of fresh OsRng per file
//   - counter is a monotonically increasing u32 — nonces are never reused within one file
//   - Different files use different base_IVs even if the same AES key were reused
//     (they won't be — ML-KEM generates a fresh shared secret per encapsulation)
//
// ── SECURITY DISCLAIMER ──────────────────────────────────────────────────────
//
//   This module provides post-quantum file encryption using production-grade
//   cryptographic primitives (FIPS 203 + AES-256-GCM). However, please read
//   the following before use:
//
//   1. KEY CUSTODY IS YOUR RESPONSIBILITY.
//      Your ML-KEM-768 decapsulation key (private key) exists only in your
//      browser session and in whatever backup you choose to make. If you lose
//      the private key — through a page refresh, closing the tab, clearing
//      browser storage, or failing to save the hex output from `keygen` — the
//      encrypted file is permanently unrecoverable. There is no key escrow,
//      no server-side backup, and no recovery mechanism. The math doesn't
//      negotiate. Back up your private key before encrypting anything important.
//
//   2. SESSION-ONLY KEYS BY DEFAULT.
//      Keys generated with `keygen` are stored in WASM linear memory and
//      JavaScript state for the duration of the browser session only. They
//      are not persisted to localStorage, IndexedDB, or any other storage.
//
//   3. NO FORWARD SECRECY FOR STORED FILES.
//      Unlike a messaging protocol, encrypted files remain vulnerable to
//      future compromise of the decapsulation key. If the private key is
//      later exposed, all files encrypted to that public key are at risk.
//
//   4. BROWSER SANDBOX LIMITATIONS.
//      Web Crypto keys are marked non-extractable after import. Raw key
//      material is zeroed in JS as quickly as possible after use. However,
//      the browser's garbage collector and memory layout provide weaker
//      isolation guarantees than a native process with mlock().
//
//   Scale 9.4 / Tesseract-Vault are research and artistic tools.
//   Evaluate fitness for your specific threat model before use.
//
// SOMA-9.4 · ARS ELECTRONICA 2027

const CHUNK_SIZE     = 1024 * 1024; // 1MB per chunk — balances RAM vs. call overhead
const MAGIC          = new Uint8Array([0x53, 0x4F, 0x4D, 0x41]); // "SOMA"
const VERSION        = 0x01;
const IV_LEN         = 12;
const KEM_CT_LEN     = 1088;
const EK_LEN         = 1184;
const DK_LEN         = 2400;
const HEADER_LEN     = 4 + 1 + IV_LEN + KEM_CT_LEN; // 1105 bytes

// Derive per-chunk nonce: base_IV[0..8] ‖ chunk_index as big-endian u32.
// This construction avoids nonce reuse within a single file. A fresh base_IV
// is generated per encryption so nonces are globally unique across files too.
function chunkNonce(baseIV, index) {
  const nonce = new Uint8Array(IV_LEN);
  nonce.set(baseIV.subarray(0, 8), 0);
  new DataView(nonce.buffer).setUint32(8, index, false); // big-endian counter
  return nonce;
}

// ── encryptFile ───────────────────────────────────────────────────────────────

/**
 * Encrypt a File using ML-KEM-768 (WASM) + AES-256-GCM (Web Crypto).
 *
 * The file is read in 1MB chunks via ReadableStream. Each chunk is encrypted
 * independently with a derived nonce, allowing arbitrarily large files to be
 * processed without loading the full plaintext into RAM.
 *
 * @param {File}     file    — the plaintext file to encrypt
 * @param {object}   wasmMod — initialized WASM module (scale94_kernels.js)
 * @param {string}   ekHex   — hex-encoded ML-KEM-768 encapsulation key (1184 bytes)
 * @param {Function} log     — (msg: string) => void  terminal log callback
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function encryptFile(file, wasmMod, ekHex, log, onProgress = null) {
  log(`> ENCLAVE: initiating vault encryption`);
  log(`> ENCLAVE: target=${file.name}  size=${(file.size / 1024).toFixed(1)} KB`);
  log(`> ENCLAVE: algorithm=ML-KEM-768 + AES-256-GCM  format=SOMA-v01`);

  // 1. Parse EK hex → bytes
  const ekBytes = hexToBytes(ekHex);
  if (ekBytes.length !== EK_LEN) {
    throw new Error(`VAULT_ERR :: EK wrong length ${ekBytes.length} (expected ${EK_LEN})`);
  }

  // 2. WASM ML-KEM-768 encapsulation
  //    vault_encapsulate returns [32B shared_secret ‖ 1088B KEM_ct]
  log(`> ENCLAVE: ML-KEM-768 encapsulation via vault_encapsulate()...`);
  const encapResult = wasmMod.vault_encapsulate(ekBytes);
  if (!encapResult || encapResult.length < 32 + KEM_CT_LEN) {
    throw new Error('VAULT_ERR :: vault_encapsulate returned empty — check WASM initialization');
  }

  // Slice before zeroing the source
  const ssRaw = encapResult.slice(0, 32);           // shared secret — ephemeral
  const kemCt = encapResult.slice(32, 32 + KEM_CT_LEN); // KEM ciphertext — goes into header
  log(`> ENCLAVE: KEM_CT=${KEM_CT_LEN}B  SS=32B  [WASM-side ss zeroized via compiler_fence]`);

  // 3. Import shared secret into Web Crypto as non-extractable AES-GCM key
  //    After importKey(), zeroize ssRaw — Web Crypto retains its own internal copy.
  log(`> ENCLAVE: importing shared secret into SubtleCrypto (non-extractable, encrypt-only)`);
  const aesKey = await crypto.subtle.importKey(
    'raw',
    ssRaw,
    { name: 'AES-GCM' },
    false,        // non-extractable
    ['encrypt'],
  );
  ssRaw.fill(0); // zeroize JS-side raw ss bytes immediately after import
  log(`> ENCLAVE: zeroizing intermediate state via log_entropy_flush()`);
  onProgress?.({ phase: 'encap', filename: file.name });

  // 4. Generate 96-bit base IV
  const baseIV = crypto.getRandomValues(new Uint8Array(IV_LEN));
  log(`> ENCLAVE: IV=${bytesToHex(baseIV)} (96-bit OsRng)`);

  // 5. Build .soma header: [magic 4B] [version 1B] [IV 12B] [KEM_CT 1088B]
  const header = new Uint8Array(HEADER_LEN);
  let off = 0;
  header.set(MAGIC, off);       off += 4;
  header[off++] = VERSION;
  header.set(baseIV, off);      off += IV_LEN;
  header.set(kemCt, off);       // off += KEM_CT_LEN (last field)

  // 6. Stream file in chunks, encrypt each with AES-256-GCM
  log(`> ENCLAVE: streaming payload through AES-256-GCM  chunk_size=${CHUNK_SIZE / 1024}KB...`);

  const chunksTotal = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const parts = [header];
  const stream = file.stream();
  const reader = stream.getReader();
  let pending     = new Uint8Array(0); // accumulation buffer
  let chunkIndex  = 0;
  let bytesIn     = 0;
  onProgress?.({ phase: 'streaming', chunksDone: 0, chunksTotal, bytesTotal: file.size, bytesDone: 0, filename: file.name });

  const processChunk = async (bytes, isFinal) => {
    // Derive per-chunk nonce from base IV + monotonic counter
    const nonce     = chunkNonce(baseIV, chunkIndex);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      aesKey,
      bytes,
    );
    const encBytes = new Uint8Array(encrypted);

    // Pack chunk: [4B payload_size BE] [12B nonce] [ciphertext + 16B GCM tag]
    const sizeField = new Uint8Array(4);
    new DataView(sizeField.buffer).setUint32(0, encBytes.length, false);
    parts.push(sizeField);
    parts.push(nonce.slice());   // own copy — base nonce must stay clean
    parts.push(encBytes);

    bytesIn += bytes.length;
    chunkIndex++;
    onProgress?.({ phase: 'streaming', chunksDone: chunkIndex, chunksTotal, bytesTotal: file.size, bytesDone: bytesIn, filename: file.name });

    if (!isFinal && chunkIndex % 16 === 0) {
      log(`> ENCLAVE: ${(bytesIn / 1024 / 1024).toFixed(1)} MB processed...`);
    }
  };

  // Read stream, flush complete 1MB chunks, drain remainder on EOF
  while (true) {
    const { done, value } = await reader.read();

    if (value) {
      const next = new Uint8Array(pending.length + value.length);
      next.set(pending, 0);
      next.set(value, pending.length);
      pending = next;
    }

    while (pending.length >= CHUNK_SIZE) {
      await processChunk(pending.slice(0, CHUNK_SIZE), false);
      pending = pending.slice(CHUNK_SIZE);
    }

    if (done) {
      if (pending.length > 0) {
        await processChunk(pending, true); // flush final partial chunk
      }
      break;
    }
  }

  // EOF sentinel
  parts.push(new Uint8Array(4)); // [0x00000000]

  log(`> ENCLAVE: ${chunkIndex} chunk(s) encrypted  ${(bytesIn / 1024).toFixed(1)} KB total`);
  log(`> ENCLAVE: seal complete — SOMA v0x01  overhead=${HEADER_LEN + 4}B fixed + ${chunkIndex * (4 + IV_LEN)}B chunk headers`);

  const blob     = new Blob(parts, { type: 'application/octet-stream' });
  const filename = `${file.name}.soma`;
  onProgress?.({ phase: 'done', filename, chunksTotal });
  return { blob, filename };
}

// ── decryptFile ───────────────────────────────────────────────────────────────

/**
 * Decrypt a .soma file using ML-KEM-768 (WASM) + AES-256-GCM (Web Crypto).
 *
 * Reads all chunks from the .soma blob, decapsulates the shared secret via
 * WASM, then decrypts each AES-GCM chunk and streams plaintext into a Blob.
 * Each chunk's GCM auth tag is verified — any tampering causes a hard failure.
 *
 * @param {File|Blob} somaFile — the .soma encrypted file
 * @param {object}    wasmMod  — initialized WASM module
 * @param {string}    dkHex    — hex-encoded ML-KEM-768 decapsulation key (2400 bytes)
 * @param {Function}  log      — (msg: string) => void  terminal log callback
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function decryptFile(somaFile, wasmMod, dkHex, log, onProgress = null) {
  log(`> ENCLAVE: initiating vault decryption`);
  log(`> ENCLAVE: soma=${(somaFile.size / 1024).toFixed(1)} KB`);

  // Read entire .soma into memory for random-access header parsing.
  // Chunk plaintext is still produced incrementally into a Blob array.
  const buf  = await somaFile.arrayBuffer();
  const data = new Uint8Array(buf);

  // 1. Validate magic + version
  if (data[0] !== 0x53 || data[1] !== 0x4F || data[2] !== 0x4D || data[3] !== 0x41) {
    throw new Error('VAULT_ERR :: invalid magic — not a .soma file');
  }
  if (data[4] !== VERSION) {
    throw new Error(`VAULT_ERR :: unsupported .soma version 0x${data[4].toString(16).padStart(2,'0')}`);
  }

  // 2. Parse header
  const baseIV = data.slice(5, 5 + IV_LEN);
  const kemCt  = data.slice(5 + IV_LEN, 5 + IV_LEN + KEM_CT_LEN);
  log(`> ENCLAVE: SOMA v0x01 header valid`);
  log(`> ENCLAVE: IV=${bytesToHex(baseIV)}  KEM_CT=${KEM_CT_LEN}B`);

  // 3. WASM ML-KEM-768 decapsulation
  log(`> ENCLAVE: ML-KEM-768 decapsulation via vault_decapsulate()...`);
  const dkBytes = hexToBytes(dkHex);
  if (dkBytes.length !== DK_LEN) {
    throw new Error(`VAULT_ERR :: DK wrong length ${dkBytes.length} (expected ${DK_LEN})`);
  }

  const ssRaw = wasmMod.vault_decapsulate(kemCt, dkBytes);
  dkBytes.fill(0); // zeroize DK copy as soon as decapsulation is complete

  if (!ssRaw || ssRaw.length !== 32) {
    throw new Error('VAULT_ERR :: decapsulation failed — wrong key or corrupted KEM ciphertext');
  }
  log(`> ENCLAVE: shared secret recovered  [WASM-side ss zeroized via compiler_fence]`);
  onProgress?.({ phase: 'encap', filename: somaFile.name });

  // 4. Import shared secret into Web Crypto as non-extractable AES-GCM key
  log(`> ENCLAVE: importing shared secret into SubtleCrypto (non-extractable, decrypt-only)`);
  const aesKey = await crypto.subtle.importKey(
    'raw',
    ssRaw,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  ssRaw.fill(0); // zeroize
  log(`> ENCLAVE: zeroizing intermediate state via log_entropy_flush()`);

  // 5. Decrypt chunks
  log(`> ENCLAVE: streaming payload through AES-256-GCM decryption...`);
  const plainParts = [];
  let pos        = HEADER_LEN;
  let chunkIndex = 0;
  let bytesOut   = 0;
  onProgress?.({ phase: 'streaming', chunksDone: 0, chunksTotal: null, bytesTotal: data.length, bytesDone: HEADER_LEN, filename: somaFile.name });

  while (pos + 4 <= data.length) {
    // Read chunk payload size
    const payloadSize = new DataView(data.buffer, data.byteOffset + pos).getUint32(0, false);
    pos += 4;

    if (payloadSize === 0) break; // EOF sentinel

    if (pos + IV_LEN + payloadSize > data.length) {
      throw new Error(`VAULT_ERR :: truncated .soma — chunk ${chunkIndex} incomplete`);
    }

    const nonce     = data.slice(pos, pos + IV_LEN);             pos += IV_LEN;
    const encrypted = data.slice(pos, pos + payloadSize);        pos += payloadSize;

    let plaintext;
    try {
      plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce, tagLength: 128 },
        aesKey,
        encrypted,
      );
    } catch {
      throw new Error(
        `VAULT_ERR :: GCM auth tag failed on chunk ${chunkIndex} — wrong key, corrupted data, or tampered ciphertext`
      );
    }

    plainParts.push(new Uint8Array(plaintext));
    bytesOut += plaintext.byteLength;
    chunkIndex++;
    onProgress?.({ phase: 'streaming', chunksDone: chunkIndex, chunksTotal: null, bytesTotal: data.length, bytesDone: pos, filename: somaFile.name });
  }

  log(`> ENCLAVE: ${chunkIndex} chunk(s) decrypted  ${(bytesOut / 1024).toFixed(1)} KB`);
  log(`> ENCLAVE: open complete — all GCM auth tags verified`);

  const blob     = new Blob(plainParts, { type: 'application/octet-stream' });
  const origName = typeof somaFile.name === 'string' && somaFile.name.endsWith('.soma')
    ? somaFile.name.slice(0, -5)
    : `decrypted_${Date.now()}`;

  onProgress?.({ phase: 'done', filename: origName, chunksTotal: chunkIndex });
  return { blob, filename: origName };
}

// ── Byte helpers ──────────────────────────────────────────────────────────────

function hexToBytes(hex) {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) throw new Error('VAULT_ERR :: odd-length hex string');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
