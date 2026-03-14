const HKDF_HASH = 'SHA-256';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveBits', 'deriveKey']);
}

async function deriveAesKey(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array
): Promise<CryptoKey> {
  const baseKey = await importKey(ikm);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: HKDF_HASH, salt, info },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function deriveWrappingKey(
  exportKey: Uint8Array,
  userId: string
): Promise<CryptoKey> {
  const salt = new TextEncoder().encode(userId);
  const info = new TextEncoder().encode('context-chest-mk-wrap');
  return deriveAesKey(exportKey, salt, info);
}

export async function deriveItemKey(
  masterKey: Uint8Array,
  uri: string
): Promise<CryptoKey> {
  const salt = new TextEncoder().encode(uri);
  const info = new TextEncoder().encode('context-chest-l2');
  return deriveAesKey(masterKey, salt, info);
}

export function generateMasterKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function wrapMasterKey(
  masterKey: Uint8Array,
  wrappingKey: CryptoKey
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    wrappingKey,
    masterKey
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function unwrapMasterKey(
  wrappedBase64: string,
  wrappingKey: CryptoKey
): Promise<Uint8Array> {
  const data = Uint8Array.from(atob(wrappedBase64), (c) => c.charCodeAt(0));
  const iv = data.slice(0, IV_LENGTH);
  const ciphertext = data.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    wrappingKey,
    ciphertext
  );
  return new Uint8Array(decrypted);
}

export async function encryptL2(
  masterKey: Uint8Array,
  uri: string,
  plaintext: Uint8Array
): Promise<string> {
  const key = await deriveItemKey(masterKey, uri);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    plaintext
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptL2FromBytes(
  masterKey: Uint8Array,
  uri: string,
  encryptedBytes: ArrayBuffer
): Promise<Uint8Array> {
  const key = await deriveItemKey(masterKey, uri);
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

export async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
