import { UsageService } from '../../services/usage';

const mockUpsert = jest.fn();
const mockFindUnique = jest.fn();
const mockCount = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    usageRecord: { upsert: mockUpsert, findUnique: mockFindUnique },
    memoryEntry: { count: mockCount },
  })),
}));

describe('UsageService', () => {
  let service: UsageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsageService();
  });

  describe('increment', () => {
    it('should upsert usage record for current period', async () => {
      mockUpsert.mockResolvedValueOnce({});
      await service.increment('user-1', 'remember');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_action_period: {
              userId: 'user-1',
              action: 'remember',
              period: expect.stringMatching(/^\d{4}-\d{2}$/),
            },
          },
        })
      );
    });
  });

  describe('checkMemoryLimit', () => {
    it('should not throw when under limit', async () => {
      mockCount.mockResolvedValueOnce(50);
      await expect(service.checkMemoryLimit('user-1', 1000)).resolves.not.toThrow();
    });

    it('should throw when at limit', async () => {
      mockCount.mockResolvedValueOnce(1000);
      await expect(service.checkMemoryLimit('user-1', 1000)).rejects.toThrow('USAGE_LIMIT_REACHED');
    });
  });

  describe('checkOperationLimit', () => {
    it('should not throw when under limit', async () => {
      mockFindUnique.mockResolvedValueOnce({ count: 50 });
      await expect(service.checkOperationLimit('user-1', 'recall', 5000)).resolves.not.toThrow();
    });

    it('should not throw when no record exists', async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      await expect(service.checkOperationLimit('user-1', 'recall', 5000)).resolves.not.toThrow();
    });

    it('should throw when at limit', async () => {
      mockFindUnique.mockResolvedValueOnce({ count: 5000 });
      await expect(service.checkOperationLimit('user-1', 'recall', 5000)).rejects.toThrow('USAGE_LIMIT_REACHED');
    });
  });
});
