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
  let activeChest = chestName;

  // Auto-chest: resolve which chest when using default (no --chest flag)
  if (activeChest === 'default' && !input.path) {
    const { l0: tempL0, l1: tempL1 } = await generateSummaries(input.content);
    try {
      const chestResult = await client.autoChest(tempL0, tempL1);
      activeChest = chestResult.data.chestName;
    } catch {
      // Fall back to default chest
    }
  }

  // Auto-sort: resolve path within the chest
  let uri: string;
  if (input.path) {
    uri = input.path;
  } else {
    const { l0: tempL0, l1: tempL1 } = await generateSummaries(input.content);
    try {
      const sortResult = await client.autoSort(tempL0, tempL1, activeChest);
      uri = sortResult.data.uri;
    } catch {
      uri = `auto/${Date.now()}`;
    }
  }

  const { l0, l1 } = await generateSummaries(input.content, uri);
  const plaintext = Buffer.from(input.content, 'utf-8');
  const encryptedL2 = encryptL2(masterKey, activeChest, uri, plaintext);
  const hash = sha256(Buffer.from(encryptedL2, 'base64'));

  const result = await client.remember({ uri, l0, l1, encryptedL2, sha256: hash, chest: activeChest });
  const chestLabel = activeChest !== 'default' ? `${activeChest} → ` : '';
  return `Remembered at ${chestLabel}${result.data.uri}`;
}
