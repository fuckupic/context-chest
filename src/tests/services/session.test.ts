import { SessionService } from '../../services/session';
import { MemoryService } from '../../services/memory';
import { StorageService } from '../../services/storage';
import { ContextService } from '../../services/context';

jest.mock('../../services/memory');
jest.mock('../../services/storage');
jest.mock('../../services/context');

const mockPrisma = {
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('SessionService', () => {
  let service: SessionService;
  let mockMemory: jest.Mocked<MemoryService>;
  let mockStorage: jest.Mocked<StorageService>;
  let mockContext: jest.Mocked<ContextService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMemory = new MemoryService({} as never, {} as never, {} as never) as jest.Mocked<MemoryService>;
    mockStorage = new StorageService({} as never) as jest.Mocked<StorageService>;
    mockContext = new ContextService({} as never) as jest.Mocked<ContextService>;
    service = new SessionService(mockPrisma as never, mockMemory, mockStorage, mockContext);
  });

  describe('create', () => {
    it('should create session in Prisma and OpenViking', async () => {
      mockPrisma.session.create.mockResolvedValue({
        id: 'sess-1',
        status: 'active',
        createdAt: new Date(),
      });
      mockContext.startSession = jest.fn().mockResolvedValue(undefined);

      const result = await service.create('user-1', 'client-1');

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1', clientId: 'client-1' }),
      });
      expect(mockContext.startSession).toHaveBeenCalledWith('user-1', 'sess-1');
      expect(result.id).toBe('sess-1');
    });
  });

  describe('appendMessage', () => {
    it('should store encrypted message in S3 and send L0 to OpenViking', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        status: 'active',
        messageCount: 0,
      });
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockContext.appendSessionMessage = jest.fn().mockResolvedValue(undefined);
      mockPrisma.session.update.mockResolvedValue({ messageCount: 1 });

      await service.appendMessage('user-1', 'sess-1', {
        role: 'user',
        encryptedContent: Buffer.from('encrypted'),
        l0Summary: 'User asked about themes',
        sha256: 'abc123',
      });

      expect(mockStorage.upload).toHaveBeenCalledTimes(1);
      expect(mockContext.appendSessionMessage).toHaveBeenCalledWith('user-1', 'sess-1', 'User asked about themes');
      expect(mockPrisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { messageCount: { increment: 1 } } })
      );
    });

    it('should reject if session is closed', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        status: 'closed',
      });

      await expect(
        service.appendMessage('user-1', 'sess-1', {
          role: 'user',
          encryptedContent: Buffer.from('x'),
          l0Summary: 'x',
          sha256: 'abc',
        })
      ).rejects.toThrow('Session is closed');
    });
  });

  describe('close', () => {
    it('should store extracted memories and close session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        status: 'active',
      });
      mockMemory.remember = jest.fn().mockResolvedValue({ uri: 'extracted/mem1', createdAt: new Date() });
      mockContext.closeSession = jest.fn().mockResolvedValue(undefined);
      mockPrisma.session.update.mockResolvedValue({});

      const result = await service.close('user-1', 'sess-1', [
        {
          uri: 'extracted/mem1',
          l0: 'Summary',
          l1: 'Overview',
          encryptedL2: Buffer.from('enc'),
          sha256: 'hash1',
        },
      ]);

      expect(mockMemory.remember).toHaveBeenCalledTimes(1);
      expect(mockContext.closeSession).toHaveBeenCalledWith('user-1', 'sess-1');
      expect(mockPrisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'closed' }) })
      );
      expect(result.memoriesExtracted).toBe(1);
    });

    it('should reject more than 50 memories', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        status: 'active',
      });

      const memories = Array.from({ length: 51 }, (_, i) => ({
        uri: `mem/${i}`,
        l0: 'x',
        l1: 'y',
        encryptedL2: Buffer.from('z'),
        sha256: 'h',
      }));

      await expect(service.close('user-1', 'sess-1', memories)).rejects.toThrow(
        'Maximum 50 memories per session close'
      );
    });
  });
});
