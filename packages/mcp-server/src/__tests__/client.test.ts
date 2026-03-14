import { ContextChestClient } from '../client';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ContextChestClient', () => {
  let client: ContextChestClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ContextChestClient({ baseUrl: 'http://localhost:3000', token: 'test-jwt' });
  });

  describe('remember', () => {
    it('should POST to /v1/memory/remember', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { uri: 'test', createdAt: '2026-01-01' } }),
      });
      const result = await client.remember({ uri: 'test', l0: 'summary', l1: 'overview', encryptedL2: 'base64data', sha256: 'a'.repeat(64) });
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/v1/memory/remember', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-jwt' }) }));
      expect(result.data.uri).toBe('test');
    });
  });

  describe('recall', () => {
    it('should POST to /v1/memory/recall', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [{ uri: 'test', l0: 'x', l1: 'y', score: 0.9 }], meta: { total: 1, page: 1, limit: 10 } }),
      });
      const result = await client.recall('dark mode', 10, 0);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getContent', () => {
    it('should GET from /v1/memory/content/*', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(3)),
      });
      const result = await client.getContent('preferences/theme');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/v1/memory/content/preferences/theme', expect.objectContaining({ method: 'GET' }));
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('forget', () => {
    it('should DELETE /v1/memory/forget/*', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });
      await client.forget('preferences/theme');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/v1/memory/forget/preferences/theme', expect.objectContaining({ method: 'DELETE' }));
    });
  });

  describe('sessions', () => {
    it('should create a session', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: { id: 'sess-1' } }) });
      const result = await client.createSession();
      expect(result.data.id).toBe('sess-1');
    });

    it('should close a session with memories', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: { memoriesExtracted: 2 } }) });
      const result = await client.closeSession('sess-1', []);
      expect(result.data.memoriesExtracted).toBe(2);
    });
  });

  describe('master key', () => {
    it('should PUT master key', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });
      await client.putMasterKey('wrapped-mk-base64');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/v1/auth/master-key', expect.objectContaining({ method: 'PUT' }));
    });

    it('should GET master key', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ encryptedMasterKey: 'wrapped-mk' }) });
      const result = await client.getMasterKey();
      expect(result).toBe('wrapped-mk');
    });
  });

  describe('error handling', () => {
    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ code: 'UNAUTHORIZED', message: 'Invalid token' }) });
      await expect(client.recall('test', 10, 0)).rejects.toThrow('UNAUTHORIZED');
    });
  });
});
