import { z } from 'zod';
import { ContextChestClient } from '../client';
import { decryptL2, decryptL2Legacy } from '../crypto';

export const readSchema = z.object({
  uri: z.string().min(1).describe('Memory URI to read'),
});

export type ReadInput = z.infer<typeof readSchema>;

export async function handleRead(
  input: ReadInput,
  client: ContextChestClient,
  masterKey: Buffer,
  chestName: string
): Promise<string> {
  const encrypted = await client.getContent(input.uri);
  const encryptedBase64 = encrypted.toString('base64');

  // Try v0.2 per-chest decryption first, fall back to legacy v0.1
  let plaintext: Buffer;
  try {
    plaintext = decryptL2(masterKey, chestName, input.uri, encryptedBase64);
  } catch {
    try {
      plaintext = decryptL2Legacy(masterKey, input.uri, encryptedBase64);
    } catch {
      throw new Error('Failed to decrypt memory — wrong key or corrupted data');
    }
  }

  return plaintext.toString('utf-8');
}
