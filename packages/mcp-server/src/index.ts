#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ContextChestClient } from './client';
import { loadCredentials, saveCredentials, isTokenExpired } from './auth';
import { unwrapMasterKey, deriveWrappingKey } from './crypto';
import { parseL0Response, parseL1Response } from './summarizer';
import { DEFAULT_API_URL } from './config';

import { rememberSchema, handleRemember } from './tools/remember';
import { recallSchema, handleRecall } from './tools/recall';
import { readSchema, handleRead } from './tools/read';
import { forgetSchema, handleForget } from './tools/forget';
import { browseSchema, handleBrowse } from './tools/browse';
import { handleSessionStart } from './tools/session-start';
import { sessionAppendSchema, handleSessionAppend } from './tools/session-append';
import { sessionSaveSchema, handleSessionSave } from './tools/session-save';

const server = new McpServer({
  name: 'context-chest',
  version: '0.2.0',
});

let client: ContextChestClient | null = null;
let masterKey: Buffer | null = null;

function ensureInitialized(): { client: ContextChestClient; masterKey: Buffer; chestName: string } {
  if (!client || !masterKey) {
    throw new Error(
      'Not authenticated. Run `context-chest login` first, or set credentials in ~/.context-chest/credentials.json'
    );
  }
  return { client, masterKey, chestName: client.getChestName() };
}

async function generateSummaries(content: string, uri?: string): Promise<{ l0: string; l1: string }> {
  // Generate safe, vague labels — never leak actual content
  const path = uri ?? 'memory';
  const segments = path.split('/').filter(Boolean);
  const category = segments[0] ?? 'general';
  const topic = segments.slice(1).join(' / ') || 'item';
  const wordCount = content.split(/\s+/).length;

  const l0 = parseL0Response(`${category}: ${topic}`);
  const l1 = parseL1Response(
    `Category: ${category}\nTopic: ${topic}\nSize: ~${wordCount} words\nType: encrypted memory`
  );
  return { l0, l1 };
}

async function generateL0(content: string, uri?: string): Promise<string> {
  const { l0 } = await generateSummaries(content, uri);
  return l0;
}

server.tool('context-chest_remember', 'Store a memory in your encrypted vault', rememberSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleRemember(params, ctx.client, ctx.masterKey, ctx.chestName, generateSummaries);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest_recall', 'Search your memories', recallSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleRecall(params, ctx.client);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest_read', 'Read full content of a memory', readSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleRead(params, ctx.client, ctx.masterKey, ctx.chestName);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest_forget', 'Delete a memory', forgetSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleForget(params, ctx.client);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest_browse', 'Browse your memory directory', browseSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleBrowse(params, ctx.client);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest_session-start', 'Start tracking this conversation', {}, async () => {
  const ctx = ensureInitialized();
  const result = await handleSessionStart(ctx.client);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest_session-append', 'Add a message to current session', sessionAppendSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleSessionAppend(params, ctx.client, ctx.masterKey, ctx.chestName, generateL0);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest_session-save', 'Extract memories and close session', sessionSaveSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleSessionSave(params, ctx.client, ctx.masterKey, ctx.chestName, generateSummaries);
  return { content: [{ type: 'text' as const, text: result }] };
});

async function refreshAndInit(apiUrl: string, refreshToken: string, creds: ReturnType<typeof loadCredentials>, chestName: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      process.stderr.write(`[context-chest] Refresh failed: HTTP ${response.status}\n`);
      return false;
    }

    const data = (await response.json()) as { token: string; refreshToken: string };

    // Update credentials on disk
    if (creds) {
      saveCredentials({
        ...creds,
        jwt: data.token,
        refreshToken: data.refreshToken,
      });
    }

    client = new ContextChestClient({
      baseUrl: apiUrl,
      token: data.token,
      refreshToken: data.refreshToken,
      chestName,
    });

    process.stderr.write('[context-chest] Token refreshed on startup\n');
    return true;
  } catch (err) {
    process.stderr.write(`[context-chest] Refresh error: ${(err as Error).message}\n`);
    return false;
  }
}

async function main() {
  const chestFlag = process.argv.find(arg => arg.startsWith('--chest='));
  const chestName = chestFlag ? chestFlag.split('=')[1] : 'default';
  process.stderr.write(`[context-chest] Chest: ${chestName}\n`);

  // Priority 1: Environment variables (API key auth — no login needed)
  const envApiKey = process.env.CONTEXT_CHEST_API_KEY;
  const envExportKey = process.env.CONTEXT_CHEST_EXPORT_KEY;
  const envApiUrl = process.env.CONTEXT_CHEST_API_URL || DEFAULT_API_URL;

  if (envApiKey && envExportKey) {
    process.stderr.write('[context-chest] Using API key from environment\n');
    client = new ContextChestClient({
      baseUrl: envApiUrl,
      token: envApiKey,
      chestName,
    });

    // Unwrap master key using export key
    try {
      const wrappedMK = await client.getMasterKey();
      const exportKeyBuf = Buffer.from(envExportKey, 'hex');
      // We need userId to derive wrapping key — get it from a lightweight call
      const browseRes = await client.browse('', 1);
      // Extract userId from the API key auth (server resolves it)
      // The master key endpoint already authenticated us, so we can use any endpoint
      // to verify auth works. Now unwrap the master key.
      // We need the userId — let's get it from the auth response or store it.
      // Simpler: try all possible userId derivations. Actually, the export key
      // is deterministic from email+password, so we need the userId for HKDF.
      // Let's add a /v1/auth/me endpoint, or get userId from the master key endpoint.

      // For now: use a dedicated endpoint to get userId
      const meRes = await fetch(`${envApiUrl}/v1/auth/me`, {
        headers: { Authorization: `Bearer ${envApiKey}` },
      });
      if (meRes.ok) {
        const { userId } = (await meRes.json()) as { userId: string };
        const wrappingKey = deriveWrappingKey(exportKeyBuf, userId);
        masterKey = unwrapMasterKey(wrappedMK, wrappingKey);
        process.stderr.write('[context-chest] Master key unwrapped via API key\n');
      } else {
        process.stderr.write('[context-chest] Could not fetch user info for key derivation\n');
      }
    } catch (err) {
      process.stderr.write(`[context-chest] MK unwrap failed: ${(err as Error).message}\n`);
    }
  } else {
    // Priority 2: Credentials file (legacy login flow)
    const creds = loadCredentials();

    if (creds) {
      if (!isTokenExpired(creds.jwt)) {
        client = new ContextChestClient({
          baseUrl: creds.apiUrl || DEFAULT_API_URL,
          token: creds.jwt,
          refreshToken: creds.refreshToken,
          chestName,
        });
      } else if (creds.refreshToken) {
        const ok = await refreshAndInit(creds.apiUrl || DEFAULT_API_URL, creds.refreshToken, creds, chestName);
        if (!ok) {
          process.stderr.write('[context-chest] Could not refresh token. Run context-chest login.\n');
        }
      } else {
        process.stderr.write('[context-chest] Token expired and no refresh token. Run context-chest login.\n');
      }

      if (client && creds.wrappedMasterKey && creds.exportKey && creds.userId) {
        try {
          const wrappedMK = await client.getMasterKey();
          const exportKeyBuf = Buffer.from(creds.exportKey, 'hex');
          const wrappingKey = deriveWrappingKey(exportKeyBuf, creds.userId);
          masterKey = unwrapMasterKey(wrappedMK, wrappingKey);
        } catch (err) {
          process.stderr.write(`[context-chest] MK unwrap failed: ${(err as Error).message}\n`);
        }
      }
    } else {
      process.stderr.write('[context-chest] No credentials found. Set CONTEXT_CHEST_API_KEY + CONTEXT_CHEST_EXPORT_KEY env vars, or run: npx context-chest-mcp login\n');
    }
  }

  // Surface vault contents on startup so the AI has context immediately
  if (client) {
    try {
      const browseRes = await client.browse('', 2);
      const tree = (browseRes as { data: { tree: Array<{ uri: string; type: string; children?: Array<{ uri: string }> }> } }).data.tree;
      if (tree.length > 0) {
        const entries: string[] = [];
        for (const node of tree) {
          if (node.type === 'directory' && node.children) {
            for (const child of node.children) {
              entries.push(child.uri);
            }
          } else {
            entries.push(node.uri);
          }
        }
        process.stderr.write(`[context-chest] Vault loaded: ${entries.join(', ')}\n`);
      }
    } catch {
      // Non-critical — don't block startup
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// If called with "login" or "migrate-v2" argument, run CLI instead of MCP server
if (process.argv.includes('login') || process.argv.includes('migrate-v2')) {
  import('./cli').catch(console.error);
} else {
  main().catch(console.error);
}
