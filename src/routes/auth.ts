import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { hashSync, compareSync } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { resolveApiKey } from './api-keys';

const prisma = new PrismaClient();

// Auth helper that supports both API keys and JWTs
async function authenticateRequest(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  // Try API key first
  const apiKeyUser = await resolveApiKey(prisma, request.headers.authorization);
  if (apiKeyUser) return apiKeyUser.userId;

  // Fall back to JWT
  try {
    await request.jwtVerify();
    return (request.user as Record<string, unknown>).sub as string;
  } catch {
    reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token' });
    return null;
  }
}

const REFRESH_TOKEN_EXPIRY_DAYS = 30;

function generateRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register
  fastify.post('/register', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password || password.length < 8) {
      return reply.code(400).send({ code: 'INVALID_INPUT', message: 'Email and password (min 8 chars) required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ code: 'EMAIL_EXISTS', message: 'Account already exists' });
    }

    const passwordHash = hashSync(password, 10);
    const exportKey = createHash('sha256').update(`context-chest:${email}:${password}`).digest('hex');

    const user = await prisma.user.create({ data: { email, passwordHash } });
    const token = fastify.jwt.sign({ sub: user.id });
    const refreshToken = await createRefreshToken(user.id);

    return { token, refreshToken, userId: user.id, exportKey };
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash || !compareSync(password, user.passwordHash)) {
      return reply.code(401).send({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const exportKey = createHash('sha256').update(`context-chest:${email}:${password}`).digest('hex');
    const token = fastify.jwt.sign({ sub: user.id });
    const refreshToken = await createRefreshToken(user.id);

    return { token, refreshToken, userId: user.id, exportKey };
  });

  // Refresh — exchange a valid refresh token for a new JWT + refresh token
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      return reply.code(400).send({ code: 'MISSING_REFRESH_TOKEN', message: 'refreshToken is required' });
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      return reply.code(401).send({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired' });
    }

    // Rotate: delete old, issue new
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const token = fastify.jwt.sign({ sub: stored.userId });
    const newRefreshToken = await createRefreshToken(stored.userId);

    return { token, refreshToken: newRefreshToken };
  });

  // Store wrapped master key (409 if already set)
  fastify.put('/master-key', async (request, reply) => {
    const userId = await authenticateRequest(request, reply);
    if (!userId) return;

    const { encryptedMasterKey } = request.body as { encryptedMasterKey: string };
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return reply.code(404).send({ code: 'USER_NOT_FOUND', message: 'User not found' });
    if (user.encryptedMasterKey) return reply.code(409).send({ code: 'MASTER_KEY_EXISTS', message: 'Already set. Use /master-key/rotate.' });

    await prisma.user.update({ where: { id: userId }, data: { encryptedMasterKey: Buffer.from(encryptedMasterKey, 'base64') } });
    return { success: true };
  });

  // Retrieve wrapped master key
  fastify.get('/master-key', async (request, reply) => {
    const userId = await authenticateRequest(request, reply);
    if (!userId) return;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.encryptedMasterKey) return reply.code(404).send({ code: 'MASTER_KEY_NOT_FOUND', message: 'No master key found.' });
    return { encryptedMasterKey: Buffer.from(user.encryptedMasterKey).toString('base64') };
  });

  // Rotate master key
  fastify.post('/master-key/rotate', async (request, reply) => {
    const userId = await authenticateRequest(request, reply);
    if (!userId) return;

    const { encryptedMasterKey } = request.body as { encryptedMasterKey: string };
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.encryptedMasterKey) return reply.code(404).send({ code: 'MASTER_KEY_NOT_FOUND', message: 'No master key to rotate.' });
    await prisma.user.update({ where: { id: userId }, data: { encryptedMasterKey: Buffer.from(encryptedMasterKey, 'base64') } });
    return { success: true };
  });

  // Me — returns userId and email for the authenticated user (works with both JWT and API key)
  fastify.get('/me', { preHandler: require('../plugins/role-guard').requirePermission('browse') }, async (request) => {
    const userId = (request as unknown as Record<string, unknown>).userId as string;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, stripePlan: true } });
    return { userId: user?.id, email: user?.email, plan: user?.stripePlan ?? 'free' };
  });
};
