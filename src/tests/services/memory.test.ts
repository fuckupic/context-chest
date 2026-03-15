import { MemoryService } from '../../services/memory';
import { StorageService } from '../../services/storage';
import { ContextService } from '../../services/context';

// Mock dependencies
jest.mock('../../services/storage');
jest.mock('../../services/context');

const mockPrisma = {
  memoryEntry: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
};

describe('MemoryService', () => {
  let service: MemoryService;
  let mockStorage: jest.Mocked<StorageService>;
  let mockContext: jest.Mocked<ContextService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = new StorageService({} as never) as jest.Mocked<StorageService>;
    mockContext = new ContextService({} as never) as jest.Mocked<ContextService>;
    service = new MemoryService(mockPrisma as never, mockStorage as never, mockContext);
  });

  describe('remember', () => {
    it('should store L2 in S3, metadata in OV (best-effort), record in Prisma', async () => {
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockContext.write = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.upsert.mockResolvedValue({
        id: 'mem-1',
        uri: 'prefs/theme',
        createdAt: new Date(),
      });

      const result = await service.remember('user-1', {
        uri: 'prefs/theme',
        chestId: 'chest-1',
        chestName: 'default',
        l0: 'Theme preference',
        l1: '## Theme\n- Dark mode',
        encryptedL2: Buffer.from('encrypted'),
        sha256: 'abc123',
      });

      expect(mockStorage.upload).toHaveBeenCalledTimes(1);
      expect(mockPrisma.memoryEntry.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.memoryEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_chestId_uri: { userId: 'user-1', chestId: 'chest-1', uri: 'prefs/theme' } },
        })
      );
      expect(result.uri).toBe('prefs/theme');
    });

    it('should use per-chest S3 key path', async () => {
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockContext.write = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.upsert.mockResolvedValue({
        id: 'mem-1',
        uri: 'prefs/theme',
        createdAt: new Date(),
      });

      await service.remember('user-1', {
        uri: 'prefs/theme',
        chestId: 'chest-1',
        chestName: 'default',
        l0: 'Theme preference',
        l1: 'Dark mode',
        encryptedL2: Buffer.from('encrypted'),
        sha256: 'abc123',
      });

      expect(mockStorage.upload).toHaveBeenCalledWith(
        'user-1/chests/chest-1/memories/prefs/theme.enc',
        expect.any(Buffer),
        'abc123'
      );
    });

    it('should continue if OpenViking write fails (best-effort)', async () => {
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockContext.write = jest.fn().mockRejectedValue(new Error('OV down'));
      mockPrisma.memoryEntry.upsert.mockResolvedValue({
        id: 'mem-1',
        uri: 'prefs/theme',
        createdAt: new Date(),
      });

      const result = await service.remember('user-1', {
        uri: 'prefs/theme',
        chestId: 'chest-1',
        chestName: 'default',
        l0: 'x',
        l1: 'y',
        encryptedL2: Buffer.from('enc'),
        sha256: 'abc',
      });

      expect(result.uri).toBe('prefs/theme');
      expect(mockPrisma.memoryEntry.upsert).toHaveBeenCalledTimes(1);
    });

    it('should pass chestName to context.write', async () => {
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockContext.write = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.upsert.mockResolvedValue({
        id: 'mem-1',
        uri: 'prefs/theme',
        createdAt: new Date(),
      });

      await service.remember('user-1', {
        uri: 'prefs/theme',
        chestId: 'chest-1',
        chestName: 'my-chest',
        l0: 'x',
        l1: 'y',
        encryptedL2: Buffer.from('enc'),
        sha256: 'abc',
      });

      expect(mockContext.write).toHaveBeenCalledWith(
        'user-1',
        'prefs/theme',
        { l0: 'x', l1: 'y' },
        'my-chest'
      );
    });
  });

  describe('recall', () => {
    it('should try OpenViking first, fall back to Prisma text search', async () => {
      mockContext.find = jest.fn().mockRejectedValue(new Error('OV unavailable'));
      mockPrisma.memoryEntry.findMany.mockResolvedValue([
        { uri: 'prefs/theme', l0: 'theme pref', l1: 'dark mode', updatedAt: new Date() },
      ]);
      mockPrisma.memoryEntry.count.mockResolvedValue(1);

      const results = await service.recall('user-1', 'chest-1', 'default', {
        query: 'theme',
        limit: 10,
        offset: 0,
      });

      expect(results.data).toHaveLength(1);
      expect(results.data[0].uri).toBe('prefs/theme');
    });

    it('should include chestId in Prisma fallback where clause', async () => {
      mockContext.find = jest.fn().mockRejectedValue(new Error('OV unavailable'));
      mockPrisma.memoryEntry.findMany.mockResolvedValue([]);
      mockPrisma.memoryEntry.count.mockResolvedValue(0);

      await service.recall('user-1', 'chest-1', 'default', {
        query: 'theme',
        limit: 10,
        offset: 0,
      });

      expect(mockPrisma.memoryEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ chestId: 'chest-1' }),
        })
      );
    });

    it('should pass chestName to context.find', async () => {
      mockContext.find = jest.fn().mockResolvedValue({ results: [], total: 0 });
      mockPrisma.memoryEntry.findMany.mockResolvedValue([]);
      mockPrisma.memoryEntry.count.mockResolvedValue(0);

      await service.recall('user-1', 'chest-1', 'my-chest', {
        query: 'theme',
        limit: 10,
        offset: 0,
      });

      expect(mockContext.find).toHaveBeenCalledWith('user-1', 'theme', 10, 0, 'my-chest');
    });
  });

  describe('getContent', () => {
    it('should look up S3 key in Prisma and download', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        s3Key: 'user-1/chests/chest-1/memories/prefs/theme.enc',
      });
      mockStorage.download = jest.fn().mockResolvedValue(Buffer.from('encrypted'));

      const result = await service.getContent('user-1', 'chest-1', 'prefs/theme');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should use compound unique key for lookup', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        s3Key: 'user-1/chests/chest-1/memories/prefs/theme.enc',
      });
      mockStorage.download = jest.fn().mockResolvedValue(Buffer.from('encrypted'));

      await service.getContent('user-1', 'chest-1', 'prefs/theme');

      expect(mockPrisma.memoryEntry.findUnique).toHaveBeenCalledWith({
        where: { userId_chestId_uri: { userId: 'user-1', chestId: 'chest-1', uri: 'prefs/theme' } },
      });
    });

    it('should throw if memory not found', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue(null);
      await expect(service.getContent('user-1', 'chest-1', 'nonexistent')).rejects.toThrow('Memory not found');
    });
  });

  describe('forget', () => {
    it('should delete from OV (best-effort), S3, and Prisma', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        id: 'mem-1',
        s3Key: 'user-1/chests/chest-1/memories/prefs/theme.enc',
      });
      mockContext.delete = jest.fn().mockResolvedValue(undefined);
      mockStorage.delete = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.delete.mockResolvedValue({});

      await service.forget('user-1', 'chest-1', 'default', 'prefs/theme');

      expect(mockContext.delete).toHaveBeenCalledTimes(1);
      expect(mockStorage.delete).toHaveBeenCalledTimes(1);
      expect(mockPrisma.memoryEntry.delete).toHaveBeenCalledTimes(1);
    });

    it('should pass chestName to context.delete', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        id: 'mem-1',
        s3Key: 'user-1/chests/chest-1/memories/prefs/theme.enc',
      });
      mockContext.delete = jest.fn().mockResolvedValue(undefined);
      mockStorage.delete = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.delete.mockResolvedValue({});

      await service.forget('user-1', 'chest-1', 'my-chest', 'prefs/theme');

      expect(mockContext.delete).toHaveBeenCalledWith('user-1', 'prefs/theme', 'my-chest');
    });

    it('should use compound unique key for lookup', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        id: 'mem-1',
        s3Key: 'user-1/chests/chest-1/memories/prefs/theme.enc',
      });
      mockContext.delete = jest.fn().mockResolvedValue(undefined);
      mockStorage.delete = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.delete.mockResolvedValue({});

      await service.forget('user-1', 'chest-1', 'default', 'prefs/theme');

      expect(mockPrisma.memoryEntry.findUnique).toHaveBeenCalledWith({
        where: { userId_chestId_uri: { userId: 'user-1', chestId: 'chest-1', uri: 'prefs/theme' } },
      });
    });
  });

  describe('browse', () => {
    it('should build tree from Prisma entries', async () => {
      mockPrisma.memoryEntry.findMany.mockResolvedValue([
        { uri: 'prefs/theme', l0: 'theme' },
        { uri: 'prefs/editor', l0: 'editor' },
        { uri: 'notes', l0: 'notes' },
      ]);

      const tree = await service.browse('user-1', 'chest-1', '', 2);

      expect(tree).toHaveLength(2); // 'prefs' dir + 'notes' file
    });

    it('should include chestId in Prisma where clause', async () => {
      mockPrisma.memoryEntry.findMany.mockResolvedValue([]);

      await service.browse('user-1', 'chest-1', '', 2);

      expect(mockPrisma.memoryEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ chestId: 'chest-1' }),
        })
      );
    });
  });

  describe('list', () => {
    it('should return paginated entries for a chest', async () => {
      mockPrisma.memoryEntry.findMany.mockResolvedValue([
        { uri: 'prefs/theme', sha256: 'abc', sizeBytes: 100, createdAt: new Date() },
      ]);
      mockPrisma.memoryEntry.count.mockResolvedValue(1);

      const result = await service.list('user-1', 'chest-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should include chestId in both findMany and count where clauses', async () => {
      mockPrisma.memoryEntry.findMany.mockResolvedValue([]);
      mockPrisma.memoryEntry.count.mockResolvedValue(0);

      await service.list('user-1', 'chest-1');

      expect(mockPrisma.memoryEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', chestId: 'chest-1' },
        })
      );
      expect(mockPrisma.memoryEntry.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', chestId: 'chest-1' },
      });
    });
  });

  describe('updateContent', () => {
    it('should update content in S3 and Prisma with new encryption version', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        id: 'mem-1',
        s3Key: 'user-1/chests/chest-1/memories/prefs/theme.enc',
      });
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.update.mockResolvedValue({});

      await service.updateContent(
        'user-1',
        'chest-1',
        'prefs/theme',
        Buffer.from('re-encrypted'),
        'newsha256',
        2
      );

      expect(mockStorage.upload).toHaveBeenCalledWith(
        'user-1/chests/chest-1/memories/prefs/theme.enc',
        expect.any(Buffer),
        'newsha256'
      );
      expect(mockPrisma.memoryEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mem-1' },
          data: expect.objectContaining({ encryptionVersion: 2 }),
        })
      );
    });

    it('should throw if memory not found', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.updateContent('user-1', 'chest-1', 'nonexistent', Buffer.from('x'), 'sha', 2)
      ).rejects.toThrow('Memory not found');
    });

    it('should use compound unique key for lookup', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        id: 'mem-1',
        s3Key: 'user-1/chests/chest-1/memories/prefs/theme.enc',
      });
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.update.mockResolvedValue({});

      await service.updateContent('user-1', 'chest-1', 'prefs/theme', Buffer.from('x'), 'sha', 2);

      expect(mockPrisma.memoryEntry.findUnique).toHaveBeenCalledWith({
        where: { userId_chestId_uri: { userId: 'user-1', chestId: 'chest-1', uri: 'prefs/theme' } },
      });
    });
  });

  describe('autoSortUri', () => {
    it('should delegate to context.categorize', async () => {
      mockContext.categorize = jest.fn().mockResolvedValue('preferences/dark-mode');

      const uri = await service.autoSortUri('user-1', 'my-chest', 'Theme preference', '## Theme\n- Dark mode');

      expect(mockContext.categorize).toHaveBeenCalledWith('user-1', 'my-chest', 'Theme preference', '## Theme\n- Dark mode');
      expect(uri).toBe('preferences/dark-mode');
    });

    it('should return categorized URI from context service', async () => {
      mockContext.categorize = jest.fn().mockResolvedValue('entities/project-alpha');

      const uri = await service.autoSortUri('user-1', 'work', 'Project Alpha', 'Details about project');

      expect(uri).toBe('entities/project-alpha');
    });
  });
});
