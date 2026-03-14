import { FastifyPluginAsync } from 'fastify';
import { PrismaClient, Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { GrantService } from '../services/grant';

const prisma = new PrismaClient();
const grantService = new GrantService();

export const connectRoutes: FastifyPluginAsync = async (fastify) => {
  // Start authorization
  fastify.post('/authorize', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing token',
      });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const { client_id, role } = request.body as {
      client_id: string;
      role: Role;
    };

    const validRoles: Role[] = ['tool', 'assistant', 'admin'];
    if (!validRoles.includes(role)) {
      reply.code(400).send({
        code: 'INVALID_ROLE',
        message: `Role must be one of: ${validRoles.join(', ')}`,
      });
      return;
    }

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
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.grant.create({
      data: {
        userId,
        clientId: client_id,
        role,
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
        role: grant.role,
      },
      {
        expiresIn: '30d',
        jti: grant.jwtId,
      }
    );

    return {
      grant_token: token,
      role: grant.role,
      scopes: grantService.deriveScopesFromRole(grant.role),
    };
  });

  // Introspect token
  fastify.post('/introspect', async (request, reply) => {
    try {
      const token = request.headers.authorization!.split(' ')[1];
      const decoded = fastify.jwt.verify(token) as Record<string, unknown>;
      const role = (decoded.role as Role) ?? 'tool';

      return {
        active: true,
        role,
        permissions: grantService.permissionsForRole(role),
        scopes: grantService.deriveScopesFromRole(role),
        exp: decoded.exp,
      };
    } catch {
      reply.code(401).send({
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    }
  });

  // List grants for user
  fastify.get('/grants', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing token',
      });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;

    const grants = await prisma.grant.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      include: { client: { select: { name: true } } },
    });

    return {
      grants: grants.map((g) => ({
        id: g.id,
        clientName: g.client.name,
        clientId: g.clientId,
        role: g.role,
        createdAt: g.createdAt,
        expiresAt: g.expiresAt,
      })),
    };
  });

  // Revoke a grant
  fastify.delete('/grants/:id', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing token',
      });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const { id } = request.params as { id: string };

    const grant = await prisma.grant.findFirst({
      where: { id, userId },
    });

    if (!grant) {
      reply.code(404).send({
        code: 'GRANT_NOT_FOUND',
        message: 'Grant not found',
      });
      return;
    }

    await prisma.grant.delete({ where: { id } });
    reply.code(204).send();
  });
};
