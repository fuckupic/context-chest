import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../plugins/role-guard';
import { ChestService, PlanLimitError } from '../services/chest';

const createSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/, 'Lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

const setPermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      agentName: z.string().min(1).max(200),
      canRead: z.boolean(),
      canWrite: z.boolean(),
    })
  ).max(50),
});

export function chestRoutes(chestService: ChestService): FastifyPluginAsync {
  return async (fastify) => {
    // POST / — create chest
    fastify.post('/', { preHandler: requirePermission('remember') }, async (request, reply) => {
      const userId = (request as unknown as Record<string, unknown>).userId as string;
      const body = createSchema.parse(request.body);
      try {
        const plan = (request as unknown as Record<string, unknown>).stripePlan as string;
        const chest = await chestService.create(userId, body, plan);
        reply.code(201).send({ success: true, data: chest });
      } catch (err) {
        if (err instanceof PlanLimitError) {
          reply.code(402).send({ code: err.code, resource: err.resource, limit: err.limit, upgradeUrl: '/pricing' });
          return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('Unique constraint')) {
          reply.code(409).send({ code: 'CHEST_EXISTS', message: 'Chest with this name already exists' });
          return;
        }
        throw err;
      }
    });

    // GET / — list chests
    fastify.get('/', { preHandler: requirePermission('browse') }, async (request) => {
      const userId = (request as unknown as Record<string, unknown>).userId as string;
      return { success: true, data: await chestService.list(userId) };
    });

    // GET /:id/permissions
    fastify.get('/:id/permissions', { preHandler: requirePermission('browse') }, async (request, reply) => {
      const userId = (request as unknown as Record<string, unknown>).userId as string;
      const { id } = request.params as { id: string };
      try {
        const perms = await chestService.getPermissions(userId, id);
        return { success: true, data: perms };
      } catch (err) {
        reply.code(404).send({ code: 'CHEST_NOT_FOUND', message: (err as Error).message });
      }
    });

    // PUT /:id/permissions
    fastify.put('/:id/permissions', { preHandler: requirePermission('grants') }, async (request, reply) => {
      const userId = (request as unknown as Record<string, unknown>).userId as string;
      const { id } = request.params as { id: string };
      const body = setPermissionsSchema.parse(request.body);
      try {
        await chestService.setPermissions(userId, id, body.permissions);
        const updated = await chestService.getPermissions(userId, id);
        return { success: true, data: updated };
      } catch (err) {
        reply.code(404).send({ code: 'CHEST_NOT_FOUND', message: (err as Error).message });
      }
    });

    // DELETE /:id
    fastify.delete('/:id', { preHandler: requirePermission('forget') }, async (request, reply) => {
      const userId = (request as unknown as Record<string, unknown>).userId as string;
      const { id } = request.params as { id: string };
      try {
        await chestService.delete(userId, id);
        reply.code(204).send();
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes('default')) {
          reply.code(403).send({ code: 'CANNOT_DELETE_DEFAULT', message });
          return;
        }
        reply.code(404).send({ code: 'CHEST_NOT_FOUND', message });
      }
    });
  };
}
