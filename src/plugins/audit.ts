import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const audit: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', async (request, reply) => {
    // Skip health and ready checks
    if (request.url === '/health' || request.url === '/ready') {
      return;
    }

    // Get user ID from JWT if available
    let userId: string | undefined;
    try {
      const decoded = request.user;
      if (decoded && decoded.sub) {
        userId = decoded.sub;
      }
    } catch (error) {
      // Not authenticated
    }

    // Get IP address
    const ip = request.ip;

    // Get request size
    const contentLength = request.headers['content-length'];
    const bytes = contentLength ? parseInt(contentLength) : null;

    // Create audit log entry
    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          route: request.url,
          method: request.method,
          ip,
          status: reply.statusCode,
          bytes,
        },
      });
    }
  });
};

export default fp(audit); 