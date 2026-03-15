import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Global: 100 req/min per IP
const globalLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
});

// Auth: 5 req/min per IP (register, login, refresh)
const authLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
});

const rateLimit: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      const ip = request.ip;
      const isAuth = request.url.startsWith('/v1/auth/');

      if (isAuth) {
        await authLimiter.consume(ip);
      }
      await globalLimiter.consume(ip);
    } catch (err) {
      const error = err as { msBeforeNext?: number };
      const retryAfter = Math.ceil((error.msBeforeNext ?? 60000) / 1000);
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
