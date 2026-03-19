import { PrismaClient } from '@prisma/client';
import { MemoryService } from './memory';
import { StorageService } from './storage';
import { ContextService } from './context';

interface AppendMessageInput {
  role: string;
  encryptedContent: Buffer;
  l0Summary: string;
  sha256: string;
}

interface ExtractedMemory {
  uri: string;
  l0: string;
  l1: string;
  encryptedL2: Buffer;
  sha256: string;
}

export class SessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly memory: MemoryService,
    private readonly storage: StorageService,
    private readonly context: ContextService
  ) {}

  async create(
    userId: string,
    chestId: string,
    clientId?: string
  ): Promise<{ id: string; status: string; createdAt: Date }> {
    const session = await this.prisma.session.create({
      data: { userId, chestId, clientId },
    });

    await this.context.startSession(userId, session.id);

    return {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
    };
  }

  async get(
    userId: string,
    sessionId: string
  ): Promise<{
    id: string;
    status: string;
    messageCount: number;
    createdAt: Date;
    closedAt: Date | null;
  }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new Error('Session not found');
    }

    return {
      id: session.id,
      status: session.status,
      messageCount: session.messageCount,
      createdAt: session.createdAt,
      closedAt: session.closedAt,
    };
  }

  async appendMessage(
    userId: string,
    sessionId: string,
    input: AppendMessageInput
  ): Promise<{ messageIndex: number }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new Error('Session not found');
    }

    if (session.status === 'closed') {
      throw new Error('Session is closed');
    }

    const msgKey = `${userId}/sessions/${sessionId}/msg-${session.messageCount}.enc`;
    await this.storage.upload(msgKey, input.encryptedContent, input.sha256);
    await this.context.appendSessionMessage(userId, sessionId, input.l0Summary);

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: { messageCount: { increment: 1 } },
    });

    return { messageIndex: updated.messageCount - 1 };
  }

  async close(
    userId: string,
    sessionId: string,
    chestId: string,
    chestName: string,
    extractedMemories: ExtractedMemory[]
  ): Promise<{ memoriesExtracted: number }> {
    if (extractedMemories.length > 50) {
      throw new Error('Maximum 50 memories per session close');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new Error('Session not found');
    }

    if (session.status === 'closed') {
      throw new Error('Session already closed');
    }

    for (const mem of extractedMemories) {
      await this.memory.remember(userId, {
        uri: mem.uri,
        chestId,
        chestName,
        l0: mem.l0,
        l1: mem.l1,
        encryptedL2: mem.encryptedL2,
        sha256: mem.sha256,
      });
    }

    await this.context.closeSession(userId, sessionId);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        memoriesExtracted: extractedMemories.length,
      },
    });

    return { memoriesExtracted: extractedMemories.length };
  }

  async list(
    userId: string,
    options: { status?: string; page: number; limit: number; chestId?: string }
  ) {
    const where: Record<string, unknown> = { userId };
    if (options.status === 'active' || options.status === 'closed') {
      where.status = options.status;
    }
    if (options.chestId) {
      where.chestId = options.chestId;
    }

    const [sessions, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.session.count({ where }),
    ]);

    return { data: sessions, total };
  }
}
