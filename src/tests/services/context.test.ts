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
    it('should POST to OpenViking resources endpoint (no chestName)', async () => {
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

    it('should include per-chest path when chestName is provided', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ success: true }));
      await service.write('user-1', 'preferences/theme', { l0: 'Dark mode', l1: 'details' }, 'work');
      const call = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(call.path).toContain('/chests/work/memories/');
      expect(call.path).toContain('preferences/theme');
    });
  });

  describe('find', () => {
    it('should search within user namespace and return total (no chestName)', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({
        results: [{ uri: 'preferences/theme', abstract: 'Dark mode', overview: '', score: 0.9 }],
        total: 42,
      }));
      const { results, total } = await service.find('user-1', 'dark mode', 10, 0);
      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(0.9);
      expect(total).toBe(42);
    });

    it('should use per-chest target_uri when chestName is provided', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ results: [], total: 0 }));
      await service.find('user-1', 'query', 5, 0, 'work');
      const call = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(call.target_uri).toBe('viking://user/user-1/chests/work/memories');
    });

    it('should strip per-chest root prefix from result URIs', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({
        results: [{
          uri: 'viking://user/user-1/chests/work/memories/entities/project-x',
          abstract: 'Project X',
          overview: '',
          score: 0.8,
        }],
        total: 1,
      }));
      const { results } = await service.find('user-1', 'project', 5, 0, 'work');
      expect(results[0].uri).toBe('entities/project-x');
    });
  });

  describe('delete', () => {
    it('should delete from user namespace (no chestName)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, text: () => Promise.resolve('') });
      await service.delete('user-1', 'preferences/theme');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fs'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('should include per-chest path in URI when chestName is provided', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, text: () => Promise.resolve('') });
      await service.delete('user-1', 'preferences/theme', 'work');
      const url: string = mockFetch.mock.calls[0][0];
      expect(decodeURIComponent(url)).toContain('/chests/work/memories/');
    });
  });

  describe('list', () => {
    it('should list directory contents (no chestName)', async () => {
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

    it('should include per-chest path in URI when chestName is provided', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ entries: [] }));
      await service.list('user-1', 'entities/', 1, 'personal');
      const url: string = mockFetch.mock.calls[0][0];
      expect(decodeURIComponent(url)).toContain('/chests/personal/memories/');
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

  describe('categorize', () => {
    it('should use vector search result category when available', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({
        results: [{
          uri: 'viking://user/user-1/chests/default/memories/preferences/editor-config',
          abstract: 'Editor config',
          overview: '',
          score: 0.95,
        }],
        total: 1,
      }));
      const path = await service.categorize('user-1', 'default', 'Editor config', 'Uses dark theme');
      expect(path).toBe('preferences/editor-config');
    });

    it('should fall back to keyword heuristic when OpenViking fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const path = await service.categorize('user-1', 'default', 'Bug in login flow', '');
      expect(path).toBe('cases/bug-in-login-flow');
    });

    it('should fall back to keyword heuristic when results are empty', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ results: [], total: 0 }));
      const path = await service.categorize('user-1', 'default', 'Meeting notes for sprint', '');
      expect(path).toBe('events/meeting-notes-for-sprint');
    });

    it('should default to entities category for unknown topics', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ results: [], total: 0 }));
      const path = await service.categorize('user-1', 'default', 'Some random thing', '');
      expect(path).toBe('entities/some-random-thing');
    });

    it('should use chestName in find call during categorize', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ results: [], total: 0 }));
      await service.categorize('user-1', 'work', 'Some topic', 'details');
      const call = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(call.target_uri).toBe('viking://user/user-1/chests/work/memories');
    });
  });
});
