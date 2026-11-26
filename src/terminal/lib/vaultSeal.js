// vaultSeal.js — seals the full encrypted formula for the order vault.
// Output must reach the server whole: any cut makes it undecryptable.

// Hybrid encryption: AES-256-GCM for payload, RSA-OAEP for the AES key
// This handles arbitrary payload sizes while keeping the RSA public key as the trust anchor
export async function sealForVault(plaintext, rsaPubKey) {
  // 1. Generate ephemeral AES-256-GCM key + IV
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 2. Encrypt the formula payload with AES-GCM
  const encoded = new TextEncoder().encode(plaintext);
  const aesCipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);

  // 3. Export the raw AES key and encrypt it with RSA-OAEP (32 bytes — fits easily)
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedAesKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaPubKey, rawAesKey);

  // 4. Pack: base64({ encKey: base64, iv: base64, payload: base64 })
  const b64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  };

  return JSON.stringify({
    k: b64(encryptedAesKey),  // RSA-OAEP encrypted AES key
    iv: b64(iv),              // AES-GCM IV (cleartext — safe)
    p: b64(aesCipher),        // AES-GCM ciphertext
    alg: 'RSA-OAEP+AES-256-GCM',
  });
}
