import { FastifyRequest, FastifyReply } from 'fastify';
import { ChestService } from '../services/chest';

export function requireChest(chestService: ChestService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as unknown as Record<string, unknown>).userId as string | undefined;
    if (!userId) {
      reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      return;
    }

    const chestHeader = request.headers['x-chest'] as string | undefined;
    const chestQuery = (request.query as Record<string, string>)?.chest;
    const chestName = chestHeader ?? chestQuery ?? 'default';

    try {
      const chest = chestName === 'default'
        ? await chestService.getOrCreateDefault(userId)
        : await chestService.resolveByName(userId, chestName);

      const agentName = request.headers['x-agent-name'] as string | undefined;
      if (agentName) {
        const isWrite = ['POST', 'PUT', 'DELETE'].includes(request.method);
        const allowed = await chestService.checkAgentPermission(chest, agentName, isWrite ? 'write' : 'read');
        if (!allowed) {
          reply.code(403).send({
            code: 'CHEST_ACCESS_DENIED',
            message: `Agent '${agentName}' does not have access to chest '${chestName}'`,
          });
          return;
        }
      }

      (request as unknown as Record<string, unknown>).chestId = chest.id;
      (request as unknown as Record<string, unknown>).chestName = chest.name;
    } catch {
      reply.code(404).send({ code: 'CHEST_NOT_FOUND', message: `Chest '${chestName}' not found` });
    }
  };
}
