import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../plugins/role-guard';
import { requireChest } from '../plugins/chest-guard';
import { ChestService } from '../services/chest';
import { MemoryService } from '../services/memory';
import { UsageService, UsageLimitError } from '../services/usage';
import { ChestRouter } from '../services/chest-router';

const rememberSchema = z.object({
  uri: z.string().min(1).max(500),
  l0: z.string().min(1).max(500),
  l1: z.string().min(1).max(10000),
  encryptedL2: z.string().min(1).refine(
    (s) => Buffer.byteLength(s, 'base64') <= 10 * 1024 * 1024,
    'Encrypted L2 exceeds 10MB limit'
  ),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const recallSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

export function memoryRoutes(
  memoryService: MemoryService,
  usageService: UsageService,
  chestService: ChestService,
  chestRouter: ChestRouter
): FastifyPluginAsync {
  const chestGuard = requireChest(chestService);
  return async (fastify) => {
    // Remember
    fastify.post(
      '/remember',
      { preHandler: [requirePermission('remember'), chestGuard] },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const chestId = (request as unknown as Record<string, unknown>).chestId as string;
        const chestName = (request as unknown as Record<string, unknown>).chestName as string;
        const body = rememberSchema.parse(request.body);

        try {
          await usageService.checkMemoryLimit(userId, 1000);
        } catch (err) {
          if (err instanceof UsageLimitError) {
            reply.code(429).send({ code: err.code, message: err.message });
            return;
          }
          throw err;
        }

        const encryptedL2 = Buffer.from(body.encryptedL2, 'base64');
        const result = await memoryService.remember(userId, {
          uri: body.uri,
          chestId,
          chestName,
          l0: body.l0,
          l1: body.l1,
          encryptedL2,
          sha256: body.sha256,
        });

        await usageService.increment(userId, 'remember');
        return { success: true, data: result };
      }
    );

    // Recall
    fastify.post(
      '/recall',
      { preHandler: [requirePermission('recall'), chestGuard] },
      async (request) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const chestId = (request as unknown as Record<string, unknown>).chestId as string;
        const chestName = (request as unknown as Record<string, unknown>).chestName as string;
        const body = recallSchema.parse(request.body);
        const results = await memoryService.recall(userId, chestId, chestName, body);
        await usageService.increment(userId, 'recall');
        return {
          success: true,
          data: results.data,
          meta: {
            total: results.total,
            page: Math.floor(body.offset / body.limit) + 1,
            limit: body.limit,
          },
        };
      }
    );

    // Content — uses wildcard because URIs contain slashes
    fastify.get(
      '/content/*',
      { preHandler: [requirePermission('content'), chestGuard] },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const chestId = (request as unknown as Record<string, unknown>).chestId as string;
        const uri = (request.params as Record<string, string>)['*'];

        try {
          const content = await memoryService.getContent(userId, chestId, uri);
          await usageService.increment(userId, 'content_fetch');
          reply.header('Content-Type', 'application/octet-stream');
          return content;
        } catch {
          reply.code(404).send({ code: 'MEMORY_NOT_FOUND', message: 'Memory not found' });
        }
      }
    );

    // Forget — wildcard for slash-separated URIs
    fastify.delete(
      '/forget/*',
      { preHandler: [requirePermission('forget'), chestGuard] },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const chestId = (request as unknown as Record<string, unknown>).chestId as string;
        const chestName = (request as unknown as Record<string, unknown>).chestName as string;
        const uri = (request.params as Record<string, string>)['*'];

        try {
          await memoryService.forget(userId, chestId, chestName, uri);
          reply.code(204).send();
        } catch {
          reply.code(404).send({ code: 'MEMORY_NOT_FOUND', message: 'Memory not found' });
        }
      }
    );

    // Browse
    fastify.get(
      '/browse',
      { preHandler: [requirePermission('browse'), chestGuard] },
      async (request) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const chestId = (request as unknown as Record<string, unknown>).chestId as string;
        const { path, depth, page, limit } = request.query as {
          path?: string;
          depth?: string;
          page?: string;
          limit?: string;
        };

        const tree = await memoryService.browse(
          userId,
          chestId,
          path ?? '',
          parseInt(depth ?? '2')
        );

        await usageService.increment(userId, 'browse');
        return {
          success: true,
          data: { tree },
          meta: {
            total: (tree as unknown[]).length,
            page: parseInt(page ?? '1'),
            limit: parseInt(limit ?? '50'),
          },
        };
      }
    );

    // List — direct Prisma query, no OpenViking needed
    fastify.get(
      '/list',
      { preHandler: [requirePermission('browse'), chestGuard] },
      async (request) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const chestId = (request as unknown as Record<string, unknown>).chestId as string;
        const { page, limit } = request.query as { page?: string; limit?: string };

        const result = await memoryService.list(
          userId,
          chestId,
          parseInt(page ?? '1'),
          parseInt(limit ?? '100')
        );

        return {
          success: true,
          data: result.data,
          meta: { total: result.total, page: parseInt(page ?? '1'), limit: parseInt(limit ?? '100') },
        };
      }
    );

    // Auto-sort
    fastify.post(
      '/auto-sort',
      { preHandler: [requirePermission('remember'), chestGuard] },
      async (request) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const chestName = (request as unknown as Record<string, unknown>).chestName as string;
        const body = z.object({ l0: z.string().min(1).max(500), l1: z.string().min(1).max(10000) }).parse(request.body);
        const uri = await memoryService.autoSortUri(userId, chestName, body.l0, body.l1);
        return { success: true, data: { uri } };
      }
    );

    // Auto-chest — resolve which chest a memory belongs to
    fastify.post(
      '/auto-chest',
      { preHandler: requirePermission('remember') },
      async (request) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const body = z.object({
          l0: z.string().min(1).max(500),
          l1: z.string().min(1).max(10000),
        }).parse(request.body);
        const result = await chestRouter.resolve(userId, body.l0, body.l1);
        return { success: true, data: result };
      }
    );

    // Update content (migration)
    fastify.put(
      '/content/*',
      { preHandler: [requirePermission('remember'), chestGuard] },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const chestId = (request as unknown as Record<string, unknown>).chestId as string;
        const chestName = (request as unknown as Record<string, unknown>).chestName as string;
        const uri = (request.params as Record<string, string>)['*'];
        const body = z.object({
          encryptedL2: z.string().min(1),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          encryptionVersion: z.number().int().min(1).max(2),
          l0: z.string().min(1).max(500).optional(),
          l1: z.string().min(1).max(10000).optional(),
        }).parse(request.body);
        try {
          await memoryService.updateContent(userId, chestId, chestName, uri, Buffer.from(body.encryptedL2, 'base64'), body.sha256, body.encryptionVersion, body.l0, body.l1);
          return { success: true };
        } catch {
          reply.code(404).send({ code: 'MEMORY_NOT_FOUND', message: 'Memory not found' });
        }
      }
    );
  };
}
