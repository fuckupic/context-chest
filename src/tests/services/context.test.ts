import { ContextService } from '../../services/context';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ContextService', () => {
  let service: ContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContextService({
      baseUrl: 'http://openviking:8000',
      apiKey: 'test-key',
    });
  });

  describe('write', () => {
    it('should POST to OpenViking with user namespace', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      await service.write('user-1', 'preferences/theme', {
        l0: 'Dark mode preference',
        l1: '## Theme\n- Dark mode enabled',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://openviking:8000/api/v1/write',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
          body: expect.stringContaining('user-1'),
        }),
      );
    });
  });

  describe('find', () => {
    it('should search within user namespace and return total', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ uri: 'preferences/theme', l0: 'Dark mode', l1: '', score: 0.9 }],
            total: 42,
          }),
      });
      const { results, total } = await service.find('user-1', 'dark mode', 10, 0);
      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(0.9);
      expect(total).toBe(42);
    });
  });

  describe('delete', () => {
    it('should delete from user namespace', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      await service.delete('user-1', 'preferences/theme');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/delete'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('list', () => {
    it('should list directory contents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            entries: [{ uri: 'preferences/', type: 'directory', l0: '' }],
          }),
      });
      const entries = await service.list('user-1', 'preferences/', 2);
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('directory');
    });
  });

  describe('session operations', () => {
    it('should start a session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      await service.startSession('user-1', 'sess-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/session/create'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should append session message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      await service.appendSessionMessage('user-1', 'sess-1', 'User asked about themes');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/session/append'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should close a session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      await service.closeSession('user-1', 'sess-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/session/close'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      await expect(service.write('user-1', 'test', { l0: '', l1: '' })).rejects.toThrow(
        'OpenViking error: 500',
      );
    });
  });
});
