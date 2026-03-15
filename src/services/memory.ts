import { PrismaClient } from '@prisma/client';
import { StorageService } from './storage';
import { ContextService } from './context';

interface RememberInput {
  uri: string;
  l0: string;
  l1: string;
  encryptedL2: Buffer;
  sha256: string;
}

interface RecallInput {
  query: string;
  limit: number;
  offset: number;
}

interface RecallResult {
  data: Array<{ uri: string; l0: string; l1: string; score: number }>;
  total: number;
}

export class MemoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    private readonly context: ContextService
  ) {}

  private s3Key(userId: string, uri: string): string {
    return `${userId}/memories/${uri}.enc`;
  }

  async remember(
    userId: string,
    input: RememberInput
  ): Promise<{ uri: string; createdAt: Date }> {
    const key = this.s3Key(userId, input.uri);

    // Step 1: S3
    await this.storage.upload(key, input.encryptedL2, input.sha256);

    // Step 2: OpenViking (rollback S3 on failure)
    try {
      await this.context.write(userId, input.uri, {
        l0: input.l0,
        l1: input.l1,
      });
    } catch (error) {
      await this.storage.delete(key);
      throw error;
    }

    // Step 3: Prisma (rollback OV + S3 on failure)
    try {
      const entry = await this.prisma.memoryEntry.create({
        data: {
          userId,
          uri: input.uri,
          s3Key: key,
          sha256: input.sha256,
          sizeBytes: input.encryptedL2.length,
        },
      });

      return { uri: entry.uri, createdAt: entry.createdAt };
    } catch (error) {
      await this.context.delete(userId, input.uri);
      await this.storage.delete(key);
      throw error;
    }
  }

  async recall(userId: string, input: RecallInput): Promise<RecallResult> {
    const { results, total } = await this.context.find(
      userId,
      input.query,
      input.limit,
      input.offset
    );

    return { data: results, total };
  }

  async getContent(userId: string, uri: string): Promise<Buffer> {
    const entry = await this.prisma.memoryEntry.findUnique({
      where: { userId_uri: { userId, uri } },
    });

    if (!entry) {
      throw new Error('Memory not found');
    }

    return this.storage.download(entry.s3Key);
  }

  async forget(userId: string, uri: string): Promise<void> {
    const entry = await this.prisma.memoryEntry.findUnique({
      where: { userId_uri: { userId, uri } },
    });

    if (!entry) {
      throw new Error('Memory not found');
    }

    // OpenViking delete may fail if the resource was never indexed — continue anyway
    await this.context.delete(userId, uri).catch(() => {});
    await this.storage.delete(entry.s3Key).catch(() => {});
    await this.prisma.memoryEntry.delete({ where: { id: entry.id } });
  }

  async browse(
    userId: string,
    path: string,
    depth: number
  ): Promise<unknown[]> {
    return this.context.list(userId, path, depth);
  }

  async list(
    userId: string,
    page: number = 1,
    limit: number = 100
  ): Promise<{
    data: Array<{ uri: string; sha256: string; sizeBytes: number; createdAt: Date }>;
    total: number;
  }> {
    const [entries, total] = await Promise.all([
      this.prisma.memoryEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.memoryEntry.count({ where: { userId } }),
    ]);

    return {
      data: entries.map((e) => ({
        uri: e.uri,
        sha256: e.sha256,
        sizeBytes: e.sizeBytes,
        createdAt: e.createdAt,
      })),
      total,
    };
  }
}
