import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

export const connectRoutes: FastifyPluginAsync = async (fastify) => {
  // Start authorization
  fastify.post('/authorize', async (request, reply) => {
    const userId = request.user.sub;
    const { client_id, requested_scopes } = request.body as {
      client_id: string;
      requested_scopes: string[];
    };

    const client = await prisma.client.findUnique({
      where: { clientId: client_id },
    });

    if (!client) {
      reply.code(400).send({
        code: 'INVALID_CLIENT',
        message: 'Invalid client ID',
      });
      return;
    }

    const consentCode = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.grant.create({
      data: {
        userId,
        clientId: client_id,
        scopes: requested_scopes,
        expiresAt,
        jwtId: consentCode,
      },
    });

    return { consent_code: consentCode };
  });

  // Exchange consent code for token
  fastify.post('/token', async (request, reply) => {
    const { consent_code, client_secret } = request.body as {
      consent_code: string;
      client_secret: string;
    };

    const grant = await prisma.grant.findUnique({
      where: { jwtId: consent_code },
      include: { client: true },
    });

    if (!grant) {
      reply.code(400).send({
        code: 'INVALID_CONSENT_CODE',
        message: 'Invalid consent code',
      });
      return;
    }

    if (grant.expiresAt < new Date()) {
      reply.code(400).send({
        code: 'EXPIRED_CONSENT_CODE',
        message: 'Consent code has expired',
      });
      return;
    }

    const clientSecretHash = createHash('sha256')
      .update(client_secret)
      .digest('hex');

    if (clientSecretHash !== grant.client.clientSecretHash) {
      reply.code(400).send({
        code: 'INVALID_CLIENT_SECRET',
        message: 'Invalid client secret',
      });
      return;
    }

    const token = fastify.jwt.sign(
      {
        sub: grant.userId,
        aud: grant.clientId,
        scopes: grant.scopes,
      },
      {
        expiresIn: '30d',
        jti: grant.jwtId,
      }
    );

    return { grant_token: token };
  });

  // Introspect token
  fastify.post('/introspect', async (request, reply) => {
    try {
      const decoded = fastify.jwt.verify(request.headers.authorization!.split(' ')[1]);
      return {
        active: true,
        scopes: decoded.scopes,
        exp: decoded.exp,
      };
    } catch (error) {
      reply.code(401).send({
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    }
  });
}; 