import { z } from 'zod';
import { ContextChestClient } from '../client';

export const forgetSchema = z.object({
  uri: z.string().min(1).describe('Memory URI to delete'),
});

export type ForgetInput = z.infer<typeof forgetSchema>;

export async function handleForget(
  input: ForgetInput,
  client: ContextChestClient
): Promise<string> {
  await client.forget(input.uri);
  return `Deleted memory at ${input.uri}`;
}
