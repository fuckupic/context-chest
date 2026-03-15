import { z } from 'zod';
import { ContextChestClient } from '../client';
import { encryptL2, sha256 } from '../crypto';

export const sessionAppendSchema = z.object({
  sessionId: z.string().min(1).describe('Session ID'),
  role: z.string().min(1).describe('Message role (user/assistant)'),
  content: z.string().min(1).describe('Message content'),
});

export type SessionAppendInput = z.infer<typeof sessionAppendSchema>;

export async function handleSessionAppend(
  input: SessionAppendInput,
  client: ContextChestClient,
  masterKey: Buffer,
  chestName: string,
  generateL0: (content: string, uri?: string) => Promise<string>
): Promise<string> {
  const l0Summary = await generateL0(input.content, `session/${input.sessionId}`);
  const plaintext = Buffer.from(input.content, 'utf-8');
  const encryptedContent = encryptL2(masterKey, chestName, `session-msg-${Date.now()}`, plaintext);
  const hash = sha256(Buffer.from(encryptedContent, 'base64'));

  const result = await client.appendMessage(input.sessionId, {
    role: input.role,
    encryptedContent,
    l0Summary,
    sha256: hash,
  });

  return `Message ${result.data.messageIndex} added to session ${input.sessionId}`;
}
