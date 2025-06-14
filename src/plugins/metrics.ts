import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { Registry, Counter, Histogram } from 'prom-client';

const register = new Registry();

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const metrics: FastifyPluginAsync = async (fastify) => {
  // Add metrics endpoint
  fastify.get('/metrics', async (_, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  // Add request duration metrics
  fastify.addHook('onRequest', (request, _, done) => {
    request.metrics = {
      startTime: process.hrtime(),
    };
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    const { startTime } = request.metrics;
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    httpRequestsTotal.inc({
      method: request.method,
      route: request.routeOptions.url,
      status_code: reply.statusCode,
    });

    httpRequestDuration.observe(
      {
        method: request.method,
        route: request.routeOptions.url,
      },
      duration
    );

    done();
  });
};

export default fp(metrics); 