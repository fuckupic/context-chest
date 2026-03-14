import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { hashSync, compareSync } from 'bcryptjs';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

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

    return { token, userId: user.id, exportKey };
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

    return { token, userId: user.id, exportKey };
  });

  // Store wrapped master key (409 if already set)
  fastify.put('/master-key', async (request, reply) => {
    try { await request.jwtVerify(); } catch { return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token' }); }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const { encryptedMasterKey } = request.body as { encryptedMasterKey: string };
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return reply.code(404).send({ code: 'USER_NOT_FOUND', message: 'User not found' });
    if (user.encryptedMasterKey) return reply.code(409).send({ code: 'MASTER_KEY_EXISTS', message: 'Already set. Use /master-key/rotate.' });

    await prisma.user.update({ where: { id: userId }, data: { encryptedMasterKey: Buffer.from(encryptedMasterKey, 'base64') } });
    return { success: true };
  });

  // Retrieve wrapped master key
  fastify.get('/master-key', async (request, reply) => {
    try { await request.jwtVerify(); } catch { return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token' }); }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.encryptedMasterKey) return reply.code(404).send({ code: 'MASTER_KEY_NOT_FOUND', message: 'No master key found.' });
    return { encryptedMasterKey: Buffer.from(user.encryptedMasterKey).toString('base64') };
  });

  // Rotate master key
  fastify.post('/master-key/rotate', async (request, reply) => {
    try { await request.jwtVerify(); } catch { return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token' }); }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const { encryptedMasterKey } = request.body as { encryptedMasterKey: string };
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.encryptedMasterKey) return reply.code(404).send({ code: 'MASTER_KEY_NOT_FOUND', message: 'No master key to rotate.' });
    await prisma.user.update({ where: { id: userId }, data: { encryptedMasterKey: Buffer.from(encryptedMasterKey, 'base64') } });
    return { success: true };
  });
};
