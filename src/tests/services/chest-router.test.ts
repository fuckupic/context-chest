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

  describe('resolve with keywords', () => {
    it('should route to existing chest when OpenViking similarity is high', async () => {
      mockChestService.list.mockResolvedValue([
        { id: 'c1', name: 'acme-corp', isPublic: false },
      ]);
      mockContextService.find.mockResolvedValue({
        results: [{ uri: 'entities/db', score: 0.8 }],
        total: 1,
      });

      const result = await router.resolve('user-1', ['acme', 'postgresql', 'database']);
      expect(result.chestName).toBe('acme-corp');
      expect(result.isNew).toBe(false);
    });

    it('should match health seed chest from dental keywords', async () => {
      mockChestService.list.mockResolvedValue([]);
      mockChestService.upsertByName.mockResolvedValue({ id: 'c2', name: 'health' });

      const result = await router.resolve('user-1', ['dentist', 'appointment', 'tuesday', 'checkup']);
      expect(result.chestName).toBe('health');
      expect(result.isNew).toBe(true);
    });

    it('should match work seed chest from project keywords', async () => {
      mockChestService.list.mockResolvedValue([]);
      mockChestService.upsertByName.mockResolvedValue({ id: 'c3', name: 'work' });

      const result = await router.resolve('user-1', ['sprint', 'deadline', 'deploy', 'friday']);
      expect(result.chestName).toBe('work');
      expect(result.isNew).toBe(true);
    });

    it('should match finance seed chest from money keywords', async () => {
      mockChestService.list.mockResolvedValue([]);
      mockChestService.upsertByName.mockResolvedValue({ id: 'c4', name: 'finance' });

      const result = await router.resolve('user-1', ['budget', 'quarterly', 'investment', 'portfolio']);
      expect(result.chestName).toBe('finance');
      expect(result.isNew).toBe(true);
    });

    it('should create slug chest from keywords when nothing matches seeds', async () => {
      mockChestService.list.mockResolvedValue([]);
      mockChestService.upsertByName.mockResolvedValue({ id: 'c5', name: 'kubernetes-cluster-migration' });

      const result = await router.resolve('user-1', ['kubernetes', 'cluster', 'migration', 'nodes']);
      expect(result.chestName).toBe('kubernetes-cluster-migration');
      expect(result.isNew).toBe(true);
    });

    it('should fall back to default when OV is unreachable and no keyword match', async () => {
      mockChestService.list.mockResolvedValue([{ id: 'c1', name: 'acme-corp' }]);
      mockContextService.find.mockRejectedValue(new Error('OV down'));
      mockChestService.getOrCreateDefault.mockResolvedValue({ id: 'c-def', name: 'default' });

      const result = await router.resolve('user-1', ['vague', 'stuff', 'misc']);
      expect(result.chestName).toBe('default');
    });

    it('should skip OpenViking when more than 50 chests', async () => {
      const manyChests = Array.from({ length: 51 }, (_, i) => ({ id: `c${i}`, name: `chest-${i}` }));
      mockChestService.list.mockResolvedValue(manyChests);
      mockChestService.getOrCreateDefault.mockResolvedValue({ id: 'c-def', name: 'default' });

      await router.resolve('user-1', ['something', 'random']);
      expect(mockContextService.find).not.toHaveBeenCalled();
    });

    it('should match existing seed chest instead of creating duplicate', async () => {
      mockChestService.list.mockResolvedValue([
        { id: 'c1', name: 'health', isPublic: true },
      ]);
      mockContextService.find.mockResolvedValue({ results: [], total: 0 });

      const result = await router.resolve('user-1', ['doctor', 'appointment', 'medical']);
      expect(result.chestName).toBe('health');
      expect(result.isNew).toBe(false);
      expect(mockChestService.upsertByName).not.toHaveBeenCalled();
    });

    it('should match tools seed chest from dev setup keywords', async () => {
      mockChestService.list.mockResolvedValue([]);
      mockChestService.upsertByName.mockResolvedValue({ id: 'c6', name: 'tools' });

      const result = await router.resolve('user-1', ['vscode', 'extension', 'config', 'settings']);
      expect(result.chestName).toBe('tools');
      expect(result.isNew).toBe(true);
    });

    it('should match personal seed chest from life keywords', async () => {
      mockChestService.list.mockResolvedValue([]);
      mockChestService.upsertByName.mockResolvedValue({ id: 'c7', name: 'personal' });

      const result = await router.resolve('user-1', ['birthday', 'gift', 'wife', 'surprise']);
      expect(result.chestName).toBe('personal');
      expect(result.isNew).toBe(true);
    });
  });
});
