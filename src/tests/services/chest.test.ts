import { ChestService } from '../../services/chest';

const mockPrisma = {
  chest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn().mockResolvedValue(0), // default: under limit
  },
  chestPermission: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ChestService', () => {
  let service: ChestService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.chest.count.mockResolvedValue(0); // default: under limit
    service = new ChestService(mockPrisma as never);
  });

  describe('create', () => {
    it('should create a chest with name and description', async () => {
      const now = new Date();
      const chest = { id: 'chest-1', userId: 'user-1', name: 'work', description: 'Work notes', isPublic: false, isAutoCreated: false, createdAt: now };
      mockPrisma.chest.create.mockResolvedValue(chest);

      const result = await service.create('user-1', { name: 'work', description: 'Work notes' });

      expect(mockPrisma.chest.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: 'work', description: 'Work notes', isPublic: false, isAutoCreated: false },
      });
      expect(result.name).toBe('work');
      expect(result.description).toBe('Work notes');
    });

    it('should default isPublic to false when not provided', async () => {
      const chest = { id: 'chest-1', userId: 'user-1', name: 'private', description: undefined, isPublic: false, isAutoCreated: false, createdAt: new Date() };
      mockPrisma.chest.create.mockResolvedValue(chest);

      await service.create('user-1', { name: 'private' });

      expect(mockPrisma.chest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isPublic: false }),
      });
    });

    it('should respect isPublic: true when provided', async () => {
      const chest = { id: 'chest-1', userId: 'user-1', name: 'shared', description: undefined, isPublic: true, isAutoCreated: false, createdAt: new Date() };
      mockPrisma.chest.create.mockResolvedValue(chest);

      await service.create('user-1', { name: 'shared', isPublic: true });

      expect(mockPrisma.chest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isPublic: true }),
      });
    });

    it('should pass isAutoCreated: true when provided', async () => {
      const chest = { id: 'chest-1', userId: 'user-1', name: 'auto-chest', description: undefined, isPublic: false, isAutoCreated: true, createdAt: new Date() };
      mockPrisma.chest.create.mockResolvedValue(chest);

      await service.create('user-1', { name: 'auto-chest', isAutoCreated: true });

      expect(mockPrisma.chest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isAutoCreated: true }),
      });
    });

    it('should default isAutoCreated to false when not provided', async () => {
      const chest = { id: 'chest-1', userId: 'user-1', name: 'manual', description: undefined, isPublic: false, isAutoCreated: false, createdAt: new Date() };
      mockPrisma.chest.create.mockResolvedValue(chest);

      await service.create('user-1', { name: 'manual' });

      expect(mockPrisma.chest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isAutoCreated: false }),
      });
    });

    it('throws PlanLimitError when free user exceeds 3 chests', async () => {
      mockPrisma.chest.count.mockResolvedValue(3);
      await expect(service.create('user-1', { name: 'test' }, 'free')).rejects.toThrow('Plan limit reached');
    });
  });

  describe('list', () => {
    it('should list all chests for a user ordered by createdAt asc with memory count', async () => {
      const chests = [
        { id: 'chest-1', userId: 'user-1', name: 'default', createdAt: new Date('2024-01-01'), _count: { memories: 3 } },
        { id: 'chest-2', userId: 'user-1', name: 'work', createdAt: new Date('2024-01-02'), _count: { memories: 7 } },
      ];
      mockPrisma.chest.findMany.mockResolvedValue(chests);

      const result = await service.list('user-1');

      expect(mockPrisma.chest.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { memories: true } } },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('default');
    });

    it('should return empty array when no chests exist', async () => {
      mockPrisma.chest.findMany.mockResolvedValue([]);

      const result = await service.list('user-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('resolveByName', () => {
    it('should return chest when found by name', async () => {
      const chest = { id: 'chest-1', userId: 'user-1', name: 'work', createdAt: new Date() };
      mockPrisma.chest.findFirst.mockResolvedValue(chest);

      const result = await service.resolveByName('user-1', 'work');

      expect(mockPrisma.chest.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', name: 'work' },
      });
      expect(result.name).toBe('work');
    });

    it('should throw when chest not found', async () => {
      mockPrisma.chest.findFirst.mockResolvedValue(null);

      await expect(service.resolveByName('user-1', 'nonexistent')).rejects.toThrow('Chest not found');
    });
  });

  describe('getOrCreateDefault', () => {
    it('should return existing default chest if it exists', async () => {
      const existing = { id: 'chest-1', userId: 'user-1', name: 'default', isPublic: true, createdAt: new Date() };
      mockPrisma.chest.findFirst.mockResolvedValue(existing);

      const result = await service.getOrCreateDefault('user-1');

      expect(mockPrisma.chest.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', name: 'default' },
      });
      expect(mockPrisma.chest.create).not.toHaveBeenCalled();
      expect(result.name).toBe('default');
    });

    it('should create default chest when none exists', async () => {
      const created = { id: 'chest-1', userId: 'user-1', name: 'default', description: 'Default chest', isPublic: true, createdAt: new Date() };
      mockPrisma.chest.findFirst.mockResolvedValue(null);
      mockPrisma.chest.create.mockResolvedValue(created);

      const result = await service.getOrCreateDefault('user-1');

      expect(mockPrisma.chest.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: 'default', description: 'Default chest', isPublic: true },
      });
      expect(result.name).toBe('default');
    });
  });

  describe('delete', () => {
    it('should delete a non-default chest', async () => {
      const chest = { id: 'chest-2', userId: 'user-1', name: 'work', isPublic: false };
      mockPrisma.chest.findUnique.mockResolvedValue(chest);
      mockPrisma.chest.delete.mockResolvedValue(chest);

      await service.delete('user-1', 'chest-2');

      expect(mockPrisma.chest.delete).toHaveBeenCalledWith({ where: { id: 'chest-2' } });
    });

    it('should throw when attempting to delete the default chest', async () => {
      const chest = { id: 'chest-1', userId: 'user-1', name: 'default', isPublic: true };
      mockPrisma.chest.findUnique.mockResolvedValue(chest);

      await expect(service.delete('user-1', 'chest-1')).rejects.toThrow('Cannot delete the default chest');
      expect(mockPrisma.chest.delete).not.toHaveBeenCalled();
    });

    it('should throw when chest does not belong to the user', async () => {
      const chest = { id: 'chest-2', userId: 'user-99', name: 'work', isPublic: false };
      mockPrisma.chest.findUnique.mockResolvedValue(chest);

      await expect(service.delete('user-1', 'chest-2')).rejects.toThrow('Chest not found');
      expect(mockPrisma.chest.delete).not.toHaveBeenCalled();
    });

    it('should throw when chest does not exist', async () => {
      mockPrisma.chest.findUnique.mockResolvedValue(null);

      await expect(service.delete('user-1', 'chest-999')).rejects.toThrow('Chest not found');
    });
  });

  describe('checkAgentPermission', () => {
    it('should allow access to public chests without checking permissions', async () => {
      const chest = { id: 'chest-1', isPublic: true, name: 'shared' };

      const result = await service.checkAgentPermission(chest, 'agent-x', 'read');

      expect(result).toBe(true);
      expect(mockPrisma.chestPermission.findUnique).not.toHaveBeenCalled();
    });

    it('should deny when no permission row exists for private chest', async () => {
      const chest = { id: 'chest-1', isPublic: false, name: 'private' };
      mockPrisma.chestPermission.findUnique.mockResolvedValue(null);

      const result = await service.checkAgentPermission(chest, 'agent-x', 'read');

      expect(result).toBe(false);
    });

    it('should return canRead for read operations', async () => {
      const chest = { id: 'chest-1', isPublic: false, name: 'private' };
      mockPrisma.chestPermission.findUnique.mockResolvedValue({ canRead: true, canWrite: false });

      const result = await service.checkAgentPermission(chest, 'agent-x', 'read');

      expect(result).toBe(true);
    });

    it('should return false for read when canRead is false', async () => {
      const chest = { id: 'chest-1', isPublic: false, name: 'private' };
      mockPrisma.chestPermission.findUnique.mockResolvedValue({ canRead: false, canWrite: true });

      const result = await service.checkAgentPermission(chest, 'agent-x', 'read');

      expect(result).toBe(false);
    });

    it('should return canWrite for write operations', async () => {
      const chest = { id: 'chest-1', isPublic: false, name: 'private' };
      mockPrisma.chestPermission.findUnique.mockResolvedValue({ canRead: true, canWrite: true });

      const result = await service.checkAgentPermission(chest, 'agent-x', 'write');

      expect(result).toBe(true);
    });

    it('should return false for write when canWrite is false', async () => {
      const chest = { id: 'chest-1', isPublic: false, name: 'private' };
      mockPrisma.chestPermission.findUnique.mockResolvedValue({ canRead: true, canWrite: false });

      const result = await service.checkAgentPermission(chest, 'agent-x', 'write');

      expect(result).toBe(false);
    });
  });

  describe('setPermissions', () => {
    it('should upsert permissions using $transaction', async () => {
      const chest = { id: 'chest-1', userId: 'user-1', name: 'work' };
      mockPrisma.chest.findUnique.mockResolvedValue(chest);
      mockPrisma.$transaction.mockResolvedValue([]);

      const permissions = [
        { agentName: 'agent-a', canRead: true, canWrite: false },
        { agentName: 'agent-b', canRead: true, canWrite: true },
      ];

      await service.setPermissions('user-1', 'chest-1', permissions);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const calls = mockPrisma.$transaction.mock.calls[0][0];
      expect(calls).toHaveLength(2);
    });

    it('should throw when chest does not belong to the user', async () => {
      const chest = { id: 'chest-1', userId: 'user-99', name: 'work' };
      mockPrisma.chest.findUnique.mockResolvedValue(chest);

      await expect(
        service.setPermissions('user-1', 'chest-1', [{ agentName: 'agent-a', canRead: true, canWrite: true }])
      ).rejects.toThrow('Chest not found');

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw when chest does not exist', async () => {
      mockPrisma.chest.findUnique.mockResolvedValue(null);

      await expect(
        service.setPermissions('user-1', 'chest-999', [{ agentName: 'agent-a', canRead: true, canWrite: true }])
      ).rejects.toThrow('Chest not found');
    });
  });

  describe('upsertByName', () => {
    it('should call prisma.chest.upsert with correct args', async () => {
      const chest = { id: 'chest-1', userId: 'user-1', name: 'work', description: 'Work notes', isPublic: false, isAutoCreated: false, createdAt: new Date() };
      mockPrisma.chest.upsert.mockResolvedValue(chest);

      const result = await service.upsertByName('user-1', { name: 'work', description: 'Work notes' });

      expect(mockPrisma.chest.upsert).toHaveBeenCalledWith({
        where: { userId_name: { userId: 'user-1', name: 'work' } },
        create: { userId: 'user-1', name: 'work', description: 'Work notes', isPublic: false, isAutoCreated: false },
        update: {},
      });
      expect(result.name).toBe('work');
    });

    it('should pass isAutoCreated: true in the create payload', async () => {
      const chest = { id: 'chest-2', userId: 'user-1', name: 'auto', description: undefined, isPublic: false, isAutoCreated: true, createdAt: new Date() };
      mockPrisma.chest.upsert.mockResolvedValue(chest);

      await service.upsertByName('user-1', { name: 'auto', isAutoCreated: true });

      expect(mockPrisma.chest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isAutoCreated: true }),
        })
      );
    });

    it('should return existing chest without modification when it already exists', async () => {
      const existing = { id: 'chest-1', userId: 'user-1', name: 'work', isPublic: false, isAutoCreated: false, createdAt: new Date() };
      mockPrisma.chest.upsert.mockResolvedValue(existing);

      const result = await service.upsertByName('user-1', { name: 'work' });

      expect(mockPrisma.chest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} })
      );
      expect(result.id).toBe('chest-1');
    });
  });

  describe('getPermissions', () => {
    it('should return all permissions for a chest', async () => {
      const chest = { id: 'chest-1', userId: 'user-1', name: 'work' };
      const perms = [
        { id: 'perm-1', chestId: 'chest-1', agentName: 'agent-a', canRead: true, canWrite: false },
        { id: 'perm-2', chestId: 'chest-1', agentName: 'agent-b', canRead: true, canWrite: true },
      ];
      mockPrisma.chest.findUnique.mockResolvedValue(chest);
      mockPrisma.chestPermission.findMany.mockResolvedValue(perms);

      const result = await service.getPermissions('user-1', 'chest-1');

      expect(mockPrisma.chestPermission.findMany).toHaveBeenCalledWith({
        where: { chestId: 'chest-1' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].agentName).toBe('agent-a');
    });

    it('should throw when chest does not belong to the user', async () => {
      const chest = { id: 'chest-1', userId: 'user-99', name: 'work' };
      mockPrisma.chest.findUnique.mockResolvedValue(chest);

      await expect(service.getPermissions('user-1', 'chest-1')).rejects.toThrow('Chest not found');
      expect(mockPrisma.chestPermission.findMany).not.toHaveBeenCalled();
    });

    it('should throw when chest does not exist', async () => {
      mockPrisma.chest.findUnique.mockResolvedValue(null);

      await expect(service.getPermissions('user-1', 'chest-999')).rejects.toThrow('Chest not found');
    });
  });
});
