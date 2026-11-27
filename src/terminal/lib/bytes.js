// Byte helpers shared by identityVault.js and accordSeal.js. Pure: no DOM, no WebCrypto.

export const utf8 = (s) => new TextEncoder().encode(s);
export const fromUtf8 = (b) => new TextDecoder('utf-8', { fatal: true }).decode(b);

export function concatBytes(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Strict base64 → bytes. Throws on anything that is not canonical base64. */
export function fromB64(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(str) || str.length % 4 !== 0) {
    throw new TypeError('not base64');
  }
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
