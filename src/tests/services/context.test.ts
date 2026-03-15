import { ContextService } from '../../services/context';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function okResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

function errorResponse(status: number) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'fail' }),
    text: () => Promise.resolve(`error ${status}`),
  };
}

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
    it('should POST to OpenViking resources endpoint', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ success: true }));
      await service.write('user-1', 'preferences/theme', {
        l0: 'Dark mode preference',
        l1: '## Theme\n- Dark mode enabled',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://openviking:8000/api/v1/resources',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('user-1'),
        }),
      );
    });
  });

  describe('find', () => {
    it('should search within user namespace and return total', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({
        results: [{ uri: 'preferences/theme', abstract: 'Dark mode', overview: '', score: 0.9 }],
        total: 42,
      }));
      const { results, total } = await service.find('user-1', 'dark mode', 10, 0);
      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(0.9);
      expect(total).toBe(42);
    });
  });

  describe('delete', () => {
    it('should delete from user namespace', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, text: () => Promise.resolve('') });
      await service.delete('user-1', 'preferences/theme');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fs'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('list', () => {
    it('should list directory contents', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({
        entries: [{ uri: 'preferences/', type: 'directory', abstract: '' }],
      }));
      const entries = await service.list('user-1', 'preferences/', 2);
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('directory');
    });

    it('should return empty array on no such directory error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('no such directory: /foo'),
      });
      const entries = await service.list('user-1', 'nonexistent', 2);
      expect(entries).toEqual([]);
    });
  });

  describe('session operations', () => {
    it('should start a session', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ success: true }));
      await service.startSession('user-1', 'sess-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://openviking:8000/api/v1/sessions',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should append session message', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ success: true }));
      await service.appendSessionMessage('user-1', 'sess-1', 'User asked about themes');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://openviking:8000/api/v1/sessions/sess-1/messages',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should close a session', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ success: true }));
      await service.closeSession('user-1', 'sess-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://openviking:8000/api/v1/sessions/sess-1/commit',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500));
      await expect(service.write('user-1', 'test', { l0: '', l1: '' })).rejects.toThrow(
        'OpenViking error: 500',
      );
    });
  });
});
