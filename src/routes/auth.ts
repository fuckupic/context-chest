import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import {
  opaqueRegisterStart,
  opaqueLoginStart,
  opaqueLoginFinish,
} from '../plugins/opaque';

const prisma = new PrismaClient();

// In-memory state store for OPAQUE multi-step flows (production: use Redis)
const opaqueState = new Map<string, Uint8Array>();

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Start registration — client sends registrationRequest bytes
  fastify.post('/register', async (request, reply) => {
    const { email, registrationRequest } = request.body as {
      email: string;
      registrationRequest: string; // base64
    };

    const reqBytes = new Uint8Array(Buffer.from(registrationRequest, 'base64'));
    const { registrationResponse, serverState } = await opaqueRegisterStart(
      email,
      reqBytes
    );

    opaqueState.set(`reg:${email}`, serverState);

    return {
      registrationResponse: Buffer.from(registrationResponse).toString('base64'),
    };
  });

  // Complete registration — client sends record bytes
  fastify.post('/register/finish', async (request, reply) => {
    const { email, record } = request.body as {
      email: string;
      record: string; // base64
    };

    const recordBytes = new Uint8Array(Buffer.from(record, 'base64'));
    opaqueState.delete(`reg:${email}`);

    const user = await prisma.user.create({
      data: {
        email,
        opaqueRecord: Buffer.from(recordBytes),
      },
    });

    const token = fastify.jwt.sign({ sub: user.id });
    return { token };
  });

  // Start login — client sends credentialRequest bytes
  fastify.post('/login', async (request, reply) => {
    const { email, credentialRequest } = request.body as {
      email: string;
      credentialRequest: string; // base64
    };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      reply.code(401).send({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    const reqBytes = new Uint8Array(Buffer.from(credentialRequest, 'base64'));
    const record = new Uint8Array(user.opaqueRecord);

    const { credentialResponse, serverState } = await opaqueLoginStart(
      email,
      reqBytes,
      record
    );

    opaqueState.set(`login:${email}`, serverState);

    return {
      credentialResponse: Buffer.from(credentialResponse).toString('base64'),
    };
  });

  // Complete login — client sends credentialFinalization bytes
  fastify.post('/login/finish', async (request, reply) => {
    const { email, credentialFinalization } = request.body as {
      email: string;
      credentialFinalization: string; // base64
    };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      reply.code(401).send({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    const serverState = opaqueState.get(`login:${email}`);
    if (!serverState) {
      reply.code(400).send({
        code: 'INVALID_STATE',
        message: 'No pending login for this email',
      });
      return;
    }

    try {
      const finBytes = new Uint8Array(
        Buffer.from(credentialFinalization, 'base64')
      );
      await opaqueLoginFinish(serverState, finBytes);
      opaqueState.delete(`login:${email}`);

      const token = fastify.jwt.sign({ sub: user.id });
      return { token };
    } catch {
      reply.code(401).send({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
  });

  // Store wrapped master key (first time only — returns 409 if already set)
  fastify.put('/master-key', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token' });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const { encryptedMasterKey } = request.body as { encryptedMasterKey: string };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      reply.code(404).send({ code: 'USER_NOT_FOUND', message: 'User not found' });
      return;
    }

    if (user.encryptedMasterKey) {
      reply.code(409).send({
        code: 'MASTER_KEY_EXISTS',
        message: 'Master key already set. Use /master-key/rotate to change it.',
      });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { encryptedMasterKey: Buffer.from(encryptedMasterKey, 'base64') },
    });

    return { success: true };
  });

  // Retrieve wrapped master key
  fastify.get('/master-key', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token' });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.encryptedMasterKey) {
      reply.code(404).send({
        code: 'MASTER_KEY_NOT_FOUND',
        message: 'No master key found.',
      });
      return;
    }

    return {
      encryptedMasterKey: Buffer.from(user.encryptedMasterKey).toString('base64'),
    };
  });

  // Rotate master key (replace wrapped MK — client re-encrypts all L2 content)
  fastify.post('/master-key/rotate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token' });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const { encryptedMasterKey } = request.body as { encryptedMasterKey: string };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.encryptedMasterKey) {
      reply.code(404).send({
        code: 'MASTER_KEY_NOT_FOUND',
        message: 'No master key to rotate.',
      });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { encryptedMasterKey: Buffer.from(encryptedMasterKey, 'base64') },
    });

    return { success: true };
  });
};
