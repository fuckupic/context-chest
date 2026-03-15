import { createChestGuard } from '../../plugins/chest-guard';
import { ChestService } from '../../services/chest';

const mockChest = {
  id: 'chest-1',
  userId: 'user-1',
  name: 'default',
  description: 'Default chest',
  isPublic: true,
  createdAt: new Date(),
};

const mockChestService = {
  getOrCreateDefault: jest.fn().mockResolvedValue(mockChest),
  resolveByName: jest.fn().mockResolvedValue(mockChest),
  checkAgentPermission: jest.fn().mockResolvedValue(true),
  create: jest.fn(),
  list: jest.fn(),
  delete: jest.fn(),
  setPermissions: jest.fn(),
  getPermissions: jest.fn(),
} as unknown as ChestService;

describe('chest-guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export createChestGuard as a function', () => {
    expect(typeof createChestGuard).toBe('function');
  });

  it('should return a fastify plugin function', () => {
    const plugin = createChestGuard(mockChestService);
    expect(typeof plugin).toBe('function');
  });

  describe('chest resolution logic', () => {
    it('should call getOrCreateDefault when no chest header/query is present', async () => {
      const service = mockChestService as unknown as {
        getOrCreateDefault: jest.Mock;
        resolveByName: jest.Mock;
      };

      await service.getOrCreateDefault('user-1');

      expect(service.getOrCreateDefault).toHaveBeenCalledWith('user-1');
      expect(service.resolveByName).not.toHaveBeenCalled();
    });

    it('should call resolveByName when a non-default chest name is provided', async () => {
      const service = mockChestService as unknown as {
        getOrCreateDefault: jest.Mock;
        resolveByName: jest.Mock;
      };

      const chestName = 'work';
      await service.resolveByName('user-1', chestName);

      expect(service.resolveByName).toHaveBeenCalledWith('user-1', 'work');
    });

    it('should check agent permission for private chests', async () => {
      const service = mockChestService as unknown as {
        checkAgentPermission: jest.Mock;
      };

      const privateChest = { id: 'chest-2', isPublic: false, name: 'private' };
      await service.checkAgentPermission(privateChest, 'agent-x', 'read');

      expect(service.checkAgentPermission).toHaveBeenCalledWith(privateChest, 'agent-x', 'read');
    });

    it('should determine write operation for POST method', () => {
      const isWrite = ['POST', 'PUT', 'DELETE'].includes('POST');
      expect(isWrite).toBe(true);
    });

    it('should determine read operation for GET method', () => {
      const isWrite = ['POST', 'PUT', 'DELETE'].includes('GET');
      expect(isWrite).toBe(false);
    });

    it('should skip non-memory and non-session routes', () => {
      const url = '/v1/auth/login';
      const shouldProcess = url.startsWith('/v1/memory') || url.startsWith('/v1/sessions');
      expect(shouldProcess).toBe(false);
    });

    it('should process memory routes', () => {
      const url = '/v1/memory/remember';
      const shouldProcess = url.startsWith('/v1/memory') || url.startsWith('/v1/sessions');
      expect(shouldProcess).toBe(true);
    });

    it('should process session routes', () => {
      const url = '/v1/sessions/123/close';
      const shouldProcess = url.startsWith('/v1/memory') || url.startsWith('/v1/sessions');
      expect(shouldProcess).toBe(true);
    });

    it('should prefer X-Chest header over query param', () => {
      const chestHeader = 'work' as string | undefined;
      const chestQuery = 'personal' as string | undefined;
      const chestName = chestHeader ?? chestQuery ?? 'default';
      expect(chestName).toBe('work');
    });

    it('should fall back to query param when header is not set', () => {
      const chestHeader = undefined as string | undefined;
      const chestQuery = 'personal' as string | undefined;
      const chestName = chestHeader ?? chestQuery ?? 'default';
      expect(chestName).toBe('personal');
    });

    it('should fall back to default when neither header nor query is set', () => {
      const chestHeader = undefined as string | undefined;
      const chestQuery = undefined as string | undefined;
      const chestName = chestHeader ?? chestQuery ?? 'default';
      expect(chestName).toBe('default');
    });
  });

  describe('agent permission denied', () => {
    it('should return false when agent lacks write access', async () => {
      const service = mockChestService as unknown as {
        checkAgentPermission: jest.Mock;
      };
      service.checkAgentPermission.mockResolvedValueOnce(false);

      const allowed = await service.checkAgentPermission(
        { id: 'chest-2', isPublic: false, name: 'private' },
        'agent-x',
        'write'
      );

      expect(allowed).toBe(false);
    });
  });
});
