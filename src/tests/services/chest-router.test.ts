import { ChestRouter } from '../../services/chest-router';

const mockChestService = {
  list: jest.fn(),
  upsertByName: jest.fn(),
  getOrCreateDefault: jest.fn(),
};

const mockContextService = {
  find: jest.fn(),
};

describe('ChestRouter', () => {
  let router: ChestRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    router = new ChestRouter(mockChestService as never, mockContextService as never);
  });

  describe('resolve', () => {
    it('should route to existing chest when OpenViking similarity is high', async () => {
      mockChestService.list.mockResolvedValue([
        { id: 'c1', name: 'acme-corp', isPublic: false },
      ]);
      mockContextService.find.mockResolvedValue({
        results: [{ uri: 'entities/db', score: 0.8 }],
        total: 1,
      });

      const result = await router.resolve('user-1', 'Acme uses PostgreSQL', 'Database info');
      expect(result.chestName).toBe('acme-corp');
      expect(result.isNew).toBe(false);
    });

    it('should fall back to seed keyword match when no OpenViking match', async () => {
      mockChestService.list.mockResolvedValue([]);
      mockContextService.find.mockResolvedValue({ results: [], total: 0 });
      mockChestService.upsertByName.mockResolvedValue({ id: 'c2', name: 'health' });

      const result = await router.resolve('user-1', 'dentist appointment tuesday', 'Medical');
      expect(result.chestName).toBe('health');
      expect(result.isNew).toBe(true);
    });

    it('should create slug chest when nothing matches', async () => {
      mockChestService.list.mockResolvedValue([]);
      mockContextService.find.mockResolvedValue({ results: [], total: 0 });
      mockChestService.upsertByName.mockResolvedValue({ id: 'c3', name: 'random-topic-here' });

      const result = await router.resolve('user-1', 'Random topic here', 'Details');
      expect(result.chestName).toBe('random-topic-here');
      expect(result.isNew).toBe(true);
    });

    it('should fall back to default chest when OpenViking is unreachable and no keyword match', async () => {
      mockChestService.list.mockResolvedValue([{ id: 'c1', name: 'acme-corp' }]);
      mockContextService.find.mockRejectedValue(new Error('OV down'));
      mockChestService.getOrCreateDefault.mockResolvedValue({ id: 'c-def', name: 'default' });

      const result = await router.resolve('user-1', 'Something vague', 'No keywords');
      expect(result.chestName).toBe('default');
    });

    it('should skip OpenViking when more than 50 chests', async () => {
      const manyChests = Array.from({ length: 51 }, (_, i) => ({ id: `c${i}`, name: `chest-${i}` }));
      mockChestService.list.mockResolvedValue(manyChests);
      mockChestService.getOrCreateDefault.mockResolvedValue({ id: 'c-def', name: 'default' });

      const result = await router.resolve('user-1', 'Something', 'Details');
      expect(mockContextService.find).not.toHaveBeenCalled();
    });

    it('should match existing seed chest instead of creating duplicate', async () => {
      mockChestService.list.mockResolvedValue([
        { id: 'c1', name: 'health', isPublic: true },
      ]);
      mockContextService.find.mockResolvedValue({ results: [], total: 0 });

      const result = await router.resolve('user-1', 'doctor appointment', 'Medical visit');
      expect(result.chestName).toBe('health');
      expect(result.isNew).toBe(false);
      expect(mockChestService.upsertByName).not.toHaveBeenCalled();
    });
  });
});
