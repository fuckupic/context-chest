import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Opaque } from 'node-opaque';

const prisma = new PrismaClient();
const opaque = new Opaque();

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Start registration
  fastify.post('/register', async (request, reply) => {
    const { email } = request.body as { email: string };

    const registration = await opaque.createRegistrationRequest(email);
    return { msg: registration };
  });

  // Complete registration
  fastify.post('/register/finish', async (request, reply) => {
    const { email, msg } = request.body as { email: string; msg: string };

    const { record } = await opaque.finalizeRequest(msg);
    const user = await prisma.user.create({
      data: {
        email,
        opaqueRecord: record,
      },
    });

    const token = fastify.jwt.sign({ sub: user.id });
    return { token };
  });

  // Start login
  fastify.post('/login', async (request, reply) => {
    const { email } = request.body as { email: string };

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      reply.code(401).send({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    const login = await opaque.createCredentialRequest(email, user.opaqueRecord);
    return { msg: login };
  });

  // Complete login
  fastify.post('/login/finish', async (request, reply) => {
    const { email, msg } = request.body as { email: string; msg: string };

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      reply.code(401).send({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    const { success } = await opaque.recoverCredentials(msg, user.opaqueRecord);

    if (!success) {
      reply.code(401).send({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    const token = fastify.jwt.sign({ sub: user.id });
    return { token };
  });
}; 