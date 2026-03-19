import { z } from 'zod';
import { ContextChestClient } from '../client';
import { encryptL2, sha256 } from '../crypto';

export const rememberSchema = z.object({
  content: z.string().min(1).describe('The content to remember'),
  summary: z.string().optional().describe('One-sentence summary of this memory (improves search quality). Example: "User prefers PostgreSQL over MySQL for new projects"'),
  path: z.string().optional().describe('Memory path (e.g., "preferences/editor")'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
});

export type RememberInput = z.infer<typeof rememberSchema>;

// Extract meaningful keywords from plaintext content — client-side only, never sent as raw content
function extractKeywords(content: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about',
    'that', 'this', 'it', 'its', 'i', 'my', 'we', 'our', 'you', 'your',
    'they', 'their', 'he', 'she', 'him', 'her', 'and', 'or', 'but', 'not',
    'no', 'so', 'if', 'then', 'than', 'when', 'what', 'which', 'who',
    'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'only', 'own', 'same', 'also', 'just', 'use', 'uses',
    'using', 'used', 'very', 'really', 'quite', 'still', 'already',
    'remember', 'note', 'always', 'never', 'like', 'want', 'get', 'make',
  ]);

  return content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w))
    .slice(0, 20);
}

export async function handleRemember(
  input: RememberInput,
  client: ContextChestClient,
  masterKey: Buffer,
  chestName: string,
  generateSummaries: (content: string, uri?: string) => Promise<{ l0: string; l1: string }>
): Promise<string> {
  let activeChest = chestName;

  // Auto-chest: resolve which chest when using default (no --chest flag)
  if (activeChest === 'default') {
    // Extract keywords from plaintext locally — only keywords are sent to server, not raw content
    const keywords = extractKeywords(input.content);
    try {
      const chestResult = await client.autoChest(keywords);
      activeChest = chestResult.data.chestName;
    } catch {
      // Fall back to default chest
    }
  }

  // Auto-sort: resolve path within the chest using keywords (not generic summaries)
  let uri: string;
  if (input.path) {
    uri = input.path;
  } else {
    const keywords = extractKeywords(input.content);
    const keywordL0 = keywords.slice(0, 5).join(' ');
    const keywordL1 = keywords.join(' ');
    try {
      const sortResult = await client.autoSort(keywordL0, keywordL1, activeChest);
      uri = sortResult.data.uri;
    } catch {
      // Fallback: generate a slug from keywords instead of timestamp
      const slug = keywords.slice(0, 3).join('-') || `auto-${Date.now()}`;
      uri = `entities/${slug}`;
    }
  }

  // Generate searchable metadata: prefer agent-provided summary, fall back to keywords
  const l0 = input.summary
    ? input.summary.slice(0, 500)
    : extractKeywords(input.content).slice(0, 5).join(' ') || uri.split('/').pop() || 'memory';
  const l1 = input.summary
    ? input.content.slice(0, 2000).replace(/\n+/g, ' ').trim()
    : extractKeywords(input.content).join(' ') || input.content.slice(0, 200);
  const plaintext = Buffer.from(input.content, 'utf-8');
  const encryptedL2 = encryptL2(masterKey, activeChest, uri, plaintext);
  const hash = sha256(Buffer.from(encryptedL2, 'base64'));

  const result = await client.remember({ uri, l0, l1, encryptedL2, sha256: hash, chest: activeChest });
  const chestLabel = activeChest !== 'default' ? `${activeChest} → ` : '';
  return `Remembered at ${chestLabel}${result.data.uri}`;
}
