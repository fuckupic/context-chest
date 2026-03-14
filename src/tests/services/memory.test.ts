import { MemoryService } from '../../services/memory';
import { StorageService } from '../../services/storage';
import { ContextService } from '../../services/context';

// Mock dependencies
jest.mock('../../services/storage');
jest.mock('../../services/context');

const mockPrisma = {
  memoryEntry: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
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
    it('should store L2 in S3, metadata in OV, record in Prisma', async () => {
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockContext.write = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.create.mockResolvedValue({
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
      expect(mockContext.write).toHaveBeenCalledWith('user-1', 'prefs/theme', {
        l0: 'Theme preference',
        l1: '## Theme\n- Dark mode',
      });
      expect(mockPrisma.memoryEntry.create).toHaveBeenCalledTimes(1);
      expect(result.uri).toBe('prefs/theme');
    });

    it('should rollback S3 if OpenViking write fails', async () => {
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockContext.write = jest.fn().mockRejectedValue(new Error('OV down'));
      mockStorage.delete = jest.fn().mockResolvedValue(undefined);

      await expect(
        service.remember('user-1', {
          uri: 'prefs/theme',
          l0: 'x',
          l1: 'y',
          encryptedL2: Buffer.from('enc'),
          sha256: 'abc',
        })
      ).rejects.toThrow('OV down');

      expect(mockStorage.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('recall', () => {
    it('should search via ContextService with offset', async () => {
      mockContext.find = jest.fn().mockResolvedValue({
        results: [{ uri: 'prefs/theme', l0: 'Theme', l1: 'Dark', score: 0.9 }],
        total: 42,
      });

      const results = await service.recall('user-1', {
        query: 'theme',
        limit: 10,
        offset: 0,
      });

      expect(mockContext.find).toHaveBeenCalledWith('user-1', 'theme', 10, 0);
      expect(results.data).toHaveLength(1);
      expect(results.total).toBe(42);
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
    it('should delete from OV, S3, and Prisma', async () => {
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
});
