#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ContextChestClient } from './client';
import { loadCredentials, isTokenExpired } from './auth';
import { unwrapMasterKey, deriveWrappingKey } from './crypto';
import { parseL0Response, parseL1Response } from './summarizer';

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
  version: '0.1.0',
});

let client: ContextChestClient | null = null;
let masterKey: Buffer | null = null;

function ensureInitialized(): { client: ContextChestClient; masterKey: Buffer } {
  if (!client || !masterKey) {
    throw new Error(
      'Not authenticated. Run `context-chest login` first, or set credentials in ~/.context-chest/credentials.json'
    );
  }
  return { client, masterKey };
}

async function generateSummaries(content: string): Promise<{ l0: string; l1: string }> {
  const l0 = content.slice(0, 100).replace(/\n/g, ' ').trim();
  const l1 = content.slice(0, 2000).trim();
  return { l0: parseL0Response(l0), l1: parseL1Response(l1) };
}

async function generateL0(content: string): Promise<string> {
  const { l0 } = await generateSummaries(content);
  return l0;
}

server.tool('context-chest:remember', 'Store a memory in your encrypted vault', rememberSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleRemember(params, ctx.client, ctx.masterKey, generateSummaries);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest:recall', 'Search your memories', recallSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleRecall(params, ctx.client);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest:read', 'Read full content of a memory', readSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleRead(params, ctx.client, ctx.masterKey);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest:forget', 'Delete a memory', forgetSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleForget(params, ctx.client);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest:browse', 'Browse your memory directory', browseSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleBrowse(params, ctx.client);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest:session-start', 'Start tracking this conversation', {}, async () => {
  const ctx = ensureInitialized();
  const result = await handleSessionStart(ctx.client);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest:session-append', 'Add a message to current session', sessionAppendSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleSessionAppend(params, ctx.client, ctx.masterKey, generateL0);
  return { content: [{ type: 'text' as const, text: result }] };
});

server.tool('context-chest:session-save', 'Extract memories and close session', sessionSaveSchema.shape, async (params) => {
  const ctx = ensureInitialized();
  const result = await handleSessionSave(params, ctx.client, ctx.masterKey, generateSummaries);
  return { content: [{ type: 'text' as const, text: result }] };
});

async function main() {
  const creds = loadCredentials();

  if (creds && !isTokenExpired(creds.jwt)) {
    client = new ContextChestClient({
      baseUrl: creds.apiUrl,
      token: creds.jwt,
    });

    if (creds.wrappedMasterKey) {
      try {
        const wrappedMK = await client.getMasterKey();
        const devExportKey = Buffer.alloc(32, 0x01);
        const wrappingKey = deriveWrappingKey(devExportKey, 'dev-user');
        masterKey = unwrapMasterKey(wrappedMK, wrappingKey);
      } catch {
        // MK not available
      }
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
