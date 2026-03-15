import type { PluginAPI } from './types';
import { encryptL2, decryptL2, deriveWrappingKey, unwrapMasterKey, sha256 } from './crypto';

const DEFAULT_API_URL = 'https://api-production-e2cd6.up.railway.app';

interface PluginConfig {
  apiUrl?: string;
  apiToken: string;
  exportKey: string;
  userId: string;
}

let masterKey: Buffer | null = null;

async function initMasterKey(config: PluginConfig): Promise<Buffer> {
  if (masterKey) return masterKey;

  const baseUrl = config.apiUrl || DEFAULT_API_URL;
  const res = await fetch(`${baseUrl}/v1/auth/master-key`, {
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });

  if (!res.ok) throw new Error('Failed to fetch master key. Is your token valid?');

  const { encryptedMasterKey } = (await res.json()) as { encryptedMasterKey: string };
  const exportKeyBuf = Buffer.from(config.exportKey, 'hex');
  const wrappingKey = deriveWrappingKey(exportKeyBuf, config.userId);
  masterKey = unwrapMasterKey(encryptedMasterKey, wrappingKey);
  return masterKey;
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

async function requestBinary(config: PluginConfig, path: string): Promise<Buffer> {
  const baseUrl = config.apiUrl || DEFAULT_API_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'X-Agent-Name': 'OpenClaw',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export default function contextChestPlugin(api: PluginAPI, config: PluginConfig) {

  // Remember — encrypts client-side before sending
  api.registerTool({
    name: 'context_chest_remember',
    description: 'Store a memory in your encrypted vault. Content is AES-256-GCM encrypted on your machine before being sent. Use paths like "project/stack" or "preferences/editor" to organize.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'What to remember' },
        path: { type: 'string', description: 'Memory path (e.g., "project/architecture")' },
      },
      required: ['content', 'path'],
    },
    async execute(_id: string, params: { content: string; path: string }) {
      const mk = await initMasterKey(config);
      const uri = params.path;

      // Encrypt content locally — server never sees plaintext
      const plaintext = Buffer.from(params.content, 'utf-8');
      const encrypted = encryptL2(mk, uri, plaintext);
      const hash = sha256(Buffer.from(encrypted, 'base64'));

      // Safe metadata only — no content leaks
      const category = uri.split('/')[0] || 'general';
      const topic = uri.split('/').slice(1).join('/') || 'item';
      const l0 = `${category}: ${topic}`;
      const l1 = `Category: ${category}\nTopic: ${topic}\nSize: ~${params.content.split(/\s+/).length} words\nType: encrypted memory`;

      const result = await request(config, 'POST', '/v1/memory/remember', {
        uri,
        l0,
        l1,
        encryptedL2: encrypted,
        sha256: hash,
      }) as { data: { uri: string } };

      return textResult(`Encrypted and stored at ${result.data.uri}`);
    },
  });

  // Read — fetches ciphertext, decrypts locally
  api.registerTool({
    name: 'context_chest_read',
    description: 'Read and decrypt a memory from your vault. Decryption happens on your machine.',
    parameters: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'Memory URI to read' },
      },
      required: ['uri'],
    },
    async execute(_id: string, params: { uri: string }) {
      const mk = await initMasterKey(config);
      const encryptedBuf = await requestBinary(config, `/v1/memory/content/${params.uri}`);
      const encryptedBase64 = encryptedBuf.toString('base64');
      const decrypted = decryptL2(mk, params.uri, encryptedBase64);
      return textResult(decrypted.toString('utf-8'));
    },
  });

  // Recall
  api.registerTool({
    name: 'context_chest_recall',
    description: 'Search your encrypted memory vault by keyword.',
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
      }) as { data: Array<{ uri: string; l0: string; score: number }> };

      if (result.data.length === 0) {
        return textResult('No memories found.');
      }

      const lines = result.data.map((m, i) =>
        `${i + 1}. [${m.uri}] ${m.l0}`
      );
      return textResult(`Found ${result.data.length} memories:\n\n${lines.join('\n')}`);
    },
  });

  // Browse
  api.registerTool({
    name: 'context_chest_browse',
    description: 'Browse your encrypted memory vault as a directory tree.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (empty for root)', default: '' },
      },
    },
    async execute(_id: string, params: { path?: string }) {
      const result = await request(config, 'GET',
        `/v1/memory/browse?path=${encodeURIComponent(params.path || '')}&depth=2`
      ) as { data: { tree: Array<{ uri: string; l0: string; type: string; children?: Array<{ uri: string; l0: string }> }> } };

      if (result.data.tree.length === 0) {
        return textResult('Vault is empty.');
      }

      const lines: string[] = [];
      for (const node of result.data.tree) {
        if (node.type === 'directory') {
          lines.push(`[DIR] ${node.uri}/`);
          for (const child of node.children || []) {
            lines.push(`  [FILE] ${child.uri}`);
          }
        } else {
          lines.push(`[FILE] ${node.uri}`);
        }
      }
      return textResult(lines.join('\n'));
    },
  });

  // Forget
  api.registerTool({
    name: 'context_chest_forget',
    description: 'Delete a memory from your encrypted vault.',
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
