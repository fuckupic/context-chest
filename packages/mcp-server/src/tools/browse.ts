import { z } from 'zod';
import { ContextChestClient } from '../client';

export const browseSchema = z.object({
  path: z.string().optional().default('').describe('Directory path to browse'),
});

export type BrowseInput = z.infer<typeof browseSchema>;

export async function handleBrowse(
  input: BrowseInput,
  client: ContextChestClient
): Promise<string> {
  const result = await client.browse(input.path);
  return JSON.stringify(result.data.tree, null, 2);
}
