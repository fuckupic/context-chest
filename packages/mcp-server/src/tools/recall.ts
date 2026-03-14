import { z } from 'zod';
import { ContextChestClient } from '../client';

export const recallSchema = z.object({
  query: z.string().min(1).describe('What to search for'),
  limit: z.number().optional().default(5).describe('Max results'),
});

export type RecallInput = z.infer<typeof recallSchema>;

export async function handleRecall(
  input: RecallInput,
  client: ContextChestClient
): Promise<string> {
  const result = await client.recall(input.query, input.limit, 0);
  if (result.data.length === 0) {
    return 'No memories found matching your query.';
  }
  const lines = result.data.map(
    (r, i) => `${i + 1}. [${r.uri}] (score: ${r.score.toFixed(2)})\n   ${r.l0}\n   ${r.l1}`
  );
  return `Found ${result.meta.total} memories:\n\n${lines.join('\n\n')}`;
}
