import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
// S3Client imported only if S3_ENDPOINT is configured
import rateLimit from './plugins/rate-limit';
import validation from './plugins/validation';
import audit from './plugins/audit';
import metrics from './plugins/metrics';
import { authRoutes } from './routes/auth';
import { vaultRoutes } from './routes/vault';
import { connectRoutes } from './routes/connect';
import { memoryRoutes } from './routes/memory';
import { sessionRoutes } from './routes/sessions';
import { MemoryService } from './services/memory';
import { SessionService } from './services/session';
import { StorageService } from './services/storage';
import { ContextService } from './services/context';
import { UsageService } from './services/usage';
import roleGuard from './plugins/role-guard';
import agentTracker from './plugins/agent-tracker';

const prisma = new PrismaClient();

// S3 is optional — if not configured, blobs are stored in Postgres
const storageService = process.env.S3_ENDPOINT
  ? new StorageService({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION!,
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      bucket: process.env.S3_BUCKET!,
    })
  : null;

const contextService = new ContextService({
  baseUrl: process.env.OPENVIKING_URL ?? 'http://localhost:8000',
  apiKey: process.env.OV_API_KEY ?? 'dev-openviking-key',
});

const memoryService = new MemoryService(prisma, storageService, contextService);
const usageService = new UsageService(prisma);
const sessionService = new SessionService(prisma, memoryService, storageService, contextService);

const app = Fastify({
  logger: true,
});

// Register plugins
app.register(cors, {
  origin: [
    'http://localhost:5173', // Vite dev server
    process.env.PWA_URL!, // Production PWA
    /^chrome-extension:\/\/.*$/, // Chrome extensions
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-BLOB-SHA256', 'X-Agent-Name'],
  credentials: true,
  maxAge: 86400, // 24 hours
});

app.register(jwt, {
  secret: process.env.JWT_SECRET!,
  sign: {
    expiresIn: '1h',
  },
});

app.register(swagger, {
  openapi: {
    info: {
      title: 'Context Chest API',
      version: '1.0.0',
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  app.register(swaggerUi, {
    routePrefix: '/docs',
  });
}

app.register(rateLimit);
app.register(validation);
app.register(audit);
app.register(agentTracker);
app.register(metrics);

// Register routes
app.register(authRoutes, { prefix: '/v1/auth' });
app.register(vaultRoutes, { prefix: '/v1/vault' });
app.register(connectRoutes, { prefix: '/v1/connect' });
app.register(roleGuard);
app.register(memoryRoutes(memoryService, usageService), { prefix: '/v1/memory' });
app.register(sessionRoutes(sessionService, usageService), { prefix: '/v1/sessions' });

// Health check
app.get('/health', async () => {
  return { status: 'ok' };
});

// Readiness check
app.get('/ready', async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  } catch (error) {
    app.log.error(error);
    throw error;
  }
});

// File size guard
app.addHook('onSend', async (request, reply) => {
  if (request.method === 'PUT' && request.url === '/v1/vault/blob') {
    const contentLength = request.headers['content-length'];
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
      reply.code(413).send({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'File size exceeds 10MB limit',
      });
    }
  }
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: parseInt(process.env.PORT ?? '3000'), host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start(); 