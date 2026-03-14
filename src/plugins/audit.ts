import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { AuditService } from '../services/audit';

const auditService = new AuditService();

const audit: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', async (request, reply) => {
    if (request.url === '/health' || request.url === '/ready') {
      return;
    }

    let userId: string | undefined;
    try {
      const decoded = request.user;
      if (decoded && decoded.sub) {
        userId = decoded.sub;
      }
    } catch {
      // Not authenticated
    }

    if (userId) {
      const contentLength = request.headers['content-length'];
      const bytes = contentLength ? parseInt(contentLength) : undefined;

      await auditService.log(userId, {
        route: request.url,
        method: request.method,
        ip: request.ip,
        status: reply.statusCode,
        bytes,
      });
    }
  });
};

export default fp(audit);
