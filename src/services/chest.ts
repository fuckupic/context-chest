import { PrismaClient, Chest } from '@prisma/client';
import { getPlanLimits } from '../lib/plan-limits';

export class PlanLimitError extends Error {
  readonly code = 'PLAN_LIMIT';
  readonly resource: string;
  readonly limit: number;

  constructor(resource: string, limit: number) {
    super(`Plan limit reached: ${resource} (max ${limit})`);
    this.resource = resource;
    this.limit = limit;
  }
}

interface CreateChestInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  isAutoCreated?: boolean;
}

interface PermissionInput {
  agentName: string;
  canRead: boolean;
  canWrite: boolean;
}

export class ChestService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, input: CreateChestInput, plan?: string): Promise<Chest> {
    const limits = getPlanLimits(plan);
    const count = await this.prisma.chest.count({ where: { userId } });
    if (count >= limits.maxChests) {
      throw new PlanLimitError('chests', limits.maxChests);
    }
    return this.prisma.chest.create({
      data: { userId, name: input.name, description: input.description, isPublic: input.isPublic ?? false, isAutoCreated: input.isAutoCreated ?? false },
    });
  }

  async list(userId: string) {
    return this.prisma.chest.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { memories: true } } },
    });
  }

  async resolveByName(userId: string, name: string): Promise<Chest> {
    const chest = await this.prisma.chest.findFirst({ where: { userId, name } });
    if (!chest) throw new Error('Chest not found');
    return chest;
  }

  async getOrCreateDefault(userId: string): Promise<Chest> {
    const existing = await this.prisma.chest.findFirst({ where: { userId, name: 'default' } });
    if (existing) return existing;
    return this.prisma.chest.create({
      data: { userId, name: 'default', description: 'Default chest', isPublic: true },
    });
  }

  async delete(userId: string, chestId: string): Promise<void> {
    const chest = await this.prisma.chest.findUnique({ where: { id: chestId } });
    if (!chest || chest.userId !== userId) throw new Error('Chest not found');
    if (chest.name === 'default') throw new Error('Cannot delete the default chest');
    await this.prisma.chest.delete({ where: { id: chestId } });
  }

  async checkAgentPermission(
    chest: Pick<Chest, 'id' | 'isPublic' | 'name'>,
    agentName: string,
    operation: 'read' | 'write'
  ): Promise<boolean> {
    if (chest.isPublic) return true;

    const permission = await this.prisma.chestPermission.findUnique({
      where: { chestId_agentName: { chestId: chest.id, agentName } },
    });
    if (!permission) return false;
    return operation === 'write' ? permission.canWrite : permission.canRead;
  }

  async setPermissions(userId: string, chestId: string, permissions: PermissionInput[]): Promise<void> {
    const chest = await this.prisma.chest.findUnique({ where: { id: chestId } });
    if (!chest || chest.userId !== userId) throw new Error('Chest not found');

    await this.prisma.$transaction(
      permissions.map((perm) =>
        this.prisma.chestPermission.upsert({
          where: { chestId_agentName: { chestId, agentName: perm.agentName } },
          create: { chestId, agentName: perm.agentName, canRead: perm.canRead, canWrite: perm.canWrite },
          update: { canRead: perm.canRead, canWrite: perm.canWrite },
        })
      )
    );
  }

  async getPermissions(userId: string, chestId: string) {
    const chest = await this.prisma.chest.findUnique({ where: { id: chestId } });
    if (!chest || chest.userId !== userId) throw new Error('Chest not found');
    return this.prisma.chestPermission.findMany({ where: { chestId } });
  }

  async upsertByName(userId: string, input: CreateChestInput): Promise<Chest> {
    return this.prisma.chest.upsert({
      where: { userId_name: { userId, name: input.name } },
      create: { userId, name: input.name, description: input.description, isPublic: input.isPublic ?? false, isAutoCreated: input.isAutoCreated ?? false },
      update: {},
    });
  }
}
