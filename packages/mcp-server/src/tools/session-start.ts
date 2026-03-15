import { ContextChestClient } from '../client';

export async function handleSessionStart(
  client: ContextChestClient
): Promise<string> {
  const result = await client.createSession();
  return `Session started: ${result.data.id}`;
}
