import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../plugins/role-guard';
import { SessionService } from '../services/session';
import { UsageService } from '../services/usage';

const appendSchema = z.object({
  role: z.string().min(1),
  encryptedContent: z.string().min(1),
  l0Summary: z.string().min(1).max(500),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const closeSchema = z.object({
  memories: z
    .array(
      z.object({
        uri: z.string().min(1).max(500),
        l0: z.string().min(1).max(500),
        l1: z.string().min(1).max(10000),
        encryptedL2: z.string().min(1),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
    )
    .max(50),
});

export function sessionRoutes(
  sessionService: SessionService,
  usageService: UsageService
): FastifyPluginAsync {
  return async (fastify) => {
    // Create session
    fastify.post(
      '/',
      { preHandler: requirePermission('sessions') },
      async (request) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const { clientId } = (request.body as { clientId?: string }) ?? {};

        const session = await sessionService.create(userId, clientId);
        await usageService.increment(userId, 'session_create');

        return { success: true, data: session };
      }
    );

    // Append message
    fastify.post(
      '/:id/messages',
      { preHandler: requirePermission('sessions') },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const { id } = request.params as { id: string };
        const body = appendSchema.parse(request.body);

        try {
          const result = await sessionService.appendMessage(userId, id, {
            role: body.role,
            encryptedContent: Buffer.from(body.encryptedContent, 'base64'),
            l0Summary: body.l0Summary,
            sha256: body.sha256,
          });

          return { success: true, data: result };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          reply.code(400).send({ code: 'SESSION_ERROR', message });
        }
      }
    );

    // Close session
    fastify.post(
      '/:id/close',
      { preHandler: requirePermission('sessions') },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const { id } = request.params as { id: string };
        const body = closeSchema.parse(request.body);

        try {
          const memories = body.memories.map((m) => ({
            ...m,
            encryptedL2: Buffer.from(m.encryptedL2, 'base64'),
          }));

          const result = await sessionService.close(userId, id, memories);
          await usageService.increment(userId, 'session_close');

          return { success: true, data: result };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          reply.code(400).send({ code: 'SESSION_ERROR', message });
        }
      }
    );

    // Get session
    fastify.get(
      '/:id',
      { preHandler: requirePermission('sessions') },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const { id } = request.params as { id: string };

        try {
          const session = await sessionService.get(userId, id);
          return { success: true, data: session };
        } catch {
          reply.code(404).send({
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
          });
        }
      }
    );
  };
}
