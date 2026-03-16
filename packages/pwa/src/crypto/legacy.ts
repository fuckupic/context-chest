const IV_LENGTH = 12;
const TAG_LENGTH = 128;

async function deriveAesKey(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits', 'deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

export async function decryptL2FromBytesLegacy(
  masterKey: Uint8Array,
  uri: string,
  encryptedBytes: ArrayBuffer
): Promise<Uint8Array> {
  const salt = new TextEncoder().encode(uri);
  const info = new TextEncoder().encode('context-chest-l2');
  const key = await deriveAesKey(masterKey, salt, info);
  const data = new Uint8Array(encryptedBytes);
  const iv = data.slice(0, IV_LENGTH);
  const ciphertext = data.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    ciphertext
  );
  return new Uint8Array(decrypted);
}
