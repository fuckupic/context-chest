import { PrismaClient, UsageAction } from '@prisma/client';

export class UsageLimitError extends Error {
  readonly code = 'USAGE_LIMIT_REACHED';

  constructor(action: string) {
    super(`USAGE_LIMIT_REACHED: ${action} limit exceeded`);
    this.name = 'UsageLimitError';
  }
}

export class UsageService {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
  }

  private currentPeriod(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  async increment(userId: string, action: UsageAction): Promise<void> {
    const period = this.currentPeriod();
    await this.prisma.usageRecord.upsert({
      where: { userId_action_period: { userId, action, period } },
      create: { userId, action, period, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  async checkMemoryLimit(userId: string, limit: number): Promise<void> {
    const count = await this.prisma.memoryEntry.count({ where: { userId } });
    if (count >= limit) {
      throw new UsageLimitError('memory_count');
    }
  }

  async checkOperationLimit(userId: string, action: UsageAction, limit: number): Promise<void> {
    const period = this.currentPeriod();
    const record = await this.prisma.usageRecord.findUnique({
      where: { userId_action_period: { userId, action, period } },
    });
    if (record && record.count >= limit) {
      throw new UsageLimitError(action);
    }
  }
}
