import { z } from 'zod';
import { ContextChestClient } from '../client';
import { encryptL2, sha256 } from '../crypto';

export const rememberSchema = z.object({
  content: z.string().min(1).describe('The content to remember'),
  path: z.string().optional().describe('Memory path (e.g., "preferences/editor")'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
});

export type RememberInput = z.infer<typeof rememberSchema>;

export async function handleRemember(
  input: RememberInput,
  client: ContextChestClient,
  masterKey: Buffer,
  chestName: string,
  generateSummaries: (content: string, uri?: string) => Promise<{ l0: string; l1: string }>
): Promise<string> {
  let uri: string;

  if (input.path) {
    uri = input.path;
  } else {
    // Client-side auto-sort: ask server for URI first, then encrypt
    const { l0: tempL0, l1: tempL1 } = await generateSummaries(input.content);
    try {
      const sortResult = await client.autoSort(tempL0, tempL1);
      uri = sortResult.data.uri;
    } catch {
      uri = `auto/${Date.now()}`;
    }
  }

  const { l0, l1 } = await generateSummaries(input.content, uri);
  const plaintext = Buffer.from(input.content, 'utf-8');
  const encryptedL2 = encryptL2(masterKey, chestName, uri, plaintext);
  const hash = sha256(Buffer.from(encryptedL2, 'base64'));

  const result = await client.remember({ uri, l0, l1, encryptedL2, sha256: hash });
  return `Remembered at ${result.data.uri}`;
}
