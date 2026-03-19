import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { requirePermission } from '../plugins/role-guard';
import { PrismaClient } from '@prisma/client';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): string {
  const bytes = randomBytes(32);
  return `cc_${bytes.toString('hex')}`;
}

export function apiKeyRoutes(prisma: PrismaClient): FastifyPluginAsync {
  return async (fastify) => {
    // Generate API key
    fastify.post(
      '/',
      { preHandler: requirePermission('grants') },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const body = z.object({
          name: z.string().min(1).max(100).optional(),
        }).parse(request.body ?? {});

        const rawKey = generateApiKey();
        const keyHash = hashApiKey(rawKey);
        const prefix = rawKey.slice(0, 10);

        await prisma.apiKey.create({
          data: { userId, keyHash, prefix, name: body.name ?? 'default' },
        });

        // Get the user's export key info
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, encryptedMasterKey: true },
        });

        // Get the encrypted master key as base64
        const mkRes = await fastify.inject({
          method: 'GET',
          url: '/v1/auth/master-key',
          headers: { authorization: request.headers.authorization },
        });
        const encryptedMasterKey = mkRes.statusCode === 200
          ? (JSON.parse(mkRes.body) as { encryptedMasterKey: string }).encryptedMasterKey
          : null;

        reply.code(201).send({
          success: true,
          data: {
            apiKey: rawKey,
            exportKey: request.headers['x-export-key'] as string | undefined,
            encryptedMasterKey,
            prefix,
            name: body.name ?? 'default',
            note: 'Save these now — the API key will not be shown again.',
          },
        });
      }
    );

    // List API keys (prefix only)
    fastify.get(
      '/',
      { preHandler: requirePermission('grants') },
      async (request) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const keys = await prisma.apiKey.findMany({
          where: { userId },
          select: { id: true, prefix: true, name: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: keys };
      }
    );

    // Revoke API key
    fastify.delete(
      '/:id',
      { preHandler: requirePermission('grants') },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const { id } = request.params as { id: string };

        const key = await prisma.apiKey.findUnique({ where: { id } });
        if (!key || key.userId !== userId) {
          reply.code(404).send({ code: 'NOT_FOUND', message: 'API key not found' });
          return;
        }

        await prisma.apiKey.delete({ where: { id } });
        reply.code(204).send();
      }
    );
  };
}

// Middleware: resolve user from API key
export async function resolveApiKey(
  prisma: PrismaClient,
  authHeader: string | undefined
): Promise<{ userId: string } | null> {
  if (!authHeader?.startsWith('Bearer cc_')) return null;

  const rawKey = authHeader.slice(7); // Remove 'Bearer '
  const keyHash = hashApiKey(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { userId: true },
  });

  return apiKey;
}
