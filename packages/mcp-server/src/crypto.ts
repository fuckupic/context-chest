import { createHash, createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'crypto';

const HKDF_HASH = 'sha256';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function generateMasterKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

export function deriveWrappingKey(exportKey: Buffer, userId: string): Buffer {
  return Buffer.from(
    hkdfSync(HKDF_HASH, exportKey, userId, 'context-chest-mk-wrap', KEY_LENGTH)
  );
}

export function deriveItemKey(masterKey: Buffer, chestName: string, uri: string): Buffer {
  const salt = `${chestName}/${uri}`;
  return Buffer.from(hkdfSync(HKDF_HASH, masterKey, salt, 'context-chest-l2', KEY_LENGTH));
}

export function wrapMasterKey(masterKey: Buffer, wrappingKey: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', wrappingKey, iv);
  const encrypted = Buffer.concat([cipher.update(masterKey), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

export function unwrapMasterKey(wrapped: string, wrappingKey: Buffer): Buffer {
  const data = Buffer.from(wrapped, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', wrappingKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptL2(masterKey: Buffer, chestName: string, uri: string, plaintext: Buffer): string {
  const itemKey = deriveItemKey(masterKey, chestName, uri);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', itemKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

export function decryptL2(masterKey: Buffer, chestName: string, uri: string, encryptedBase64: string): Buffer {
  const itemKey = deriveItemKey(masterKey, chestName, uri);
  const data = Buffer.from(encryptedBase64, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', itemKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function deriveItemKeyLegacy(masterKey: Buffer, uri: string): Buffer {
  return Buffer.from(hkdfSync(HKDF_HASH, masterKey, uri, 'context-chest-l2', KEY_LENGTH));
}

export function encryptL2Legacy(masterKey: Buffer, uri: string, plaintext: Buffer): string {
  const itemKey = deriveItemKeyLegacy(masterKey, uri);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', itemKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

export function decryptL2Legacy(masterKey: Buffer, uri: string, encryptedBase64: string): Buffer {
  const itemKey = deriveItemKeyLegacy(masterKey, uri);
  const data = Buffer.from(encryptedBase64, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', itemKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}
