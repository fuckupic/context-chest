import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const agentTracker: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', async (request) => {
    const agentName = request.headers['x-agent-name'] as string | undefined;
    if (!agentName) return;

    let userId: string | undefined;
    try {
      const decoded = request.user as Record<string, unknown> | undefined;
      if (decoded && decoded.sub) {
        userId = decoded.sub as string;
      }
    } catch {
      return;
    }

    if (!userId) return;

    await prisma.agentConnection.upsert({
      where: {
        userId_agentName: { userId, agentName },
      },
      create: {
        userId,
        agentName,
        requestCount: 1,
      },
      update: {
        lastSeenAt: new Date(),
        requestCount: { increment: 1 },
      },
    }).catch(() => {
      // Non-critical — don't fail the request
    });
  });
};

export default fp(agentTracker);
