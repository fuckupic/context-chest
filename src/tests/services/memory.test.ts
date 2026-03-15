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
    service = new MemoryService(mockPrisma as never, mockStorage, mockContext);
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
        l0: 'Theme preference',
        l1: '## Theme\n- Dark mode',
        encryptedL2: Buffer.from('encrypted'),
        sha256: 'abc123',
      });

      expect(mockStorage.upload).toHaveBeenCalledTimes(1);
      expect(mockPrisma.memoryEntry.upsert).toHaveBeenCalledTimes(1);
      expect(result.uri).toBe('prefs/theme');
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
        l0: 'x',
        l1: 'y',
        encryptedL2: Buffer.from('enc'),
        sha256: 'abc',
      });

      expect(result.uri).toBe('prefs/theme');
      expect(mockPrisma.memoryEntry.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('recall', () => {
    it('should try OpenViking first, fall back to Prisma text search', async () => {
      mockContext.find = jest.fn().mockRejectedValue(new Error('OV unavailable'));
      mockPrisma.memoryEntry.findMany.mockResolvedValue([
        { uri: 'prefs/theme', l0: 'theme pref', l1: 'dark mode', updatedAt: new Date() },
      ]);
      mockPrisma.memoryEntry.count.mockResolvedValue(1);

      const results = await service.recall('user-1', {
        query: 'theme',
        limit: 10,
        offset: 0,
      });

      expect(results.data).toHaveLength(1);
      expect(results.data[0].uri).toBe('prefs/theme');
    });
  });

  describe('getContent', () => {
    it('should look up S3 key in Prisma and download', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        s3Key: 'user-1/memories/prefs/theme.enc',
      });
      mockStorage.download = jest.fn().mockResolvedValue(Buffer.from('encrypted'));

      const result = await service.getContent('user-1', 'prefs/theme');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should throw if memory not found', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue(null);
      await expect(service.getContent('user-1', 'nonexistent')).rejects.toThrow('Memory not found');
    });
  });

  describe('forget', () => {
    it('should delete from OV (best-effort), S3, and Prisma', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        id: 'mem-1',
        s3Key: 'user-1/memories/prefs/theme.enc',
      });
      mockContext.delete = jest.fn().mockResolvedValue(undefined);
      mockStorage.delete = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.delete.mockResolvedValue({});

      await service.forget('user-1', 'prefs/theme');

      expect(mockContext.delete).toHaveBeenCalledTimes(1);
      expect(mockStorage.delete).toHaveBeenCalledTimes(1);
      expect(mockPrisma.memoryEntry.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('browse', () => {
    it('should build tree from Prisma entries', async () => {
      mockPrisma.memoryEntry.findMany.mockResolvedValue([
        { uri: 'prefs/theme', l0: 'theme' },
        { uri: 'prefs/editor', l0: 'editor' },
        { uri: 'notes', l0: 'notes' },
      ]);

      const tree = await service.browse('user-1', '', 2);

      expect(tree).toHaveLength(2); // 'prefs' dir + 'notes' file
    });
  });
});
