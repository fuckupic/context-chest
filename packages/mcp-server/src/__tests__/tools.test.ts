import { handleRemember } from '../tools/remember';
import { handleRecall } from '../tools/recall';
import { handleRead } from '../tools/read';
import { handleForget } from '../tools/forget';
import { handleBrowse } from '../tools/browse';
import { handleSessionStart } from '../tools/session-start';
import { generateMasterKey, encryptL2 } from '../crypto';
import { ContextChestClient } from '../client';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('MCP Tools', () => {
  let client: ContextChestClient;
  let mk: Buffer;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ContextChestClient({ baseUrl: 'http://test:3000', token: 'jwt' });
    mk = generateMasterKey();
  });

  const mockSummaries = async () => ({ l0: 'Test summary', l1: '## Overview\nTest' });

  describe('remember', () => {
    it('should encrypt content and call API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { uri: 'test/path', createdAt: '2026-01-01' } }),
      });

      const result = await handleRemember(
        { content: 'secret data', path: 'test/path' },
        client, mk, 'default', mockSummaries
      );

      expect(result).toContain('test/path');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.encryptedL2).toBeDefined();
      expect(body.encryptedL2).not.toContain('secret data');
    });
  });

  describe('recall', () => {
    it('should format search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [{ uri: 'prefs/theme', l0: 'Dark mode', l1: 'Details', score: 0.95 }],
          meta: { total: 1, page: 1, limit: 5 },
        }),
      });

      const result = await handleRecall({ query: 'theme', limit: 5 }, client);
      expect(result).toContain('Dark mode');
      expect(result).toContain('0.95');
    });

    it('should handle no results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true, data: [], meta: { total: 0, page: 1, limit: 5 },
        }),
      });

      const result = await handleRecall({ query: 'nonexistent', limit: 5 }, client);
      expect(result).toContain('No memories found');
    });
  });

  describe('read', () => {
    it('should decrypt content from API', async () => {
      const encrypted = encryptL2(mk, 'default', 'test/uri', Buffer.from('decrypted content'));
      const encBuf = Buffer.from(encrypted, 'base64');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(encBuf.buffer.slice(encBuf.byteOffset, encBuf.byteOffset + encBuf.byteLength)),
      });

      const result = await handleRead({ uri: 'test/uri' }, client, mk, 'default');
      expect(result).toBe('decrypted content');
    });
  });

  describe('forget', () => {
    it('should call delete and return confirmation', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });
      const result = await handleForget({ uri: 'old/memory' }, client);
      expect(result).toContain('Deleted');
    });
  });

  describe('browse', () => {
    it('should return directory tree', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { tree: [{ uri: 'prefs/', type: 'directory' }] },
        }),
      });

      const result = await handleBrowse({ path: '' }, client);
      expect(result).toContain('prefs/');
    });
  });

  describe('session-start', () => {
    it('should return session ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { id: 'sess-123' } }),
      });

      const result = await handleSessionStart(client);
      expect(result).toContain('sess-123');
    });
  });
});
