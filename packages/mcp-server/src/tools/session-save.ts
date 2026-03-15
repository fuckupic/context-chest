import { z } from 'zod';
import { ContextChestClient } from '../client';
import { encryptL2, sha256 } from '../crypto';

export const sessionSaveSchema = z.object({
  sessionId: z.string().min(1).describe('Session ID to close'),
  memories: z.array(z.object({
    content: z.string().min(1),
    path: z.string().min(1),
  })).describe('Memories extracted from the conversation'),
});

export type SessionSaveInput = z.infer<typeof sessionSaveSchema>;

export async function handleSessionSave(
  input: SessionSaveInput,
  client: ContextChestClient,
  masterKey: Buffer,
  chestName: string,
  generateSummaries: (content: string, uri?: string) => Promise<{ l0: string; l1: string }>
): Promise<string> {
  const preparedMemories = await Promise.all(
    input.memories.map(async (m) => {
      const { l0, l1 } = await generateSummaries(m.content, m.path);
      const plaintext = Buffer.from(m.content, 'utf-8');
      const encryptedL2 = encryptL2(masterKey, chestName, m.path, plaintext);
      const hash = sha256(Buffer.from(encryptedL2, 'base64'));
      return { uri: m.path, l0, l1, encryptedL2, sha256: hash };
    })
  );

  const result = await client.closeSession(input.sessionId, preparedMemories);
  return `Session closed. ${result.data.memoriesExtracted} memories extracted.`;
}
