import { z } from 'zod';
import { ContextChestClient } from '../client';
import { decryptL2 } from '../crypto';

export const readSchema = z.object({
  uri: z.string().min(1).describe('Memory URI to read'),
});

export type ReadInput = z.infer<typeof readSchema>;

export async function handleRead(
  input: ReadInput,
  client: ContextChestClient,
  masterKey: Buffer
): Promise<string> {
  const encrypted = await client.getContent(input.uri);
  const encryptedBase64 = encrypted.toString('base64');
  const decrypted = decryptL2(masterKey, input.uri, encryptedBase64);
  return decrypted.toString('utf-8');
}
