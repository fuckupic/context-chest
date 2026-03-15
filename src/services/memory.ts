import { PrismaClient } from '@prisma/client';
import { StorageService } from './storage';
import { ContextService } from './context';

interface RememberInput {
  uri: string;
  chestId: string;
  chestName: string;
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

interface BrowseEntry {
  uri: string;
  l0: string;
  type: 'file' | 'directory';
  children?: BrowseEntry[];
}

export class MemoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService | null,
    private readonly context: ContextService
  ) {}

  private s3Key(userId: string, chestId: string, uri: string): string {
    return `${userId}/chests/${chestId}/memories/${uri}.enc`;
  }

  async remember(
    userId: string,
    input: RememberInput
  ): Promise<{ uri: string; createdAt: Date }> {
    const key = this.s3Key(userId, input.chestId, input.uri);

    if (this.storage) {
      await this.storage.upload(key, input.encryptedL2, input.sha256);
    }

    await this.context.write(userId, input.uri, { l0: input.l0, l1: input.l1 }, input.chestName).catch(() => {});

    try {
      const entry = await this.prisma.memoryEntry.upsert({
        where: { userId_chestId_uri: { userId, chestId: input.chestId, uri: input.uri } },
        create: {
          userId,
          chestId: input.chestId,
          uri: input.uri,
          s3Key: key,
          sha256: input.sha256,
          sizeBytes: input.encryptedL2.length,
          l0: input.l0,
          l1: input.l1,
          content: input.encryptedL2,
        },
        update: {
          s3Key: key,
          sha256: input.sha256,
          sizeBytes: input.encryptedL2.length,
          l0: input.l0,
          l1: input.l1,
          content: input.encryptedL2,
        },
      });

      return { uri: entry.uri, createdAt: entry.createdAt };
    } catch (error) {
      if (this.storage) {
        await this.storage.delete(key).catch(() => {});
      }
      throw error;
    }
  }

  async recall(
    userId: string,
    chestId: string,
    chestName: string,
    input: RecallInput
  ): Promise<RecallResult> {
    try {
      const { results, total } = await this.context.find(
        userId,
        input.query,
        input.limit,
        input.offset,
        chestName
      );
      if (results.length > 0) {
        return { data: results, total };
      }
    } catch {
      // OpenViking unavailable — fall through to Prisma
    }

    const words = input.query.toLowerCase().split(/\s+/).filter(Boolean);
    const where = {
      userId,
      chestId,
      OR: words.flatMap((word) => [
        { l0: { contains: word, mode: 'insensitive' as const } },
        { l1: { contains: word, mode: 'insensitive' as const } },
        { uri: { contains: word, mode: 'insensitive' as const } },
      ]),
    };

    const [entries, total] = await Promise.all([
      this.prisma.memoryEntry.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.memoryEntry.count({ where }),
    ]);

    return {
      data: entries.map((e) => ({
        uri: e.uri,
        l0: e.l0,
        l1: e.l1,
        score: 1.0,
      })),
      total,
    };
  }

  async getContent(userId: string, chestId: string, uri: string): Promise<Buffer> {
    const entry = await this.prisma.memoryEntry.findUnique({
      where: { userId_chestId_uri: { userId, chestId, uri } },
    });

    if (!entry) {
      throw new Error('Memory not found');
    }

    if (entry.content) {
      return Buffer.from(entry.content);
    }
    if (this.storage) {
      return this.storage.download(entry.s3Key);
    }
    throw new Error('Content not available');
  }

  async forget(userId: string, chestId: string, chestName: string, uri: string): Promise<void> {
    const entry = await this.prisma.memoryEntry.findUnique({
      where: { userId_chestId_uri: { userId, chestId, uri } },
    });

    if (!entry) {
      throw new Error('Memory not found');
    }

    await this.context.delete(userId, uri, chestName).catch(() => {});
    if (this.storage) {
      await this.storage.delete(entry.s3Key).catch(() => {});
    }
    await this.prisma.memoryEntry.delete({ where: { id: entry.id } });
  }

  async browse(
    userId: string,
    chestId: string,
    path: string,
    _depth: number
  ): Promise<BrowseEntry[]> {
    const prefix = path ? `${path}/` : '';

    const entries = await this.prisma.memoryEntry.findMany({
      where: {
        userId,
        chestId,
        ...(prefix ? { uri: { startsWith: prefix } } : {}),
      },
      select: { uri: true, l0: true },
      orderBy: { uri: 'asc' },
    });

    const tree: BrowseEntry[] = [];
    const dirs = new Map<string, BrowseEntry>();

    for (const entry of entries) {
      const relativePath = prefix ? entry.uri.slice(prefix.length) : entry.uri;
      const segments = relativePath.split('/');

      if (segments.length === 1) {
        tree.push({ uri: entry.uri, l0: entry.l0, type: 'file' });
      } else {
        const dirName = segments[0];
        const dirUri = prefix ? `${path}/${dirName}` : dirName;
        if (!dirs.has(dirUri)) {
          const dirEntry: BrowseEntry = { uri: dirUri, l0: '', type: 'directory', children: [] };
          dirs.set(dirUri, dirEntry);
          tree.push(dirEntry);
        }
        dirs.get(dirUri)!.children!.push({
          uri: entry.uri,
          l0: entry.l0,
          type: 'file',
        });
      }
    }

    return tree;
  }

  async list(
    userId: string,
    chestId: string,
    page: number = 1,
    limit: number = 100
  ): Promise<{
    data: Array<{ uri: string; sha256: string; sizeBytes: number; createdAt: Date }>;
    total: number;
  }> {
    const where = { userId, chestId };
    const [entries, total] = await Promise.all([
      this.prisma.memoryEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.memoryEntry.count({ where }),
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

  async updateContent(
    userId: string,
    chestId: string,
    uri: string,
    encryptedL2: Buffer,
    sha256: string,
    encryptionVersion: number
  ): Promise<void> {
    const entry = await this.prisma.memoryEntry.findUnique({
      where: { userId_chestId_uri: { userId, chestId, uri } },
    });
    if (!entry) throw new Error('Memory not found');

    const key = this.s3Key(userId, chestId, uri);
    if (this.storage) await this.storage.upload(key, encryptedL2, sha256);

    await this.prisma.memoryEntry.update({
      where: { id: entry.id },
      data: { s3Key: key, sha256, sizeBytes: encryptedL2.length, content: encryptedL2, encryptionVersion },
    });
  }

  async autoSortUri(userId: string, chestName: string, l0: string, l1: string): Promise<string> {
    return this.context.categorize(userId, chestName, l0, l1);
  }
}
