import {
  deriveWrappingKey, deriveItemKey, wrapMasterKey, unwrapMasterKey,
  encryptL2, decryptL2, generateMasterKey,
} from '../crypto';

describe('crypto', () => {
  const userId = 'test-user-id';
  const exportKey = Buffer.alloc(32, 0xaa);

  describe('key derivation', () => {
    it('should derive deterministic wrapping key from export_key', () => {
      const key1 = deriveWrappingKey(exportKey, userId);
      const key2 = deriveWrappingKey(exportKey, userId);
      expect(key1).toEqual(key2);
      expect(key1.length).toBe(32);
    });

    it('should derive different keys for different users', () => {
      const key1 = deriveWrappingKey(exportKey, 'user-a');
      const key2 = deriveWrappingKey(exportKey, 'user-b');
      expect(key1).not.toEqual(key2);
    });

    it('should derive deterministic item key from MK + URI', () => {
      const mk = generateMasterKey();
      const key1 = deriveItemKey(mk, 'preferences/theme');
      const key2 = deriveItemKey(mk, 'preferences/theme');
      expect(key1).toEqual(key2);
    });

    it('should derive different keys for different URIs', () => {
      const mk = generateMasterKey();
      const key1 = deriveItemKey(mk, 'preferences/theme');
      const key2 = deriveItemKey(mk, 'preferences/font');
      expect(key1).not.toEqual(key2);
    });
  });

  describe('master key wrap/unwrap', () => {
    it('should wrap and unwrap master key', () => {
      const mk = generateMasterKey();
      const wrappingKey = deriveWrappingKey(exportKey, userId);
      const wrapped = wrapMasterKey(mk, wrappingKey);
      const unwrapped = unwrapMasterKey(wrapped, wrappingKey);
      expect(unwrapped).toEqual(mk);
    });

    it('should fail to unwrap with wrong key', () => {
      const mk = generateMasterKey();
      const wrappingKey = deriveWrappingKey(exportKey, userId);
      const wrongKey = deriveWrappingKey(Buffer.alloc(32, 0xbb), userId);
      const wrapped = wrapMasterKey(mk, wrappingKey);
      expect(() => unwrapMasterKey(wrapped, wrongKey)).toThrow();
    });
  });

  describe('L2 encrypt/decrypt', () => {
    it('should encrypt and decrypt content', () => {
      const mk = generateMasterKey();
      const plaintext = Buffer.from('secret content here');
      const encrypted = encryptL2(mk, 'preferences/theme', plaintext);
      const decrypted = decryptL2(mk, 'preferences/theme', encrypted);
      expect(decrypted).toEqual(plaintext);
    });

    it('should produce different ciphertext each time (random IV)', () => {
      const mk = generateMasterKey();
      const plaintext = Buffer.from('same content');
      const enc1 = encryptL2(mk, 'test', plaintext);
      const enc2 = encryptL2(mk, 'test', plaintext);
      expect(enc1).not.toEqual(enc2);
    });

    it('should produce base64 string output', () => {
      const mk = generateMasterKey();
      const encrypted = encryptL2(mk, 'test', Buffer.from('hello'));
      expect(typeof encrypted).toBe('string');
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });
  });
});
