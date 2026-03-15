import type { PluginAPI } from './types';

const DEFAULT_API_URL = 'https://api-production-e2cd6.up.railway.app';

interface PluginConfig {
  apiUrl?: string;
  apiToken: string;
}

async function request(config: PluginConfig, method: string, path: string, body?: unknown): Promise<unknown> {
  const baseUrl = config.apiUrl || DEFAULT_API_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiToken}`,
      'X-Agent-Name': 'OpenClaw',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error((err as Record<string, string>).message || `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined;
  return response.json();
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export default function contextChestPlugin(api: PluginAPI, config: PluginConfig) {
  // Remember
  api.registerTool({
    name: 'context_chest_remember',
    description: 'Store a memory in your encrypted vault. Use paths like "project/stack" or "preferences/editor" to organize.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'What to remember' },
        path: { type: 'string', description: 'Memory path (e.g., "project/architecture")' },
      },
      required: ['content', 'path'],
    },
    async execute(_id: string, params: { content: string; path: string }) {
      const uri = params.path;
      const l0 = `${uri.split('/')[0]}: ${uri.split('/').slice(1).join('/')}`;
      const l1 = `Category: ${uri.split('/')[0]}\nTopic: ${uri.split('/').slice(1).join('/')}\nType: encrypted memory`;

      // For the OpenClaw plugin, we send content as l1 summary since we don't have
      // client-side encryption keys. Full E2E encryption requires the MCP server.
      // This still stores the memory server-side and makes it searchable.
      const result = await request(config, 'POST', '/v1/memory/remember', {
        uri,
        l0,
        l1,
        encryptedL2: Buffer.from(params.content).toString('base64'),
        sha256: 'openclaw-plugin',
      }) as { data: { uri: string } };

      return textResult(`Remembered at ${result.data.uri}`);
    },
  });

  // Recall
  api.registerTool({
    name: 'context_chest_recall',
    description: 'Search your memory vault. Returns matching memories by keyword.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for' },
      },
      required: ['query'],
    },
    async execute(_id: string, params: { query: string }) {
      const result = await request(config, 'POST', '/v1/memory/recall', {
        query: params.query,
        limit: 10,
        offset: 0,
      }) as { data: Array<{ uri: string; l0: string; l1: string; score: number }> };

      if (result.data.length === 0) {
        return textResult('No memories found.');
      }

      const lines = result.data.map((m, i) =>
        `${i + 1}. [${m.uri}] (score: ${m.score.toFixed(2)})\n   ${m.l0}`
      );
      return textResult(`Found ${result.data.length} memories:\n\n${lines.join('\n\n')}`);
    },
  });

  // Browse
  api.registerTool({
    name: 'context_chest_browse',
    description: 'Browse your memory vault as a directory tree.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to browse (empty for root)', default: '' },
      },
    },
    async execute(_id: string, params: { path?: string }) {
      const result = await request(config, 'GET',
        `/v1/memory/browse?path=${encodeURIComponent(params.path || '')}&depth=2`
      ) as { data: { tree: Array<{ uri: string; l0: string; type: string; children?: unknown[] }> } };

      if (result.data.tree.length === 0) {
        return textResult('Vault is empty.');
      }

      const lines: string[] = [];
      for (const node of result.data.tree) {
        if (node.type === 'directory') {
          lines.push(`📁 ${node.uri}/`);
          for (const child of (node.children || []) as Array<{ uri: string; l0: string }>) {
            lines.push(`   📄 ${child.uri}`);
          }
        } else {
          lines.push(`📄 ${node.uri}`);
        }
      }
      return textResult(lines.join('\n'));
    },
  });

  // Forget
  api.registerTool({
    name: 'context_chest_forget',
    description: 'Delete a memory from your vault.',
    parameters: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'Memory URI to delete' },
      },
      required: ['uri'],
    },
    async execute(_id: string, params: { uri: string }) {
      await request(config, 'DELETE', `/v1/memory/forget/${params.uri}`);
      return textResult(`Deleted ${params.uri}`);
    },
  });
}
