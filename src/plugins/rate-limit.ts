import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of points
  duration: 60, // Per minute
});

const rateLimit: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      const ip = request.ip;
      await rateLimiter.consume(ip);
    } catch (error) {
      const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 60;
      reply.header('Retry-After', retryAfter);
      reply.code(429).send({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryAfter,
      });
    }
  });
};

export default fp(rateLimit); 