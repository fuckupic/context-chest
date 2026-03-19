import { deriveItemKey, encryptL2, decryptL2, decryptL2Legacy, encryptL2Legacy, sha256 } from '../crypto';
import { randomBytes } from 'crypto';

describe('per-chest crypto', () => {
  const masterKey = randomBytes(32);
  const plaintext = Buffer.from('test content');

  it('deriveItemKey produces different keys for different chests', () => {
    const key1 = deriveItemKey(masterKey, 'chest-a', 'path/file');
    const key2 = deriveItemKey(masterKey, 'chest-b', 'path/file');
    expect(key1.equals(key2)).toBe(false);
  });

  it('deriveItemKey produces same key for same chest+uri', () => {
    const key1 = deriveItemKey(masterKey, 'default', 'test/uri');
    const key2 = deriveItemKey(masterKey, 'default', 'test/uri');
    expect(key1.equals(key2)).toBe(true);
  });

  it('encryptL2 + decryptL2 round-trip with chestName', () => {
    const encrypted = encryptL2(masterKey, 'default', 'test/uri', plaintext);
    const decrypted = decryptL2(masterKey, 'default', 'test/uri', encrypted);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it('decrypting with wrong chestName fails', () => {
    const encrypted = encryptL2(masterKey, 'chest-a', 'test/uri', plaintext);
    expect(() => decryptL2(masterKey, 'chest-b', 'test/uri', encrypted)).toThrow();
  });

  it('decryptL2Legacy decrypts v0.1 format (no chestName in salt)', () => {
    const encrypted = encryptL2Legacy(masterKey, 'test/uri', plaintext);
    const decrypted = decryptL2Legacy(masterKey, 'test/uri', encrypted);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it('v0.1 encrypted content cannot be decrypted with v0.2 scheme', () => {
    const encrypted = encryptL2Legacy(masterKey, 'test/uri', plaintext);
    expect(() => decryptL2(masterKey, 'default', 'test/uri', encrypted)).toThrow();
  });

  it('sha256 produces consistent hashes', () => {
    const data = Buffer.from('hello');
    const hash1 = sha256(data);
    const hash2 = sha256(data);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });
});
